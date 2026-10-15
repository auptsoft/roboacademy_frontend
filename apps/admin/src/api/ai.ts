import { apiErrorFrom, apiFetch, apiHeaders, apiUrl } from '@/api/client'

// --- Availability (any signed-in user) ---

export type AIFeature = 'FeedbackDrafts' | 'Authoring' | 'Tutor' | 'Assistant' | 'StaffAssistant' | 'SimHints'
export type AITier = 'Basic' | 'Enhanced'

export interface AIFeatureAvailability {
  feature: AIFeature
  available: boolean
  tier: AITier | null
  // An explicit Enhanced request ("Try a better draft") would be allowed right now.
  canUseEnhanced: boolean
  // SubscriptionLocked | NotInPlan | Disabled | LimitReached | FeatureCapReached | NoModel
  reason: string | null
}

export function getAIAvailability(): Promise<{ features: AIFeatureAvailability[] }> {
  return apiFetch('/api/ai/availability')
}

// --- School AI settings and usage (ai:settings:manage, own tenant) ---

export interface AIFeatureSetting {
  feature: AIFeature
  label: string
  includedInPlan: boolean
  tier: AITier
  enabledBySchool: boolean
  capPercent: number | null
}

export interface AISettings {
  enabled: boolean
  currentTermsVersion: string
  termsText: string
  termsAccepted: boolean
  termsAcceptedAt: string | null
  termsAcceptedByUserId: string | null
  features: AIFeatureSetting[]
}

export interface AISettingsUpdate {
  enabled: boolean
  features: { feature: AIFeature; enabled: boolean; capPercent: number | null }[]
}

export interface AIUsesLeft {
  feature: AIFeature
  label: string
  estimate: number
}

export interface AIFeatureShare {
  feature: AIFeature
  label: string
  tokens: number
  capPercent: number | null
}

export interface AITierUsage {
  tier: AITier
  // Null: the plan sets no limit for this tier.
  limit: number | null
  used: number
  percent: number | null
  usesLeft: AIUsesLeft[]
  features: AIFeatureShare[]
}

export interface AIUsage {
  month: string
  isCurrentMonth: boolean
  tiers: AITierUsage[]
  tierFallbacks: number
}

const school = '/api/admin/ai'

export function getAISettings(): Promise<AISettings> {
  return apiFetch(`${school}/settings`)
}

export function updateAISettings(request: AISettingsUpdate): Promise<AISettings> {
  return apiFetch(`${school}/settings`, { method: 'PUT', body: JSON.stringify(request) })
}

export function acceptAITerms(termsVersion: string): Promise<AISettings> {
  return apiFetch(`${school}/settings/accept-terms`, { method: 'POST', body: JSON.stringify({ termsVersion }) })
}

export function getAIUsage(month?: string): Promise<AIUsage> {
  return apiFetch(`${school}/usage${month ? `?month=${encodeURIComponent(month)}` : ''}`)
}

// --- Feedback drafts (assessment:assessments:author) ---

export type AIFeedbackDraftStatus = 'Pending' | 'Ready' | 'Failed' | 'Skipped'

export interface AIFeedbackDraft {
  attemptId: string
  status: AIFeedbackDraftStatus
  failureReason: string | null
  suggestedPassed: boolean | null
  suggestedScore: number | null
  feedback: string | null
  // For the grader only - never shown to the learner.
  rationale: string | null
  tier: AITier | null
  enhancedRequest: boolean
  usedAt: string | null
  updatedAt: string
}

export function getFeedbackDraftStatuses(attemptIds: string[]): Promise<{ attemptId: string; status: AIFeedbackDraftStatus }[]> {
  return apiFetch(`${school}/feedback-drafts?attemptIds=${attemptIds.join(',')}`)
}

export function getFeedbackDraft(attemptId: string): Promise<AIFeedbackDraft> {
  return apiFetch(`${school}/feedback-drafts/${attemptId}`)
}

// tier 'Enhanced' is "Try a better draft": Enhanced only, never falls back.
export function regenerateFeedbackDraft(attemptId: string, tier?: AITier): Promise<AIFeedbackDraft> {
  return apiFetch(`${school}/feedback-drafts/${attemptId}/regenerate`, {
    method: 'POST',
    body: JSON.stringify(tier ? { tier } : {}),
  })
}

export function markFeedbackDraftUsed(attemptId: string): Promise<AIFeedbackDraft> {
  return apiFetch(`${school}/feedback-drafts/${attemptId}/used`, { method: 'POST' })
}

// --- Authoring help (drafts only; nothing is saved) ---

export type QuizDifficulty = 'Mixed' | 'Easy' | 'Medium' | 'Hard'
export type CopyTone = 'Friendly' | 'Formal'

export interface AIQuizCandidate {
  text: string
  options: string[]
  correctOptionIndex: number
  // For the author only: why the answer is right.
  explanation: string
  sourceLessonId: string
  suggestedTags: string[]
}

