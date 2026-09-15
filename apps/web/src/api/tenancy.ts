import { apiFetch } from '@/api/client'

export interface TenantBranding {
  name: string
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  welcomeMessage: string | null
  featureImageUrl: string | null
  tagline: string | null
  allowRegistration: boolean
}

export function getTenantBranding(tenantId: string): Promise<TenantBranding> {
  return apiFetch<TenantBranding>('/api/tenancy/branding', {
    headers: { 'X-Tenant-Id': tenantId },
  })
}
