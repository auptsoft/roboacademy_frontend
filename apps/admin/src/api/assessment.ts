import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'
import type { GradedQuestion, QuizKind } from '@/components/questions/question-kinds'

// --- Question Bank ---

export interface QuestionBankItemSummary {
  id: string
  /** Multiple choice: the question. Other kinds: their prompt. */
  text: string
  optionCount: number
  tags: string[]
  kind: QuizKind
}

export interface QuestionBankItemDetail {
  id: string
  text: string
  options: string[]
  correctOptionIndex: number
  tags: string[]
  kind: QuizKind
  /** Non-choice kinds: the full question, answers included. */
  definition: GradedQuestion | null
}

/** Multiple choice: text, options, correctOptionIndex. Other kinds: kind and definition. */
export interface UpsertQuestionBankItemRequest {
  text?: string
  options?: string[]
  correctOptionIndex?: number
  tags?: string[]
  kind?: QuizKind
  definition?: GradedQuestion
}

export function listQuestionBank(
  tag?: string, page = 1, pageSize = 20,
): Promise<{ items: QuestionBankItemSummary[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (tag) params.set('tag', tag)
  return apiFetchPaged<QuestionBankItemSummary>(`/api/assessment/question-bank?${params}`)
}

export function createQuestionBankItem(request: UpsertQuestionBankItemRequest): Promise<QuestionBankItemDetail> {
  return apiFetch(`/api/assessment/question-bank`, { method: 'POST', body: JSON.stringify(request) })
}

export function getQuestionBankItem(itemId: string): Promise<QuestionBankItemDetail> {
  return apiFetch(`/api/assessment/question-bank/${itemId}`)
}

export function updateQuestionBankItem(
  itemId: string, request: UpsertQuestionBankItemRequest,
): Promise<QuestionBankItemDetail> {
  return apiFetch(`/api/assessment/question-bank/${itemId}`, { method: 'PUT', body: JSON.stringify(request) })
}

export function deleteQuestionBankItem(itemId: string): Promise<{ id: string }> {
  return apiFetch(`/api/assessment/question-bank/${itemId}`, { method: 'DELETE' })
}

// --- Assessments (Quiz | Written | FileSubmission), module-scoped and ordered ---

export type AssessmentType = 'Quiz' | 'Written' | 'FileSubmission'
export type AttemptStatus = 'InProgress' | 'Submitted' | 'Graded'

export const ASSESSMENT_TYPES: AssessmentType[] = ['Quiz', 'Written', 'FileSubmission']

export interface AssessmentListItem {
  id: string
  courseId: string
  moduleId: string
  order: number
  isRequired: boolean
  allowUnenrolled: boolean
  title: string
  type: AssessmentType
  passMark: number | null
  questionCount: number
  preText: string | null
  postText: string | null
}

/** A bank item; inline multiple choice (text, options, correctOptionIndex); or another kind with its definition. */
export interface QuestionInput {
  bankItemId?: string
  text?: string
  options?: string[]
  correctOptionIndex?: number
  kind?: QuizKind
  definition?: GradedQuestion
}

export interface CreateAssessmentRequest {
  type: AssessmentType
  title: string
  isRequired: boolean
  order: number
  allowUnenrolled?: boolean
  maxAttempts?: number
  timeLimitMinutes?: number
  // Quiz-only
  passMark?: number
  questions?: QuestionInput[]
  questionDisplay?: QuestionDisplay
  allowBackNavigation?: boolean
  // Written-only
  prompt?: string
  // FileSubmission-only
  acceptedContentTypes?: string[]
  maxFileSizeBytes?: number
}

export interface CreatedAssessment {
  id: string
  courseId: string
  moduleId: string
  title: string
  type: AssessmentType
}

export interface AuthoredQuestion {
  id: string
  text: string
  options: string[]
  correctOptionIndex: number
  order: number
  bankItemId: string | null
  kind: QuizKind
  definition: GradedQuestion | null
}

export interface AuthoredAssessment {
  id: string
  courseId: string
  moduleId: string
  order: number
  isRequired: boolean
  allowUnenrolled: boolean
  title: string
  type: AssessmentType
  maxAttempts: number | null
  timeLimitMinutes: number | null
  passMark: number | null
  questions: AuthoredQuestion[]
  prompt: string | null
  // Written only: the teacher's rubric / model answer. Never shown to learners; used by graders
  // and AI feedback drafts. Editable any time via setGradingGuidance, even after attempts.
  gradingGuidance: string | null
  acceptedContentTypes: string[] | null
  maxFileSizeBytes: number | null
  // Shown before/after attempting - display text, always editable via updateAssessment
  // regardless of attemptCount (unlike passMark/questions/prompt above).
  preText: string | null
  postText: string | null
  // Content (passMark/questions/prompt/file config) is only editable in place while this is
  // zero - see updateAssessmentContent. Once it's non-zero, clone the assessment instead.
  attemptCount: number
  questionDisplay: QuestionDisplay
  allowBackNavigation: boolean
}

export type QuestionDisplay = 'AllOnOnePage' | 'OneAtATime'

export interface UpdateAssessmentRequest {
  title: string
  isRequired: boolean
  order: number
  allowUnenrolled: boolean
  preText?: string | null
  postText?: string | null
  moduleId?: string
  /** Quizzes: omit to keep the current layout. */
  questionDisplay?: QuestionDisplay
  allowBackNavigation?: boolean
}

export interface ListAssessmentsFilters {
  moduleId?: string
  courseId?: string
  type?: AssessmentType
}

export function listAssessments(
  filters: ListAssessmentsFilters = {}, page = 1, pageSize = 50,
): Promise<{ items: AssessmentListItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.moduleId) params.set('moduleId', filters.moduleId)
  if (filters.courseId) params.set('courseId', filters.courseId)
  if (filters.type) params.set('type', filters.type)
  return apiFetchPaged<AssessmentListItem>(`/api/assessment/assessments?${params}`)
}

