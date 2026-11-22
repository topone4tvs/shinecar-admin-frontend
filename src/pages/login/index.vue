<template>
  <view class="login">
    <view class="login__hero">
      <view class="login__logo">焕</view>
      <view class="login__title">焕车掌柜</view>
      <view class="login__sub">门店运维 · 管理端</view>
    </view>

    <!-- 静默进入中：冷启动的常态，页面上不出现任何需要点击的元素 -->
    <view v-if="booting" class="login__boot">
      <view class="login__spinner" />
      <text>正在进入…</text>
    </view>

    <!-- 自动登录失败（网络 / 停用 / 微信授权异常）：给一句人话和一次重试 -->
    <view v-else-if="enterError" class="login__err">
      <text class="login__err-text">{{ enterError }}</text>
      <view class="btn" @tap="boot">重新进入</view>
      <text v-if="canDemo" class="login__err-alt" @tap="enableDemo">改用演示数据 →</text>
    </view>

    <view v-else-if="step === 2" class="login__card">
      <!-- 步骤 1 已由静默授权完成，这里只做只读回显，不再有按钮 -->
      <view class="step">
        <view class="step__no step__no--done">✓</view>
        <view class="step__main">
          <view class="step__title">
            微信身份已识别
            <text class="step__badge">已授权</text>
          </view>
          <view class="step__desc">仅用于识别当前微信身份，不读取昵称、头像与手机号。</view>
        </view>
      </view>

      <!-- 步骤 2：绑定管理员账号（唯一需要用户动手的环节） -->
      <view class="step step--bind">
        <view class="step__no">2</view>
        <view class="step__main">
          <view class="step__title">绑定管理员账号</view>

          <view class="field">
            <text class="field__label">手机号</text>
            <input
              :value="phone"
              class="field__input"
              type="number"
              maxlength="11"
              placeholder="请输入 11 位手机号"
              placeholder-class="field__ph"
              @input="onPhoneInput"
            />
          </view>

          <view class="field">
            <text class="field__label">授权码</text>
            <input
              :value="authCode"
              class="field__input"
              maxlength="8"
              placeholder="8 位数字与大小写字母"
              placeholder-class="field__ph"
              @input="onCodeInput"
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

    <!-- 演示模式提示：只在需要绑定时出现（用来一键填入账号），后端就绪后自动消失 -->
    <view v-if="mockOn && step === 2" class="mock">
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
import { isMockEnabled, setMockEnabled } from '@/mock/config'
import { mockAccounts } from '@/mock'
import { CURRENT_ENV } from '@/config/env'
import { ApiError } from '@/utils/error'
import { inputValue } from '@/utils/input'

const WORKBENCH = '/pages/workbench/index'

const auth = useAuthStore()
const step = ref<1 | 2>(1)
const booting = ref(true)
const enterError = ref('')
const authorizing = ref(false)
const binding = ref(false)
const ticket = ref('')
const phone = ref('')
const authCode = ref('')

const mockOn = isMockEnabled()
const accounts = mockOn ? mockAccounts() : []
const buildStamp = __BUILD_STAMP__
const canDemo = CURRENT_ENV !== 'production'

/** 真实接口模式下的一键自救：切回演示数据并重进登录页 */
const enableDemo = () => {
  setMockEnabled(true)
  Taro.reLaunch({ url: '/pages/login/index' })
}

const tip = (title: string) => Taro.showToast({ title, icon: 'none', duration: 1800 })

const onPhoneInput = (event: unknown) => {
  phone.value = inputValue(event)
}
const onCodeInput = (event: unknown) => {
  authCode.value = inputValue(event)
}

const gotoWorkbench = () => {
  Taro.reLaunch({ url: WORKBENCH })
}

/**
 * 静默进入。冷启动与「token 失效被踢回登录页」走同一条路：
 *   1. 本地有 token 先验活（比走微信 code2Session 少一次往返）
 *   2. 验不过就直接静默授权，openid 已绑定即无感进入
 *   3. 只有 openid 没绑过账号才露出绑定表单
 */
const boot = async () => {
  if (step.value === 2) return // 用户正在填绑定表单，别打断
  booting.value = true
  enterError.value = ''

  try {
    if (auth.token) {
      try {
        const profile = await fetchProfile()
        auth.applyAuth(auth.token, profile)
        gotoWorkbench()
        return
      } catch {
        // token 过期 / 被踢下线：清掉后继续走静默授权，不在这里停下等用户点
        auth.reset()
      }
    }
    await silentEnter()
  } finally {
    booting.value = false
  }
}

/** 微信静默授权换 token；失败原因写进 enterError 由模板兜底展示 */
const silentEnter = async () => {
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
    enterError.value = error instanceof ApiError ? error.message : '网络异常，请稍后重试'
  } finally {
    authorizing.value = false
  }
}

// onMounted 与 useDidShow 在首屏都会触发，用标记保证只跑一次；
// reLaunch 回来是新实例，标记自然重置
let booted = false
const bootOnce = () => {
  if (booted) return
  booted = true
  boot()
}

onMounted(bootOnce)
useDidShow(bootOnce)

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

  // 静默进入中的占位：只留 logo + 转圈，视觉上等价于一个启动页
  &__boot {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 96rpx 0 40rpx;
    color: $ink-3;
    font-size: $fs-caption;
    letter-spacing: 1rpx;
  }

  &__spinner {
    width: 44rpx;
    height: 44rpx;
    margin-bottom: 22rpx;
    border: 4rpx solid $line;
    border-top-color: $brand;
    border-radius: 50%;
    animation: login-spin 0.75s linear infinite;
  }

  // 自动登录失败时的兜底：一句原因 + 一次重试，不弹 toast
  &__err {
    @include card;
    padding: 40rpx $card-padding;
    text-align: center;
  }

  &__err-text {
    display: block;
    margin-bottom: 28rpx;
    font-size: $fs-body;
    color: $ink-2;
    line-height: 1.7;
  }

  &__err-alt {
    display: block;
    margin-top: 24rpx;
    font-size: $fs-caption;
    color: $brand;
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

@keyframes login-spin {
  to {
    transform: rotate(360deg);
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
