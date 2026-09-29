import { onMounted, ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { ApiError } from '@/api/client'
import { getTenantId } from '@/api/session'
import { getCurrentUser } from '@/store/auth'

// In-memory stale-while-revalidate cache. Lives for the page session, so navigating back to a
// page renders the last response instantly while a fresh request runs in the background.
// Keys are scoped per user and active tenant, so switching tenant (impersonation) or login
// never shows another scope's data.
const cache = new Map<string, unknown>()

export function clearQueryCache(): void {
  cache.clear()
}

export interface CachedQuery<T> {
  data: ShallowRef<T | undefined>
  loading: Ref<boolean>
  error: Ref<string>
  load: () => Promise<void>
}

export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { enabled?: boolean; errorMessage?: string } = {},
): CachedQuery<T> {
  const enabled = options.enabled ?? true
  const scopedKey = `${getCurrentUser()?.userId ?? 'anon'}:${getTenantId()}:${key}`
  const data = shallowRef(cache.get(scopedKey) as T | undefined)
  const loading = ref(enabled && !cache.has(scopedKey))
  const error = ref('')

  async function load() {
    if (!enabled) return
    // With a cached value on screen, refresh silently instead of flashing a loading state.
    if (!cache.has(scopedKey)) loading.value = true
    error.value = ''
    try {
      const result = await fetcher()
      cache.set(scopedKey, result)
      data.value = result
    } catch (e) {
      // A failed background refresh keeps showing the stale data rather than an error.
      if (!cache.has(scopedKey)) {
        error.value = e instanceof ApiError ? e.message : (options.errorMessage ?? 'Failed to load.')
      }
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  return { data, loading, error, load }
}
