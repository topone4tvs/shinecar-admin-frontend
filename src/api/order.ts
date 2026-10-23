import { get } from '@/utils/request'
import type { OrderDetail, OrderItem } from '@/types/api'

export interface OrderQuery {
  /** 手机号精确匹配 */
  phone?: string
  /** 车牌，支持只输后几位 */
  plate?: string
  /** 0 / 不传 = 全部门店 */
  shop_id?: number
  /** today | 7d | all */
  range?: 'today' | '7d' | 'all'
}

/** 跨店订单查询，不受「现场」页当前门店影响 */
export const searchOrders = (query: OrderQuery) =>
  get<{ total: number; list: OrderItem[] }>('/orders', query)

export const fetchOrder = (orderId: number) => get<OrderDetail>(`/orders/${orderId}`)
