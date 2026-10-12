import { computed } from 'vue'
import { getTenantId } from '@/api/client'
import { getTenantUsage, type LimitUsage } from '@/api/plans'
import { hasPermission } from '@/store/auth'
import { getEnv } from '@/lib/runtime-env'
import { useCachedQuery } from '@/composables/useCachedQuery'

const PLATFORM_TENANT_ID = getEnv('VITE_PLATFORM_TENANT_ID')

/**
 * The active tenant's usage against its plan, for disabling create buttons and showing limit
 * banners. Only loaded for callers who can read it (tenancy:manage-own, i.e. school admins and
 * platform admins) and never for the platform tenant, which is uncapped. Everyone else gets
 * nothing here and relies on the API's limit_exceeded error, which ApiError already words.
 * Call `load()` after creating something counted so the numbers stay current.
 */
export function useTenantUsage() {
  const tenantId = getTenantId()
  const enabled = hasPermission('tenancy:manage-own') && tenantId !== PLATFORM_TENANT_ID

  const { data: usage, load } = useCachedQuery('tenant-usage', () => getTenantUsage(tenantId), { enabled })

  function limit(key: string): LimitUsage | undefined {
    return usage.value?.limits.find((l) => l.key === key)
  }

  /** True when creating one more of `key` would be refused (hard plan, at or over the cap). */
  function isBlocked(key: string): boolean {
    const entry = limit(key)
    return !!entry && usage.value?.enforcementMode === 'Hard' && entry.atLimit
  }

  /** Limits worth a banner: anything at its cap, plus soft-plan overruns. */
  const attentionLimits = computed(() =>
    (usage.value?.limits ?? []).filter((l) => l.limit !== null && (l.atLimit || l.overLimit)),
  )

  return { usage, load, limit, isBlocked, attentionLimits }
}
