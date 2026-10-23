<template>
  <view class="login">
    <view class="login__brand">焕车掌柜</view>
    <view class="login__sub">管理端脚手架已就绪</view>
    <view class="login__card">
      <view class="login__row">
        <text class="login__label">当前环境</text>
        <text class="login__value">{{ env }}</text>
      </view>
      <view class="login__row">
        <text class="login__label">接口基址</text>
        <text class="login__value">{{ apiBaseUrl }}</text>
      </view>
    </view>
    <view class="login__hint">登录流程（wx.login → 手机号 + 授权码绑定）在 P0a 实现</view>
  </view>
</template>

<script setup lang="ts">
import { CURRENT_ENV, getEnvConfig } from '@/config/env'

const env = CURRENT_ENV
const apiBaseUrl = getEnvConfig().apiBaseUrl + getEnvConfig().adminApiPrefix
</script>

<style lang="scss" scoped>
.login {
  min-height: 100vh;
  padding: 120px 48px 48px;
  background: $bg;

  &__brand {
    font-size: 56px;
    font-weight: 600;
    color: $ink;
    letter-spacing: 2px;
  }

  &__sub {
    margin-top: 12px;
    font-size: 28px;
    color: $ink-2;
  }

  &__card {
    margin-top: 64px;
    padding: 8px 32px;
    border-radius: 24px;
    background: $card;
    border: 1px solid $line;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 0;
    font-size: 26px;

    & + & {
      border-top: 1px solid $line;
    }
  }

  &__label {
    color: $ink-2;
  }

  &__value {
    color: $ink;
    font-weight: 500;
  }

  &__hint {
    margin-top: 32px;
    font-size: 24px;
    color: $ink-3;
    line-height: 1.6;
  }
}
</style>
