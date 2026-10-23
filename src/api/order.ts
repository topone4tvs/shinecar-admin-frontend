import { get, post } from '@/utils/request'
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

/**
 * 强制结束订单（L3 破坏性操作，调用方必须先做二次确认）。
 * 服务端按当前时长结算并关单，用户端同步结束，不可撤回。
 */
export const finishOrder = (orderId: number, reason?: string) =>
  post<{ order_id: number; station_id: number; status: string }>(`/orders/${orderId}/finish`, { reason }, { timeout: 15000 })
