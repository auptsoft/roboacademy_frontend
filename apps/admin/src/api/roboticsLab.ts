import { ApiError, apiFetch } from '@/api/client'
import type { ObjectiveSet, SceneDefinition } from '@roboacademy/sim'

// --- Physical robot lab sessions (Robotics Lab Phase P1) ---

export interface BotnovaHost {
  id: string
  name: string
  apiBaseUrl: string
  embedOrigin: string
  enabled: boolean
}

/** Suspended: a school's own provider whose plan no longer includes it (Phase P2). */
export type LabProviderStatus = 'Active' | 'Disabled' | 'Failing' | 'Suspended'

/** A botnova account. Its API token is write-only: responses only say whether one is set. */
export interface LabProvider {
  id: string
  name: string
  hostId: string
  hostName: string | null
  hasToken: boolean
  status: LabProviderStatus
  lastError: string | null
  lastCheckedAt: string | null
  accountName: string | null
  embedOrigin: string | null
  protocolVersion: number | null
}

export interface LabTemplate {
  templateId: string
  name: string
  description: string | null
  robotIds: string[]
  updatedAt: string | null
}

export type LabSlotStatus = 'Unallocated' | 'Allocated' | 'InUse' | 'Cancelled'

export interface PlatformLabSlot {
  id: string
  providerId: string
  templateId: string
  templateName: string
  robotIds: string[]
  startsAt: string
  endsAt: string
  allocatedTenantId: string | null
  status: LabSlotStatus
}

const PLATFORM = '/api/admin/roboticslab/platform'

export const listBotnovaHosts = (): Promise<BotnovaHost[]> => apiFetch(`${PLATFORM}/hosts`)

export const createBotnovaHost = (body: { name: string; apiBaseUrl: string; embedOrigin: string; enabled: boolean }): Promise<BotnovaHost> =>
  apiFetch(`${PLATFORM}/hosts`, { method: 'POST', body: JSON.stringify(body) })

export const updateBotnovaHost = (hostId: string, body: { name: string; apiBaseUrl: string; embedOrigin: string; enabled: boolean }): Promise<BotnovaHost> =>
  apiFetch(`${PLATFORM}/hosts/${hostId}`, { method: 'PUT', body: JSON.stringify(body) })

export const listLabProviders = (): Promise<LabProvider[]> => apiFetch(`${PLATFORM}/providers`)

export const createLabProvider = (body: { name: string; hostId: string; apiToken: string }): Promise<LabProvider> =>
  apiFetch(`${PLATFORM}/providers`, { method: 'POST', body: JSON.stringify(body) })

/** A null apiToken keeps the stored one. */
export const updateLabProvider = (providerId: string, body: { name: string; hostId: string; disabled: boolean; apiToken: string | null }): Promise<LabProvider> =>
  apiFetch(`${PLATFORM}/providers/${providerId}`, { method: 'PUT', body: JSON.stringify(body) })

export const testLabProvider = (providerId: string): Promise<LabProvider> =>
  apiFetch(`${PLATFORM}/providers/${providerId}/test`, { method: 'POST' })

export const listLabTemplates = (providerId: string): Promise<LabTemplate[]> => apiFetch(`${PLATFORM}/providers/${providerId}/templates`)

export function listPlatformLabSlots(filters: { from?: string; to?: string; providerId?: string; tenantId?: string } = {}): Promise<PlatformLabSlot[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  return apiFetch(`${PLATFORM}/slots${params.toString() ? `?${params}` : ''}`)
}

export const createLabSlot = (body: { providerId: string; templateId: string; startsAt: string; endsAt: string; tenantId: string | null }): Promise<PlatformLabSlot> =>
  apiFetch(`${PLATFORM}/slots`, { method: 'POST', body: JSON.stringify(body) })

export const allocateLabSlot = (slotId: string, tenantId: string): Promise<PlatformLabSlot> =>
  apiFetch(`${PLATFORM}/slots/${slotId}/allocate`, { method: 'POST', body: JSON.stringify({ tenantId }) })

export const deallocateLabSlot = (slotId: string): Promise<PlatformLabSlot> => apiFetch(`${PLATFORM}/slots/${slotId}/deallocate`, { method: 'POST' })

export const cancelLabSlot = (slotId: string): Promise<PlatformLabSlot> => apiFetch(`${PLATFORM}/slots/${slotId}/cancel`, { method: 'POST' })

/** A school's own botnova connection, for platform support (read-only). */
export interface SchoolLabProvider {
  tenantId: string
  provider: LabProvider
}

export const listSchoolLabProviders = (): Promise<SchoolLabProvider[]> => apiFetch(`${PLATFORM}/school-providers`)

// A school's own botnova account and robot time (Robotics Lab Phase P2).

const OWN = '/api/admin/roboticslab/own'

/** An approved botnova server a school may connect to. Its API address isn't shown to schools. */
export interface OwnBotnovaHost {
  id: string
  name: string
  embedOrigin: string
}

export const listOwnHosts = (): Promise<OwnBotnovaHost[]> => apiFetch(`${OWN}/hosts`)

