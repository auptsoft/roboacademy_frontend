import { describe, expect, it } from 'vitest'
import type { Vec2 } from '../scene/types'
import { matchDrawing } from './drawing'
import { shapePoints } from './shapes'
import type { Predicate, WorldSnapshot } from './types'

type InkMatches = Extract<Predicate, { kind: 'inkMatches' }>

/** A drawn stroke through points, with ink every 5 mm as the simulator records it. */
function stroke(points: Vec2[], closed = false): Vec2[] {
  const corners = closed ? [...points, points[0]!] : points
  const out: Vec2[] = []
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i]!
    const b = corners[i + 1]!
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.005)
    for (let s = 0; s < steps; s++) out.push({ x: a.x + ((b.x - a.x) * s) / steps, z: a.z + ((b.z - a.z) * s) / steps })
  }
  out.push(corners[corners.length - 1]!)
  return out
}

function world(...strokes: { color?: string; points: Vec2[]; robot?: string }[]): WorldSnapshot {
  const ink = new Map<string, { color: string; points: Vec2[] }[]>()
  for (const { color = '#1d232a', points, robot = 'robot' } of strokes) {
    ink.set(robot, [...(ink.get(robot) ?? []), { color, points }])
  }
  return { robots: new Map(), props: new Map(), joints: new Map(), held: new Map(), ink }
}

const square = shapePoints('square', 0.2)
const squareGoal = (extra: Partial<InkMatches> = {}): InkMatches => ({ kind: 'inkMatches', ...square, toleranceM: 0.02, ...extra })

/** Moves and turns points, like a drawing made elsewhere on the floor. */
function placed(points: Vec2[], dx: number, dz: number, degrees: number): Vec2[] {
  const a = (degrees * Math.PI) / 180
  return points.map((p) => ({ x: dx + p.x * Math.cos(a) - p.z * Math.sin(a), z: dz + p.x * Math.sin(a) + p.z * Math.cos(a) }))
}

describe('drawing objectives', () => {
  it('accepts a traced shape', () => {
    expect(matchDrawing(squareGoal(), world({ points: stroke(square.shape, true) }))).toBe(true)
  })

  it('allows wobble within the tolerance', () => {
    const wobbly = stroke(square.shape, true).map((p, i) => ({ x: p.x + (i % 2 ? 0.012 : -0.012), z: p.z }))
    expect(matchDrawing(squareGoal(), world({ points: wobbly }))).toBe(true)
    expect(matchDrawing(squareGoal({ toleranceM: 0.008 }), world({ points: wobbly }))).toBe(false)
  })

  it('wants the traced shape in place', () => {
    const elsewhere = placed(stroke(square.shape, true), 0.5, 0.3, 0)
    expect(matchDrawing(squareGoal(), world({ points: elsewhere }))).toBe(false)
  })

  it('finds a shape drawn anywhere, turned any way', () => {
    const elsewhere = placed(stroke(square.shape, true), 0.5, 0.3, 37)
    expect(matchDrawing(squareGoal({ anywhere: true }), world({ points: elsewhere }))).toBe(true)
  })

  it('keeps size: a bigger square is not the shape', () => {
    const big = stroke(shapePoints('square', 0.3).shape, true)
    expect(matchDrawing(squareGoal({ anywhere: true }), world({ points: big }))).toBe(false)
  })

  it('tells shapes apart', () => {
    const triangle = stroke(shapePoints('triangle', 0.2).shape, true)
    expect(matchDrawing(squareGoal({ anywhere: true }), world({ points: triangle }))).toBe(false)
  })

  it('wants the whole shape', () => {
    const threeSides = stroke(square.shape)
    expect(matchDrawing(squareGoal(), world({ points: threeSides }))).toBe(false)
    expect(matchDrawing(squareGoal({ coverage: 0.7 }), world({ points: threeSides }))).toBe(true)
  })

  it('counts stray ink against a strict objective only', () => {
    const scribble = stroke([{ x: 0.4, z: 0.4 }, { x: 0.8, z: 0.4 }])
    const drawn = world({ points: stroke(square.shape, true) }, { points: scribble })
    expect(matchDrawing(squareGoal(), drawn)).toBe(false)
    expect(matchDrawing(squareGoal({ strict: false }), drawn)).toBe(true)
  })

  it('only looks at the colour and robot asked for', () => {
    const scribble = stroke([{ x: 0.4, z: 0.4 }, { x: 0.8, z: 0.4 }])
    const drawn = world({ color: '#e5484d', points: stroke(square.shape, true) }, { points: scribble, robot: 'rover' })
    expect(matchDrawing(squareGoal({ color: 'red' }), drawn)).toBe(true)
    expect(matchDrawing(squareGoal({ robotId: 'robot' }), drawn)).toBe(true)
    expect(matchDrawing(squareGoal({ color: 'blue' }), drawn)).toBe(false)
  })

  it('matches nothing without ink', () => {
    expect(matchDrawing(squareGoal(), world())).toBe(false)
  })
})
