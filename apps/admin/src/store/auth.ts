import { reactive } from 'vue'
import { apiFetch, postImpersonationToken, postToken } from '@/api/client'
import { applyTenantBranding } from '@/branding'
import {
  beginImpersonation,
  clearSession,
  endImpersonation,
  getExpiresAt,
  getImpersonationInfo,
  getStoredTenantId,
  getStoredUser,
  setSession,
  setStoredUser,
  type AuthUser,
  type ImpersonationInfo,
} from '@/api/session'

const state = reactive<{
  user: AuthUser | null
  impersonation: ImpersonationInfo | null
  activeTenantId: string | null
}>({
  user: getStoredUser(),
  impersonation: getImpersonationInfo(),
  activeTenantId: getStoredTenantId(),
})

// Nav items (e.g. "School Setup") that link into /tenants/:tenantId need to know which tenant is
// currently active and re-resolve when it changes - call this after anything that changes the
// stored tenant id outside of enterTenant/exitTenant (e.g. the ?tenantId= login flow).
export function syncActiveTenantId(): void {
  state.activeTenantId = getStoredTenantId()
}

export function getActiveTenantId(): string | null {
  return state.activeTenantId
}

export async function login(email: string, password: string): Promise<void> {
  const tokens = await postToken(
    new URLSearchParams({
      grant_type: 'password',
      username: email,
      password,
      client_id: 'roboacademy-spa',
      scope: 'openid profile email offline_access',
    }),
  )

  setSession({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  })

  const me = await apiFetch<{
    userId: string
    email: string
    fullName: string
    roles: string[]
    permissions: string[]
  }>('/api/identity/me')

  const user: AuthUser = {
    userId: me.userId,
    email: me.email,
    fullName: me.fullName,
    roles: me.roles,
    permissions: me.permissions,
  }
  setStoredUser(user)
  state.user = user
}

export function logout(): void {
  clearSession()
  state.user = null
}

export function isAuthenticated(): boolean {
  const expiresAt = getExpiresAt()
  return expiresAt !== null && Date.now() < expiresAt && state.user !== null
}

export function hasPermission(permission: string): boolean {
  return state.user?.permissions.includes(permission) ?? false
}

export function getCurrentUser(): AuthUser | null {
  return state.user
}

export function isImpersonating(): boolean {
  return state.impersonation !== null
}

export function getImpersonationTarget(): ImpersonationInfo | null {
  return state.impersonation
}

// Swaps the active session to one scoped to tenantId, stashing the caller's own session so
// exitTenant() can restore it. Requires the caller to already hold tenancy:impersonate - the
// backend enforces this too, but hasPermission('tenancy:impersonate') should gate the UI entry
// point so this never gets called without it.
export async function enterTenant(tenantId: string, tenantName: string): Promise<void> {
  if (state.impersonation) {
    throw new Error('Already viewing another tenant - exit first.')
  }
  const tokens = await postImpersonationToken(tenantId)
  beginImpersonation(
    {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    },
    tenantId,
    tenantName,
  )
  state.impersonation = { tenantId, tenantName }
  state.activeTenantId = tenantId
  await applyTenantBranding()
}

export async function exitTenant(): Promise<void> {
  endImpersonation()
  state.impersonation = null
  state.activeTenantId = getStoredTenantId()
  await applyTenantBranding()
}
