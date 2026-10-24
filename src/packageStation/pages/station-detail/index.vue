<template>
  <view class="sd">
    <view v-if="loading" class="sd__skeleton">
      <view class="sk sk--hero" />
      <view class="sk sk--card" />
      <view class="sk sk--acts" />
    </view>

    <view v-else-if="!detail" class="sd__empty">
      <text class="sd__empty-title">工位不存在或已下线</text>
      <text class="sd__empty-desc">返回现场页刷新后重试</text>
    </view>

    <block v-else>
      <!-- 计时 Hero：只讲「谁在用、洗了多久」，不含任何金额 -->
      <view class="hero" :class="`hero--${detail.status}`">
        <view class="hero__top">
          <text class="hero__dot" />
          <text class="hero__state">{{ heroStateText }}</text>
        </view>
        <text class="hero__metric" :class="{ 'hero__metric--text': detail.status !== 'busy' }">{{ heroMetric }}</text>
        <text class="hero__sub">{{ heroSub }}</text>
      </view>

      <!-- 当前用户：仅进行中订单有 -->
      <view v-if="detail.order" class="card">
        <view class="card__hd">
          <text class="card__t">当前用户</text>
          <text class="card__x">订单 #{{ detail.order.order_no }}</text>
        </view>

        <view class="kv">
          <text class="kv__k">手机号</text>
          <view class="kv__v">
            <text class="kv__num">{{ detail.order.user.phone_masked }}</text>
            <text class="minibtn" @tap="copyPhone">复制</text>
            <text class="minibtn minibtn--brand" @tap="callPhone">拨打</text>
          </view>
        </view>

        <view class="kv kv--top">
          <text class="kv__k">车牌</text>
          <view class="kv__v kv__v--wrap">
            <text class="plate">{{ orderPlate }}</text>
            <text class="plate-tag">本单</text>
            <text class="minibtn" @tap="copyPlate(orderPlate)">复制</text>
            <text
              v-if="plateList.length > 1"
              class="minibtn minibtn--brand"
              @tap="platesOpen = !platesOpen"
            >
              共 {{ plateList.length }} 个 {{ platesOpen ? '⌃' : '⌄' }}
            </text>
          </view>
        </view>

        <view v-if="platesOpen && plateList.length > 1" class="plates">
          <view v-for="plate in plateList" :key="plate.plate_no" class="plates__i">
            <text class="plate">{{ plate.plate_no }}</text>
            <text class="plate-tag" :class="{ 'plate-tag--plain': !plate.is_order }">
              {{ plate.is_order ? '本单' : '账户' }}
            </text>
            <view class="plates__acts">
              <text class="minibtn" @tap="copyPlate(plate.plate_no)">复制</text>
              <text class="minibtn" @tap="goParking(plate.plate_no)">缴停车费</text>
            </view>
          </view>
          <text class="plates__hint">
            开单时只记录一个车牌，其余为账户下绑定的车辆；代缴停车费前请核对现场车辆。
          </text>
        </view>

        <view class="kv">
          <text class="kv__k">账户余额</text>
          <text class="kv__v kv__num">{{ formatMoney(detail.order.user.balance) }}</text>
        </view>

        <view class="kv">
          <text class="kv__k">团购券</text>
          <view class="kv__v">
            <text class="kv__num">{{ detail.order.user.coupon_count }} 张</text>
          </view>
        </view>
      </view>

      <view v-else class="card card--muted">
        <text class="card__t">当前无使用中的订单</text>
        <text class="card__desc">
          {{ detail.status === 'repair' ? '工位处于维护中，用户端已下线。' : '工位空闲，等待用户扫码开单。' }}
        </text>
        <button v-if="detail.status === 'idle'" class="btn btn--brand btn--inline" @tap="goCreate">
          手动开单
        </button>
      </view>

      <!-- 基础操作：所有门店通用 -->
      <view class="sec">
        <text class="sec__t">基础操作</text>
        <text class="sec__x">所有门店通用</text>
      </view>

      <view class="acts">
        <view class="act act--main" :class="{ 'act--busy': acting }" @tap="doOpenGate">
          <text class="act__ic">开</text>
          <text class="act__t">开门</text>
        </view>
        <view class="act" :class="{ 'act--busy': acting }" @tap="voiceOpen = true">
          <text class="act__ic">播</text>
          <text class="act__t">语音播报</text>
        </view>
        <view
          class="act act--danger"
          :class="{ 'act--disabled': acting || !detail.order }"
          @tap="doFinish"
        >
          <text class="act__ic">停</text>
          <text class="act__t">结束订单</text>
        </view>
        <view class="act" :class="{ 'act--busy': acting }" @tap="doMaintenance">
          <text class="act__ic">维</text>
          <text class="act__t">{{ detail.status === 'repair' ? '解除维护' : '设为维护' }}</text>
        </view>
      </view>

      <!-- 扩展设备：能力配置驱动，无配置整块不显示 -->
      <block v-if="deviceCaps.length">
        <view class="sec">
          <text class="sec__t">扩展设备</text>
          <text class="sec__x">能力配置驱动</text>
        </view>
        <view class="acts">
          <view
            v-for="cap in deviceCaps"
            :key="cap.key"
            class="act"
            :class="{ 'act--busy': acting }"
            @tap="runCapability(cap)"
          >
            <text class="act__ic act__ic--teal">{{ cap.icon }}</text>
            <text class="act__t">{{ cap.name }}全开</text>
          </view>
        </view>
      </block>

      <text class="foot">
        设备命令只保证「已下发」，回执以设备为准。进行中订单不展示费用，费用以结束时结算为准。
      </text>
    </block>

    <!-- 语音播报弹层 -->
    <view v-if="voiceOpen" class="sheet" @tap="voiceOpen = false">
      <view class="sheet__panel" @tap.stop>
        <view class="sheet__head">
          <text class="sheet__title">语音播报</text>
          <text class="sheet__close" @tap="voiceOpen = false">关闭</text>
        </view>
        <view class="presets">
          <text
            v-for="(tpl, i) in VOICE_TEMPLATES"
            :key="i"
            class="preset"
            :class="{ 'preset--on': voiceText === tpl }"
            @tap="voiceText = tpl"
          >
            {{ tpl }}
          </text>
        </view>
        <textarea
          class="voice-input"
          :value="voiceText"
          maxlength="60"
          placeholder="或输入自定义播报内容（60 字以内）"
          placeholder-class="voice-ph"
          @input="onVoiceInput"
        />
        <view class="voice-meta">
          <text class="voice-count">{{ voiceText.length }}/60</text>
        </view>
        <button class="btn btn--brand" :disabled="!voiceText.trim() || acting" @tap="doVoice">
          下发播报
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { fetchStation, sendCommand, setMaintenance } from '@/api/shop'
import { finishOrder } from '@/api/order'
import type { Capability, StationDetail } from '@/types/api'
import { formatClock, formatDuration, formatMoney } from '@/utils/format'
import { ApiError } from '@/utils/error'
import { inputValue } from '@/utils/input'

