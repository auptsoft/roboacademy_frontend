import type { PyodideAPI } from 'pyodide'
import { PYTHON_RUNNER } from '../languages/python/runner'
import { PEN_COLORS } from '../robots/pen'
import type { CallKind, HostToWorker, StartMessage, WorkerToHost } from './protocol'

type PyCallable = ((...args: unknown[]) => Promise<unknown>) & { destroy?: () => void }

/**
 * Runs one learner Python program in Pyodide, speaking the same protocol as ProgramSession, so
 * the run controller treats both alike. Robot calls return promises the rewritten program awaits
 * (see runner.ts); the host answers each once the action has finished in simulated time.
 *
 * Pyodide starts loading as soon as the session exists, so a session created ahead of time (a
 * warm worker) is ready when the learner presses Run. Transport-free, like ProgramSession:
 * `python-worker.ts` connects it to postMessage, and tests drive it directly.
 */
export class PythonSession {
  private readonly ready: Promise<PyCallable>
  private readonly post: (message: WorkerToHost) => void
  private readonly pending = new Map<number, (value: unknown) => void>()
  private nextCallId = 1
  private started = false
  private failed = false

  constructor(post: (message: WorkerToHost) => void, loadPyodide: () => Promise<PyodideAPI>) {
    this.post = post
    this.ready = this.prepare(loadPyodide)
    // A load failure is reported when the program is started, not before.
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
        // A failed robot call (blocked, hidden sensor) ends the program with the robot's message;
        // the call is never resolved, and the host terminates the worker.
        if (message.ok) resolve(message.value)
        else this.fail(message.message)
        break
      }
    }
  }

  private async prepare(loadPyodide: () => Promise<PyodideAPI>): Promise<PyCallable> {
    const pyodide = await loadPyodide()
    pyodide.globals.set('_sim_host', (kind: CallKind, name: string, argsJson: string, robot?: string, wait?: boolean) =>
      this.call(kind, name, JSON.parse(argsJson) as Record<string, unknown>, { ...(robot ? { robot } : {}), ...(wait === false ? { wait } : {}) }))
    pyodide.globals.set('_sim_tick', () => this.call('tick', '', {}))
    pyodide.globals.set('_sim_pen_colors', JSON.stringify(PEN_COLORS.map((color) => color.name)))
    pyodide.globals.set('_sim_line', (line: number) => this.post({ type: 'highlight', blockId: `L${line}` }))
    pyodide.globals.set('_sim_print', (text: string) => this.post({ type: 'print', text: String(text).slice(0, 500) }))
    pyodide.runPython(PYTHON_RUNNER)
    return pyodide.globals.get('run_program') as PyCallable
  }

  private call(kind: CallKind, name: string, args: Record<string, unknown>, target: { robot?: string; wait?: boolean } = {}): Promise<unknown> {
    const id = this.nextCallId++
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.post({ type: 'call', id, kind, name, args, ...target })
    })
  }

  private fail(message: string, location?: string): void {
    if (this.failed) return
    this.failed = true
    this.post({ type: 'error', message, ...(location ? { location } : {}) })
  }

  private async start(message: StartMessage): Promise<void> {
    let runProgram: PyCallable
    try {
      runProgram = await this.ready
    } catch {
      this.fail('Python could not be started. Check your connection and try again.')
      return
    }

    this.post({ type: 'started' })
    try {
      await runProgram(message.code, JSON.stringify(message.robots.map(({ id, api }) => ({ id, api }))))
      if (!this.failed) this.post({ type: 'done' })
    } catch (error) {
      const { text, line } = describePythonError(error)
      this.fail(text, line ? `L${line}` : undefined)
    }
  }
}

/**
 * The learner-facing part of a Python error: the last line of the traceback, e.g.
 * "NameError: name 'speed' is not defined". Errors raised by the runner itself (syntax errors,
 * blocked modules) carry "Line n: ..." and give the line directly.
 */
export function describePythonError(error: unknown): { text: string; line: number | null } {
  const raw = error instanceof Error ? error.message : String(error)
  const last = raw.trim().split('\n').filter((l) => l.trim().length > 0).pop() ?? raw
  const runnerError = /^(?:\w+\.)?ProgramError: (Line (\d+): .*)$/.exec(last)
  if (runnerError) return { text: runnerError[1]!, line: Number(runnerError[2]) }
  return { text: last.trim(), line: null }
}
