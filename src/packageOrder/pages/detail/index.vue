<template>
  <view class="od">
    <view v-if="loading" class="hint"><text class="hint__text">加载中…</text></view>

    <view v-else-if="!order" class="hint"><text class="hint__text">订单不存在或已删除</text></view>

    <template v-else>
      <view class="hero" :class="`hero--${order.status}`">
        <text class="hero__state">{{ statusText(order.status) }}</text>
        <text v-if="order.status === 'done'" class="hero__amount">{{ formatMoney(order.amount) }}</text>
        <text v-else class="hero__amount hero__amount--muted">
          {{ order.status === 'ongoing' ? '进行中不计费' : '未产生费用' }}
        </text>
        <text class="hero__no">订单号 {{ order.order_no }}</text>
      </view>

      <!-- 进行中：计时与结束入口 -->
      <view v-if="order.status === 'ongoing'" class="timer">
        <view class="timer__main">
          <text class="timer__label">已洗</text>
          <text class="timer__value">{{ formatDuration(elapsed) }}</text>
        </view>
        <button class="btn btn--danger" :disabled="acting" @tap="doFinish">结束订单</button>
      </view>

      <view class="block">
        <view class="line">
          <text class="line__k">门店</text>
          <text class="line__v">{{ order.shop_name }}</text>
        </view>
        <view class="line">
          <text class="line__k">工位</text>
          <text class="line__v">{{ order.station_name }}工位</text>
        </view>
        <view class="line">
          <text class="line__k">开始</text>
          <text class="line__v">{{ formatDateTime(order.started_at) }}</text>
        </view>
        <view class="line">
          <text class="line__k">结束</text>
          <text class="line__v">{{ order.ended_at ? formatDateTime(order.ended_at) : '—' }}</text>
        </view>
        <view class="line">
          <text class="line__k">时长</text>
          <text class="line__v">{{ durationText }}</text>
        </view>
      </view>

      <view class="block">
        <view class="line">
          <text class="line__k">用户</text>
          <view class="line__right">
            <text class="line__v">{{ order.nickname }} · {{ order.user_phone_masked }}</text>
            <text class="minibtn" @tap="openUser">详情</text>
          </view>
        </view>
        <view class="line">
          <text class="line__k">车牌</text>
          <view class="line__right">
            <text class="line__v">{{ order.plate_no || '—' }}</text>
            <text v-if="order.plate_no" class="minibtn" @tap="copyPlate">复制</text>
          </view>
        </view>
        <view class="line">
          <text class="line__k">支付状态</text>
          <text class="line__v">{{ order.pay_text }}</text>
        </view>
      </view>

      <!-- 费用构成：只对已结束订单展示 -->
      <view v-if="order.status === 'done'" class="block">
        <view class="block__title">费用构成</view>
        <view class="line">
          <text class="line__k">实付金额</text>
          <text class="line__v line__v--strong">{{ formatMoney(order.fee.total_fee) }}</text>
        </view>
        <view v-if="order.fee.balance > 0" class="line">
          <text class="line__k">余额支付</text>
          <text class="line__v">{{ formatMoney(order.fee.balance) }}</text>
        </view>
        <view v-if="order.fee.night_discount > 0" class="line">
          <text class="line__k">夜间优惠</text>
          <text class="line__v line__v--green">-{{ formatMoney(order.fee.night_discount) }}</text>
        </view>
        <view v-if="order.fee.experience_minutes > 0" class="line">
          <text class="line__k">体验券抵扣</text>
          <text class="line__v">{{ order.fee.experience_minutes }} 分钟</text>
        </view>
        <view v-if="order.fee.new_user_minutes > 0" class="line">
          <text class="line__k">新人优惠</text>
          <text class="line__v">{{ order.fee.new_user_minutes }} 分钟</text>
        </view>
      </view>

      <!-- 停车代缴 -->
      <view v-if="order.plate_no" class="block">
        <view class="line">
          <text class="line__k">停车费代缴</text>
          <view class="line__right">
            <text class="line__v line__v--muted">
              {{ order.parking_paid_at ? `已代缴 ${formatDateTime(order.parking_paid_at)}` : '未代缴' }}
            </text>
            <text class="minibtn minibtn--brand" @tap="goParking">
              {{ order.parking_paid_at ? '再缴一次' : '去代缴' }}
            </text>
          </view>
        </view>
      </view>

      <view class="note">
        进行中订单不展示实时金额：算费会消耗用户当日的免费洗车额度并核销券，属于写操作，只在结束时结算。
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { fetchOrder, finishOrder } from '@/api/order'
import type { OrderDetail, OrderStatus } from '@/types/api'
import { formatDateTime, formatDuration, formatMoney, secondsSince } from '@/utils/format'
import { ApiError } from '@/utils/error'

const STATE_TEXT: Record<OrderStatus, string> = {
  ongoing: '进行中',
  done: '已完成',
  canceled: '已取消',
}

