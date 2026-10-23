import { get, post } from '@/utils/request'
import type { ReviewItem, ReviewStatus } from '@/types/api'

/** 整洁奖励审核：所有门店的提交都在这里，不随现场页的门店切换变化 */
export const fetchReviews = (status: ReviewStatus = 'pending') =>
  get<{ total: number; list: ReviewItem[] }>('/reviews', { status })

/** 通过：给用户发放奖励金额 */
export const approveReview = (reviewId: number) => post<ReviewItem>(`/reviews/${reviewId}/approve`)

/** 拒绝：必须填理由，用户端可见 */
export const rejectReview = (reviewId: number, remark: string) =>
  post<ReviewItem>(`/reviews/${reviewId}/reject`, { remark })
