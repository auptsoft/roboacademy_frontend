import type { Component } from 'vue'

// Interactive lesson content: an ordered list of typed blocks. Stored as versioned JSON so the
// shape can evolve without a migration per block type. Check blocks (choice, order,
// label-diagram) are formative and scored in the browser - graded work stays with assessments
// and simulations. Media blocks refer to files by R2 key; the player is handed fresh URLs.

export interface InteractiveLessonContent {
  version: 1
  blocks: LessonBlock[]
  /**
   * 'cards': one block (or group, see keepWithNext) per screen, Duolingo-style, ending with a
   * finish card. 'scroll': one page that grows as each required question is answered. Missing
   * means 'scroll', which is how every lesson worked before cards existed.
   */
  display?: LessonDisplay
}

export type LessonDisplay = 'cards' | 'scroll'

export type LessonBlock =
  | TextBlock | ChoiceBlock | OrderBlock | RevealBlock
  | ImageBlock | VideoBlock | AudioBlock | FileBlock | EmbedBlock | LabelDiagramBlock
  | GalleryBlock | CodeBlock | Model3dBlock | ProgramBlock
  | ClozeBlock | MatchBlock | NumberBlock | ParsonsBlock

interface BlockBase {
  id: string
  /** Cards display: show this block on the same card as the next one (e.g. a diagram and its question). */
  keepWithNext?: boolean
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

/** An R2 object key under lessons/{lessonId}/assets/. Never a URL: those expire. */
export type AssetKey = string

export interface ImageBlock extends BlockBase {
  type: 'image'
  asset: AssetKey
  /** A smaller copy (about 800px wide) for phones; made by the editor when it uploads. */
  assetSmall?: AssetKey
  /** Required: what the image shows, for screen readers and the AI tutor. */
  alt: string
  caption?: string
}

export interface VideoBlock extends BlockBase {
  type: 'video'
  asset: AssetKey
  poster?: AssetKey
  caption?: string
  transcript?: string
}

export interface AudioBlock extends BlockBase {
  type: 'audio'
  asset: AssetKey
  caption?: string
  /** Required, for learners who can't listen - and it's what the tutor reads. */
  transcript: string
}

export interface FileBlock extends BlockBase {
  type: 'file'
  asset: AssetKey
  name: string
  description?: string
}

export interface EmbedBlock extends BlockBase {
  type: 'embed'
  /** https on an allowed host: see isAllowedEmbed. */
  url: string
  title: string
  aspect?: '16:9' | '4:3' | '1:1'
}

export interface DiagramLabel {
  id: string
  text: string
  /** Where on the image the label belongs, as % of its width and height. */
  x: number
  y: number
}

export interface LabelDiagramBlock extends BlockBase {
  type: 'label-diagram'
  asset: AssetKey
  assetSmall?: AssetKey
  alt: string
  prompt: string
  labels: DiagramLabel[]
  explanation?: string
  required?: boolean
}

export interface GalleryImage {
  id: string
  asset: AssetKey
  assetSmall?: AssetKey
  alt: string
  caption?: string
}

/** Step-by-step photos learners swipe through. */
export interface GalleryBlock extends BlockBase {
  type: 'gallery'
  images: GalleryImage[]
}

export type CodeLanguage = 'cpp' | 'python' | 'javascript' | 'lua' | 'text'

/** Read-only code to study or copy (e.g. an Arduino sketch). Nothing runs. */
export interface CodeBlock extends BlockBase {
  type: 'code'
  language: CodeLanguage
  code: string
  caption?: string
}

/** A rotatable 3D model (.glb). Loads only when the learner asks to view it. */
export interface Model3dBlock extends BlockBase {
  type: 'model3d'
  asset: AssetKey
  alt: string
  caption?: string
}

/** 'blocks' is Blockly, with logic, loops, maths, text and variables (no robot). */
export type LessonProgramLanguage = 'blocks' | 'javascript' | 'python' | 'lua'

/** A coding check: the learner's program must print expectedOutput. Runs in the browser. */
export interface ProgramBlock extends BlockBase {
  type: 'program'
  prompt: string
  language: LessonProgramLanguage
  /** Text languages only; a Blocks task starts with an empty workspace. */
  starter?: string
  /** Compared line by line, ignoring trailing spaces and blank lines at the end. */
  expectedOutput: string
  /** Text languages: shown when the learner asks for the answer. */
  solution?: string
  explanation?: string
  required?: boolean
}

/**
 * Fill in the blanks. `text` marks each blank inline as [[answer]], with any other accepted
 * answers after a bar: [[amps|amperes]]. Text mode ignores case and extra spaces; code mode
 * ignores spaces only.
 */
export interface ClozeBlock extends BlockBase {
  type: 'cloze'
  prompt?: string
  text: string
  /** 'bank': learners tap tiles (the answers plus distractors). 'typed': they type each blank. */
  input: 'bank' | 'typed'
  mode: 'text' | 'code'
  /** Extra wrong tiles for the word bank. */
  distractors?: string[]
  explanation?: string
  required?: boolean
}

/** Match each left item to its right item. Both columns are shuffled for learners. */
export interface MatchBlock extends BlockBase {
  type: 'match'
  prompt: string
  pairs: { id: string; left: string; right: string }[]
  explanation?: string
  required?: boolean
}

/** A calculated answer, right within ± tolerance. */
export interface NumberBlock extends BlockBase {
  type: 'number'
  prompt: string
  answer: number
  tolerance?: number
  unit?: string
  explanation?: string
  required?: boolean
}

/** Build a program from its lines (a Parsons problem). `lines` are in the correct order. */
export interface ParsonsBlock extends BlockBase {
  type: 'parsons'
  prompt: string
  language: CodeLanguage
  lines: { id: string; text: string }[]
  /** Lines that don't belong, mixed into the pool. */
  distractors?: { id: string; text: string }[]
  explanation?: string
  required?: boolean
}

export type ClozeSegment = { kind: 'text'; value: string } | { kind: 'blank'; index: number; answers: string[] }

/** Splits cloze text into plain text and blanks (each with its accepted answers). */
export function parseCloze(text: string): ClozeSegment[] {
  const segments: ClozeSegment[] = []
  const pattern = /\[\[([^\[\]]*)\]\]/g
  let last = 0
  let index = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index! > last) segments.push({ kind: 'text', value: text.slice(last, match.index) })
    const answers = match[1]!.split('|').map(a => a.trim()).filter(Boolean)
    segments.push({ kind: 'blank', index: index++, answers })
    last = match.index! + match[0].length
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) })
  return segments
}

