import { getCapability } from '../robots'
import { createLuaWorker, createProgramWorker } from './create-worker'
import { createPythonWorker } from './python-worker-pool'
import type { WorkerLike } from './run-controller'

/** 'blocks' means code already generated from a Blockly workspace (it runs as-is). */
export type OutputLanguage = 'javascript' | 'python' | 'lua' | 'blocks'

export type OutputRun =
  | { ok: true; output: string }
  | { ok: false; output: string; error: string; line: number | null }

/** Loading a runtime (Pyodide especially) on a slow connection. */
const START_LIMIT_MS = 60_000
/** A lesson exercise that runs longer than this is almost certainly an endless loop. */
const RUN_LIMIT_MS = 5_000
const MAX_LINES = 500

const ROBOT_COMMANDS = getCapability('diff-drive')!.commands.map((c) => ({ name: c.name, params: c.params.map((p) => p.name) }))

/**
 * Runs a program with no robot and collects what it prints - for coding exercises in Interactive
 * lessons. Uses the same sandboxed workers as the simulator: JavaScript is interpreted, never
 * evaluated; Python and Lua run in WebAssembly. Loop "ticks" are answered at once (there's no
 * simulated time to wait for), and any robot call fails with a clear message.
 */
export async function runForOutput(
  language: OutputLanguage,
  source: string,
  createWorker?: () => WorkerLike,
): Promise<OutputRun> {
  let code = source
  if (language === 'javascript') {
    // Babel is several megabytes, so it's loaded the first time a JavaScript exercise runs.
    const { compileJavaScript } = await import('../languages/javascript/compile')
    const compiled = compileJavaScript(source)
    if (!compiled.ok) return { ok: false, output: '', error: compiled.message, line: compiled.line }
    code = compiled.code
  }

  const worker: WorkerLike = createWorker?.()
    ?? (language === 'python' ? createPythonWorker() : language === 'lua' ? createLuaWorker() : createProgramWorker())
  const lines: string[] = []

  return new Promise<OutputRun>((resolve) => {
    let timer = setTimeout(() => finish({ ok: false, error: 'The program could not be started. Check your connection and try again.' }), START_LIMIT_MS)

    function finish(result: { ok: true } | { ok: false; error: string; line?: number | null }) {
      clearTimeout(timer)
      worker.terminate()
      const output = lines.join('\n')
      resolve(result.ok ? { ok: true, output } : { ok: false, output, error: result.error, line: result.line ?? null })
    }

    worker.onmessage = (event) => {
      const message = event.data
      switch (message.type) {
        case 'started':
          clearTimeout(timer)
          timer = setTimeout(() => finish({
            ok: false,
            error: `Your program ran for more than ${RUN_LIMIT_MS / 1000} seconds. Is there a loop that never ends?`,
          }), RUN_LIMIT_MS)
          break
        case 'print':
          if (lines.length < MAX_LINES) lines.push(message.text)
          break
        case 'call':
          if (message.kind === 'tick') worker.postMessage({ type: 'reply', id: message.id, ok: true })
          else worker.postMessage({ type: 'reply', id: message.id, ok: false, message: "There's no robot in this exercise - just print your answer." })
          break
        case 'done':
          finish({ ok: true })
          break
        case 'error':
          finish({ ok: false, error: message.message, line: lineOf(message.location) })
          break
      }
    }

    // The robot's commands are still declared: the language preludes bind them when the program
    // starts (JavaScript's `robot` object takes move, turn, ... as arguments), so leaving them out
    // fails every program before its first line. Calling one gets the "no robot" reply above.
    worker.postMessage({ type: 'start', code, commands: ROBOT_COMMANDS })
  })
}

function lineOf(location: string | undefined): number | null {
  return location && /^L\d+$/.test(location) ? Number(location.slice(1)) : null
}
