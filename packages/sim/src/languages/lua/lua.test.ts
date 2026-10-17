import { LuaFactory } from 'wasmoon'
import { beforeAll, describe, expect, it } from 'vitest'
import { initPhysics } from '../../engine/physics'
import { Simulation } from '../../engine/simulation'
import type { ObjectiveSet } from '../../grading/types'
import type { HostToWorker, WorkerToHost } from '../../runtime/protocol'
import { LuaSession, describeLuaError } from '../../runtime/lua-session'
import { RunController, type RunResult, type WorkerLike } from '../../runtime/run-controller'
import { emptyScene, type SceneDefinition } from '../../scene/types'
import { instrumentLua } from './instrument'

const factory = new LuaFactory()

beforeAll(async () => {
  await initPhysics()
})

function fakeLuaWorker(): WorkerLike {
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
  const session = new LuaSession(
    (message: WorkerToHost) => setTimeout(() => !terminated && worker.onmessage?.({ data: message } as MessageEvent<WorkerToHost>), 0),
    () => factory.createEngine(),
  )
  return worker
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

async function runLua(source: string, scene: SceneDefinition = baseScene(), objectives: ObjectiveSet | null = null) {
  const sim = new Simulation(scene, objectives)
  const highlights: string[] = []
  const prints: string[] = []
  let result: RunResult | null = null
  let clock = 0
  const controller = new RunController(
    sim,
    fakeLuaWorker,
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

describe('instrumentLua', () => {
  it('adds line markers and loop ticks without moving any line', () => {
    const source = 'local n = 2\nfor i = 1, n do robot.move(10) end\nwhile robot.front_distance() > 5 do\nend\nrepeat\n  n = n - 1\nuntil n == 0\n'
    const result = instrumentLua(source)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code.split('\n')).toHaveLength(source.split('\n').length)
    expect(result.code).toContain('_sim_line(1); local n = 2')
    expect(result.code.match(/_sim_tick\(\)/g)).toHaveLength(3)
  })

  it('reports syntax errors with their line', () => {
    expect(instrumentLua('robot.move(10)\nrobot.turn_left(90\n')).toMatchObject({ ok: false, line: 3 })
  })
})

describe('Lua programs', () => {
  it('drive the robot with functions and loops and reach the goal', async () => {
    const { result, highlights } = await runLua(
      `local function leg(distance, turn)
  robot.move(distance, 80)
  if turn == "left" then
    robot.turn_left(90, 60)
  end
end

for _, step in ipairs({ { 50, "left" }, { 50 } }) do
  leg(step[1], step[2])
end
print("never reached")
`,
      baseScene(),
      reachGoal,
    )
    expect(result.outcome).toBe('objectives_met')
    expect(highlights).toContain('L2')
    expect(highlights).toContain('L9')
  })

  it('advances time in a sensor loop and prints', async () => {
    const { result, prints } = await runLua(
      `robot.drive(60)
while robot.front_distance() > 10 do end
robot.stop()
print("stopped near", math.floor(robot.x()), "cm")
`,
      { ...baseScene(), walls: [{ id: 'w', x: 0.8, z: 0, length: 0.05, thickness: 1, height: 0.2, rotationDeg: 0 }] },
    )
    expect(result.outcome).toBe('completed')
    expect(result.summary.finalPose.x).toBeGreaterThan(0.55)
    expect(result.summary.finalPose.x).toBeLessThan(0.6)
    expect(prints).toHaveLength(1)
    expect(prints[0]).toMatch(/^stopped near\t\d+\tcm$/)
  })

  it('pauses for the robot inside callbacks and pcall', async () => {
    const { result, prints } = await runLua(
      `local steps = { 5, 15, 10 }
table.sort(steps, function(a, b) return a > b end)
local ok = pcall(function()
  for _, s in ipairs(steps) do robot.move(s) end
end)
print(ok, table.concat(steps, ","), math.floor(robot.x() + 0.5))
`,
    )
    expect(result.outcome).toBe('completed')
    expect(prints).toEqual(['true\t15,10,5\t30'])
  })

  it('points runtime errors at the line that failed', async () => {
    const { result } = await runLua(`robot.move(10)\nlocal x = speed + 1\n`)
    expect(result.outcome).toBe('runtime_error')
    expect(result.summary.error?.blockId).toBe('L2')
    expect(result.summary.error?.message).toMatch(/^Line 2: attempt to perform arithmetic on a nil value/)
  })

  it('reports syntax errors before running anything', async () => {
    const { result } = await runLua(`robot.move(10)\nif x then\n`)
    expect(result.outcome).toBe('runtime_error')
    expect(result.summary.error?.message).toMatch(/^Line \d+: /)
    expect(result.summary.calls).toEqual([])
  })

  it('has no file or operating-system access', async () => {
    const { prints } = await runLua(`print(io == nil, os.execute == nil, require == nil)`)
    expect(prints).toEqual(['true\ttrue\ttrue'])
  })
})

describe('describeLuaError', () => {
  it('turns Lua locations into line numbers', () => {
    expect(describeLuaError(new Error('[string "_sim_line(1); local x = ..."]:4: oops')))
      .toEqual({ text: 'Line 4: oops', line: 4 })
  })
})

const armScene = (): SceneDefinition => ({
  ...emptyScene(),
  robot: { type: 'arm', start: { x: 0, z: 0, headingDeg: 0 } },
  props: [{ id: 'block', shape: 'box', x: 0.2, z: 0, size: { x: 0.04, y: 0.04, z: 0.04 }, color: '#f00', mass: 0.1 }],
})

describe('robot arm in Lua', () => {
  it('picks a block up and puts it down somewhere else', async () => {
    const { result, prints } = await runLua(
      `robot.reach(20, 8)
robot.reach(20, 1, 40)
robot.close_gripper()
print(robot.holding())
robot.reach(20, 10, 40)
robot.set_base(90)
robot.reach(20, 1.5, 40)
robot.open_gripper()
print(robot.holding(), robot.base_angle(), robot.gripper_height())
`,
      armScene(),
    )
    expect(result.outcome).toBe('completed')
    expect(prints).toEqual(['true', 'false\t90\t1.5'])
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

describe('several robots in Lua', () => {
  it('moves robots together and waits for them', async () => {
    const { result, prints } = await runLua(
      `robots.rover.start.move(30)
robots.arm.start.set_base(45)
robot.move(30)
wait_for_all()
print(robot.x(), robots.rover.x(), robots.arm.base_angle())
`,
      twoRobotScene(),
    )
    expect(result.outcome).toBe('completed')
    expect(prints).toEqual(['-20.0\t-20.0\t45'])
    expect(result.summary.durationMs).toBeLessThan(3200)
  })
})

describe('the pen in Lua', () => {
  it('draws, and rejects unknown colours', async () => {
    const ok = await runLua('robot.pen_down()\nrobot.pen_color("green")\nrobot.move(10)\nrobot.pen_up()\n')
    expect(ok.result.outcome).toBe('completed')
    const bad = await runLua('robot.pen_color("pink")\n')
    expect(bad.result.outcome).toBe('runtime_error')
    expect(bad.result.summary.error?.message).toContain("There is no pen colour 'pink'")
  })
})
