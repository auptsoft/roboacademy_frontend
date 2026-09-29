import { ApiError, apiFetch, apiFetchPaged, getTenantId, type PageMeta } from '@/api/client'
import { getAccessToken } from '@/api/session'
import { getEnv } from '@/lib/runtime-env'

export type EventType = 'Workshop' | 'Competition' | 'OpenDay' | 'Exam' | 'Webinar' | 'Other'
export type EventStatus = 'Draft' | 'Published' | 'Cancelled'
export type AttendeeStatus = 'Going' | 'Waitlisted'

export interface EventItem {
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
  myStatus: AttendeeStatus | null
}

export interface EventDetail extends EventItem {
  description: string | null
  audience: 'Everyone' | 'Classes'
  classIds: string[]
  cancellationReason: string | null
  publishedAt: string | null
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
  attending: boolean
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  Workshop: 'Workshop',
  Competition: 'Competition',
  OpenDay: 'Open day',
  Exam: 'Exam',
  Webinar: 'Webinar',
  Other: 'Event',
}

export function listEvents(
  params: { past?: boolean; page?: number; pageSize?: number } = {},
): Promise<{ data: EventItem[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  if (params.past) query.set('past', 'true')
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 20))
  return apiFetchPaged<EventItem>(`/api/scheduling/events?${query.toString()}`)
}

export function getEvent(id: string): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/api/scheduling/events/${id}`)
}

export function rsvpToEvent(id: string, going: boolean): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/api/scheduling/events/${id}/rsvp`, {
    method: 'PUT',
    body: JSON.stringify({ going }),
  })
}

export function getMyCalendar(from: Date, to: Date): Promise<CalendarItem[]> {
  const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  return apiFetch<CalendarItem[]>(`/api/scheduling/calendar/me?${query.toString()}`)
}

export async function getCalendarFeedUrl(): Promise<string | null> {
  return (await apiFetch<{ url: string | null }>('/api/scheduling/calendar/me/feed')).url
}

/** Creates the subscription link, or replaces it (the old link stops working). */
export async function rotateCalendarFeedUrl(): Promise<string> {
  return (await apiFetch<{ url: string }>('/api/scheduling/calendar/me/feed', { method: 'POST' })).url
}

/** Downloads the event as an .ics file. A plain link can't carry the bearer token, so this
 * fetches the file and hands the browser a blob URL. */
export async function downloadEventIcs(id: string, title: string): Promise<void> {
  const response = await fetch(`${getEnv('VITE_API_BASE_URL')}/api/scheduling/events/${id}/ics`, {
    headers: { 'X-Tenant-Id': getTenantId(), Authorization: `Bearer ${getAccessToken() ?? ''}` },
  })
  if (!response.ok) throw new ApiError(response.status, "Couldn't download the calendar file.")

  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.replace(/[^\w\- ]+/g, '').trim() || 'event'}.ics`
  link.click()
  URL.revokeObjectURL(url)
}
