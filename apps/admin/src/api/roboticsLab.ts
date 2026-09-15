import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export type PracticalMode = 'Simulation' | 'PhysicalRobot'
export type PracticalStatus = 'Requested' | 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled' | 'Failed'

export interface SessionListItem {
  id: string
  courseId: string
  userId: string
  mode: PracticalMode
  status: PracticalStatus
  scheduledStart: string | null
}

export interface SessionDetail {
  id: string
  courseId: string
  lessonId: string | null
  userId: string
  mode: PracticalMode
  status: PracticalStatus
  scheduledStart: string | null
  scheduledEnd: string | null
  robotId: string | null
  score: number | null
  passed: boolean | null
  completedAt: string | null
}

export interface ListSessionsFilters {
  status?: PracticalStatus
  courseId?: string
  userId?: string
}

// Admin-wide oversight list, gated by ManageRobots (distinct from the self-scoped
// /sessions/me a learner sees).
export function listSessions(
  filters: ListSessionsFilters = {}, page = 1, pageSize = 20,
): Promise<{ items: SessionListItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.status) params.set('status', filters.status)
  if (filters.courseId) params.set('courseId', filters.courseId)
  if (filters.userId) params.set('userId', filters.userId)
  return apiFetchPaged<SessionListItem>(`/api/roboticslab/sessions?${params}`)
}

export function getSession(sessionId: string): Promise<SessionDetail> {
  return apiFetch(`/api/roboticslab/sessions/${sessionId}`)
}

export function scheduleSession(
  sessionId: string, request: { scheduledStart: string; scheduledEnd: string; robotId: string },
): Promise<{ id: string; status: PracticalStatus; scheduledStart: string | null }> {
  return apiFetch(`/api/roboticslab/sessions/${sessionId}/schedule`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function cancelSession(sessionId: string): Promise<{ id: string; status: PracticalStatus }> {
  return apiFetch(`/api/roboticslab/sessions/${sessionId}/cancel`, { method: 'POST' })
}

// Works for the session's own owner, or a ManageRobots-permission caller for oversight.
export function joinSession(sessionId: string): Promise<{ iframeUrl: string; expiresAt: string }> {
  return apiFetch(`/api/roboticslab/sessions/${sessionId}/join`)
}

// --- Simulation scenes ---

export interface SimulationScene {
  sceneRef: string
  name: string
  description: string | null
  robotType: string | null
  status: string
  objectiveCount: number
  updatedAt: string | null
}

/**
 * The external app's scene library, used to populate the lesson editor's scene picker. Returns
 * an empty list when the external app has no scene endpoint, so callers must treat "no scenes"
 * as "no directory available" rather than "no scenes exist" - a lesson may still legitimately
 * reference a scene id this never lists.
 */
export function listSimulationScenes(query?: string): Promise<SimulationScene[]> {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  const suffix = params.toString() ? `?${params}` : ''
  return apiFetch(`/api/roboticslab/scenes${suffix}`)
}
