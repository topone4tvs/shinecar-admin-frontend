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

      <view class="block">
        <view class="block__title">余额流水</view>
        <view v-if="!logs.length" class="block__empty">暂无流水</view>
        <view v-for="item in logs" :key="item.id" class="log">
          <view class="log__main">
            <text class="log__type">{{ item.type_text }}</text>
            <text class="log__time">{{ formatDateTime(item.created_at) }}</text>
          </view>
          <view class="log__right">
            <text class="log__amount" :class="item.amount >= 0 ? 'log__amount--in' : 'log__amount--out'">
              {{ item.amount >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(item.amount)) }}
            </text>
            <text class="log__after">余 {{ formatMoney(item.balance_after) }}</text>
          </view>
        </view>
      </view>

      <button class="adjust" @tap="openAdjust">调整余额</button>

      <view class="note">
        累计赠送是历史赠送流水之和，不等于「当前还能用的赠送额度」——余额表不区分本金与赠送，
        所以这里只能看累计值。
      </view>

      <!-- 余额调整弹层：居中而不是底部弹层，避开安卓手势条 -->
      <view v-if="adjustOpen" class="mask" @tap="closeAdjust">
        <view class="sheet" @tap.stop>
          <view class="sheet__head">
            <text class="sheet__title">调整余额</text>
            <text class="sheet__balance">当前 {{ formatMoney(user.balance) }}</text>
          </view>

          <view class="sheet__row">
            <view
              class="pick"
              :class="{ 'pick--on': form.action === 'grant' }"
              @tap="setAction('grant')"
            >
              加钱
            </view>
            <view
              class="pick"
              :class="{ 'pick--on': form.action === 'deduct' }"
              @tap="setAction('deduct')"
            >
              扣钱
            </view>
          </view>

          <view class="sheet__field">
            <text class="sheet__label">金额</text>
            <input
              class="sheet__input"
              type="digit"
              :value="form.amount"
              placeholder="0.00"
              placeholder-class="sheet__ph"
              @input="onAmountInput"
            />
            <text class="sheet__unit">元</text>
          </view>

          <view class="quick">
            <text v-for="v in QUICK_AMOUNTS" :key="v" class="quick__item" @tap="pickAmount(v)">
              {{ v }} 元
            </text>
          </view>

          <view class="sheet__field">
            <text class="sheet__label">原因</text>
            <input
              class="sheet__input"
              :value="form.reason"
              maxlength="50"
              placeholder="如：误扣补偿 / 线下收款"
              placeholder-class="sheet__ph"
              @input="onReasonInput"
            />
          </view>

          <view class="sheet__tip">原因会写进操作记录；单笔最多 1000 元。</view>

          <view class="sheet__acts">
            <button class="sheet__btn sheet__btn--ghost" @tap="closeAdjust">取消</button>
            <button
              class="sheet__btn"
              :loading="submitting"
              :disabled="submitting"
              @tap="submitAdjust"
            >
              {{ form.action === 'grant' ? '确认加钱' : '确认扣钱' }}
            </button>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { adjustUserBalance, fetchUser } from '@/api/user'
import type { UserDetail } from '@/types/api'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ApiError } from '@/utils/error'
import { inputValue } from '@/utils/input'

const router = useRouter()
const user = ref<UserDetail | null>(null)
const loading = ref(true)

/** 快捷金额，覆盖现场最常见的补偿档位 */
const QUICK_AMOUNTS = [10, 20, 50, 100]

const logs = computed(() => user.value?.balance_logs || [])

const adjustOpen = ref(false)
const submitting = ref(false)
const form = reactive({
  action: 'grant' as 'grant' | 'deduct',
  amount: '',
  reason: '',
})

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

// ---------------- 余额调整 ----------------

const openAdjust = () => {
  form.action = 'grant'
  form.amount = ''
  form.reason = ''
  adjustOpen.value = true
}

const closeAdjust = () => {
  if (submitting.value) return
  adjustOpen.value = false
}

const setAction = (action: 'grant' | 'deduct') => {
  form.action = action
}

const onAmountInput = (event: unknown) => {
  form.amount = inputValue(event)
}

const onReasonInput = (event: unknown) => {
  form.reason = inputValue(event)
}

const pickAmount = (value: number) => {
  form.amount = String(value)
}

