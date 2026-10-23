import Taro from '@tarojs/taro'
import { ApiError } from '@/utils/error'
import type {
  AdminProfile,
  Capability,
  OrderDetail,
  OrderItem,
  ReviewItem,
  Shop,
  Station,
  UserDetail,
} from '@/types/api'
import { ADMINS, CAPABILITIES, USERS, runtime, type MockAdmin } from './data'

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
    handler: ({ params }): Station[] => {
      requireAdmin()
      const shopId = Number(params[0])
      return runtime.stations
        .filter(s => s.shop_id === shopId)
        .sort((a, b) => a.id - b.id)
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
    handler: ({ params }): Station => {
      requireAdmin()
      const station = runtime.stations.find(s => s.id === Number(params[0]))
      if (!station) throw new ApiError(40404, '工位不存在')
      return station
    },
  },
  {
    method: 'POST',
    pattern: /^\/stations\/(\d+)\/maintenance$/,
    handler: ({ params, data }): Station => {
      const admin = requireAdmin()
      const station = runtime.stations.find(s => s.id === Number(params[0]))
      if (!station) throw new ApiError(40404, '工位不存在')
      if (station.status === 'busy') throw new ApiError(40901, '工位正在使用中，无法设置维护')
      const enable = Boolean(data?.enable)
      station.status = enable ? 'repair' : 'idle'
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
    pattern: /^\/stations\/(\d+)\/commands$/,
    handler: ({ params, data }) => {
      requireAdmin()
      const station = runtime.stations.find(s => s.id === Number(params[0]))
      if (!station) throw new ApiError(40404, '工位不存在')
      const command = String(data?.command || '')
      if (!['towel', 'fan'].includes(command)) throw new ApiError(40010, '不支持的设备命令')
      return {
        accepted: true,
        command,
        message: command === 'towel' ? '取巾命令已下发' : '通风命令已下发',
      }
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
      return {
        ...order,
        user_id: 500 + order.id,
        nickname: NICKNAMES[order.id] || '用户',
        pay_status: payState,
        pay_text: payState === 'unpaid' ? '未结算' : payState === 'free' ? '免费' : '已支付',
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
