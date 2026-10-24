<template>
  <view class="co">
    <!-- 1. 工位 -->
    <view class="sec">
      <text class="sec__t">1. 选择工位</text>
      <text class="sec__x">仅列出空闲工位</text>
    </view>

    <view v-if="loading" class="hint">
      <text class="hint__text">工位加载中…</text>
    </view>

    <view v-else-if="!idleStations.length" class="hint">
      <text class="hint__text">该门店暂无空闲工位，请先结束进行中的订单或解除维护</text>
    </view>

    <view v-else class="grid">
      <view
        v-for="item in idleStations"
        :key="item.id"
        class="cell"
        :class="{ 'cell--on': item.id === stationId }"
        @tap="pickStation(item)"
      >
        <text class="cell__n">{{ item.name }}</text>
        <text class="cell__s">空闲</text>
      </view>
    </view>

    <!-- 2. 用户 -->
    <view class="sec">
      <text class="sec__t">2. 查找用户</text>
      <text class="sec__x">手机号需与用户端一致</text>
    </view>

    <view class="search">
      <input
        class="search__input"
        type="number"
        :value="phone"
        maxlength="11"
        placeholder="输入用户手机号"
        placeholder-class="search__ph"
        @input="onPhoneInput"
      />
      <text class="search__btn" :class="{ 'search__btn--busy': looking }" @tap="doLookup">
        {{ looking ? '查询中' : '查询' }}
      </text>
    </view>

    <view v-if="user" class="u">
      <view class="u__hd">
        <text class="u__name">{{ user.nickname }}</text>
        <text v-if="user.is_newer" class="u__tag">新人</text>
        <text class="u__phone">{{ user.phone_masked }}</text>
      </view>
      <view class="u__meta">
        <text class="u__cell">余额 {{ formatMoney(user.balance) }}</text>
        <text class="u__cell">累计 {{ user.order_count }} 单</text>
      </view>

      <view v-if="user.working_order_id" class="u__warn">
        该用户还有进行中的订单（#{{ user.working_order_id }}），结束之后才能再开单。
      </view>

      <view class="plates">
        <text class="plates__label">车牌</text>
        <view class="plates__list">
          <text
            v-for="item in user.vehicles"
            :key="item"
            class="plate"
            :class="{ 'plate--on': toApiPlate(item) === plateNo }"
            @tap="plateNo = toApiPlate(item)"
          >
            {{ item }}
          </text>
          <text class="plate" :class="{ 'plate--on': plateNo === '' }" @tap="plateNo = ''">
            不填
          </text>
        </view>
      </view>
      <text class="u__tip">不填车牌时，按工位暂存槽位 → 用户唯一绑定车辆的顺序自动取。</text>
    </view>

    <view v-else-if="lookedUp" class="hint">
      <text class="hint__text">没有查到该手机号的用户</text>
    </view>

    <!-- 提交 -->
    <button class="btn" :class="{ 'btn--off': !canSubmit }" :disabled="!canSubmit" @tap="doSubmit">
      {{ submitting ? '开单中…' : '确认开单' }}
    </button>

    <text class="note">
      开单会立即占用工位、启动设备并从现在开始计时，费用按用户端同一套规则结算。
      代客开单会记录操作人，可在审计里追溯。
    </text>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { fetchShopOverview } from '@/api/shop'
import { lookupUser } from '@/api/user'
import { createOrder } from '@/api/order'
import type { ShopOverview, Station, UserBrief } from '@/types/api'
import { formatMoney } from '@/utils/format'
import { ApiError } from '@/utils/error'
import { inputValue } from '@/utils/input'

const SHOP_KEY = 'admin_current_shop'

const router = useRouter()

const overview = ref<ShopOverview | null>(null)
const loading = ref(true)

const shopId = ref(Number(router.params.shop_id || 0))
/** 从工位详情进来时已带工位，省一次选择 */
const stationId = ref(Number(router.params.station_id || 0))

const phone = ref('')
const user = ref<UserBrief | null>(null)
const looking = ref(false)
const lookedUp = ref(false)
const plateNo = ref('')

const submitting = ref(false)

const idleStations = computed<Station[]>(() =>
  (overview.value?.stations || []).filter(item => item.status === 'idle'),
)

const canSubmit = computed(
  () => !submitting.value && Boolean(stationId.value) && Boolean(user.value) && !user.value?.working_order_id,
)

const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1800 })

/** 展示用的车牌（晋Y·5TR43）→ 提交用的车牌（晋Y5TR43） */
const toApiPlate = (plate: string) => plate.replace(/[·\s-]/g, '').toUpperCase()

const onPhoneInput = (event: unknown) => {
  phone.value = inputValue(event)
  // 手机号一改，之前查到的用户就作废，避免「换了号但还是给上一个人开单」
  if (user.value && user.value.phone_masked.replace(/[^\d]/g, '') !== phone.value) {
    user.value = null
    lookedUp.value = false
    plateNo.value = ''
  }
}

const pickStation = (item: Station) => {
  stationId.value = item.id
}

const doLookup = async () => {
  const value = phone.value.trim()
  if (!/^\d{11}$/.test(value)) {
    tip('请填写完整的 11 位手机号')
    return
  }
  if (looking.value) return
  looking.value = true
  try {
    const res = await lookupUser(value)
    user.value = res
    lookedUp.value = true
    // 默认取第一台车，操作员多数情况下不用改
    plateNo.value = res.vehicles.length ? toApiPlate(res.vehicles[0]) : ''
    if (res.working_order_id) tip('该用户还有进行中的订单')
  } catch (error) {
    user.value = null
    lookedUp.value = true
    tip(error instanceof ApiError ? error.message : '查询失败')
  } finally {
    looking.value = false
  }
}

