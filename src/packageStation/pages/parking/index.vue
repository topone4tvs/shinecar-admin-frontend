<template>
  <view class="pk">
    <!-- 门店条：由入口带入，页内不切店，仅用于审计归属 -->
    <view class="shopbar">
      <text class="shopbar__mark">{{ shopMark }}</text>
      <view class="shopbar__body">
        <text class="shopbar__name">{{ shopName }}</text>
        <text class="shopbar__meta">门店账户代付 · 不占用用户余额</text>
      </view>
      <text class="shopbar__tag">门店工具</text>
    </view>

    <!-- 车牌录入 -->
    <view class="platecard" :class="{ 'platecard--filled': !!plate }" @tap="focusInput">
      <view class="platecard__head">
        <text class="platecard__k">车牌号</text>
        <text v-if="!plate" class="platecard__hint">点击录入 ›</text>
        <text v-else class="platecard__clear" @tap.stop="clearPlate">清除</text>
      </view>
      <input
        v-if="!plate"
        class="platecard__input"
        :focus="autoFocus"
        maxlength="9"
        placeholder="支持新能源 8 位，如 沪A·D2311"
        placeholder-class="platecard__ph"
        @input="onPlateInput"
      />
      <text v-else class="platecard__value">{{ plate }}</text>
      <text class="platecard__tip">录入后即可代缴，无需查询金额</text>
    </view>

    <!-- 代缴说明：固定三行，不随状态变化 -->
    <view class="card">
      <view class="kv">
        <text class="kv__k">金额</text>
        <text class="kv__v">由停车系统按在场时长结算，页面不展示</text>
      </view>
      <view class="kv">
        <text class="kv__k">支付方式</text>
        <text class="kv__v">门店账户代付，不走小程序支付</text>
      </view>
      <view class="kv">
        <text class="kv__k">结果</text>
        <text class="kv__v">成功后系统自动抬杆，车辆可直接离场</text>
      </view>
    </view>

    <!-- 最近代缴 -->
    <view class="sec">
      <text class="sec__t">最近代缴</text>
      <text class="sec__x">本门店近 7 天</text>
    </view>

    <view v-if="!records.length" class="empty">
      <text class="empty__desc">本门店近 7 天没有代缴记录</text>
    </view>

    <view v-else class="records">
      <view v-for="item in records" :key="item.id" class="records__i">
        <view class="records__body">
          <text class="records__plate">{{ item.plate_no }}</text>
          <text class="records__time">{{ item.paid_at }}</text>
        </view>
        <text class="records__op">{{ item.operator }}</text>
      </view>
    </view>

    <text class="foot">同一车牌 10 分钟内重复提交需再确认一次。</text>

    <!-- 底部固定操作条 -->
    <view class="dock">
      <button
        class="btn"
        :class="{ 'btn--on': !!plate }"
        :disabled="!plate || paying"
        :loading="paying"
        @tap="doPay"
      >
        代缴停车费
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { payParking, fetchParkingRecords } from '@/api/parking'
import type { ParkingRecord } from '@/types/api'
import { ApiError } from '@/utils/error'
import { inputValue } from '@/utils/input'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const shopId = Number(router.params.shop_id || 0)
const orderId = Number(router.params.order_id || 0)

const plate = ref('')
const paying = ref(false)
const autoFocus = ref(false)
const records = ref<ParkingRecord[]>([])

const shopName = computed(
  () => auth.profile?.shops.find(s => s.id === shopId)?.name || '当前门店',
)
const shopMark = computed(() => shopName.value.slice(0, 1))

/** 统一格式：省份 + 字母 + 间隔号 + 其余，字母大写 */
const formatPlate = (raw: string) => {
  const clean = String(raw || '')
    .replace(/[·\s\-]/g, '')
    .toUpperCase()
    .slice(0, 8)
  if (clean.length <= 2) return clean
  return `${clean.slice(0, 2)}·${clean.slice(2)}`
}

const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1800 })

const focusInput = () => {
  if (!plate.value) autoFocus.value = true
}

const onPlateInput = (event: unknown) => {
  plate.value = formatPlate(inputValue(event))
}

const clearPlate = () => {
  plate.value = ''
  autoFocus.value = true
}

const loadRecords = async () => {
  try {
    const res = await fetchParkingRecords(shopId)
    records.value = res.list
  } catch {
    records.value = []
  }
}

const doPay = async () => {
  if (!plate.value || paying.value) return
  const plain = plate.value.replace('·', '')

  const confirm = await Taro.showModal({
    title: `确认代缴 ${plate.value}？`,
    content: '由门店账户代付，成功后系统自动抬杆。该操作不可撤回。',
    confirmText: '确认代缴',
    confirmColor: '#E6436E',
    cancelText: '取消',
  })
  if (!confirm.confirm) return

  paying.value = true
  try {
    const res = await payParking({
      shop_id: shopId,
      plate_no: plain,
      order_id: orderId || undefined,
    })
    tip(res.message)
    plate.value = ''
    await loadRecords()
  } catch (error) {
    if (error instanceof ApiError && error.code === 40902) {
      // 10 分钟内重复提交：再确认一次后带头提交
      const again = await Taro.showModal({
        title: '该车牌刚刚已提交过',
        content: '10 分钟内重复代缴可能造成重复扣款，确认现场车辆仍未离场后再继续。',
        confirmText: '仍要再缴',
        confirmColor: '#D93026',
      })
      if (again.confirm) {
        try {
          const res = await payParking({
            shop_id: shopId,
            plate_no: plain,
            order_id: orderId || undefined,
            confirm_again: true,
          })
          tip(res.message)
          plate.value = ''
          await loadRecords()
        } catch (inner) {
          tip(inner instanceof ApiError ? inner.message : '代缴失败')
        }
      }
    } else {
      tip(error instanceof ApiError ? error.message : '停车接口返回异常')
    }
  } finally {
    paying.value = false
  }
}

