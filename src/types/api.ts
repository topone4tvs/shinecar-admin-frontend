/** 管理端通用类型（与 docs/admin-app/03-后端技术方案.md §6 契约保持一致） */

export type AdminRole = 'super' | 'area' | 'shop'

export interface Shop {
  id: number
  name: string
  station_total: number
  /** 当前账号在该门店的权限标记，由后端返回 */
  can_manage?: boolean
}

export interface AdminProfile {
  id: number
  name: string
  phone: string
  role: AdminRole
  role_text: string
  shops: Shop[]
  bound_at: string
  last_login_at?: string
}

/** 工位状态：空闲 / 使用中 / 维护中 / 下线 */
export type StationStatus = 'idle' | 'busy' | 'repair' | 'off'

export interface Station {
  id: number
  shop_id: number
  shop_name: string
  /** 工位号，如「3 号」 */
  name: string
  status: StationStatus
  /** busy 时有效 */
  order_id?: number
  started_at?: string
  /** 已洗时长（秒），busy 时有效；由服务端时间戳换算，前端只负责格式化 */
  elapsed_seconds?: number
  /** 车牌尾号四位，busy 时有效 */
  plate_tail?: string
  /** repair 时有效 */
  maintenance_at?: string
  maintenance_by?: string
}

/** 门店能力项：由 admin_capabilities 配置下发，未启用的门店不显示 */
export interface Capability {
  key: string
  name: string
  desc: string
  /** 两字以内字符图标，避免引入图标资源 */
  icon: string
  enabled: boolean
}

export type OrderStatus = 'ongoing' | 'done' | 'refunded'

export interface OrderItem {
  id: number
  order_no: string
  shop_id: number
  shop_name: string
  station_name: string
  status: OrderStatus
  started_at: string
  ended_at?: string
  duration_text?: string
  user_phone_masked: string
  plate_no: string
  /** 仅已结束订单返回；进行中不回金额（算费是写操作，会消耗用户当日免费额度） */
  amount?: number
}

export interface OrderDetail extends OrderItem {
  user_id: number
  nickname: string
  pay_status: 'unpaid' | 'paid' | 'free'
  pay_text: string
}

export type ReviewStatus = 'pending' | 'draft' | 'approved' | 'rejected'

export interface ReviewItem {
  id: number
  order_no: string
  shop_id: number
  shop_name: string
  station_name: string
  /** 奖励金额（元） */
  amount: number
  user_phone_masked: string
  plate_no: string
  submitted_at: string
  waited_text: string
  photo_count: number
  status: ReviewStatus
  /** 拒绝理由，仅 rejected 返回 */
  review_remark?: string
}

export interface UserDetail {
  id: number
  nickname: string
  phone_masked: string
  balance: number
  give_balance: number
  plate_no?: string
  order_count: number
  last_order_at?: string
}
