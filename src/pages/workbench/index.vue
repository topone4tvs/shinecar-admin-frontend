<template>
  <view class="wb">
    <!-- 环境提示：仅非生产环境出现，避免生产包多一行噪音 -->
    <view v-if="CURRENT_ENV !== 'production'" class="envline">
      <text class="envline__tag">{{ envText }}</text>
      <text class="envline__text">mock 数据，接口未接入</text>
    </view>

    <!-- 状态统计条 -->
    <view class="stats">
      <view class="stats__i">
        <text class="stats__v stats__v--busy">{{ summary.busy }}<text class="stats__u">个</text></text>
        <text class="stats__k">使用中</text>
      </view>
      <view class="stats__i">
        <text class="stats__v stats__v--idle">{{ summary.idle }}<text class="stats__u">个</text></text>
        <text class="stats__k">空闲</text>
      </view>
      <view class="stats__i">
        <text class="stats__v stats__v--repair">{{ summary.repairing }}<text class="stats__u">个</text></text>
        <text class="stats__k">维护中</text>
      </view>
    </view>

    <!-- 工位状态 -->
    <view class="sec">
      <text class="sec__t">工位状态</text>
      <text class="sec__x">{{ refreshAt }} 刷新</text>
    </view>

    <view v-if="loading" class="st-grid">
      <view v-for="i in 6" :key="i" class="st-skeleton" />
    </view>

    <view v-else-if="!stations.length" class="empty">
      <text class="empty__icon">空</text>
      <text class="empty__title">该门店暂无已上线工位</text>
      <text class="empty__desc">联系总部确认工位配置</text>
    </view>

    <view v-else class="st-grid">
      <view
        v-for="item in stations"
        :key="item.id"
        class="st"
        :class="`st--${item.status}`"
        @tap="openDetail(item)"
      >
        <view class="st__top">
          <text class="st__idx">{{ stationNo(item) }}<text class="st__unit">号</text></text>
          <text class="st__state"><text class="st__dot" />{{ statusText(item) }}</text>
        </view>
        <text class="st__sub">{{ describe(item) }}</text>
      </view>
    </view>

    <!-- 门店工具 -->
    <view class="sec">
      <text class="sec__t">门店工具</text>
      <text class="sec__x">随门店切换</text>
    </view>

    <view v-if="!shopCaps.length" class="empty empty--inline">
      <text class="empty__desc">该门店未配置额外的门店工具</text>
    </view>

    <!-- 门店工具：全部由能力配置下发（本期只有停车缴费） -->
    <view v-for="cap in shopCaps" :key="cap.key" class="tool" @tap="openTool(cap)">
      <text class="tool__ic">{{ cap.icon }}</text>
      <view class="tool__body">
        <text class="tool__t">{{ cap.name }}缴费</text>
        <text class="tool__s">{{ cap.desc }}</text>
      </view>
      <text class="tool__arrow">›</text>
    </view>

    <text class="scope-note">
      门店工具由该门店的能力配置下发，未启用则不显示。
      设备类操作（开门、通电保养、通风、毛巾柜）在工位详情里。
    </text>

    <!-- 底部悬浮切店条：切店入口只在这里 -->
    <view class="floatbar">
      <view class="floatbar__pill" @tap="openShopSheet">
        <text class="floatbar__mark">{{ shopMark }}</text>
        <text class="floatbar__name">{{ shop?.name || '加载中' }}</text>
        <text class="floatbar__badge">{{ shop?.station_total || 0 }} 个工位</text>
        <text class="floatbar__action">切换</text>
        <text class="floatbar__caret">⌄</text>
      </view>
    </view>

    <!-- 门店切换弹层 -->
    <view v-if="shopSheet" class="sheet" @tap="shopSheet = false">
      <view class="sheet__panel" @tap.stop>
        <view class="sheet__head">
          <text class="sheet__title">切换门店</text>
          <text class="sheet__close" @tap="shopSheet = false">关闭</text>
        </view>
        <view
          v-for="item in shops"
          :key="item.id"
          class="shopitem"
          :class="{ 'shopitem--on': item.id === shop?.id }"
          @tap="chooseShop(item)"
        >
          <view class="shopitem__body">
            <text class="shopitem__name">{{ item.name }}</text>
            <text class="shopitem__meta">{{ item.station_total }} 个工位</text>
          </view>
          <text v-if="item.id === shop?.id" class="shopitem__on">当前</text>
        </view>
        <text class="sheet__hint">切店只刷新本页；查询与审核是全局数据，不受影响。</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { fetchCapabilities, fetchShopOverview, fetchShops } from '@/api/shop'
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
const summary = ref({ busy: 0, idle: 0, repairing: 0 })
const capabilities = ref<Capability[]>([])
const loading = ref(true)
const shopSheet = ref(false)
const refreshAt = ref('')
const now = ref(Date.now())
const booted = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

