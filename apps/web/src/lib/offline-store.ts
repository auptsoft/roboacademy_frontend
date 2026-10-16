/**
 * The device's offline store (IndexedDB), so a flaky connection doesn't lose a learner's work:
 *
 * - outbox: answers and lesson completions waiting to be sent, in the order they happened.
 * - kv: the last good copy of a course and its progress, to reopen a lesson without a network.
 * - assets: lesson files (images, audio, downloads, models) kept for reading again offline.
 *
 * Everything is per user. Every call is best-effort: with IndexedDB unavailable (private mode,
 * blocked storage) the app works as before, just without the offline safety net.
 */

const DB_NAME = 'roboacademy-offline'
const DB_VERSION = 1

/** Files bigger than this aren't cached (video, mostly): they'd crowd out everything else. */
export const MAX_CACHED_ASSET_BYTES = 15 * 1024 * 1024
/** Total cached files per device; the least recently used go first. */
const MAX_TOTAL_ASSET_BYTES = 150 * 1024 * 1024

export type OutboxEntry =
  | { id?: number; userId: string; kind: 'answer'; courseId: string; lessonId: string; payload: Record<string, unknown>; queuedAt: number }
  | { id?: number; userId: string; kind: 'progress'; courseId: string; lessonId: string; queuedAt: number }

interface CachedAsset {
  key: string
  blob: Blob
  size: number
  usedAt: number
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function db(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        database.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
        database.createObjectStore('kv')
        database.createObjectStore('assets', { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

async function run<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const database = await db()
  if (!database) return undefined
  return new Promise((resolve) => {
    try {
      const request = action(database.transaction(store, mode).objectStore(store))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

// ── outbox ────────────────────────────────────────────────────────────────

export async function outboxAdd(entry: OutboxEntry): Promise<void> {
  await run('outbox', 'readwrite', s => s.add(entry))
}

/** This user's queued entries, oldest first. */
export async function outboxList(userId: string): Promise<OutboxEntry[]> {
  const all = (await run<OutboxEntry[]>('outbox', 'readonly', s => s.getAll())) ?? []
  return all.filter(e => e.userId === userId).sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
}

export async function outboxDelete(id: number): Promise<void> {
  await run('outbox', 'readwrite', s => s.delete(id))
}

// ── kv ────────────────────────────────────────────────────────────────────

export async function kvGet<T>(userId: string, key: string): Promise<T | undefined> {
  return run<T>('kv', 'readonly', s => s.get(`${userId}:${key}`))
}

export async function kvSet(userId: string, key: string, value: unknown): Promise<void> {
  // Through JSON: reactive proxies can't be structured-cloned.
  await run('kv', 'readwrite', s => s.put(JSON.parse(JSON.stringify(value)), `${userId}:${key}`))
}

// ── assets ────────────────────────────────────────────────────────────────

export async function assetGet(key: string): Promise<Blob | undefined> {
  const cached = await run<CachedAsset>('assets', 'readonly', s => s.get(key))
  if (!cached) return undefined
  void run('assets', 'readwrite', s => s.put({ ...cached, usedAt: Date.now() }))
  return cached.blob
}

export async function assetPut(key: string, blob: Blob): Promise<void> {
  if (blob.size > MAX_CACHED_ASSET_BYTES) return
  await run('assets', 'readwrite', s => s.put({ key, blob, size: blob.size, usedAt: Date.now() } satisfies CachedAsset))
  await evictAssets()
}

async function evictAssets(): Promise<void> {
  const all = (await run<CachedAsset[]>('assets', 'readonly', s => s.getAll())) ?? []
  let total = all.reduce((sum, a) => sum + a.size, 0)
  for (const asset of all.sort((a, b) => a.usedAt - b.usedAt)) {
    if (total <= MAX_TOTAL_ASSET_BYTES) break
    await run('assets', 'readwrite', s => s.delete(asset.key))
    total -= asset.size
  }
}

/** On sign-out: drop cached courses and files (another person may use this device next). The
 * outbox stays, so unsent work syncs when its owner signs in again. */
export async function clearOfflineCache(): Promise<void> {
  await run('kv', 'readwrite', s => s.clear())
  await run('assets', 'readwrite', s => s.clear())
}
