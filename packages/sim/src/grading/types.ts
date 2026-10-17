import type { Vec2, Vec3 } from '../scene/types'

/**
 * Declarative grading, v1 - the schema from the botnova embed contract, kept so authored
 * objectives carry over, plus `robotInZone`. `robotId` is optional everywhere: v1 scenes have a
 * single robot, and the field is kept for multi-robot scenes later.
 */
export type Predicate =
  /** The prop's centre is inside a zone: a scene zone by id, or an inline 3D box. */
  | { kind: 'propInZone'; propId: string; zoneId?: string; zone?: { center: Vec3; size: Vec3 } }
  /** The robot's centre is inside a zone on the floor: a scene zone by id, or an inline rectangle. */
  | { kind: 'robotInZone'; robotId?: string; zoneId?: string; zone?: { center: Vec2; size: Vec2 } }
  /** The robot's centre is within tolerance of a floor position, in metres. */
  | { kind: 'robotAtPose'; robotId?: string; position: Vec3; toleranceM: number }
  /** Reserved for the gripper robot type. Never satisfied by robots without a gripper. */
  | { kind: 'propHeldBy'; propId: string; robotId?: string }
  /** Reserved for the robot arm type. Never satisfied by robots without joints. */
  | { kind: 'jointAtAngle'; robotId?: string; joint: string; value: number; toleranceDeg: number }
  /**
   * Ink matches a shape: a list of floor points, joined in order (and back to the start when
   * `closed`). Traced in place, or - with `anywhere` - drawn the same size anywhere, turned any way.
   * At least `coverage` (0-1, default 0.9) of the shape must be inked within `toleranceM`; when
   * `strict` (the default) the same share of the ink must lie on the shape too. Only ink from
   * `robotId` counts when given (otherwise every robot's), and only in `color` (a pen colour name).
   */
  | {
      kind: 'inkMatches'
      shape: Vec2[]
      closed?: boolean
      anywhere?: boolean
      toleranceM: number
      coverage?: number
      strict?: boolean
      robotId?: string
      color?: string
    }
  | { kind: 'all'; of: Predicate[] }
  | { kind: 'any'; of: Predicate[] }
  /** Children must each have become true, in order, at some point during the run. */
  | { kind: 'sequence'; of: Predicate[] }

export interface Objective {
  id: string
  label: string
  /** Relative contribution to the score. Defaults to 1. */
  weight?: number
  /** Must be satisfied to pass, regardless of score. Defaults to true. */
  required?: boolean
  /** The predicate must stay true this long (simulated time) before the objective counts. */
  holdMs?: number
  predicate: Predicate
}

/**
 * The target for a third challenge star (Gamification design §7): read by the server, which awards
 * stars, and ignored by the evaluator. A run that meets every objective gets two stars, and three
 * when it is also within par. Text programs are judged on time only.
 */
export interface ObjectivePar {
  /** Most simulated time, in milliseconds. */
  simTimeMs?: number
  /** Most blocks in a blocks program (shadow blocks don't count). */
  blocks?: number
}

export interface ObjectiveSet {
  version: 1
  /** Pass threshold, 0-100. When unset, passing means satisfying every required objective. */
  passMark?: number
  /** Optional target for three stars. Without it, meeting every objective is three stars. */
  par?: ObjectivePar
  objectives: Objective[]
}

/** World state the evaluator reads, sampled from the running simulation. */
export interface WorldSnapshot {
  robots: Map<string, Vec3>
  props: Map<string, Vec3>
  /** robotId → joint name → degrees. */
  joints: Map<string, Record<string, number>>
  /** robotId → id of the prop it is holding. */
  held: Map<string, string>
  /** robotId → what its pen has drawn, as strokes with a hex colour. Live arrays: read, don't keep. */
  ink?: Map<string, { color: string; points: Vec2[] }[]>
  /** Changes whenever any ink does, so drawing checks can skip work when nothing new was drawn. */
  inkVersion?: number
}

export interface ObjectiveStatus {
  id: string
  label: string
  /** True right now (hold time included). */
  satisfied: boolean
  /** True once satisfied at any point in the run. This is what scores. */
  everSatisfied: boolean
  /** Simulated time when it was first satisfied, in ms from the start of the run. */
  firstSatisfiedAtMs: number | null
}

export interface GradingResult {
  /** Weighted percentage achieved, 0-100, to one decimal place. */
  score: number
  passed: boolean
  objectives: ObjectiveStatus[]
}

/** The robot id used when a predicate leaves `robotId` out. */
export const DEFAULT_ROBOT_ID = 'robot'
