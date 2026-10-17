import type { ClozeBlock, LabelDiagramBlock, MatchBlock, NumberBlock, OrderBlock, ParsonsBlock } from '@roboacademy/ui'
import { newBlock } from '@/lib/lesson-blocks'

/**
 * The question types shared by Interactive lessons and graded quizzes (the backend's
 * GradedQuestions). In admin they're edited as lesson-block-shaped objects, so the same
 * QuestionFields editor serves lessons, quizzes and the question bank.
 */
export type GradedQuestion = OrderBlock | ClozeBlock | MatchBlock | NumberBlock | ParsonsBlock | LabelDiagramBlock
export type GradedKind = GradedQuestion['type']
export type QuizKind = 'choice' | GradedKind

export const GRADED_KINDS: GradedKind[] = ['order', 'cloze', 'match', 'number', 'parsons', 'label-diagram']

export const QUIZ_KIND_LABELS: Record<QuizKind, string> = {
  choice: 'Multiple choice',
  order: 'Put in order',
  cloze: 'Fill in the blanks',
  match: 'Match the pairs',
  number: 'Number answer',
  parsons: 'Code builder',
  'label-diagram': 'Label the diagram',
}

export function isGradedKind(kind: string): kind is GradedKind {
  return (GRADED_KINDS as string[]).includes(kind)
}

export function newGradedQuestion(kind: GradedKind): GradedQuestion {
  return newBlock(kind) as GradedQuestion
}

/** A question's errors from the server, re-keyed relative to its definition
 * ("Questions[2].Definition.pairs" -> "pairs"). */
export function definitionErrors(errors: Record<string, string[]>, prefix: string): Record<string, string[]> {
  const start = `${prefix}.Definition.`
  return Object.fromEntries(
    Object.entries(errors).filter(([key]) => key.startsWith(start)).map(([key, messages]) => [key.slice(start.length), messages]),
  )
}
