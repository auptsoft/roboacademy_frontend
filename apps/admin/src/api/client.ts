import { clearSession, getAccessToken, getStoredTenantId } from '@/api/session'
import { getEnv } from '@/lib/runtime-env'
import { describePlanError, isPlanErrorDetails, type PlanErrorDetails } from '@/lib/plan-errors'

const API_BASE_URL = getEnv('VITE_API_BASE_URL')
const PLATFORM_TENANT_ID = getEnv('VITE_PLATFORM_TENANT_ID')

// The tenant to address is captured from ?t=<slug> or ?tenantId= on any URL (see
// lib/tenant-from-url.ts, run by the router) and persisted to localStorage, so it sticks across
// navigation regardless of the current URL.
export function getTenantId(): string {
  return getStoredTenantId() || PLATFORM_TENANT_ID
}

export class ApiError extends Error {
  status: number
  fieldErrors?: Record<string, string[]>
  // Set for plan-entitlement failures (limit_exceeded / feature_unavailable); message is then
  // already the user-facing description, so callers rarely need to inspect this.
  planError?: PlanErrorDetails

  constructor(
    status: number,
    message: string,
    fieldErrors?: Record<string, string[]>,
    planError?: PlanErrorDetails,
  ) {
    super(planError ? describePlanError(planError) : message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.planError = planError
  }

  // Any other stable code the API put in data.code (e.g. payouts_not_configured).
  dataCode?: string

  get code(): string | undefined {
    return this.planError?.code ?? this.dataCode
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

// The tenant's subscription lapsed past its grace period (see the backend's
// SubscriptionAccessMiddleware). Only school admins can still sign in to a locked tenant, and
// the expired page is all they can use, so send them there from wherever the refusal surfaced.
function isSubscriptionExpired(data: unknown): boolean {
  return !!data && typeof data === 'object' && (data as { code?: unknown }).code === 'subscription_expired'
}

function redirectToSubscriptionExpired(): void {
  if (window.location.pathname !== '/subscription-expired') {
    window.location.assign('/subscription-expired')
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
    const planError = isPlanErrorDetails(envelope?.data) ? envelope.data : undefined
    if (response.status === 403 && isSubscriptionExpired(envelope?.data)) {
      redirectToSubscriptionExpired()
    }
    const error = new ApiError(response.status, message, fieldErrors, planError)
    const code = envelope?.data && typeof envelope.data === 'object' ? (envelope.data as { code?: unknown }).code : undefined
    if (!planError && typeof code === 'string') error.dataCode = code
    throw error
  }

  return (envelope as ApiEnvelope<T>) ?? { isSuccessful: true, message: '', data: null }
}

/** For calls that can't go through apiFetch (e.g. reading a streamed response). */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

/** The headers apiFetch sends: tenant, JSON content type, and the access token. */
export function apiHeaders(): Headers {
  const headers = new Headers({ 'X-Tenant-Id': getTenantId(), 'Content-Type': 'application/json' })
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

/** Turns a failed response's envelope into the same ApiError apiFetch throws. */
export function apiErrorFrom(status: number, envelope: { message?: string; data?: unknown } | null, fallback: string): ApiError {
  const planError = isPlanErrorDetails(envelope?.data) ? envelope.data : undefined
  return new ApiError(status, envelope?.message ?? fallback, undefined, planError)
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