/** The school's connection, or null when it hasn't connected one. */
export async function getOwnProvider(): Promise<LabProvider | null> {
  try {
    return await apiFetch<LabProvider>(`${OWN}/provider`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export const createOwnProvider = (body: { name: string; hostId: string; apiToken: string }): Promise<LabProvider> =>
  apiFetch(`${OWN}/provider`, { method: 'POST', body: JSON.stringify(body) })

/** A null apiToken keeps the stored one. */
export const updateOwnProvider = (body: { name: string; hostId: string; apiToken: string | null }): Promise<LabProvider> =>
  apiFetch(`${OWN}/provider`, { method: 'PUT', body: JSON.stringify(body) })

export const testOwnProvider = (): Promise<LabProvider> => apiFetch(`${OWN}/provider/test`, { method: 'POST' })

export const deleteOwnProvider = (): Promise<void> => apiFetch(`${OWN}/provider`, { method: 'DELETE' })

export const listOwnTemplates = (): Promise<LabTemplate[]> => apiFetch(`${OWN}/provider/templates`)

export function listOwnSlots(filters: { from?: string; to?: string } = {}): Promise<PlatformLabSlot[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  return apiFetch(`${OWN}/slots${params.toString() ? `?${params}` : ''}`)
}

export const createOwnSlot = (body: { templateId: string; startsAt: string; endsAt: string }): Promise<PlatformLabSlot> =>
  apiFetch(`${OWN}/slots`, { method: 'POST', body: JSON.stringify(body) })

export const cancelOwnSlot = (slotId: string): Promise<PlatformLabSlot> => apiFetch(`${OWN}/slots/${slotId}/cancel`, { method: 'POST' })

// School side.

export interface SchoolLabSlot {
  id: string
  templateName: string
  robotIds: string[]
  startsAt: string
  endsAt: string
  ownSlot: boolean
}

export type LabSessionVisibility = 'Public' | 'Class' | 'Hidden'

export type LabSessionStatus = 'Open' | 'Assigned' | 'Provisioned' | 'InProgress' | 'Ended' | 'Unused' | 'Cancelled'

export type LabRequestStatus = 'Pending' | 'Approved' | 'Waitlisted' | 'Declined' | 'Expired' | 'Withdrawn'

export interface AdminLabSession {
  id: string
  slotId: string
  title: string
  description: string | null
  templateName: string
  startsAt: string
  endsAt: string
  visibility: LabSessionVisibility
  classId: string | null
  courseId: string | null
  requiredLessonId: string | null
  status: LabSessionStatus
  assignedUserId: string | null
  assignedUserName: string | null
  flagReason: string | null
  attended: boolean | null
  openRequestCount: number
}

export interface LabSessionRequestItem {
  id: string
  userId: string
  userName: string | null
  message: string | null
  status: LabRequestStatus
  createdAt: string
  decidedAt: string | null
}

export interface AdminLabSessionDetail {
  session: AdminLabSession
  requests: LabSessionRequestItem[]
}

export interface SaveLabSession {
  title: string
  description: string | null
  visibility: LabSessionVisibility
  classId: string | null
  courseId: string | null
  requiredLessonId: string | null
}

const SCHOOL = '/api/admin/roboticslab'

export const listSchoolLabSlots = (): Promise<SchoolLabSlot[]> => apiFetch(`${SCHOOL}/slots`)

export function listAdminLabSessions(filters: { from?: string; to?: string; status?: LabSessionStatus } = {}): Promise<AdminLabSession[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  return apiFetch(`${SCHOOL}/lab-sessions${params.toString() ? `?${params}` : ''}`)
}

export const getAdminLabSession = (labSessionId: string): Promise<AdminLabSessionDetail> => apiFetch(`${SCHOOL}/lab-sessions/${labSessionId}`)

export const createLabSession = (body: SaveLabSession & { slotId: string }): Promise<AdminLabSession> =>
  apiFetch(`${SCHOOL}/lab-sessions`, { method: 'POST', body: JSON.stringify(body) })

export const updateLabSession = (labSessionId: string, body: SaveLabSession): Promise<AdminLabSessionDetail> =>
  apiFetch(`${SCHOOL}/lab-sessions/${labSessionId}`, { method: 'PUT', body: JSON.stringify(body) })

export const cancelLabSession = (labSessionId: string): Promise<AdminLabSessionDetail> =>
  apiFetch(`${SCHOOL}/lab-sessions/${labSessionId}/cancel`, { method: 'POST' })

export const approveLabRequest = (labSessionId: string, requestId: string): Promise<AdminLabSessionDetail> =>
  apiFetch(`${SCHOOL}/lab-sessions/${labSessionId}/requests/${requestId}/approve`, { method: 'POST' })

export const declineLabRequest = (labSessionId: string, requestId: string): Promise<AdminLabSessionDetail> =>
  apiFetch(`${SCHOOL}/lab-sessions/${labSessionId}/requests/${requestId}/decline`, { method: 'POST' })

export const assignLabSession = (labSessionId: string, userId: string): Promise<AdminLabSessionDetail> =>
  apiFetch(`${SCHOOL}/lab-sessions/${labSessionId}/assign`, { method: 'POST', body: JSON.stringify({ userId }) })

export const unassignLabSession = (labSessionId: string): Promise<AdminLabSessionDetail> =>
  apiFetch(`${SCHOOL}/lab-sessions/${labSessionId}/unassign`, { method: 'POST' })

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
