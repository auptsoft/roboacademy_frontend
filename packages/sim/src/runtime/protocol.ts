import type { RobotApi } from '../robots/types'

/** Messages between the main thread and the program worker. */

/** A robot as the program runtime sees it. */
export interface StartRobot {
  id: string
  /** Which robot object the preludes define for it. */
  api: RobotApi
  /** Its API functions, with their positional parameter names. */
  commands: { name: string; params: string[] }[]
}

export interface StartMessage {
  type: 'start'
  code: string
  /** The scene's robots, the main one (`robot`) first. */
  robots: StartRobot[]
}

export type HostToWorker =
  | StartMessage
  | { type: 'reply'; id: number; ok: true; value?: number | boolean }
  | { type: 'reply'; id: number; ok: false; message: string }

/** `idle` waits until a robot (or, with no robot, every robot) has nothing left to do. */
export type CallKind = 'command' | 'sensor' | 'tick' | 'idle'

export type WorkerToHost =
  /** The program has begun executing (after any runtime start-up, such as loading Python). */
  | { type: 'started' }
  /**
   * `robot` defaults to the main one. A command with `wait: false` is answered as soon as it
   * starts, rather than when it finishes.
   */
  | { type: 'call'; id: number; kind: CallKind; name: string; args: Record<string, unknown>; robot?: string; wait?: boolean }
  | { type: 'highlight'; blockId: string }
  | { type: 'print'; text: string }
  | { type: 'done' }
  /** `location` is a highlight id (a block id, or "L" + line) when the error knows where it came from. */
  | { type: 'error'; message: string; location?: string }

/** Names the generated code calls, besides the robot commands. */
export const RUNTIME_GLOBALS = {
  readSensor: 'readSensor',
  /** `(robot, wait, name, ...args)`: a command for a named robot. Used by the JavaScript prelude. */
  robotCommand: '__robotCommand',
  /** `(robot, name)`: a named robot's sensor. */
  robotSensor: '__robotSensor',
  /** `(robot)`: waits until a robot, or every robot for '', is done. */
  robotIdle: '__robotIdle',
  /** `(robot)`: which robot block commands and `readSensor` go to; returns the previous one. */
  useRobot: '__useRobot',
  /** `(on)`: while on, block commands start without waiting to finish; returns the previous setting. */
  together: '__together',
  highlight: 'highlightBlock',
  print: 'print',
  tick: '__tick',
} as const
