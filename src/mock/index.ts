import Taro from '@tarojs/taro'
import { ApiError } from '@/utils/error'
import type {
  AdminProfile,
  Capability,
  OrderDetail,
  OrderItem,
  ReviewItem,
  Shop,
  ShopOverview,
  Station,
  StationDetail,
  UserDetail,
} from '@/types/api'
import { ADMINS, CAPABILITIES, SHOPS, STATION_USERS, USERS, runtime, type MockAdmin } from './data'

/**
 * 内置 mock 分发层。
 * 契约与 docs/admin-app/03-后端技术方案.md §6 完全一致，后端就绪后删掉 mock 分支即可切换到真实接口，
 * 页面与 api 层代码零改动。
 */

const STORAGE_BOUND = 'admin_mock_bound'

const getBoundId = (): number => {
  try {
    return Number(Taro.getStorageSync(STORAGE_BOUND)) || 0
  } catch {
    return 0
  }
}

const setBoundId = (id: number) => {
  try {
    Taro.setStorageSync(STORAGE_BOUND, String(id))
  } catch {
    // ignore
  }
}

export const clearMockBound = () => {
  try {
    Taro.removeStorageSync(STORAGE_BOUND)
  } catch {
    // ignore
  }
}

/** 用户完整手机号，仅 mock 内部用于「手机号精确搜索」，不会返回给页面 */
const ORDER_PHONES: Record<number, string> = {
  1001: '13812348000',
  1002: '13912342311',
  1003: '13712346677',
  1004: '13612349088',
  2001: '13712346677',
  2002: '13912342311',
  2003: '13812348000',
  2004: '13612349088',
  2005: '13912342311',
}

const NICKNAMES: Record<number, string> = {
  1001: '陈先生',
  1002: '林女士',
  1003: '赵先生',
  1004: '周先生',
  2001: '赵先生',
  2002: '林女士',
  2003: '陈先生',
  2004: '周先生',
  2005: '林女士',
}

const delay = (ms = 280) => new Promise(resolve => setTimeout(resolve, ms))

const toProfile = (admin: MockAdmin): AdminProfile => ({
  id: admin.id,
  name: admin.name,
  phone: admin.phone,
  role: admin.role,
  role_text: admin.role_text,
  shops: admin.shops,
  bound_at: admin.bound_at,
  last_login_at: admin.last_login_at,
})

const requireAdmin = (): MockAdmin => {
  const admin = ADMINS.find(a => a.id === getBoundId())
  if (!admin) throw new ApiError(401, '登录已失效，请重新登录')
  return admin
}

const normalizePlate = (value: string) => String(value || '').replace(/[·\s\-]/g, '').toUpperCase()

const pad = (n: number) => String(n).padStart(2, '0')

const clockText = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

interface Ctx {
  params: string[]
  data: Record<string, any>
}

type Handler = (ctx: Ctx) => unknown

interface Route {
  method: string
  pattern: RegExp
  handler: Handler
}

