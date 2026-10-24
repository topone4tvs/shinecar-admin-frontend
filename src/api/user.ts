import { get } from '@/utils/request'
import type { UserBrief, UserDetail } from '@/types/api'

export const fetchUser = (userId: number) => get<UserDetail>(`/users/${userId}`)

/**
 * 按手机号查用户（手动开单第一步）。
 * 与详情接口的权限规则不同：不要求该用户在本店下过单，第一次来的客人也能开单。
 */
export const lookupUser = (phone: string) => get<UserBrief>('/users', { phone })