export type CheckBlock =
  | ChoiceBlock | OrderBlock | LabelDiagramBlock | ProgramBlock
  | ClozeBlock | MatchBlock | NumberBlock | ParsonsBlock

const CHECK_TYPES = new Set<LessonBlock['type']>(['choice', 'order', 'label-diagram', 'program', 'cloze', 'match', 'number', 'parsons'])

/** Normalises printed output for comparison: trailing spaces per line, and blank lines at the end. */
export function normaliseOutput(output: string): string {
  return output.replace(/\r\n/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').replace(/\n+$/, '')
}

/** Block properties that hold an asset key. */
const ASSET_PROPERTIES = ['asset', 'assetSmall', 'poster'] as const

/** Cards display: the blocks grouped into cards, joining each block marked keepWithNext to the next. */
export function lessonCards(blocks: readonly LessonBlock[]): LessonBlock[][] {
  const cards: LessonBlock[][] = []
  let joinNext = false
  for (const block of blocks) {
    if (joinNext && cards.length) cards.at(-1)!.push(block)
    else cards.push([block])
    joinNext = block.keepWithNext === true
  }
  return cards
}

/** Every asset key the content uses - what the player asks the API to sign. */
export function assetKeys(content: InteractiveLessonContent): AssetKey[] {
  const keys = new Set<AssetKey>()
  const collect = (item: object) => {
    for (const property of ASSET_PROPERTIES) {
      const key = (item as Record<string, unknown>)[property]
      if (typeof key === 'string' && key) keys.add(key)
    }
  }
  for (const block of content.blocks) {
    collect(block)
    if (block.type === 'gallery') block.images.forEach(collect)
  }
  return [...keys]
}

// Mirrors the backend's InteractiveContent.IsAllowedEmbed.
const EMBED_HOSTS = ['wokwi.com', 'www.wokwi.com', 'www.tinkercad.com', 'tinkercad.com',
  'www.youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com', 'h5p.org']

export function isAllowedEmbed(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && (EMBED_HOSTS.includes(hostname.toLowerCase()) || hostname.toLowerCase().endsWith('.h5p.com'))
  } catch {
    return false
  }
}

