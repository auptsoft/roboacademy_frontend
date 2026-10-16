import { apiFetch } from '@/api/client'

/**
 * Physical robot lab sessions (Robotics Lab Phase P1). RoboAcademy schedules them; botnova runs
 * them, shown here in an iframe during the session's window.
 */

export type LabSessionStatus = 'Open' | 'Assigned' | 'Provisioned' | 'InProgress' | 'Ended' | 'Unused' | 'Cancelled'

export type LabRequestStatus = 'Pending' | 'Approved' | 'Waitlisted' | 'Declined' | 'Expired' | 'Withdrawn'

export interface LabSession {
  id: string
  title: string
  description: string | null
  /** The botnova template the session runs: which robots, which control screen. */
  templateName: string
  startsAt: string
  endsAt: string
  status: LabSessionStatus
  courseId: string | null
  requiredLessonId: string | null
  /** False when the session requires a simulation lesson the learner hasn't passed yet. */
  meetsRequirement: boolean
  assignedToMe: boolean
  myRequestStatus: LabRequestStatus | null
  attended: boolean
}

/**
 * A short-lived reference to botnova's control screen. The access token is handed to the iframe
 * over postMessage, never put in the URL, so it stays out of browser history and referrers.
 */
export interface LabSessionJoinInfo {
  iframeUrl: string
  externalSessionId: string
  accessToken: string
  expiresAt: string
  endsAt: string
}

/** Upcoming sessions the learner can see and ask for. */
export function listLabSessions(): Promise<LabSession[]> {
  return apiFetch<LabSession[]>('/api/roboticslab/lab-sessions')
}

/** Sessions the learner has been given, upcoming and past. */
export function listMyLabSessions(): Promise<LabSession[]> {
  return apiFetch<LabSession[]>('/api/roboticslab/lab-sessions/mine')
}

export function getLabSession(labSessionId: string): Promise<LabSession> {
  return apiFetch<LabSession>(`/api/roboticslab/lab-sessions/${labSessionId}`)
}

export function requestLabSession(labSessionId: string, message: string | null): Promise<LabSession> {
  return apiFetch<LabSession>(`/api/roboticslab/lab-sessions/${labSessionId}/requests`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

/** Withdraws the learner's request, or gives up a session they were given. */
export function withdrawLabSession(labSessionId: string): Promise<LabSession> {
  return apiFetch<LabSession>(`/api/roboticslab/lab-sessions/${labSessionId}/requests/mine`, { method: 'DELETE' })
}

export function joinLabSession(labSessionId: string): Promise<LabSessionJoinInfo> {
  return apiFetch<LabSessionJoinInfo>(`/api/roboticslab/lab-sessions/${labSessionId}/join`)
}
