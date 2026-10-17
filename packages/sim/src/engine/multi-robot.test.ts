import { beforeAll, describe, expect, it } from 'vitest'
import type { ObjectiveSet } from '../grading/types'
import { emptyScene, type SceneDefinition } from '../scene/types'
import { validateObjectives, validateScene } from '../scene/validate'
import { initPhysics } from './physics'
import { Simulation } from './simulation'

beforeAll(async () => {
  await initPhysics()
})

/** Steps until the promise settles, letting promise callbacks run between steps. */
async function runUntil<T>(sim: Simulation, promise: Promise<T>, maxSteps = 60 * 60): Promise<T> {
  let settled = false
  let error: unknown
  let value: T | undefined
  promise.then(
    (v) => ((settled = true), (value = v)),
    (e) => ((settled = true), (error = e)),
  )
  for (let i = 0; i < maxSteps && !settled; i++) {
    sim.step()
    await Promise.resolve()
    await Promise.resolve()
  }
  if (!settled) throw new Error('did not settle')
  if (error) throw error
  return value as T
}

/** The main two-wheeler above the x axis, a rover below it, both facing +X. */
function twoRobots(overrides: Partial<SceneDefinition> = {}): SceneDefinition {
  return {
    ...emptyScene(),
    robot: { type: 'diff-drive', start: { x: -0.5, z: -0.3, headingDeg: 0 } },
    robots: [{ id: 'rover', type: 'rover', start: { x: -0.5, z: 0.3, headingDeg: 0 } }],
    ...overrides,
  }
}

describe('several robots', () => {
  it('moves robots at the same time', async () => {
    const sim = new Simulation(twoRobots(), null)
    const { started } = sim.startCommand('move', { distanceCm: 30, speed: 50 }, 'rover')
    await started
    await runUntil(sim, sim.command('move', { distanceCm: 30, speed: 50 }))
    // The main robot is faster, so the rover is part way when it arrives...
    expect(sim.sensor('pos_x')).toBeCloseTo(-0.2, 1)
    const roverPart = sim.sensor('pos_x', 'rover') as number
    expect(roverPart).toBeGreaterThan(-0.4)
    expect(roverPart).toBeLessThan(-0.21)
    // ...and gets there on its own.
    await runUntil(sim, sim.idle())
    expect(sim.sensor('pos_x', 'rover')).toBeCloseTo(-0.2, 1)
    const together = sim.elapsedMs
    sim.dispose()

    // Together took about as long as the rover alone, not as long as both one after the other.
    const alone = new Simulation(twoRobots(), null)
    await runUntil(alone, alone.command('move', { distanceCm: 30, speed: 50 }, 'rover'))
    expect(together).toBeLessThan(alone.elapsedMs + 100)
    alone.dispose()
  })

  it("runs a busy robot's commands one after the other", async () => {
    const sim = new Simulation(twoRobots(), null)
    const first = sim.startCommand('move', { distanceCm: 20, speed: 60 }, 'rover')
    const second = sim.startCommand('turn', { degrees: 90, speed: 60 }, 'rover')
    let secondStarted = false
    second.started.then(() => (secondStarted = true))
    await first.started
    await Promise.resolve()
    expect(secondStarted).toBe(false)
    expect(sim.busy).toBe(true)

    await runUntil(sim, sim.idle('rover'))
    expect(secondStarted).toBe(true)
    expect(sim.sensor('pos_x', 'rover')).toBeCloseTo(-0.3, 1)
    expect(sim.sensor('heading', 'rover') as number).toBeGreaterThan(87)
    expect(sim.busy).toBe(false)
    sim.dispose()
  })

  it('only waits on time for what the program awaits', async () => {
    const sim = new Simulation(twoRobots(), null)
    const { started } = sim.startCommand('move', { distanceCm: 20, speed: 50 }, 'rover')
    // Started at once: the program isn't blocked, though the rover is busy.
    expect(sim.waitingOnTime).toBe(false)
    expect(sim.busy).toBe(true)
    await started
    sim.command('wait', { ms: 100 })
    expect(sim.waitingOnTime).toBe(true)
    for (let i = 0; i < 7; i++) sim.step()
    expect(sim.waitingOnTime).toBe(false)
    sim.halt()
    sim.dispose()
  })

  it('records robots bumping into each other', async () => {
    const scene = twoRobots({
      robot: { type: 'diff-drive', start: { x: -0.3, z: 0, headingDeg: 0 } },
      robots: [{ id: 'rover', type: 'rover', start: { x: 0.3, z: 0, headingDeg: 180 } }],
    })
    const sim = new Simulation(scene, null)
    sim.startCommand('drive', { speed: 60, durationMs: 0 }, 'rover')
    await expect(runUntil(sim, sim.command('move', { distanceCm: 60, speed: 60 }))).rejects.toThrow(/in the way/)
    const summary = sim.summary('runtime_error')
    expect(summary.collisions.first.some((c) => c.name === 'robot rover')).toBe(true)
    expect(summary.robots).toEqual([expect.objectContaining({ id: 'rover' })])
    sim.dispose()
  })

  it('grades objectives for a named robot', async () => {
    const objectives: ObjectiveSet = {
      version: 1,
      objectives: [{ id: 'park', label: 'Park the rover', predicate: { kind: 'robotInZone', robotId: 'rover', zoneId: 'bay' } }],
    }
    const scene = twoRobots({ zones: [{ id: 'bay', center: { x: 0, z: 0.3 }, size: { x: 0.3, z: 0.3 }, color: '#0f0' }] })
    expect(validateObjectives(objectives, scene)).toEqual([])
    const sim = new Simulation(scene, objectives)
    // The main robot driving there doesn't count.
    await runUntil(sim, sim.command('move', { distanceCm: 50, speed: 80 }))
    for (let i = 0; i < 12; i++) sim.step()
    expect(sim.allObjectivesMet()).toBe(false)
    await runUntil(sim, sim.command('move', { distanceCm: 50, speed: 80 }, 'rover'))
    for (let i = 0; i < 12; i++) sim.step()
    expect(sim.allObjectivesMet()).toBe(true)
    sim.dispose()
  })

  it('mixes robot types', async () => {
    const scene = twoRobots({ robots: [{ id: 'arm', type: 'arm', start: { x: 0.5, z: 0.3, headingDeg: 180 } }] })
    const sim = new Simulation(scene, null)
    sim.startCommand('setBase', { degrees: 45, speed: 100 }, 'arm')
    await runUntil(sim, sim.command('move', { distanceCm: 20, speed: 50 }))
    await runUntil(sim, sim.idle())
    expect(sim.sensor('base_angle', 'arm')).toBe(45)
    expect(sim.frame().robots.get('arm')!.joints.base).toBe(45)
    sim.dispose()
  })

  it('names the robot in errors', async () => {
    const sim = new Simulation(twoRobots({ robots: [{ id: 'arm', type: 'arm', start: { x: 0.5, z: 0.3, headingDeg: 180 } }] }), null)
    await expect(sim.command('move', { distanceCm: 20 }, 'arm')).rejects.toThrow('The robot arm "arm" can\'t move.')
    await expect(sim.command('move', { distanceCm: 20 }, 'ghost')).rejects.toThrow('There\'s no robot called "ghost" in this scene.')
    expect(() => sim.sensor('holding')).toThrow('The two-wheel robot has no holding sensor.')
    sim.dispose()
  })
})

