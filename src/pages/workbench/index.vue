<template>
  <view class="wb">
    <!-- 门店切换 -->
    <view class="shopbar">
      <view class="shopbar__main" @tap="switchShop">
        <text class="shopbar__mark">店</text>
        <text class="shopbar__name">{{ shop?.name || '加载中' }}</text>
        <text class="shopbar__meta">{{ shop?.station_total || 0 }} 个工位</text>
        <text class="shopbar__switch">切换</text>
      </view>
      <view class="shopbar__tag" :class="envClass">{{ envText }}</view>
    </view>

    <!-- 统计 -->
    <view class="stats">
      <view class="stats__item stats__item--busy">
        <text class="stats__num">{{ stats.busy }}</text>
        <text class="stats__label">个 使用中</text>
      </view>
      <view class="stats__item stats__item--idle">
        <text class="stats__num">{{ stats.idle }}</text>
        <text class="stats__label">个 空闲</text>
      </view>
      <view class="stats__item stats__item--repair">
        <text class="stats__num">{{ stats.repair }}</text>
        <text class="stats__label">个 维护中</text>
      </view>
    </view>

    <!-- 工位网格 -->
    <view class="panel">
      <view class="panel__head">
        <text class="panel__title">工位状态</text>
        <text class="panel__time">{{ refreshAt }} 刷新</text>
      </view>

      <view v-if="loading" class="skeleton">
        <view v-for="i in 6" :key="i" class="skeleton__cell" />
      </view>

      <view v-else-if="!stations.length" class="empty">
        <text class="empty__text">该门店暂无工位</text>
      </view>

      <view v-else class="grid">
        <view
          v-for="item in stations"
          :key="item.id"
          class="cell"
          :class="`cell--${item.status}`"
          @tap="openDetail(item)"
        >
          <view class="cell__top">
            <text class="cell__name">{{ item.name }}</text>
            <text class="cell__dot" />
          </view>
          <text class="cell__state">{{ statusText(item.status) }}</text>
          <text class="cell__desc">{{ describe(item) }}</text>
        </view>
      </view>
    </view>

    <!-- 门店工具 -->
    <view class="panel">
      <view class="panel__head">
        <text class="panel__title">门店工具</text>
        <text class="panel__note">随门店切换</text>
      </view>
      <view v-if="!capabilities.length" class="empty">
        <text class="empty__text">该门店未启用门店级工具</text>
      </view>
      <view
        v-for="cap in capabilities"
        :key="cap.key"
        class="tool"
        @tap="openTool(cap)"
      >
        <text class="tool__icon">{{ cap.icon }}</text>
        <view class="tool__body">
          <text class="tool__name">{{ cap.name }}缴费</text>
          <text class="tool__desc">{{ cap.desc }}</text>
        </view>
        <text class="tool__arrow">›</text>
      </view>
      <view class="panel__foot">
        门店工具由该门店的能力配置下发，未启用的门店不显示。设备类操作（通风、毛巾柜）在工位详情里。
      </view>
    </view>

    <!-- 工位详情抽屉 -->
    <view v-if="detail" class="sheet" @tap="closeDetail">
      <view class="sheet__panel" @tap.stop>
        <view class="sheet__head">
          <view class="sheet__titles">
            <text class="sheet__title">{{ detail.name }}工位</text>
            <text class="sheet__sub">{{ detail.shop_name }}</text>
          </view>
          <text class="sheet__close" @tap="closeDetail">关闭</text>
        </view>

        <view class="sheet__state" :class="`sheet__state--${detail.status}`">
          <text class="sheet__state-text">{{ statusLine(detail) }}</text>
          <text v-if="detail.status === 'busy'" class="sheet__timer">{{ elapsedOf(detail) }}</text>
          <text v-if="detail.status === 'repair'" class="sheet__state-desc">
            {{ detail.maintenance_at }} 由{{ detail.maintenance_by }}设置
          </text>
          <text v-if="detail.status === 'idle'" class="sheet__state-desc">等待使用</text>
        </view>

        <!-- 设备类操作 -->
        <view v-if="deviceCaps.length" class="sheet__block">
          <text class="sheet__block-title">设备操作</text>
          <view class="sheet__actions">
            <view
              v-for="cap in deviceCaps"
              :key="cap.key"
              class="act"
              :class="{ 'act--disabled': acting }"
              @tap="runCommand(cap.key)"
            >
              <text class="act__icon">{{ cap.icon }}</text>
              <text class="act__name">{{ cap.name }}</text>
            </view>
          </view>
          <text class="sheet__hint">只下发命令，不查询设备回执状态。</text>
        </view>

        <!-- 维护开关 -->
        <view class="sheet__block">
          <text class="sheet__block-title">工位维护</text>
          <button
            class="sheet__btn"
            :class="detail.status === 'repair' ? 'sheet__btn--ghost' : 'sheet__btn--warn'"
            :loading="acting"
            :disabled="acting || detail.status === 'busy'"
            @tap="toggleMaintenance"
          >
            {{ detail.status === 'repair' ? '取消维护，恢复空闲' : '设为维护中' }}
          </button>
          <text v-if="detail.status === 'busy'" class="sheet__hint">工位使用中不能设置维护，需先结束订单。</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { fetchCapabilities, fetchShops, fetchStations, sendCommand, setMaintenance } from '@/api/shop'
