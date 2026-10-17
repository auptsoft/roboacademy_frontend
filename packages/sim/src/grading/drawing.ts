import { PEN_COLORS } from '../robots/pen'
import type { Vec2 } from '../scene/types'
import type { Predicate, WorldSnapshot } from './types'

type InkMatches = Extract<Predicate, { kind: 'inkMatches' }>
type Segment = [Vec2, Vec2]

/** Shapes are checked at points this far apart along them, at most, in metres. */
const SHAPE_SAMPLE_SPACING = 0.005
/** Ink checked against the shape is thinned to about this many points, which is plenty to judge it. */
const INK_SAMPLES = 600
/** Turns tried when a shape can be drawn any way round, in degrees apart. */
const ANGLE_STEP_DEG = 3

export const DEFAULT_COVERAGE = 0.9

/**
 * Whether a run's ink matches a drawing objective. The scores are fractions: how much of the
 * shape is inked (`coverage`), and how much of the ink is on the shape (`precision`).
 */
export function matchDrawing(predicate: InkMatches, world: WorldSnapshot): boolean {
  const ink = inkFor(predicate, world)
  if (!ink.length || predicate.shape.length < 2) return false
  const need = predicate.coverage ?? DEFAULT_COVERAGE
  const strict = predicate.strict ?? true
  const tolerance = predicate.toleranceM
  const inkGrid = new SegmentGrid(ink, tolerance)
  const inkSamples = thin([...ink.map(([a]) => a), ink[ink.length - 1]![1]], INK_SAMPLES)
  const shape = shapeSegments(predicate.shape, predicate.closed ?? false)

  const passes = (placed: Segment[]) => {
    const samples = sampleSegments(placed, Math.min(SHAPE_SAMPLE_SPACING, tolerance / 2))
    const covered = samples.filter((point) => inkGrid.within(point, tolerance)).length / samples.length
    if (covered < need) return false
    if (!strict) return true
    const onShape = inkSamples.filter((point) => distanceToSegments(point, placed) <= tolerance).length / inkSamples.length
    return onShape >= need
  }

  if (!predicate.anywhere) return passes(shape)

  // Drawn anywhere, turned any way: put the shape's centre on the ink's, and try every turn.
  const shapeCentre = centroid(shape)
  const inkCentre = centroid(ink)
  for (let degrees = 0; degrees < 360; degrees += ANGLE_STEP_DEG) {
    const angle = (degrees * Math.PI) / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const place = (p: Vec2): Vec2 => {
      const x = p.x - shapeCentre.x
      const z = p.z - shapeCentre.z
      return { x: inkCentre.x + x * cos - z * sin, z: inkCentre.z + x * sin + z * cos }
    }
    if (passes(shape.map(([a, b]) => [place(a), place(b)]))) return true
  }
  return false
}

/**
 * Remembers each drawing check's answer until the ink changes: the ink is only re-checked when
 * something new was drawn, however often objectives are sampled.
 */
export class DrawingCache {
  private readonly answers = new WeakMap<InkMatches, { version: number; matched: boolean }>()

  matches(predicate: InkMatches, world: WorldSnapshot): boolean {
    const version = world.inkVersion ?? -1
    const cached = this.answers.get(predicate)
    if (cached && cached.version === version && version !== -1) return cached.matched
    const matched = matchDrawing(predicate, world)
    this.answers.set(predicate, { version, matched })
    return matched
  }
}

/** The ink the objective is about, as segments: a stroke of one point is a dot, a zero-length segment. */
function inkFor(predicate: InkMatches, world: WorldSnapshot): Segment[] {
  const hex = predicate.color ? PEN_COLORS.find((color) => color.name === predicate.color)?.hex : undefined
  if (predicate.color && !hex) return []
  const segments: Segment[] = []
  for (const [robotId, strokes] of world.ink ?? []) {
    if (predicate.robotId && robotId !== predicate.robotId) continue
    for (const stroke of strokes) {
      if (hex && stroke.color !== hex) continue
      const { points } = stroke
      if (points.length === 1) segments.push([points[0]!, points[0]!])
      for (let i = 0; i < points.length - 1; i++) segments.push([points[i]!, points[i + 1]!])
    }
  }
  return segments
}

function shapeSegments(points: Vec2[], closed: boolean): Segment[] {
  const segments: Segment[] = []
  for (let i = 0; i < points.length - 1; i++) segments.push([points[i]!, points[i + 1]!])
  if (closed && points.length > 2) segments.push([points[points.length - 1]!, points[0]!])
  return segments
}

/** Points along segments, evenly, at most `spacing` apart. */
function sampleSegments(segments: Segment[], spacing: number): Vec2[] {
  const points: Vec2[] = []
  for (const [a, b] of segments) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / spacing))
    for (let i = 0; i < steps; i++) points.push({ x: a.x + ((b.x - a.x) * i) / steps, z: a.z + ((b.z - a.z) * i) / steps })
  }
  const last = segments[segments.length - 1]
  if (last) points.push(last[1])
  return points
}

/** The centre of a set of segments, weighting each by its length (dots by a little). */
function centroid(segments: Segment[]): Vec2 {
  let x = 0
  let z = 0
  let total = 0
  for (const [a, b] of segments) {
    const weight = Math.max(Math.hypot(b.x - a.x, b.z - a.z), 1e-4)
    x += ((a.x + b.x) / 2) * weight
    z += ((a.z + b.z) / 2) * weight
    total += weight
  }
  return { x: x / total, z: z / total }
}

function thin(points: Vec2[], count: number): Vec2[] {
  if (points.length <= count) return points
  const step = points.length / count
  return Array.from({ length: count }, (_, i) => points[Math.floor(i * step)]!)
}

function distanceToSegment(p: Vec2, [a, b]: Segment): number {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const lengthSq = abx * abx + abz * abz
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / lengthSq))
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t))
}

function distanceToSegments(p: Vec2, segments: Segment[]): number {
  let best = Infinity
  for (const segment of segments) best = Math.min(best, distanceToSegment(p, segment))
  return best
}

/** Ink segments bucketed by floor cell, so "is there ink near this point?" only looks nearby. */
class SegmentGrid {
  private readonly cells = new Map<string, Segment[]>()
  private readonly size: number

  constructor(segments: Segment[], cellSize: number) {
    this.size = Math.max(cellSize, 0.001)
    for (const segment of segments) {
      const [a, b] = segment
      const [x0, x1] = [Math.floor(Math.min(a.x, b.x) / this.size), Math.floor(Math.max(a.x, b.x) / this.size)]
      const [z0, z1] = [Math.floor(Math.min(a.z, b.z) / this.size), Math.floor(Math.max(a.z, b.z) / this.size)]
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const key = `${x},${z}`
          const cell = this.cells.get(key)
          if (cell) cell.push(segment)
          else this.cells.set(key, [segment])
        }
      }
    }
  }

  /** Whether any segment passes within `distance` (at most the cell size) of a point. */
  within(point: Vec2, distance: number): boolean {
    const cx = Math.floor(point.x / this.size)
    const cz = Math.floor(point.z / this.size)
    for (let x = cx - 1; x <= cx + 1; x++) {
      for (let z = cz - 1; z <= cz + 1; z++) {
        for (const segment of this.cells.get(`${x},${z}`) ?? []) {
          if (distanceToSegment(point, segment) <= distance) return true
        }
      }
    }
    return false
  }
}
