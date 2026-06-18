import { buildApiUrl, request } from '@/api/http'

export interface AuthUser {
  provider: 'google'
  subject: string
  email: string | null
  email_verified: boolean
  name: string | null
  picture: string | null
}

export interface AuthMeResponse {
  authenticated: boolean
  user: AuthUser | null
}

export function buildGoogleLoginUrl(returnTo: string) {
  return buildApiUrl('/api/auth/google/login', { return_to: returnTo })
}

export function getCurrentAuth() {
  return request<AuthMeResponse>('/api/auth/me')
}

export function logout() {
  return request<void>('/api/auth/logout', { method: 'POST' })
}
