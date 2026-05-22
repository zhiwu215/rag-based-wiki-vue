import http from './index'

export interface AuthResponse {
  token: string
  userId: number
  username: string
}

export function login(username: string, password: string) {
  return http.post<AuthResponse>('/auth/login', { username, password })
}

export function register(username: string, password: string) {
  return http.post<AuthResponse>('/auth/register', { username, password })
}
