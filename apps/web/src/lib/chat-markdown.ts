import { Marked, type TokenizerAndRendererExtension, type Tokens } from 'marked'
import DOMPurify from 'dompurify'

// Renders a tutor or assistant reply (model output, so untrusted) as Markdown. Stricter than
// renderRichText, which is for staff-authored content:
// - only basic formatting tags survive - no images, media, forms, styles or event handlers;
// - a link stays a link only for an app path ("/app/..."); any other address shows as its label;
// - "[n]" becomes a citation chip (data-cite) the tutor panel turns into "open that lesson".
// Its own marked and DOMPurify instances, so none of this leaks into renderRichText.

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'code', 'pre', 'blockquote', 'hr',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'sup', 'del',
]
const ALLOWED_ATTR = ['href', 'data-cite', 'data-app-link']

// Only paths inside the learner app, and no tricks like "/app/../" or "//host".
export function isAppPath(href: string): boolean {
  return /^\/app(\/[\w\-/?=&.%]*)?$/.test(href) && !href.includes('..') && !href.startsWith('//')
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// "[3]" (not a link's "[label](...)") → citation chip.
const citation: TokenizerAndRendererExtension = {
  name: 'citation',
  level: 'inline',
  start: (src) => src.match(/\[\d{1,2}\](?!\()/)?.index,
  tokenizer(src) {
    const match = /^\[(\d{1,2})\](?!\()/.exec(src)
    return match ? { type: 'citation', raw: match[0], n: Number(match[1]) } : undefined
  },
  renderer: (token) => `<sup data-cite="${token.n}">${token.n}</sup>`,
}

const marked = new Marked({
  gfm: true,
  breaks: true,
  extensions: [citation],
  renderer: {
    link(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, { href, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens)
      return isAppPath(href) ? `<a href="${escapeHtml(href)}" data-app-link>${label}</a>` : label
    },
    // Images are never shown; keep the description as text.
    image: ({ text }: Tokens.Image) => escapeHtml(text),
    // Raw HTML in a reply is shown as text, not interpreted.
    html: ({ text }: Tokens.HTML | Tokens.Tag) => escapeHtml(text),
  },
})

const purifier = DOMPurify(window)
// Belt and braces: whatever got through, a link must still be an app path.
purifier.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && !isAppPath(node.getAttribute('href') ?? '')) {
    node.removeAttribute('href')
    node.removeAttribute('data-app-link')
  }
})

export function renderChatMarkdown(source: string | null | undefined): string {
  if (!source) return ''
  return purifier.sanitize(marked.parse(source, { async: false }), { ALLOWED_TAGS, ALLOWED_ATTR })
}
