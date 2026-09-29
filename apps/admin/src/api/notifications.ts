import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export interface NotificationItem {
  id: string
  type: string
  category: string
  title: string
  body: string
  linkPath: string | null
  readAt: string | null
  createdAt: string
}

export function getMyNotifications(page = 1, pageSize = 10): Promise<{ items: NotificationItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiFetchPaged<NotificationItem>(`/api/notifications/me?${params}`)
}

export async function getUnreadNotificationCount(): Promise<number> {
  return (await apiFetch<{ count: number }>('/api/notifications/me/unread-count')).count
}

export function markNotificationRead(id: string): Promise<{ id: string; readAt: string }> {
  return apiFetch(`/api/notifications/me/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch('/api/notifications/me/read-all', { method: 'POST' })
}

// --- Announcements (admin) ---

export type AnnouncementAudience = 'Everyone' | 'Roles' | 'Classes'
export type AnnouncementStatus = 'Scheduled' | 'Sent' | 'Cancelled'

export interface Announcement {
  id: string
  title: string
  body: string
  audience: AnnouncementAudience
  roles: string[]
  classIds: string[]
  sendEmail: boolean
  status: AnnouncementStatus
  scheduledFor: string | null
  sentAt: string | null
  recipientCount: number | null
  createdAt: string
}

export interface AnnouncementInput {
  title: string
  body: string
  audience: AnnouncementAudience
  roles: string[]
  classIds: string[]
  sendEmail: boolean
  scheduledFor: string | null
}

export function listAnnouncements(page = 1, pageSize = 20): Promise<{ items: Announcement[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiFetchPaged<Announcement>(`/api/admin/notifications/announcements?${params}`)
}

export function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  return apiFetch<Announcement>('/api/admin/notifications/announcements', { method: 'POST', body: JSON.stringify(input) })
}

export function cancelAnnouncement(id: string): Promise<Announcement> {
  return apiFetch<Announcement>(`/api/admin/notifications/announcements/${id}/cancel`, { method: 'POST' })
}
