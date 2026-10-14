// Turns a tutor reply into display blocks WITHOUT any HTML: model output is untrusted, so it's
// rendered as text nodes only. Handles paragraphs, "- " bullet lines, **bold**, and [n] citations
// (which become chips that open the cited lesson).

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'cite'; n: number }

export type Block =
  | { kind: 'paragraph'; parts: Inline[] }
  | { kind: 'list'; items: Inline[][] }

const INLINE = /\*\*(.+?)\*\*|\[(\d{1,2})\]/g

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    if (match.index! > last) parts.push({ kind: 'text', text: text.slice(last, match.index) })
    if (match[1] !== undefined) parts.push({ kind: 'bold', text: match[1] })
    else parts.push({ kind: 'cite', n: Number(match[2]) })
    last = match.index! + match[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
  return parts
}

export function formatReply(text: string): Block[] {
  const blocks: Block[] = []
  for (const chunk of text.split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) continue
    if (lines.every((l) => /^[-*•]\s+/.test(l))) {
      blocks.push({ kind: 'list', items: lines.map((l) => parseInline(l.replace(/^[-*•]\s+/, ''))) })
    } else {
      blocks.push({ kind: 'paragraph', parts: parseInline(lines.join(' ')) })
    }
  }
  return blocks
}
