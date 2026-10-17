import * as Blockly from 'blockly/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { initPhysics } from '../engine/physics'
import { Simulation } from '../engine/simulation'
import { getCapability } from '../robots'
import { ProgramSession } from '../runtime/program-session'
import type { HostToWorker, WorkerToHost } from '../runtime/protocol'
import { RunController, type RunResult, type WorkerLike } from '../runtime/run-controller'
import { emptyScene, sceneRobots, type SceneDefinition } from '../scene/types'
import { generateCode, registerRobotBlocks, robotToolbox, setSceneRobots } from './robot-blocks'

beforeAll(async () => {
  registerRobotBlocks()
  await initPhysics()
})

function codeFor(state: object): string {
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(state, workspace)
  const code = generateCode(workspace)
  workspace.dispose()
  return code
}

const num = (value: number) => ({ shadow: { type: 'math_number', fields: { NUM: value } } })

describe('robot blocks', () => {
  it('generates robot API calls in robot units, with highlighting', () => {
    const code = codeFor({
      blocks: {
        blocks: [
          {
            type: 'robot_move',
            id: 'm1',
            inputs: { DISTANCE: num(30), SPEED: num(60) },
            next: {
              block: {
                type: 'robot_turn',
                id: 't1',
                fields: { DIRECTION: 'RIGHT' },
                inputs: { DEGREES: num(90), SPEED: num(40) },
                next: { block: { type: 'robot_wait', id: 'w1', inputs: { SECONDS: num(1.5) } } },
              },
            },
          },
        ],
      },
    })
    expect(code).toContain("highlightBlock('m1');\nmove(30, 60);")
    expect(code).toContain('turn(-(90), 40);')
    expect(code).toContain('wait((1.5) * 1000);')
  })

  it('puts a tick in every loop iteration and reads sensors in centimetres', () => {
    const code = codeFor({
      blocks: {
        blocks: [
          {
            type: 'controls_whileUntil',
            id: 'loop',
            fields: { MODE: 'WHILE' },
            inputs: {
              BOOL: {
                block: {
                  type: 'logic_compare',
                  fields: { OP: 'GT' },
                  inputs: {
                    A: { block: { type: 'robot_number_sensor', fields: { SENSOR: 'distance_front' } } },
                    B: { block: { type: 'math_number', fields: { NUM: 10 } } },
                  },
                },
              },
            },
          },
        ],
      },
    })
    expect(code).toMatch(/while \(\(readSensor\('distance_front'\) \* 100\) > 10\) \{\n\s+__tick\(\);/)
  })
})

describe('arm blocks', () => {
  it('generates arm API calls', () => {
    const code = codeFor({
      blocks: {
        blocks: [
          {
            type: 'robot_arm_reach',
            id: 'r1',
            inputs: { DISTANCE: num(20), HEIGHT: num(5), SPEED: num(40) },
            next: {
              block: {
                type: 'robot_arm_joint',
                id: 'j1',
                fields: { JOINT: 'setShoulder' },
                inputs: { DEGREES: num(45), SPEED: num(60) },
                next: { block: { type: 'robot_arm_gripper', id: 'g1', fields: { ACTION: 'CLOSE' } } },
              },
            },
          },
        ],
      },
    })
    expect(code).toContain("highlightBlock('r1');\nreach(20, 5, 40);")
    expect(code).toContain('setShoulder(45, 60);')
    expect(code).toContain('closeGripper();')
  })

  it('offers each robot only its own motion blocks', () => {
    const types = (api: 'wheeled' | 'arm') => JSON.stringify(robotToolbox(api))
    expect(types('arm')).toContain('robot_arm_reach')
    expect(types('arm')).not.toContain('robot_move')
    expect(types('wheeled')).toContain('robot_move')
    expect(types('wheeled')).not.toContain('robot_arm_reach')
  })
})

const twoRobotScene = (): SceneDefinition => ({
  ...emptyScene(),
  robot: { type: 'diff-drive', start: { x: -0.5, z: -0.3, headingDeg: 0 } },
  robots: [{ id: 'rover', type: 'rover', start: { x: -0.5, z: 0.3, headingDeg: 0 } }],
})

function fakeWorker(): WorkerLike {
  let terminated = false
  const worker: WorkerLike = {
    onmessage: null,
    postMessage(message: HostToWorker) {
      if (!terminated) setTimeout(() => !terminated && session.receive(message), 0)
    },
    terminate() {
      terminated = true
    },
  }
  const session = new ProgramSession((message: WorkerToHost) => {
    setTimeout(() => !terminated && worker.onmessage?.({ data: message } as MessageEvent<WorkerToHost>), 0)
  })
  return worker
}

async function runBlocks(code: string, scene: SceneDefinition): Promise<RunResult> {
  const sim = new Simulation(scene, null)
  let result: RunResult | null = null
  let clock = 0
  const controller = new RunController(sim, fakeWorker, { onEnd: (r) => (result = r) }, () => clock)
  controller.start(code)
  for (let i = 0; i < 20_000 && !result; i++) {
    clock += 16
    controller.advance(1000 / 60)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  controller.dispose()
  sim.dispose()
  if (!result) throw new Error('run did not end')
  return result
}

describe('blocks for several robots', () => {
  const program = {
    blocks: {
      blocks: [
        {
          type: 'robot_together',
          id: 'together',
          inputs: {
            DO: {
              block: {
                type: 'robot_move',
                id: 'main',
                inputs: { DISTANCE: num(30), SPEED: num(50) },
                next: {
                  block: {
                    type: 'robot_use',
                    id: 'use',
                    fields: { ROBOT: 'rover' },
                    inputs: { DO: { block: { type: 'robot_move', id: 'rover', inputs: { DISTANCE: num(30), SPEED: num(50) } } } },
                  },
                },
              },
            },
          },
        },
      ],
    },
  }

  it('generates scoped robot and together switches', () => {
    setSceneRobots(sceneRobots(twoRobotScene()).map((r) => ({ id: r.id, capability: getCapability(r.type)! })), [])
    const code = codeFor(program)
    expect(code).toContain('= __together(true);')
    expect(code).toContain("= __useRobot('rover');")
    expect(code).toContain('finally {')
    expect(code).toContain("__robotIdle('');")
  })

  it('runs both robots at the same time', async () => {
    setSceneRobots(sceneRobots(twoRobotScene()).map((r) => ({ id: r.id, capability: getCapability(r.type)! })), [])
    const result = await runBlocks(codeFor(program), twoRobotScene())
    expect(result.outcome).toBe('completed')
    expect(result.summary.finalPose.x).toBeCloseTo(-0.2, 1)
    expect(result.summary.robots?.[0]?.finalPose.x).toBeCloseTo(-0.2, 1)
    expect(result.summary.durationMs).toBeLessThan(3200)
  })

  it('offers the robot blocks only with more than one robot', () => {
    expect(JSON.stringify(robotToolbox(['wheeled'], false))).not.toContain('robot_use')
    const both = JSON.stringify(robotToolbox(['wheeled', 'arm'], true))
    expect(both).toContain('robot_use')
    expect(both).toContain('"Driving"')
    expect(both).toContain('"Arm"')
  })
})

describe('pen blocks', () => {
  it('generates pen calls with the colour index', () => {
    const code = codeFor({
      blocks: {
        blocks: [
          {
            type: 'robot_pen',
            id: 'p1',
            fields: { STATE: 'DOWN' },
            next: { block: { type: 'robot_pen_color', id: 'c1', fields: { COLOR: '4' }, next: { block: { type: 'robot_pen', id: 'p2', fields: { STATE: 'UP' } } } } },
          },
        ],
      },
    })
    expect(code).toContain('penDown();')
    expect(code).toContain('penColor(4);')
    expect(code).toContain('penUp();')
  })
})
