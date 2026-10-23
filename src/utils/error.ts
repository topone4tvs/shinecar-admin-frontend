/** 接口错误。code 与后端 internal/pkg/response 的 code 保持一致；-1 表示网络层失败 */
export class ApiError extends Error {
  code: number
  data?: unknown
  traceId?: string

  constructor(code: number, message: string, data?: unknown, traceId?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.data = data
    this.traceId = traceId
  }
}