const doSubmit = async () => {
  if (!canSubmit.value) {
    if (!stationId.value) tip('请先选择工位')
    else if (!user.value) tip('请先查询用户')
    else if (user.value.working_order_id) tip('该用户还有进行中的订单')
    return
  }

  const station = idleStations.value.find(item => item.id === stationId.value)
  const res = await Taro.showModal({
    title: `为 ${user.value?.nickname} 开单？`,
    content: `${station?.name || '所选工位'} 将立即启动并开始计时，费用按用户端规则结算。`,
    confirmText: '确认开单',
    confirmColor: '#E6436E',
    cancelText: '再想想',
  })
  if (!res.confirm) return

  submitting.value = true
  try {
    const order = await createOrder({
      station_id: stationId.value,
      user_id: user.value!.id,
      plate_no: plateNo.value || undefined,
    })
    tip('已开单，正在进入订单')
    setTimeout(() => {
      Taro.redirectTo({ url: `/packageOrder/pages/detail/index?id=${order.id}` })
    }, 600)
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '开单失败')
  } finally {
    submitting.value = false
  }
}

const load = async () => {
  if (!shopId.value) {
    const cached = Number(Taro.getStorageSync(SHOP_KEY) || 0)
    if (cached) shopId.value = cached
  }
  if (!shopId.value) {
    loading.value = false
    return
  }
  try {
    overview.value = await fetchShopOverview(shopId.value)
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '工位加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss">
.co {
  min-height: 100vh;
  padding: $sp-3 $page-x $sp-6;
}

/* ---------- 区块标题 ---------- */
.sec {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 24rpx 0 16rpx;

  &:first-child {
    margin-top: 0;
  }

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

.hint {
  padding: 24rpx 20rpx;
  border-radius: $r-lg;
  background: $fill-2;

  &__text {
    font-size: $fs-caption-sm;
    color: $ink-3;
    line-height: 1.6;
  }
}

/* ---------- 工位选择 ---------- */
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: $grid-gap;
}

.cell {
  width: calc((100% - #{$grid-gap}) / 2);
  padding: 22rpx 20rpx;
  border-radius: $r-xl;
  border: 2rpx solid $line;
  background: $card;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @include press;

  &__n {
    font-size: $fs-body;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__s {
    font-size: $fs-nano;
    color: $idle-ink;
  }

  &--on {
    border-color: $brand;
    background: $brand-soft;

    .cell__n {
      color: $brand-deep;
    }
  }
}

/* ---------- 手机号查询 ---------- */
.search {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 8rpx 8rpx 24rpx;
  border-radius: $r-xl;
  background: $card;
  border: 2rpx solid $line;

  &__input {
    flex: 1;
    height: 76rpx;
    font-size: $fs-body-sm;
    color: $ink;
  }

  &__ph {
    color: $ink-4;
  }

  &__btn {
    flex: none;
    padding: 0 30rpx;
    height: 64rpx;
    line-height: 64rpx;
    border-radius: $r-md;
    background: $brand;
    color: #FFFFFF;
    font-size: $fs-caption;
    font-weight: $fw-medium;

    &--busy {
      background: $brand-line;
    }
  }
}

/* ---------- 查到的用户 ---------- */
.u {
  @include card;
  margin-top: 16rpx;

  &__hd {
    display: flex;
    align-items: baseline;
    gap: 12rpx;
  }

  &__name {
    font-size: $fs-title;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__tag {
    padding: 0 10rpx;
    height: 34rpx;
    line-height: 34rpx;
    border-radius: $r-xs;
    font-size: $fs-nano;
    background: $brand-soft;
    color: $brand-deep;
  }

  &__phone {
    margin-left: auto;
    font-size: $fs-caption;
    color: $ink-3;
    @include tabular;
  }

  &__meta {
    display: flex;
    gap: 24rpx;
    margin-top: 12rpx;
  }

  &__cell {
    font-size: $fs-caption;
    color: $ink-2;
    @include tabular;
  }

  &__warn {
    margin-top: 16rpx;
    padding: 16rpx 18rpx;
    border-radius: $r-md;
    background: $warn-soft;
    color: $warn;
    font-size: $fs-caption-sm;
    line-height: 1.6;
  }

  &__tip {
    display: block;
    margin-top: 12rpx;
    font-size: $fs-nano;
    color: $ink-4;
    line-height: 1.6;
  }
}

.plates {
  margin-top: 20rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid $line;

  &__label {
    font-size: $fs-caption;
    color: $ink-3;
  }

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 12rpx;
  }
}

.plate {
  padding: 0 18rpx;
  height: 52rpx;
  line-height: 52rpx;
  border-radius: $r-xs;
  border: 2rpx solid $line-2;
  background: $card;
  font-size: $fs-caption;
  color: $ink-2;
  letter-spacing: 1rpx;

  &--on {
    border-color: $brand;
    background: $brand-soft;
    color: $brand-deep;
    font-weight: $fw-medium;
  }
}

/* ---------- 提交 ---------- */
.btn {
  margin-top: 32rpx;
  width: 100%;
  height: $btn-h;
  line-height: $btn-h;
  border-radius: $r-md;
  background: $brand;
  color: #FFFFFF;
  font-size: $fs-title;
  font-weight: $fw-semibold;
  text-align: center;

  &--off {
    background: $fill;
    color: $ink-4;
  }
}

.note {
  display: block;
  margin: 24rpx 4rpx 0;
  font-size: $fs-nano;
  color: $ink-4;
  line-height: 1.7;
}
</style>
