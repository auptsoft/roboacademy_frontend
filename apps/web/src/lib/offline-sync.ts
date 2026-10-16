import { ref } from 'vue'
import { ApiError } from '@/api/client'
import { recordBlockResponse, recordLessonProgress } from '@/api/learning'
import { getCurrentUser } from '@/store/auth'
import { outboxAdd, outboxDelete, outboxList, type OutboxEntry } from './offline-store'

/** Entries waiting to be sent for the signed-in user. */
export const pendingSyncCount = ref(0)
export const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

const RETRY_INTERVAL_MS = 60_000
let flushing: Promise<boolean> | null = null
let started = false

type NewEntry = OutboxEntry extends infer E ? E extends OutboxEntry ? Omit<E, 'id' | 'userId' | 'queuedAt'> : never : never

/** Queues work for the server and tries to send it straight away. True if it's been sent. */
export async function enqueue(entry: NewEntry): Promise<boolean> {
  const userId = getCurrentUser()?.userId
  if (!userId) return false
  await outboxAdd({ ...entry, userId, queuedAt: Date.now() } as OutboxEntry)
  return flushOutbox()
}

/**
 * Sends the queue oldest first, so a lesson's answers always reach the server before its
 * completion (which the server refuses without them). Stops at the first network failure and
 * tries again later. A request the server rejects for good (4xx) is dropped, or it would block
 * everything behind it. True when nothing is left to send.
 */
export function flushOutbox(): Promise<boolean> {
  flushing ??= (async () => {
    try {
      const userId = getCurrentUser()?.userId
      if (!userId) return false
      for (const entry of await outboxList(userId)) {
        const outcome = await send(entry)
        if (outcome === 'retry') break
        await outboxDelete(entry.id!)
      }
      const left = (await outboxList(userId)).length
      pendingSyncCount.value = left
      return left === 0
    } finally {
      flushing = null
    }
  })()
  return flushing
}

async function send(entry: OutboxEntry): Promise<'sent' | 'dropped' | 'retry'> {
  try {
    if (entry.kind === 'answer') {
      await recordBlockResponse(entry.courseId, entry.lessonId, entry.payload as Parameters<typeof recordBlockResponse>[2])
    } else {
      await recordLessonProgress(entry.courseId, [entry.lessonId], true)
    }
    return 'sent'
  } catch (error) {
    // No response at all (offline), a server error, or a signed-out session: try again later.
    if (!(error instanceof ApiError) || error.status >= 500 || error.status === 401 || error.status === 408 || error.status === 429) {
      return 'retry'
    }
    console.warn('Dropped a queued request the server rejected:', entry.kind, error.message)
    return 'dropped'
  }
}

/** Starts syncing: now, whenever the browser reconnects, and every minute while work is waiting. */
export function startOfflineSync(): void {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', () => {
    isOnline.value = true
    void flushOutbox()
  })
  window.addEventListener('offline', () => (isOnline.value = false))
  setInterval(() => {
    if (pendingSyncCount.value > 0) void flushOutbox()
  }, RETRY_INTERVAL_MS)
  void flushOutbox()
}
