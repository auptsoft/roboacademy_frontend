import { beforeAll, describe, expect, it } from 'vitest'
import { initPhysics } from '../engine/physics'
import { Simulation } from '../engine/simulation'
import { emptyScene, type SceneDefinition } from '../scene/types'
import type { ObjectiveSet } from '../grading/types'
import { ProgramSession } from './program-session'
import type { HostToWorker, WorkerToHost } from './protocol'
import { RunController, type RunResult, type WorkerLike } from './run-controller'

beforeAll(async () => {
  await initPhysics()
})

/** An in-process stand-in for the program worker, with the same asynchronous message passing. */
function fakeWorker(): WorkerLike & { terminated: boolean } {
  let terminated = false
  const worker: WorkerLike & { terminated: boolean } = {
    onmessage: null,
    get terminated() {
      return terminated
    },
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

const zoneScene = (): SceneDefinition => ({
  ...emptyScene(),
  robot: { type: 'diff-drive', start: { x: 0, z: 0, headingDeg: 0 } },
  zones: [{ id: 'goal', center: { x: 0.5, z: -0.5 }, size: { x: 0.25, z: 0.25 }, color: '#0f0' }],
})

const reachGoal: ObjectiveSet = {
  version: 1,
  objectives: [{ id: 'reach', label: 'Reach the goal', predicate: { kind: 'robotInZone', zoneId: 'goal' } }],
}

/** Runs a program to completion, advancing 1/60 s of real time per macrotask. */
async function run(code: string, scene = zoneScene(), objectives: ObjectiveSet | null = reachGoal, clock = { t: 0 }) {
  const sim = new Simulation(scene, objectives)
  const highlights: string[] = []
  const prints: string[] = []
  let result: RunResult | null = null
  const controller = new RunController(
    sim,
    fakeWorker,
    { onHighlight: (id) => highlights.push(id), onPrint: (t) => prints.push(t), onEnd: (r) => (result = r) },
    () => clock.t,
  )
  controller.start(code)
  for (let i = 0; i < 20_000 && !result; i++) {
    clock.t += 16
    controller.advance(1000 / 60)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  controller.dispose()
  sim.dispose()
  if (!result) throw new Error('run did not end')
  return { result: result as RunResult, highlights, prints }
}

describe('RunController', () => {
  it('runs a program that reaches the goal and ends early', async () => {
    const { result, highlights, prints } = await run(`
      highlightBlock('b1'); move(50, 80);
      highlightBlock('b2'); turn(90, 60);
      print('turned');
      highlightBlock('b3'); move(50, 80);
      highlightBlock('b4'); move(100, 80);
    `)
    expect(result.outcome).toBe('objectives_met')
    expect(result.grading).toMatchObject({ score: 100, passed: true })
    // Ended as soon as the goal was reached, during the third move.
    expect(highlights).toEqual(['b1', 'b2', 'b3'])
    expect(prints).toEqual(['turned'])
  })

  it('grades a failed run once the program finishes', async () => {
    const { result } = await run('move(20, 50);')
    expect(result.outcome).toBe('objectives_failed')
    expect(result.summary.finalPose.x).toBeCloseTo(0.2, 1)
    expect(result.summary.calls.map((c) => c.call)).toEqual(['move(20, 50)'])
  })

  it('reads sensors and loops with a tick each iteration', async () => {
    const { result } = await run(
      `drive(60, 0);
       while (readSensor('distance_front') > 0.1) { __tick(); }
       stop();`,
      { ...zoneScene(), walls: [{ id: 'w', x: 0.8, z: 0, length: 0.05, thickness: 1, height: 0.2, rotationDeg: 0 }] },
      null,
    )
    expect(result.outcome).toBe('completed')
    // Stopped about 10 cm short of the wall face at x = 0.775, measured from the robot's front.
    expect(result.summary.finalPose.x).toBeGreaterThan(0.55)
    expect(result.summary.finalPose.x).toBeLessThan(0.6)
  })

  it('ends with a runtime error when the robot is blocked', async () => {
    const { result } = await run(
      `highlightBlock('m'); move(200, 80);`,
      { ...zoneScene(), walls: [{ id: 'w', x: 0.5, z: 0, length: 0.05, thickness: 1, height: 0.2, rotationDeg: 0 }] },
    )
    expect(result.outcome).toBe('runtime_error')
    expect(result.summary.error).toEqual({ message: expect.stringMatching(/in the way/), blockId: 'm' })
  })

  it('stops a program that never waits on the robot', async () => {
    // Instant commands never wait on simulated time, so this loop only burns real time. (A loop
    // with no calls at all can only be tested in a real worker: in-process it would block.)
    const { result } = await run('while (true) { stop(); }', zoneScene(), reachGoal, { t: 0 })
    expect(result.outcome).toBe('runtime_error')
    expect(result.summary.error?.message).toMatch(/long time/)
  }, 30_000)

  it('times out at the scene time limit', async () => {
    const { result } = await run('wait(10000);', { ...zoneScene(), timeLimitSec: 5 })
    expect(result.outcome).toBe('timeout')
    expect(result.summary.durationMs).toBeGreaterThanOrEqual(5000)
  })
})
