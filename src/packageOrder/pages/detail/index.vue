<template>
  <view class="od">
    <view v-if="loading" class="hint"><text class="hint__text">加载中…</text></view>

    <view v-else-if="!order" class="hint"><text class="hint__text">订单不存在或已删除</text></view>

    <template v-else>
      <view class="hero" :class="`hero--${order.status}`">
        <text class="hero__state">{{ statusText(order.status) }}</text>
        <text v-if="order.status === 'done'" class="hero__amount">{{ formatMoney(order.amount) }}</text>
        <text v-else class="hero__amount hero__amount--muted">进行中不计费</text>
        <text class="hero__no">订单号 {{ order.order_no }}</text>
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
          <text class="line__v">{{ order.nickname }} · {{ order.user_phone_masked }}</text>
        </view>
        <view class="line">
          <text class="line__k">车牌</text>
          <text class="line__v">{{ order.plate_no }}</text>
        </view>
        <view class="line">
          <text class="line__k">支付状态</text>
          <text class="line__v">{{ order.pay_text }}</text>
        </view>
      </view>

      <view class="note">
        进行中订单不展示实时金额：算费会消耗用户当日的免费洗车额度，属于写操作，需用户端发起。
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from '@tarojs/taro'
import { fetchOrder } from '@/api/order'
import type { OrderDetail, OrderStatus } from '@/types/api'
import { formatDateTime, formatMoney, secondsSince } from '@/utils/format'
import { ApiError } from '@/utils/error'

const STATE_TEXT: Record<OrderStatus, string> = {
  ongoing: '进行中',
  done: '已完成',
  refunded: '已退款',
}

const router = useRouter()
const order = ref<OrderDetail | null>(null)
const loading = ref(true)

const statusText = (value: OrderStatus) => STATE_TEXT[value] || '未知'

const durationText = computed(() => {
  if (!order.value) return '—'
  if (order.value.status !== 'ongoing') return order.value.duration_text || '—'
  const secs = secondsSince(order.value.started_at)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分钟`
})

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

load()
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

  &--refunded {
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

.block {
  @include card;
  padding: 4rpx $card-padding;
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
