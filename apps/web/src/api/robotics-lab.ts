import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export type LabSessionMode = 'Simulation' | 'PhysicalRobot'

export interface LabSessionSummary {
  id: string
  courseId: string
  mode: LabSessionMode
  status: string
  scheduledStart: string | null
}

export interface LabSession extends LabSessionSummary {
  lessonId: string | null
  score: number | null
  passed: boolean | null
  completedAt: string | null
}

/**
 * A short-lived reference to the external simulation app. `accessToken` is scoped to this one
 * session and is handed to the iframe over postMessage rather than appended to `iframeUrl`,
 * keeping it out of browser history and referrer headers.
 */
export interface LabSessionJoinInfo {
  iframeUrl: string
  expiresAt: string
  accessToken: string
}

export function getMyLabSessions(params: { page?: number; pageSize?: number } = {}): Promise<{ data: LabSessionSummary[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 50))
  return apiFetchPaged<LabSessionSummary>(`/api/roboticslab/sessions/me?${query.toString()}`)
}

/**
 * Books a practical session. Simulation sessions are provisioned and scheduled in this single
 * call, so the returned id can be joined immediately; physical-robot sessions stay Requested
 * until an admin schedules them.
 */
export function requestLabSession(body: {
  courseId: string
  lessonId?: string | null
  mode: LabSessionMode
}): Promise<{ id: string; mode: string; status: string }> {
  return apiFetch('/api/roboticslab/sessions', {
    method: 'POST',
    body: JSON.stringify({ courseId: body.courseId, lessonId: body.lessonId ?? null, mode: body.mode }),
  })
}

export function getLabSession(sessionId: string): Promise<LabSession> {
  return apiFetch<LabSession>(`/api/roboticslab/sessions/${sessionId}`)
}

export function joinLabSession(sessionId: string): Promise<LabSessionJoinInfo> {
  return apiFetch<LabSessionJoinInfo>(`/api/roboticslab/sessions/${sessionId}/join`)
}
