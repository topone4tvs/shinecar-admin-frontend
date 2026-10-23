import Taro from '@tarojs/taro'

const TOKEN_KEY = 'admin_token'

let cachedToken: string | null = null

export const getToken = (): string => {
  if (cachedToken !== null) {
    return cachedToken
  }
  try {
    cachedToken = Taro.getStorageSync(TOKEN_KEY) || ''
  } catch {
    cachedToken = ''
  }
  return cachedToken as string
}

export const setToken = (token: string) => {
  cachedToken = token
  Taro.setStorageSync(TOKEN_KEY, token)
}

export const clearToken = () => {
  cachedToken = ''
  try {
    Taro.removeStorageSync(TOKEN_KEY)
  } catch {
    // ignore
  }
}
