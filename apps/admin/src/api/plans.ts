import { apiFetch } from '@/api/client'

export type PlanEnforcementMode = 'Hard' | 'Soft'
export type SubscriptionState = 'Active' | 'Expiring' | 'Grace' | 'Locked'

export interface PlanLimitDefinition {
  key: string
  label: string
  description: string
}

export interface PlanFeatureDefinition extends PlanLimitDefinition {
  defaultEnabled: boolean
}

export interface PlanCatalog {
  limits: PlanLimitDefinition[]
  features: PlanFeatureDefinition[]
}

// Limits and features always carry the full catalog; a null limit means unlimited.
export interface Plan {
  planId: string
  name: string
  code: string
  description: string | null
  enforcementMode: PlanEnforcementMode
  defaultGraceDays: number
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  limits: Record<string, number | null>
  features: Record<string, boolean>
  tenantCount: number
  createdAt: string
  updatedAt: string
}

export interface PlanRequest {
  name: string
  code: string
  description: string | null
  enforcementMode: PlanEnforcementMode
  defaultGraceDays: number
  sortOrder: number
  limits: Record<string, number | null>
  features: Record<string, boolean>
}

export interface PlanSubscribedTenant {
  tenantId: string
  name: string
  slug: string
  startsAt: string
  endsAt: string | null
  state: SubscriptionState
}

export interface TenantEntitlements {
  tenantId: string
  planId: string
  planName: string
  planCode: string
  enforcementMode: PlanEnforcementMode
  subscriptionId: string | null
  startsAt: string | null
  endsAt: string | null
  graceDays: number
  lockedAt: string | null
  state: SubscriptionState
  limits: Record<string, number | null>
  features: Record<string, boolean>
}

export interface SubscriptionHistoryItem {
  subscriptionId: string
  planId: string
  planName: string
  startsAt: string
  endsAt: string | null
  graceDaysOverride: number | null
  notes: string | null
  assignedByUserId: string | null
  isCurrent: boolean
  supersededAt: string | null
}

export interface LimitOverride {
  key: string
  value: number | null
}

export interface FeatureOverride {
  key: string
  enabled: boolean
}

// Overrides, notes, and history are only returned to holders of tenancy:plans:manage.
export interface TenantSubscription {
  entitlements: TenantEntitlements
  graceDaysOverride: number | null
  notes: string | null
  limitOverrides: LimitOverride[] | null
  featureOverrides: FeatureOverride[] | null
  history: SubscriptionHistoryItem[] | null
}

export interface LimitUsage {
  key: string
  label: string
  limit: number | null
  used: number
  atLimit: boolean
  overLimit: boolean
}

export interface TenantUsage {
  tenantId: string
  planName: string
  enforcementMode: PlanEnforcementMode
  state: SubscriptionState
  limits: LimitUsage[]
  features: Record<string, boolean>
}

export interface AssignSubscriptionRequest {
  planId: string
  startsAt?: string | null
  endsAt: string | null
  graceDaysOverride: number | null
  notes: string | null
}

const base = '/api/admin/tenancy'

export function getPlanCatalog(): Promise<PlanCatalog> {
  return apiFetch<PlanCatalog>(`${base}/plans/catalog`)
}

export function listPlans(includeArchived = true): Promise<Plan[]> {
  return apiFetch<Plan[]>(`${base}/plans?includeArchived=${includeArchived}`)
}

export function getPlan(planId: string): Promise<{ plan: Plan; tenants: PlanSubscribedTenant[] }> {
  return apiFetch<{ plan: Plan; tenants: PlanSubscribedTenant[] }>(`${base}/plans/${planId}`)
}

export function createPlan(request: PlanRequest): Promise<Plan> {
  return apiFetch<Plan>(`${base}/plans`, { method: 'POST', body: JSON.stringify(request) })
}

export function updatePlan(planId: string, request: PlanRequest): Promise<Plan> {
  return apiFetch<Plan>(`${base}/plans/${planId}`, { method: 'PUT', body: JSON.stringify(request) })
}

export function archivePlan(planId: string): Promise<unknown> {
  return apiFetch(`${base}/plans/${planId}/archive`, { method: 'POST' })
}

export function restorePlan(planId: string): Promise<unknown> {
  return apiFetch(`${base}/plans/${planId}/restore`, { method: 'POST' })
}

export function makeDefaultPlan(planId: string): Promise<unknown> {
  return apiFetch(`${base}/plans/${planId}/make-default`, { method: 'POST' })
}

export function getTenantSubscription(tenantId: string): Promise<TenantSubscription> {
  return apiFetch<TenantSubscription>(`${base}/tenants/${tenantId}/subscription`)
}

// Same plan as the current one renews/extends its term in place; a different plan starts a
// new subscription and keeps the old one in history.
export function assignTenantSubscription(
  tenantId: string,
  request: AssignSubscriptionRequest,
): Promise<TenantEntitlements> {
  return apiFetch<TenantEntitlements>(`${base}/tenants/${tenantId}/subscription`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function endTenantSubscription(tenantId: string): Promise<TenantEntitlements> {
  return apiFetch<TenantEntitlements>(`${base}/tenants/${tenantId}/subscription`, { method: 'DELETE' })
}

export function setTenantOverrides(
  tenantId: string,
  request: { limits: LimitOverride[]; features: FeatureOverride[] },
): Promise<TenantEntitlements> {
  return apiFetch<TenantEntitlements>(`${base}/tenants/${tenantId}/overrides`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function getTenantUsage(tenantId: string): Promise<TenantUsage> {
  return apiFetch<TenantUsage>(`${base}/tenants/${tenantId}/usage`)
}

// The current tenant's term, for any signed-in member. Reachable while the tenant is locked.
export interface SubscriptionStatus {
  planName: string
  state: SubscriptionState
  endsAt: string | null
  graceDays: number
  lockedAt: string | null
}

export function getMySubscriptionStatus(): Promise<SubscriptionStatus> {
  return apiFetch<SubscriptionStatus>('/api/tenancy/subscription')
}
