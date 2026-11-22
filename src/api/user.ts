import { get, post } from '@/utils/request'
import type { BalanceAdjustPayload, BalanceAdjustResult, UserDetail, UserList } from '@/types/api'

export const fetchUser = (userId: number) => get<UserDetail>(`/users/${userId}`)

/** 用户检索：手机号精确匹配，或车牌命中（可能多账户） */
export const searchUsers = (query: { phone?: string; plate_no?: string }) =>
  get<UserList>('/users', query)

/**
 * 余额调整（加钱 / 扣钱）。
 * 金额传「分」：前端 Math.round(元 * 100) 一次算清，后端只收整数。
 */
export const adjustUserBalance = (userId: number, payload: BalanceAdjustPayload) =>
  post<BalanceAdjustResult>(`/users/${userId}/balance`, payload, { timeout: 15000 })
