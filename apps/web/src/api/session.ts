export interface AuthUser {
  userId: string
  email: string
  fullName: string
  roles: string[]
  permissions: string[]
}

const ACCESS_TOKEN_KEY = 'roboacademy_web_access_token'
const REFRESH_TOKEN_KEY = 'roboacademy_web_refresh_token'
const EXPIRES_AT_KEY = 'roboacademy_web_expires_at'
const USER_KEY = 'roboacademy_web_user'
const TENANT_ID_KEY = 'roboacademy_web_tenant_id'

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
}