const submitAdjust = async () => {
  const current = user.value
  if (!current) return

  const yuan = Number(form.amount)
  if (!form.amount || Number.isNaN(yuan) || yuan <= 0) {
    tip('请输入正确的金额')
    return
  }
  const fen = Math.round(yuan * 100)
  if (fen > 100000) {
    tip('单笔最多 1000 元')
    return
  }
  const reason = form.reason.trim()
  if (reason.length < 2) {
    tip('请填写调整原因（至少 2 个字）')
    return
  }

  const isGrant = form.action === 'grant'
  let confirmed = false
  try {
    const res = await Taro.showModal({
      title: isGrant ? '确认加钱' : '确认扣钱',
      content: `${isGrant ? '给' : '从'} ${current.nickname} ${isGrant ? '加' : '扣'} ${formatMoney(yuan)}，原因：${reason}`,
      confirmText: '确认',
      confirmColor: '#E6436E',
    })
    confirmed = res.confirm
  } catch {
    confirmed = false
  }
  if (!confirmed) return

  submitting.value = true
  try {
    const res = await adjustUserBalance(current.id, {
      action: form.action,
      amount_fen: fen,
      reason,
    })
    // 先用接口返回值刷新余额，再拉一次详情把流水补上
    current.balance = res.balance
    adjustOpen.value = false
    tip(`已${isGrant ? '加' : '扣'} ${formatMoney(res.amount)}，当前余额 ${formatMoney(res.balance)}`)
    await load()
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '操作失败')
  } finally {
    submitting.value = false
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

/* ---------------- 余额流水 ---------------- */
.log {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;

  & + & {
    border-top: 1rpx solid $line;
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: 6rpx;
  }

  &__type {
    font-size: $fs-body;
    color: $ink;
  }

  &__time {
    font-size: $fs-caption-sm;
    color: $ink-3;
  }

  &__right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6rpx;
  }

  &__amount {
    font-size: $fs-body;
    font-weight: $fw-semibold;
    @include tabular;

    &--in {
      color: $teal-ink;
    }

    &--out {
      color: $brand;
    }
  }

  &__after {
    font-size: $fs-caption-sm;
    color: $ink-3;
    @include tabular;
  }
}

.adjust {
  width: 100%;
  height: $btn-h;
  margin-bottom: $card-gap;
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

/* ---------------- 调整弹层（居中，避开底部手势区） ---------------- */
.mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 48rpx;
  background: rgba(0, 0, 0, 0.45);
}

.sheet {
  width: 100%;
  padding: 32rpx $card-padding;
  border-radius: $r-2xl;
  background: $card;
  box-shadow: $shadow-card;

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 24rpx;
  }

  &__title {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__balance {
    font-size: $fs-caption;
    color: $ink-3;
    @include tabular;
  }

  &__row {
    display: flex;
    gap: 16rpx;
    margin-bottom: 20rpx;
  }

  &__field {
    display: flex;
    align-items: center;
    height: $field-h;
    padding: 0 20rpx;
    margin-bottom: 16rpx;
    border-radius: $r-md;
    background: $fill-2;
    border: 1rpx solid $line;
  }

  &__label {
    flex: none;
    width: 90rpx;
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

  &__unit {
    font-size: $fs-caption;
    color: $ink-3;
  }

  &__tip {
    margin-bottom: 20rpx;
    font-size: $fs-caption-sm;
    color: $ink-3;
    line-height: 1.6;
  }

  &__acts {
    display: flex;
    gap: 16rpx;
  }

  &__btn {
    flex: 1;
    height: $btn-h;
    border-radius: $r-md;
    background: $brand;
    color: $card;
    font-size: $fs-title;
    font-weight: $fw-semibold;
    line-height: $btn-h;
    text-align: center;
    @include press;

    &--ghost {
      background: $fill;
      color: $ink-2;
    }

    &[disabled] {
      background: $brand-line;
    }
  }
}

.pick {
  flex: 1;
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  border-radius: $r-full;
  background: $fill;
  color: $ink-2;
  font-size: $fs-body;
  @include press;

  &--on {
    background: $brand-soft;
    color: $brand;
    font-weight: $fw-semibold;
  }
}

.quick {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;

  &__item {
    flex: 1;
    height: 56rpx;
    line-height: 56rpx;
    text-align: center;
    border-radius: $r-sm;
    border: 1rpx solid $line-2;
    font-size: $fs-caption;
    color: $ink-2;
    @include press;
  }
}
</style>
