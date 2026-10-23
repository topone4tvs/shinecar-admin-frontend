import { get } from '@/utils/request'
import type { UserDetail } from '@/types/api'

export const fetchUser = (userId: number) => get<UserDetail>(`/users/${userId}`)
