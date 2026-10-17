import type { QuizDefinition, QuizQuestionKind, QuizResponse } from '@roboacademy/ui'
import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export interface AssessmentSummary {
  id: string
  courseId: string
  moduleId: string
  order: number
  isRequired: boolean
  title: string
  type: 'Quiz' | 'Written' | 'FileSubmission'
  questionCount: number
  passed: boolean
}

export function listModuleAssessments(moduleId: string): Promise<AssessmentSummary[]> {
  return apiFetch<AssessmentSummary[]>(`/api/assessment/modules/${moduleId}/assessments`)
}

export interface AssessmentQuestion {
  id: string
  /** Multiple choice: the question. Other kinds: a summary (the definition has the prompt). */
  text: string
  /** Multiple choice only. */
  options: string[]
  order: number
  kind: QuizQuestionKind
  /** Non-choice kinds: the question without its answers (the server grades). */
  definition: QuizDefinition | null
}

export interface AssessmentDetail {
  id: string
  courseId: string
  moduleId: string
  title: string
  type: 'Quiz' | 'Written' | 'FileSubmission'
  prompt: string | null
  acceptedContentTypes: string[] | null
  maxFileSizeBytes: number | null
  preText: string | null
  postText: string | null
  maxAttempts: number | null
  timeLimitMinutes: number | null
  passMark: number | null
  questions: AssessmentQuestion[]
  /** Quizzes: all questions on one page, or one at a time. */
  questionDisplay: 'AllOnOnePage' | 'OneAtATime'
  /** One at a time: whether learners can go back to change earlier answers. */
  allowBackNavigation: boolean
}

// Already open to any authenticated user on the backend — no new endpoint needed for this one.
export function getAssessment(assessmentId: string): Promise<AssessmentDetail> {
  return apiFetch<AssessmentDetail>(`/api/assessment/assessments/${assessmentId}`)
}

export type AttemptStatus = 'InProgress' | 'Submitted' | 'Graded'

export interface AttemptSummary {
  id: string
  status: AttemptStatus
  startedAt: string
  expiresAt: string | null
  submittedAt: string | null
  responseText: string | null
  fileReference: string | null
  score: number | null
  passed: boolean | null
  feedback: string | null
  gradedAt: string | null
  /** Handed in because time ran out (by the page at zero, or by the server for one left open). */
  submittedAutomatically: boolean
  /** In-progress attempts: the answers saved so far. */
  draft: AttemptDraft | null
  /** One-at-a-time quizzes: the question on screen, and the furthest reached (0-based). */
  currentQuestion: number | null
  furthestQuestion: number | null
  /** The server's clock when this was sent, to correct the countdown for the device's clock. */
  serverNow: string
}

/** The answers so far on an in-progress attempt, by type. */
export interface AttemptDraft {
  responses?: QuizResponse[]
  responseText?: string
  fileReference?: string
}

// Saves the answers so far. keepalive lets the last save survive the tab closing.
export function saveAttemptDraft(
  attemptId: string,
  request: { draft: AttemptDraft; currentQuestion?: number; furthestQuestion?: number },
  options: { keepalive?: boolean } = {},
): Promise<{ attemptId: string; savedAt: string; expiresAt: string | null; furthestQuestion: number | null }> {
  return apiFetch(`/api/assessment/attempts/${attemptId}/draft`, {
    method: 'PUT',
    body: JSON.stringify(request),
    keepalive: options.keepalive,
  })
}

export function listMyAttempts(assessmentId: string): Promise<AttemptSummary[]> {
  return apiFetch<AttemptSummary[]>(`/api/assessment/assessments/${assessmentId}/attempts/mine`)
}

export interface MyAttemptItem {
  id: string
  assessmentId: string
  assessmentTitle: string
  assessmentType: AssessmentSummary['type']
  courseId: string
  moduleId: string
  status: AttemptStatus
  startedAt: string
  submittedAt: string | null
  score: number | null
  passed: boolean | null
  gradedAt: string | null
}

// Every attempt the caller has made, across all assessments, newest first.
export function getAllMyAttempts(params: { page?: number; pageSize?: number } = {}): Promise<{ data: MyAttemptItem[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 50))
  return apiFetchPaged<MyAttemptItem>(`/api/assessment/attempts/mine?${query.toString()}`)
}

export interface StartAttemptResult {
  attemptId: string
  assessmentId: string
  startedAt: string
  expiresAt: string | null
}

export function startAttempt(assessmentId: string): Promise<StartAttemptResult> {
  return apiFetch<StartAttemptResult>(`/api/assessment/assessments/${assessmentId}/attempts`, { method: 'POST' })
}

export interface SubmitAttemptRequest {
  /** Multiple choice only: the selected option per question. */
  answers?: number[]
  /** Any question kind: one response per question, in order. */
  responses?: QuizResponse[]
  responseText?: string
  fileReference?: string
}

export interface SubmitAttemptResult {
  attemptId: string
  status: AttemptStatus
  score: number | null
  passed: boolean | null
}

export function submitAttempt(attemptId: string, request: SubmitAttemptRequest): Promise<SubmitAttemptResult> {
  return apiFetch<SubmitAttemptResult>(`/api/assessment/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export interface AttemptFileUploadUrl {
  uploadUrl: string
  objectKey: string
  expiresAt: string
}

export function getAttemptFileUploadUrl(attemptId: string, contentType: string, fileName: string): Promise<AttemptFileUploadUrl> {
  return apiFetch<AttemptFileUploadUrl>(`/api/assessment/attempts/${attemptId}/file-upload-url`, {
    method: 'POST',
    body: JSON.stringify({ contentType, fileName }),
  })
}
