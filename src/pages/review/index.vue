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

      <view v-if="item.photos && item.photos.length" class="photos">
        <image
          v-for="(url, idx) in item.photos"
          :key="url + idx"
          class="photos__item"
          :src="url"
          mode="aspectFill"
          @tap="previewPhotos(item.photos, idx)"
        />
      </view>
      <view v-else class="photos photos--empty">
        <text class="photos__none">用户未上传照片</text>
      </view>

      <view v-if="item.status === 'pending'" class="card__actions">
        <button class="btn btn--reject" :disabled="acting === item.id" @tap="openReject(item)">审核拒绝</button>
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

    <view v-if="!loading && list.length" class="more">
      <text v-if="hasMore" class="more__btn" @tap="loadMore">加载更多（{{ list.length }}/{{ total }}）</text>
      <text v-else class="more__end">没有更多了</text>
    </view>

    <!-- 拒绝弹层：预设原因 chip + 自定义输入 -->
    <view v-if="rejectTarget" class="sheet" @tap="closeReject">
      <view class="sheet__panel" @tap.stop>
        <view class="sheet__head">
          <text class="sheet__title">审核拒绝</text>
          <text class="sheet__close" @tap="closeReject">关闭</text>
        </view>
        <text class="sheet__hint">理由会展示在用户端，请写清楚问题在哪。</text>
        <view class="chips">
          <text
            v-for="reason in reasons"
            :key="reason"
            class="chips__item"
            :class="{ 'chips__item--active': rejectReason === reason }"
            @tap="pickReason(reason)"
          >
            {{ reason }}
          </text>
        </view>
        <textarea
          class="sheet__input"
          :value="rejectReason"
          placeholder="也可以自己写一条（至少 2 个字）"
          maxlength="200"
          @input="onReasonInput"
        />
        <button class="btn btn--danger" :loading="acting > 0" :disabled="acting > 0" @tap="submitReject">
          确认拒绝
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { approveReview, fetchReviewMeta, fetchReviews, rejectReview } from '@/api/review'
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

const PAGE_SIZE = 20

const status = ref<ReviewStatus>('pending')
const list = ref<ReviewItem[]>([])
const loading = ref(true)
const acting = ref(0)
const pendingCount = ref(0)
const page = ref(1)
const total = ref(0)
const hasMore = ref(false)

const reasons = ref<string[]>([])
const rejectTarget = ref<ReviewItem | null>(null)
const rejectReason = ref('')

const stateText = (value: ReviewStatus) => STATE_TEXT[value] || '未知'
const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1600 })

/** 照片预览：审核员要能放大看清地面 */
const previewPhotos = (urls: string[], current: number) => {
  Taro.previewImage({ current: urls[current], urls })
}

const load = async (next: ReviewStatus = status.value, append = false) => {
  if (!append) {
    loading.value = true
    page.value = 1
  }
  try {
    const res = await fetchReviews(next, page.value, PAGE_SIZE)
    list.value = append ? [...list.value, ...res.list] : res.list
    total.value = res.total
    hasMore.value = list.value.length < res.total
    if (next === 'pending') pendingCount.value = res.total
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

const loadMore = async () => {
  if (!hasMore.value) return
  page.value += 1
  await load(status.value, true)
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

/** 预设原因：首次打开发一次，失败不影响手写 */
const ensureReasons = async () => {
  if (reasons.value.length) return
  try {
    const meta = await fetchReviewMeta()
    reasons.value = meta.reject_reasons || []
  } catch {
    reasons.value = []
  }
}

const openReject = async (item: ReviewItem) => {
  rejectTarget.value = item
  rejectReason.value = ''
  await ensureReasons()
}

const closeReject = () => {
  rejectTarget.value = null
  rejectReason.value = ''
}

const pickReason = (reason: string) => {
  rejectReason.value = reason
}

const onReasonInput = (event: { detail: { value: string } }) => {
  rejectReason.value = event.detail.value
}

const submitReject = async () => {
  const item = rejectTarget.value
  if (!item || acting.value) return
  const remark = rejectReason.value.trim()
  if (remark.length < 2) {
    tip('请填写拒绝理由')
    return
  }

  acting.value = item.id
  try {
    await rejectReview(item.id, remark)
    Taro.showToast({ title: '已拒绝', icon: 'success', duration: 1000 })
    closeReject()
    await load()
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '操作失败')
  } finally {
    acting.value = 0
  }
}

onMounted(() => {
  load()
  ensureReasons()
})

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
  flex-wrap: wrap;
  align-items: center;
  gap: 12rpx;
  margin-top: 16rpx;

  &__item {
    width: 140rpx;
    height: 140rpx;
    border-radius: $r-sm;
    background: $fill;
  }

  &--empty {
    padding: 20rpx 0;
  }

  &__none {
    font-size: $fs-caption;
    color: $ink-4;
  }
}

.more {
  padding: 32rpx 0 8rpx;
  text-align: center;

  &__btn {
    font-size: $fs-caption;
    color: $brand;
    @include press;
  }

  &__end {
    font-size: $fs-caption-sm;
    color: $ink-4;
  }
}

.sheet {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.45);

  &__panel {
    width: 100%;
    padding: 32rpx $page-x calc(32rpx + env(safe-area-inset-bottom));
    border-radius: $r-lg $r-lg 0 0;
    background: $card;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12rpx;
  }

  &__title {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__close {
    font-size: $fs-caption;
    color: $ink-3;
    @include press;
  }

  &__hint {
    display: block;
    margin-bottom: 20rpx;
    font-size: $fs-caption-sm;
    color: $ink-2;
    line-height: 1.6;
  }

  &__input {
    width: 100%;
    height: 160rpx;
    margin: 20rpx 0 24rpx;
    padding: 20rpx;
    box-sizing: border-box;
    border-radius: $r-md;
    background: $fill;
    font-size: $fs-body;
    color: $ink;
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;

  &__item {
    padding: 12rpx 24rpx;
    border-radius: $r-full;
    background: $fill;
    border: 1rpx solid $line;
    font-size: $fs-caption;
    color: $ink-2;
    @include press;

    &--active {
      background: $danger-soft;
      border-color: $danger-ink;
      color: $danger-ink;
    }
  }
}

.btn {
  flex: 1;
  width: 100%;
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

  &--danger {
    background: $danger-ink;
    color: $card;
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