const VOICE_TEMPLATES = [
  '请将车辆停入工位，扫码即可开始洗车',
  '洗车过程中请勿离开，结束后请及时挪车',
  '今日营业已结束，给您带来不便敬请谅解',
]

const router = useRouter()
const stationId = Number(router.params.id || 0)

const detail = ref<StationDetail | null>(null)
const loading = ref(true)
const acting = ref(false)
const platesOpen = ref(false)
const voiceOpen = ref(false)
const voiceText = ref('')
const now = ref(Date.now())

let timer: ReturnType<typeof setInterval> | null = null

/** 扩展设备：placement=station 的能力；本期只有 ventilation，毛巾柜等未 seed 即不出现 */
const deviceCaps = computed(() => detail.value?.capabilities || [])

const orderPlate = computed(() => {
  const plates = detail.value?.order?.user.plates || []
  return plates.find(p => p.is_order)?.plate_no || plates[0]?.plate_no || '—'
})

const plateList = computed(() => detail.value?.order?.user.plates || [])

const elapsedSeconds = computed(() => {
  const startedAt = detail.value?.started_at
  if (!startedAt) return 0
  const diff = Math.floor((now.value - new Date(startedAt).getTime()) / 1000)
  return diff > 0 ? diff : 0
})

const heroStateText = computed(() => {
  const status = detail.value?.status
  if (status === 'busy') return `使用中 · 已洗 ${formatDuration(elapsedSeconds.value)}`
  if (status === 'repair') return '维护中 · 用户端已下线'
  if (status === 'off') return '已下线'
  return '空闲 · 等待使用'
})

const heroMetric = computed(() => {
  const status = detail.value?.status
  if (status === 'busy') return formatDuration(elapsedSeconds.value)
  if (status === 'repair') return '维护中'
  if (status === 'off') return '已下线'
  return '空闲'
})

const heroSub = computed(() => {
  const d = detail.value
  if (!d) return ''
  if (d.status === 'busy' && d.started_at) return `${d.shop_name} · 开始于 ${formatClock(d.started_at)}`
  if (d.status === 'repair') {
    return `${d.shop_name} · ${d.maintenance_at || ''} 由${d.maintenance_by || '总部'}设置`
  }
  return `${d.shop_name} · 今日暂无订单`
})

