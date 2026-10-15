// Interactive lesson content: an ordered list of typed blocks. Stored as versioned JSON so the
// shape can evolve without a migration per block type. Check blocks (choice, order) are
// formative and scored in the browser - graded work stays with assessments and simulations.

export interface InteractiveLessonContent {
  version: 1
  blocks: LessonBlock[]
}

export type LessonBlock = TextBlock | ChoiceBlock | OrderBlock | RevealBlock

interface BlockBase {
  id: string
}

export interface TextBlock extends BlockBase {
  type: 'text'
  /** Markdown or HTML, rendered through renderRichText like lesson context. */
  body: string
}

export interface ChoiceOption {
  id: string
  text: string
  correct?: boolean
  /** Shown once this option has been checked, right or wrong. */
  feedback?: string
}

export interface ChoiceBlock extends BlockBase {
  type: 'choice'
  prompt: string
  options: ChoiceOption[]
  /** Shown once the block is resolved. */
  explanation?: string
  /** Defaults to true. An optional check never holds the learner back. */
  required?: boolean
}

export interface OrderBlock extends BlockBase {
  type: 'order'
  prompt: string
  /** In the correct order; the renderer shuffles them. */
  items: { id: string; text: string }[]
  explanation?: string
  required?: boolean
}

export interface RevealBlock extends BlockBase {
  type: 'reveal'
  prompt?: string
  items: { id: string; label: string; body: string }[]
}

export type CheckBlock = ChoiceBlock | OrderBlock

export interface BlockResult {
  /** False when the learner gave up and was shown the answer. */
  correct: boolean
  attempts: number
}

export function isCheckBlock(block: LessonBlock): block is CheckBlock {
  return block.type === 'choice' || block.type === 'order'
}

export function isRequiredCheck(block: LessonBlock): boolean {
  return isCheckBlock(block) && block.required !== false
}

// Content is authored by staff (and AI drafts), so it is checked before rendering. Unknown
// block types are dropped rather than failing the whole lesson, so an older client still
// shows what it understands of a newer lesson.
export function parseInteractiveContent(raw: unknown): InteractiveLessonContent | null {
  const value = typeof raw === 'string' ? safeJson(raw) : raw
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.blocks)) return null
  const blocks = value.blocks.filter(isValidBlock)
  return blocks.length ? { version: 1, blocks } : null
}

function isValidBlock(block: unknown): block is LessonBlock {
  if (!isObject(block) || typeof block.id !== 'string') return false
  switch (block.type) {
    case 'text':
      return typeof block.body === 'string'
    case 'choice':
      return typeof block.prompt === 'string'
        && Array.isArray(block.options)
        && block.options.length >= 2
        && block.options.some(o => isObject(o) && o.correct === true)
    case 'order':
      return typeof block.prompt === 'string' && Array.isArray(block.items) && block.items.length >= 2
    case 'reveal':
      return Array.isArray(block.items) && block.items.length > 0
    default:
      return false
  }
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
