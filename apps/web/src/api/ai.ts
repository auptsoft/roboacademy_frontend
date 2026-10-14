import { ApiError, apiFetch, apiHeaders, apiUrl, planErrorCodeOf } from '@/api/client'

export type AIFeature = 'FeedbackDrafts' | 'Authoring' | 'Tutor'

export interface AIFeatureAvailability {
  feature: AIFeature
  available: boolean
  tier: 'Basic' | 'Enhanced' | null
  canUseEnhanced: boolean
  reason: string | null
}

export function getAIAvailability(): Promise<{ features: AIFeatureAvailability[] }> {
  return apiFetch('/api/ai/availability')
}

// --- Tutor ---

export interface TutorConversation {
  id: string
  courseId: string
  lessonId: string | null
  title: string | null
  lastMessageAt: string
}

export interface TutorSource {
  n: number
  lessonId: string
  lessonTitle: string
}

export interface TutorMessage {
  id: string
  role: 'User' | 'Assistant'
  content: string
  // 'hint' while the learner had an assessment open.
  mode: 'normal' | 'hint' | null
  sources: TutorSource[] | null
  incomplete: boolean
  helpful: boolean | null
  createdAt: string
}

export function startTutorConversation(courseId: string, lessonId: string | null): Promise<TutorConversation> {
  return apiFetch('/api/ai/tutor/conversations', { method: 'POST', body: JSON.stringify({ courseId, lessonId }) })
}

export function listTutorConversations(courseId: string): Promise<TutorConversation[]> {
  return apiFetch(`/api/ai/tutor/conversations?courseId=${encodeURIComponent(courseId)}`)
}

export function getTutorMessages(conversationId: string): Promise<TutorMessage[]> {
  return apiFetch(`/api/ai/tutor/conversations/${conversationId}/messages`)
}

export function rateTutorMessage(messageId: string, helpful: boolean): Promise<TutorMessage> {
  return apiFetch(`/api/ai/tutor/messages/${messageId}/feedback`, { method: 'POST', body: JSON.stringify({ helpful }) })
}

export function deleteTutorConversation(conversationId: string): Promise<void> {
  return apiFetch(`/api/ai/tutor/conversations/${conversationId}`, { method: 'DELETE' })
}

export interface TutorStreamHandlers {
  onSources: (sources: TutorSource[]) => void
  onDelta: (text: string) => void
  onDone: (done: { messageId: string; mode: 'normal' | 'hint' }) => void
  onError: (message: string) => void
}

/**
 * Asks the tutor and reads the answer as it streams (Server-Sent Events). EventSource can't send
 * a POST body or an Authorization header, so this reads the fetch body and parses the frames.
 * Refusals (plan, allowance, rate limit) arrive before the stream as normal JSON errors and are
 * thrown as ApiError, worded like every other API error.
 */
export async function askTutor(
  conversationId: string, content: string, lessonId: string | null,
  handlers: TutorStreamHandlers, signal: AbortSignal,
): Promise<void> {
  const response = await fetch(apiUrl(`/api/ai/tutor/conversations/${conversationId}/messages`), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ content, lessonId }),
    signal,
  })

  if (!response.ok || !response.body) {
    const envelope = await response.json().catch(() => null) as { message?: string; data?: unknown } | null
    throw new ApiError(response.status, envelope?.message ?? 'The tutor is unavailable right now.', undefined, planErrorCodeOf(envelope?.data))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      dispatch(buffer.slice(0, boundary), handlers)
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')
    }
  }
}

function dispatch(frame: string, handlers: TutorStreamHandlers): void {
  let name = 'message'
  let data = ''
  for (const line of frame.split('\n')) {
    if (line.startsWith('event: ')) name = line.slice(7)
    else if (line.startsWith('data: ')) data += line.slice(6)
  }
  if (!data) return
  const payload = JSON.parse(data)
  if (name === 'sources') handlers.onSources(payload)
  else if (name === 'delta') handlers.onDelta(payload.text)
  else if (name === 'done') handlers.onDone(payload)
  else if (name === 'error') handlers.onError(payload.message)
}
