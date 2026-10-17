import { beforeAll, describe, expect, it } from 'vitest'
import { emptyScene, type SceneDefinition } from '../scene/types'
import { initPhysics } from './physics'
import { INK_MAX_POINTS, Simulation, TRAIL_MAX_POINTS } from './simulation'

beforeAll(async () => {
  await initPhysics()
})

async function runUntil<T>(sim: Simulation, promise: Promise<T>, maxSteps = 60 * 60): Promise<T> {
  let settled = false
  let error: unknown
  promise.then(
    () => (settled = true),
    (e) => ((settled = true), (error = e)),
  )
  for (let i = 0; i < maxSteps && !settled; i++) {
    sim.step()
    await Promise.resolve()
    await Promise.resolve()
  }
  if (!settled) throw new Error('did not settle')
  if (error) throw error
  return undefined as T
}

const scene = (overrides: Partial<SceneDefinition> = {}): SceneDefinition => ({
  ...emptyScene(),
  robot: { type: 'diff-drive', start: { x: 0, z: 0, headingDeg: 0 } },
  ...overrides,
})

describe('robot paths', () => {
  it('follows a wheeled robot from where it starts', async () => {
    const sim = new Simulation(scene(), null)
    expect(sim.frame().trails.get('robot')!.segments).toEqual([[{ x: 0, z: 0 }]])
    await runUntil(sim, sim.command('move', { distanceCm: 30, speed: 50 }))
    const [run, ...rest] = sim.frame().trails.get('robot')!.segments
    expect(rest).toEqual([])
    // A point at least every 5 mm (every other step at this speed), ending where the robot stopped.
    expect(run!.length).toBeGreaterThan(40)
    expect(run!.length).toBeLessThan(62)
    expect(run![run!.length - 1]!.x).toBeCloseTo(0.3, 2)
    sim.dispose()
  })

  it("doesn't add points while turning on the spot", async () => {
    const sim = new Simulation(scene(), null)
    const before = sim.frame().trails.get('robot')!.version
    await runUntil(sim, sim.command('turn', { degrees: 90, speed: 50 }))
    expect(sim.frame().trails.get('robot')!.version).toBe(before)
    sim.dispose()
  })

  it('draws with the arm only while its fingertips touch the floor', async () => {
    const sim = new Simulation(scene({ robot: { type: 'arm', start: { x: 0, z: 0, headingDeg: 0 } } }), null)
    expect(sim.frame().trails.get('robot')!.segments).toEqual([])
    await runUntil(sim, sim.command('reach', { distanceCm: 20, heightCm: 0.5, speed: 50 }))
    await runUntil(sim, sim.command('setBase', { degrees: 45, speed: 50 }))
    await runUntil(sim, sim.command('reach', { distanceCm: 20, heightCm: 5, speed: 50 }))
    await runUntil(sim, sim.command('setBase', { degrees: 90, speed: 50 }))
    await runUntil(sim, sim.command('reach', { distanceCm: 20, heightCm: 0.5, speed: 50 }))
    await runUntil(sim, sim.command('setBase', { degrees: 120, speed: 50 }))
    const segments = sim.frame().trails.get('robot')!.segments
    // Two arcs, with a gap where the fingertips were lifted.
    expect(segments).toHaveLength(2)
    const arcEnd = segments[0]![segments[0]!.length - 1]!
    expect(Math.hypot(arcEnd.x, arcEnd.z)).toBeCloseTo(0.2, 2)
    sim.dispose()
  })

  it('keeps the newest points of a long path', async () => {
    const sim = new Simulation(scene({ arena: { width: 5, depth: 5, floorColor: '#fff' } }), null)
    // A wide circle for a long time: about 27 m of path, far more points than are kept.
    await sim.command('setWheels', { left: 80, right: 100 })
    for (let i = 0; i < 75 * 60; i++) sim.step()
    const trail = sim.frame().trails.get('robot')!
    expect(trail.segments.reduce((total, run) => total + run.length, 0)).toBe(TRAIL_MAX_POINTS)
    sim.dispose()
  })
})

describe('the pen', () => {
  const ink = (sim: Simulation) => sim.frame().ink.get('robot')!.strokes

  it('starts up, so nothing is drawn', async () => {
    const sim = new Simulation(scene(), null)
    await runUntil(sim, sim.command('move', { distanceCm: 20, speed: 50 }))
    expect(ink(sim)).toEqual([])
    sim.dispose()
  })

  it('draws strokes while down, in its colour', async () => {
    const sim = new Simulation(scene(), null)
    await sim.command('penDown', {})
    // Putting the pen down marks the floor at once.
    expect(ink(sim)).toEqual([{ color: '#1d232a', points: [{ x: 0, z: 0 }] }])
    await runUntil(sim, sim.command('move', { distanceCm: 30, speed: 50 }))
    await sim.command('penUp', {})
    await runUntil(sim, sim.command('move', { distanceCm: 10, speed: 50 }))
    await sim.command('penColor', { color: 1 })
    await sim.command('penDown', {})
    await runUntil(sim, sim.command('move', { distanceCm: 10, speed: 50 }))

    const strokes = ink(sim)
    expect(strokes.map((stroke) => stroke.color)).toEqual(['#1d232a', '#e5484d'])
    const first = strokes[0]!.points
    expect(first[first.length - 1]!.x).toBeCloseTo(0.3, 2)
    expect(strokes[1]!.points[0]!.x).toBeCloseTo(0.4, 2)
    sim.dispose()
  })

  it('starts a new stroke when the colour changes mid-line', async () => {
    const sim = new Simulation(scene(), null)
    await sim.command('penDown', {})
    await runUntil(sim, sim.command('move', { distanceCm: 10, speed: 50 }))
    await sim.command('penColor', { color: 5 })
    await runUntil(sim, sim.command('move', { distanceCm: 10, speed: 50 }))
    expect(ink(sim).map((stroke) => stroke.color)).toEqual(['#1d232a', '#0090ff'])
    sim.dispose()
  })

  it("only inks with the arm's fingertips on the floor", async () => {
    const sim = new Simulation(scene({ robot: { type: 'arm', start: { x: 0, z: 0, headingDeg: 0 } } }), null)
    await sim.command('penDown', {})
    await runUntil(sim, sim.command('setBase', { degrees: 30, speed: 50 }))
    expect(ink(sim)).toEqual([])
    await runUntil(sim, sim.command('reach', { distanceCm: 20, heightCm: 0.5, speed: 50 }))
    await runUntil(sim, sim.command('setBase', { degrees: 60, speed: 50 }))
    expect(ink(sim)).toHaveLength(1)
    sim.dispose()
  })

  it('runs dry rather than erasing a drawing', async () => {
    const sim = new Simulation(scene({ arena: { width: 5, depth: 5, floorColor: '#fff' } }), null)
    await sim.command('penDown', {})
    await sim.command('setWheels', { left: 80, right: 100 })
    // About a point per step at this speed: 150 s is well past the ink limit.
    for (let i = 0; i < 150 * 60; i++) sim.step()
    const strokes = ink(sim)
    expect(strokes.reduce((total, stroke) => total + stroke.points.length, 0)).toBe(INK_MAX_POINTS)
    expect(strokes[0]!.points[0]).toEqual({ x: 0, z: 0 })
    sim.dispose()
  })
})