const envText = CURRENT_ENV === 'production' ? '生产' : CURRENT_ENV === 'pre' ? '预发' : '开发'

/**
 * 状态词。四状态口径不变（01 §6.1），通电只是叠加维度：
 * 维护中 + 通电 = 保养中，仅换展示词，不新增状态、不参与汇总计数。
 */
const statusText = (station: Station) => {
  if (station.status === 'repair' && station.power_state === 'on') return '保养中'
  return STATUS_TEXT[station.status] || '未知'
}

/** 门店工具：placement=shop 的能力（停车缴费） */
const shopCaps = computed(() =>
  capabilities.value.filter(cap => (cap.placement ?? 'shop') === 'shop'),
)

const shopMark = computed(() => (shop.value?.name || '店').slice(0, 1))

/** 「3 号」→「3」；后端给 st_index 时同样是去前导零后的值 */
const stationNo = (station: Station) => station.name.replace(/\s*号$/, '')

/** 依赖 now，计时器每秒触发重渲染。基于 started_at 与当前时间差，不做秒数累加 */
const elapsedOf = (station: Station) => {
  if (station.status !== 'busy' || !station.started_at) return ''
  const seconds = Math.floor((now.value - new Date(station.started_at).getTime()) / 1000)
  return formatElapsed(seconds < 0 ? 0 : seconds)
}

const describe = (station: Station) => {
  if (station.status === 'busy') {
    const tail = station.plate_tail ? ` · 尾号 ${station.plate_tail}` : ''
    return `已洗 ${elapsedOf(station)}${tail}`
  }
  if (station.status === 'repair') {
    // 通电中优先说保养，维护人和时间退居其次（保养才是现场正在发生的事）
    if (station.power_state === 'on') {
      const at = station.power_at ? clockOf(station.power_at) : ''
      return at ? `保养中 · ${at} 起通电` : '保养中 · 通电中'
    }
    return `${station.maintenance_at || ''} 由${station.maintenance_by || '总部'}设置`
  }
  if (station.status === 'off') return '不参与排班'
  if (station.power_state === 'on') return '通电中 · 待断电'
  return '等待使用'
}

const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1600 })

const clockOf = (iso: string) => {
  const d = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const loadShopData = async (shopId: number) => {
  loading.value = true
  try {
    const [overview, caps] = await Promise.all([fetchShopOverview(shopId), fetchCapabilities(shopId)])
    shop.value = overview.shop
    stations.value = overview.stations
    summary.value = overview.summary
    capabilities.value = caps
    refreshAt.value = clockOf(overview.refreshed_at)
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '工位状态加载失败')
  } finally {
    loading.value = false
  }
}

