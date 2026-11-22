/**
 * 环境配置管理
 * 兼容微信小程序环境，不使用 process.env；环境在构建期由 TARO_APP_ENV 决定
 */
export type Environment = 'development' | 'pre' | 'production'

export interface EnvConfig {
  /** 后端基址 */
  apiBaseUrl: string
  /** 管理端接口前缀（C 端接口不加此前缀） */
  adminApiPrefix: string
  /** 资源服务器 */
  assetBaseUrl: string
  /** 当前小程序 appid */
  wechatAppId: string
  /** 是否输出调试日志 */
  enableDebug: boolean
  /**
   * 是否启用内置 mock 数据。
   * 后端未接入时用于真机走查 UI 与交互；production 恒为 false，不可覆盖。
   */
  enableMock: boolean
}

const normalizeEnv = (env: string): Environment => {
  if (env === 'pre' || env === 'production') {
    return env
  }
  return 'development'
}

export const CURRENT_ENV: Environment = normalizeEnv(__APP_ENV__)

const envConfigs: Record<Environment, EnvConfig> = {
  development: {
    // 同机并行跑多个 trace 的后端时，用 TARO_APP_API_BASE_URL 覆盖（见 config/index.ts）
    apiBaseUrl: __API_BASE__ || 'http://127.0.0.1:8991',
    adminApiPrefix: '/admin/v1',
    assetBaseUrl: 'https://res.shinecar.club',
    wechatAppId: 'wx4cb45f57b38380a7',
    enableDebug: true,
    enableMock: true,
  },
  pre: {
    apiBaseUrl: 'https://pre-api.shinecar.club',
    adminApiPrefix: '/admin/v1',
    assetBaseUrl: 'https://res.shinecar.club',
    wechatAppId: 'wx4cb45f57b38380a7',
    enableDebug: true,
    // 预发默认也走 mock：后端 /admin/v1 尚未实现，先保证真机可完整走查
    enableMock: true,
  },
  production: {
    apiBaseUrl: 'https://api.shinecar.club',
    adminApiPrefix: '/admin/v1',
    assetBaseUrl: 'https://res.shinecar.club',
    wechatAppId: 'wx4cb45f57b38380a7',
    enableDebug: false,
    enableMock: false,
  },
}

export const getEnvConfig = (): EnvConfig => envConfigs[CURRENT_ENV]

export const isDev = CURRENT_ENV === 'development'