import { fetchProfile } from '@/api/auth'
import type { Capability, Shop, Station, StationStatus } from '@/types/api'
import { CURRENT_ENV } from '@/config/env'
import { formatElapsed } from '@/utils/format'
import { ApiError } from '@/utils/error'
import { useAuthStore } from '@/stores/auth'

const SHOP_KEY = 'admin_current_shop'
const LOGIN_PAGE = '/pages/login/index'

const STATUS_TEXT: Record<StationStatus, string> = {
  idle: '空闲',
  busy: '使用中',
  repair: '维护中',
  off: '已下线',
}

const auth = useAuthStore()
const shops = ref<Shop[]>([])
const shop = ref<Shop | null>(null)
const stations = ref<Station[]>([])
const capabilities = ref<Capability[]>([])
const loading = ref(true)
const detail = ref<Station | null>(null)
const acting = ref(false)
const refreshAt = ref('')
const now = ref(Date.now())
const booted = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

const envText = CURRENT_ENV === 'production' ? '生产' : CURRENT_ENV === 'pre' ? '预发' : '开发'
const envClass = `shopbar__tag--${CURRENT_ENV}`

const statusText = (status: StationStatus) => STATUS_TEXT[status] || '未知'

const stats = computed(() => {
  const count = (s: StationStatus) => stations.value.filter(item => item.status === s).length
  return { busy: count('busy'), idle: count('idle'), repair: count('repair') }
})

/** 设备类能力（通风 / 毛巾柜），门店工具（停车）不在工位详情里 */
const deviceCaps = computed(() =>
  capabilities.value.filter(cap => ['towel', 'fan'].includes(cap.key)),
)

/** 依赖 now，计时器每秒触发一次重渲染 */
const elapsedOf = (station: Station) => {
  if (station.status !== 'busy' || !station.started_at) return ''
  const seconds = Math.floor((now.value - new Date(station.started_at).getTime()) / 1000)
  return formatElapsed(seconds)
}

const describe = (station: Station) => {
  if (station.status === 'busy') {
    const tail = station.plate_tail ? ` · 尾号 ${station.plate_tail}` : ''
    return `${elapsedOf(station)}${tail}`
  }
  if (station.status === 'repair') return `${station.maintenance_at} 由${station.maintenance_by}设置`
  if (station.status === 'off') return '不参与排班'
  return '等待使用'
}

const statusLine = (station: Station) => {
  if (station.status === 'busy') return '使用中'
  if (station.status === 'repair') return '维护中'
  if (station.status === 'off') return '已下线'
  return '空闲'
}

const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1600 })

const nowClock = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const loadShopData = async (shopId: number) => {
  loading.value = true
  try {
    const [stationList, caps] = await Promise.all([fetchStations(shopId), fetchCapabilities(shopId)])
    stations.value = stationList
    capabilities.value = caps
    refreshAt.value = nowClock()
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '工位状态加载失败')
  } finally {
    loading.value = false
  }
}

const pickShop = async () => {
  const list = shops.value
  if (!list.length) {
    loading.value = false
    return
  }
  const saved = Number(Taro.getStorageSync(SHOP_KEY)) || 0
  const current = list.find(item => item.id === saved) || list[0]
  shop.value = current
  await loadShopData(current.id)
}

const bootstrap = async () => {
  if (!auth.token) {
    Taro.reLaunch({ url: LOGIN_PAGE })
    return
  }
  if (!auth.profile) {
    try {
      const profile = await fetchProfile()
      auth.applyAuth(auth.token, profile)
    } catch {
      auth.reset()
      Taro.reLaunch({ url: LOGIN_PAGE })
      return
    }
  }
  try {
    shops.value = await fetchShops()
    await pickShop()
    booted.value = true
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '门店加载失败')
    loading.value = false
  }
}

