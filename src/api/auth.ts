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

/**
 * 退出登录（服务端 token_version+1，所有旧 token 失效）。
 *
 * ⚠️ 有静默登录后这个接口单独用是**无效的**：WxLogin 只看 openid 绑定与账号状态、
 * 不校验 token_version，所以退出后下一次请求 401 会立刻静默换回新 token。
 * 真要「退出 / 换账号」必须走解绑（后端 repo/admin_account.go:Unbind，尚未暴露接口）。
 */
export const logout = () => post<Record<string, never>>('/auth/logout')

/** 当前账号 */
export const fetchProfile = () => get<AdminProfile>('/auth/profile')