/** Turns the links people copy (a YouTube watch or youtu.be link) into an embeddable URL. */
export function toEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.replace(/^www\./, '')
    const youtubeId = host === 'youtu.be' ? parsed.pathname.slice(1)
      : host === 'youtube.com' && parsed.pathname === '/watch' ? parsed.searchParams.get('v')
      : null
    if (youtubeId) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`
    return parsed.toString()
  } catch {
    return url.trim()
  }
}

export interface BlockResult {
  /** False when the learner gave up and was shown the answer. */
  correct: boolean
  attempts: number
  /** Block-specific detail, stored with the response. Choice blocks: the options tried, in order.
   * Program blocks: the learner's code (trimmed to a few KB). */
  answer?: { picks: string[] } | { source: string } | { values: number[] } | { filled: string[] } | null
}

export function isCheckBlock(block: LessonBlock): block is CheckBlock {
  return CHECK_TYPES.has(block.type)
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
  const display = value.display === 'cards' || value.display === 'scroll' ? value.display : undefined
  return blocks.length ? { version: 1, blocks, ...(display ? { display } : {}) } : null
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
    case 'image':
    case 'video':
    case 'audio':
    case 'file':
      return typeof block.asset === 'string' && block.asset.length > 0
    case 'embed':
      return typeof block.url === 'string' && isAllowedEmbed(block.url)
    case 'label-diagram':
      return typeof block.asset === 'string' && Array.isArray(block.labels) && block.labels.length >= 2
    case 'gallery':
      return Array.isArray(block.images) && block.images.some(i => isObject(i) && typeof i.asset === 'string' && i.asset)
    case 'code':
      return typeof block.code === 'string' && typeof block.language === 'string'
    case 'model3d':
      return typeof block.asset === 'string' && block.asset.length > 0
    case 'program':
      return typeof block.prompt === 'string' && ['blocks', 'javascript', 'python', 'lua'].includes(block.language)
        && typeof block.expectedOutput === 'string' && block.expectedOutput.trim().length > 0
    case 'cloze':
      return typeof block.text === 'string' && parseCloze(block.text).some(s => s.kind === 'blank' && s.answers.length > 0)
    case 'match':
      return typeof block.prompt === 'string' && Array.isArray(block.pairs) && block.pairs.length >= 2
    case 'number':
      return typeof block.prompt === 'string' && typeof block.answer === 'number' && Number.isFinite(block.answer)
    case 'parsons':
      return typeof block.prompt === 'string' && Array.isArray(block.lines) && block.lines.length >= 2
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

/**
 * Authoring-time checks, mirroring the backend's InteractiveContent.Validate so the editor can
 * flag problems before saving. Keys match the server's (minus its "Content." prefix), e.g.
 * "blocks[2].options", so client and server errors land on the same block.
 */
export function validateInteractiveContent(content: InteractiveLessonContent): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  const add = (path: string, message: string) => (errors[path] ??= []).push(message)
  const blank = (value: string | undefined) => !value?.trim()

  if (!content.blocks.length) add('blocks', 'Add at least one block.')

  const ids = new Set<string>()
  content.blocks.forEach((block, i) => {
    const path = `blocks[${i}]`
    if (blank(block.id)) add(`${path}.id`, 'Each block needs an id.')
    else if (ids.has(block.id)) add(`${path}.id`, `Block id '${block.id}' is used more than once.`)
    ids.add(block.id)

    switch (block.type) {
      case 'text':
        if (blank(block.body)) add(`${path}.body`, 'Text blocks need some text.')
        break
      case 'choice':
        if (blank(block.prompt)) add(`${path}.prompt`, 'Add a question.')
        if (block.options.length < 2) add(`${path}.options`, 'Add at least 2 options.')
        else if (block.options.filter(o => o.correct).length !== 1) add(`${path}.options`, 'Mark exactly one option as correct.')
        block.options.forEach((o, j) => blank(o.text) && add(`${path}.options[${j}].text`, "This can't be empty."))
        break
      case 'order':
        if (blank(block.prompt)) add(`${path}.prompt`, 'Add an instruction.')
        if (block.items.length < 2) add(`${path}.items`, 'Add at least 2 steps.')
        block.items.forEach((item, j) => blank(item.text) && add(`${path}.items[${j}].text`, "This can't be empty."))
        break
      case 'reveal':
        if (!block.items.length) add(`${path}.items`, 'Add at least 1 item.')
        block.items.forEach((item, j) => {
          if (blank(item.label)) add(`${path}.items[${j}].label`, "This can't be empty.")
          if (blank(item.body)) add(`${path}.items[${j}].body`, "This can't be empty.")
        })
        break
      case 'image':
        if (blank(block.asset)) add(`${path}.asset`, 'Upload an image.')
        if (blank(block.alt)) add(`${path}.alt`, "Describe the image for learners who can't see it.")
        break
      case 'video':
        if (blank(block.asset)) add(`${path}.asset`, 'Upload a video.')
        break
      case 'audio':
        if (blank(block.asset)) add(`${path}.asset`, 'Upload an audio file.')
        if (blank(block.transcript)) add(`${path}.transcript`, "Add a transcript for learners who can't listen.")
        break
      case 'file':
        if (blank(block.asset)) add(`${path}.asset`, 'Upload a file.')
        if (blank(block.name)) add(`${path}.name`, 'Give the file a name.')
        break
      case 'embed':
        if (!isAllowedEmbed(block.url)) add(`${path}.url`, 'Use a Wokwi, Tinkercad, YouTube or H5P link.')
        if (blank(block.title)) add(`${path}.title`, 'Give the activity a title.')
        break
      case 'gallery':
        if (!block.images.length) add(`${path}.images`, 'Add at least 1 photo.')
        block.images.forEach((image, j) => {
          if (blank(image.asset)) add(`${path}.images[${j}].asset`, 'Upload a photo.')
          if (blank(image.alt)) add(`${path}.images[${j}].alt`, "Describe the photo for learners who can't see it.")
        })
        break
      case 'code':
        if (blank(block.code)) add(`${path}.code`, 'Add some code.')
        break
      case 'model3d':
        if (blank(block.asset)) add(`${path}.asset`, 'Upload a 3D model (.glb).')
        if (blank(block.alt)) add(`${path}.alt`, "Describe the model for learners who can't see it.")
        break
      case 'cloze': {
        const blanks = parseCloze(block.text).filter(s => s.kind === 'blank')
        if (!blanks.length) add(`${path}.text`, 'Mark at least one blank, like [[answer]].')
        else if (blanks.some(b => b.kind === 'blank' && !b.answers.length)) add(`${path}.text`, 'Every blank needs an answer inside the brackets.')
        break
      }
      case 'match':
        if (blank(block.prompt)) add(`${path}.prompt`, 'Add an instruction.')
        if (block.pairs.length < 2) add(`${path}.pairs`, 'Add at least 2 pairs.')
        block.pairs.forEach((pair, j) => {
          if (blank(pair.left)) add(`${path}.pairs[${j}].left`, "This can't be empty.")
          if (blank(pair.right)) add(`${path}.pairs[${j}].right`, "This can't be empty.")
        })
        break
      case 'number':
        if (blank(block.prompt)) add(`${path}.prompt`, 'Add a question.')
        if (typeof block.answer !== 'number' || !Number.isFinite(block.answer)) add(`${path}.answer`, 'Add the correct answer as a number.')
        if (block.tolerance !== undefined && !(block.tolerance >= 0)) add(`${path}.tolerance`, 'The margin must be zero or more.')
        break
      case 'parsons':
        if (blank(block.prompt)) add(`${path}.prompt`, 'Describe what the program should do.')
        if (block.lines.length < 2) add(`${path}.lines`, 'Add at least 2 lines.')
        block.lines.forEach((line, j) => blank(line.text) && add(`${path}.lines[${j}].text`, "This can't be empty."))
        ;(block.distractors ?? []).forEach((line, j) => blank(line.text) && add(`${path}.distractors[${j}].text`, "This can't be empty."))
        break
      case 'program':
        if (blank(block.prompt)) add(`${path}.prompt`, 'Describe the task.')
        if (blank(block.expectedOutput)) add(`${path}.expectedOutput`, 'Add the output a correct program prints.')
        break
      case 'label-diagram':
        if (blank(block.asset)) add(`${path}.asset`, 'Upload the diagram.')
        if (blank(block.alt)) add(`${path}.alt`, "Describe the diagram for learners who can't see it.")
        if (blank(block.prompt)) add(`${path}.prompt`, 'Add an instruction.')
        if (block.labels.length < 2) add(`${path}.labels`, 'Add at least 2 labels.')
        block.labels.forEach((label, j) => {
          if (blank(label.text)) add(`${path}.labels[${j}].text`, "This can't be empty.")
          const placed = [label.x, label.y].every(v => typeof v === 'number' && v >= 0 && v <= 100)
          if (!placed) add(`${path}.labels[${j}]`, 'Place this label on the diagram.')
        })
        break
    }
  })
  return errors
}

/**
 * Renderers for blocks whose players need heavy libraries this package doesn't carry (CodeMirror,
 * Three.js, the program runtimes). Apps pass them in, lazily loaded, from @roboacademy/sim/lesson.
 * Each takes `block` (and, for program, `result` and a `resolved` event, like the check blocks).
 */
export type LessonBlockRenderers = Partial<Record<'code' | 'model3d' | 'program', Component>>
