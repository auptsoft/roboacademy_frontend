import type { AuthoredQuestion, QuestionInput } from '@/api/assessment'
import type { GradedQuestion, QuizKind } from './question-kinds'

/** One quiz question as the quiz forms edit it (AssessmentQuestionRow), and its API conversions. */
export interface QuestionRow {
  source: 'bank' | 'inline'
  bankItemId: string
  /** Inline questions: multiple choice uses text/options/correctOptionIndex, other kinds the definition. */
  kind: QuizKind
  text: string
  options: string[]
  correctOptionIndex: number
  definition: GradedQuestion | null
}

export function newQuestionRow(): QuestionRow {
  return { source: 'inline', bankItemId: '', kind: 'choice', text: '', options: ['', ''], correctOptionIndex: 0, definition: null }
}

/** A saved question back into an editable row. Bank questions stay linked to their bank item. */
export function authoredToRow(question: AuthoredQuestion): QuestionRow {
  return {
    source: question.bankItemId ? 'bank' : 'inline',
    bankItemId: question.bankItemId ?? '',
    kind: question.kind ?? 'choice',
    text: question.text,
    options: question.options,
    correctOptionIndex: question.correctOptionIndex,
    definition: question.definition ? JSON.parse(JSON.stringify(question.definition)) : null,
  }
}

export function rowToQuestionInput(row: QuestionRow): QuestionInput {
  if (row.source === 'bank') return { bankItemId: row.bankItemId }
  if (row.kind !== 'choice' && row.definition) return { kind: row.kind, definition: row.definition }
  return { text: row.text, options: row.options, correctOptionIndex: row.correctOptionIndex }
}
