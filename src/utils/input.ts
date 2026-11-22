/**
 * 小程序表单取值。
 *
 * 为什么不用 `v-model`：Taro 4 在微信端把 `<input v-model="x">` 编译成给 x 赋值时，
 * 赋进去的不是字符串而是**输入事件对象**，于是后续 `x.trim()` 直接抛
 * `TypeError: xxx.trim is not a function`（2026-10-23 登录页实测）。
 * 官方文档说「HTML 表单标签会自动对接 value / @input」，实际行为并不一致，
 * 所以这里统一用 `:value` + `@input` 受控写法，取值走这个函数，永远拿到 string。
 */

type AnyInputEvent = {
  detail?: { value?: unknown }
  target?: { value?: unknown }
}

/** 从小程序 input 事件里取出字符串值；任何异常形态都退化为空串 */
export const inputValue = (event: unknown): string => {
  if (typeof event === 'string') return event
  if (event === null || typeof event !== 'object') return ''

  const { detail, target } = event as AnyInputEvent
  const raw =
    detail && typeof detail === 'object' && 'value' in detail
      ? detail.value
      : target && typeof target === 'object' && 'value' in target
        ? target.value
        : undefined

  if (raw === null || raw === undefined) return ''
  // type="number" 在部分运行时会给出数字，统一转成字符串再交给正则 / trim
  return typeof raw === 'string' ? raw : String(raw)
}