const pickShop = async () => {
  if (!shops.value.length) {
    loading.value = false
    return
  }
  const saved = Number(Taro.getStorageSync(SHOP_KEY)) || 0
  // 冷启动优先恢复上次门店；被移出 scope 则回落第一个并提示
  const restored = shops.value.find(item => item.id === saved)
  const current = restored || shops.value[0]
  if (saved && !restored) tip('原门店已不在权限范围，已切换到 ' + current.name)
  shop.value = current
  Taro.setStorageSync(SHOP_KEY, current.id)
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

const openShopSheet = () => {
  if (shops.value.length < 2) {
    tip('当前账号只管理一家门店')
    return
  }
  shopSheet.value = true
}

const chooseShop = async (target: Shop) => {
  shopSheet.value = false
  if (target.id === shop.value?.id) return
  // 切店：立即清空旧门店数据，避免上一个店的工位残留
  shop.value = target
  stations.value = []
  summary.value = { busy: 0, idle: 0, repairing: 0 }
  Taro.setStorageSync(SHOP_KEY, target.id)
  await loadShopData(target.id)
}

const openDetail = (station: Station) => {
  Taro.navigateTo({ url: `/packageStation/pages/station-detail/index?id=${station.id}` })
}

const openTool = (cap: Capability) => {
  if (cap.key === 'parking_fee') {
    Taro.navigateTo({ url: `/packageStation/pages/parking/index?shop_id=${shop.value?.id || 0}` })
    return
  }
  tip(`${cap.name}能力待接入`)
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
  // 首次由 onMounted 负责；这里处理从工位详情返回时的状态回填
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
  // 底部留白 + 悬浮切店条
  padding: $sp-3 $page-x calc(168rpx + env(safe-area-inset-bottom));
}

/* ---------- 环境提示 ---------- */
.envline {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: $sp-2;

  &__tag {
    padding: 0 12rpx;
    height: 34rpx;
    line-height: 34rpx;
    border-radius: $r-xs;
    font-size: $fs-micro;
    background: $warn-soft;
    color: $warn;
    border: 1rpx solid $warn-line;
  }

  &__text {
    font-size: $fs-micro;
    color: $ink-3;
  }
}

/* ---------- 状态统计条 ---------- */
.stats {
  display: flex;
  align-items: stretch;
  padding: 26rpx 8rpx;
  border-radius: $r-2xl;
  background: $card;
  box-shadow: $shadow-card;
  margin-bottom: $card-gap;

  &__i {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;

    & + & {
      border-left: 1rpx solid $line;
      margin: 8rpx 0;
    }
  }

  &__v {
    font-size: $fs-h1;
    font-weight: $fw-semibold;
    line-height: 1.15;
    @include tabular;

    &--busy { color: $busy-ink; }
    &--idle { color: $idle-ink; }
    &--repair { color: $repair-ink; }
  }

  &__u {
    font-size: $fs-micro;
    font-weight: $fw-regular;
    color: $ink-3;
    margin-left: 2rpx;
  }

  &__k {
    margin-top: 6rpx;
    font-size: $fs-micro;
    color: $ink-3;
  }
}

/* ---------- 区块标题 ---------- */
.sec {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 6rpx 0 16rpx;

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

/* ---------- 工位网格：2 列 ---------- */
.st-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $grid-gap;
  margin-bottom: $card-gap;
}

.st {
  width: calc((100% - #{$grid-gap}) / 2);
  padding: 20rpx 22rpx 18rpx;
  border-radius: $r-xl;
  border: 2rpx solid transparent;
  @include press;

  &--idle { @include state-block($idle-fill, $idle-line, $idle-ink); }
  &--busy { @include state-block($busy-fill, $busy-line, $busy-ink); }
  &--repair { @include state-block($repair-fill, $repair-line, $repair-ink); }
  &--off { @include state-block($off-fill, $off-line, $off-ink); }

  &__top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  &__idx {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    @include tabular;
  }

  &__unit {
    font-size: $fs-micro;
    font-weight: $fw-regular;
    opacity: 0.7;
    margin-left: 2rpx;
  }

  &__state {
    display: flex;
    align-items: center;
    font-size: $fs-micro;
    font-weight: $fw-medium;
  }

  &__dot {
    width: 8rpx;
    height: 8rpx;
    border-radius: $r-full;
    background: currentColor;
    margin-right: 8rpx;
    flex: none;
  }

  &__sub {
    display: block;
    margin-top: 10rpx;
    font-size: $fs-micro;
    opacity: 0.85;
    line-height: 1.5;
    @include tabular;
  }
}

.st-skeleton {
  width: calc((100% - #{$grid-gap}) / 2);
  height: 132rpx;
  border-radius: $r-xl;
  background: $line;
  animation: shimmer 1.2s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

/* ---------- 空态 ---------- */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx 32rpx;
  margin-bottom: $card-gap;
  border-radius: $r-2xl;
  background: $card;

  &--inline {
    padding: 40rpx 32rpx;
  }

  &__icon {
    width: 88rpx;
    height: 88rpx;
    border-radius: $r-2xl;
    background: $fill;
    color: $ink-4;
    font-size: $fs-title;
    line-height: 88rpx;
    text-align: center;
    margin-bottom: 16rpx;
  }

  &__title {
    font-size: $fs-body-sm;
    font-weight: $fw-medium;
    color: $ink-2;
  }

  &__desc {
    margin-top: 6rpx;
    font-size: $fs-micro;
    color: $ink-3;
    text-align: center;
    line-height: 1.6;
  }
}

/* ---------- 门店工具 ---------- */
.tool {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 28rpx;
  border-radius: $r-2xl;
  background: $card;
  box-shadow: $shadow-card;
  @include press;

  & + & {
    margin-top: 16rpx;
  }

  &__ic {
    width: $icon-box;
    height: $icon-box;
    border-radius: $r-lg;
    background: $icon-soft;
    color: $icon-ink;
    font-size: $fs-body;
    line-height: $icon-box;
    text-align: center;
    flex: none;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__t {
    display: block;
    font-size: $fs-title;
    font-weight: $fw-medium;
    color: $ink;
  }

  &__s {
    display: block;
    margin-top: 2rpx;
    font-size: $fs-micro;
    color: $ink-3;
  }

  &__arrow {
    font-size: $fs-h3;
    color: $ink-4;
  }
}

.scope-note {
  display: block;
  margin: 16rpx 4rpx 0;
  font-size: $fs-micro;
  color: $ink-3;
  line-height: 1.7;
}

/* ---------- 底部悬浮切店条 ---------- */
.floatbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  padding: 44rpx $page-x calc(24rpx + env(safe-area-inset-bottom));
  background: linear-gradient(to top, $bg 52%, rgba(247, 248, 250, 0));
  pointer-events: none;

  &__pill {
    display: flex;
    align-items: center;
    gap: 16rpx;
    height: 92rpx;
    padding: 0 26rpx 0 20rpx;
    border-radius: $r-full;
    background: rgba(255, 255, 255, 0.97);
    border: 2rpx solid $line-2;
    box-shadow: $shadow-float;
    pointer-events: auto;
    @include press;
  }

  &__mark {
    width: 56rpx;
    height: 56rpx;
    border-radius: $r-full;
    background: $brand-soft;
    color: $brand-deep;
    font-size: $fs-body-sm;
    font-weight: $fw-semibold;
    line-height: 56rpx;
    text-align: center;
    flex: none;
  }

  &__name {
    font-size: $fs-body;
    font-weight: $fw-semibold;
    color: $ink;
    @include ellipsis;
  }

  &__badge {
    padding: 0 12rpx;
    height: 34rpx;
    line-height: 34rpx;
    border-radius: $r-sm;
    background: $fill;
    color: $ink-2;
    font-size: $fs-micro;
    flex: none;
  }

  &__action {
    margin-left: auto;
    font-size: $fs-caption;
    color: $ink-3;
    flex: none;
  }

  &__caret {
    font-size: $fs-caption;
    color: $ink-3;
    margin-left: 2rpx;
    flex: none;
  }
}

/* ---------- 切店弹层 ---------- */
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
    margin-bottom: 8rpx;
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

  &__hint {
    display: block;
    margin-top: 20rpx;
    font-size: $fs-micro;
    color: $ink-3;
    line-height: 1.6;
  }
}

.shopitem {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $line;
  @include press;

  &--on {
    .shopitem__name { color: $brand-deep; }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    display: block;
    font-size: $fs-title;
    font-weight: $fw-medium;
    color: $ink;
  }

  &__meta {
    display: block;
    margin-top: 4rpx;
    font-size: $fs-micro;
    color: $ink-3;
  }

  &__on {
    font-size: $fs-micro;
    color: $brand-deep;
    padding: 0 12rpx;
    height: 34rpx;
    line-height: 34rpx;
    border-radius: $r-sm;
    background: $brand-soft;
  }
}
</style>
