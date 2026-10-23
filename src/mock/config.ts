import Taro from '@tarojs/taro'
import { CURRENT_ENV, getEnvConfig } from '@/config/env'

/**
 * Mock 开关。
 *
 * 优先级：production 恒关 > 本地 Storage 手动覆盖 > 环境默认值。
 * 用途：后端 /admin/v1 未就绪期间，让真机能完整走查界面与交互。
 * 关闭方式（调试用）：在「我的」页连续点击版本号，或手动写 Storage('admin_mock_switch') = '0'。
 */
const SWITCH_KEY = 'admin_mock_switch'

export const isMockEnabled = (): boolean => {
  if (CURRENT_ENV === 'production') return false
  try {
    const override = Taro.getStorageSync(SWITCH_KEY)
    if (override === '1') return true
    if (override === '0') return false
  } catch {
    // ignore
  }
  return getEnvConfig().enableMock
}

export const setMockEnabled = (on: boolean) => {
  try {
    Taro.setStorageSync(SWITCH_KEY, on ? '1' : '0')
  } catch {
    // ignore
  }
}

/** 深拷贝，避免调用方改到 mock 源数据 */
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
