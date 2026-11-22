import { get, post } from '@/utils/request'
import type { ParkingRecord } from '@/types/api'

/**
 * 停车代缴。
 * 原则：只缴不查——停车系统没有「查待缴金额」能力，所以这里既不请求金额、也不展示金额。
 */

export interface PayParkingPayload {
  shop_id: number
  plate_no: string
  /** 从订单进入时携带，服务端据此拦截「该单已代缴」 */
  order_id?: number
  /** 同车牌 10 分钟内二次提交时为 true */
  confirm_again?: boolean
}

export const payParking = (payload: PayParkingPayload) =>
  post<{ accepted: boolean; plate_no: string; message: string }>('/parking/pay', payload, { timeout: 15000 })

/** 本门店近 7 天代缴记录（无金额） */
export const fetchParkingRecords = (shopId: number) =>
  get<{ list: ParkingRecord[] }>('/parking/records', { shop_id: shopId })
