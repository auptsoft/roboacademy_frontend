import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Author-written HTML or Markdown (lesson blocks). marked passes raw HTML through untouched, and
// DOMPurify sanitizes the combined output before it's rendered via v-html.
export function renderRichText(source: string | null | undefined): string {
  if (!source) return ''
  return DOMPurify.sanitize(marked.parse(source, { async: false }))
}
