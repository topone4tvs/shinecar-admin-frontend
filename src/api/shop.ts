import { get, post } from '@/utils/request'
import type { Capability, Shop, ShopOverview, Station, StationDetail } from '@/types/api'

/** 当前账号可管理的门店 */
export const fetchShops = () => get<Shop[]>('/shops')

/**
 * 现场页首屏：门店 + 汇总 + 工位列表一次拿全。
 * 拆成多个请求会让首屏出现「数字到了、格子还没到」的错位。
 */
export const fetchShopOverview = (shopId: number) => get<ShopOverview>(`/shops/${shopId}/stations`)

/** 门店能力配置（停车 / 通风…），未启用的不返回 */
export const fetchCapabilities = (shopId: number) => get<Capability[]>(`/shops/${shopId}/capabilities`)

/** 工位详情聚合：进行中订单 + 用户资产 + 本工位设备能力 */
export const fetchStation = (stationId: number) => get<StationDetail>(`/stations/${stationId}`)

/** 维护开关：使用中的工位不允许设置 */
export const setMaintenance = (stationId: number, action: 'set' | 'clear') =>
  post<Station>(`/stations/${stationId}/maintenance`, { action })

/** 统一设备命令入口：开门 / 语音 / 通风 / 毛巾柜 */
export const sendCommand = (
  stationId: number,
  key: 'open_gate' | 'voice' | 'ventilation' | 'towel_cabinet',
  params?: Record<string, unknown>,
) =>
  post<{ accepted: boolean; key: string; message: string }>(
    `/stations/${stationId}/commands`,
    { key, params },
    { timeout: 8000 },
  )
