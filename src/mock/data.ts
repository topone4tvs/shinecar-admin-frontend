import type {
  AdminProfile,
  Capability,
  OrderItem,
  ParkingRecord,
  ReviewItem,
  Shop,
  Station,
  StationOrderUser,
  UserDetail,
} from '@/types/api'

/**
 * Mock 数据源（仅 development / pre 生效，production 编译后不会被调用）。
 * 时间全部按「相对当前时刻」生成，保证每次打开都像刚刚发生的现场。
 */

const NOW = Date.now()
const sec = (s: number) => new Date(NOW - s * 1000).toISOString()
const min = (m: number) => sec(m * 60)

export interface MockAdmin extends AdminProfile {
  auth_code: string
  shop_ids: number[]
}

export const SHOPS: Shop[] = [
  { id: 1, name: '滨江洗车中心', station_total: 6, can_manage: true },
  { id: 2, name: '城西科技园店', station_total: 4, can_manage: true },
]

/** 授权码由总部在建号时生成，8 位数字与大小写字母组合，首次绑定后失效 */
export const ADMINS: MockAdmin[] = [
  {
    id: 1,
    name: '超级管理员',
    phone: '13800138000',
    role: 'super',
    role_text: '超级管理员',
    shops: SHOPS,
    bound_at: '2026-10-20 09:12',
    last_login_at: '2026-10-23 09:02',
    auth_code: 'K7mQ2xRb',
    shop_ids: [1, 2],
  },
  {
    id: 2,
    name: '李静',
    phone: '13900139000',
    role: 'shop',
    role_text: '门店管理员',
    shops: [SHOPS[1]],
    bound_at: '2026-10-21 14:30',
    last_login_at: '2026-10-23 08:41',
    auth_code: 'Wx9Tn4Pc',
    shop_ids: [2],
  },
]

export const STATIONS: Station[] = [
  // 滨江洗车中心
  { id: 101, shop_id: 1, shop_name: '滨江洗车中心', name: '1 号', status: 'idle' },
  {
    id: 102,
    shop_id: 1,
    shop_name: '滨江洗车中心',
    name: '2 号',
    status: 'busy',
    order_id: 1002,
    started_at: sec(1421),
    plate_tail: '2311',
  },
  {
    id: 103,
    shop_id: 1,
    shop_name: '滨江洗车中心',
    name: '3 号',
    status: 'busy',
    order_id: 1001,
    started_at: sec(3730),
    plate_tail: 'D2311',
  },
  {
    id: 104,
    shop_id: 1,
    shop_name: '滨江洗车中心',
    name: '4 号',
    status: 'repair',
    maintenance_at: '10:02',
    maintenance_by: '超级管理员',
  },
  { id: 105, shop_id: 1, shop_name: '滨江洗车中心', name: '5 号', status: 'idle' },
  {
    id: 106,
    shop_id: 1,
    shop_name: '滨江洗车中心',
    name: '6 号',
    status: 'busy',
    order_id: 1003,
    started_at: sec(532),
    plate_tail: '6677',
  },
  // 城西科技园店
  {
    id: 201,
    shop_id: 2,
    shop_name: '城西科技园店',
    name: '1 号',
    status: 'busy',
    order_id: 1004,
    started_at: sec(2465),
    plate_tail: '9088',
  },
  { id: 202, shop_id: 2, shop_name: '城西科技园店', name: '2 号', status: 'idle' },
  { id: 203, shop_id: 2, shop_name: '城西科技园店', name: '3 号', status: 'idle' },
  {
    id: 204,
    shop_id: 2,
    shop_name: '城西科技园店',
    name: '4 号',
    status: 'repair',
    maintenance_at: '09:15',
    maintenance_by: '李静',
  },
]

export const CAPABILITIES: Record<number, Capability[]> = {
  1: [
    { key: 'parking_fee', name: '停车', desc: '按车牌代缴', icon: '停', enabled: true, placement: 'shop', confirm: 'none' },
    { key: 'ventilation', name: '通风', desc: '吹风散热', icon: '风', enabled: true, placement: 'station', confirm: 'confirm' },
  ],
  2: [
    { key: 'parking_fee', name: '停车', desc: '按车牌代缴', icon: '停', enabled: true, placement: 'shop', confirm: 'none' },
    { key: 'ventilation', name: '通风', desc: '吹风散热', icon: '风', enabled: true, placement: 'station', confirm: 'confirm' },
  ],
}

