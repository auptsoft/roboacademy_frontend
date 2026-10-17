import { AppWindow, Blocks, Box, Calculator, CircleHelp, Code, Eye, FileDown, Film, Image, Images, ListOrdered, MapPin, Music, Shuffle, SquareTerminal, TextCursorInput, Type } from 'lucide-vue-next'
import type { LessonBlock } from '@roboacademy/ui'

export type BlockType = LessonBlock['type']

export const BLOCK_TYPES: { type: BlockType; label: string; description: string; icon: typeof Type; group: string }[] = [
  { type: 'text', label: 'Text', description: 'Explanation, in HTML or Markdown.', icon: Type, group: 'Content' },
  { type: 'reveal', label: 'Reveal', description: 'Tap-to-explore cards. Never blocks progress.', icon: Eye, group: 'Content' },
  { type: 'code', label: 'Code snippet', description: 'Highlighted code to study or copy.', icon: Code, group: 'Content' },
  { type: 'choice', label: 'Multiple choice', description: 'A question with one correct answer.', icon: CircleHelp, group: 'Questions' },
  { type: 'order', label: 'Order steps', description: 'Learners put steps in the right order.', icon: ListOrdered, group: 'Questions' },
  { type: 'label-diagram', label: 'Label the diagram', description: 'Learners name the marked parts of an image.', icon: MapPin, group: 'Questions' },
  { type: 'cloze', label: 'Fill in the blanks', description: 'Text or code with gaps: word bank or typed.', icon: TextCursorInput, group: 'Questions' },
  { type: 'match', label: 'Match the pairs', description: 'Learners pair up items from two columns.', icon: Shuffle, group: 'Questions' },
  { type: 'number', label: 'Number answer', description: 'A calculation, right within a margin.', icon: Calculator, group: 'Questions' },
  { type: 'parsons', label: 'Code builder', description: 'Learners assemble a program from its lines.', icon: Blocks, group: 'Questions' },
  { type: 'program', label: 'Coding task', description: 'Learners write code that prints the right output.', icon: SquareTerminal, group: 'Questions' },
  { type: 'image', label: 'Image', description: 'A diagram or photo, with a description.', icon: Image, group: 'Media' },
  { type: 'gallery', label: 'Photo gallery', description: 'Step-by-step photos learners swipe through.', icon: Images, group: 'Media' },
  { type: 'video', label: 'Video', description: 'A short demo, with an optional transcript.', icon: Film, group: 'Media' },
  { type: 'audio', label: 'Audio', description: 'A narrated explanation, with a transcript.', icon: Music, group: 'Media' },
  { type: 'file', label: 'Download', description: 'A datasheet, starter code or worksheet.', icon: FileDown, group: 'Media' },
  { type: 'embed', label: 'Embedded activity', description: 'Wokwi, Tinkercad, YouTube or H5P.', icon: AppWindow, group: 'Media' },
  { type: 'model3d', label: '3D model', description: 'A model learners can turn and zoom (.glb).', icon: Box, group: 'Media' },
]

export function blockTypeMeta(type: BlockType) {
  return BLOCK_TYPES.find(t => t.type === type)!
}

/** Short random id. Block ids are never changed after creation: learner responses are stored
 * against them. Item ids only need to be unique within their block. */
export function newId(): string {
  return crypto.randomUUID().slice(0, 8)
}

/** A label not yet placed on its diagram (fails validation until it is). */
export const UNPLACED = -1

export function newBlock(type: BlockType): LessonBlock {
  const id = newId()
  switch (type) {
    case 'text':
      return { id, type, body: '' }
    case 'choice':
      return { id, type, prompt: '', options: [{ id: newId(), text: '', correct: true }, { id: newId(), text: '' }] }
    case 'order':
      return { id, type, prompt: '', items: [{ id: newId(), text: '' }, { id: newId(), text: '' }] }
    case 'reveal':
      return { id, type, items: [{ id: newId(), label: '', body: '' }] }
    case 'image':
      return { id, type, asset: '', alt: '' }
    case 'video':
      return { id, type, asset: '' }
    case 'audio':
      return { id, type, asset: '', transcript: '' }
    case 'file':
      return { id, type, asset: '', name: '' }
    case 'embed':
      return { id, type, url: '', title: '', aspect: '16:9' }
    case 'gallery':
      return { id, type, images: [] }
    case 'code':
      return { id, type, language: 'cpp', code: '' }
    case 'model3d':
      return { id, type, asset: '', alt: '' }
    case 'program':
      return { id, type, prompt: '', language: 'python', starter: '', expectedOutput: '' }
    case 'cloze':
      return { id, type, text: '', input: 'bank', mode: 'text' }
    case 'match':
      return { id, type, prompt: '', pairs: [{ id: newId(), left: '', right: '' }, { id: newId(), left: '', right: '' }] }
    case 'number':
      return { id, type, prompt: '', answer: 0 }
    case 'parsons':
      return { id, type, prompt: '', language: 'cpp', lines: [] }
    case 'label-diagram':
      return {
        id, type, asset: '', alt: '', prompt: 'Label the parts of the diagram.',
        labels: [
          { id: newId(), text: '', x: UNPLACED, y: UNPLACED },
          { id: newId(), text: '', x: UNPLACED, y: UNPLACED },
        ],
      }
  }
}

/** A copy with a new block id; item ids can stay, since they're scoped to their block. JSON
 * round-trip rather than structuredClone, which can't clone Vue's reactive proxies. Files are
 * shared with the original until one of them is replaced. */
export function duplicateBlock(block: LessonBlock): LessonBlock {
  return { ...JSON.parse(JSON.stringify(block)), id: newId() }
}
