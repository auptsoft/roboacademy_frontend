import { ObjectiveTracker, SAMPLE_INTERVAL_MS } from '../grading/evaluator'
import { DEFAULT_ROBOT_ID, type GradingResult, type ObjectiveSet, type ObjectiveStatus, type WorldSnapshot } from '../grading/types'
import { findCommand, findSensor, getCapability, normaliseCommandArgs, type RobotCapability } from '../robots'
import { PEN_COLORS, PEN_COMMAND_NAMES } from '../robots/pen'
import { sceneRobots, type SceneDefinition, type Vec2 } from '../scene/types'
import { CommandController, CommandError } from './commands'
import { PHYSICS_STEP_SEC, PhysicsWorld, type BodyTransform, type RobotPose, type RobotSetup } from './physics'
import { getRobotDriver, type RobotInstance, type RobotState } from './robots'

const STEP_MS = PHYSICS_STEP_SEC * 1000
const CALL_LOG_LIMIT = 50
const COLLISION_LOG_LIMIT = 5
/** A robot's path gets a new point once it has moved this far, in metres. */
const TRAIL_SPACING = 0.005
/** Points kept per robot's path; past this, the oldest go first. */
export const TRAIL_MAX_POINTS = 4000
/** Ink gets a point once the pen has moved this far, in metres: finer than the path, for drawings. */
const INK_SPACING = 0.003
/** Points of ink per robot. Past this its pen runs dry: drawings are never erased to make room. */
export const INK_MAX_POINTS = 8000
/** Maximum serialised size of a run summary, matching the backend's limit. */
export const SUMMARY_MAX_BYTES = 8 * 1024

/** `completed`: the program finished in a scene with no objectives to grade. */
export type RunOutcome = 'objectives_met' | 'objectives_failed' | 'completed' | 'runtime_error' | 'timeout' | 'stopped'

export interface RunSummary {
  outcome: RunOutcome
  error: { message: string; blockId: string | null } | null
  durationMs: number
  /** The main robot's. */
  finalPose: RobotPose
  distanceTravelledM: number
  /** `robot` names the robot that collided, when it isn't the main one. */
  collisions: { count: number; first: { name: string; atMs: number; robot?: string }[] }
  objectives: ObjectiveStatus[]
  calls: { atMs: number; call: string }[]
  /** The scene's other robots, when it has any. */
  robots?: { id: string; finalPose: RobotPose; distanceTravelledM: number }[]
}

/**
 * A robot's path on the floor, as runs of points: a new run starts wherever it lifted its pen (an
 * arm raising its fingertips). `version` changes whenever the points do; the arrays are live, not
 * copies, so a viewer should read them straight away.
 */
export interface Trail {
  segments: Vec2[][]
  version: number
}

/**
 * What a robot drew with its pen, as strokes of one colour each. Like `Trail`, live arrays with a
 * version that changes whenever they do.
 */
export interface Ink {
  strokes: { color: string; points: Vec2[] }[]
  version: number
}

export interface SimulationFrame {
  timeMs: number
  /** The main robot's state. */
  robot: RobotState
  /** Every robot's state, by id. */
  robots: Map<string, RobotState>
  /** Every robot's path so far, by id. */
  trails: Map<string, Trail>
  /** What every robot has drawn with its pen, by id. */
  ink: Map<string, Ink>
  props: Map<string, BodyTransform>
}

/** A robot as programs see it. */
export interface SimulationRobot {
  id: string
  capability: RobotCapability
}

/** A command waiting for its robot to finish the one before. */
interface QueuedCommand {
  name: string
  args: Record<string, number>
  /** Called once it starts, or with the error if it failed the moment it started. */
  onStart: (error?: unknown) => void
  onSettled: () => void
  resolve: () => void
  reject: (error: unknown) => void
}

interface RobotSlot {
  id: string
  capability: RobotCapability
  instance: RobotInstance
  commands: CommandController
  queue: QueuedCommand[]
  lastPose: RobotPose
  distanceTravelled: number
  trail: Trail
  trailPoints: number
  /** The pen was off the floor since the last point, so the next one starts a new run. */
  penLifted: boolean
  pen: { down: boolean; color: string }
  ink: Ink
  inkPoints: number
  /** The ink's current stroke ended (pen lifted or recoloured), so the next point starts one. */
  strokeEnded: boolean
}

