/** 展示层格式化。金额只在「已结束订单」出现；进行中订单不回金额。 */

const pad = (n: number) => String(n).padStart(2, '0')

/** 秒 → 01:02:10（工位计时） */
export const formatDuration = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/** 秒 → 「已洗 01:02:10」，超过一天按天显示 */
export const formatElapsed = (seconds: number): string => `已洗 ${formatDuration(seconds)}`

export const formatMoney = (value?: number): string =>
  typeof value === 'number' ? `¥${value.toFixed(2)}` : '—'

/** ISO → 10-18 10:24 */
export const formatDateTime = (iso?: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ISO → 10:24 */
export const formatClock = (iso?: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 秒数差（用于计时器每秒刷新） */
export const secondsSince = (iso?: string): number => {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
}

export const maskPhone = (phone: string): string =>
  phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(7)}` : phone
