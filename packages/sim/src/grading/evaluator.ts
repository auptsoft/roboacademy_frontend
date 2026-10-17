import type { Vec2, Vec3, ZoneDef } from '../scene/types'
import { DrawingCache } from './drawing'
import {
  DEFAULT_ROBOT_ID,
  type GradingResult,
  type Objective,
  type ObjectiveSet,
  type ObjectiveStatus,
  type Predicate,
  type WorldSnapshot,
} from './types'

/** Predicates are sampled at this interval of simulated time. */
export const SAMPLE_INTERVAL_MS = 100

interface TrackedObjective {
  objective: Objective
  status: ObjectiveStatus
  /** How long the predicate has been continuously true, in ms. */
  heldMs: number
  /** Progress of each `sequence` node, keyed by its path in the predicate tree. */
  sequenceProgress: Map<string, number>
}

function insideRect(point: Vec2, center: Vec2, size: Vec2): boolean {
  return Math.abs(point.x - center.x) <= size.x / 2 && Math.abs(point.z - center.z) <= size.z / 2
}

function insideBox(point: Vec3, center: Vec3, size: Vec3): boolean {
  return insideRect(point, center, size) && Math.abs(point.y - center.y) <= size.y / 2
}

/**
 * Tracks objective progress through a run. Ported from botnova's evaluator with one fix: each
 * `sequence` node keeps its own progress, so nested sequences no longer share a counter.
 */
export class ObjectiveTracker {
  private readonly tracked: TrackedObjective[]
  private readonly zones: Map<string, ZoneDef>
  private readonly set: ObjectiveSet
  private readonly drawings = new DrawingCache()

  constructor(set: ObjectiveSet, zones: ZoneDef[] = []) {
    this.set = set
    this.zones = new Map(zones.map((zone) => [zone.id, zone]))
    this.tracked = set.objectives.map((objective) => ({
      objective,
      status: {
        id: objective.id,
        label: objective.label,
        satisfied: false,
        everSatisfied: false,
        firstSatisfiedAtMs: null,
      },
      heldMs: 0,
      sequenceProgress: new Map(),
    }))
  }

  /** Advances every objective by one sample taken at `nowMs`, `deltaMs` after the previous one. */
  sample(world: WorldSnapshot, nowMs: number, deltaMs: number): void {
    for (const entry of this.tracked) {
      const holding = this.evaluate(entry.objective.predicate, world, entry, 'root')
      const requiredHold = entry.objective.holdMs ?? 0

      if (holding) {
        entry.heldMs += deltaMs
        entry.status.satisfied = entry.heldMs >= requiredHold
      } else {
        // A broken hold restarts the clock: "keep it in the zone for 2 s" means continuously.
        entry.heldMs = 0
        entry.status.satisfied = false
      }

      if (entry.status.satisfied && !entry.status.everSatisfied) {
        entry.status.everSatisfied = true
        entry.status.firstSatisfiedAtMs = nowMs
      }
    }
  }

  statuses(): ObjectiveStatus[] {
    return this.tracked.map((entry) => ({ ...entry.status }))
  }

  result(): GradingResult {
    return grade(this.set, this.statuses())
  }

  private evaluate(predicate: Predicate, world: WorldSnapshot, entry: TrackedObjective, path: string): boolean {
    switch (predicate.kind) {
      case 'propInZone': {
        const position = world.props.get(predicate.propId)
        if (!position) return false
        if (predicate.zone) return insideBox(position, predicate.zone.center, predicate.zone.size)
        const zone = predicate.zoneId ? this.zones.get(predicate.zoneId) : undefined
        return zone ? insideRect(position, zone.center, zone.size) : false
      }
      case 'robotInZone': {
        const position = world.robots.get(predicate.robotId ?? DEFAULT_ROBOT_ID)
        if (!position) return false
        if (predicate.zone) return insideRect(position, predicate.zone.center, predicate.zone.size)
        const zone = predicate.zoneId ? this.zones.get(predicate.zoneId) : undefined
        return zone ? insideRect(position, zone.center, zone.size) : false
      }
      case 'robotAtPose': {
        const position = world.robots.get(predicate.robotId ?? DEFAULT_ROBOT_ID)
        if (!position) return false
        // Measured on the floor plane: a robot's centre height says nothing about where it is.
        return Math.hypot(position.x - predicate.position.x, position.z - predicate.position.z) <= predicate.toleranceM
      }
      case 'propHeldBy':
        return world.held.get(predicate.robotId ?? DEFAULT_ROBOT_ID) === predicate.propId
      case 'jointAtAngle': {
        const angle = world.joints.get(predicate.robotId ?? DEFAULT_ROBOT_ID)?.[predicate.joint]
        return typeof angle === 'number' && Math.abs(angle - predicate.value) <= predicate.toleranceDeg
      }
      case 'inkMatches':
        return this.drawings.matches(predicate, world)
      case 'all':
        return predicate.of.every((child, index) => this.evaluate(child, world, entry, `${path}.${index}`))
      case 'any':
        // Evaluate every child rather than short-circuiting, so sequences nested under `any`
        // keep advancing even when an earlier sibling is already true.
        return predicate.of
          .map((child, index) => this.evaluate(child, world, entry, `${path}.${index}`))
          .some(Boolean)
      case 'sequence': {
        let progress = entry.sequenceProgress.get(path) ?? 0
        // Advance at most one step per sample, so two steps true in the same sample still count
        // as ordered progress rather than collapsing into one.
        if (progress < predicate.of.length) {
          const next = predicate.of[progress]
          if (next && this.evaluate(next, world, entry, `${path}.${progress}`)) {
            progress += 1
            entry.sequenceProgress.set(path, progress)
          }
        }
        return progress >= predicate.of.length
      }
      default:
        return false
    }
  }
}

/**
 * Scores a run from objective statuses. Uses `everSatisfied`, so a learner who completed a step
 * and then knocked something over still gets credit for the step.
 */
export function grade(set: ObjectiveSet, statuses: ObjectiveStatus[]): GradingResult {
  const byId = new Map(statuses.map((status) => [status.id, status]))
  let totalWeight = 0
  let achievedWeight = 0
  let allRequiredMet = true

  const objectives = set.objectives.map((objective) => {
    const status = byId.get(objective.id) ?? {
      id: objective.id,
      label: objective.label,
      satisfied: false,
      everSatisfied: false,
      firstSatisfiedAtMs: null,
    }
    const weight = objective.weight ?? 1
    totalWeight += weight
    if (status.everSatisfied) achievedWeight += weight
    else if (objective.required ?? true) allRequiredMet = false
    return status
  })

  const score = totalWeight === 0 ? 0 : Math.round((achievedWeight / totalWeight) * 1000) / 10
  const passed = set.passMark === undefined ? allRequiredMet : score >= set.passMark
  return { score, passed, objectives }
}