/**
 * A command started without waiting: `started` settles once it begins (rejecting if it failed
 * right away), `finished` once it ends.
 */
export interface StartedCommand {
  started: Promise<void>
  finished: Promise<void>
}

/**
 * One run of a scene: physics, the robots' APIs, sensors and grading, advanced in fixed steps of
 * simulated time. Headless and deterministic for a given sequence of calls - rendering and the
 * program worker sit outside it.
 *
 * Each robot runs one command at a time; a command given to a robot that's still busy waits its
 * turn. Commands can be awaited to the end (`command`) or only until they begin
 * (`startCommand`), so one program can keep several robots moving at once.
 */
export class Simulation {
  /** The main robot's capability. */
  readonly capability: RobotCapability
  /** Every robot, the main one first. */
  readonly robots: SimulationRobot[]
  private readonly physics: PhysicsWorld
  private readonly slots = new Map<string, RobotSlot>()
  private readonly main: RobotSlot
  private readonly tracker: ObjectiveTracker | null
  private readonly hiddenSensors: Set<string>
  private timeMs = 0
  private sinceSampleMs = 0
  private collisionCount = 0
  private readonly firstCollisions: RunSummary['collisions']['first'] = []
  private readonly calls: { atMs: number; call: string }[] = []
  private readonly tickWaiters: (() => void)[] = []
  private idleWaiters: { robot: string | null; resolve: () => void }[] = []
  /** Calls the program is blocked on that end with simulated time, besides ticks. */
  private awaiting = 0

  readonly scene: SceneDefinition
  readonly objectives: ObjectiveSet | null

  constructor(scene: SceneDefinition, objectives: ObjectiveSet | null) {
    this.scene = scene
    this.objectives = objectives
    const setups: RobotSetup[] = sceneRobots(scene).map(({ id, ...placement }) => {
      const capability = getCapability(placement.type)
      const driver = getRobotDriver(placement.type)
      if (!capability || !driver) throw new Error(`Unknown robot type "${placement.type}"`)
      return { id, placement, capability, driver }
    })
    this.physics = new PhysicsWorld(scene, setups)
    for (const { id, capability } of setups) {
      const instance = this.physics.robots.get(id)!
      const slot: RobotSlot = {
        id,
        capability,
        instance,
        // The pen is the same on every robot, so its commands are handled here, in turn with the
        // robot's own.
        commands: new CommandController({
          command: (name, args) => (PEN_COMMAND_NAMES.has(name) ? this.usePen(slot, name, args) : instance.command(name, args)),
          halt: () => instance.halt(),
        }),
        queue: [],
        lastPose: instance.pose(),
        distanceTravelled: 0,
        trail: { segments: [], version: 0 },
        trailPoints: 0,
        penLifted: true,
        pen: { down: false, color: PEN_COLORS[0].hex },
        ink: { strokes: [], version: 0 },
        inkPoints: 0,
        strokeEnded: true,
      }
      this.slots.set(id, slot)
    }
    for (const slot of this.slots.values()) this.recordTrail(slot)
    this.main = this.slots.get(DEFAULT_ROBOT_ID)!
    this.capability = this.main.capability
    this.robots = setups.map(({ id, capability }) => ({ id, capability }))
    this.tracker = objectives ? new ObjectiveTracker(objectives, scene.zones) : null
    this.hiddenSensors = new Set(scene.hiddenSensors)
  }

  get elapsedMs(): number {
    return this.timeMs
  }

  get timeLimitMs(): number {
    return this.scene.timeLimitSec * 1000
  }

  /** True while the program is blocked on something that only simulated time can end. */
  get waitingOnTime(): boolean {
    return this.awaiting > 0 || this.tickWaiters.length > 0
  }

  /** True while any robot has a command running or waiting its turn. */
  get busy(): boolean {
    for (const slot of this.slots.values()) if (slot.commands.busy || slot.queue.length) return true
    return false
  }

