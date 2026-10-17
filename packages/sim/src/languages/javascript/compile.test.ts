import { beforeAll, describe, expect, it } from 'vitest'
import { initPhysics } from '../../engine/physics'
import { Simulation } from '../../engine/simulation'
import type { ObjectiveSet } from '../../grading/types'
import { ProgramSession } from '../../runtime/program-session'
import type { HostToWorker, WorkerToHost } from '../../runtime/protocol'
import { RunController, type RunResult, type WorkerLike } from '../../runtime/run-controller'
import { emptyScene, sceneRobots, type SceneDefinition } from '../../scene/types'
import { getCapability } from '../../robots'
import { shapePoints } from '../../grading/shapes'
import { compileJavaScript } from './compile'

beforeAll(async () => {
  await initPhysics()
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

async function runJs(source: string, scene: SceneDefinition, objectives: ObjectiveSet | null) {
  const compiled = compileJavaScript(source, sceneRobots(scene).map((r) => ({ id: r.id, api: getCapability(r.type)!.api })))
  if (!compiled.ok) throw new Error(compiled.message)
  const sim = new Simulation(scene, objectives)
  const highlights: string[] = []
  const prints: string[] = []
  let result: RunResult | null = null
  let clock = 0
  const controller = new RunController(
    sim,
    fakeWorker,
    { onHighlight: (id) => highlights.push(id), onPrint: (t) => prints.push(t), onEnd: (r) => (result = r) },
    () => clock,
  )
  controller.start(compiled.code)
  for (let i = 0; i < 20_000 && !result; i++) {
    clock += 16
    controller.advance(1000 / 60)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  controller.dispose()
  sim.dispose()
  if (!result) throw new Error('run did not end')
  return { result: result as RunResult, highlights, prints }
}

const scene = (): SceneDefinition => ({
  ...emptyScene(),
  robot: { type: 'diff-drive', start: { x: 0, z: 0, headingDeg: 0 } },
  zones: [{ id: 'goal', center: { x: 0.5, z: -0.5 }, size: { x: 0.25, z: 0.25 }, color: '#0f0' }],
})

describe('compileJavaScript', () => {
  it('produces ES5 with line markers and a tick in every loop', () => {
    const compiled = compileJavaScript('const n = 3;\nfor (let i = 0; i < n; i++) robot.move(10);\nwhile (robot.frontDistance() > 5) {}\n')
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.code).not.toMatch(/\b(let|const)\b/)
    expect(compiled.code).toContain(`highlightBlock("L1")`)
    expect(compiled.code).toContain(`highlightBlock("L2")`)
    expect(compiled.code.match(/__tick\(\)/g)).toHaveLength(2)
  })

  it('reports syntax errors with their line', () => {
    const compiled = compileJavaScript('robot.move(10);\nrobot.turnLeft(90;\n')
    expect(compiled).toMatchObject({ ok: false, line: 2 })
    if (!compiled.ok) expect(compiled.message).toMatch(/^Line 2: /)
  })
})

describe('JavaScript programs', () => {
  it('drive the robot with modern syntax and reach the goal', async () => {
    const { result, highlights, prints } = await run(`
      const legs = [[50, 'left'], [50, null]];
      for (const [distance, turn] of legs) {
        robot.move(distance, 80);
        if (turn === 'left') robot.turnLeft(90, 60);
      }
      console.log('done', { at: robot.x() });
    `)
    expect(result.outcome).toBe('objectives_met')
    expect(highlights).toContain('L4')
    // The goal is reached during the second move, so the log line never runs.
    expect(prints).toEqual([])
  })

  it('advances time in a sensor loop and stops short of the wall', async () => {
    const { result } = await runJs(
      `robot.drive(60);
       while (robot.frontDistance() > 10) {}
       robot.stop();
       console.log('stopped at', robot.x());`,
      { ...scene(), walls: [{ id: 'w', x: 0.8, z: 0, length: 0.05, thickness: 1, height: 0.2, rotationDeg: 0 }] },
      null,
    )
    expect(result.outcome).toBe('completed')
    expect(result.summary.finalPose.x).toBeGreaterThan(0.55)
    expect(result.summary.finalPose.x).toBeLessThan(0.6)
  })

  it('keeps robot.move working when the learner defines their own move function', async () => {
    const { result, prints } = await runJs(
      `function move() { console.log('mine'); }
       move();
       robot.move(20);
       console.log(Math.round(robot.x()));`,
      scene(),
      null,
    )
    expect(result.outcome).toBe('completed')
    expect(prints).toEqual(['mine', '20'])
  })

  it('points runtime errors at the line that failed', async () => {
    const { result } = await runJs(`robot.move(10);\nnotAFunction();\n`, scene(), null)
    expect(result.outcome).toBe('runtime_error')
    expect(result.summary.error).toMatchObject({ blockId: 'L2', message: expect.stringMatching(/notAFunction/) })
  })
})

const reachGoal: ObjectiveSet = {
  version: 1,
  objectives: [{ id: 'reach', label: 'Reach the goal', predicate: { kind: 'robotInZone', zoneId: 'goal' } }],
}

function run(source: string) {
  return runJs(source, scene(), reachGoal)
}

const armScene = (): SceneDefinition => ({
  ...emptyScene(),
  robot: { type: 'arm', start: { x: 0, z: 0, headingDeg: 0 } },
  props: [{ id: 'block', shape: 'box', x: 0.2, z: 0, size: { x: 0.04, y: 0.04, z: 0.04 }, color: '#f00', mass: 0.1 }],
})

describe('robot arm in JavaScript', () => {
  it('picks a block up and puts it down somewhere else', async () => {
    const { result, prints } = await runJs(
      `robot.reach(20, 8);
robot.reach(20, 1, 40);
robot.closeGripper();
console.log(robot.holding());
robot.reach(20, 10, 40);
robot.setBase(90);
robot.reach(20, 1.5, 40);
robot.openGripper();
console.log(robot.holding(), robot.baseAngle(), robot.gripperHeight());
`,
      armScene(),
      null,
    )
    expect(result.outcome).toBe('completed')
    expect(prints).toEqual(['true', 'false 90 1.5'])
  })

  it("doesn't define the wheeled robot's commands", async () => {
    const { result } = await runJs('robot.move(10);\n', armScene(), null)
    expect(result.outcome).toBe('runtime_error')
  })
})

const twoRobotScene = (): SceneDefinition => ({
  ...emptyScene(),
  robot: { type: 'diff-drive', start: { x: -0.5, z: -0.3, headingDeg: 0 } },
  robots: [
    { id: 'rover', type: 'rover', start: { x: -0.5, z: 0.3, headingDeg: 0 } },
    { id: 'arm', type: 'arm', start: { x: 0.8, z: 0, headingDeg: 180 } },
  ],
})

describe('several robots in JavaScript', () => {
  it('moves robots together and waits for them', async () => {
    const { result, prints } = await runJs(
      `robots.rover.start.move(30);
robots.arm.start.setBase(45);
robot.move(30);
waitForAll();
console.log(robot.x(), robots.rover.x(), robots.arm.baseAngle());
`,
      twoRobotScene(),
      null,
    )
    expect(result.outcome).toBe('completed')
    expect(prints).toEqual(['-20 -20 45'])
    // Together: about as long as the slower rover alone (1 s at 0.15 m/s for 30 cm), not the sum.
    expect(result.summary.durationMs).toBeLessThan(3200)
  })

  it('lets started commands finish after the program ends', async () => {
    const { result } = await runJs('robots.rover.start.move(40);\n', twoRobotScene(), null)
    expect(result.outcome).toBe('completed')
    expect(result.summary.robots?.find((r) => r.id === 'rover')?.finalPose.x).toBeCloseTo(-0.1, 1)
  })

  it('reports a started command that fails at once at its line', async () => {
    const { result } = await runJs('robot.move(5);\nrobots.arm.start.reach(45, 5);\nrobot.move(5);\n', twoRobotScene(), null)
    expect(result.outcome).toBe('runtime_error')
    expect(result.summary.error).toEqual({ message: "The arm can't reach that far.", blockId: 'L2' })
  })

  it("names the robot when it can't do a command", async () => {
    const { result } = await runJs('robots.arm.move(10);\n', twoRobotScene(), null)
    expect(result.outcome).toBe('runtime_error')
  })
})

describe('the pen in JavaScript', () => {
  it('draws a square in two colours', async () => {
    const { result } = await runJs(
      `robot.penDown();
for (let side = 0; side < 4; side++) {
  if (side === 2) robot.penColor('Red');
  robot.move(20);
  robot.turnLeft(90);
}
`,
      scene(),
      null,
    )
    expect(result.outcome).toBe('completed')
  })

  it('names the colours when given one it lacks', async () => {
    const { result } = await runJs("robot.penColor('pink');\n", scene(), null)
    expect(result.outcome).toBe('runtime_error')
    expect(result.summary.error?.message).toContain('There is no pen colour "pink". Try black, red, orange')
  })
})

describe('drawing objectives', () => {
  const drawSquare: ObjectiveSet = {
    version: 1,
    objectives: [{ id: 'square', label: 'Draw a 20 cm square', predicate: { kind: 'inkMatches', ...shapePoints('square', 0.2), anywhere: true, toleranceM: 0.02 } }],
  }
  const square = (sideCm: number) => `robot.penDown();
for (let side = 0; side < 4; side++) {
  robot.move(${sideCm});
  robot.turnLeft(90);
}
robot.penUp();
robot.move(20);
`

  it('passes a drawn square', async () => {
    const { result } = await runJs(square(20), scene(), drawSquare)
    expect(result.outcome).toBe('objectives_met')
  })

  it('fails a square of the wrong size', async () => {
    const { result } = await runJs(square(30), scene(), drawSquare)
    expect(result.outcome).toBe('objectives_failed')
  })
})
