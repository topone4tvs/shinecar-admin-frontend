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
  /**
   * 通电状态：on / off，缺省表示从未操作过。
   * 与 status 正交——通电不改变四状态口径，维护中 + 通电 = 保养中。
   */
  power_state?: PowerState
  /** 最近一次通断电下发时间（RFC3339），用于算「已通电多久」 */
  power_at?: string
  power_by?: string
}

/** 通断电状态词 */
export type PowerState = 'on' | 'off'

/** 门店能力项：由 admin_capabilities 配置下发，未启用的门店不显示 */
export interface Capability {
  key: string
  name: string
  desc: string
  /** 两字以内字符图标，避免引入图标资源 */
  icon: string
  enabled: boolean
  /**
   * 作用域：shop = 门店工具（现场页「门店工具」区），station = 工位设备（工位详情「扩展设备」区）。
   * 由后端 admin_capabilities.placement 下发，前端只按此字段分区渲染。
   */
  placement?: 'shop' | 'station'
  /** 点击后需要的交互：直接下发 / 二次确认 / 弹层输入。缺省视为直接下发 */
  confirm?: 'none' | 'confirm' | 'sheet'
}

/** 门店概览：现场页首屏一次拿全，避免 3 个请求串行 */
export interface ShopOverview {
  shop: Shop
  summary: { busy: number; idle: number; repairing: number }
  stations: Station[]
  refreshed_at: string
}

/** 工位详情里的车牌条目 */
export interface StationPlate {
  plate_no: string
  /** true = 开单时快照的本单车牌；false = 账户下绑定的其他车辆 */
  is_order: boolean
}

export interface StationOrderUser {
  id: number
  nickname: string
  phone_masked: string
  /** 完整手机号，管理端可见，用于拨打 */
  phone: string
  balance: number
  coupon_count: number
  plates: StationPlate[]
}

export interface StationOrder {
  id: number
  order_no: string
  started_at: string
  user: StationOrderUser
}

/**
 * 工位详情聚合（GET /stations/{id}）。
 * 只对进行中订单聚合用户资产；空闲/维护工位 order 为 null。
 * 注意：不含任何金额字段——进行中订单不做费用试算（见 03 §6.3 金额口径）。
 */
export interface StationDetail extends Station {
  capabilities: Capability[]
  order: StationOrder | null
}

/**
 * 订单状态：进行中 / 已完成 / 已取消。
 * 库里的 status 是 1/2/3，后端映射成这三个词；已取消的单也允许被查到
 * （现场常要解释「这单为什么没扣钱」）。
 */
export type OrderStatus = 'ongoing' | 'done' | 'canceled'

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

/** 费用构成，只有已结束订单才有非零值 */
export interface OrderFee {
  total_fee: number
  balance: number
  experience_minutes: number
  night_discount: number
  new_user_minutes: number
}

export interface OrderDetail extends OrderItem {
  user_id: number
  nickname: string
  pay_status: 'unpaid' | 'paid' | 'free'
  pay_text: string
  fee: OrderFee
  /** 代缴停车费的时间；空表示还没代缴过 */
  parking_paid_at?: string
  can_finish: boolean
  can_pay_parking: boolean
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
  /** 完整手机号，管理端可见（现场要打电话） */
  phone: string
  phone_masked: string
  balance: number
  /** 累计赠送金额（元）。余额表不区分本金与赠送，所以只能展示累计值 */
  give_balance: number
  plate_no?: string
  vehicles: string[]
  order_count: number
  last_order_at?: string
  is_newer: boolean
}

/**
 * 停车代缴记录：只记车牌、时间、操作人。
 * 停车系统既不提供查询接口，也不回传金额，所以这里**没有金额字段**。
 */
export interface ParkingRecord {
  id: number
  shop_id: number
  plate_no: string
  paid_at: string
  operator: string
}
