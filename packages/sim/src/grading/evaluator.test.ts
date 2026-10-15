import { describe, expect, it } from 'vitest'
import { ObjectiveTracker, grade } from './evaluator'
import type { ObjectiveSet, WorldSnapshot } from './types'

function world(robot: { x: number; z: number }, props: Record<string, { x: number; z: number }> = {}): WorldSnapshot {
  return {
    robots: new Map([['robot', { x: robot.x, y: 0.05, z: robot.z }]]),
    props: new Map(Object.entries(props).map(([id, p]) => [id, { x: p.x, y: 0.05, z: p.z }])),
    joints: new Map(),
    held: new Map(),
  }
}

const zone = { id: 'goal', center: { x: 1, z: 0 }, size: { x: 0.4, z: 0.4 }, color: '#0f0' }

describe('ObjectiveTracker', () => {
  it('scores weighted objectives and keeps credit once earned', () => {
    const set: ObjectiveSet = {
      version: 1,
      objectives: [
        { id: 'reach', label: 'Reach the goal', weight: 3, predicate: { kind: 'robotInZone', zoneId: 'goal' } },
        { id: 'box', label: 'Push the box', required: false, predicate: { kind: 'propInZone', propId: 'box', zoneId: 'goal' } },
      ],
    }
    const tracker = new ObjectiveTracker(set, [zone])

    tracker.sample(world({ x: 0, z: 0 }), 100, 100)
    expect(tracker.result()).toMatchObject({ score: 0, passed: false })

    tracker.sample(world({ x: 1, z: 0.1 }), 200, 100)
    tracker.sample(world({ x: 0, z: 0 }), 300, 100) // drives back out

    const result = tracker.result()
    expect(result.score).toBe(75)
    expect(result.passed).toBe(true) // the only required objective was met at some point
    expect(result.objectives[0]).toMatchObject({ satisfied: false, everSatisfied: true, firstSatisfiedAtMs: 200 })
  })

  it('requires a continuous hold', () => {
    const set: ObjectiveSet = {
      version: 1,
      objectives: [{ id: 'park', label: 'Park', holdMs: 300, predicate: { kind: 'robotInZone', zoneId: 'goal' } }],
    }
    const tracker = new ObjectiveTracker(set, [zone])
    const inside = world({ x: 1, z: 0 })

    tracker.sample(inside, 100, 100)
    tracker.sample(inside, 200, 100)
    tracker.sample(world({ x: 0, z: 0 }), 300, 100) // hold broken
    tracker.sample(inside, 400, 100)
    tracker.sample(inside, 500, 100)
    expect(tracker.result().passed).toBe(false)

    tracker.sample(inside, 600, 100)
    expect(tracker.result().passed).toBe(true)
  })

  it('tracks nested sequences independently', () => {
    const at = (x: number) => ({ kind: 'robotAtPose' as const, position: { x, y: 0, z: 0 }, toleranceM: 0.05 })
    const set: ObjectiveSet = {
      version: 1,
      objectives: [
        {
          id: 'tour',
          label: 'Visit A then B, and C then D',
          predicate: { kind: 'all', of: [{ kind: 'sequence', of: [at(0), at(1)] }, { kind: 'sequence', of: [at(2), at(3)] }] },
        },
      ],
    }
    const tracker = new ObjectiveTracker(set)
    for (const [i, x] of [0, 1, 2, 3].entries()) tracker.sample(world({ x, z: 0 }), (i + 1) * 100, 100)
    expect(tracker.result().passed).toBe(true)

    // Out of order: D before C never completes the second sequence.
    const outOfOrder = new ObjectiveTracker(set)
    for (const [i, x] of [0, 1, 3, 2].entries()) outOfOrder.sample(world({ x, z: 0 }), (i + 1) * 100, 100)
    expect(outOfOrder.result().passed).toBe(false)
  })

  it('uses the pass mark when set', () => {
    const set: ObjectiveSet = {
      version: 1,
      passMark: 50,
      objectives: [
        { id: 'a', label: 'A', predicate: { kind: 'robotInZone', zoneId: 'goal' } },
        { id: 'b', label: 'B', predicate: { kind: 'robotAtPose', position: { x: 9, y: 0, z: 9 }, toleranceM: 0.1 } },
      ],
    }
    const tracker = new ObjectiveTracker(set, [zone])
    tracker.sample(world({ x: 1, z: 0 }), 100, 100)
    expect(tracker.result()).toMatchObject({ score: 50, passed: true })
  })
})

describe('grade', () => {
  it('scores zero for an empty set', () => {
    expect(grade({ version: 1, objectives: [] }, [])).toMatchObject({ score: 0, passed: true })
  })
})
