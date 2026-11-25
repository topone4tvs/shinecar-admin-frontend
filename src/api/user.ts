import { get, post } from '@/utils/request'
import type {
  BalanceAdjustPayload,
  BalanceAdjustResult,
  BanResult,
  ClearBalanceResult,
  RefundAllResult,
  RefundableDetail,
  UserDetail,
  UserList,
} from '@/types/api'

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

// ---------------- 充值退款 / 清零 / 拉黑（均仅超管） ----------------

/** 可退额度与逐笔充值单明细（金额单位：分） */
export const fetchRefundable = (userId: number) =>
  get<RefundableDetail>(`/users/${userId}/refundable`, undefined, { timeout: 15000 })

/** 一键原路退款：按可退额新→旧逐笔退，退完清零 */
export const refundUser = (userId: number, reason: string) =>
  post<RefundAllResult>(`/users/${userId}/refund`, { reason }, { timeout: 60000 })

/** 仅清零（含赠送），不退钱 */
export const clearUserBalance = (userId: number) =>
  post<ClearBalanceResult>(`/users/${userId}/clear`, undefined, { timeout: 15000 })

/** 拉黑：清零余额 + 置黑名单 */
export const banUser = (userId: number, reason: string) =>
  post<BanResult>(`/users/${userId}/ban`, { reason }, { timeout: 15000 })

/** 解封：只改状态，余额不恢复 */
export const unbanUser = (userId: number, reason: string) =>
  post<BanResult>(`/users/${userId}/unban`, { reason }, { timeout: 15000 })