describe('scene validation with several robots', () => {
  it('checks robot names, types and positions', () => {
    const scene = twoRobots({
      robots: [
        { id: 'Rover', type: 'rover', start: { x: 0, z: 0, headingDeg: 0 } },
        { id: 'while', type: 'rover', start: { x: 0, z: 0, headingDeg: 0 } },
        { id: 'robot', type: 'rover', start: { x: 0, z: 0, headingDeg: 0 } },
        { id: 'far', type: 'hovercraft', start: { x: 9, z: 0, headingDeg: 0 } },
      ],
    })
    const messages = validateScene(scene).map((issue) => `${issue.path}: ${issue.message}`)
    expect(messages).toEqual([
      'robots: At most 4 robots in a scene.',
      'robots.0.id: Robot names use lowercase letters, digits and _, starting with a letter.',
      'robots.1.id: "while" can\'t be a robot name.',
      'robots.2.id: Duplicate robot name "robot".',
      'robots.3.type: Unknown robot type "hovercraft".',
      'robots.3.start: Robot starts outside the arena.',
    ])
  })

  it('checks objectives name a robot in the scene that can do them', () => {
    const scene = twoRobots()
    const issues = validateObjectives(
      {
        version: 1,
        objectives: [
          { id: 'a', label: 'A', predicate: { kind: 'robotAtPose', robotId: 'ghost', position: { x: 0, y: 0, z: 0 }, toleranceM: 0.1 } },
          { id: 'b', label: 'B', predicate: { kind: 'jointAtAngle', robotId: 'rover', joint: 'base', value: 0, toleranceDeg: 5 } },
        ],
      },
      scene,
    )
    expect(issues.map((issue) => issue.message)).toEqual(['Unknown robot "ghost".', 'The Four-wheel rover has no joints.'])
  })
})
