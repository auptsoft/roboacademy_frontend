import type { LuaEngine } from 'wasmoon'
import { instrumentLua } from '../languages/lua/instrument'
import { LUA_PRELUDE } from '../languages/lua/prelude'
import type { CallKind, HostToWorker, StartMessage, WorkerToHost } from './protocol'

/**
 * Runs one learner Lua program in wasmoon (Lua 5.4 compiled to WebAssembly), speaking the same
 * protocol as ProgramSession and PythonSession. Robot calls return promises that the prelude
 * awaits, suspending the program through Lua coroutines until the host answers.
 *
 * Transport-free: `lua-worker.ts` connects it to postMessage, and tests drive it directly.
 */
export class LuaSession {
  private readonly ready: Promise<LuaEngine>
  private readonly post: (message: WorkerToHost) => void
  private readonly pending = new Map<number, (value: unknown) => void>()
  private nextCallId = 1
  private started = false
  private failed = false

  constructor(post: (message: WorkerToHost) => void, createEngine: () => Promise<LuaEngine>) {
    this.post = post
    this.ready = createEngine()
    this.ready.catch(() => undefined)
  }

  receive(message: HostToWorker): void {
    switch (message.type) {
      case 'start':
        if (!this.started) {
          this.started = true
          void this.start(message)
        }
        break
      case 'reply': {
        const resolve = this.pending.get(message.id)
        if (!resolve) break
        this.pending.delete(message.id)
        // A failed robot call (blocked, hidden sensor) ends the program with the robot's message.
        if (message.ok) resolve(message.value)
        else this.fail(message.message)
        break
      }
    }
  }

  private call(kind: CallKind, name: string, args: Record<string, unknown>): Promise<unknown> {
    const id = this.nextCallId++
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.post({ type: 'call', id, kind, name, args })
    })
  }

  private fail(message: string, location?: string): void {
    if (this.failed) return
    this.failed = true
    this.post({ type: 'error', message, ...(location ? { location } : {}) })
  }

  private async start(message: StartMessage): Promise<void> {
    const instrumented = instrumentLua(message.code)
    if (!instrumented.ok) {
      this.fail(instrumented.message, instrumented.line ? `L${instrumented.line}` : undefined)
      return
    }

    let engine: LuaEngine
    try {
      engine = await this.ready
    } catch {
      this.fail('Lua could not be started. Check your connection and try again.')
      return
    }

    // Positional arguments, named from the robot's command specs, as ProgramSession does.
    const params = new Map(message.commands.map((c) => [c.name, c.params]))
    engine.global.set('_sim_command', (name: string, ...values: unknown[]) => {
      const args: Record<string, unknown> = {}
      params.get(name)?.forEach((param, i) => {
        if (values[i] !== undefined && values[i] !== null) args[param] = values[i]
      })
      return this.call('command', name, args)
    })
    engine.global.set('_sim_sensor', (name: string) => this.call('sensor', name, {}))
    engine.global.set('_sim_tick', () => this.call('tick', '', {}))
    engine.global.set('_sim_line', (line: number) => this.post({ type: 'highlight', blockId: `L${line}` }))
    engine.global.set('_sim_print', (text: string) => this.post({ type: 'print', text: String(text).slice(0, 500) }))

    try {
      engine.doStringSync(LUA_PRELUDE)
    } catch {
      this.fail('Lua could not be started.')
      return
    }

    this.post({ type: 'started' })
    try {
      await engine.doString(instrumented.code)
      if (!this.failed) this.post({ type: 'done' })
    } catch (error) {
      const { text, line } = describeLuaError(error)
      this.fail(text, line ? `L${line}` : undefined)
    }
  }
}

/**
 * The learner-facing part of a Lua error. Lua reports `[string "..."]:3: message` for the
 * program chunk; that becomes "Line 3: message".
 */
export function describeLuaError(error: unknown): { text: string; line: number | null } {
  const raw = error instanceof Error ? error.message : String(error)
  const first = raw.trim().split('\n')[0] ?? raw
  const located = /\]:(\d+): ([\s\S]*)$/.exec(first)
  if (located) return { text: `Line ${located[1]}: ${located[2]}`, line: Number(located[1]) }
  return { text: first, line: null }
}
