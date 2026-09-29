import { onBeforeUnmount, onMounted, reactive, readonly } from 'vue'
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/api/notifications'

const POLL_INTERVAL_MS = 60_000

// Module-level so the bell and the notifications page share one source of truth (same
// plain-reactive approach as store/auth.ts). Polling, not push: the planned WebSocket hub
// replaces this later without changing the consumers of this composable.
const state = reactive({
  unreadCount: 0,
  recent: [] as NotificationItem[],
  recentStatus: 'idle' as 'idle' | 'loading' | 'error',
})

let subscribers = 0
let timer: ReturnType<typeof setInterval> | undefined

async function refreshUnreadCount(): Promise<void> {
  try {
    state.unreadCount = await getUnreadNotificationCount()
  } catch {
    // Keep the last known count; the next poll retries.
  }
}

async function loadRecent(): Promise<void> {
  state.recentStatus = 'loading'
  try {
    const { data } = await getMyNotifications({ pageSize: 10 })
    state.recent = data
    state.recentStatus = 'idle'
  } catch {
    state.recentStatus = 'error'
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') void refreshUnreadCount()
}

function startPolling(): void {
  if (subscribers++ > 0) return
  void refreshUnreadCount()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') void refreshUnreadCount()
  }, POLL_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
}

function stopPolling(): void {
  if (--subscribers > 0) return
  clearInterval(timer)
  timer = undefined
  document.removeEventListener('visibilitychange', onVisibilityChange)
}

/** Marks one notification read and returns its readAt, or null when it already was. */
async function markRead(item: Pick<NotificationItem, 'id' | 'readAt'>): Promise<string | null> {
  if (item.readAt) return null
  const { readAt } = await markNotificationRead(item.id)
  for (const n of state.recent) if (n.id === item.id) n.readAt = readAt
  state.unreadCount = Math.max(0, state.unreadCount - 1)
  return readAt
}

async function markAllRead(): Promise<void> {
  await markAllNotificationsRead()
  const now = new Date().toISOString()
  for (const n of state.recent) n.readAt ??= now
  state.unreadCount = 0
}

/**
 * Shared notification state. Pass `{ poll: true }` from a component that lives for the whole
 * signed-in session (the top-bar bell) to keep the unread count fresh.
 */
export function useNotifications(options: { poll?: boolean } = {}) {
  if (options.poll) {
    onMounted(startPolling)
    onBeforeUnmount(stopPolling)
  }

  return {
    state: readonly(state),
    refreshUnreadCount,
    loadRecent,
    markRead,
    markAllRead,
  }
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/** "just now", "5 minutes ago", "yesterday", then a plain date after a week. */
export function formatNotificationTime(iso: string): string {
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'just now'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day')
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