const switchShop = async () => {
  if (shops.value.length < 2) {
    tip('当前账号只管理一家门店')
    return
  }
  try {
    const res = await Taro.showActionSheet({ itemList: shops.value.map(item => item.name) })
    const target = shops.value[res.tapIndex]
    if (!target || target.id === shop.value?.id) return
    shop.value = target
    Taro.setStorageSync(SHOP_KEY, target.id)
    await loadShopData(target.id)
  } catch {
    // 用户取消
  }
}

const openDetail = (station: Station) => {
  detail.value = station
}

const closeDetail = () => {
  detail.value = null
}

const openTool = (cap: Capability) => {
  tip(`${cap.name}能力在 P2 接入`)
}

const runCommand = async (key: string) => {
  if (!detail.value || acting.value) return
  if (key !== 'towel' && key !== 'fan') return
  acting.value = true
  try {
    const res = await sendCommand(detail.value.id, key)
    tip(res.message)
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '命令下发失败')
  } finally {
    acting.value = false
  }
}

const toggleMaintenance = async () => {
  if (!detail.value || acting.value) return
  const target = detail.value
  const enable = target.status !== 'repair'
  acting.value = true
  try {
    await setMaintenance(target.id, enable)
    tip(enable ? '已设为维护中' : '已恢复空闲')
    if (shop.value) await loadShopData(shop.value.id)
    detail.value = stations.value.find(item => item.id === target.id) || null
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '操作失败')
  } finally {
    acting.value = false
  }
}

onMounted(() => {
  bootstrap()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

useDidShow(() => {
  now.value = Date.now()
  // 首次由 onMounted 负责，这里只处理二次进入时的状态刷新
  if (booted.value && shop.value) {
    loadShopData(shop.value.id)
  }
})

usePullDownRefresh(async () => {
  if (shop.value) await loadShopData(shop.value.id)
  Taro.stopPullDownRefresh()
})
</script>

<style lang="scss">
.wb {
  min-height: 100vh;
  padding: $sp-3 $page-x 48rpx;
}

/* ---------- 门店栏 ---------- */
.shopbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 24rpx;

  &__main {
    display: flex;
    align-items: center;
    gap: 12rpx;
    min-width: 0;
    @include press;
  }

  &__mark {
    width: 40rpx;
    height: 40rpx;
    border-radius: $r-xs;
    background: $brand-soft;
    color: $brand;
    font-size: $fs-micro;
    line-height: 40rpx;
    text-align: center;
  }

  &__name {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    color: $ink;
    @include ellipsis;
  }

  &__meta {
    font-size: $fs-caption;
    color: $ink-3;
  }

  &__switch {
    font-size: $fs-caption;
    color: $brand;
    padding: 4rpx 12rpx;
    border-radius: $r-xs;
    background: $brand-soft;
  }

  &__tag {
    flex: none;
    padding: 0 12rpx;
    height: 34rpx;
    line-height: 34rpx;
    border-radius: $r-xs;
    font-size: $fs-micro;
    background: $off-fill;
    color: $off-ink;

    &--production {
      background: $idle-fill;
      color: $idle-ink;
    }

    &--pre {
      background: $busy-fill;
      color: $busy-ink;
    }
  }
}

/* ---------- 统计 ---------- */
.stats {
  display: flex;
  gap: $grid-gap;
  margin-bottom: $card-gap;

  &__item {
    flex: 1;
    padding: 20rpx;
    border-radius: $r-lg;
    border: 2rpx solid transparent;

    &--busy {
      @include state-block($busy-fill, $busy-line, $busy-ink);
    }

    &--idle {
      @include state-block($idle-fill, $idle-line, $idle-ink);
    }

    &--repair {
      @include state-block($repair-fill, $repair-line, $repair-ink);
    }
  }

  &__num {
    display: block;
    font-size: $fs-h1;
    font-weight: $fw-semibold;
    line-height: 1.2;
    @include tabular;
  }

  &__label {
    display: block;
    margin-top: 4rpx;
    font-size: $fs-caption-sm;
    opacity: 0.75;
  }
}

/* ---------- 面板 ---------- */
.panel {
  @include card;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;
  }

  &__title {
    font-size: $fs-title;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__time,
  &__note {
    font-size: $fs-caption-sm;
    color: $ink-3;
    @include tabular;
  }

  &__foot {
    margin-top: 16rpx;
    font-size: $fs-caption-sm;
    color: $ink-3;
    line-height: 1.7;
  }
}

/* ---------- 工位网格 ---------- */
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: $grid-gap;
}

