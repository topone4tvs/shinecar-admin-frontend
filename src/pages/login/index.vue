<template>
  <view class="login">
    <view class="login__hero">
      <view class="login__logo">焕</view>
      <view class="login__title">焕车掌柜</view>
      <view class="login__sub">门店运维 · 管理端</view>
    </view>

    <view class="login__card">
      <!-- 步骤 1：微信身份 -->
      <view class="step">
        <view class="step__no" :class="{ 'step__no--done': step === 2 }">{{ step === 2 ? '✓' : '1' }}</view>
        <view class="step__main">
          <view class="step__title">
            微信授权登录
            <text v-if="step === 2" class="step__badge">已授权</text>
          </view>
          <view class="step__desc">仅用于识别当前微信身份，不读取昵称、头像与手机号。</view>
          <button v-if="step === 1" class="btn" :loading="authorizing" :disabled="authorizing" @tap="handleWxAuth">
            微信一键授权
          </button>
        </view>
      </view>

      <!-- 步骤 2：绑定管理员账号 -->
      <view v-if="step === 2" class="step step--bind">
        <view class="step__no">2</view>
        <view class="step__main">
          <view class="step__title">绑定管理员账号</view>

          <view class="field">
            <text class="field__label">手机号</text>
            <input
              v-model="phone"
              class="field__input"
              type="number"
              maxlength="11"
              placeholder="请输入 11 位手机号"
              placeholder-class="field__ph"
            />
          </view>

          <view class="field">
            <text class="field__label">授权码</text>
            <input
              v-model="authCode"
              class="field__input"
              maxlength="8"
              placeholder="8 位数字与大小写字母"
              placeholder-class="field__ph"
            />
          </view>

          <button class="btn" :loading="binding" :disabled="binding" @tap="handleBind">登录</button>

          <view class="step__hint">
            授权码由总部在后台创建账号时生成，8 位数字与大小写字母组合，首次绑定后失效。
          </view>
        </view>
      </view>
    </view>

    <view class="login__foot">
      仅限已开通权限的门店员工与加盟商管理员
      <text class="login__foot-line">账号问题请联系总部运营</text>
      <text class="login__stamp">构建 {{ buildStamp }}</text>
    </view>

    <!-- 演示模式提示：仅 mock 开启时出现，后端就绪后自动消失 -->
    <view v-if="mockOn" class="mock">
      <view class="mock__tag">演示模式</view>
      <view class="mock__desc">当前未连接后端，界面与交互使用内置示例数据。点账号可一键填入。</view>
      <view v-for="item in accounts" :key="item.phone" class="mock__row" @tap="fill(item.phone, item.code)">
        <view class="mock__left">
          <text class="mock__name">{{ item.name }}</text>
          <text class="mock__role">{{ item.role }}</text>
        </view>
        <view class="mock__right">
          <text class="mock__phone">{{ item.phone }}</text>
          <text class="mock__code">{{ item.code }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Taro, { useDidShow } from '@tarojs/taro'
import { bind, fetchProfile, wxLogin } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { isMockEnabled } from '@/mock/config'
import { mockAccounts } from '@/mock'
import { ApiError } from '@/utils/error'

const WORKBENCH = '/pages/workbench/index'

const auth = useAuthStore()
const step = ref<1 | 2>(1)
const authorizing = ref(false)
const binding = ref(false)
const ticket = ref('')
const phone = ref('')
const authCode = ref('')

const mockOn = isMockEnabled()
const accounts = mockOn ? mockAccounts() : []
const buildStamp = __BUILD_STAMP__

const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1800 })

const gotoWorkbench = () => {
  Taro.reLaunch({ url: WORKBENCH })
}

/** 已有登录态：直接校验并进入现场 */
const tryResume = async () => {
  if (!auth.token) return
  try {
    const profile = await fetchProfile()
    auth.applyAuth(auth.token, profile)
    gotoWorkbench()
  } catch {
    // token 失效，停在登录页重新授权
    auth.reset()
  }
}

onMounted(tryResume)
useDidShow(tryResume)

const handleWxAuth = async () => {
  if (authorizing.value) return
  authorizing.value = true
  try {
    let code = ''
    try {
      const res = await Taro.login()
      code = res.code
    } catch {
      // 微信授权失败（极少见）；演示模式下用占位 code 继续，保证界面可走查
      if (!mockOn) throw new ApiError(-1, '微信授权失败，请重试')
    }

    const resp = await wxLogin(code || 'mock-code')
    if (resp.need_bind) {
      if (!resp.ticket) throw new ApiError(-1, '绑定凭证获取失败，请重试')
      ticket.value = resp.ticket
      step.value = 2
      return
    }
    if (!resp.token) throw new ApiError(-1, '登录失败，请重试')
    auth.applyAuth(resp.token, resp.profile)
    gotoWorkbench()
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '网络异常，请稍后重试')
  } finally {
    authorizing.value = false
  }
}

