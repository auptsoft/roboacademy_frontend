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

export interface ObjectiveSet {
  version: 1
  /** Pass threshold, 0-100. When unset, passing means satisfying every required objective. */
  passMark?: number
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
