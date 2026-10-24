<template>
  <view class="ud">
    <view v-if="loading" class="hint"><text class="hint__text">加载中…</text></view>

    <view v-else-if="!user" class="hint"><text class="hint__text">用户不存在或无权限查看</text></view>

    <template v-else>
      <view class="who">
        <view class="who__avatar">{{ avatarMark }}</view>
        <view class="who__main">
          <view class="who__row">
            <text class="who__name">{{ user.nickname }}</text>
            <text v-if="user.is_newer" class="who__tag">新人</text>
          </view>
          <text class="who__phone">{{ user.phone_masked }}</text>
        </view>
        <view class="who__acts">
          <text class="minibtn" @tap="copyPhone">复制</text>
          <text class="minibtn minibtn--brand" @tap="callPhone">拨打</text>
        </view>
      </view>

      <view class="assets">
        <view class="assets__cell">
          <text class="assets__num">{{ formatMoney(user.balance) }}</text>
          <text class="assets__label">账户余额</text>
        </view>
        <view class="assets__divider" />
        <view class="assets__cell">
          <text class="assets__num">{{ formatMoney(user.give_balance) }}</text>
          <text class="assets__label">累计赠送</text>
        </view>
      </view>

      <view class="block">
        <view class="block__title">车辆</view>
        <view v-if="!user.vehicles.length" class="block__empty">未绑定车辆</view>
        <view v-for="item in user.vehicles" :key="item" class="plate">
          <text class="plate__no">{{ displayPlate(item) }}</text>
          <text class="minibtn" @tap="copyText(displayPlate(item))">复制</text>
        </view>
      </view>

      <view class="block">
        <view class="block__title">用车记录</view>
        <view class="line">
          <text class="line__k">累计订单</text>
          <text class="line__v">{{ user.order_count }} 单</text>
        </view>
        <view class="line">
          <text class="line__k">最近一次</text>
          <text class="line__v">{{ user.last_order_at ? formatDateTime(user.last_order_at) : '—' }}</text>
        </view>
      </view>

      <view class="note">
        累计赠送是历史赠送流水之和，不等于「当前还能用的赠送额度」——余额表不区分本金与赠送，
        所以这里只能看累计值。
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { fetchUser } from '@/api/user'
import type { UserDetail } from '@/types/api'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ApiError } from '@/utils/error'

const router = useRouter()
const user = ref<UserDetail | null>(null)
const loading = ref(true)

const avatarMark = computed(() => {
  const name = user.value?.nickname || ''
  return name.slice(0, 1) || '用'
})

/** 后端已按「省 + 字母 + 间隔号」格式化，这里只兜底空值 */
const displayPlate = (plate: string) => plate || '—'

const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1600 })

const copyText = (text: string) => {
  Taro.setClipboardData({ data: text })
}

const copyPhone = () => {
  if (!user.value) return
  copyText(user.value.phone)
}

const callPhone = () => {
  const phone = user.value?.phone
  if (!phone) {
    tip('该用户没有手机号')
    return
  }
  Taro.makePhoneCall({ phoneNumber: phone }).catch(() => {
    // 用户取消拨号，不提示
  })
}

const load = async () => {
  const id = Number(router.params.id)
  if (!id) {
    loading.value = false
    return
  }
  try {
    user.value = await fetchUser(id)
  } catch (error) {
    if (error instanceof ApiError) {
      console.warn('[user-detail]', error.message)
    }
  } finally {
    loading.value = false
  }
}

load()
</script>

<style lang="scss">
.ud {
  min-height: 100vh;
  padding: $sp-3 $page-x 48rpx;
}

.who {
  @include card;
  display: flex;
  align-items: center;
  gap: $sp-3;

  &__avatar {
    width: 88rpx;
    height: 88rpx;
    border-radius: $r-full;
    background: $brand-soft;
    color: $brand;
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: $sp-1;
  }

  &__name {
    font-size: $fs-h3;
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

  &__phone {
    margin-top: 6rpx;
    font-size: $fs-caption;
    color: $ink-3;
    @include tabular;
  }

  &__acts {
    display: flex;
    gap: $sp-1;
  }
}

.assets {
  @include card;
  display: flex;
  align-items: center;

  &__cell {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__divider {
    width: 1rpx;
    height: 64rpx;
    background: $line;
  }

  &__num {
    font-size: $fs-h1;
    font-weight: $fw-semibold;
    color: $ink;
    @include tabular;
  }

  &__label {
    margin-top: 6rpx;
    font-size: $fs-caption-sm;
    color: $ink-3;
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

  &__empty {
    padding: 24rpx 0;
    font-size: $fs-body;
    color: $ink-3;
  }
}

.plate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;

  & + & {
    border-top: 1rpx solid $line;
  }

  &__no {
    font-size: $fs-body;
    font-weight: $fw-medium;
    color: $ink;
    @include tabular;
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
