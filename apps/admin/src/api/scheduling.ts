import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export type EventType = 'Workshop' | 'Competition' | 'OpenDay' | 'Exam' | 'Webinar' | 'Other'
export type EventStatus = 'Draft' | 'Published' | 'Cancelled'
export type EventAudience = 'Everyone' | 'Classes'

export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'Workshop', label: 'Workshop' },
  { value: 'Competition', label: 'Competition' },
  { value: 'OpenDay', label: 'Open day' },
  { value: 'Exam', label: 'Exam' },
  { value: 'Webinar', label: 'Webinar' },
  { value: 'Other', label: 'Other' },
]

export function eventTypeLabel(type: EventType): string {
  return EVENT_TYPES.find((t) => t.value === type)?.label ?? type
}

export interface EventListItem {
  id: string
  title: string
  type: EventType
  startsAt: string
  endsAt: string
  location: string | null
  onlineUrl: string | null
  status: EventStatus
  capacity: number | null
  goingCount: number
  waitlistCount: number
}

export interface EventDetail extends EventListItem {
  description: string | null
  audience: EventAudience
  classIds: string[]
  cancellationReason: string | null
  publishedAt: string | null
}

export interface EventInput {
  title: string
  description: string | null
  type: EventType
  startsAt: string
  endsAt: string
  location: string | null
  onlineUrl: string | null
  capacity: number | null
  audience: EventAudience
  classIds: string[]
}

export interface EventAttendee {
  userId: string
  fullName: string
  email: string
  status: 'Going' | 'Waitlisted'
  respondedAt: string
  checkedInAt: string | null
}

export function listEvents(
  filters: { status?: EventStatus; upcoming?: boolean; search?: string } = {}, page = 1, pageSize = 20,
): Promise<{ items: EventListItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.status) params.set('status', filters.status)
  if (filters.upcoming) params.set('upcoming', 'true')
  if (filters.search) params.set('search', filters.search)
  return apiFetchPaged<EventListItem>(`/api/admin/scheduling/events?${params}`)
}

export function getEvent(id: string): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/api/admin/scheduling/events/${id}`)
}

export function createEvent(input: EventInput): Promise<EventDetail> {
  return apiFetch<EventDetail>('/api/admin/scheduling/events', { method: 'POST', body: JSON.stringify(input) })
}

export function updateEvent(id: string, input: EventInput): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/api/admin/scheduling/events/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function publishEvent(id: string): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/api/admin/scheduling/events/${id}/publish`, { method: 'POST' })
}

export function cancelEvent(id: string, reason: string | null): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/api/admin/scheduling/events/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function listEventAttendees(id: string): Promise<EventAttendee[]> {
  return apiFetch<EventAttendee[]>(`/api/admin/scheduling/events/${id}/attendees`)
}

export function setAttendeeCheckIn(id: string, userId: string, checkedIn: boolean): Promise<unknown> {
  return apiFetch(`/api/admin/scheduling/events/${id}/attendees/${userId}/check-in`, {
    method: 'PUT',
    body: JSON.stringify({ checkedIn }),
  })
}

export type CalendarItemKind = 'event' | 'live_class' | 'lab_session'

export interface CalendarItem {
  kind: CalendarItemKind
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  location: string | null
  linkPath: string
  status: string
}

/** Everything scheduled in the tenant - events (drafts too), live classes and lab sessions. */
export function getTenantCalendar(from: Date, to: Date): Promise<CalendarItem[]> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  return apiFetch<CalendarItem[]>(`/api/admin/scheduling/calendar?${params}`)
}