const router = useRouter()
const order = ref<OrderDetail | null>(null)
const loading = ref(true)
const acting = ref(false)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

const statusText = (value: OrderStatus) => STATE_TEXT[value] || '未知'

/** 进行中按本地时钟走，每秒 +1；结束时用服务端 duration_text */
const elapsed = computed(() => {
  if (!order.value) return 0
  if (order.value.status !== 'ongoing') return 0
  void now.value
  return secondsSince(order.value.started_at)
})

const durationText = computed(() => {
  if (!order.value) return '—'
  if (order.value.status !== 'ongoing') return order.value.duration_text || '—'
  const secs = elapsed.value
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分钟`
})

const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1800 })

const load = async () => {
  const id = Number(router.params.id)
  if (!id) {
    loading.value = false
    return
  }
  try {
    order.value = await fetchOrder(id)
  } catch (error) {
    if (error instanceof ApiError) {
      // 详情页内联展示，不弹 toast
      console.warn('[order-detail]', error.message)
    }
  } finally {
    loading.value = false
  }
}

const doFinish = async () => {
  const current = order.value
  if (!current || acting.value) return
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
    await finishOrder(current.id, '管理端强制结束')
    tip('订单已结束')
    await load()
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '结束订单失败')
  } finally {
    acting.value = false
  }
}

const openUser = () => {
  if (!order.value) return
  Taro.navigateTo({ url: `/packageUser/pages/detail/index?id=${order.value.user_id}` })
}

const copyPlate = () => {
  if (!order.value) return
  Taro.setClipboardData({ data: order.value.plate_no })
}

const goParking = () => {
  if (!order.value) return
  const plate = encodeURIComponent(order.value.plate_no)
  Taro.navigateTo({
    url: `/packageStation/pages/parking/index?shop_id=${order.value.shop_id}&plate=${plate}&order_id=${order.value.id}`,
  })
}

load()
timer = setInterval(() => {
  now.value = Date.now()
}, 1000)
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// 从停车页返回后刷新，代缴时间要立刻反映出来
useDidShow(() => {
  if (!loading.value) load()
})
</script>

<style lang="scss">
.od {
  min-height: 100vh;
  padding: $sp-3 $page-x 48rpx;
}

.hero {
  @include card;
  padding: 36rpx $card-padding;

  &--ongoing {
    @include state-block($busy-fill, $busy-line, $busy-ink);
  }

  &--done {
    @include state-block($idle-fill, $idle-line, $idle-ink);
  }

  &--canceled {
    @include state-block($off-fill, $off-line, $off-ink);
  }

  &__state {
    display: block;
    font-size: $fs-body;
    opacity: 0.8;
  }

  &__amount {
    display: block;
    margin: 8rpx 0;
    font-size: $fs-h1;
    font-weight: $fw-semibold;
    @include tabular;

    &--muted {
      font-size: $fs-h3;
      font-weight: $fw-medium;
    }
  }

  &__no {
    display: block;
    font-size: $fs-caption-sm;
    opacity: 0.7;
    @include tabular;
  }
}

.timer {
  @include card;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &__main {
    display: flex;
    flex-direction: column;
  }

  &__label {
    font-size: $fs-caption;
    color: $ink-3;
  }

  &__value {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    color: $ink;
    font-variant-numeric: tabular-nums;
  }
}

.block {
  @include card;
  padding: 4rpx $card-padding;

  &__title {
    padding: 24rpx 0 8rpx;
    font-size: $fs-caption;
    color: $ink-3;
  }
}

.line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;

  & + & {
    border-top: 1rpx solid $line;
  }

  &__k {
    font-size: $fs-body;
    color: $ink-2;
  }

  &__v {
    font-size: $fs-body;
    color: $ink;
    @include tabular;

    &--strong {
      font-weight: $fw-semibold;
    }

    &--green {
      color: $idle-ink;
    }

    &--muted {
      color: $ink-3;
    }
  }

  &__right {
    display: flex;
    align-items: center;
    gap: $sp-2;
  }
}

.minibtn {
  padding: 0 16rpx;
  height: 44rpx;
  line-height: 44rpx;
  border-radius: $r-full;
  border: 1rpx solid $line-2;
  font-size: $fs-micro;
  color: $ink-2;

  &--brand {
    border-color: $brand-line;
    color: $brand;
  }
}

.btn {
  height: $btn-h-sm;
  line-height: $btn-h-sm;
  padding: 0 $sp-4;
  border-radius: $r-full;
  font-size: $fs-body;
  border: none;

  &--danger {
    background: $danger;
    color: #fff;
  }

  &[disabled] {
    opacity: 0.5;
  }
}

.note {
  padding: 20rpx 24rpx;
  border-radius: $r-md;
  background: $fill;
  font-size: $fs-caption-sm;
  color: $ink-3;
  line-height: 1.7;
}

.hint {
  padding: 120rpx 0;
  text-align: center;

  &__text {
    font-size: $fs-caption;
    color: $ink-3;
  }
}
</style>
