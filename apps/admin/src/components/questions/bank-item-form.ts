import type { UpsertQuestionBankItemRequest } from '@/api/assessment'
import type { GradedQuestion, QuizKind } from './question-kinds'

/** The question bank's create/edit form, for any question type (see BankItemFields.vue). */
export interface BankItemForm {
  kind: QuizKind
  /** Multiple choice. */
  text: string
  options: string[]
  correctOptionIndex: number
  /** Other kinds. */
  definition: GradedQuestion | null
  tags: string
}

export function emptyBankItemForm(): BankItemForm {
  return { kind: 'choice', text: '', options: ['', ''], correctOptionIndex: 0, definition: null, tags: '' }
}

export function bankItemRequest(form: BankItemForm): UpsertQuestionBankItemRequest {
  const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined
  return form.kind !== 'choice' && form.definition
    ? { kind: form.kind, definition: form.definition, tags }
    : { text: form.text, options: form.options, correctOptionIndex: form.correctOptionIndex, tags }
}
