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

/** 预热请求：唤醒 Render 免费层休眠的后端，timeout=90s 应对 cold start */
export async function warmup() {
  const API_BASE = import.meta.env.VITE_API_BASE || '/api'
  try {
    await fetch(API_BASE, { signal: AbortSignal.timeout(90000) })
  } catch {
    // 预热失败不影响正常使用，静默忽略
  }
}
