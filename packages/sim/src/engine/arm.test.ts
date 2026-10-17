import { beforeAll, describe, expect, it } from 'vitest'
import type { ObjectiveSet } from '../grading/types'
import { emptyScene, type SceneDefinition } from '../scene/types'
import { validateObjectives } from '../scene/validate'
import { initPhysics } from './physics'
import { Simulation } from './simulation'

beforeAll(async () => {
  await initPhysics()
})

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

function armScene(overrides: Partial<SceneDefinition> = {}): SceneDefinition {
  return { ...emptyScene(), robot: { type: 'arm', start: { x: 0, z: 0, headingDeg: 0 } }, ...overrides }
}

const block = { id: 'block', shape: 'box' as const, x: 0.2, z: 0, size: { x: 0.04, y: 0.04, z: 0.04 }, color: '#f00', mass: 0.1 }

describe('robot arm', () => {
  it('starts in its rest pose', () => {
    const sim = new Simulation(armScene(), null)
    expect(sim.sensor('shoulder_angle')).toBe(90)
    expect(sim.sensor('elbow_angle')).toBe(-90)
    // Upper arm up, forearm forward, hand down: fingertips 14 cm out and 16 cm up.
    expect(sim.sensor('gripper_x')).toBeCloseTo(0.14, 3)
    expect(sim.sensor('gripper_height')).toBeCloseTo(0.16, 3)
    expect(sim.sensor('holding')).toBe(false)
    sim.dispose()
  })

  it('turns its base counter-clockwise for positive angles', async () => {
    const sim = new Simulation(armScene(), null)
    await runUntil(sim, sim.command('setBase', { degrees: 90, speed: 100 }))
    expect(sim.sensor('base_angle')).toBe(90)
    // Facing +90 (up the screen) is towards -Z.
    expect(sim.sensor('gripper_z')).toBeCloseTo(-0.14, 2)
    expect(sim.frame().robot.joints.base).toBe(90)
    sim.dispose()
  })

  it('reaches a point with the hand pointing down', async () => {
    const sim = new Simulation(armScene(), null)
    await runUntil(sim, sim.command('reach', { distanceCm: 22, heightCm: 5, speed: 80 }))
    expect(sim.sensor('gripper_x')).toBeCloseTo(0.22, 3)
    expect(sim.sensor('gripper_height')).toBeCloseTo(0.05, 3)
    const sum = (sim.sensor('shoulder_angle') as number) + (sim.sensor('elbow_angle') as number) + (sim.sensor('wrist_angle') as number)
    expect(sum).toBeCloseTo(-90, 0)
    sim.dispose()
  })

  it("refuses points it can't reach", async () => {
    const sim = new Simulation(armScene(), null)
    await expect(runUntil(sim, sim.command('reach', { distanceCm: 45, heightCm: 5, speed: 50 }))).rejects.toThrow(/can't reach/)
    sim.dispose()
  })

  it('stops at the floor', async () => {
    const sim = new Simulation(armScene(), null)
    // Shoulder flat with the forearm hanging down would drive the forearm into the floor.
    await expect(runUntil(sim, sim.command('setShoulder', { degrees: 0, speed: 50 }))).rejects.toThrow(/in the way/)
    expect(sim.sensor('shoulder_angle') as number).toBeGreaterThan(20)
    sim.dispose()
  })

  it('stops at a wall instead of passing through it', async () => {
    const wall = { id: 'w', x: 0.2, z: 0, length: 0.5, thickness: 0.02, height: 0.3, rotationDeg: 90 }
    const sim = new Simulation(armScene({ walls: [wall] }), null)
    await expect(runUntil(sim, sim.command('reach', { distanceCm: 26, heightCm: 10, speed: 50 }))).rejects.toThrow(/in the way/)
    expect(sim.sensor('gripper_x') as number).toBeLessThan(0.19)
    sim.dispose()
  })

  it('pushes props aside', async () => {
    const sim = new Simulation(armScene({ props: [{ ...block, x: 0, z: -0.2 }] }), null)
    await runUntil(sim, sim.command('reach', { distanceCm: 20, heightCm: 1, speed: 80 }))
    // Sweep the hand round through the block, from facing +X to facing -Z.
    await runUntil(sim, sim.command('setBase', { degrees: 120, speed: 60 }))
    for (let i = 0; i < 30; i++) sim.step()
    const moved = sim.frame().props.get('block')!.position
    expect(Math.hypot(moved.x - 0, moved.z + 0.2)).toBeGreaterThan(0.02)
    sim.dispose()
  })

  it('picks a block up, carries it and puts it down', async () => {
    const objectives: ObjectiveSet = {
      version: 1,
      objectives: [
        { id: 'hold', label: 'Pick up the block', predicate: { kind: 'propHeldBy', propId: 'block' } },
        { id: 'turn', label: 'Turn to 90°', predicate: { kind: 'jointAtAngle', joint: 'base', value: 90, toleranceDeg: 2 } },
      ],
    }
    const scene = armScene({ props: [block] })
    expect(validateObjectives(objectives, scene)).toEqual([])
    const sim = new Simulation(scene, objectives)

    await runUntil(sim, sim.command('reach', { distanceCm: 20, heightCm: 8, speed: 60 }))
    await runUntil(sim, sim.command('reach', { distanceCm: 20, heightCm: 1, speed: 40 }))
    await runUntil(sim, sim.command('closeGripper', {}))
    expect(sim.sensor('holding')).toBe(true)

    await runUntil(sim, sim.command('reach', { distanceCm: 20, heightCm: 10, speed: 40 }))
    // The block's centre sits 1 cm above the fingertips, as it did when gripped.
    expect(sim.frame().props.get('block')!.position.y).toBeCloseTo(0.11, 2)

    await runUntil(sim, sim.command('setBase', { degrees: 90, speed: 60 }))
    await runUntil(sim, sim.command('reach', { distanceCm: 20, heightCm: 1.5, speed: 40 }))
    await runUntil(sim, sim.command('openGripper', {}))
    expect(sim.sensor('holding')).toBe(false)
    await runUntil(sim, sim.command('reach', { distanceCm: 20, heightCm: 10, speed: 40 }))
    for (let i = 0; i < 60; i++) sim.step()

    const placed = sim.frame().props.get('block')!.position
    expect(placed.x).toBeCloseTo(0, 1)
    expect(placed.z).toBeCloseTo(-0.2, 1)
    expect(placed.y).toBeCloseTo(0.02, 2)
    expect(sim.grading()).toMatchObject({ score: 100, passed: true })
    sim.dispose()
  })

  it('closes on nothing when there is nothing to hold', async () => {
    const sim = new Simulation(armScene(), null)
    await runUntil(sim, sim.command('closeGripper', {}))
    expect(sim.sensor('holding')).toBe(false)
    expect(sim.frame().robot.gripper).toBeCloseTo(0.004, 3)
    sim.dispose()
  })

  it('reads the distance past its fingertips', async () => {
    const sim = new Simulation(armScene(), null)
    // From the rest pose the hand points down, 16 cm above the floor.
    expect(sim.sensor('gripper_distance')).toBeCloseTo(0.16, 2)
    sim.dispose()
  })
})

describe('arm objectives', () => {
  it("rejects gripper and joint objectives for robots that can't use them", () => {
    const objectives: ObjectiveSet = {
      version: 1,
      objectives: [
        { id: 'hold', label: 'Hold', predicate: { kind: 'propHeldBy', propId: 'block' } },
        { id: 'joint', label: 'Joint', predicate: { kind: 'jointAtAngle', joint: 'base', value: 0, toleranceDeg: 5 } },
      ],
    }
    const twoWheel = { ...emptyScene(), props: [block] }
    expect(validateObjectives(objectives, twoWheel).map((issue) => issue.message)).toEqual([
      "The Two-wheel robot can't hold props.",
      'The Two-wheel robot has no joints.',
    ])
    expect(validateObjectives({ ...objectives, objectives: [{ ...objectives.objectives[1]!, predicate: { kind: 'jointAtAngle', joint: 'knee', value: 0, toleranceDeg: 5 } }] }, armScene()))
      .toEqual([{ path: expect.any(String), message: 'Unknown joint "knee".' }])
  })
})