.cell {
  width: calc((100% - #{$grid-gap} * 2) / 3);
  padding: 20rpx 16rpx;
  border-radius: $r-md;
  border: 2rpx solid transparent;
  @include press;

  &--idle {
    @include state-block($idle-fill, $idle-line, $idle-ink);
  }

  &--busy {
    @include state-block($busy-fill, $busy-line, $busy-ink);
  }

  &--repair {
    @include state-block($repair-fill, $repair-line, $repair-ink);
  }

  &--off {
    @include state-block($off-fill, $off-line, $off-ink);
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__name {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    @include tabular;
  }

  &__dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: $r-full;
    background: currentColor;
    opacity: 0.55;
  }

  &__state {
    display: block;
    margin-top: 6rpx;
    font-size: $fs-caption;
    opacity: 0.85;
  }

  &__desc {
    display: block;
    margin-top: 4rpx;
    font-size: $fs-micro;
    opacity: 0.7;
    line-height: 1.5;
    min-height: 56rpx;
  }
}

.skeleton {
  display: flex;
  flex-wrap: wrap;
  gap: $grid-gap;

  &__cell {
    width: calc((100% - #{$grid-gap} * 2) / 3);
    height: 150rpx;
    border-radius: $r-md;
    background: $fill;
  }
}

.empty {
  padding: 48rpx 0;
  text-align: center;

  &__text {
    font-size: $fs-caption;
    color: $ink-3;
  }
}

/* ---------- 门店工具 ---------- */
.tool {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  @include press;

  & + & {
    border-top: 1rpx solid $line;
  }

  &__icon {
    width: $icon-box;
    height: $icon-box;
    border-radius: $r-lg;
    background: $icon-soft;
    color: $icon-ink;
    font-size: $fs-body;
    line-height: $icon-box;
    text-align: center;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    display: block;
    font-size: $fs-title;
    color: $ink;
  }

  &__desc {
    display: block;
    margin-top: 2rpx;
    font-size: $fs-caption-sm;
    color: $ink-3;
  }

  &__arrow {
    font-size: $fs-h3;
    color: $ink-4;
  }
}

/* ---------- 抽屉 ---------- */
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
    padding: $card-padding $page-x;
    padding-bottom: calc(#{$card-padding} + env(safe-area-inset-bottom));
    border-radius: $r-sheet $r-sheet 0 0;
    background: $card;
    box-shadow: $shadow-sheet;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24rpx;
  }

  &__title {
    display: block;
    font-size: $fs-h4;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__sub {
    display: block;
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $ink-3;
  }

  &__close {
    font-size: $fs-caption;
    color: $ink-3;
    padding: 4rpx 8rpx;
  }

  &__state {
    padding: 28rpx;
    border-radius: $r-lg;
    border: 2rpx solid transparent;
    margin-bottom: 24rpx;

    &--busy {
      @include state-block($busy-fill, $busy-line, $busy-ink);
    }

    &--idle {
      @include state-block($idle-fill, $idle-line, $idle-ink);
    }

    &--repair {
      @include state-block($repair-fill, $repair-line, $repair-ink);
    }

    &--off {
      @include state-block($off-fill, $off-line, $off-ink);
    }
  }

  &__state-text {
    display: block;
    font-size: $fs-title;
    font-weight: $fw-medium;
    opacity: 0.85;
  }

  &__timer {
    display: block;
    margin-top: 8rpx;
    font-size: $fs-display;
    font-weight: $fw-semibold;
    line-height: 1.1;
    @include tabular;
  }

  &__state-desc {
    display: block;
    margin-top: 6rpx;
    font-size: $fs-caption-sm;
    opacity: 0.75;
  }

  &__block {
    margin-bottom: 28rpx;
  }

  &__block-title {
    display: block;
    margin-bottom: 16rpx;
    font-size: $fs-body;
    font-weight: $fw-medium;
    color: $ink-2;
  }

  &__actions {
    display: flex;
    gap: $grid-gap;
  }

  &__hint {
    display: block;
    margin-top: 12rpx;
    font-size: $fs-caption-sm;
    color: $ink-3;
    line-height: 1.6;
  }

  &__btn {
    width: 100%;
    height: $btn-h;
    border-radius: $r-md;
    font-size: $fs-title;
    font-weight: $fw-semibold;
    line-height: $btn-h;
    text-align: center;
    @include press;

    &--warn {
      background: $danger-soft;
      color: $danger-ink;
    }

    &--ghost {
      background: $idle-fill;
      color: $idle-ink;
    }

    &[disabled] {
      background: $fill;
      color: $ink-4;
    }
  }
}

.act {
  flex: 1;
  padding: 20rpx 0;
  border-radius: $r-md;
  background: $fill;
  text-align: center;
  @include press;

  &--disabled {
    opacity: 0.5;
  }

  &__icon {
    display: block;
    font-size: $fs-h3;
    color: $ink;
    font-weight: $fw-semibold;
  }

  &__name {
    display: block;
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $ink-2;
  }
}
</style>
