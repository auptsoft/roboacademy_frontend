import { seededShuffle } from '../lesson-blocks/shuffle'
import { parseCloze } from '../lesson-blocks/types'
import type { QuizDefinition, QuizQuestionKind, QuizResponse } from './types'

/**
 * Authoring preview for quiz questions: the question as a learner taking the quiz sees it, built
 * in the browser from the author's draft (no save needed), and a scorer for trying answers out.
 * Mirrors the server's GradedQuestions (Redact and Grade) - same shuffles in spirit, same
 * normalising and partial credit - so "Check" says what the real quiz would award. Ids are the
 * draft's own: nothing here is hidden from the author.
 */
export interface QuizPreview {
  definition: QuizDefinition
  /** 0 to 1, as the server would score this response. */
  grade(response: QuizResponse): number
}

type Item = { id: string; text: string }

// The draft's fields, loosely: they arrive mid-edit, so anything may be missing.
interface Draft {
  id?: string
  prompt?: string
  items?: Item[]
  text?: string
  input?: 'bank' | 'typed'
  mode?: 'text' | 'code'
  distractors?: string[] | Item[]
  pairs?: { id: string; left: string; right: string }[]
  answer?: number
  tolerance?: number
  unit?: string
  language?: string
  lines?: Item[]
  asset?: string
  assetSmall?: string
  alt?: string
  labels?: { id: string; text: string; x: number; y: number }[]
}

export function quizPreview(
  kind: Exclude<QuizQuestionKind, 'choice'>, draft: Draft, imageUrls: Record<string, string> = {},
): QuizPreview {
  const seed = draft.id ?? 'preview'
  const prompt = draft.prompt
  switch (kind) {
    case 'order': {
      const items = draft.items ?? []
      const shuffled = seededShuffle(items, seed)
      if (items.length > 1 && shuffled.every((item, i) => item.id === items[i]!.id)) shuffled.push(shuffled.shift()!)
      return {
        definition: { prompt, items: shuffled },
        grade: r => (sameSequence(r, items.map(i => i.id)) ? 1 : 0),
      }
    }
    case 'cloze': {
      const segments = parseCloze(draft.text ?? '')
      const blanks = segments.flatMap(s => (s.kind === 'blank' ? [s.answers] : []))
      const code = draft.mode === 'code'
      const tiles = [...blanks.map(b => b[0] ?? ''), ...((draft.distractors ?? []) as string[])].filter(Boolean)
      return {
        definition: {
          prompt,
          mode: draft.mode ?? 'text',
          input: draft.input ?? 'typed',
          segments: segments.map(s => (s.kind === 'text' ? { text: s.value } : { blank: s.index })),
          ...(draft.input === 'bank' ? { bank: seededShuffle(tiles, seed) } : {}),
        },
        grade: r => {
          if (!Array.isArray(r) || !blanks.length) return 0
          const right = blanks.filter((answers, i) => typeof r[i] === 'string'
            && answers.some(a => normalise(a, code) === normalise(r[i] as string, code))).length
          return right / blanks.length
        },
      }
    }
    case 'match': {
      const pairs = draft.pairs ?? []
      return {
        definition: {
          prompt,
          left: seededShuffle(pairs, `${seed}-left`).map(p => ({ id: p.id, text: p.left })),
          right: seededShuffle(pairs, `${seed}-right`).map(p => ({ id: p.id, text: p.right })),
        },
        grade: r => {
          if (!Array.isArray(r) || !pairs.length) return 0
          const matched = new Set((r as { left: string; right: string }[]).filter(p => p.left === p.right).map(p => p.left))
          return matched.size / pairs.length
        },
      }
    }
    case 'number':
      return {
        definition: { prompt, unit: draft.unit },
        grade: r => {
          const value = typeof r === 'string' ? Number(r.trim().replace(/\s/g, '').replace(',', '.')) : NaN
          const answer = draft.answer
          if (!Number.isFinite(value) || typeof answer !== 'number') return 0
          return Math.abs(value - answer) <= (draft.tolerance ?? 0) + 1e-9 * Math.max(1, Math.abs(answer)) ? 1 : 0
        },
      }
    case 'parsons': {
      const lines = draft.lines ?? []
      return {
        definition: { prompt, language: draft.language ?? 'text', lines: seededShuffle([...lines, ...((draft.distractors ?? []) as Item[])], seed) },
        grade: r => (sameSequence(r, lines.map(l => l.id)) ? 1 : 0),
      }
    }
    case 'label-diagram': {
      const labels = draft.labels ?? []
      return {
        definition: {
          prompt,
          alt: draft.alt,
          image: draft.asset ? imageUrls[draft.asset] : undefined,
          imageSmall: draft.assetSmall ? imageUrls[draft.assetSmall] : undefined,
          markers: seededShuffle(labels, `${seed}-markers`).map(l => ({ id: l.id, x: l.x, y: l.y })),
          labels: [...labels].sort((a, b) => a.text.localeCompare(b.text)).map(l => ({ id: l.id, text: l.text })),
        },
        grade: r => {
          if (!Array.isArray(r) || !labels.length) return 0
          const placed = new Set((r as { marker: string; label: string }[]).filter(p => p.marker === p.label).map(p => p.marker))
          return placed.size / labels.length
        },
      }
    }
  }
}

function sameSequence(response: QuizResponse, expected: string[]): boolean {
  return Array.isArray(response) && response.length === expected.length && response.every((id, i) => id === expected[i])
}

/** Text: case and runs of spaces don't matter. Code: spaces don't matter. (As the server.) */
function normalise(value: string, code: boolean): string {
  return code ? value.replace(/\s+/g, '') : value.trim().replace(/\s+/g, ' ').toLowerCase()
}
