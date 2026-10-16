import Interpreter from 'js-interpreter'
import { RUNTIME_GLOBALS, type CallKind, type HostToWorker, type StartMessage, type WorkerToHost } from './protocol'

type Resume = (value: unknown) => void
type AsyncImpl = (...args: never[]) => void
type NativeImpl = (...args: never[]) => unknown

/**
 * Runs one learner program inside JS-Interpreter. The code is interpreted, never evaluated: no
 * `eval` or `new Function`. Robot API calls pause the interpreter and go to the host, which
 * answers once the action has finished in simulated time.
 *
 * Transport-free so it can be tested without a Worker; `worker.ts` connects it to postMessage.
 */
export class ProgramSession {
  private interpreter: Interpreter | null = null
  private nextCallId = 1
  private readonly pending = new Map<number, (value: number | boolean | undefined) => void>()
  private failed = false
  private readonly post: (message: WorkerToHost) => void

  constructor(post: (message: WorkerToHost) => void) {
    this.post = post
  }

  receive(message: HostToWorker): void {
    switch (message.type) {
      case 'start':
        if (!this.interpreter) this.start(message)
        break
      case 'reply': {
        const resolve = this.pending.get(message.id)
        if (!resolve) break
        this.pending.delete(message.id)
        if (message.ok) resolve(message.value)
        // A failed robot call (blocked, hidden sensor) ends the program with the robot's message.
        else this.fail(message.message)
        break
      }
    }
  }

  private fail(message: string): void {
    if (this.failed) return
    this.failed = true
    this.post({ type: 'error', message })
  }

  private call(kind: CallKind, name: string, args: Record<string, unknown>, resume: Resume): void {
    const id = this.nextCallId++
    this.pending.set(id, (value) => {
      resume(value)
      this.run()
    })
    this.post({ type: 'call', id, kind, name, args })
  }

  private run(): void {
    if (!this.interpreter || this.failed) return
    try {
      const paused = this.interpreter.run()
      if (!paused) this.post({ type: 'done' })
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error))
    }
  }

  private start(message: StartMessage): void {
    try {
      this.interpreter = new Interpreter(message.code, (interp, globalObject) => {
        for (const command of message.commands) {
          const impl = (...raw: unknown[]) => {
            const resume = raw.pop() as Resume
            const args: Record<string, unknown> = {}
            command.params.forEach((param, i) => {
              if (raw[i] !== undefined) args[param] = raw[i]
            })
            this.call('command', command.name, args, () => resume(undefined))
          }
          // JS-Interpreter pads a call's arguments to the async function's declared length (the
          // parameters plus the callback). A rest-parameter function declares none, so set it.
          Object.defineProperty(impl, 'length', { value: command.params.length + 1 })
          interp.setProperty(globalObject, command.name, interp.createAsyncFunction(impl as AsyncImpl))
        }

        const readSensor = (name: unknown, resume: Resume) => this.call('sensor', String(name), {}, resume)
        interp.setProperty(globalObject, RUNTIME_GLOBALS.readSensor, interp.createAsyncFunction(readSensor as AsyncImpl))

        const tick = (resume: Resume) => this.call('tick', '', {}, () => resume(undefined))
        interp.setProperty(globalObject, RUNTIME_GLOBALS.tick, interp.createAsyncFunction(tick as AsyncImpl))

        const highlight = (blockId: unknown) => this.post({ type: 'highlight', blockId: String(blockId) })
        interp.setProperty(globalObject, RUNTIME_GLOBALS.highlight, interp.createNativeFunction(highlight as NativeImpl))

        const print = (text: unknown) => this.post({ type: 'print', text: String(text).slice(0, 500) })
        interp.setProperty(globalObject, RUNTIME_GLOBALS.print, interp.createNativeFunction(print as NativeImpl))
      })
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error))
      return
    }
    // Regular-expression timeouts would spawn further workers from blob URLs. Generated block
    // code never uses regular expressions, so refuse them instead.
    this.interpreter.REGEXP_MODE = 0
    this.post({ type: 'started' })
    this.run()
  }
}
