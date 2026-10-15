/** The languages learners program the simulator in. Matches the backend's ProgramLanguages. */
export type ProgramLanguage = 'blocks' | 'javascript' | 'python'

/** Languages this build of the simulator can run. Python joins in step 2. */
export const SUPPORTED_LANGUAGES: readonly ProgramLanguage[] = ['blocks', 'javascript']

export const LANGUAGE_LABELS: Record<ProgramLanguage, string> = {
  blocks: 'Blocks',
  javascript: 'JavaScript',
  python: 'Python',
}

/** A text-language program as stored with drafts and runs. Block programs are Blockly's JSON. */
export interface SourceProgram {
  source: string
}

export function isSourceProgram(program: unknown): program is SourceProgram {
  return !!program && typeof program === 'object' && typeof (program as SourceProgram).source === 'string'
}

/** Highlight ids for text languages are "L" + line number; block programs use block ids. */
export function lineFromHighlight(id: string | null | undefined): number | null {
  if (!id || !/^L\d+$/.test(id)) return null
  return Number(id.slice(1))
}
