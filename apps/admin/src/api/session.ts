export interface AuthUser {
  userId: string
  email: string
  fullName: string
  roles: string[]
  permissions: string[]
}

const ACCESS_TOKEN_KEY = 'roboacademy_admin_access_token'
const REFRESH_TOKEN_KEY = 'roboacademy_admin_refresh_token'
const EXPIRES_AT_KEY = 'roboacademy_admin_expires_at'
const USER_KEY = 'roboacademy_admin_user'
const TENANT_ID_KEY = 'roboacademy_admin_tenant_id'

// While impersonating a tenant (see beginImpersonation), the platform admin's own session is
// stashed under these keys so exiting can restore it without a fresh login.
const HOME_ACCESS_TOKEN_KEY = 'roboacademy_admin_home_access_token'
const HOME_REFRESH_TOKEN_KEY = 'roboacademy_admin_home_refresh_token'
const HOME_EXPIRES_AT_KEY = 'roboacademy_admin_home_expires_at'
const HOME_TENANT_ID_KEY = 'roboacademy_admin_home_tenant_id'
const IMPERSONATION_KEY = 'roboacademy_admin_impersonation'

export interface ImpersonationInfo {
  tenantId: string
  tenantName: string
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function getExpiresAt(): number | null {
  const raw = localStorage.getItem(EXPIRES_AT_KEY)
  return raw ? Number(raw) : null
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? (JSON.parse(raw) as AuthUser) : null
}

export function setSession(tokens: { accessToken: string; refreshToken: string; expiresAt: number }): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  localStorage.setItem(EXPIRES_AT_KEY, String(tokens.expiresAt))
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredTenantId(): string | null {
  return localStorage.getItem(TENANT_ID_KEY)
}

export function setStoredTenantId(tenantId: string): void {
  localStorage.setItem(TENANT_ID_KEY, tenantId)
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(EXPIRES_AT_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(HOME_ACCESS_TOKEN_KEY)
  localStorage.removeItem(HOME_REFRESH_TOKEN_KEY)
  localStorage.removeItem(HOME_EXPIRES_AT_KEY)
  localStorage.removeItem(HOME_TENANT_ID_KEY)
  localStorage.removeItem(IMPERSONATION_KEY)
}

// Stashes the caller's current (home) session under the HOME_* keys, then swaps the live session
// to the impersonation tokens scoped to targetTenantId. Only valid when not already impersonating
// (enforced by the caller - see store/auth.ts#enterTenant) so the stash never gets clobbered.
export function beginImpersonation(
  tokens: { accessToken: string; refreshToken: string; expiresAt: number },
  tenantId: string,
  tenantName: string,
): void {
  const homeAccessToken = getAccessToken()
  const homeRefreshToken = getRefreshToken()
  const homeExpiresAt = getExpiresAt()
  const homeTenantId = getStoredTenantId()
  if (homeAccessToken) localStorage.setItem(HOME_ACCESS_TOKEN_KEY, homeAccessToken)
  if (homeRefreshToken) localStorage.setItem(HOME_REFRESH_TOKEN_KEY, homeRefreshToken)
  if (homeExpiresAt !== null) localStorage.setItem(HOME_EXPIRES_AT_KEY, String(homeExpiresAt))
  if (homeTenantId) localStorage.setItem(HOME_TENANT_ID_KEY, homeTenantId)

  setSession(tokens)
  setStoredTenantId(tenantId)
  localStorage.setItem(IMPERSONATION_KEY, JSON.stringify({ tenantId, tenantName }))
}

export function getImpersonationInfo(): ImpersonationInfo | null {
  const raw = localStorage.getItem(IMPERSONATION_KEY)
  return raw ? (JSON.parse(raw) as ImpersonationInfo) : null
}

// Restores the stashed home session and clears impersonation state.
export function endImpersonation(): void {
  const homeAccessToken = localStorage.getItem(HOME_ACCESS_TOKEN_KEY)
  const homeRefreshToken = localStorage.getItem(HOME_REFRESH_TOKEN_KEY)
  const homeExpiresAt = localStorage.getItem(HOME_EXPIRES_AT_KEY)
  const homeTenantId = localStorage.getItem(HOME_TENANT_ID_KEY)

  if (homeAccessToken) localStorage.setItem(ACCESS_TOKEN_KEY, homeAccessToken)
  if (homeRefreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, homeRefreshToken)
  if (homeExpiresAt) localStorage.setItem(EXPIRES_AT_KEY, homeExpiresAt)
  if (homeTenantId) localStorage.setItem(TENANT_ID_KEY, homeTenantId)

  localStorage.removeItem(HOME_ACCESS_TOKEN_KEY)
  localStorage.removeItem(HOME_REFRESH_TOKEN_KEY)
  localStorage.removeItem(HOME_EXPIRES_AT_KEY)
  localStorage.removeItem(HOME_TENANT_ID_KEY)
  localStorage.removeItem(IMPERSONATION_KEY)
}