export function draftQuizQuestions(request: {
  lessonIds: string[]
  count: number
  difficulty: QuizDifficulty
  tier?: AITier
}): Promise<{ candidates: AIQuizCandidate[]; dropped: number; tier: AITier }> {
  return apiFetch(`${school}/authoring/quiz-questions`, { method: 'POST', body: JSON.stringify(request) })
}

export function draftCourseCopy(courseId: string, tone: CopyTone, tier?: AITier): Promise<{ description: string; longDescription: string; tier: AITier }> {
  return apiFetch(`${school}/authoring/course-copy`, { method: 'POST', body: JSON.stringify({ courseId, tone, tier }) })
}

export function draftLessonSummary(lessonId: string, tier?: AITier): Promise<{ summary: string; keyPoints: string[]; tier: AITier }> {
  return apiFetch(`${school}/authoring/lesson-summary`, { method: 'POST', body: JSON.stringify({ lessonId, tier }) })
}

// --- Tutor index (ai:settings:manage) ---

export interface TutorIndexStatus {
  embeddingModelConfigured: boolean
  courses: { courseId: string; title: string; lessonsWithNotes: number; lessonsIndexed: number }[]
}

export function getTutorIndexStatus(): Promise<TutorIndexStatus> {
  return apiFetch(`${school}/tutor-index`)
}

export function rebuildTutorIndex(): Promise<void> {
  return apiFetch(`${school}/tutor-index/rebuild`, { method: 'POST' })
}

// --- Platform model registry (ai:models:manage) ---

export type AIProviderStatus = 'Active' | 'Disabled'
export type AIModelKind = 'Chat' | 'Embedding'
export type AIModelStatus = 'Draft' | 'Verified' | 'Failed' | 'Retired'
export type AITierSlot = 'Basic' | 'Enhanced' | 'Embedding'

export interface AIProvider {
  id: string
  name: string
  type: string
  endpoint: string
  status: AIProviderStatus
  hasApiKey: boolean
  createdAt: string
  updatedAt: string
}

export interface AIModelCheck {
  name: string
  passed: boolean
  error: string | null
}

export interface AIModel {
  id: string
  providerId: string
  providerName: string
  modelId: string
  kind: AIModelKind
  displayName: string
  supportsStructuredOutput: boolean
  supportsTools: boolean
  supportsStreaming: boolean
  embeddingDimensions: number | null
  inputPricePerMillion: number | null
  outputPricePerMillion: number | null
  status: AIModelStatus
  lastCheckedAt: string | null
  lastCheckResult: { checks?: AIModelCheck[] } | null
}

export interface AIModelRef {
  id: string
  displayName: string
  modelId: string
  status: AIModelStatus
  inputPricePerMillion: number | null
  outputPricePerMillion: number | null
}

export interface AITierAssignment {
  slot: AITierSlot
  primary: AIModelRef | null
  fallback: AIModelRef | null
  previous: AIModelRef | null
  candidate: AIModelRef | null
  candidateTenantIds: string[]
  updatedAt: string | null
}

export interface AIHealthCheckResult {
  tier: AITier
  ok: boolean
  modelId: string | null
  usedFallbackModel: boolean
  error: string | null
}

const platform = '/api/admin/ai/platform'

export function listAIProviders(): Promise<AIProvider[]> {
  return apiFetch(`${platform}/providers`)
}

export function createAIProvider(request: { name: string; endpoint: string; apiKey: string }): Promise<AIProvider> {
  return apiFetch(`${platform}/providers`, { method: 'POST', body: JSON.stringify(request) })
}

// apiKey: null keeps the stored key.
export function updateAIProvider(
  providerId: string,
  request: { name: string; endpoint: string; status: AIProviderStatus; apiKey: string | null },
): Promise<AIProvider> {
  return apiFetch(`${platform}/providers/${providerId}`, { method: 'PUT', body: JSON.stringify(request) })
}

export function listAIModels(): Promise<AIModel[]> {
  return apiFetch(`${platform}/models`)
}

export function createAIModel(request: {
  providerId: string
  modelId: string
  kind: AIModelKind
  displayName: string
  inputPricePerMillion: number | null
  outputPricePerMillion: number | null
}): Promise<AIModel> {
  return apiFetch(`${platform}/models`, { method: 'POST', body: JSON.stringify(request) })
}

// Display name and list prices only: model ID, provider and kind identify the model - add a new
// one to change those.
export function updateAIModel(
  modelId: string,
  request: { displayName: string; inputPricePerMillion: number | null; outputPricePerMillion: number | null },
): Promise<AIModel> {
  return apiFetch(`${platform}/models/${modelId}`, { method: 'PUT', body: JSON.stringify(request) })
}

