<template>
  <view class="page">
    <view class="page__title">停车缴费</view>
    <view class="page__desc">车牌录入 + 代缴待实现（P1.5）。注意：只缴不查，不请求金额</view>
  </view>
</template>

<script setup lang="ts"></script>

<style lang="scss">
.page {
  min-height: 100vh;
  padding: 48px;

  &__title {
    font-size: 44px;
    font-weight: 600;
    color: $ink;
  }

  &__desc {
    margin-top: 16px;
    font-size: 26px;
    color: $ink-3;
    line-height: 1.6;
  }
}
</style>
