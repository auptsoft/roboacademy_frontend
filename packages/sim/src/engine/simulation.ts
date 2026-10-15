import { ObjectiveTracker, SAMPLE_INTERVAL_MS } from '../grading/evaluator'
import { DEFAULT_ROBOT_ID, type GradingResult, type ObjectiveSet, type ObjectiveStatus, type WorldSnapshot } from '../grading/types'
import { findCommand, findSensor, getCapability, normaliseCommandArgs, type RobotCapability } from '../robots'
import { DIFF_DRIVE_LINE_SENSOR_OFFSET } from '../robots/diff-drive'
import type { SceneDefinition } from '../scene/types'
import { CommandController, CommandError } from './commands'
import { DEG_TO_RAD, distanceToPolyline } from './geometry'
import { PHYSICS_STEP_SEC, PhysicsWorld, type BodyTransform, type RobotPose } from './physics'

const STEP_MS = PHYSICS_STEP_SEC * 1000
const CALL_LOG_LIMIT = 50
const COLLISION_LOG_LIMIT = 5
/** Maximum serialised size of a run summary, matching the backend's limit. */
export const SUMMARY_MAX_BYTES = 8 * 1024

/** `completed`: the program finished in a scene with no objectives to grade. */
export type RunOutcome = 'objectives_met' | 'objectives_failed' | 'completed' | 'runtime_error' | 'timeout' | 'stopped'

export interface RunSummary {
  outcome: RunOutcome
  error: { message: string; blockId: string | null } | null
  durationMs: number
  finalPose: RobotPose
  distanceTravelledM: number
  collisions: { count: number; first: { name: string; atMs: number }[] }
  objectives: ObjectiveStatus[]
  calls: { atMs: number; call: string }[]
}

export interface SimulationFrame {
  timeMs: number
  robot: BodyTransform
  props: Map<string, BodyTransform>
}

/**
 * One run of a scene: physics, the robot API, sensors and grading, advanced in fixed steps of
 * simulated time. Headless and deterministic for a given sequence of calls - rendering and the
 * program worker sit outside it.
 */
export class Simulation {
  readonly capability: RobotCapability
  private readonly physics: PhysicsWorld
  private readonly commands: CommandController
  private readonly tracker: ObjectiveTracker | null
  private readonly hiddenSensors: Set<string>
  private timeMs = 0
  private sinceSampleMs = 0
  private distanceTravelled = 0
  private lastPose: RobotPose
  private collisionCount = 0
  private readonly firstCollisions: { name: string; atMs: number }[] = []
  private readonly calls: { atMs: number; call: string }[] = []
  private readonly tickWaiters: (() => void)[] = []

  readonly scene: SceneDefinition
  readonly objectives: ObjectiveSet | null

  constructor(scene: SceneDefinition, objectives: ObjectiveSet | null) {
    this.scene = scene
    this.objectives = objectives
    const capability = getCapability(scene.robot.type)
    if (!capability) throw new Error(`Unknown robot type "${scene.robot.type}"`)
    this.capability = capability
    this.physics = new PhysicsWorld(scene)
    this.commands = new CommandController(this.physics)
    this.tracker = objectives ? new ObjectiveTracker(objectives, scene.zones) : null
    this.hiddenSensors = new Set(scene.hiddenSensors)
    this.lastPose = this.physics.robotPose()
  }

  get elapsedMs(): number {
    return this.timeMs
  }

  get timeLimitMs(): number {
    return this.scene.timeLimitSec * 1000
  }

  /** True while a command or a tick is waiting on simulated time. */
  get waitingOnTime(): boolean {
    return this.commands.busy || this.tickWaiters.length > 0
  }

  /** Runs a robot API command. Resolves when it finishes in simulated time. */
  command(name: string, rawArgs: Record<string, unknown>): Promise<void> {
    const spec = findCommand(this.capability, name)
    if (!spec) return Promise.reject(new CommandError(`Unknown command "${name}".`, 'invalid'))
    const args = normaliseCommandArgs(spec, rawArgs)
    if (!args) return Promise.reject(new CommandError(`Invalid value for "${name}".`, 'invalid'))
    this.log(`${name}(${spec.params.map((p) => args[p.name]).join(', ')})`)
    return this.commands.run(name, args, this.physics.robotPose())
  }