export function createAssessment(moduleId: string, request: CreateAssessmentRequest): Promise<CreatedAssessment> {
  return apiFetch(`/api/assessment/modules/${moduleId}/assessments`, { method: 'POST', body: JSON.stringify(request) })
}

// Author-facing view: includes Quiz correct answers and settings the learner-facing GetAssessment hides.
export function getAssessmentForAuthor(assessmentId: string): Promise<AuthoredAssessment> {
  return apiFetch(`/api/assessment/assessments/${assessmentId}/author`)
}

export function updateAssessment(assessmentId: string, request: UpdateAssessmentRequest): Promise<{
  id: string; title: string; isRequired: boolean; allowUnenrolled: boolean; order: number
  questionDisplay: QuestionDisplay; allowBackNavigation: boolean
}> {
  return apiFetch(`/api/assessment/assessments/${assessmentId}`, { method: 'PUT', body: JSON.stringify(request) })
}

export interface UpdateAssessmentContentRequest {
  maxAttempts?: number
  timeLimitMinutes?: number
  // Quiz-only
  passMark?: number
  questions?: QuestionInput[]
  // Written-only
  prompt?: string
  // FileSubmission-only
  acceptedContentTypes?: string[]
  maxFileSizeBytes?: number
}

// Only succeeds while the assessment has zero attempts (409 Conflict otherwise) - clone it
// instead once it has attempts.
export function updateAssessmentContent(
  assessmentId: string, request: UpdateAssessmentContentRequest,
): Promise<{ id: string; type: AssessmentType }> {
  return apiFetch(`/api/assessment/assessments/${assessmentId}/content`, { method: 'PUT', body: JSON.stringify(request) })
}

export function setGradingGuidance(
  assessmentId: string, gradingGuidance: string | null,
): Promise<{ id: string; gradingGuidance: string | null }> {
  return apiFetch(`/api/assessment/assessments/${assessmentId}/grading-guidance`, {
    method: 'PUT',
    body: JSON.stringify({ gradingGuidance }),
  })
}

export function cloneAssessment(
  assessmentId: string, request: { title?: string; order?: number; isRequired?: boolean } = {},
): Promise<CreatedAssessment> {
  return apiFetch(`/api/assessment/assessments/${assessmentId}/clone`, { method: 'POST', body: JSON.stringify(request) })
}

export function deleteAssessment(assessmentId: string): Promise<{ id: string }> {
  return apiFetch(`/api/assessment/assessments/${assessmentId}`, { method: 'DELETE' })
}

// --- Attempts & grading ---

