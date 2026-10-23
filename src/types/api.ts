/** 管理端通用类型（与 docs/admin-app/03-后端技术方案.md §6 契约保持一致） */

export type AdminRole = 'super' | 'area' | 'shop'

export interface Shop {
  id: number
  name: string
  station_total: number
  /** 当前账号在该门店的权限标记，由后端返回 */
  can_manage?: boolean
}

export interface AdminProfile {
  id: number
  name: string
  phone: string
  role: AdminRole
  role_text: string
  shops: Shop[]
  bound_at: string
  last_login_at?: string
}
