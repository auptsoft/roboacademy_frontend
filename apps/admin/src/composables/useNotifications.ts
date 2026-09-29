import { onBeforeUnmount, onMounted, reactive, readonly } from 'vue'
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/api/notifications'

const POLL_INTERVAL_MS = 60_000

// Same polling approach as apps/web's useNotifications: one module-level state shared by every
// consumer, refreshed every minute and whenever the tab becomes visible again.
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
    state.recent = (await getMyNotifications(1, 10)).items
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

async function markRead(item: Pick<NotificationItem, 'id' | 'readAt'>): Promise<void> {
  if (item.readAt) return
  const { readAt } = await markNotificationRead(item.id)
  for (const n of state.recent) if (n.id === item.id) n.readAt = readAt
  state.unreadCount = Math.max(0, state.unreadCount - 1)
}

async function markAllRead(): Promise<void> {
  await markAllNotificationsRead()
  const now = new Date().toISOString()
  for (const n of state.recent) n.readAt ??= now
  state.unreadCount = 0
}

export function useNotifications(options: { poll?: boolean } = {}) {
  if (options.poll) {
    onMounted(startPolling)
    onBeforeUnmount(stopPolling)
  }
  return { state: readonly(state), refreshUnreadCount, loadRecent, markRead, markAllRead }
}
