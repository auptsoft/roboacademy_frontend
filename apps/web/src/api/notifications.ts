import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export type NotificationCategory = 'learning' | 'assessments' | 'certificates'

export interface NotificationItem {
  id: string
  type: string
  category: NotificationCategory
  title: string
  body: string
  linkPath: string | null
  readAt: string | null
  createdAt: string
}

export interface NotificationPreference {
  category: NotificationCategory
  label: string
  description: string
  inApp: boolean
  email: boolean
}

export function getMyNotifications(
  params: { unread?: boolean; page?: number; pageSize?: number } = {},
): Promise<{ data: NotificationItem[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  if (params.unread) query.set('unread', 'true')
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 20))
  return apiFetchPaged<NotificationItem>(`/api/notifications/me?${query.toString()}`)
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count } = await apiFetch<{ count: number }>('/api/notifications/me/unread-count')
  return count
}

export function markNotificationRead(id: string): Promise<{ id: string; readAt: string }> {
  return apiFetch(`/api/notifications/me/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch('/api/notifications/me/read-all', { method: 'POST' })
}

export function getNotificationPreferences(): Promise<NotificationPreference[]> {
  return apiFetch<NotificationPreference[]>('/api/notifications/me/preferences')
}

export function updateNotificationPreferences(
  preferences: Pick<NotificationPreference, 'category' | 'inApp' | 'email'>[],
): Promise<unknown> {
  return apiFetch('/api/notifications/me/preferences', {
    method: 'PUT',
    body: JSON.stringify({ preferences }),
  })
}

/** Whether the user gets a daily email summarising unread notifications. */
export async function getDigestEnabled(): Promise<boolean> {
  return (await apiFetch<{ enabled: boolean }>('/api/notifications/me/digest')).enabled
}

export function setDigestEnabled(enabled: boolean): Promise<unknown> {
  return apiFetch('/api/notifications/me/digest', { method: 'PUT', body: JSON.stringify({ enabled }) })
}
