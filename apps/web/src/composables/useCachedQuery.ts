import { onMounted, ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { getCurrentUser } from '@/store/auth'

// In-memory stale-while-revalidate cache. Lives for the page session, so navigating back to a
// page renders the last response instantly while a fresh request runs in the background.
// Keys are scoped per user so a different login never sees someone else's data.
const cache = new Map<string, unknown>()

export function clearQueryCache(): void {
  cache.clear()
}

export type QueryStatus = 'loading' | 'idle' | 'error'

export interface CachedQuery<T> {
  data: ShallowRef<T | undefined>
  status: Ref<QueryStatus>
  load: () => Promise<void>
}

export function useCachedQuery<T>(key: string, fetcher: () => Promise<T>): CachedQuery<T> {
  const scopedKey = `${getCurrentUser()?.userId ?? 'anon'}:${key}`
  const data = shallowRef(cache.get(scopedKey) as T | undefined)
  const status = ref<QueryStatus>(cache.has(scopedKey) ? 'idle' : 'loading')

  async function load() {
    // With a cached value on screen, refresh silently instead of flashing a loading state.
    if (!cache.has(scopedKey)) status.value = 'loading'
    try {
      const result = await fetcher()
      cache.set(scopedKey, result)
      data.value = result
      status.value = 'idle'
    } catch {
      // A failed background refresh keeps showing the stale data rather than an error.
      if (!cache.has(scopedKey)) status.value = 'error'
    }
  }

  onMounted(load)

  return { data, status, load }
}
