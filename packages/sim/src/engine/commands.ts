import { DIFF_DRIVE_MAX_SPEED, DIFF_DRIVE_WHEEL_BASE } from '../robots/diff-drive'
import { DEG_TO_RAD, normaliseDegrees } from './geometry'
import type { RobotPose } from './physics'

/** A command failed in a way the learner can act on, e.g. the robot was blocked. */
export class CommandError extends Error {
  readonly code: 'blocked' | 'invalid' | 'hidden_sensor' | 'busy'

  constructor(message: string, code: CommandError['code']) {
    super(message)
    this.code = code
  }
}

interface ActiveCommand {
  name: string
  elapsedMs: number
  timeoutMs: number
  /** Called every step; returns true when the command has finished. */
  update: (pose: RobotPose, dtMs: number) => boolean
  resolve: () => void
  reject: (error: CommandError) => void
}

export interface WheelSink {
  setWheels(left: number, right: number): void
}

/** How long a motion may take beyond its expected duration before the robot counts as blocked. */
function motionTimeout(expectedMs: number): number {
  return expectedMs * 2 + 1500
}

/**
 * Runs the robot API's commands in simulated time. At most one blocking command runs at once;
 * the program waits for it before calling the next, so there is never a queue.
 */
export class CommandController {
  private active: ActiveCommand | null = null
  private readonly robot: WheelSink

  constructor(robot: WheelSink) {
    this.robot = robot
  }

  get busy(): boolean {
    return this.active !== null
  }

  /** Starts a command. Resolves when it finishes, in simulated time. */
  run(name: string, args: Record<string, number>, pose: RobotPose): Promise<void> {
    if (this.active) return Promise.reject(new CommandError('Another command is still running.', 'busy'))

    switch (name) {
      case 'stop':
        this.robot.setWheels(0, 0)
        return Promise.resolve()
      case 'setWheels':
        this.robot.setWheels(args.left! / 100, args.right! / 100)
        return Promise.resolve()
      case 'drive': {
        const speed = args.speed! / 100
        this.robot.setWheels(speed, speed)
        const durationMs = args.durationMs!
        if (durationMs <= 0) return Promise.resolve()
        return this.start(name, durationMs + 1000, (_pose, _dt) => false, durationMs, () => this.robot.setWheels(0, 0))
      }
      case 'wait':
        return this.start(name, args.ms! + 1000, () => false, args.ms!)
      case 'move':
        return this.startMove(args.distanceCm! / 100, args.speed! / 100, pose)
      case 'turn':
        return this.startTurn(args.degrees!, args.speed! / 100, pose)
      default:
        return Promise.reject(new CommandError(`Unknown command "${name}".`, 'invalid'))
    }
  }

  /** Advances the active command by one physics step. Call before stepping the world. */
  step(pose: RobotPose, dtMs: number): void {
    const command = this.active
    if (!command) return
    command.elapsedMs += dtMs
    if (command.update(pose, dtMs)) {
      this.active = null
      command.resolve()
    } else if (command.elapsedMs > command.timeoutMs) {
      this.active = null
      this.robot.setWheels(0, 0)
      command.reject(new CommandError(blockedMessage(command.name), 'blocked'))
    }
  }

  /** Abandons the active command, e.g. when the run is stopped. Its promise never settles. */
  cancel(): void {
    this.active = null
    this.robot.setWheels(0, 0)
  }

  private start(
    name: string,
    timeoutMs: number,
    update: ActiveCommand['update'],
    durationMs?: number,
    onTimedFinish?: () => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timed = durationMs !== undefined
      this.active = {
        name,
        elapsedMs: 0,
        timeoutMs,
        update: timed
          ? (pose, dt) => {
              if (this.active && this.active.elapsedMs >= durationMs) {
                onTimedFinish?.()
                return true
              }
              return update(pose, dt)
            }
          : update,
        resolve,
        reject,
      }
    })
  }

  private startMove(distance: number, speed: number, startPose: RobotPose): Promise<void> {
    const target = Math.abs(distance)
    if (target < 0.001) return Promise.resolve()
    const direction = Math.sign(distance)
    const heading = startPose.heading * DEG_TO_RAD
    const forward = { x: Math.cos(heading), z: -Math.sin(heading) }
    const stepDistance = speed * DIFF_DRIVE_MAX_SPEED / 60

    const expectedMs = (target / (speed * DIFF_DRIVE_MAX_SPEED)) * 1000
    return this.start('move', motionTimeout(expectedMs), (pose) => {
      // Progress is measured along the starting heading, so a robot nudged sideways by a prop
      // still stops at the right distance.
      const travelled = ((pose.x - startPose.x) * forward.x + (pose.z - startPose.z) * forward.z) * direction
      const remaining = target - travelled
      if (remaining <= 0.0005) {
        this.robot.setWheels(0, 0)
        return true
      }
      // Slow down over the last few steps so the robot stops close to the target, not a step past it.
      const scale = Math.max(0.05, Math.min(1, remaining / (stepDistance * 3)))
      const wheel = direction * speed * scale
      this.robot.setWheels(wheel, wheel)
      return false
    })
  }

  private startTurn(degrees: number, speed: number, startPose: RobotPose): Promise<void> {
    const target = Math.abs(degrees)
    if (target < 0.05) return Promise.resolve()
    const direction = Math.sign(degrees)
    const degreesPerStep = ((2 * speed * DIFF_DRIVE_MAX_SPEED) / DIFF_DRIVE_WHEEL_BASE / 60) * (180 / Math.PI)
    let turned = 0
    let previous = startPose.heading

    const expectedMs = (target / degreesPerStep / 60) * 1000
    return this.start('turn', motionTimeout(expectedMs), (pose) => {
      // Accumulate step by step, so turns of more than 180° are measured correctly.
      turned += normaliseDegrees(pose.heading - previous) * direction
      previous = pose.heading
      const remaining = target - turned
      if (remaining <= 0.05) {
        this.robot.setWheels(0, 0)
        return true
      }
      const scale = Math.max(0.05, Math.min(1, remaining / (degreesPerStep * 3)))
      const wheel = speed * scale
      // Positive is counter-clockwise: right wheel forward, left wheel back.
      this.robot.setWheels(-direction * wheel, direction * wheel)
      return false
    })
  }
}

function blockedMessage(command: string): string {
  switch (command) {
    case 'move':
      return "The robot couldn't finish moving. Is something in the way?"
    case 'turn':
      return "The robot couldn't finish turning. Is something in the way?"
    default:
      return `The robot couldn't finish "${command}".`
  }
}
