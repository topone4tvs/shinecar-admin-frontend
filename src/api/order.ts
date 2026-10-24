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

export interface CreateOrderPayload {
  station_id: number
  user_id: number
  /** 留空则由服务端取工位槽位或用户唯一绑定车辆，两者都没有就留空等识别回填 */
  plate_no?: string
}

/**
 * 手动开单（代客开单）。
 * 服务端复用 C 端开单逻辑：会真实占用工位、启动设备并开始计时，所以调用方必须先二次确认。
 */
export const createOrder = (payload: CreateOrderPayload) =>
  post<OrderDetail>('/orders', payload, { timeout: 20000 })

/**
 * 强制结束订单（L3 破坏性操作，调用方必须先做二次确认）。
 * 服务端按当前时长结算并关单，用户端同步结束，不可撤回。
 */
export const finishOrder = (orderId: number, reason?: string) =>
  post<{ order_id: number; station_id: number; status: string }>(`/orders/${orderId}/finish`, { reason }, { timeout: 15000 })