onMounted(() => {
  // 从工位车牌行 / 订单详情进入时预填，可直接代缴
  const preset = router.params.plate
  if (preset) plate.value = formatPlate(decodeURIComponent(preset))
  loadRecords()
})
</script>

<style lang="scss">
.pk {
  min-height: 100vh;
  padding: $sp-3 $page-x calc(180rpx + env(safe-area-inset-bottom));
}

/* ---------- 门店条 ---------- */
.shopbar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-radius: $r-2xl;
  background: $card;
  box-shadow: $shadow-card;
  margin-bottom: $card-gap;

  &__mark {
    width: $icon-box-sm;
    height: $icon-box-sm;
    border-radius: $r-full;
    background: $brand-soft;
    color: $brand-deep;
    font-size: $fs-caption;
    font-weight: $fw-semibold;
    line-height: $icon-box-sm;
    text-align: center;
    flex: none;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    display: block;
    font-size: $fs-title;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__meta {
    display: block;
    margin-top: 2rpx;
    font-size: $fs-micro;
    color: $ink-3;
  }

  &__tag {
    padding: 0 12rpx;
    height: 34rpx;
    line-height: 34rpx;
    border-radius: $r-xs;
    background: $fill;
    color: $ink-2;
    font-size: $fs-nano;
    flex: none;
  }
}

/* ---------- 车牌卡 ---------- */
.platecard {
  padding: 24rpx 28rpx;
  border-radius: $r-2xl;
  border: 2rpx dashed $line-3;
  background: $card;
  margin-bottom: $card-gap;

  &--filled {
    border-style: solid;
    border-color: $brand-line;
    background: $brand-soft;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__k {
    font-size: $fs-caption;
    color: $ink-3;
  }

  &__hint {
    font-size: $fs-caption;
    color: $brand-deep;
  }

  &__clear {
    font-size: $fs-caption;
    color: $ink-3;
    padding: 4rpx 8rpx;
  }

  &__input {
    margin-top: 14rpx;
    height: 72rpx;
    font-size: $fs-title;
    color: $ink;
  }

  &__ph {
    color: $ink-4;
    font-size: $fs-caption;
  }

  &__value {
    display: block;
    margin-top: 12rpx;
    font-size: 46rpx;
    font-weight: $fw-semibold;
    letter-spacing: 2rpx;
    color: $brand-deep;
  }

  &__tip {
    display: block;
    margin-top: 10rpx;
    font-size: $fs-nano;
    color: $ink-3;
  }
}

/* ---------- 说明卡 ---------- */
.card {
  @include card;
}

.kv {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18rpx 0;

  & + & {
    border-top: 1rpx solid $line;
  }

  &__k {
    font-size: $fs-caption;
    color: $ink-3;
    flex: none;
    width: 140rpx;
  }

  &__v {
    flex: 1;
    text-align: right;
    font-size: $fs-caption-sm;
    color: $ink-2;
    line-height: 1.6;
  }
}

/* ---------- 区块 ---------- */
.sec {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 32rpx 0 16rpx;

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

.empty {
  padding: 48rpx 0;
  border-radius: $r-2xl;
  background: $card;
  text-align: center;

  &__desc {
    font-size: $fs-caption;
    color: $ink-3;
  }
}

.records {
  border-radius: $r-2xl;
  background: $card;
  box-shadow: $shadow-card;
  overflow: hidden;

  &__i {
    display: flex;
    align-items: center;
    padding: 22rpx 28rpx;

    & + & {
      border-top: 1rpx solid $line;
    }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__plate {
    display: block;
    font-size: $fs-body;
    font-weight: $fw-semibold;
    color: $ink;
    letter-spacing: 1rpx;
  }

  &__time {
    display: block;
    margin-top: 2rpx;
    font-size: $fs-micro;
    color: $ink-3;
    @include tabular;
  }

  &__op {
    font-size: $fs-micro;
    color: $ink-3;
  }
}

.foot {
  display: block;
  margin: 24rpx 4rpx 0;
  font-size: $fs-nano;
  color: $ink-4;
  line-height: 1.7;
}

/* ---------- 底部固定条 ---------- */
.dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  padding: 20rpx $page-x calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.97);
  border-top: 1rpx solid $line;
}

.btn {
  width: 100%;
  height: $btn-h;
  border-radius: $r-md;
  font-size: $fs-title;
  font-weight: $fw-semibold;
  line-height: $btn-h;
  text-align: center;
  background: $fill;
  color: $ink-4;

  &--on {
    background: $brand;
    color: #FFFFFF;
  }

  &[disabled] {
    background: $fill;
    color: $ink-4;
    opacity: 0.45;
  }
}
</style>