  /** Runs a robot API command. Resolves when it finishes in simulated time. */
  command(name: string, rawArgs: Record<string, unknown>, robotId: string = DEFAULT_ROBOT_ID): Promise<void> {
    return this.enqueue(name, rawArgs, robotId, 'finish').finished
  }

  /**
   * Starts a command without waiting for it to finish. If the robot is busy, it starts once the
   * robot's earlier commands are done; `started` resolves then.
   */
  startCommand(name: string, rawArgs: Record<string, unknown>, robotId: string = DEFAULT_ROBOT_ID): StartedCommand {
    return this.enqueue(name, rawArgs, robotId, 'start')
  }

  /** Resolves once a robot - or, with no id, every robot - has nothing running or queued. */
  idle(robotId: string | null = null): Promise<void> {
    if (robotId !== null && !this.slots.has(robotId)) return Promise.reject(unknownRobot(robotId))
    if (this.isIdle(robotId)) return Promise.resolve()
    this.awaiting += 1
    return new Promise((resolve) => this.idleWaiters.push({ robot: robotId, resolve }))
  }

  /** Reads a robot's sensor at the current simulated time. */
  sensor(name: string, robotId: string = DEFAULT_ROBOT_ID): number | boolean {
    const slot = this.slots.get(robotId)
    if (!slot) throw unknownRobot(robotId)
    const spec = findSensor(slot.capability, name)
    if (!spec) throw new CommandError(`The ${describe(slot)} has no ${name.replace(/_/g, ' ')} sensor.`, 'invalid')
    if (this.hiddenSensors.has(name)) throw new CommandError(`The ${spec.label} isn't available in this lesson.`, 'hidden_sensor')
    return slot.instance.sensor(name)
  }

  /** Resolves after the next physics step. Loops in learner programs call this every iteration. */
  tick(): Promise<void> {
    return new Promise((resolve) => this.tickWaiters.push(resolve))
  }

  /** Stops every robot and drops every command in progress or queued. Their promises never settle. */
  halt(): void {
    for (const slot of this.slots.values()) {
      slot.queue = []
      slot.commands.cancel()
    }
    this.idleWaiters = []
    this.awaiting = 0
  }

  step(): void {
    for (const slot of this.slots.values()) {
      slot.commands.step(STEP_MS)
      this.startQueued(slot)
    }
    this.physics.step()
    this.timeMs += STEP_MS

    for (const slot of this.slots.values()) {
      const pose = slot.instance.pose()
      slot.distanceTravelled += Math.hypot(pose.x - slot.lastPose.x, pose.z - slot.lastPose.z)
      slot.lastPose = pose
      this.recordTrail(slot)
      this.recordInk(slot)
    }

    for (const collision of this.physics.drainCollisions()) {
      this.collisionCount += 1
      if (this.firstCollisions.length < COLLISION_LOG_LIMIT) {
        this.firstCollisions.push({
          name: collision.name,
          atMs: Math.round(this.timeMs),
          ...(collision.robot === DEFAULT_ROBOT_ID ? {} : { robot: collision.robot }),
        })
      }
    }

    this.sinceSampleMs += STEP_MS
    if (this.tracker && this.sinceSampleMs >= SAMPLE_INTERVAL_MS - 0.001) {
      this.tracker.sample(this.snapshot(), this.timeMs, this.sinceSampleMs)
      this.sinceSampleMs = 0
    }

    this.resolveIdleWaiters()
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
    const robots = new Map<string, RobotState>()
    const trails = new Map<string, Trail>()
    const ink = new Map<string, Ink>()
    for (const [id, slot] of this.slots) {
      robots.set(id, slot.instance.state())
      trails.set(id, slot.trail)
      ink.set(id, slot.ink)
    }
    return { timeMs: this.timeMs, robot: robots.get(DEFAULT_ROBOT_ID)!, robots, trails, ink, props: this.physics.propTransforms() }
  }