const handleBind = async () => {
  if (binding.value) return
  if (!/^1\d{10}$/.test(phone.value.trim())) {
    tip('请输入 11 位手机号')
    return
  }
  if (!/^[A-Za-z0-9]{8}$/.test(authCode.value.trim())) {
    tip('授权码为 8 位数字与字母组合')
    return
  }

  binding.value = true
  try {
    const resp = await bind({ ticket: ticket.value, phone: phone.value.trim(), auth_code: authCode.value.trim() })
    auth.applyAuth(resp.token, resp.profile)
    Taro.showToast({ title: '绑定成功', icon: 'success', duration: 800 })
    setTimeout(gotoWorkbench, 500)
  } catch (error) {
    tip(error instanceof ApiError ? error.message : '网络异常，请稍后重试')
  } finally {
    binding.value = false
  }
}

const fill = (nextPhone: string, nextCode: string) => {
  phone.value = nextPhone
  authCode.value = nextCode
}
</script>

<style lang="scss">
.login {
  min-height: 100vh;
  padding: 120rpx $page-x 64rpx;
  background: linear-gradient(180deg, $brand-soft 0%, $bg 420rpx);

  &__hero {
    text-align: center;
    margin-bottom: 56rpx;
  }

  &__logo {
    width: 120rpx;
    height: 120rpx;
    margin: 0 auto 24rpx;
    border-radius: 36rpx;
    background: $brand;
    color: $card;
    font-size: 56rpx;
    font-weight: $fw-semibold;
    line-height: 120rpx;
    text-align: center;
    box-shadow: 0 12rpx 32rpx rgba(230, 67, 110, 0.28);
  }

  &__title {
    font-size: 52rpx;
    font-weight: $fw-semibold;
    color: $ink;
    letter-spacing: 2rpx;
  }

  &__sub {
    margin-top: 10rpx;
    font-size: $fs-body;
    color: $ink-2;
  }

  &__card {
    @include card;
    padding: 8rpx $card-padding;
  }

  &__foot {
    margin-top: 40rpx;
    text-align: center;
    font-size: $fs-caption;
    color: $ink-3;
    line-height: 1.8;
  }

  &__foot-line {
    display: block;
    color: $ink-4;
  }

  // 构建戳：用来确认开发者工具里跑的是哪份产物，不可点、不抢视觉
  &__stamp {
    display: block;
    margin-top: 8rpx;
    font-size: $fs-caption;
    color: $ink-4;
    opacity: 0.7;
  }
}

.step {
  display: flex;
  gap: 20rpx;
  padding: 32rpx 0;

  & + & {
    border-top: 1rpx solid $line;
  }

  &__no {
    flex: none;
    width: 44rpx;
    height: 44rpx;
    margin-top: 4rpx;
    border-radius: $r-full;
    background: $fill;
    color: $ink-2;
    font-size: $fs-caption;
    font-weight: $fw-semibold;
    line-height: 44rpx;
    text-align: center;

    &--done {
      background: $idle-fill;
      color: $idle-ink;
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: flex;
    align-items: center;
    font-size: $fs-title;
    font-weight: $fw-semibold;
    color: $ink;
  }

  &__badge {
    margin-left: 12rpx;
    padding: 0 12rpx;
    height: 34rpx;
    line-height: 34rpx;
    border-radius: $r-xs;
    background: $idle-fill;
    color: $idle-ink;
    font-size: $fs-micro;
    font-weight: $fw-medium;
  }

  &__desc {
    margin-top: 10rpx;
    font-size: $fs-caption;
    color: $ink-3;
    line-height: 1.6;
  }

  &__hint {
    margin-top: 20rpx;
    font-size: $fs-caption-sm;
    color: $ink-3;
    line-height: 1.7;
  }
}

.step--bind .step__title {
  margin-bottom: 24rpx;
}

.field {
  display: flex;
  align-items: center;
  height: $input-h;
  padding: 0 24rpx;
  margin-bottom: 20rpx;
  border: $border-input;
  border-radius: $r-md;
  background: $fill-2;

  &__label {
    flex: none;
    width: 120rpx;
    font-size: $fs-body;
    color: $ink-2;
  }

  &__input {
    flex: 1;
    height: 100%;
    font-size: $fs-title;
    color: $ink;
  }

  &__ph {
    color: $ink-4;
    font-size: $fs-body;
  }
}

.btn {
  width: 100%;
  height: $btn-h;
  margin-top: 8rpx;
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
    color: $card;
  }
}

.mock {
  margin-top: 48rpx;
  padding: 24rpx;
  border: $border-dashed;
  border-radius: $r-lg;
  background: $fill-2;

  &__tag {
    display: inline-block;
    padding: 0 12rpx;
    height: 34rpx;
    line-height: 34rpx;
    border-radius: $r-xs;
    background: $busy-fill;
    color: $busy-ink;
    font-size: $fs-micro;
    font-weight: $fw-medium;
  }

  &__desc {
    margin: 12rpx 0 8rpx;
    font-size: $fs-caption-sm;
    color: $ink-3;
    line-height: 1.6;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18rpx 0;
    @include press;

    & + & {
      border-top: 1rpx solid $line;
    }
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }

  &__name {
    font-size: $fs-body;
    color: $ink;
    font-weight: $fw-medium;
  }

  &__role {
    font-size: $fs-micro;
    color: $ink-3;
  }

  &__right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  &__phone {
    font-size: $fs-caption;
    color: $ink-2;
    @include tabular;
  }

  &__code {
    font-size: $fs-caption-sm;
    color: $brand;
    font-family: $font-mono;
  }
}
</style>
