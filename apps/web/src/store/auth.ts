import { reactive } from 'vue'
import { postToken } from '@/api/client'
import { getMe } from '@/api/identity'
import {
  clearSession,
  getExpiresAt,
  getStoredUser,
  setSession,
  setStoredUser,
  type AuthUser,
} from '@/api/session'

const state = reactive<{ user: AuthUser | null }>({
  user: getStoredUser(),
})

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

  const me = await getMe()
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

export function getCurrentUser(): AuthUser | null {
  return state.user
}
