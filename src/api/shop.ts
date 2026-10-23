import { get, post } from '@/utils/request'
import type { Capability, Shop, Station } from '@/types/api'

/** 当前账号可管理的门店 */
export const fetchShops = () => get<Shop[]>('/shops')

/** 门店工位实时状态 */
export const fetchStations = (shopId: number) => get<Station[]>(`/shops/${shopId}/stations`)

/** 门店能力配置（停车 / 毛巾柜 / 通风…），未启用的不返回 */
export const fetchCapabilities = (shopId: number) => get<Capability[]>(`/shops/${shopId}/capabilities`)

export const fetchStation = (stationId: number) => get<Station>(`/stations/${stationId}`)

/** 维护开关：使用中的工位不允许设置 */
export const setMaintenance = (stationId: number, enable: boolean) =>
  post<Station>(`/stations/${stationId}/maintenance`, { enable })

/** 设备命令（毛巾柜 / 通风），只下发不查询状态 */
export const sendCommand = (stationId: number, command: 'towel' | 'fan') =>
  post<{ accepted: boolean; message: string }>(`/stations/${stationId}/commands`, { command }, { timeout: 8000 })
