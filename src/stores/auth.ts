import { defineStore } from 'pinia'
import { ref } from 'vue'
import { clearToken, getToken, setToken } from '@/utils/token'
import type { AdminProfile, Shop } from '@/types/api'

/**
 * 登录态。token 持久化到 Storage('admin_token')，其余为会话内状态。
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(getToken())
  const profile = ref<AdminProfile | null>(null)
  const shops = ref<Shop[]>([])
  const status = ref<'idle' | 'loading' | 'ready'>('idle')

  const isLoggedIn = () => Boolean(token.value)

  const applyAuth = (nextToken: string, nextProfile?: AdminProfile | null) => {
    token.value = nextToken
    setToken(nextToken)
    if (nextProfile) {
      profile.value = nextProfile
      shops.value = nextProfile.shops || []
    }
    status.value = 'ready'
  }

  const reset = () => {
    token.value = ''
    profile.value = null
    shops.value = []
    status.value = 'idle'
    clearToken()
  }

  return { token, profile, shops, status, isLoggedIn, applyAuth, reset }
})
