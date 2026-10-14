import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Markdown we ship or staff author (help guides), sanitised before it's rendered via v-html.
export function renderRichText(source: string | null | undefined): string {
  if (!source) return ''
  return DOMPurify.sanitize(marked.parse(source, { async: false }))
}
