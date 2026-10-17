import { apiErrorFrom, apiFetch, apiFetchPaged, apiUrl, type PageMeta } from '@/api/client'
import { getEnv } from '@/lib/runtime-env'
import { appendAuditLogFilterParams, type AuditLogFilters } from '@/api/identity'
import type { SubscriptionState } from '@/api/plans'

export interface HostInfo {
  host: string
  isVerified: boolean
}

export interface TenantPlanSummary {
  planId: string
  planName: string
  planCode: string
  state: SubscriptionState
  endsAt: string | null
  lockedAt: string | null
}

export interface Tenant {
  tenantId: string
  name: string
  slug: string
  isActive: boolean
  allowRegistration: boolean
  hosts: HostInfo[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  plan?: TenantPlanSummary | null
}

interface TenantMutationResponse {
  tenantId: string
  isActive: boolean
}

interface HostsMutationResponse {
  tenantId: string
  hosts: HostInfo[]
}

export interface TenantBrandingFields {
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  welcomeMessage: string | null
  featureImageUrl: string | null
  tagline: string | null
}

export interface TenantBranding extends TenantBrandingFields {
  name: string
  allowRegistration?: boolean
  features?: Record<string, boolean>
}

export function listTenants(
  page = 1,
  pageSize = 20,
  state?: SubscriptionState | null,
): Promise<{ items: Tenant[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (state) params.set('state', state)
  return apiFetchPaged<Tenant>(`/api/admin/tenancy/tenants?${params}`)
}

// Unlike listTenants (platform-wide, tenancy:manage only), this works for a ManageOwn-only
// caller (e.g. SchoolAdmin) as long as tenantId is their own tenant.
export function getTenant(tenantId: string): Promise<Tenant> {
  return apiFetch<Tenant>(`/api/admin/tenancy/tenants/${tenantId}`)
}

export function updateTenant(
  tenantId: string,
  request: { name: string; slug: string; allowRegistration: boolean },
): Promise<Tenant> {
  return apiFetch<Tenant>(`/api/admin/tenancy/tenants/${tenantId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function createTenant(request: { name: string; slug: string; hosts?: string[] }): Promise<Tenant> {
  return apiFetch<Tenant>('/api/admin/tenancy/tenants', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function deactivateTenant(tenantId: string): Promise<TenantMutationResponse> {
  return apiFetch<TenantMutationResponse>(`/api/admin/tenancy/tenants/${tenantId}`, {
    method: 'DELETE',
  })
}

export function reactivateTenant(tenantId: string): Promise<TenantMutationResponse> {
  return apiFetch<TenantMutationResponse>(`/api/admin/tenancy/tenants/${tenantId}/reactivate`, {
    method: 'POST',
  })
}

export function addHost(tenantId: string, host: string): Promise<HostsMutationResponse> {
  return apiFetch<HostsMutationResponse>(`/api/admin/tenancy/tenants/${tenantId}/hosts`, {
    method: 'POST',
    body: JSON.stringify({ host }),
  })
}

export function removeHost(tenantId: string, host: string): Promise<HostsMutationResponse> {
  return apiFetch<HostsMutationResponse>(
    `/api/admin/tenancy/tenants/${tenantId}/hosts/${encodeURIComponent(host)}`,
    { method: 'DELETE' },
  )
}

export function verifyHost(tenantId: string, host: string): Promise<HostsMutationResponse> {
  return apiFetch<HostsMutationResponse>(
    `/api/admin/tenancy/tenants/${tenantId}/hosts/${encodeURIComponent(host)}/verify`,
    { method: 'POST' },
  )
}

// The public branding read is resolved by X-Tenant-Id/Host, not a path param, so we override
// the header for this one call to read a specific tenant's branding rather than our own. It is
// sent anonymously: the endpoint needs no token, and a platform admin's token (issued for the
// platform tenant) addressed to a school would be refused by the backend's token/tenant guard.
export async function getTenantBranding(tenantId: string): Promise<TenantBranding> {
  const response = await fetch(apiUrl('/api/tenancy/branding'), {
    headers: { 'X-Tenant-Id': tenantId },
  })
  const envelope = await response.json().catch(() => null)
  if (!response.ok || envelope?.isSuccessful === false) {
    throw apiErrorFrom(response.status, envelope, 'Failed to load branding.')
  }
  return envelope.data as TenantBranding
}

export function updateTenantBranding(
  tenantId: string,
  request: TenantBrandingFields,
): Promise<TenantBrandingFields> {
  return apiFetch<TenantBrandingFields>(`/api/admin/tenancy/tenants/${tenantId}/branding`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

// Stores the file and hands back its URL only - it does not itself save the tenant's LogoUrl,
// so the caller still needs to submit that URL through updateTenantBranding.
export function uploadTenantLogo(tenantId: string, file: File): Promise<{ logoUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<{ logoUrl: string }>(`/api/admin/tenancy/tenants/${tenantId}/branding/logo`, {
    method: 'POST',
    body: formData,
  })
}

// Stores the file and hands back its URL only - it does not itself save the tenant's
// FeatureImageUrl, so the caller still needs to submit that URL through updateTenantBranding.
export function uploadTenantFeatureImage(tenantId: string, file: File): Promise<{ featureImageUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<{ featureImageUrl: string }>(`/api/admin/tenancy/tenants/${tenantId}/branding/feature-image`, {
    method: 'POST',
    body: formData,
  })
}

export interface AuditLogItem {
  id: string
  tenantId: string | null
  userId: string | null
  entityType: string
  entityId: string
  action: string
  changes: string | null
  occurredAt: string
}

export function getTenantAuditLog(
  tenantId: string,
  page = 1,
  pageSize = 20,
  filters: AuditLogFilters = {},
): Promise<{ items: AuditLogItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ tenantId, page: String(page), pageSize: String(pageSize) })
  appendAuditLogFilterParams(params, filters)
  return apiFetchPaged<AuditLogItem>(`/api/admin/tenancy/audit?${params.toString()}`)
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

// Looks a tenant up by one of its hostnames, for an app served on the school's own domain (see
// lib/tenant-from-host.ts). Addressed as the platform tenant for the same reason as the slug lookup.
export function resolveTenantHost(host: string): Promise<ResolvedTenant> {
  return apiFetch<ResolvedTenant>(`/api/tenancy/resolve-host/${encodeURIComponent(host)}`, {
    headers: { 'X-Tenant-Id': getEnv('VITE_PLATFORM_TENANT_ID') },
  })
}
