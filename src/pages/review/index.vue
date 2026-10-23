<template>
  <view class="rv">
    <view class="tabs">
      <view
        v-for="tab in TABS"
        :key="tab.key"
        class="tabs__item"
        :class="{ 'tabs__item--active': status === tab.key }"
        @tap="switchTab(tab.key)"
      >
        <text class="tabs__text">{{ tab.label }}</text>
        <text v-if="tab.key === 'pending' && pendingCount > 0" class="tabs__badge">{{ pendingCount }}</text>
      </view>
    </view>

    <view class="rv__note">所有门店的提交都在这里处理，不随「现场」页的门店切换而变化；卡片上标注门店名。</view>

    <view v-if="loading" class="empty"><text class="empty__text">加载中…</text></view>

    <view v-else-if="!list.length" class="empty">
      <text class="empty__text">{{ status === 'pending' ? '没有待审核的提交' : '暂无记录' }}</text>
    </view>

    <view v-for="item in list" :key="item.id" class="card">
      <view class="card__head">
        <text class="card__no">订单 #{{ item.order_no }}</text>
        <text class="card__state" :class="`card__state--${item.status}`">{{ stateText(item.status) }}</text>
      </view>

      <view class="card__line">
        <text class="card__shop">{{ item.shop_name }} · {{ item.station_name }}工位</text>
        <text class="card__amount">{{ formatMoney(item.amount) }}</text>
      </view>

      <view class="card__meta">用户 {{ item.user_phone_masked }} · 车牌 {{ item.plate_no }}</view>
      <view class="card__meta">提交于 {{ item.submitted_at }} · {{ item.waited_text }}</view>

      <view class="photos">
        <view v-for="n in Math.min(item.photo_count, 3)" :key="n" class="photos__item">
          <text class="photos__icon">图</text>
        </view>
        <text v-if="item.photo_count > 3" class="photos__more">+{{ item.photo_count - 3 }}</text>
      </view>

      <view v-if="item.status === 'pending'" class="card__actions">
        <button class="btn btn--reject" :disabled="acting === item.id" @tap="handleReject(item)">审核拒绝</button>
        <button
          class="btn btn--approve"
          :loading="acting === item.id"
          :disabled="acting === item.id"
          @tap="handleApprove(item)"
        >
          审核通过
        </button>
      </view>

      <view v-else-if="item.review_remark" class="card__remark">拒绝理由：{{ item.review_remark }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { approveReview, fetchReviews, rejectReview } from '@/api/review'
import type { ReviewItem, ReviewStatus } from '@/types/api'
import { formatMoney } from '@/utils/format'
import { ApiError } from '@/utils/error'

const TABS: Array<{ key: ReviewStatus; label: string }> = [
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已拒绝' },
]

const STATE_TEXT: Record<ReviewStatus, string> = {
  pending: '待审核',
  draft: '待提交',
  approved: '已通过',
  rejected: '已拒绝',
}

const status = ref<ReviewStatus>('pending')
const list = ref<ReviewItem[]>([])
const loading = ref(true)
const acting = ref(0)
const pendingCount = ref(0)

const stateText = (value: ReviewStatus) => STATE_TEXT[value] || '未知'
const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1600 })

const load = async (next: ReviewStatus = status.value) => {
  loading.value = true
  try {
    const res = await fetchReviews(next)
    list.value = res.list
    if (next === 'pending') pendingCount.value = res.total
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

const switchTab = (next: ReviewStatus) => {
  if (status.value === next) return
  status.value = next
  list.value = []
  load(next)
}

const handleApprove = async (item: ReviewItem) => {
  const confirm = await Taro.showModal({
    title: '确认通过',
    content: `将向用户 ${item.user_phone_masked} 发放 ${formatMoney(item.amount)} 奖励，操作不可撤销。`,
    confirmText: '确认发放',
    confirmColor: '#E6436E',
  })
  if (!confirm.confirm) return

  acting.value = item.id
  try {
    await approveReview(item.id)
    Taro.showToast({ title: '已通过', icon: 'success', duration: 1000 })
    await load()
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '操作失败')
  } finally {
    acting.value = 0
  }
}

const handleReject = async (item: ReviewItem) => {
  const res = await Taro.showModal({
    title: '审核拒绝',
    editable: true,
    placeholderText: '请填写拒绝理由，用户端可见',
    confirmText: '确认拒绝',
    confirmColor: '#D93026',
  })
  if (!res.confirm) return
  const remark = (res.content || '').trim()
  if (!remark) {
    tip('请填写拒绝理由')
    return
  }

  acting.value = item.id
  try {
    await rejectReview(item.id, remark)
    Taro.showToast({ title: '已拒绝', icon: 'success', duration: 1000 })
    await load()
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '操作失败')
  } finally {
    acting.value = 0
  }
}

