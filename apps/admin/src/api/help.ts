import { apiFetch } from '@/api/client'

export interface HelpArticleSummary {
  slug: string
  title: string
  topic: string
  summary: string
}

export interface HelpArticle extends HelpArticleSummary {
  /** Admin app pages the guide is about, e.g. "/assessment/grading" - shown as buttons. */
  links: string[]
  /** Markdown, with the school's name already filled in. */
  body: string
}

/** Staff guides the signed-in person may see (their permissions and the school's plan), plus
 * platform guides for platform admins; with `q`, ranked by keyword match. */
export function listHelpArticles(params: { topic?: string; q?: string } = {}): Promise<HelpArticleSummary[]> {
  const query = new URLSearchParams({ audience: 'staff' })
  if (params.topic) query.set('topic', params.topic)
  if (params.q?.trim()) query.set('q', params.q.trim())
  return apiFetch<HelpArticleSummary[]>(`/api/help/articles?${query}`)
}

export function getHelpArticle(slug: string): Promise<HelpArticle> {
  return apiFetch<HelpArticle>(`/api/help/articles/${encodeURIComponent(slug)}`)
}