const routes: Route[] = [
  // ---------------- 认证 ----------------
  {
    method: 'POST',
    pattern: /^\/auth\/wx-login$/,
    handler: () => {
      const bound = getBoundId()
      const admin = ADMINS.find(a => a.id === bound)
      if (admin) {
        return {
          need_bind: false,
          token: `mock-token-${admin.id}`,
          expires_in: 604800,
          profile: toProfile(admin),
        }
      }
      runtime.ticket = `mock-ticket-${Date.now()}`
      return { need_bind: true, ticket: runtime.ticket }
    },
  },
  {
    method: 'POST',
    pattern: /^\/auth\/bind$/,
    handler: ({ data }) => {
      const phone = String(data?.phone || '').trim()
      const code = String(data?.auth_code || '').trim()
      const admin = ADMINS.find(a => a.phone === phone)
      if (!admin) throw new ApiError(40001, '该手机号未开通管理员权限，请联系总部运营')
      if (admin.auth_code !== code) throw new ApiError(40002, '授权码不正确或已失效')
      setBoundId(admin.id)
      return {
        token: `mock-token-${admin.id}`,
        expires_in: 604800,
        profile: toProfile(admin),
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/auth\/logout$/,
    handler: () => {
      clearMockBound()
      return {}
    },
  },
  {
    method: 'GET',
    pattern: /^\/auth\/profile$/,
    handler: () => toProfile(requireAdmin()),
  },

  // ---------------- 门店与工位 ----------------
  {
    method: 'GET',
    pattern: /^\/shops$/,
    handler: (): Shop[] => requireAdmin().shops,
  },
  {
    method: 'GET',
    pattern: /^\/shops\/(\d+)\/stations$/,
    handler: ({ params }): ShopOverview => {
      requireAdmin()
      const shopId = Number(params[0])
      const shop = SHOPS.find(s => s.id === shopId)
      if (!shop) throw new ApiError(40403, '门店不存在')
      const stations = runtime.stations
        .filter(s => s.shop_id === shopId)
        .sort((a, b) => a.id - b.id)
      const summary = stations.reduce(
        (acc, s) => {
          if (s.status === 'busy') acc.busy += 1
          else if (s.status === 'idle') acc.idle += 1
          else if (s.status === 'repair') acc.repairing += 1
          return acc
        },
        { busy: 0, idle: 0, repairing: 0 },
      )
      const now = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      return {
        shop,
        summary,
        stations,
        refreshed_at: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`,
      }
    },
  },
  {
    method: 'GET',
    pattern: /^\/shops\/(\d+)\/capabilities$/,
    handler: ({ params }): Capability[] => {
      requireAdmin()
      return (CAPABILITIES[Number(params[0])] || []).filter(c => c.enabled)
    },
  },
  {
    method: 'GET',
    pattern: /^\/stations\/(\d+)$/,
    handler: ({ params }): StationDetail => {
      requireAdmin()
      const station = runtime.stations.find(s => s.id === Number(params[0]))
      if (!station) throw new ApiError(40404, '工位不存在')

      // 设备类能力只取 placement=station 的项；门店工具（停车）不出现在工位详情
      const capabilities = (CAPABILITIES[station.shop_id] || []).filter(
        c => c.enabled && (c.placement ?? 'station') === 'station',
      )

      let order: StationDetail['order'] = null
      if (station.status === 'busy' && station.order_id && station.started_at) {
        const source = runtime.orders.find(o => o.id === station.order_id)
        const user = STATION_USERS[station.id]
        if (source && user) {
          order = {
            id: source.id,
            order_no: source.order_no,
            started_at: station.started_at,
            user,
          }
        }
      }

      return { ...station, capabilities, order }
    },
  },
  {
    method: 'POST',
    pattern: /^\/stations\/(\d+)\/maintenance$/,
    handler: ({ params, data }): Station => {
      const admin = requireAdmin()
      const station = runtime.stations.find(s => s.id === Number(params[0]))
      if (!station) throw new ApiError(40404, '工位不存在')
      // action 优先；兼容早期 enable 写法，避免前端漏改一处就静默失效
      const enable = data?.action ? data.action === 'set' : Boolean(data?.enable)
      // 与后端一致：设为维护要求 work_status=1（有空单/清洁中都拒）
      const workStatus = station.work_status ?? (station.order_id ? 2 : 1)
      if (enable && workStatus !== 1) {
        throw new ApiError(41100, workStatus === 3 ? '工位清洁中，请先断电' : '工位正在使用中，无法设置维护')
      }
      station.status = enable ? 'repair' : workStatus === 1 ? 'idle' : 'busy'
      if (enable) {
        station.maintenance_at = clockText(new Date())
        station.maintenance_by = admin.name
      } else {
        delete station.maintenance_at
        delete station.maintenance_by
      }
      return station
    },
  },
  {
    method: 'POST',
    pattern: /^\/stations\/(\d+)\/power$/,
    handler: ({ params, data }): { station: Station; message: string } => {
      const admin = requireAdmin()
      const station = runtime.stations.find(s => s.id === Number(params[0]))
      if (!station) throw new ApiError(40404, '工位不存在')
      const action = String(data?.action || '')
      if (action !== 'on' && action !== 'off') throw new ApiError(40011, 'action 只能是 on 或 off')
      const workStatus = station.work_status ?? (station.order_id ? 2 : 1)
      if (station.order_id) throw new ApiError(41100, '工位有进行中的订单，请先结束订单')
      // 与后端一致：通电 = work_status 1→3（清洁中），断电 = →1，都不校验 status（维护中也能通电）
      if (action === 'on' && workStatus !== 1) {
        throw new ApiError(41100, workStatus === 3 ? '工位已在清洁中，无需重复通电' : '工位正在使用中，无法通电')
      }
      station.work_status = action === 'on' ? 3 : 1
      if (station.status !== 'repair' && station.status !== 'off') {
        station.status = station.work_status === 1 ? 'idle' : 'busy'
      }
      station.power_state = action
      station.power_at = new Date().toISOString()
      station.power_by = admin.name
      return {
        station,
        message: action === 'on' ? '已下发通电指令' : '已下发断电指令',
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/stations\/(\d+)\/commands$/,
    handler: ({ params, data }) => {
      requireAdmin()
      const station = runtime.stations.find(s => s.id === Number(params[0]))
      if (!station) throw new ApiError(40404, '工位不存在')
      const key = String(data?.key || data?.command || '')
      const messages: Record<string, string> = {
        open_gate: '已发送开门指令',
        voice: '语音播报已下发',
        ventilation: '已开启通风，5 分钟后自动关闭',
        towel_cabinet: '毛巾柜命令已下发',
      }
      const message = messages[key]
      if (!message) throw new ApiError(40010, `能力不存在：${key}`)
      // 设备离线：按文档「不假装成功」，返回未下发
      if (station.status === 'off') {
        return { accepted: false, key, message: '设备离线，指令未下发' }
      }
      return { accepted: true, key, message }
    },
  },
  {
    method: 'POST',
    pattern: /^\/orders\/(\d+)\/finish$/,
    handler: ({ params }) => {
      requireAdmin()
      const orderId = Number(params[0])
      const station = runtime.stations.find(s => s.order_id === orderId)
      if (!station) throw new ApiError(40408, '当前工位没有进行中的订单')
      const order = runtime.orders.find(o => o.id === orderId)
      if (!order) throw new ApiError(40405, '订单不存在')
      order.status = 'done'
      order.ended_at = new Date().toISOString()
      station.status = 'idle'
      station.work_status = 1
      delete station.order_id
      delete station.started_at
      delete station.plate_tail
      return { order_id: orderId, station_id: station.id, status: 'done' }
    },
  },

  // ---------------- 停车代缴 ----------------
  {
    method: 'GET',
    pattern: /^\/parking\/records$/,
    handler: ({ data }) => {
      requireAdmin()
      const shopId = Number(data?.shop_id || 0)
      const list = runtime.parking
        .filter(r => !shopId || r.shop_id === shopId)
        .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))
        .slice(0, 10)
      return { list }
    },
  },
  {
    method: 'POST',
    pattern: /^\/parking\/pay$/,
    handler: ({ data }) => {
      const admin = requireAdmin()
      const raw = String(data?.plate_no || '')
        .replace(/[·\s\-]/g, '')
        .toUpperCase()
        .slice(0, 8)
      if (!raw) throw new ApiError(40020, '请先录入车牌')
      // 展示与存储统一用「沪A·D2311」格式，避免记录列表与录入形态不一致
      const plate = raw.length > 2 ? `${raw.slice(0, 2)}·${raw.slice(2)}` : raw
      const paid = runtime.parking.find(r => r.plate_no === plate)
      // 10 分钟内同车牌重复提交：需要 confirm_again=1 才放行
      const recent =
        runtime.lastParking.plate === plate && Date.now() - runtime.lastParking.at < 10 * 60 * 1000
      if (recent && !data?.confirm_again) {
        throw new ApiError(40902, '该车牌 10 分钟内已提交过一次，请确认后再缴')
      }
      const now = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      const stamp = `${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`
      runtime.lastParking = { plate, at: Date.now() }
      runtime.parking.unshift({
        id: Date.now(),
        shop_id: Number(data?.shop_id || admin.shop_ids[0]),
        plate_no: plate,
        paid_at: stamp,
        operator: admin.name,
      })
      if (paid) {
        // 已缴过的车牌：仍然返回成功，但带上提示让现场知道是重复操作
        return { accepted: true, plate_no: plate, message: '代缴成功，已放行（该车牌此前已代缴过）' }
      }
      return { accepted: true, plate_no: plate, message: '代缴成功，已放行' }
    },
  },

  // ---------------- 订单 ----------------
  {
    method: 'GET',
    pattern: /^\/orders$/,
    handler: ({ data }): { total: number; list: OrderItem[] } => {
      requireAdmin()
      const phone = String(data?.phone || '').trim()
      const plate = normalizePlate(data?.plate)
      const shopId = Number(data?.shop_id || 0)
      const range = String(data?.range || '7d')
      const now = new Date()

      let list = runtime.orders.filter(order => {
        if (shopId && order.shop_id !== shopId) return false
        if (phone && ORDER_PHONES[order.id] !== phone) return false
        if (plate && !normalizePlate(order.plate_no).includes(plate)) return false
        if (range === 'today' && !isSameDay(new Date(order.started_at), now)) return false
        if (range === '7d' && now.getTime() - new Date(order.started_at).getTime() > 7 * 86400000) return false
        return true
      })

      list = list.sort((a, b) => {
        if (a.status === 'ongoing' && b.status !== 'ongoing') return -1
        if (b.status === 'ongoing' && a.status !== 'ongoing') return 1
        return new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      })

      return { total: list.length, list }
    },
  },
  {
    method: 'GET',
    pattern: /^\/orders\/(\d+)$/,
    handler: ({ params }): OrderDetail => {
      requireAdmin()
      const order = runtime.orders.find(o => o.id === Number(params[0]))
      if (!order) throw new ApiError(40405, '订单不存在')
      const payState = order.status === 'ongoing' ? 'unpaid' : order.amount === 0 ? 'free' : 'paid'
      const finished = order.status === 'done'
      return {
        ...order,
        user_id: 500 + order.id,
        nickname: NICKNAMES[order.id] || '用户',
        pay_status: payState,
        pay_text: payState === 'unpaid' ? '未结算' : payState === 'free' ? '免费' : '已支付',
        fee: {
          total_fee: finished ? order.amount || 0 : 0,
          balance: finished ? order.amount || 0 : 0,
          experience_minutes: 0,
          night_discount: 0,
          new_user_minutes: 0,
        },
        parking_paid_at: undefined,
        can_finish: order.status === 'ongoing',
        can_pay_parking: Boolean(order.plate_no),
      }
    },
  },

  // ---------------- 整洁奖励审核 ----------------
  {
    method: 'GET',
    pattern: /^\/reviews$/,
    handler: ({ data }): { total: number; list: ReviewItem[] } => {
      requireAdmin()
      const status = String(data?.status || 'pending')
      const list = runtime.reviews.filter(r => r.status === status)
      return { total: list.length, list }
    },
  },
  {
    method: 'POST',
    pattern: /^\/reviews\/(\d+)\/approve$/,
    handler: ({ params }): ReviewItem => {
      requireAdmin()
      const review = runtime.reviews.find(r => r.id === Number(params[0]))
      if (!review) throw new ApiError(40406, '待审记录不存在')
      if (review.status !== 'pending') throw new ApiError(40902, '该记录已被处理')
      review.status = 'approved'
      review.waited_text = '已处理'
      return review
    },
  },
  {
    method: 'POST',
    pattern: /^\/reviews\/(\d+)\/reject$/,
    handler: ({ params, data }): ReviewItem => {
      requireAdmin()
      const review = runtime.reviews.find(r => r.id === Number(params[0]))
      if (!review) throw new ApiError(40406, '待审记录不存在')
      if (review.status !== 'pending') throw new ApiError(40902, '该记录已被处理')
      const remark = String(data?.remark || '').trim()
      if (!remark) throw new ApiError(40011, '请填写拒绝理由')
      review.status = 'rejected'
      review.review_remark = remark
      review.waited_text = '已处理'
      return review
    },
  },

  // ---------------- 用户 ----------------
  {
    method: 'GET',
    pattern: /^\/users\/(\d+)$/,
    handler: ({ params }): UserDetail => {
      requireAdmin()
      const user = USERS.find(u => u.id === Number(params[0]))
      if (!user) throw new ApiError(40407, '用户不存在')
      return user
    },
  },
]

const notFound = (method: string, path: string) =>
  new ApiError(40400, `mock 未实现：${method} ${path}`)

/**
 * 执行一次 mock 请求。
 * 未命中的路由会抛 404 并带上路径，便于开发期立刻发现契约缺口。
 */
export async function dispatchMock<T>(path: string, method: string, data?: Record<string, any>): Promise<T> {
  const cleanPath = path.split('?')[0]
  const route = routes.find(r => r.method === method && r.pattern.test(cleanPath))
  if (!route) throw notFound(method, cleanPath)

  const params = route.pattern.exec(cleanPath)?.slice(1) || []
  // 写操作慢一点，让按钮 loading / 防重复点击在真机上真的被看见
  await delay(method === 'GET' ? 220 : 420)
  return route.handler({ params, data: data || {} }) as T
}

/** 「我的」页展示用：当前 mock 可登录的账号（仅 mock 开启时读取） */
export const mockAccounts = () =>
  ADMINS.map(a => ({ name: a.name, phone: a.phone, code: a.auth_code, role: a.role_text }))
