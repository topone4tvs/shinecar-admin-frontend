import Taro from '@tarojs/taro'
import { getEnvConfig } from '@/config/env'
import { isMockEnabled } from '@/mock/config'
import { dispatchMock } from '@/mock'
import { clearToken, getToken, setToken } from './token'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from './error'

export { ApiError }

/** 后端统一响应体（internal/pkg/response/response.go） */
export interface ApiEnvelope<T> {
  code: number
  message: string
  data?: T
  success?: boolean
}

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  data?: Record<string, any>
  /** 是否携带 Authorization，默认 true */
  auth?: boolean
  /** 写操作幂等键；不传时自动生成。同一按钮重试请复用同一个 key */
  idempotencyKey?: string
  /** 默认 15s，设备命令建议 8s */
  timeout?: number
}

const DEFAULT_TIMEOUT = 15000
const LOGIN_PAGE = '/pages/login/index'

let redirecting = false

const genIdempotencyKey = (): string => {
  const rand = () => Math.random().toString(16).slice(2, 10)
  return `${Date.now().toString(36)}-${rand()}-${rand()}`
}

const buildUrl = (url: string): string => {
  if (/^https?:\/\//.test(url)) return url
  const { apiBaseUrl, adminApiPrefix } = getEnvConfig()
  return `${apiBaseUrl}${adminApiPrefix}${url}`
}

const handleUnauthorized = (code: number, message: string) => {
  // 只清 storage 不够：store 里的 token 还是旧的，登录页会拿着它去验活、又被踢回来
  try {
    useAuthStore().reset()
  } catch {
    clearToken()
  }
  if (redirecting) return
  redirecting = true
  Taro.showToast({
    title: code === 40101 ? '账号已在其他设备登录' : message || '登录已失效，请重新登录',
    icon: 'none',
    duration: 1500,
  })
  setTimeout(() => {
    Taro.reLaunch({ url: LOGIN_PAGE }).finally(() => {
      redirecting = false
    })
  }, 800)
}

let renewing: Promise<boolean> | null = null

/**
 * token 失效时静默续期：openid 绑定过就把 token 换回来，用户全程无感。
 *
 * 后端 `/auth/wx-login` 本身就是续期接口（没有 refresh token，见 adminapp/token.go），
 * 这里直接用裸 Taro.request 而不是走本文件的 request()，避免 401 → 续期 → 401 的自递归。
 * 单飞：并发的多个 401 只发一次 wx.login。
 */
const renewSession = (): Promise<boolean> => {
  if (!renewing) {
    renewing = doRenew().finally(() => {
      renewing = null
    })
  }
  return renewing
}

const doRenew = async (): Promise<boolean> => {
  // 演示模式的 token 是假字符串、不会过期，也没有真实 wx-login 可打
  if (isMockEnabled()) return false
  try {
    const { code } = await Taro.login()
    const res = await Taro.request<ApiEnvelope<{ need_bind?: boolean; token?: string }>>({
      url: buildUrl('/auth/wx-login'),
      method: 'POST',
      data: { code },
      header: { 'Content-Type': 'application/json' },
      timeout: 8000,
    })
    const token = res.data?.data?.token
    // need_bind（openid 没绑过账号）也落在这里：交给登录页去露绑定表单
    if (!token) return false
    setToken(token)
    // 同步 store，否则登录页拿着旧 token 调 applyAuth 会把新 token 又写回旧的
    try {
      useAuthStore().token = token
    } catch {
      // pinia 尚未安装（极早期调用）：只更新 storage 也够用
    }
    return true
  } catch {
    return false
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 清掉查询参数里的 undefined / null。
 *
 * 小程序 wx.request 对对象形式的 data 会自己拼 query string，把 undefined 拼成**字面量** `plate=undefined`
 * （真机抓包实测）。后端把它当成筛选条件，就永远查不到结果——这种“有值但查不到”最难排查。
 * POST 走 JSON.stringify 时 undefined 本来就会被丢掉，所以只处理 GET。
 */
const compactQuery = (data?: Record<string, any>): Record<string, any> | undefined => {
  if (!data) return data
  const out: Record<string, any> = {}
  Object.keys(data).forEach(key => {
    const value = data[key]
    if (value === undefined || value === null) return
    out[key] = value
  })
  return out
}

/**
 * 统一请求入口。
 * 约定：不自动 toast（列表页内联展示、操作类由调用方 toast），只抛 ApiError。
 *
 * 401 处理：先静默续期（openid 绑定过就无需用户参与），成功则把这次请求重放一次；
 * 续期失败才清 token + 回登录页。token 过期可能发生在任何一次请求上，这一层兜住全部。
 *
 * mock 模式下（development / pre）请求不发出网络，直接由内置 mock 层按同一契约返回，
 * 后端 /admin/v1 就绪后关掉开关即可，页面与 api 层无需改动。
 */
export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, auth = true, timeout = DEFAULT_TIMEOUT } = options

  if (isMockEnabled()) {
    return dispatchMock<T>(url, method, data as Record<string, any> | undefined)
  }

  // 幂等键在「401 续期后重放」时复用同一个值，后端据此判重，不会重复扣费/下发
  const fixedHeader: Record<string, string> = {}
  if (method !== 'GET') {
    fixedHeader['Idempotency-Key'] = options.idempotencyKey || genIdempotencyKey()
  }

  // 每次重发都重新取 token：续期后拿到的才是新的
  const send = () => {
    const header: Record<string, string> = { 'Content-Type': 'application/json', ...fixedHeader }
    if (auth) {
      const token = getToken()
      if (token) header.Authorization = `Bearer ${token}`
    }
    return Taro.request<ApiEnvelope<T>>({
      url: buildUrl(url),
      method,
      data: method === 'GET' ? compactQuery(data) : data,
      header,
      timeout,
    })
  }

  /** 发一次并解析。replayed=true 表示本次调用已经续过期，再 401 就放弃，避免死循环 */
  const attempt = async (replayed: boolean): Promise<T> => {
    let res: Taro.request.SuccessCallbackResult<ApiEnvelope<T>>
    try {
      res = await send()
    } catch (error) {
      // 仅 GET 做一次指数退避重试；写操作绝不重试，避免重复扣费/重复下发
      if (method === 'GET') {
        await sleep(300)
        try {
          res = await send()
        } catch {
          throw new ApiError(-1, '网络异常，请稍后重试')
        }
      } else {
        throw new ApiError(-1, '网络异常，请稍后重试')
      }
    }

    const body = res.data
    const traceId = (res.header && (res.header['x-trace-id'] as string)) || undefined
    const code = typeof body?.code === 'number' ? body.code : undefined

    if (res.statusCode === 401 || code === 401 || code === 40101) {
      // 401 由鉴权中间件在 handler 之前返回，请求本身没执行，因此重放不会产生副作用。
      // auth=false 的是公开接口（wx-login / bind），它们的 401 不是「登录失效」，
      // 在这里续期会变成「登录页 → wx-login 401 → 又回登录页」的死循环，所以直接抛给调用方。
      if (auth) {
        if (!replayed && (await renewSession())) return attempt(true)
        handleUnauthorized(code ?? 401, body?.message || '登录已失效')
      }
      throw new ApiError(code ?? 401, body?.message || '登录已失效', body?.data, traceId)
    }

    // 后端路由不存在（返回的不是统一信封）：多数是接口还没实现，别误报成「请求失败」
    if (res.statusCode === 404 && code === undefined) {
      const { adminApiPrefix } = getEnvConfig()
      throw new ApiError(
        404,
        `接口不存在：${method} ${adminApiPrefix}${url}——后端尚未实现该路由`,
        body,
        traceId,
      )
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new ApiError(res.statusCode, body?.message || `请求失败（${res.statusCode}）`, body?.data, traceId)
    }

    if (code === undefined) {
      throw new ApiError(-2, '响应格式异常', body, traceId)
    }

    if (code !== 0) {
      if (getEnvConfig().enableDebug) {
        console.error('[api]', url, code, body?.message, traceId)
      }
      throw new ApiError(code, body?.message || '请求失败', body?.data, traceId)
    }

    return body?.data as T
  }

  return attempt(false)
}

export const get = <T = unknown>(url: string, data?: Record<string, any>, options?: Partial<RequestOptions>) =>
  request<T>({ url, method: 'GET', data, ...options })

export const post = <T = unknown>(url: string, data?: Record<string, any>, options?: Partial<RequestOptions>) =>
  request<T>({ url, method: 'POST', data, ...options })

export const patch = <T = unknown>(url: string, data?: Record<string, any>, options?: Partial<RequestOptions>) =>
  request<T>({ url, method: 'PATCH', data, ...options })
