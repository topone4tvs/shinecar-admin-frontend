<template>
  <view class="qy">
    <!-- 订单 / 用户：同一个检索动作的两个对象，共用一个 Tab 省得来回切 -->
    <view class="seg">
      <view
        class="seg__item"
        :class="{ 'seg__item--on': mode === 'order' }"
        @tap="setMode('order')"
      >
        订单
      </view>
      <view
        class="seg__item"
        :class="{ 'seg__item--on': mode === 'user' }"
        @tap="setMode('user')"
      >
        用户
      </view>
    </view>

    <view class="filters">
      <view v-if="mode === 'order'" class="filters__row">
        <view
          v-for="item in RANGES"
          :key="item.key"
          class="chip"
          :class="{ 'chip--active': range === item.key }"
          @tap="setRange(item.key)"
        >
          {{ item.label }}
        </view>
      </view>

      <view class="field">
        <text class="field__label">手机号</text>
        <input
          :value="phone"
          class="field__input"
          type="number"
          maxlength="11"
          placeholder="选填，精确匹配"
          placeholder-class="field__ph"
          @input="onPhoneInput"
        />
      </view>

      <view class="field">
        <text class="field__label">车牌号</text>
        <input
          :value="plate"
          class="field__input"
          maxlength="8"
          :placeholder="mode === 'order' ? '可只输后几位，如 D2311' : '完整车牌，或后几位'"
          placeholder-class="field__ph"
          @input="onPlateInput"
        />
      </view>

      <view v-if="mode === 'order'" class="field field--tap" @tap="pickShop">
        <text class="field__label">门店</text>
        <text class="field__value">{{ shopLabel }}</text>
        <text class="field__arrow">›</text>
      </view>

      <button class="search" :loading="loading" :disabled="loading" @tap="doSearch">
        {{ mode === 'order' ? '搜索订单' : '搜索用户' }}
      </button>
    </view>

    <view class="qy__note">
      {{ mode === 'order'
        ? '跨店查询，不受「现场」页的门店切换影响；结果里会标出门店。'
        : '按手机号精确匹配，或按车牌找（同一台车可能被多个账户绑定）。' }}
    </view>

    <!-- ---------------- 订单结果 ---------------- -->
    <template v-if="mode === 'order'">
      <view v-if="searched && !loading" class="result-head">
        <text class="result-head__title">搜索结果</text>
        <text class="result-head__count">共 {{ total }} 条</text>
      </view>

      <!-- 后端单次最多回 50 条：条件太宽时明确告诉用户看到的是截断结果 -->
      <view v-if="searched && !loading && total > list.length" class="result-note">
        仅显示最近 {{ list.length }} 条，请加手机号或车牌缩小范围
      </view>

      <view v-if="!searched && !loading" class="hint">
        <text class="hint__text">输入手机号或车牌后搜索</text>
      </view>

      <view v-if="loading" class="hint"><text class="hint__text">查询中…</text></view>

      <view v-else-if="searched && !list.length" class="hint">
        <text class="hint__text">
          没有符合条件的订单{{ range === 'all' ? '' : '，可以切到「全部」再试一次' }}
        </text>
      </view>

      <view v-for="item in list" :key="item.id" class="order" @tap="openOrder(item)">
        <view class="order__head">
          <view class="order__left">
            <text class="order__station">{{ item.station_name }}工位</text>
            <text class="order__shop">{{ item.shop_name }}</text>
          </view>
          <text class="order__state" :class="`order__state--${item.status}`">{{ statusText(item.status) }}</text>
        </view>

        <view class="order__grid">
          <view class="order__cell">
            <text class="order__k">{{ item.status === 'ongoing' ? '开始' : '时段' }}</text>
            <text class="order__v">{{ periodText(item) }}</text>
          </view>
          <view class="order__cell">
            <text class="order__k">时长</text>
            <text class="order__v">{{ durationText(item) }}</text>
          </view>
        </view>

        <view class="order__meta">用户 {{ item.user_phone_masked }} · 车牌 {{ item.plate_no || '—' }}</view>

        <view class="order__foot">
          <text v-if="item.status === 'ongoing'" class="order__tip">进行中不计费</text>
          <text v-else class="order__amount">{{ formatMoney(item.amount) }}</text>
          <text class="order__arrow">详情 ›</text>
        </view>
      </view>
    </template>

    <!-- ---------------- 用户结果 ---------------- -->
    <template v-else>
      <view v-if="userSearched && !loading" class="result-head">
        <text class="result-head__title">用户</text>
        <text class="result-head__count">共 {{ userTotal }} 人</text>
      </view>

      <view v-if="!userSearched && !loading" class="hint">
        <text class="hint__text">输入手机号或车牌后搜索</text>
      </view>

      <view v-if="loading" class="hint"><text class="hint__text">查询中…</text></view>

      <view v-else-if="userSearched && !userList.length" class="hint">
        <text class="hint__text">没有找到该用户，核对手机号或车牌是否完整</text>
      </view>

      <view v-for="item in userList" :key="item.id" class="user" @tap="openUser(item)">
        <view class="user__head">
          <view class="user__left">
            <text class="user__name">{{ item.nickname }}</text>
            <text v-if="item.is_newer" class="user__tag">新人</text>
          </view>
          <text class="user__arrow">详情 ›</text>
        </view>
        <view class="user__meta">
          手机号 {{ item.phone_masked }} · 余额 <text class="user__money">{{ formatMoney(item.balance) }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { searchOrders, type OrderQuery } from '@/api/order'
import { fetchShops } from '@/api/shop'
import { searchUsers } from '@/api/user'
import type { OrderItem, OrderStatus, Shop, UserSummary } from '@/types/api'
import { formatClock, formatDateTime, formatMoney, secondsSince } from '@/utils/format'
import { ApiError } from '@/utils/error'
import { inputValue } from '@/utils/input'

const RANGES: Array<{ key: 'today' | '7d' | 'all'; label: string }> = [
  { key: 'today', label: '今天' },
  { key: '7d', label: '近 7 天' },
  { key: 'all', label: '全部' },
]

const STATE_TEXT: Record<OrderStatus, string> = {
  ongoing: '进行中',
  done: '已完成',
  canceled: '已取消',
}

const range = ref<'today' | '7d' | 'all'>('7d')
const phone = ref('')
const plate = ref('')
const shops = ref<Shop[]>([])
const shopId = ref(0)
const list = ref<OrderItem[]>([])
const total = ref(0)
const loading = ref(false)
const searched = ref(false)

type QueryMode = 'order' | 'user'
const mode = ref<QueryMode>('order')
const userList = ref<UserSummary[]>([])
const userTotal = ref(0)
const userSearched = ref(false)

const shopLabel = computed(() => {
  if (!shopId.value) return '全部门店'
  return shops.value.find(item => item.id === shopId.value)?.name || '全部门店'
})

const statusText = (value: OrderStatus) => STATE_TEXT[value] || '未知'
const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1600 })