export interface AttemptItem {
  id: string
  assessmentId: string
  assessmentTitle: string
  assessmentType: AssessmentType
  courseId: string
  userId: string
  status: AttemptStatus
  startedAt: string
  submittedAt: string | null
  responseText: string | null
  fileReference: string | null
  score: number | null
  passed: boolean | null
  /** Handed in because time ran out. */
  submittedAutomatically: boolean
}

export interface ListAttemptsFilters {
  assessmentId?: string
  moduleId?: string
  courseId?: string
  status?: AttemptStatus
}

export function listAttempts(
  filters: ListAttemptsFilters = {}, page = 1, pageSize = 50,
): Promise<{ items: AttemptItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.assessmentId) params.set('assessmentId', filters.assessmentId)
  if (filters.moduleId) params.set('moduleId', filters.moduleId)
  if (filters.courseId) params.set('courseId', filters.courseId)
  if (filters.status) params.set('status', filters.status)
  return apiFetchPaged<AttemptItem>(`/api/assessment/attempts?${params}`)
}

export function gradeAttempt(
  attemptId: string, request: { passed: boolean; score?: number; feedback?: string },
): Promise<{ attemptId: string; status: AttemptStatus; passed: boolean }> {
  return apiFetch(`/api/assessment/attempts/${attemptId}/grade`, { method: 'POST', body: JSON.stringify(request) })
}

// --- Images for quiz and bank questions (label the diagram) ---

export function getAssessmentAssetUploadUrl(
  request: { contentType: string; fileName: string; sizeBytes: number },
): Promise<{ uploadUrl: string; objectKey: string; expiresAt: string }> {
  return apiFetch('/api/assessment/asset-upload-url', { method: 'POST', body: JSON.stringify(request) })
}

// Signed URLs for authors previewing question images (quiz images, or a lesson's not yet copied in).
export function getAssessmentAssetUrls(keys: string[]): Promise<{ urls: Record<string, string>; expiresAt: string }> {
  return apiFetch('/api/assessment/asset-urls', { method: 'POST', body: JSON.stringify({ keys }) })
}

// --- Cross-tenant assessment & question-bank copy (platform admin only, from the platform tenant) ---

export interface AssessmentCopyTarget {
  tenantId: string
  courseId: string
  moduleId: string
}

export interface AssessmentCopyTargetResult {
  tenantId: string
  isSuccessful: boolean
  assessmentId: string | null
  error: string | null
}

export function copyAssessmentToTenants(
  assessmentId: string, request: { targets: AssessmentCopyTarget[]; titleOverride?: string },
): Promise<{ results: AssessmentCopyTargetResult[] }> {
  return apiFetch(`/api/assessment/assessments/${assessmentId}/copy-to-tenants`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function importAssessmentFromTenant(request: {
  sourceTenantId: string
  assessmentId: string
  targetCourseId: string
  targetModuleId: string
  titleOverride?: string
}): Promise<{ assessmentId: string }> {
  return apiFetch('/api/assessment/assessments/import-from-tenant', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function listTenantAssessments(
  sourceTenantId: string, filters: ListAssessmentsFilters = {}, page = 1, pageSize = 50,
): Promise<{ items: AssessmentListItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.moduleId) params.set('moduleId', filters.moduleId)
  if (filters.courseId) params.set('courseId', filters.courseId)
  if (filters.type) params.set('type', filters.type)
  return apiFetchPaged<AssessmentListItem>(`/api/assessment/assessments/from-tenant/${sourceTenantId}?${params}`)
}

export interface QuestionBankCopyTargetResult {
  tenantId: string
  isSuccessful: boolean
  itemsCopied: number
  error: string | null
}

export function copyQuestionBankItemsToTenants(
  request: { itemIds: string[]; targetTenantIds: string[] },
): Promise<{ results: QuestionBankCopyTargetResult[] }> {
  return apiFetch('/api/assessment/question-bank/copy-to-tenants', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function importQuestionBankItemsFromTenant(
  request: { sourceTenantId: string; itemIds: string[] },
): Promise<{ itemsImported: number }> {
  return apiFetch('/api/assessment/question-bank/import-from-tenant', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function listTenantQuestionBank(
  sourceTenantId: string, tag?: string, page = 1, pageSize = 20,
): Promise<{ items: QuestionBankItemSummary[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (tag) params.set('tag', tag)
  return apiFetchPaged<QuestionBankItemSummary>(`/api/assessment/question-bank/from-tenant/${sourceTenantId}?${params}`)
}
