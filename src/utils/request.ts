import Taro from '@tarojs/taro'
import { getEnvConfig } from '@/config/env'
import { isMockEnabled } from '@/mock/config'
import { dispatchMock } from '@/mock'
import { clearToken, getToken } from './token'
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
  clearToken()
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 统一请求入口。
 * 约定：不自动 toast（列表页内联展示、操作类由调用方 toast），只抛 ApiError。
 *
 * mock 模式下（development / pre）请求不发出网络，直接由内置 mock 层按同一契约返回，
 * 后端 /admin/v1 就绪后关掉开关即可，页面与 api 层无需改动。
 */
export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, auth = true, timeout = DEFAULT_TIMEOUT } = options

  if (isMockEnabled()) {
    return dispatchMock<T>(url, method, data as Record<string, any> | undefined)
  }

  const header: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) header.Authorization = `Bearer ${token}`
  }
  if (method !== 'GET') {
    header['Idempotency-Key'] = options.idempotencyKey || genIdempotencyKey()
  }

  const send = () =>
    Taro.request<ApiEnvelope<T>>({
      url: buildUrl(url),
      method,
      data,
      header,
      timeout,
    })

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
    handleUnauthorized(code ?? 401, body?.message || '登录已失效')
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

export const get = <T = unknown>(url: string, data?: Record<string, any>, options?: Partial<RequestOptions>) =>
  request<T>({ url, method: 'GET', data, ...options })

export const post = <T = unknown>(url: string, data?: Record<string, any>, options?: Partial<RequestOptions>) =>
  request<T>({ url, method: 'POST', data, ...options })

export const patch = <T = unknown>(url: string, data?: Record<string, any>, options?: Partial<RequestOptions>) =>
  request<T>({ url, method: 'PATCH', data, ...options })
