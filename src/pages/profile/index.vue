<template>
  <view class="me">
    <view class="me__card">
      <view class="me__avatar">{{ initial }}</view>
      <view class="me__info">
        <view class="me__name-row">
          <text class="me__name">{{ profile?.name || '—' }}</text>
          <text class="me__role">{{ profile?.role_text || '' }}</text>
        </view>
        <text class="me__sub">{{ shopNames }} · {{ maskedPhone }}</text>
      </view>
    </view>

    <view class="list">
      <view class="row" @tap="toggleMock">
        <text class="row__label">运行环境</text>
        <text class="row__value">{{ envText }}<text v-if="mockOn" class="row__badge">演示数据</text></text>
        <text class="row__arrow">›</text>
      </view>
      <view class="row">
        <text class="row__label">绑定时间</text>
        <text class="row__value">{{ profile?.bound_at || '—' }}</text>
      </view>
      <view class="row">
        <text class="row__label">上次登录</text>
        <text class="row__value">{{ profile?.last_login_at || '—' }}</text>
      </view>
    </view>

    <view class="list">
      <view class="list__head">
        <text class="list__title">门店范围</text>
        <text class="list__count">{{ profile?.shops?.length || 0 }} 家</text>
      </view>
      <view v-for="item in profile?.shops || []" :key="item.id" class="row">
        <text class="row__label">{{ item.name }}</text>
        <text class="row__value">{{ item.station_total }} 个工位</text>
      </view>
    </view>

    <button class="logout" @tap="handleLogout">退出登录</button>

    <view class="me__foot">
      默认门店设置 · 操作日志 · 团队与权限在后续版本开放
      <text class="me__version">v0.1.0 · 管理端</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Taro, { useDidShow } from '@tarojs/taro'
import { logout } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { isMockEnabled, setMockEnabled } from '@/mock/config'
import { clearMockBound } from '@/mock'
import { CURRENT_ENV } from '@/config/env'
import { maskPhone } from '@/utils/format'

const auth = useAuthStore()
const mockOn = ref(isMockEnabled())

const profile = computed(() => auth.profile)
const initial = computed(() => (profile.value?.name || '管').slice(0, 1))
const maskedPhone = computed(() => (profile.value?.phone ? maskPhone(profile.value.phone) : '—'))
const shopNames = computed(() => (profile.value?.shops || []).map(item => item.name).join('、') || '—')

const envText = computed(() => {
  const base = CURRENT_ENV === 'production' ? '生产环境' : CURRENT_ENV === 'pre' ? '预发环境' : '开发环境'
  return base
})

/** 演示模式下用于切换数据来源，方便对比「有后端 / 无后端」两种状态 */
const toggleMock = async () => {
  if (CURRENT_ENV === 'production') return
  const next = !mockOn.value
  setMockEnabled(next)
  mockOn.value = next
  Taro.showToast({ title: next ? '已切到演示数据' : '已切到真实接口', icon: 'none', duration: 1400 })
}

const handleLogout = async () => {
  const res = await Taro.showModal({ title: '退出登录', content: '退出后需要重新用手机号与授权码绑定。' })
  if (!res.confirm) return
  try {
    await logout()
  } catch {
    // 服务端失败也允许本地退出
  }
  clearMockBound()
  auth.reset()
  Taro.reLaunch({ url: '/pages/login/index' })
}

useDidShow(() => {
  mockOn.value = isMockEnabled()
})
</script>

<style lang="scss" scoped>
.me {
  min-height: 100vh;
  padding: $sp-3 $page-x 48rpx;

  &__card {
    @include card;
    display: flex;
    align-items: center;
    gap: 24rpx;
  }

  &__avatar {
    width: 104rpx;
    height: 104rpx;
    border-radius: $r-full;
    background: $brand-soft;
    color: $brand;
    font-size: $fs-h2;
    font-weight: $fw-semibold;
    line-height: 104rpx;
    text-align: center;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }

  &__name {
    font-size: $fs-h3;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__role {
    padding: 0 10rpx;
    height: 32rpx;
    line-height: 32rpx;
    border-radius: $r-xs;
    background: $brand-soft;
    color: $brand;
    font-size: $fs-micro;
  }

  &__sub {
    display: block;
    margin-top: 8rpx;
    font-size: $fs-caption;
    color: $ink-3;
    @include ellipsis;
  }

  &__foot {
    margin-top: 40rpx;
    text-align: center;
    font-size: $fs-caption-sm;
    color: $ink-4;
    line-height: 1.8;
  }

  &__version {
    display: block;
    margin-top: 4rpx;
    @include tabular;
  }
}

.list {
  @include card;
  padding: 4rpx $card-padding;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx 0 12rpx;
  }

  &__title {
    font-size: $fs-body;
    font-weight: $fw-medium;
    color: $ink-2;
  }

  &__count {
    font-size: $fs-caption-sm;
    color: $ink-3;
  }
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 0;
  @include press;

  & + & {
    border-top: 1rpx solid $line;
  }

  &__label {
    font-size: $fs-body;
    color: $ink;
  }

  &__value {
    font-size: $fs-body;
    color: $ink-2;
    @include tabular;
  }

  &__badge {
    margin-left: 10rpx;
    padding: 0 8rpx;
    border-radius: $r-xs;
    background: $busy-fill;
    color: $busy-ink;
    font-size: $fs-nano;
  }

  &__arrow {
    margin-left: 8rpx;
    color: $ink-4;
    font-size: $fs-body;
  }
}

.logout {
  width: 100%;
  height: $btn-h;
  margin-top: 8rpx;
  border-radius: $r-md;
  background: $card;
  border: 2rpx solid $line-2;
  color: $danger-ink;
  font-size: $fs-title;
  line-height: $btn-h;
  text-align: center;
  @include press;
}
</style>