// Refused (409) while any tier still points at the model, including as its rollback target.
export function deleteAIModel(modelId: string): Promise<void> {
  return apiFetch(`${platform}/models/${modelId}`, { method: 'DELETE' })
}

export function checkAIModel(modelId: string): Promise<AIModel> {
  return apiFetch(`${platform}/models/${modelId}/check`, { method: 'POST' })
}

export function retireAIModel(modelId: string): Promise<AIModel> {
  return apiFetch(`${platform}/models/${modelId}/retire`, { method: 'POST' })
}

export function listAITiers(): Promise<AITierAssignment[]> {
  return apiFetch(`${platform}/tiers`)
}

export function setAITierPrimary(slot: AITierSlot, primaryModelId: string, fallbackModelId: string | null): Promise<AITierAssignment> {
  return apiFetch(`${platform}/tiers/${slot}`, { method: 'PUT', body: JSON.stringify({ primaryModelId, fallbackModelId }) })
}

export function startAITierTrial(slot: AITierSlot, modelId: string, tenantIds: string[]): Promise<AITierAssignment> {
  return apiFetch(`${platform}/tiers/${slot}/candidate`, { method: 'PUT', body: JSON.stringify({ modelId, tenantIds }) })
}

export function endAITierTrial(slot: AITierSlot): Promise<AITierAssignment> {
  return apiFetch(`${platform}/tiers/${slot}/candidate`, { method: 'DELETE' })
}

export function promoteAITierCandidate(slot: AITierSlot): Promise<AITierAssignment> {
  return apiFetch(`${platform}/tiers/${slot}/promote`, { method: 'POST' })
}

export function rollbackAITier(slot: AITierSlot): Promise<AITierAssignment> {
  return apiFetch(`${platform}/tiers/${slot}/rollback`, { method: 'POST' })
}

export function runAIHealthCheck(): Promise<AIHealthCheckResult[]> {
  return apiFetch(`${platform}/health-check`, { method: 'POST' })
}

// --- Staff assistant (AI phase 6) ---

export interface StaffAssistantConversation {
  id: string
  title: string | null
  lastMessageAt: string
}

export interface StaffAssistantMessage {
  id: string
  role: 'User' | 'Assistant'
  content: string
  /** For replies: the tools it used. */
  sources: string[] | null
  incomplete: boolean
  helpful: boolean | null
  createdAt: string
}

export function startStaffAssistantConversation(): Promise<StaffAssistantConversation> {
  return apiFetch('/api/ai/staff-assistant/conversations', { method: 'POST', body: JSON.stringify({}) })
}

export function listStaffAssistantConversations(): Promise<StaffAssistantConversation[]> {
  return apiFetch('/api/ai/staff-assistant/conversations')
}

export function getStaffAssistantMessages(conversationId: string): Promise<StaffAssistantMessage[]> {
  return apiFetch(`/api/ai/staff-assistant/conversations/${conversationId}/messages`)
}

export function rateStaffAssistantMessage(messageId: string, helpful: boolean): Promise<StaffAssistantMessage> {
  return apiFetch(`/api/ai/staff-assistant/messages/${messageId}/feedback`, { method: 'POST', body: JSON.stringify({ helpful }) })
}

export function deleteStaffAssistantConversation(conversationId: string): Promise<void> {
  return apiFetch(`/api/ai/staff-assistant/conversations/${conversationId}`, { method: 'DELETE' })
}

export interface StaffAssistantStreamHandlers {
  /** It's looking something up, e.g. "Checking class progress". */
  onStatus: (label: string) => void
  onDelta: (text: string) => void
  onDone: (done: { messageId: string }) => void
  onError: (message: string) => void
}

/**
 * Asks the staff assistant and reads the answer as it streams (Server-Sent Events). EventSource
 * can't POST or send an Authorization header, so this reads the fetch body and parses the frames.
 * Refusals (plan, school switch, allowance, rate limit) arrive first as normal JSON errors.
 */
export async function askStaffAssistant(
  conversationId: string, content: string, page: string | null,
  handlers: StaffAssistantStreamHandlers, signal: AbortSignal,
): Promise<void> {
  const response = await fetch(apiUrl(`/api/ai/staff-assistant/conversations/${conversationId}/messages`), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ content, page }),
    signal,
  })
  if (!response.ok || !response.body) {
    const envelope = await response.json().catch(() => null) as { message?: string; data?: unknown } | null
    throw apiErrorFrom(response.status, envelope, 'The assistant is unavailable right now.')
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
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')

      let name = 'message'
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) name = line.slice(7)
        else if (line.startsWith('data: ')) data += line.slice(6)
      }
      if (!data) continue
      const payload = JSON.parse(data)
      if (name === 'status') handlers.onStatus(payload.label)
      else if (name === 'delta') handlers.onDelta(payload.text)
      else if (name === 'done') handlers.onDone(payload)
      else if (name === 'error') handlers.onError(payload.message)
    }
  }
}
