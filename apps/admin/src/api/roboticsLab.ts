import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'
import type { ObjectiveSet, SceneDefinition } from '@roboacademy/sim'

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

// --- Simulation scenes (in-house simulator, packages/sim) ---

export type SceneStatus = 'Draft' | 'Published'

/** A scene in the library. `sceneRef` is the value stored on a Simulation lesson's contentReference. */
export interface SimulationScene {
  sceneRef: string
  name: string
  description: string | null
  robotType: string | null
  status: SceneStatus
  objectiveCount: number
  updatedAt: string | null
}

export interface SimulationSceneDetail {
  id: string
  name: string
  description: string | null
  robotType: string
  status: SceneStatus
  objectiveCount: number
  definition: SceneDefinition
  objectives: ObjectiveSet
  updatedAt: string
}

export interface SaveSceneRequest {
  name: string
  description: string | null
  robotType: string
  definition: SceneDefinition
  objectives: ObjectiveSet
}

interface SceneSummaryResponse {
  id: string
  name: string
  description: string | null
  robotType: string
  status: SceneStatus
  objectiveCount: number
  updatedAt: string
}

/** The scene library, used by the scenes page and the lesson editor's scene picker. */
export async function listSimulationScenes(query?: string, status?: SceneStatus): Promise<SimulationScene[]> {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (status) params.set('status', status)
  const suffix = params.toString() ? `?${params}` : ''
  const scenes = await apiFetch<SceneSummaryResponse[]>(`/api/roboticslab/simulation/scenes${suffix}`)
  return scenes.map((s) => ({
    sceneRef: s.id,
    name: s.name,
    description: s.description,
    robotType: s.robotType,
    status: s.status,
    objectiveCount: s.objectiveCount,
    updatedAt: s.updatedAt,
  }))
}

export function getSimulationScene(sceneId: string): Promise<SimulationSceneDetail> {
  return apiFetch(`/api/roboticslab/simulation/scenes/${sceneId}`)
}

export function createSimulationScene(request: SaveSceneRequest): Promise<SimulationSceneDetail> {
  return apiFetch('/api/roboticslab/simulation/scenes', { method: 'POST', body: JSON.stringify(request) })
}

export function updateSimulationScene(sceneId: string, request: SaveSceneRequest): Promise<SimulationSceneDetail> {
  return apiFetch(`/api/roboticslab/simulation/scenes/${sceneId}`, { method: 'PUT', body: JSON.stringify(request) })
}

export function publishSimulationScene(sceneId: string): Promise<SimulationSceneDetail> {
  return apiFetch(`/api/roboticslab/simulation/scenes/${sceneId}/publish`, { method: 'POST' })
}

export function unpublishSimulationScene(sceneId: string): Promise<SimulationSceneDetail> {
  return apiFetch(`/api/roboticslab/simulation/scenes/${sceneId}/unpublish`, { method: 'POST' })
}

export function deleteSimulationScene(sceneId: string): Promise<void> {
  return apiFetch(`/api/roboticslab/simulation/scenes/${sceneId}`, { method: 'DELETE' })
}
