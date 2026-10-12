import { ApiError } from '@/api/client'
import { getStoredTenantId, setStoredTenantId } from '@/api/session'
import { resolveTenantHost } from '@/api/tenancy'
import { getEnv } from '@/lib/runtime-env'
import { isAuthenticated, logout } from '@/store/auth'

// Host -> tenant id for this tab, so a reload doesn't wait on the lookup again.
const HOST_CACHE_KEY = 'roboacademy_web_tenant_host'

// platform: served on the platform's own hostname, tenant selection works as before (?t= links,
// stored id, platform fallback). resolved: a tenant's own domain, now the stored tenant.
// unknown: no active tenant owns this hostname. unreachable: the lookup itself failed.
export type HostTenantResult = 'platform' | 'resolved' | 'unknown' | 'unreachable'

function normaliseHost(host: string): string {
  return host.trim().replace(/\.$/, '').toLowerCase()
}

// VITE_PLATFORM_HOSTS lists the platform's own hostnames; anything else is a tenant's domain.
// Left empty, every hostname counts as the platform - local dev and older deployments.
export function isPlatformHost(host: string = window.location.hostname): boolean {
  const platformHosts = getEnv('VITE_PLATFORM_HOSTS').split(',').map(normaliseHost).filter(Boolean)
  return platformHosts.length === 0 || platformHosts.includes(normaliseHost(host))
}

// Run once before the app mounts, ahead of anything that sends X-Tenant-Id. On a tenant's own
// domain the hostname decides the tenant outright: it overrides whatever id is stored, and
// signs out a session that belongs to a different tenant.
export async function resolveTenantFromHost(): Promise<HostTenantResult> {
  if (isPlatformHost()) return 'platform'

  const host = normaliseHost(window.location.hostname)
  let tenantId: string | null = null
  try {
    tenantId = sessionStorage.getItem(HOST_CACHE_KEY)
  } catch {
    // Storage unavailable (private mode etc.) - just resolve every time.
  }

  if (!tenantId) {
    try {
      tenantId = (await resolveTenantHost(host)).tenantId
    } catch (error) {
      return error instanceof ApiError && error.status === 404 ? 'unknown' : 'unreachable'
    }
    try {
      sessionStorage.setItem(HOST_CACHE_KEY, tenantId)
    } catch {
      // See above.
    }
  }

  if (tenantId !== getStoredTenantId() && isAuthenticated()) {
    logout()
  }
  setStoredTenantId(tenantId)
  return 'resolved'
}
