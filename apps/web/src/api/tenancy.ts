import { apiFetch } from '@/api/client'
import { getEnv } from '@/lib/runtime-env'

export interface TenantBranding {
  name: string
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  welcomeMessage: string | null
  featureImageUrl: string | null
  tagline: string | null
  allowRegistration: boolean
  // Plan features the tenant has; absent on the local default branding, which means all on.
  features?: Record<string, boolean>
  // True once the school's subscription has lapsed past its grace period; sign-in is refused
  // for everyone but its admins.
  accessLocked?: boolean
}

export function getTenantBranding(tenantId: string): Promise<TenantBranding> {
  return apiFetch<TenantBranding>('/api/tenancy/branding', {
    headers: { 'X-Tenant-Id': tenantId },
  })
}

export interface ResolvedTenant {
  tenantId: string
  name: string
  slug: string
}

// Looks a tenant up by its slug (the ?t=<slug> link). The lookup isn't scoped to a tenant, but
// every /api request must resolve to one, so it is addressed as the platform tenant - not the
// stored one, which may be stale or belong to the tenant being switched away from.
export function resolveTenantSlug(slug: string): Promise<ResolvedTenant> {
  return apiFetch<ResolvedTenant>(`/api/tenancy/resolve/${encodeURIComponent(slug)}`, {
    headers: { 'X-Tenant-Id': getEnv('VITE_PLATFORM_TENANT_ID') },
  })
}
