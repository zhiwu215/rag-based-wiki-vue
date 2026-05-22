import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { login as loginApi, register as registerApi } from '@/api/auth'
import type { AuthResponse } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<{ id: number; username: string } | null>(
    JSON.parse(localStorage.getItem('user') || 'null'),
  )
  const token = ref<string | null>(localStorage.getItem('token'))

  const isAuthenticated = computed(() => !!token.value)

  function setAuth(data: AuthResponse) {
    token.value = data.token
    user.value = { id: data.userId, username: data.username }
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  async function login(username: string, password: string) {
    const data = await loginApi(username, password)
    setAuth(data as AuthResponse)
  }

  async function register(username: string, password: string) {
    const data = await registerApi(username, password)
    setAuth(data as AuthResponse)
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return { user, token, isAuthenticated, login, register, logout }
})
