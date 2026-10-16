/** Messages between the main thread and the program worker. */

export interface StartMessage {
  type: 'start'
  code: string
  /** Robot API functions to expose, with their positional parameter names. */
  commands: { name: string; params: string[] }[]
}

export type HostToWorker =
  | StartMessage
  | { type: 'reply'; id: number; ok: true; value?: number | boolean }
  | { type: 'reply'; id: number; ok: false; message: string }

export type CallKind = 'command' | 'sensor' | 'tick'

export type WorkerToHost =
  /** The program has begun executing (after any runtime start-up, such as loading Python). */
  | { type: 'started' }
  | { type: 'call'; id: number; kind: CallKind; name: string; args: Record<string, unknown> }
  | { type: 'highlight'; blockId: string }
  | { type: 'print'; text: string }
  | { type: 'done' }
  /** `location` is a highlight id (a block id, or "L" + line) when the error knows where it came from. */
  | { type: 'error'; message: string; location?: string }

/** Names the generated code calls, besides the robot commands. */
export const RUNTIME_GLOBALS = {
  readSensor: 'readSensor',
  highlight: 'highlightBlock',
  print: 'print',
  tick: '__tick',
} as const