  summary(outcome: RunOutcome, error: RunSummary['error'] = null): RunSummary {
    const finalPose = (slot: RobotSlot): RobotPose => {
      const pose = slot.instance.pose()
      return { x: round(pose.x, 3), z: round(pose.z, 3), heading: round(pose.heading, 1) }
    }
    const others = [...this.slots.values()].filter((slot) => slot !== this.main)
    const summary: RunSummary = {
      outcome,
      error,
      durationMs: Math.round(this.timeMs),
      finalPose: finalPose(this.main),
      distanceTravelledM: round(this.main.distanceTravelled, 3),
      collisions: { count: this.collisionCount, first: [...this.firstCollisions] },
      objectives: this.tracker?.statuses() ?? [],
      calls: [...this.calls],
      ...(others.length
        ? { robots: others.map((slot) => ({ id: slot.id, finalPose: finalPose(slot), distanceTravelledM: round(slot.distanceTravelled, 3) })) }
        : {}),
    }
    // Keep under the backend's size limit by dropping the oldest calls first.
    while (summary.calls.length > 0 && new TextEncoder().encode(JSON.stringify(summary)).length > SUMMARY_MAX_BYTES) {
      summary.calls.shift()
    }
    return summary
  }

  dispose(): void {
    this.halt()
    this.physics.dispose()
  }

