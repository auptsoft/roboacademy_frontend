import { parse, type Chunk, type Node, type Statement } from 'luaparse'

export type InstrumentResult =
  | { ok: true; code: string }
  | { ok: false; message: string; line: number | null }

interface Insertion {
  at: number
  text: string
}

type WithBody = Node & { body?: Statement[] }

/** What luaparse adds with `ranges` and `locations` on, which its type definitions leave out. */
interface Located {
  range?: [number, number]
  loc?: { start: { line: number } }
}

const located = (node: unknown): Located => node as Located
const end = (node: unknown): number => located(node).range?.[1] ?? 0

/**
 * Adds what the runtime needs to a learner's Lua program, the way the blocks generator does:
 * a line marker before each statement (running-line highlighting) and a tick at the top of every
 * loop body (so loops advance simulated time). Everything is inserted on the line it belongs to,
 * so line numbers in Lua's own error messages stay the learner's.
 *
 * Robot calls need no rewriting: they pause the program through Lua coroutines (see prelude.ts).
 */
export function instrumentLua(source: string): InstrumentResult {
  let chunk: Chunk
  try {
    chunk = parse(source, { locations: true, ranges: true, luaVersion: '5.3', comments: false })
  } catch (error) {
    const err = error as { message?: string; line?: number }
    const message = (err.message ?? 'This program could not be read.').replace(/^\[\d+:\d+\]\s*/, '')
    const line = err.line ?? null
    return { ok: false, message: line ? `Line ${line}: ${message}` : message, line }
  }

  const insertions: Insertion[] = []

  const markStatements = (statements: Statement[] | undefined) => {
    for (const statement of statements ?? []) {
      const { range, loc } = located(statement)
      if (statement.type !== 'FunctionDeclaration' && range && loc) {
        insertions.push({ at: range[0], text: `_sim_line(${loc.start.line}); ` })
      }
    }
  }

  /** Inserts the tick just after a loop's opening keyword (`do`, or `repeat`). */
  const tickAfter = (from: number, keyword: 'do' | 'repeat') => {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'g')
    pattern.lastIndex = from
    const match = pattern.exec(source)
    if (match) insertions.push({ at: match.index + keyword.length, text: ' _sim_tick();' })
  }

  const visit = (node: Node | null | undefined): void => {
    if (!node || typeof node !== 'object') return
    switch (node.type) {
      case 'WhileStatement':
        tickAfter(end(node.condition), 'do')
        break
      case 'ForNumericStatement':
        tickAfter(end(node.step ?? node.end), 'do')
        break
      case 'ForGenericStatement':
        tickAfter(end(node.iterators[node.iterators.length - 1]), 'do')
        break
      case 'RepeatStatement':
        tickAfter(located(node).range?.[0] ?? 0, 'repeat')
        break
    }

    if (node.type === 'IfStatement') {
      for (const clause of node.clauses) markStatements(clause.body)
    } else {
      markStatements((node as WithBody).body)
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((child) => isNode(child) && visit(child))
      else if (isNode(value)) visit(value)
    }
  }

  visit(chunk)

  let code = source
  for (const insertion of insertions.sort((a, b) => b.at - a.at)) {
    code = code.slice(0, insertion.at) + insertion.text + code.slice(insertion.at)
  }
  return { ok: true, code }
}

function isNode(value: unknown): value is Node {
  return !!value && typeof value === 'object' && typeof (value as Node).type === 'string'
}
