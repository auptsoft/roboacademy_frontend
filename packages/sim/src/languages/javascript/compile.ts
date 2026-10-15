import { transform } from '@babel/standalone'
import type { PluginObj, types as BabelTypes, NodePath } from '@babel/core'
import { RUNTIME_GLOBALS } from '../../runtime/protocol'
import { JS_PRELUDE } from './api'

export type CompileResult =
  | { ok: true; code: string }
  | { ok: false; message: string; line: number | null }

const INSTRUMENTED = Symbol('instrumented')

type Marked = BabelTypes.Statement & { [INSTRUMENTED]?: true }

/**
 * Adds what the runtime needs to a learner's program, the way the blocks generator does:
 * - a line marker before each statement, so the editor can highlight the running line and errors
 *   can point at it;
 * - a tick at the top of every loop body, so loops advance simulated time instead of spinning.
 */
function instrument({ types: t }: { types: typeof BabelTypes }): PluginObj {
  const mark = <T extends BabelTypes.Statement>(node: T): T => {
    ;(node as Marked)[INSTRUMENTED] = true
    return node
  }
  const call = (name: string, args: BabelTypes.Expression[] = []) =>
    mark(t.expressionStatement(t.callExpression(t.identifier(name), args)))

  return {
    visitor: {
      Statement(path: NodePath<BabelTypes.Statement>) {
        if ((path.node as Marked)[INSTRUMENTED]) return
        if (path.isBlockStatement() || path.isFunctionDeclaration() || path.isEmptyStatement()) return
        const parent = path.parentPath
        if (!parent || !(parent.isBlockStatement() || parent.isProgram() || parent.isSwitchCase())) return
        const line = path.node.loc?.start.line
        if (!line) return
        path.insertBefore(call(RUNTIME_GLOBALS.highlight, [t.stringLiteral(`L${line}`)]))
      },
      Loop(path: NodePath<BabelTypes.Loop>) {
        const body = path.get('body') as NodePath<BabelTypes.Statement>
        if (!body.isBlockStatement()) body.replaceWith(t.blockStatement([body.node]))
        ;(path.get('body') as NodePath<BabelTypes.BlockStatement>).unshiftContainer('body', call(RUNTIME_GLOBALS.tick))
      },
    },
  }
}

/** First line of a Babel error, without the file name and position suffix. */
function cleanMessage(raw: string): string {
  const first = raw.split('\n')[0] ?? raw
  return first.replace(/^unknown file:\s*/i, '').replace(/\s*\(\d+:\d+\)\s*$/, '')
}

/**
 * Turns a learner's modern JavaScript into ES5 the interpreter can run, with the robot API in
 * front. Runs on the main thread: it only parses and rewrites the code, never executes it.
 */
export function compileJavaScript(source: string): CompileResult {
  try {
    const result = transform(source, {
      sourceType: 'script',
      filename: 'program.js',
      plugins: [instrument],
      // Loose mode keeps for...of on arrays as an index loop, so it needs no Symbol.iterator,
      // which the interpreter doesn't have.
      presets: [['env', { targets: { ie: '11' }, loose: true, modules: false }]],
      comments: false,
      compact: false,
    })
    // The learner's program runs in its own function scope, so its declarations can't replace
    // the runtime's globals.
    return { ok: true, code: `${JS_PRELUDE}\n(function () {\n${result?.code ?? ''}\n})();\n` }
  } catch (error) {
    const err = error as { message?: string; loc?: { line?: number } }
    const line = err.loc?.line ?? null
    const message = cleanMessage(err.message ?? 'This program could not be read.')
    return { ok: false, message: line ? `Line ${line}: ${message}` : message, line }
  }
}
