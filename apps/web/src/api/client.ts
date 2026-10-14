import { clearSession, getAccessToken, getStoredTenantId } from '@/api/session'
import { getEnv } from '@/lib/runtime-env'

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

  // Plan-entitlement failures (limit_exceeded / feature_unavailable). The message is replaced
  // with learner-facing wording - a learner can't upgrade a plan, only ask their school.
  planErrorCode?: string

  constructor(status: number, message: string, fieldErrors?: Record<string, string[]>, planErrorCode?: string) {
    super(describePlanError(planErrorCode) ?? message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.planErrorCode = planErrorCode
  }
}

function describePlanError(code: string | undefined): string | null {
  if (code === 'limit_exceeded') {
    return "Your school isn't able to add more accounts right now. Please contact your school."
  }
  if (code === 'feature_unavailable') {
    return "This isn't available at your school. Please contact your school if you think it should be."
  }
  if (code === 'subscription_expired') {
    return "Your school's access is paused. Please contact your school administrator."
  }
  // AI features (see the backend's AI gateway). ai_limit_exceeded is limit_exceeded on an AI
  // allowance, told apart by its key, so it doesn't read as "no more accounts".
  if (code === 'ai_limit_exceeded') {
    return "Your school's AI allowance for this month has been used. It renews on the 1st."
  }
  if (code === 'ai_disabled') {
    return 'AI features are turned off for your school.'
  }
  if (code === 'ai_feature_cap_reached') {
    return 'Your school has paused this AI feature for the rest of the month.'
  }
  if (code === 'ai_unavailable') {
    return 'AI is not available right now. Please try again later.'
  }
  return null
}

// The school's subscription lapsed past its grace period (see the backend's
// SubscriptionAccessMiddleware): every call will now fail, so end the session and let the login
// page explain, rather than leaving the learner on a page full of errors.
function endSessionForLockedSchool(): void {
  clearSession()
  if (window.location.pathname !== '/auth') {
    window.location.assign('/auth?locked=1')
  }
}

const AI_ERROR_CODES = ['ai_disabled', 'ai_feature_cap_reached', 'ai_unavailable']

export function planErrorCodeOf(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'code' in data) {
    const { code, key } = data as { code: unknown; key?: unknown }
    if (code === 'limit_exceeded' && typeof key === 'string' && key.startsWith('max_ai_')) return 'ai_limit_exceeded'
    if (code === 'limit_exceeded' || code === 'feature_unavailable' || code === 'subscription_expired') return code
    if (typeof code === 'string' && AI_ERROR_CODES.includes(code)) return code
  }
  return undefined
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
  window.location.href = '/auth'
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
    const planErrorCode = planErrorCodeOf(envelope?.data)
    if (response.status === 403 && planErrorCode === 'subscription_expired') {
      endSessionForLockedSchool()
    }
    throw new ApiError(response.status, message, fieldErrors, planErrorCode)
  }

  return (envelope as ApiEnvelope<T>) ?? { isSuccessful: true, message: '', data: null }
}

// For callers that read the response body themselves (e.g. the AI tutor's event stream): the
// same base URL, tenant and auth headers apiFetch uses.
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export function apiHeaders(): Headers {
  const headers = new Headers({ 'X-Tenant-Id': getTenantId(), 'Content-Type': 'application/json' })
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const envelope = await apiFetchEnvelope<T>(path, init)
  return (envelope.data as T) ?? (undefined as T)
}

export async function apiFetchPaged<T>(path: string, init: RequestInit = {}): Promise<{ data: T[]; meta: PageMeta }> {
  const envelope = await apiFetchEnvelope<T[]>(path, init)
  return {
    data: (envelope.data as T[]) ?? [],
    meta: envelope.meta ?? { page: 1, pageSize: 0, totalCount: 0, totalPages: 0 },
  }
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