/**
 * 工位 → 进行中订单的用户信息（工位详情聚合用）。
 * 真实实现由 /stations/{id} 聚合 sc_orders + sc_users + sc_user_vehicles，
 * 这里按 station_id 预置，保证每次打开都有一份像样的现场数据。
 */
export const STATION_USERS: Record<number, StationOrderUser> = {
  102: {
    id: 502,
    nickname: '林女士',
    phone: '13912342311',
    phone_masked: '139****2311',
    balance: 38.2,
    coupon_count: 1,
    plates: [
      { plate_no: '沪B·8K221', is_order: true },
      { plate_no: '沪A·5M307', is_order: false },
    ],
  },
  103: {
    id: 501,
    nickname: '陈先生',
    phone: '13812348000',
    phone_masked: '138****8000',
    balance: 126.4,
    coupon_count: 2,
    plates: [
      { plate_no: '沪A·D2311', is_order: true },
      { plate_no: '沪B·8K221', is_order: false },
      { plate_no: '沪C·1F908', is_order: false },
    ],
  },
  106: {
    id: 503,
    nickname: '赵先生',
    phone: '13712346677',
    phone_masked: '137****6677',
    balance: 0,
    coupon_count: 0,
    plates: [{ plate_no: '沪C·1F908', is_order: true }],
  },
  201: {
    id: 504,
    nickname: '周先生',
    phone: '13612349088',
    phone_masked: '136****9088',
    balance: 64.8,
    coupon_count: 3,
    plates: [
      { plate_no: '沪A·5M307', is_order: true },
      { plate_no: '沪B·8K221', is_order: false },
    ],
  },
}

export const ORDERS: OrderItem[] = [
  {
    id: 1001,
    order_no: '202610180312',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '3 号',
    status: 'ongoing',
    started_at: min(62),
    user_phone_masked: '138****8000',
    plate_no: '沪A·D2311',
  },
  {
    id: 1002,
    order_no: '202610180298',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '2 号',
    status: 'ongoing',
    started_at: min(23),
    user_phone_masked: '139****2311',
    plate_no: '沪B·8K221',
  },
  {
    id: 1003,
    order_no: '202610180321',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '6 号',
    status: 'ongoing',
    started_at: min(8),
    user_phone_masked: '137****6677',
    plate_no: '沪C·1F908',
  },
  {
    id: 1004,
    order_no: '202610180330',
    shop_id: 2,
    shop_name: '城西科技园店',
    station_name: '1 号',
    status: 'ongoing',
    started_at: min(41),
    user_phone_masked: '136****9088',
    plate_no: '沪A·5M307',
  },
  {
    id: 2001,
    order_no: '202610180155',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '5 号',
    status: 'done',
    started_at: min(410),
    ended_at: min(364),
    duration_text: '46 分钟',
    user_phone_masked: '137****6677',
    plate_no: '沪C·1F908',
    amount: 12.8,
  },
  {
    id: 2002,
    order_no: '202610180102',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '1 号',
    status: 'done',
    started_at: min(360),
    ended_at: min(321),
    duration_text: '39 分钟',
    user_phone_masked: '139****2311',
    plate_no: '沪B·8K221',
    amount: 16.4,
  },
  {
    id: 2003,
    order_no: '202610172311',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '2 号',
    status: 'done',
    started_at: min(1620),
    ended_at: min(1572),
    duration_text: '48 分钟',
    user_phone_masked: '138****8000',
    plate_no: '沪A·D2311',
    amount: 18.6,
  },
  {
    id: 2004,
    order_no: '202610172108',
    shop_id: 2,
    shop_name: '城西科技园店',
    station_name: '3 号',
    status: 'done',
    started_at: min(1800),
    ended_at: min(1762),
    duration_text: '38 分钟',
    user_phone_masked: '136****9088',
    plate_no: '沪A·5M307',
    amount: 14.2,
  },
  {
    id: 2005,
    order_no: '202610161540',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '1 号',
    status: 'done',
    started_at: min(3300),
    ended_at: min(3255),
    duration_text: '45 分钟',
    user_phone_masked: '139****2311',
    plate_no: '沪B·8K221',
    amount: 9.9,
  },
]

