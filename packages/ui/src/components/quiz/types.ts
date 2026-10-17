/**
 * Quiz questions as a learner taking an assessment receives them: the server strips the answers
 * (GradedQuestions.Redact) and grades the responses itself. Multiple choice keeps its original
 * text/options shape; the other kinds arrive as one of these definitions.
 */
export type QuizQuestionKind = 'choice' | 'order' | 'cloze' | 'match' | 'number' | 'parsons' | 'label-diagram'

export interface QuizOrder { prompt?: string; items: { id: string; text: string }[] }

export interface QuizCloze {
  prompt?: string
  mode: 'text' | 'code'
  input: 'bank' | 'typed'
  segments: ({ text: string } | { blank: number })[]
  /** Word bank: the answers and distractors, shuffled. */
  bank?: string[]
}

export interface QuizMatch { prompt?: string; left: { id: string; text: string }[]; right: { id: string; text: string }[] }

export interface QuizNumber { prompt?: string; unit?: string }

/** Code builder: the program's lines and the distractors, shuffled together. */
export interface QuizParsons { prompt?: string; language: string; lines: { id: string; text: string }[] }

/** Label the diagram: numbered markers at positions (% of the image) and the labels to place. */
export interface QuizLabelDiagram {
  prompt?: string
  alt?: string
  /** Signed, short-lived URLs. */
  image?: string
  imageSmall?: string
  markers: { id: string; x: number; y: number }[]
  labels: { id: string; text: string }[]
}

export type QuizDefinition = QuizOrder | QuizCloze | QuizMatch | QuizNumber | QuizParsons | QuizLabelDiagram

/** What each kind submits: an option index; item ids in order (order, and the code builder's
 * program); one string per blank; the pairs made; a number (as typed, so "0,5" reaches the
 * server's parser); the label placed at each marker. */
export type QuizResponse = number | string[] | { left: string; right: string }[] | { marker: string; label: string }[] | string | null

export function clozeBlankCount(definition: QuizCloze): number {
  return definition.segments.filter(s => 'blank' in s).length
}

/** Whether a question has a full answer (the quiz asks for every question before submitting). */
export function isQuizResponseComplete(kind: QuizQuestionKind, definition: QuizDefinition | null, response: QuizResponse): boolean {
  if (response === null || response === undefined) return false
  switch (kind) {
    case 'choice': return typeof response === 'number'
    case 'order': return Array.isArray(response) && response.length === (definition as QuizOrder).items.length
    case 'cloze': return Array.isArray(response) && response.length === clozeBlankCount(definition as QuizCloze)
      && (response as string[]).every(v => typeof v === 'string' && v.trim().length > 0)
    case 'match': return Array.isArray(response) && response.length === (definition as QuizMatch).left.length
    case 'number': return typeof response === 'string' && response.trim().length > 0
    case 'parsons': return Array.isArray(response) && response.length > 0
    case 'label-diagram': return Array.isArray(response) && response.length === (definition as QuizLabelDiagram).markers.length
  }
}
