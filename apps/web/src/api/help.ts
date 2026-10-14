import { apiFetch } from '@/api/client'

export interface HelpArticleSummary {
  slug: string
  title: string
  topic: string
  summary: string
}

export interface HelpArticle extends HelpArticleSummary {
  /** App pages the article is about, e.g. "/app/explore" - shown as buttons. */
  links: string[]
  /** Markdown, with the school's name already filled in. */
  body: string
}

/** Articles for this school's plan, in topic order; with `q`, ranked by keyword match. */
export function listHelpArticles(params: { topic?: string; q?: string } = {}): Promise<HelpArticleSummary[]> {
  const query = new URLSearchParams()
  if (params.topic) query.set('topic', params.topic)
  if (params.q?.trim()) query.set('q', params.q.trim())
  const suffix = query.toString() ? `?${query}` : ''
  return apiFetch<HelpArticleSummary[]>(`/api/help/articles${suffix}`)
}

export function getHelpArticle(slug: string): Promise<HelpArticle> {
  return apiFetch<HelpArticle>(`/api/help/articles/${encodeURIComponent(slug)}`)
}
