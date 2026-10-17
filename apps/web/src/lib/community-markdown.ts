import { Marked, type Tokens } from 'marked'
import DOMPurify from 'dompurify'
import { isAppPath } from '@/lib/chat-markdown'

// Renders a community post or reply. Learners write these, so they're untrusted, like model output:
// - basic formatting only - no images, media, forms, styles or event handlers;
// - raw HTML is shown as text;
// - app paths stay in-app links; other web links open in a new tab, marked nofollow. (The server
//   already refuses links from learners in classes that don't allow them.)
// Its own marked and DOMPurify instances, so none of this leaks into the other renderers.

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'code', 'pre', 'blockquote', 'hr',
  'ul', 'ol', 'li', 'h3', 'h4', 'a', 'del',
]
const ALLOWED_ATTR = ['href', 'target', 'rel', 'data-app-link']

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const isWebLink = (href: string) => /^https?:\/\/[^\s"]+$/i.test(href)

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    link(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, { href, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens)
      if (isAppPath(href)) return `<a href="${escapeHtml(href)}" data-app-link>${label}</a>`
      if (isWebLink(href)) return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`
      return label
    },
    image: ({ text }: Tokens.Image) => escapeHtml(text),
    html: ({ text }: Tokens.HTML | Tokens.Tag) => escapeHtml(text),
    // Headings shrink to h3/h4 so a post can't shout over the page.
    heading(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, { tokens, depth }: Tokens.Heading) {
      const tag = depth <= 2 ? 'h3' : 'h4'
      return `<${tag}>${this.parser.parseInline(tokens)}</${tag}>`
    },
  },
})

const purifier = DOMPurify(window)
purifier.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A') return
  const href = node.getAttribute('href') ?? ''
  if (isAppPath(href)) return
  if (isWebLink(href)) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
    return
  }
  node.removeAttribute('href')
})

export function renderCommunityMarkdown(source: string | null | undefined): string {
  if (!source) return ''
  return purifier.sanitize(marked.parse(source, { async: false }), { ALLOWED_TAGS, ALLOWED_ATTR })
}
