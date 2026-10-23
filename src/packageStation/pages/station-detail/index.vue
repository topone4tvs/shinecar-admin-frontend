<template>
  <view class="page">
    <view class="page__title">工位详情</view>
    <view class="page__desc">工位状态、进行中订单、能力面板待实现（P2）</view>
  </view>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
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
