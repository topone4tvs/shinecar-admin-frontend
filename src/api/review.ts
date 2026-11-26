import { get, post } from '@/utils/request'
import type { ReviewItem, ReviewStatus } from '@/types/api'

export interface ReviewListResponse {
  total: number
  page: number
  page_size: number
  list: ReviewItem[]
}

export interface ReviewMetaResponse {
  /** 拒绝原因预设，后端下发（改文案不用发版） */
  reject_reasons: string[]
}

/** 整洁奖励审核：所有门店的提交都在这里，不随现场页的门店切换变化 */
export const fetchReviews = (status: ReviewStatus | 'all' = 'pending', page = 1, pageSize = 20) =>
  get<ReviewListResponse>('/reviews', { status, page, page_size: pageSize })

/** 单条：订单详情内嵌审核时按 id 拉，不必在待审列表里翻 */
export const fetchReviewById = (reviewId: number) => get<ReviewItem>(`/reviews/${reviewId}`)

/** 拒绝原因预设 */
export const fetchReviewMeta = () => get<ReviewMetaResponse>('/reviews/meta')

/** 通过：给用户发放奖励金额（后端 CAS + 发钱同事务，失败可重试） */
export const approveReview = (reviewId: number) => post<ReviewItem>(`/reviews/${reviewId}/approve`)

/** 拒绝：必须填理由，用户端可见 */
export const rejectReview = (reviewId: number, remark: string) =>
  post<ReviewItem>(`/reviews/${reviewId}/reject`, { remark })
