import { loadPyodide, type PyodideAPI } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import { initPhysics } from '../../engine/physics'
import { Simulation } from '../../engine/simulation'
import type { ObjectiveSet } from '../../grading/types'
import type { HostToWorker, WorkerToHost } from '../../runtime/protocol'
import { PythonSession, describePythonError } from '../../runtime/python-session'
import { RunController, type RunResult, type WorkerLike } from '../../runtime/run-controller'
import { emptyScene, type SceneDefinition } from '../../scene/types'

let pyodide: PyodideAPI

beforeAll(async () => {
  await initPhysics()
  pyodide = await loadPyodide()
}, 60_000)

/** An in-process stand-in for the Python worker, sharing one Pyodide across tests. */
function fakePythonWorker(): WorkerLike {
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
  const session = new PythonSession(
    (message: WorkerToHost) => setTimeout(() => !terminated && worker.onmessage?.({ data: message } as MessageEvent<WorkerToHost>), 0),
    async () => pyodide,
  )
  return worker
}

async function runPython(source: string, scene: SceneDefinition = baseScene(), objectives: ObjectiveSet | null = null) {
  const sim = new Simulation(scene, objectives)
  const highlights: string[] = []
  const prints: string[] = []
  let result: RunResult | null = null
  let clock = 0
  const controller = new RunController(
    sim,
    fakePythonWorker,
    { onHighlight: (id) => highlights.push(id), onPrint: (t) => prints.push(t), onEnd: (r) => (result = r) },
    () => clock,
  )
  controller.start(source)
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

function baseScene(): SceneDefinition {
  return {
    ...emptyScene(),
    robot: { type: 'diff-drive', start: { x: 0, z: 0, headingDeg: 0 } },
    zones: [{ id: 'goal', center: { x: 0.5, z: -0.5 }, size: { x: 0.25, z: 0.25 }, color: '#0f0' }],
  }
}

const reachGoal: ObjectiveSet = {
  version: 1,
  objectives: [{ id: 'reach', label: 'Reach the goal', predicate: { kind: 'robotInZone', zoneId: 'goal' } }],
}

describe('Python programs', () => {
  it('drive the robot with functions and loops and reach the goal', async () => {
    const { result, highlights } = await runPython(
      `def leg(distance, turn=None):
    robot.move(distance, 80)
    if turn == "left":
        robot.turn_left(90, 60)

for distance, turn in [(50, "left"), (50, None)]:
    leg(distance, turn)
print("never reached")
`,
      baseScene(),
      reachGoal,
    )
    expect(result.outcome).toBe('objectives_met')
    expect(highlights).toContain('L2')
    expect(highlights).toContain('L7')
  }, 60_000)

  it('advances time in a sensor loop and prints', async () => {
    const { result, prints } = await runPython(
      `robot.drive(60)
while robot.front_distance() > 10:
    pass
robot.stop()
print("stopped near", round(robot.x()), "cm")
`,
      { ...baseScene(), walls: [{ id: 'w', x: 0.8, z: 0, length: 0.05, thickness: 1, height: 0.2, rotationDeg: 0 }] },
    )
    expect(result.outcome).toBe('completed')
    expect(result.summary.finalPose.x).toBeGreaterThan(0.55)
    expect(result.summary.finalPose.x).toBeLessThan(0.6)
    expect(prints).toHaveLength(1)
    expect(prints[0]).toMatch(/^stopped near \d+ cm$/)
  }, 60_000)

  it('supports classes, lambdas and comprehensions', async () => {
    const { result, prints } = await runPython(
      `class Driver:
    def __init__(self, step):
        self.step = step

    def go(self, times):
        for _ in range(times):
            robot.move(self.step)

def by_length(word):
    return len(word)

def forward_twice(step):
    helper(step)
    helper(step)

def helper(step):
    robot.move(step)

Driver(10).go(2)
forward_twice(5)
readings = [robot.front_distance() for _ in range(2)]
print(sorted([3, 1, 2], key=lambda n: -n), sorted(["ccc", "a", "bb"], key=by_length), len(readings), round(robot.x()))
`,
    )
    expect(result.outcome).toBe('completed')
    expect(prints).toEqual(["[3, 2, 1] ['a', 'bb', 'ccc'] 2 30"])
  }, 60_000)

  it('reports syntax errors with their line', async () => {
    const { result } = await runPython(`robot.move(10)\nrobot.turn_left(90\n`)
    expect(result.outcome).toBe('runtime_error')
    expect(result.summary.error?.blockId).toBe('L2')
    expect(result.summary.error?.message).toMatch(/^Line 2: /)
  }, 60_000)

  it('points runtime errors at the line that failed', async () => {
    const { result } = await runPython(`robot.move(10)\nrobot.move(speed)\n`)
    expect(result.outcome).toBe('runtime_error')
    expect(result.summary.error).toEqual({ blockId: 'L2', message: "NameError: name 'speed' is not defined" })
  }, 60_000)

  it('refuses modules that reach outside the simulator', async () => {
    const { result } = await runPython(`import js\n`)
    expect(result.outcome).toBe('runtime_error')
    expect(result.summary.error?.message).toMatch(/isn't available in the simulator/)
  }, 60_000)
})

describe('describePythonError', () => {
  it('keeps the last traceback line', () => {
    expect(describePythonError(new Error('Traceback (most recent call last):\n  File "<program>", line 2\nZeroDivisionError: division by zero\n')))
      .toEqual({ text: 'ZeroDivisionError: division by zero', line: null })
  })
})

const armScene = (): SceneDefinition => ({
  ...emptyScene(),
  robot: { type: 'arm', start: { x: 0, z: 0, headingDeg: 0 } },
  props: [{ id: 'block', shape: 'box', x: 0.2, z: 0, size: { x: 0.04, y: 0.04, z: 0.04 }, color: '#f00', mass: 0.1 }],
})

describe('robot arm in Python', () => {
  it('picks a block up and puts it down somewhere else', async () => {
    const { result, prints } = await runPython(
      `robot.reach(20, 8)
robot.reach(20, 1, speed=40)
robot.close_gripper()
print(robot.holding())

def put_down(angle):
    robot.reach(20, 10, 40)
    robot.set_base(angle)
    robot.reach(20, 1.5, 40)
    robot.open_gripper()

put_down(90)
print(robot.holding(), robot.base_angle(), robot.gripper_height())
`,
      armScene(),
    )
    expect(result.outcome).toBe('completed')
    expect(prints).toEqual(['True', 'False 90 1.5'])
  }, 30_000)
})

const twoRobotScene = (): SceneDefinition => ({
  ...emptyScene(),
  robot: { type: 'diff-drive', start: { x: -0.5, z: -0.3, headingDeg: 0 } },
  robots: [
    { id: 'rover', type: 'rover', start: { x: -0.5, z: 0.3, headingDeg: 0 } },
    { id: 'arm', type: 'arm', start: { x: 0.8, z: 0, headingDeg: 180 } },
  ],
})

describe('several robots in Python', () => {
  it('moves robots together, from inside a function too', async () => {
    const { result, prints } = await runPython(
      `def go_together(cm):
    robots.rover.start.move(cm)
    robots.arm.start.set_base(45)
    robot.move(cm)
    wait_for_all()

go_together(30)
print(robot.x(), robots.rover.x(), robots.arm.base_angle())
`,
      twoRobotScene(),
    )
    expect(result.outcome).toBe('completed')
    expect(prints).toEqual(['-20.0 -20.0 45'])
    expect(result.summary.durationMs).toBeLessThan(3200)
  }, 30_000)

  it('waits for one robot', async () => {
    const { result, prints } = await runPython(
      `robots.rover.start.turn_left(90)
robots.rover.wait_until_done()
print(robots.rover.heading() > 85)
`,
      twoRobotScene(),
    )
    expect(result.outcome).toBe('completed')
    expect(prints).toEqual(['True'])
  }, 30_000)
})

describe('the pen in Python', () => {
  it('draws, and rejects unknown colours', async () => {
    const ok = await runPython('robot.pen_down()\nrobot.pen_color("blue")\nrobot.move(10)\nrobot.pen_up()\n')
    expect(ok.result.outcome).toBe('completed')
    const bad = await runPython('robot.pen_color("pink")\n')
    expect(bad.result.outcome).toBe('runtime_error')
    expect(bad.result.summary.error?.message).toContain("There is no pen colour 'pink'")
  }, 30_000)
})