export const REVIEWS: ReviewItem[] = [
  {
    id: 1,
    order_no: '202610180155',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '5 号',
    amount: 12.8,
    user_phone_masked: '137****6677',
    plate_no: '沪C·1F908',
    submitted_at: '07:48',
    waited_text: '等待 2 小时 36 分',
    photo_count: 3,
    status: 'pending',
  },
  {
    id: 2,
    order_no: '202610180102',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '1 号',
    amount: 16.4,
    user_phone_masked: '139****2311',
    plate_no: '沪B·8K221',
    submitted_at: '08:12',
    waited_text: '等待 2 小时 12 分',
    photo_count: 1,
    status: 'pending',
  },
  {
    id: 3,
    order_no: '202610172311',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '2 号',
    amount: 18.6,
    user_phone_masked: '138****8000',
    plate_no: '沪A·D2311',
    submitted_at: '昨天 21:53',
    waited_text: '等待 12 小时',
    photo_count: 2,
    status: 'pending',
  },
  {
    id: 4,
    order_no: '202610172108',
    shop_id: 2,
    shop_name: '城西科技园店',
    station_name: '3 号',
    amount: 14.2,
    user_phone_masked: '136****9088',
    plate_no: '沪A·5M307',
    submitted_at: '昨天 20:12',
    waited_text: '等待 13 小时',
    photo_count: 3,
    status: 'pending',
  },
  {
    id: 5,
    order_no: '202610161540',
    shop_id: 1,
    shop_name: '滨江洗车中心',
    station_name: '1 号',
    amount: 9.9,
    user_phone_masked: '139****2311',
    plate_no: '沪B·8K221',
    submitted_at: '10-16 17:06',
    waited_text: '已处理',
    photo_count: 2,
    status: 'approved',
  },
]

export const USERS: UserDetail[] = [
  {
    id: 501,
    nickname: '陈先生',
    phone: '13800138000',
    phone_masked: '138****8000',
    balance: 126.4,
    give_balance: 10,
    plate_no: '沪A·D2311',
    vehicles: ['沪A·D2311'],
    order_count: 42,
    last_order_at: '刚刚',
    is_newer: false,
  },
  {
    id: 502,
    nickname: '林女士',
    phone: '13900139000',
    phone_masked: '139****2311',
    balance: 38.2,
    give_balance: 5,
    plate_no: '沪B·8K221',
    vehicles: ['沪B·8K221', '沪B·2M158'],
    order_count: 17,
    last_order_at: '今天 08:58',
    is_newer: false,
  },
  {
    id: 503,
    nickname: '赵先生',
    phone: '13700137000',
    phone_masked: '137****6677',
    balance: 0,
    give_balance: 0,
    plate_no: '沪C·1F908',
    vehicles: ['沪C·1F908'],
    order_count: 6,
    last_order_at: '今天 08:12',
    is_newer: true,
  },
]

/** 停车代缴记录：只记车牌、时间、操作人，**没有金额**（停车系统不回传） */
export const PARKING_RECORDS: ParkingRecord[] = [
  { id: 1, shop_id: 1, plate_no: '沪A·D2311', paid_at: '10-23 09:41', operator: '超级管理员' },
  { id: 2, shop_id: 1, plate_no: '沪B·8K221', paid_at: '10-23 08:16', operator: '超级管理员' },
  { id: 3, shop_id: 1, plate_no: '沪C·1F908', paid_at: '10-22 21:03', operator: '超级管理员' },
  { id: 4, shop_id: 2, plate_no: '沪A·5M307', paid_at: '10-22 19:28', operator: '李静' },
]

/** 运行期可变状态：审核结果、当前绑定、维护中的工位 */
export const runtime = {
  reviews: JSON.parse(JSON.stringify(REVIEWS)) as ReviewItem[],
  stations: JSON.parse(JSON.stringify(STATIONS)) as Station[],
  orders: JSON.parse(JSON.stringify(ORDERS)) as OrderItem[],
  parking: JSON.parse(JSON.stringify(PARKING_RECORDS)) as ParkingRecord[],
  /** 最近一次代缴的车牌 + 时间戳，用于「10 分钟内重复提交」拦截 */
  lastParking: { plate: '', at: 0 },
  /** 当前已绑定的管理员 id（模拟 openid → 账号 的绑定关系） */
  boundAdminId: 0 as number,
  ticket: '' as string,
}

export const resetRuntime = () => {
  runtime.reviews = JSON.parse(JSON.stringify(REVIEWS)) as ReviewItem[]
  runtime.stations = JSON.parse(JSON.stringify(STATIONS)) as Station[]
  runtime.orders = JSON.parse(JSON.stringify(ORDERS)) as OrderItem[]
  runtime.parking = JSON.parse(JSON.stringify(PARKING_RECORDS)) as ParkingRecord[]
  runtime.lastParking = { plate: '', at: 0 }
  runtime.boundAdminId = 0
  runtime.ticket = ''
}
