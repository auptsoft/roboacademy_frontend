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
  /** Block programs' implicit robot, and whether their commands wait to finish. */
  private currentRobot = 'robot'
  private together = false

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

  private call(kind: CallKind, name: string, args: Record<string, unknown>, resume: Resume, target: { robot?: string; wait?: boolean } = {}): void {
    const id = this.nextCallId++
    this.pending.set(id, (value) => {
      resume(value)
      this.run()
    })
    this.post({ type: 'call', id, kind, name, args, ...target })
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
      this.currentRobot = message.robots[0]?.id ?? 'robot'
      const params = new Map(message.robots.map((robot) => [robot.id, new Map(robot.commands.map((c) => [c.name, c.params]))]))
      // Positional arguments, named from the robot's command specs.
      const named = (robot: string, name: string, values: unknown[]) => {
        const args: Record<string, unknown> = {}
        params.get(robot)?.get(name)?.forEach((param, i) => {
          if (values[i] !== undefined) args[param] = values[i]
        })
        return args
      }
      const asyncFunction = (interp: Interpreter, impl: (...raw: unknown[]) => void, length: number) => {
        // JS-Interpreter pads a call's arguments to the async function's declared length (the
        // parameters plus the callback). A rest-parameter function declares none, so set it.
        Object.defineProperty(impl, 'length', { value: length + 1 })
        return interp.createAsyncFunction(impl as AsyncImpl)
      }

      this.interpreter = new Interpreter(message.code, (interp, globalObject) => {
        // Block programs call each command by name, for the robot `__useRobot` last chose.
        const names = new Map<string, number>()
        for (const robot of message.robots) {
          for (const command of robot.commands) names.set(command.name, Math.max(names.get(command.name) ?? 0, command.params.length))
        }
        for (const [name, length] of names) {
          const impl = (...raw: unknown[]) => {
            const resume = raw.pop() as Resume
            const robot = this.currentRobot
            this.call('command', name, named(robot, name, raw), () => resume(undefined), { robot, wait: !this.together })
          }
          interp.setProperty(globalObject, name, asyncFunction(interp, impl, length))
        }

        const readSensor = (name: unknown, resume: Resume) => this.call('sensor', String(name), {}, resume, { robot: this.currentRobot })
        interp.setProperty(globalObject, RUNTIME_GLOBALS.readSensor, interp.createAsyncFunction(readSensor as AsyncImpl))

        // Text programs name the robot in every call, through the prelude's robot objects.
        const robotCommand = (...raw: unknown[]) => {
          const resume = raw.pop() as Resume
          const [robot, wait, name, ...values] = raw
          this.call('command', String(name), named(String(robot), String(name), values), () => resume(undefined), {
            robot: String(robot),
            wait: wait !== false,
          })
        }
        interp.setProperty(globalObject, RUNTIME_GLOBALS.robotCommand, asyncFunction(interp, robotCommand, 6))

        const robotSensor = (robot: unknown, name: unknown, resume: Resume) =>
          this.call('sensor', String(name), {}, resume, { robot: String(robot) })
        interp.setProperty(globalObject, RUNTIME_GLOBALS.robotSensor, interp.createAsyncFunction(robotSensor as AsyncImpl))

        const robotIdle = (robot: unknown, resume: Resume) =>
          this.call('idle', '', {}, () => resume(undefined), robot ? { robot: String(robot) } : {})
        interp.setProperty(globalObject, RUNTIME_GLOBALS.robotIdle, interp.createAsyncFunction(robotIdle as AsyncImpl))

        const useRobot = (robot: unknown) => {
          const previous = this.currentRobot
          this.currentRobot = String(robot)
          return previous
        }
        interp.setProperty(globalObject, RUNTIME_GLOBALS.useRobot, interp.createNativeFunction(useRobot as NativeImpl))

        const together = (on: unknown) => {
          const previous = this.together
          this.together = !!on
          return previous
        }
        interp.setProperty(globalObject, RUNTIME_GLOBALS.together, interp.createNativeFunction(together as NativeImpl))

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
