import { beforeAll, describe, expect, it } from 'vitest'
import { emptyScene, type SceneDefinition } from '../scene/types'
import { initPhysics } from './physics'
import { Simulation } from './simulation'

beforeAll(async () => {
  await initPhysics()
})

/** Steps the simulation until the promise settles, like the runner does while a program waits. */
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

function scene(overrides: Partial<SceneDefinition> = {}): SceneDefinition {
  return { ...emptyScene(), robot: { type: 'diff-drive', start: { x: 0, z: 0, headingDeg: 0 } }, ...overrides }
}

describe('Simulation', () => {
  it('moves forward the requested distance', async () => {
    const sim = new Simulation(scene(), null)
    await runUntil(sim, sim.command('move', { distanceCm: 50, speed: 60 }))
    for (let i = 0; i < 30; i++) sim.step() // settle
    expect(sim.sensor('pos_x')).toBeCloseTo(0.5, 1)
    expect(Math.abs(sim.sensor('pos_z') as number)).toBeLessThan(0.01)
    sim.dispose()
  })

  it('turns counter-clockwise for positive angles', async () => {
    const sim = new Simulation(scene(), null)
    await runUntil(sim, sim.command('turn', { degrees: 90, speed: 50 }))
    expect(sim.sensor('heading') as number).toBeGreaterThan(87)
    expect(sim.sensor('heading') as number).toBeLessThan(93)

    // Facing +90 (up the screen), moving forward goes towards -Z.
    await runUntil(sim, sim.command('move', { distanceCm: 30, speed: 50 }))
    expect(sim.sensor('pos_z') as number).toBeLessThan(-0.25)
    sim.dispose()
  })

  it('reports a blocked move when a wall is in the way', async () => {
    const sim = new Simulation(
      scene({ walls: [{ id: 'w1', x: 0.4, z: 0, length: 0.05, thickness: 1, height: 0.2, rotationDeg: 0 }] }),
      null,
    )
    expect(sim.sensor('distance_front') as number).toBeCloseTo(0.4 - 0.025 - 0.1, 1)
    await expect(runUntil(sim, sim.command('move', { distanceCm: 100, speed: 50 }))).rejects.toThrow(/in the way/)
    expect(sim.summary('runtime_error').collisions.count).toBeGreaterThan(0)
    sim.dispose()
  })

  it('detects lines under the sensors', () => {
    const sim = new Simulation(
      scene({ lines: [{ id: 'l1', points: [{ x: -1, z: -0.03 }, { x: 1, z: -0.03 }], width: 0.02, color: '#000' }] }),
      null,
    )
    // Facing +X, the left sensor sits at z = -0.03.
    expect(sim.sensor('line_left')).toBe(true)
    expect(sim.sensor('line_right')).toBe(false)
    sim.dispose()
  })

  it('refuses hidden sensors', () => {
    const sim = new Simulation(scene({ hiddenSensors: ['pos_x'] }), null)
    expect(() => sim.sensor('pos_x')).toThrow(/isn't available/)
    sim.dispose()
  })

  it('rejects unknown robot types', () => {
    expect(() => new Simulation(scene({ robot: { type: 'hovercraft', start: { x: 0, z: 0, headingDeg: 0 } } }), null)).toThrow(/Unknown robot type/)
  })

  it('reports the robot state in frames', () => {
    const sim = new Simulation(scene(), null)
    const { robot } = sim.frame()
    expect(robot.transform.position.x).toBeCloseTo(0, 3)
    expect(robot.joints).toEqual({})
    sim.dispose()
  })

  it('drives the rover with the same commands, more slowly', async () => {
    const roverScene = scene({ robot: { type: 'rover', start: { x: 0, z: 0, headingDeg: 0 } } })
    const sim = new Simulation(roverScene, null)
    await runUntil(sim, sim.command('move', { distanceCm: 30, speed: 50 }))
    expect(sim.sensor('pos_x')).toBeCloseTo(0.3, 1)
    await runUntil(sim, sim.command('turn', { degrees: 90, speed: 50 }))
    expect(sim.sensor('heading') as number).toBeGreaterThan(87)
    expect(sim.sensor('heading') as number).toBeLessThan(93)
    const roverMs = sim.elapsedMs
    sim.dispose()

    const twoWheel = new Simulation(scene(), null)
    await runUntil(twoWheel, twoWheel.command('move', { distanceCm: 30, speed: 50 }))
    await runUntil(twoWheel, twoWheel.command('turn', { degrees: 90, speed: 50 }))
    expect(twoWheel.elapsedMs).toBeLessThan(roverMs)
    twoWheel.dispose()
  })

  it('gives the rover a longer distance sensor', () => {
    const sim = new Simulation(scene({ robot: { type: 'rover', start: { x: -1, z: 0, headingDeg: 0 } }, arena: { width: 5, depth: 2, floorColor: '#fff' } }), null)
    // 3.35 m from the rover's front to the arena edge: capped at its 3 m range, not the two-wheel robot's 2 m.
    expect(sim.sensor('distance_front')).toBe(3)
    sim.dispose()
  })

  it('grades objectives during the run', async () => {
    const sim = new Simulation(
      scene({ zones: [{ id: 'goal', center: { x: 0.6, z: 0 }, size: { x: 0.3, z: 0.3 }, color: '#0f0' }] }),
      { version: 1, objectives: [{ id: 'reach', label: 'Reach the goal', predicate: { kind: 'robotInZone', zoneId: 'goal' } }] },
    )
    expect(sim.allObjectivesMet()).toBe(false)
    await runUntil(sim, sim.command('move', { distanceCm: 60, speed: 80 }))
    for (let i = 0; i < 12; i++) sim.step()
    expect(sim.allObjectivesMet()).toBe(true)
    expect(sim.grading()).toMatchObject({ score: 100, passed: true })
    sim.dispose()
  })
})
