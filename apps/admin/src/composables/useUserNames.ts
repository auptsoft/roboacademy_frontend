import { reactive, watch, type MaybeRefOrGetter, toValue } from 'vue'
import { getUser } from '@/api/identity'
import { getCurrentUser, hasPermission } from '@/store/auth'

export interface UserName {
  fullName: string
  email: string
}

// Module-level so every timeline on every screen shares one lookup per user. null = looked up and
// unavailable (deleted user, or another tenant's user we can't read).
const cache = reactive(new Map<string, UserName | null>())
const inFlight = new Set<string>()

async function resolve(userId: string) {
  if (cache.has(userId) || inFlight.has(userId)) return
  inFlight.add(userId)
  try {
    const user = await getUser(userId)
    cache.set(userId, { fullName: user.fullName, email: user.email })
  } catch {
    cache.set(userId, null)
  } finally {
    inFlight.delete(userId)
  }
}

// Resolves display names for audit actors. Reading a user needs identity:users:manage; callers
// without it (e.g. PlatformSupport, who can still read the audit log) fall back to a short id.
export function useUserNames(userIds: MaybeRefOrGetter<(string | null)[]>) {
  const me = getCurrentUser()
  const canLookUp = hasPermission('identity:users:manage')

  watch(
    () => toValue(userIds),
    (ids) => {
      if (!canLookUp) return
      for (const id of new Set(ids)) {
        if (id && id !== me?.userId) resolve(id)
      }
    },
    { immediate: true },
  )

  function nameFor(userId: string | null): string {
    if (!userId) return 'System'
    if (userId === me?.userId) return 'You'
    return cache.get(userId)?.fullName ?? `User ${userId.slice(0, 8)}`
  }

  function emailFor(userId: string | null): string | null {
    if (!userId) return null
    if (userId === me?.userId) return me.email
    return cache.get(userId)?.email ?? null
  }

  return { nameFor, emailFor }
}
