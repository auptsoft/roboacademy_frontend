import { apiFetch } from '@/api/client'

export function registerStart(email: string): Promise<null> {
  return apiFetch<null>('/api/identity/register/start', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export interface RegisterConfirmRequest {
  email: string
  code: string
  password: string
  firstName: string
  lastName: string
}

export interface RegisterConfirmResponse {
  userId: string
  email: string
}

export function registerConfirm(request: RegisterConfirmRequest): Promise<RegisterConfirmResponse> {
  return apiFetch<RegisterConfirmResponse>('/api/identity/register/confirm', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function requestPasswordReset(email: string): Promise<null> {
  return apiFetch<null>('/api/identity/forgot-password/start', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export interface ConfirmPasswordResetRequest {
  email: string
  code: string
  newPassword: string
}

export function confirmPasswordReset(request: ConfirmPasswordResetRequest): Promise<null> {
  return apiFetch<null>('/api/identity/forgot-password/confirm', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export interface Me {
  userId: string
  email: string
  fullName: string
  roles: string[]
  permissions: string[]
}

export function getMe(): Promise<Me> {
  return apiFetch<Me>('/api/identity/me')
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>('/api/identity/me/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}
