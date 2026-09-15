import { clearSession, getAccessToken, getStoredTenantId } from '@/api/session'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const PLATFORM_TENANT_ID = import.meta.env.VITE_PLATFORM_TENANT_ID

// The tenant to address is captured from ?tenantId= on the login page (see login.vue) and
// persisted to localStorage, so it sticks across navigation regardless of the current URL.
export function getTenantId(): string {
  return getStoredTenantId() || PLATFORM_TENANT_ID
}

export class ApiError extends Error {
  status: number
  fieldErrors?: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export interface PageMeta {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

interface ApiEnvelope<T> {
  isSuccessful: boolean
  message: string
  data: T | { errors?: Record<string, string[]> } | null
  meta?: PageMeta
}

async function parseEnvelope(response: Response): Promise<ApiEnvelope<unknown> | null> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as ApiEnvelope<unknown>
  } catch {
    return null
  }
}

function handleUnauthorized(): void {
  clearSession()
  window.location.href = '/login'
}

async function apiFetchEnvelope<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers)
  if (!headers.has('X-Tenant-Id')) {
    headers.set('X-Tenant-Id', getTenantId())
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!headers.has('Authorization')) {
    const token = getAccessToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  const envelope = await parseEnvelope(response)

  if (response.status === 401) {
    handleUnauthorized()
    throw new ApiError(401, envelope?.message ?? 'Your session has expired.')
  }

  if (!response.ok || envelope?.isSuccessful === false) {
    const message = envelope?.message ?? response.statusText ?? 'Something went wrong.'
    const fieldErrors =
      envelope?.data && typeof envelope.data === 'object' && 'errors' in envelope.data
        ? (envelope.data as { errors?: Record<string, string[]> }).errors
        : undefined
    throw new ApiError(response.status, message, fieldErrors)
  }

  return (envelope as ApiEnvelope<T>) ?? { isSuccessful: true, message: '', data: null }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const envelope = await apiFetchEnvelope<T>(path, init)
  return (envelope.data as T) ?? (undefined as T)
}

// For list endpoints that return { data: T[], meta: PageMeta } — apiFetch alone discards meta.
export async function apiFetchPaged<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ items: T[]; meta: PageMeta }> {
  const envelope = await apiFetchEnvelope<T[]>(path, init)
  return { items: (envelope.data as T[]) ?? [], meta: envelope.meta! }
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
  id_token?: string
}

export async function postToken(params: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE_URL}/api/identity/connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Tenant-Id': getTenantId(),
    },
    body: params,
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message = body?.error_description ?? body?.error ?? 'Invalid email or password.'
    throw new ApiError(response.status, message)
  }

  return body as TokenResponse
}

const IMPERSONATION_GRANT_TYPE = 'urn:roboacademy:params:oauth:grant-type:impersonation'

// Exchanges the caller's own token for a fresh one scoped to targetTenantId (requires
// tenancy:impersonate). Used to act within a tenant the caller isn't logged into themselves —
// e.g. creating the first admin for a tenant with no users yet. The request itself must resolve
// to the caller's OWN tenant (not the target) for the token/tenant guard to pass; the target is
// only the tenant_id form param, read by the impersonation grant handler.
export async function postImpersonationToken(targetTenantId: string): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE_URL}/api/identity/connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Tenant-Id': getTenantId(),
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: new URLSearchParams({
      grant_type: IMPERSONATION_GRANT_TYPE,
      tenant_id: targetTenantId,
      client_id: 'roboacademy-spa',
      scope: 'openid profile email offline_access',
    }),
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message = body?.error_description ?? body?.error ?? 'Unable to act on this tenant.'
    throw new ApiError(response.status, message)
  }

  return body as TokenResponse
}