const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1800 })

const load = async () => {
  if (!stationId) {
    loading.value = false
    return
  }
  try {
    const res = await fetchStation(stationId)
    detail.value = res
    Taro.setNavigationBarTitle({ title: `${res.name}工位` })
  } catch (error) {
    detail.value = null
    tip(error instanceof ApiError ? error.message : '工位详情加载失败')
  } finally {
    loading.value = false
  }
}

const copy = (text: string, label: string) => {
  Taro.setClipboardData({ data: text, success: () => tip(`已复制${label}`) })
}

const copyPhone = () => {
  if (!detail.value?.order) return
  copy(detail.value.order.user.phone, '手机号')
}

const callPhone = () => {
  if (!detail.value?.order) return
  Taro.makePhoneCall({ phoneNumber: detail.value.order.user.phone }).catch(() => {
    tip('拨号已取消')
  })
}

const copyPlate = (plate: string) => copy(plate, '车牌')

const goParking = (plate: string) => {
  const shopId = detail.value?.shop_id || 0
  Taro.navigateTo({
    url: `/packageStation/pages/parking/index?shop_id=${shopId}&plate=${encodeURIComponent(plate)}`,
  })
}

/** 代客开单：带上当前工位，开单页不用再选 */
const goCreate = () => {
  const d = detail.value
  if (!d) return
  Taro.navigateTo({
    url: `/packageOrder/pages/create/index?shop_id=${d.shop_id}&station_id=${d.id}`,
  })
}

/** 开门：L2，一次性指令，只承诺已下发 */
const doOpenGate = async () => {
  if (!detail.value || acting.value) return
  acting.value = true
  try {
    const res = await sendCommand(detail.value.id, 'open_gate')
    tip(res.message)
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '指令下发失败')
  } finally {
    acting.value = false
  }
}

const onVoiceInput = (event: unknown) => {
  voiceText.value = inputValue(event)
}

const doVoice = async () => {
  if (!detail.value || acting.value) return
  const text = voiceText.value.trim()
  if (!text) {
    tip('请先输入播报内容')
    return
  }
  acting.value = true
  try {
    const res = await sendCommand(detail.value.id, 'voice', { text })
    tip(res.message)
    voiceOpen.value = false
    voiceText.value = ''
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '播报下发失败')
  } finally {
    acting.value = false
  }
}

/** 结束订单：L3，红色确认按钮 + 影响面文案，不可撤回 */
const doFinish = async () => {
  if (!detail.value || acting.value) return
  const order = detail.value.order
  if (!order) {
    tip('当前工位没有进行中的订单')
    return
  }
  const res = await Taro.showModal({
    title: '结束当前订单？',
    content: '将按当前时长结算并立即关单，用户端同步结束。该操作不可撤回。',
    confirmText: '确认结束',
    confirmColor: '#D93026',
    cancelText: '再想想',
  })
  if (!res.confirm) return

  acting.value = true
  try {
    await finishOrder(order.id)
    tip('已结束订单，正在结算')
    await load()
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '结束订单失败')
  } finally {
    acting.value = false
  }
}

/** 维护开关：使用中不允许设置（后端也会拦），解除后恢复可用状态 */
const doMaintenance = async () => {
  if (!detail.value || acting.value) return
  const station = detail.value
  const enable = station.status !== 'repair'

  if (enable && station.order) {
    tip('工位正在使用中，请先结束订单')
    return
  }

  const res = await Taro.showModal({
    title: enable ? `将 ${station.name}工位设为维护中？` : `解除 ${station.name}工位的维护？`,
    content: enable
      ? '工位立即从用户端下线，进行中的订单不受影响。'
      : '解除后工位重新对用户开放，可正常扫码开单。',
    confirmText: enable ? '设为维护' : '解除维护',
    confirmColor: enable ? '#D93026' : '#E6436E',
  })
  if (!res.confirm) return

  acting.value = true
  try {
    await setMaintenance(station.id, enable ? 'set' : 'clear')
    tip(enable ? '已设为维护中' : '已恢复可用')
    await load()
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '操作失败')
  } finally {
    acting.value = false
  }
}

/** 扩展设备命令：confirm 类型先二次确认 */
const runCapability = async (cap: Capability) => {
  if (!detail.value || acting.value) return
  if (cap.confirm === 'confirm') {
    const res = await Taro.showModal({
      title: `开启${cap.name}？`,
      content: '5 分钟后自动关闭，以设备侧状态为准。',
      confirmText: '开启',
      confirmColor: '#E6436E',
    })
    if (!res.confirm) return
  }
  acting.value = true
  try {
    const res = await sendCommand(detail.value.id, cap.key as 'ventilation')
    tip(res.message)
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '指令下发失败')
  } finally {
    acting.value = false
  }
}

