import { Marked, type Tokens } from 'marked'
import DOMPurify from 'dompurify'

// Renders a staff-assistant reply (model output, so untrusted) as Markdown, more strictly than
// renderRichText: basic formatting tags only (no images, media, forms, styles or event handlers),
// raw HTML shown as text, and a link kept only for an admin app path ("/courses/...") - any other
// address shows as its label. Same approach as the learner app's chat renderer.

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'code', 'pre', 'blockquote', 'hr',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'del',
]
const ALLOWED_ATTR = ['href', 'data-app-link']

/** An admin app path, and no tricks like "/x/../" or "//host". */
export function isAdminPath(href: string): boolean {
  return /^\/[\w\-/?=&.%]*$/.test(href) && !href.startsWith('//') && !href.includes('..')
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    link(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, { href, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens)
      return isAdminPath(href) ? `<a href="${escapeHtml(href)}" data-app-link>${label}</a>` : label
    },
    image: ({ text }: Tokens.Image) => escapeHtml(text),
    html: ({ text }: Tokens.HTML | Tokens.Tag) => escapeHtml(text),
  },
})

const purifier = DOMPurify(window)
purifier.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && !isAdminPath(node.getAttribute('href') ?? '')) {
    node.removeAttribute('href')
    node.removeAttribute('data-app-link')
  }
})

export function renderChatMarkdown(source: string | null | undefined): string {
  if (!source) return ''
  return purifier.sanitize(marked.parse(source, { async: false }), { ALLOWED_TAGS, ALLOWED_ATTR })
}
