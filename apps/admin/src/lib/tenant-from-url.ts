import { ref } from 'vue'
import type { LocationQuery } from 'vue-router'
import { getTenantId, setStoredTenantId } from '@/api/session'
import { resolveTenantSlug } from '@/api/tenancy'
import { applyTenantBranding } from '@/branding'
import { isAuthenticated, logout, syncActiveTenantId } from '@/store/auth'

// Slug -> tenant id, per browser tab, so navigating with ?t= still on the URL doesn't refetch.
const SLUG_CACHE_PREFIX = 'roboacademy_admin_tenant_slug:'

// Set when a ?t= link names a tenant that doesn't exist (or is inactive); the login page shows it.
export const tenantLookupError = ref('')

function queryValue(query: LocationQuery, key: string): string | null {
  const raw = query[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function tenantIdForSlug(slug: string): Promise<string | null> {
  const cacheKey = SLUG_CACHE_PREFIX + slug.toLowerCase()
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) return cached
  } catch {
    // Storage unavailable (private mode etc.) - just resolve every time.
  }

  try {
    const { tenantId } = await resolveTenantSlug(slug)
    try {
      sessionStorage.setItem(cacheKey, tenantId)
    } catch {
      // See above.
    }
    return tenantId
  } catch {
    return null
  }
}

// Picks the tenant from a shareable link: ?t=<slug> (preferred) or the older ?tenantId=<guid>.
// Run from the router guard, before any redirect drops the query. Switching to a different
// tenant signs the user out (ending any impersonation too), since their tokens are bound to the
// tenant they signed in to.
export async function captureTenantFromQuery(query: LocationQuery): Promise<void> {
  const slug = queryValue(query, 't')
  const tenantId = slug ? await tenantIdForSlug(slug) : queryValue(query, 'tenantId')

  if (!tenantId) {
    if (slug) tenantLookupError.value = "We couldn't find that school. Please check the link and try again."
    return
  }
  tenantLookupError.value = ''

  if (tenantId === getTenantId()) return

  if (isAuthenticated()) {
    logout()
  }
  setStoredTenantId(tenantId)
  syncActiveTenantId()
  void applyTenantBranding()
}
