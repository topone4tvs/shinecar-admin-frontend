import { get, post } from '@/utils/request'
import type { AdminProfile } from '@/types/api'

export interface WxLoginResp {
  need_bind: boolean
  /** need_bind=true 时返回，5 分钟有效，一次性 */
  ticket?: string
  token?: string
  expires_in?: number
  profile?: AdminProfile
}

export interface BindReq {
  ticket: string
  phone: string
  auth_code: string
}

export interface AuthResult {
  token: string
  expires_in: number
  profile: AdminProfile
}

/** code 换 openid；已绑定则直接返回 token（静默续期） */
export const wxLogin = (code: string) =>
  post<WxLoginResp>('/auth/wx-login', { code }, { auth: false })

/** 手机号 + 授权码绑定微信 */
export const bind = (payload: BindReq) =>
  post<AuthResult>('/auth/bind', payload, { auth: false })

/** 退出登录（服务端 token_version+1，所有旧 token 失效） */
export const logout = () => post<Record<string, never>>('/auth/logout')

/** 当前账号 */
export const fetchProfile = () => get<AdminProfile>('/auth/profile')