  /**
   * Checks a command and gives it to its robot: now if the robot is free, otherwise after the
   * commands before it. `until` says which of its moments the program is blocked on.
   */
  private enqueue(name: string, rawArgs: Record<string, unknown>, robotId: string, until: 'start' | 'finish'): StartedCommand {
    const slot = this.slots.get(robotId)
    const fail = (error: CommandError): StartedCommand => {
      const rejected = Promise.reject(error)
      // Whoever awaits only one of the two shouldn't see the other as an unhandled rejection.
      rejected.catch(() => undefined)
      return { started: rejected, finished: rejected }
    }
    if (!slot) return fail(unknownRobot(robotId))
    const spec = findCommand(slot.capability, name)
    if (!spec) return fail(new CommandError(`The ${describe(slot)} can't ${name.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`)}.`, 'invalid'))
    const args = normaliseCommandArgs(spec, rawArgs)
    if (!args) return fail(new CommandError(`Invalid value for "${name}".`, 'invalid'))
    const prefix = robotId === DEFAULT_ROBOT_ID ? '' : `${robotId}.`
    this.log(`${prefix}${name}(${spec.params.map((p) => args[p.name]).join(', ')})`)

    let resolveStart!: () => void
    let rejectStart!: (error: unknown) => void
    const started = new Promise<void>((resolve, reject) => {
      resolveStart = resolve
      rejectStart = reject
    })
    // Waiting to the finish, nobody awaits `started`; its rejection isn't a problem.
    started.catch(() => undefined)
    let entry!: QueuedCommand
    const finished = new Promise<void>((resolve, reject) => {
      this.awaiting += 1
      let waiting = true
      const stopWaiting = () => {
        if (waiting) this.awaiting -= 1
        waiting = false
      }
      entry = {
        name,
        args,
        onStart: (error) => {
          if (until === 'start') stopWaiting()
          if (error) rejectStart(error)
          else resolveStart()
        },
        onSettled: stopWaiting,
        resolve,
        reject,
      }
    })
    if (slot.commands.busy || slot.queue.length) slot.queue.push(entry)
    else this.begin(slot, entry)
    return { started, finished }
  }

  /**
   * Hands a command to its robot. One that fails the moment it starts (out of reach, say) fails
   * `started` too, so a program that only waited for the start still gets the error at that call.
   */
  private begin(slot: RobotSlot, entry: QueuedCommand): void {
    let failure: unknown = null
    const done = slot.commands.run(entry.name, entry.args, (error) => {
      failure = error ?? null
      entry.onSettled()
    })
    entry.onStart(failure ?? undefined)
    done.then(entry.resolve, entry.reject)
  }

  /** Starts a robot's queued commands once it's free; instant ones run through in the same step. */
  private startQueued(slot: RobotSlot): void {
    while (!slot.commands.busy && slot.queue.length) this.begin(slot, slot.queue.shift()!)
  }

  /** Pen commands take no time. Putting the pen down marks the floor straight away, so a dot shows. */
  private usePen(slot: RobotSlot, name: string, args: Record<string, number>): null {
    if (name === 'penColor') {
      const color = PEN_COLORS[Math.round(args.color!)]?.hex ?? PEN_COLORS[0].hex
      if (color !== slot.pen.color) slot.strokeEnded = true
      slot.pen.color = color
    } else {
      slot.pen.down = name === 'penDown'
      if (!slot.pen.down) slot.strokeEnded = true
    }
    this.recordInk(slot)
    return null
  }

  /** While the pen is down and touching the floor, adds its point to the robot's ink. */
  private recordInk(slot: RobotSlot): void {
    const point = slot.pen.down ? slot.instance.penPoint() : null
    if (!point) {
      slot.strokeEnded = true
      return
    }
    if (slot.inkPoints >= INK_MAX_POINTS) return
    const { strokes } = slot.ink
    const stroke = strokes[strokes.length - 1]
    if (!stroke || slot.strokeEnded) {
      strokes.push({ color: slot.pen.color, points: [point] })
      slot.strokeEnded = false
    } else {
      const last = stroke.points[stroke.points.length - 1]!
      if (Math.hypot(point.x - last.x, point.z - last.z) < INK_SPACING) return
      stroke.points.push(point)
    }
    slot.inkPoints += 1
    slot.ink.version += 1
  }

  /** Adds the robot's pen point to its path once it has moved far enough from the last one. */
  private recordTrail(slot: RobotSlot): void {
    const point = slot.instance.penPoint()
    if (!point) {
      slot.penLifted = true
      return
    }
    const { segments } = slot.trail
    const run = segments[segments.length - 1]
    if (!run || slot.penLifted) {
      segments.push([point])
      slot.penLifted = false
    } else {
      const last = run[run.length - 1]!
      if (Math.hypot(point.x - last.x, point.z - last.z) < TRAIL_SPACING) return
      run.push(point)
    }
    slot.trailPoints += 1
    while (slot.trailPoints > TRAIL_MAX_POINTS) {
      segments[0]!.shift()
      slot.trailPoints -= 1
      if (!segments[0]!.length) segments.shift()
    }
    slot.trail.version += 1
  }

  private isIdle(robotId: string | null): boolean {
    const slots = robotId === null ? [...this.slots.values()] : [this.slots.get(robotId)!]
    return slots.every((slot) => !slot.commands.busy && slot.queue.length === 0)
  }

  private resolveIdleWaiters(): void {
    const ready = this.idleWaiters.filter((waiter) => this.isIdle(waiter.robot))
    if (!ready.length) return
    this.idleWaiters = this.idleWaiters.filter((waiter) => !ready.includes(waiter))
    this.awaiting -= ready.length
    for (const waiter of ready) waiter.resolve()
  }

  private snapshot(): WorldSnapshot {
    const robots = new Map<string, { x: number; y: number; z: number }>()
    const joints = new Map<string, Record<string, number>>()
    const held = new Map<string, string>()
    const ink = new Map<string, Ink['strokes']>()
    let inkVersion = 0
    for (const [id, slot] of this.slots) {
      ink.set(id, slot.ink.strokes)
      inkVersion += slot.ink.version
      const state = slot.instance.state()
      robots.set(id, state.transform.position)
      joints.set(id, state.joints)
      const prop = slot.instance.heldProp()
      if (prop) held.set(id, prop)
    }
    const props = new Map<string, { x: number; y: number; z: number }>()
    for (const [id, prop] of this.physics.propTransforms()) props.set(id, prop.position)
    return { robots, props, joints, held, ink, inkVersion }
  }

  private log(call: string): void {
    this.calls.push({ atMs: Math.round(this.timeMs), call })
    if (this.calls.length > CALL_LOG_LIMIT) this.calls.shift()
  }
}

function unknownRobot(id: string): CommandError {
  return new CommandError(`There's no robot called "${id}" in this scene.`, 'invalid')
}

/** How errors name a robot: its type, plus its id when it isn't the main one. */
function describe(slot: RobotSlot): string {
  const label = slot.capability.label.toLowerCase()
  return slot.id === DEFAULT_ROBOT_ID ? label : `${label} "${slot.id}"`
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