  /** Reads a sensor at the current simulated time. */
  sensor(name: string): number | boolean {
    const spec = findSensor(this.capability, name)
    if (!spec) throw new CommandError(`Unknown sensor "${name}".`, 'invalid')
    if (this.hiddenSensors.has(name)) throw new CommandError(`The ${spec.label} isn't available in this lesson.`, 'hidden_sensor')

    const pose = this.physics.robotPose()
    switch (name) {
      case 'distance_front':
        return round(this.physics.frontDistance(), 3)
      case 'line_left':
        return this.onLine(pose, 1)
      case 'line_right':
        return this.onLine(pose, -1)
      case 'pos_x':
        return round(pose.x, 3)
      case 'pos_z':
        return round(pose.z, 3)
      case 'heading':
        return round(pose.heading, 1)
      default:
        throw new CommandError(`Unknown sensor "${name}".`, 'invalid')
    }
  }

  /** Resolves after the next physics step. Loops in learner programs call this every iteration. */
  tick(): Promise<void> {
    return new Promise((resolve) => this.tickWaiters.push(resolve))
  }

  /** Stops the robot and drops any command in progress. */
  halt(): void {
    this.commands.cancel()
  }

  step(): void {
    this.commands.step(this.physics.robotPose(), STEP_MS)
    this.physics.step()
    this.timeMs += STEP_MS

    const pose = this.physics.robotPose()
    this.distanceTravelled += Math.hypot(pose.x - this.lastPose.x, pose.z - this.lastPose.z)
    this.lastPose = pose

    for (const collision of this.physics.drainCollisions()) {
      this.collisionCount += 1
      if (this.firstCollisions.length < COLLISION_LOG_LIMIT) {
        this.firstCollisions.push({ name: collision.name, atMs: Math.round(this.timeMs) })
      }
    }

    this.sinceSampleMs += STEP_MS
    if (this.tracker && this.sinceSampleMs >= SAMPLE_INTERVAL_MS - 0.001) {
      this.tracker.sample(this.snapshot(), this.timeMs, this.sinceSampleMs)
      this.sinceSampleMs = 0
    }

    const waiters = this.tickWaiters.splice(0)
    for (const resolve of waiters) resolve()
  }

  grading(): GradingResult | null {
    return this.tracker?.result() ?? null
  }

  /** True once every objective has been met at some point, so the run can end early. */
  allObjectivesMet(): boolean {
    const result = this.tracker?.result()
    return !!result && result.objectives.length > 0 && result.objectives.every((o) => o.everSatisfied)
  }

  frame(): SimulationFrame {
    return { timeMs: this.timeMs, robot: this.physics.robotTransform(), props: this.physics.propTransforms() }
  }

  summary(outcome: RunOutcome, error: RunSummary['error'] = null): RunSummary {
    const pose = this.physics.robotPose()
    const summary: RunSummary = {
      outcome,
      error,
      durationMs: Math.round(this.timeMs),
      finalPose: { x: round(pose.x, 3), z: round(pose.z, 3), heading: round(pose.heading, 1) },
      distanceTravelledM: round(this.distanceTravelled, 3),
      collisions: { count: this.collisionCount, first: [...this.firstCollisions] },
      objectives: this.tracker?.statuses() ?? [],
      calls: [...this.calls],
    }
    // Keep under the backend's size limit by dropping the oldest calls first.
    while (summary.calls.length > 0 && new TextEncoder().encode(JSON.stringify(summary)).length > SUMMARY_MAX_BYTES) {
      summary.calls.shift()
    }
    return summary
  }

  dispose(): void {
    this.commands.cancel()
    this.physics.dispose()
  }

  private snapshot(): WorldSnapshot {
    const robot = this.physics.robotTransform().position
    const props = new Map<string, { x: number; y: number; z: number }>()
    for (const [id, transform] of this.physics.propTransforms()) props.set(id, transform.position)
    return { robots: new Map([[DEFAULT_ROBOT_ID, robot]]), props, joints: new Map(), held: new Map() }
  }

  /** Whether a line sensor (side 1 = left, -1 = right) is over a line. */
  private onLine(pose: RobotPose, side: 1 | -1): boolean {
    const yaw = pose.heading * DEG_TO_RAD
    const forward = { x: Math.cos(yaw), z: -Math.sin(yaw) }
    // Left of forward, seen from above, with +Z down the screen.
    const left = { x: -Math.sin(yaw), z: -Math.cos(yaw) }
    const { forward: ahead, side: across } = DIFF_DRIVE_LINE_SENSOR_OFFSET
    const point = {
      x: pose.x + forward.x * ahead + left.x * across * side,
      z: pose.z + forward.z * ahead + left.z * across * side,
    }
    return this.scene.lines.some((line) => distanceToPolyline(point, line.points) <= line.width / 2)
  }

  private log(call: string): void {
    this.calls.push({ atMs: Math.round(this.timeMs), call })
    if (this.calls.length > CALL_LOG_LIMIT) this.calls.shift()
  }
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
