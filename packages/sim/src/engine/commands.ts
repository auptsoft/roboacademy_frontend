/** A command failed in a way the learner can act on, e.g. the robot was blocked. */
export class CommandError extends Error {
  readonly code: 'blocked' | 'invalid' | 'hidden_sensor' | 'busy'

  constructor(message: string, code: CommandError['code']) {
    super(message)
    this.code = code
  }
}

/** A command that takes simulated time, as a robot driver starts it. */
export interface CommandMotion {
  /** How long it may run before the robot counts as blocked, in simulated ms. */
  timeoutMs: number
  /**
   * Called every step before the world steps; returns true when the command has finished, or
   * 'blocked' when the robot can't go on - without waiting for the timeout.
   */
  update: (dtMs: number) => boolean | 'blocked'
  /** Shown to the learner if the command is blocked or times out. */
  blockedMessage?: string
}

interface ActiveCommand {
  name: string
  motion: CommandMotion
  elapsedMs: number
  resolve: () => void
  reject: (error: CommandError) => void
  onSettled?: (error?: CommandError) => void
}

export interface CommandTarget {
  command(name: string, args: Record<string, number>): CommandMotion | null
  halt(): void
}

/** How long a motion may take beyond its expected duration before the robot counts as blocked. */
export function motionTimeout(expectedMs: number): number {
  return expectedMs * 2 + 1500
}

/** A motion that just runs for a fixed time, then calls `onFinish`. */
export function timedMotion(durationMs: number, onFinish?: () => void): CommandMotion {
  let elapsedMs = 0
  return {
    timeoutMs: durationMs + 1000,
    update: (dtMs) => {
      elapsedMs += dtMs
      if (elapsedMs < durationMs) return false
      onFinish?.()
      return true
    },
  }
}

/**
 * Runs the robot API's commands in simulated time. At most one blocking command runs at once;
 * the program waits for it before calling the next, so there is never a queue.
 */
export class CommandController {
  private active: ActiveCommand | null = null
  private readonly robot: CommandTarget

  constructor(robot: CommandTarget) {
    this.robot = robot
  }

  get busy(): boolean {
    return this.active !== null
  }

  /**
   * Starts a command. Resolves when it finishes, in simulated time. `onSettled` is called at that
   * same moment, synchronously, before the promise's callbacks run, with the error if it failed -
   * or never, if it's cancelled.
   */
  run(name: string, args: Record<string, number>, onSettled?: (error?: CommandError) => void): Promise<void> {
    if (this.active) {
      const error = new CommandError('Another command is still running.', 'busy')
      onSettled?.(error)
      return Promise.reject(error)
    }
    let motion: CommandMotion | null
    try {
      motion = this.robot.command(name, args)
    } catch (error) {
      const failure = error instanceof CommandError ? error : new CommandError(String(error), 'invalid')
      onSettled?.(failure)
      return Promise.reject(failure)
    }
    if (!motion) {
      onSettled?.()
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      this.active = { name, motion: motion!, elapsedMs: 0, resolve, reject, onSettled }
    })
  }

  /** Advances the active command by one physics step. Call before stepping the world. */
  step(dtMs: number): void {
    const command = this.active
    if (!command) return
    command.elapsedMs += dtMs
    const result = command.motion.update(dtMs)
    if (result === true) {
      this.active = null
      command.onSettled?.()
      command.resolve()
    } else if (result === 'blocked' || command.elapsedMs > command.motion.timeoutMs) {
      this.active = null
      this.robot.halt()
      const error = new CommandError(command.motion.blockedMessage ?? `The robot couldn't finish "${command.name}".`, 'blocked')
      command.onSettled?.(error)
      command.reject(error)
    }
  }

  /** Abandons the active command, e.g. when the run is stopped. Its promise never settles. */
  cancel(): void {
    this.active = null
    this.robot.halt()
  }
}