onMounted(() => load())

usePullDownRefresh(async () => {
  await load()
  Taro.stopPullDownRefresh()
})
</script>

<style lang="scss">
.rv {
  min-height: 100vh;
  padding: $sp-3 $page-x 48rpx;

  &__note {
    margin-bottom: $card-gap;
    padding: 20rpx 24rpx;
    border-radius: $r-md;
    background: $fill;
    font-size: $fs-caption-sm;
    color: $ink-2;
    line-height: 1.6;
  }
}

.tabs {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;

  &__item {
    display: flex;
    align-items: center;
    gap: 6rpx;
    padding: 12rpx 24rpx;
    border-radius: $r-full;
    background: $card;
    border: 1rpx solid $line;
    @include press;

    &--active {
      background: $brand;
      border-color: $brand;

      .tabs__text {
        color: $card;
        font-weight: $fw-medium;
      }
    }
  }

  &__text {
    font-size: $fs-body;
    color: $ink-2;
  }

  &__badge {
    min-width: 32rpx;
    height: 32rpx;
    padding: 0 8rpx;
    border-radius: $r-full;
    background: $brand-soft;
    color: $brand;
    font-size: $fs-micro;
    line-height: 32rpx;
    text-align: center;
  }
}

.card {
  @include card;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14rpx;
  }

  &__no {
    font-size: $fs-caption;
    color: $ink-3;
    @include tabular;
  }

  &__state {
    padding: 2rpx 12rpx;
    border-radius: $r-xs;
    font-size: $fs-micro;

    &--pending {
      @include state-block($busy-fill, $busy-line, $busy-ink);
    }

    &--approved {
      @include state-block($idle-fill, $idle-line, $idle-ink);
    }

    &--rejected {
      @include state-block($off-fill, $off-line, $off-ink);
    }

    &--draft {
      @include state-block($off-fill, $off-line, $off-ink);
    }
  }

  &__line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10rpx;
  }

  &__shop {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__amount {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    color: $brand;
    @include tabular;
  }

  &__meta {
    font-size: $fs-caption;
    color: $ink-2;
    line-height: 1.7;
  }

  &__actions {
    display: flex;
    gap: $grid-gap;
    margin-top: 24rpx;
  }

  &__remark {
    margin-top: 16rpx;
    padding: 16rpx 20rpx;
    border-radius: $r-md;
    background: $danger-soft;
    color: $danger-ink;
    font-size: $fs-caption;
    line-height: 1.6;
  }
}

.photos {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 16rpx;

  &__item {
    width: 96rpx;
    height: 96rpx;
    border-radius: $r-sm;
    @include state-block($fill, $line, $ink-4);
  }

  &__icon {
    display: block;
    font-size: $fs-caption-sm;
    line-height: 96rpx;
    text-align: center;
    color: $ink-4;
  }

  &__more {
    font-size: $fs-caption;
    color: $ink-3;
  }
}

.btn {
  flex: 1;
  height: $btn-h-sm;
  border-radius: $r-md;
  font-size: $fs-body;
  font-weight: $fw-medium;
  line-height: $btn-h-sm;
  text-align: center;
  @include press;

  &--approve {
    background: $brand;
    color: $card;
  }

  &--reject {
    background: $card;
    border: 2rpx solid $line-2;
    color: $ink-2;
  }

  &[disabled] {
    opacity: 0.55;
  }
}

.empty {
  padding: 96rpx 0;
  text-align: center;

  &__text {
    font-size: $fs-caption;
    color: $ink-3;
  }
}
</style>