const setRange = (key: 'today' | '7d' | 'all') => {
  range.value = key
}

const onPhoneInput = (event: unknown) => {
  phone.value = inputValue(event)
}

const onPlateInput = (event: unknown) => {
  // 车牌习惯大写，统一转一下，省得用户开大写锁定
  plate.value = inputValue(event).toUpperCase()
}

const pickShop = async () => {
  const labels = ['全部门店', ...shops.value.map(item => item.name)]
  try {
    const res = await Taro.showActionSheet({ itemList: labels })
    shopId.value = res.tapIndex === 0 ? 0 : shops.value[res.tapIndex - 1].id
  } catch {
    // 取消
  }
}

const periodText = (item: OrderItem) => {
  if (item.status === 'ongoing') return formatDateTime(item.started_at)
  return `${formatClock(item.started_at)} → ${formatClock(item.ended_at)}`
}

const durationText = (item: OrderItem) => {
  if (item.status === 'ongoing') {
    const secs = secondsSince(item.started_at)
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分钟`
  }
  return item.duration_text || '—'
}

const setMode = (next: QueryMode) => {
  mode.value = next
}

const doSearch = async () => {
  if (mode.value === 'user') {
    await doSearchUser()
    return
  }
  if (phone.value && !/^\d{4,11}$/.test(phone.value.trim())) {
    tip('手机号需完整 11 位才能精确匹配')
    return
  }
  if (!phone.value && !plate.value && !shopId.value && range.value === 'all') {
    tip('请至少指定一个查询条件')
    return
  }

  loading.value = true
  try {
    const query: OrderQuery = {
      phone: phone.value.trim() || undefined,
      plate: plate.value.trim() || undefined,
      shop_id: shopId.value || undefined,
      range: range.value,
    }
    const res = await searchOrders(query)
    list.value = res.list
    total.value = res.total
    searched.value = true
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '查询失败')
  } finally {
    loading.value = false
  }
}

const openOrder = (item: OrderItem) => {
  Taro.navigateTo({ url: `/packageOrder/pages/detail/index?id=${item.id}` })
}

/** 用户检索：手机号精确匹配，或车牌命中（后端会给多账户） */
const doSearchUser = async () => {
  const phoneText = phone.value.trim()
  const plateText = plate.value.trim()
  if (!phoneText && !plateText) {
    tip('请输入手机号或车牌号')
    return
  }
  if (phoneText && !/^\d{11}$/.test(phoneText)) {
    tip('手机号需完整 11 位才能精确匹配')
    return
  }

  loading.value = true
  try {
    const res = await searchUsers({
      phone: phoneText || undefined,
      plate_no: plateText || undefined,
    })
    userList.value = res.list
    userTotal.value = res.total
    userSearched.value = true
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '查询失败')
  } finally {
    loading.value = false
  }
}

const openUser = (item: UserSummary) => {
  Taro.navigateTo({ url: `/packageUser/pages/detail/index?id=${item.id}` })
}

onMounted(async () => {
  try {
    shops.value = await fetchShops()
  } catch {
    // 门店列表失败不阻塞查询
  }
})

usePullDownRefresh(async () => {
  const touched = mode.value === 'order' ? searched.value : userSearched.value
  if (touched) await doSearch()
  Taro.stopPullDownRefresh()
})
</script>

<style lang="scss">
.qy {
  min-height: 100vh;
  padding: $sp-3 $page-x 48rpx;

  &__note {
    margin: $card-gap 0;
    font-size: $fs-caption-sm;
    color: $ink-3;
    line-height: 1.6;
  }
}

.filters {
  @include card;

  &__row {
    display: flex;
    gap: 12rpx;
    margin-bottom: 20rpx;
  }
}

/* 订单 / 用户分段：等价于文档 §4.5 的分段控件 */
.seg {
  display: flex;
  padding: 6rpx;
  margin-bottom: $card-gap;
  border-radius: $r-full;
  background: $fill;

  &__item {
    flex: 1;
    height: 64rpx;
    line-height: 64rpx;
    text-align: center;
    border-radius: $r-full;
    font-size: $fs-body;
    color: $ink-2;
    @include press;

    &--on {
      background: $card;
      color: $ink;
      font-weight: $fw-semibold;
      box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
    }
  }
}

/* 用户检索结果卡：比订单卡轻，只要「认人 + 看余额」 */
.user {
  @include card;
  @include press;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: $sp-1;
  }

  &__name {
    font-size: $fs-title;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__tag {
    padding: 0 10rpx;
    height: 32rpx;
    line-height: 32rpx;
    border-radius: $r-xs;
    background: $teal-soft;
    color: $teal-ink;
    font-size: $fs-nano;
  }

  &__arrow {
    font-size: $fs-caption;
    color: $ink-4;
  }

  &__meta {
    margin-top: 12rpx;
    font-size: $fs-caption;
    color: $ink-3;
    @include tabular;
  }

  &__money {
    color: $ink;
    font-weight: $fw-medium;
  }
}

.chip {
  padding: 10rpx 24rpx;
  border-radius: $r-full;
  background: $fill;
  color: $ink-2;
  font-size: $fs-caption;
  @include press;

  &--active {
    background: $brand-soft;
    color: $brand;
    font-weight: $fw-medium;
  }
}

.field {
  display: flex;
  align-items: center;
  height: $field-h;
  padding: 0 20rpx;
  margin-bottom: 16rpx;
  border-radius: $r-md;
  background: $fill-2;
  border: 1rpx solid $line;

  &__label {
    flex: none;
    width: 110rpx;
    font-size: $fs-body;
    color: $ink-2;
  }

  &__input {
    flex: 1;
    height: 100%;
    font-size: $fs-body;
    color: $ink;
  }

  &__ph {
    color: $ink-4;
    font-size: $fs-caption;
  }

  &__value {
    flex: 1;
    font-size: $fs-body;
    color: $ink;
  }

  &__arrow {
    color: $ink-4;
    font-size: $fs-body;
  }
}

.search {
  width: 100%;
  height: $btn-h;
  margin-top: 8rpx;
  border-radius: $r-md;
  background: $brand;
  color: $card;
  font-size: $fs-title;
  font-weight: $fw-semibold;
  line-height: $btn-h;
  text-align: center;
  @include press;

  &[disabled] {
    background: $brand-line;
  }
}

.result-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16rpx;

  &__title {
    font-size: $fs-title;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__count {
    font-size: $fs-caption;
    color: $ink-3;
    @include tabular;
  }
}

.result-note {
  margin-bottom: 16rpx;
  padding: 16rpx 20rpx;
  border-radius: $r-md;
  background: $warn-soft;
  color: $warn;
  font-size: $fs-caption-sm;
  line-height: 1.6;
}

.hint {
  padding: 64rpx 0;
  text-align: center;

  &__text {
    font-size: $fs-caption;
    color: $ink-3;
  }
}

.order {
  @include card;
  @include press;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 16rpx;
  }

  &__left {
    display: flex;
    align-items: baseline;
    gap: 10rpx;
  }

  &__station {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__shop {
    font-size: $fs-caption;
    color: $ink-3;
  }

  &__state {
    padding: 2rpx 12rpx;
    border-radius: $r-xs;
    font-size: $fs-micro;

    &--ongoing {
      @include state-block($busy-fill, $busy-line, $busy-ink);
    }

    &--done {
      @include state-block($idle-fill, $idle-line, $idle-ink);
    }

    &--refunded {
      @include state-block($off-fill, $off-line, $off-ink);
    }
  }

  &__grid {
    display: flex;
    gap: $grid-gap;
    padding: 16rpx 0;
    border-top: 1rpx solid $line;
    border-bottom: 1rpx solid $line;
  }

  &__cell {
    flex: 1;
  }

  &__k {
    display: block;
    font-size: $fs-micro;
    color: $ink-3;
  }

  &__v {
    display: block;
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $ink;
    @include tabular;
  }

  &__meta {
    margin-top: 14rpx;
    font-size: $fs-caption;
    color: $ink-2;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16rpx;
  }

  &__amount {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    color: $brand;
    @include tabular;
  }

  &__tip {
    font-size: $fs-caption-sm;
    color: $ink-3;
  }

  &__arrow {
    font-size: $fs-caption;
    color: $ink-3;
  }
}
</style>
