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
  | { type: 'call'; id: number; kind: CallKind; name: string; args: Record<string, unknown> }
  | { type: 'highlight'; blockId: string }
  | { type: 'print'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

/** Names the generated code calls, besides the robot commands. */
export const RUNTIME_GLOBALS = {
  readSensor: 'readSensor',
  highlight: 'highlightBlock',
  print: 'print',
  tick: '__tick',
} as const