onMounted(() => {
  load()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

useDidShow(() => {
  // 从停车缴费等二级页返回时刷新
  if (!loading.value) load()
})
</script>

<style lang="scss">
.sd {
  min-height: 100vh;
  padding: $sp-3 $page-x $sp-6;
}

/* ---------- 加载骨架 ---------- */
.sd__skeleton {
  display: flex;
  flex-direction: column;
  gap: $card-gap;
}

.sk {
  border-radius: $r-3xl;
  background: $line;
  animation: shimmer 1.2s ease-in-out infinite;

  &--hero { height: 260rpx; }
  &--card { height: 380rpx; }
  &--acts { height: 260rpx; }
}

@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.sd__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 32rpx;
}

.sd__empty-title {
  font-size: $fs-body-sm;
  font-weight: $fw-medium;
  color: $ink-2;
}

.sd__empty-desc {
  margin-top: 10rpx;
  font-size: $fs-micro;
  color: $ink-3;
}

/* ---------- 计时 Hero ---------- */
.hero {
  padding: 30rpx;
  border-radius: $r-3xl;
  border: 2rpx solid transparent;
  margin-bottom: $card-gap;

  /* 维护中 / 默认：品牌系 */
  background: linear-gradient(135deg, $brand-soft 0%, $repair-fill 100%);
  border-color: $repair-line;
  color: $repair-ink;

  &--idle {
    background: linear-gradient(135deg, #F3F8F1 0%, #E9F3E3 100%);
    border-color: $idle-line;
    color: $idle-ink;
  }

  &--busy {
    background: linear-gradient(135deg, #FFF9EE 0%, #FFF3DC 100%);
    border-color: $busy-line;
    color: $busy-ink;
  }

  &--off {
    background: $off-fill;
    border-color: $off-line;
    color: $off-ink;
  }

  &__top {
    display: flex;
    align-items: center;
    gap: 10rpx;
    font-size: $fs-caption;
    font-weight: $fw-medium;
  }

  &__dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: $r-full;
    background: currentColor;
    box-shadow: 0 0 0 6rpx rgba(255, 255, 255, 0.55);
  }

  &__metric {
    display: block;
    margin: 16rpx 0 4rpx;
    font-size: $fs-display;
    font-weight: $fw-semibold;
    letter-spacing: -2rpx;
    line-height: 1.1;
    color: $ink;
    @include tabular;

    &--text {
      font-size: $fs-h1;
      letter-spacing: 0;
      margin-top: 22rpx;
      color: inherit;
    }
  }

  &__sub {
    display: block;
    font-size: $fs-caption-sm;
    opacity: 0.75;
  }
}

/* ---------- 卡片 ---------- */
.card {
  @include card;

  &--muted {
    background: $fill-2;
    box-shadow: none;
  }

  &__hd {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 8rpx;
  }

  &__t {
    font-size: $fs-title;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__x {
    font-size: $fs-micro;
    color: $ink-3;
    @include tabular;
  }

  &__desc {
    display: block;
    margin-top: 8rpx;
    font-size: $fs-caption-sm;
    color: $ink-3;
    line-height: 1.6;
  }
}

/* ---------- KV 行 ---------- */
.kv {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72rpx;
  border-top: 1rpx solid $line;

  &--top {
    align-items: flex-start;
    padding-top: 16rpx;
  }

  &__k {
    font-size: $fs-caption;
    color: $ink-3;
    flex: none;
    padding-top: 2rpx;
  }

  &__v {
    display: flex;
    align-items: center;
    gap: 10rpx;
    margin-left: 24rpx;
    justify-content: flex-end;

    &--wrap {
      flex: 1;
      flex-wrap: wrap;
      row-gap: 8rpx;
    }
  }

  &__num {
    font-size: $fs-body;
    color: $ink;
    @include tabular;
  }
}

.plate {
  font-size: $fs-body-sm;
  font-weight: $fw-semibold;
  color: $ink;
  letter-spacing: 1rpx;
}

.plate-tag {
  padding: 0 10rpx;
  height: 34rpx;
  line-height: 34rpx;
  border-radius: $r-xs;
  font-size: $fs-nano;
  background: $brand-soft;
  color: $brand-deep;

  &--plain {
    background: $fill;
    color: $ink-2;
  }
}

.minibtn {
  padding: 0 14rpx;
  height: 40rpx;
  line-height: 40rpx;
  border-radius: $r-xs;
  border: 1rpx solid $line-2;
  background: $card;
  color: $ink-2;
  font-size: $fs-nano;

  &--brand {
    border-color: $brand-line;
    background: $brand-soft;
    color: $brand-deep;
  }
}

/* ---------- 多车牌展开区 ---------- */
.plates {
  margin: 8rpx 0 4rpx;
  padding: 16rpx 20rpx;
  border-radius: $r-lg;
  background: $fill-2;

  &__i {
    display: flex;
    align-items: center;
    gap: 10rpx;
    padding: 12rpx 0;

    & + & {
      border-top: 1rpx solid $line;
    }
  }

  &__acts {
    margin-left: auto;
    display: flex;
    gap: 10rpx;
  }

  &__hint {
    display: block;
    margin-top: 10rpx;
    padding-top: 12rpx;
    border-top: 1rpx dashed $line-3;
    font-size: $fs-nano;
    color: $ink-3;
    line-height: 1.6;
  }
}

/* ---------- 区块标题 ---------- */
.sec {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 32rpx 0 16rpx;

  &__t {
    font-size: $fs-title;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__x {
    font-size: $fs-micro;
    color: $ink-3;
  }
}

/* ---------- 操作网格 ---------- */
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: $grid-gap;
}

.act {
  width: calc((100% - #{$grid-gap}) / 2);
  padding: 24rpx 8rpx 20rpx;
  border-radius: $r-xl;
  border: 2rpx solid $line;
  background: $card;
  display: flex;
  flex-direction: column;
  align-items: center;
  @include press;

  &__ic {
    width: $icon-box;
    height: $icon-box;
    border-radius: $r-lg;
    background: $fill;
    color: $ink-2;
    font-size: $fs-body-sm;
    font-weight: $fw-semibold;
    line-height: $icon-box;
    text-align: center;

    &--teal {
      background: $teal-soft;
      color: $teal-ink;
    }
  }

  &__t {
    margin-top: 12rpx;
    font-size: $fs-caption;
    font-weight: $fw-medium;
    color: $ink;
  }

  &--main {
    .act__ic {
      background: $brand-soft;
      color: $brand-deep;
    }
  }

  &--danger {
    background: $danger-soft;
    border-color: $danger-line;

    .act__ic {
      background: $danger-icon;
      color: $danger-ink;
    }

    .act__t { color: $danger-ink; }
  }

  &--busy { opacity: 0.55; }

  &--disabled {
    opacity: 0.45;
  }
}

.foot {
  display: block;
  margin: 32rpx 4rpx 0;
  font-size: $fs-nano;
  color: $ink-4;
  line-height: 1.7;
}

/* ---------- 语音弹层 ---------- */
.sheet {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 100;
  background: $mask;
  display: flex;
  align-items: flex-end;

  &__panel {
    width: 100%;
    padding: $card-padding $page-x calc(#{$card-padding} + env(safe-area-inset-bottom));
    border-radius: $r-sheet $r-sheet 0 0;
    background: $card;
    box-shadow: $shadow-sheet;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;
  }

  &__title {
    font-size: $fs-h4;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__close {
    font-size: $fs-caption;
    color: $ink-3;
    padding: 8rpx;
  }
}

.presets {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.preset {
  padding: 16rpx 20rpx;
  border-radius: $r-md;
  border: 2rpx solid $line-2;
  background: $card;
  font-size: $fs-caption;
  color: $ink-2;
  line-height: 1.5;

  &--on {
    border-color: $brand;
    background: $brand-soft;
    color: $brand-deep;
  }
}

.voice-input {
  width: 100%;
  box-sizing: border-box;
  height: 140rpx;
  padding: 16rpx;
  border-radius: $r-md;
  background: $fill-2;
  border: 2rpx solid $line-2;
  font-size: $fs-caption;
  color: $ink;
  line-height: 1.6;
}

.voice-ph {
  color: $ink-4;
}

.voice-meta {
  display: flex;
  justify-content: flex-end;
  margin: 8rpx 0 20rpx;
}

.voice-count {
  font-size: $fs-nano;
  color: $ink-4;
  @include tabular;
}

.btn {
  width: 100%;
  height: $btn-h;
  border-radius: $r-md;
  font-size: $fs-title;
  font-weight: $fw-semibold;
  line-height: $btn-h;
  text-align: center;

  &--brand {
    background: $brand;
    color: #FFFFFF;
  }

  /* 卡片内的行内按钮：给上方文案留出间距 */
  &--inline {
    margin-top: 24rpx;
  }

  &[disabled] {
    background: $fill;
    color: $ink-4;
  }
}
</style>
