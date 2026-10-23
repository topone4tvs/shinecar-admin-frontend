# shinecar-admin-frontend · 焕车掌柜

管理端小程序（独立 appid `wx4cb45f57b38380a7`，与 C 端「焕车生活」完全独立）。

技术栈与 C 端保持一致：**Taro 4.0.9 + Vue 3 + TypeScript + Sass + Pinia + webpack5**，不引入 UI 组件库。

## 快速开始

```bash
nvm use            # Node 22.14.0
yarn install
yarn dev:weapp     # 开发（连本地后端 http://127.0.0.1:8989）
yarn dev:weapp:pre # 开发（连预发 https://pre-api.shinecar.club）
```

然后用微信开发者工具导入本目录（`miniprogramRoot` 为 `dist/`），appid 已在 `project.config.json` 中写死。

生产构建：

```bash
yarn build:weapp
```

> **构建口径别搞错。** `build:weapp` 是 production 构建，mock 在其中**强制关闭**，登录会真的去请求
> `https://api.shinecar.club/admin/v1/auth/wx-login`——后端还没这条路由，必然 404。
> 只想看界面就用 **`yarn build:demo`**（等价于 development 环境 + mock 开启，请求不发网络）。

## 环境

| 环境 | 触发方式 | API 基址 |
|---|---|---|
| development | `yarn dev:weapp` | `http://127.0.0.1:8989` |
| pre | `TARO_APP_ENV=pre` | `https://pre-api.shinecar.club` |
| production | 默认 `build`（NODE_ENV=production） | `https://api.shinecar.club` |

环境在**构建期**确定（`src/config/env.ts`），无运行时切换。管理端接口一律带 `/admin/v1` 前缀，C 端接口不带，两者不共用 DTO。

## 演示模式（后端未接入时）

后端 `/admin/v1` 尚未实现，`development` / `pre` 默认开启内置 mock：请求不发出网络，由 `src/mock/` 按同一接口契约返回示例数据，`production` 恒关闭。

| 项 | 说明 |
|---|---|
| 超管 | `13800138000` / `K7mQ2xRb`（全部门店） |
| 门店管理员 | `13900139000` / `Wx9Tn4pC`（仅城西科技园店） |
| 覆盖范围 | 登录绑定、切店、工位状态与维护、设备命令、订单搜索与详情、整洁奖励审核、退出登录 |
| 开关 | `src/config/env.ts` 的 `enableMock`；运行时在「我的 → 运行环境」可一键切换 |
| 关闭后 | 自动走真实接口，页面与 `api/` 层零改动 |

mock 与真实接口共用 `src/utils/request.ts`，只有一处分支（`request()` 开头的 `isMockEnabled()`），后端就绪时删掉该分支即可。

**前端已经按契约写好的 14 条管理端接口，后端目前一条都没有实现**（属于 P0a–P4 交付物，设计见 `docs/admin-app/03-后端技术方案.md`）：

| 分组 | 路径 |
|---|---|
| 登录 | `POST /auth/wx-login`、`POST /auth/bind`、`POST /auth/logout`、`GET /auth/profile` |
| 门店与工位 | `GET /shops`、`GET /shops/:id/stations`、`GET /shops/:id/capabilities` |
| 设备 | `POST /stations/:id/commands`、`PATCH /stations/:id/maintenance` |
| 订单 | `GET /orders`、`GET /orders/:id` |
| 审核 | `GET /reviews`、`POST /reviews/:id/approve`、`POST /reviews/:id/reject` |
| 用户 | `GET /users/:id` |

真实接口模式下打开登录页，页面会显式提示「该路由由后端 P0a 提供，尚未上线」，并给一个切回演示数据的入口；`request()` 在 404 且响应不是统一信封时，报错文案是「接口不存在：`POST /admin/v1/auth/wx-login`——后端尚未实现该路由」，不会再含糊成「请求失败」。

### 真机预览（不需要认证、不需要配域名）

1. `yarn dev:weapp`
2. 微信开发者工具导入本目录（`miniprogramRoot` 为 `dist/`）
3. 点「预览」，弹窗询问是否校验合法域名时选 **不校验**
4. 手机扫码打开

演示模式不发起网络请求，所以**认证、备案、类目、服务器域名、体验成员都不会阻塞预览**。只在需要连真实后端时，才要去 mp 后台配置 `request` 合法域名。

### 关于预览，两个必读

**① `dist/` 是 git 忽略的产物，切分支不会自动更新。** 从 trace 工作区或旧分支打开项目时，`dist/` 可能还是切换前的代码，开发者工具里就会看到上一个版本（典型症状：登录页只剩「焕车掌柜 / 管理端脚手架已就绪 / 当前环境 / 接口基址」几行字）。**换目录或换分支后，必须先 `yarn dev:weapp` 重新构建，再在开发者工具里点「编译」。**

**② 用 `sc_workspace/preview/shinecar_admin_frontend` 作为固定入口。** 那是个壳目录，
里面的 `dist/` 由 `bin/wtm appdev` 从当前 trace 同步过来；换需求只要 `bin/wtm appdev use <trace>`，
不用重新导入项目。主仓库与各 trace 自己的 `dist/` 都别再单独开进工具，否则一定会看错版本。
注意微信开发者工具**不跟随软链**（`miniprogramRoot` 指向软链会报「未找到 app.json」），
所以壳目录里的 `dist` 必须是真实拷贝，不能是软链。

正确版本的登录页首屏应包含：粉红圆角「焕」字标 → 大标题「焕车掌柜」→ 副标题「门店运维 · 管理端」→ 白色卡片（步骤 1「微信授权登录」+ 粉红按钮「微信一键授权」）。

## 目录

```
config/                 Taro 构建配置（dev / prod / sass 变量注入）
docs/
  admin-app/            方案五件套（产品 / UI / 后端 / 前端 / 验收）
  admin-app-ui-demo.html  9 屏可点原型
  logo/                 小程序图标与 logo 源文件
  admin-seed.md         首个超管账号与 seed 参数
src/
  config/env.ts         环境与接口前缀
  utils/request.ts      统一请求（Bearer / 幂等键 / 401 处理 / GET 重试 / mock 分支）
  utils/error.ts        ApiError
  utils/format.ts       时长 / 金额 / 时间格式化
  utils/input.ts        表单取值（避开 Taro v-model 的坑）
  utils/token.ts        admin_token 读写
  api/                  接口封装，按域拆分
  mock/                 无后端时的示例数据与路由分发（production 不生效）
  stores/               Pinia（auth / shop / capability / app）
  styles/tokens.scss    设计变量（构建期全局注入，页面禁止写十六进制色值）
  pages/                登录 + 四个 tab（现场 / 查询 / 审核 / 我的）
  packageStation/       工位详情、停车缴费
  packageOrder/         订单详情
  packageUser/          用户详情
```

## 三条硬约束

1. **进行中订单不展示金额**：金额需要 `CalculateFee`，它会消耗用户当日免费停车机会，属于写操作。
2. **前端只认 `route`，不认 `key`**：能力配置下发什么 `route` 就调什么接口，不在前端硬编码 action → 接口的映射。
3. **所有写操作带 `Idempotency-Key`**：按钮重试复用同一个 key，用户重新点击换新 key。

## 样式约定（踩过坑）

**SFC 样式一律不要写 `scoped`。**

Taro 4 的小程序渲染器没有实现 Vue 的 `setScopeId`，元素上永远不会带 `data-v-xxx` 属性，
而 `scoped` 会把样式编译成 `.login[data-v-2eca67d6]{...}`，**选择器全部失配 → 页面有文字、零样式**。
微信小程序本身按页面隔离 WXSS，`scoped` 并不必要；跨文件复用靠 BEM 前缀（`.login` `.step` `.mock` 等）区分。

另：控制台的 `[渲染层错误] Listener added for a 'DOMNodeRemoved' mutation event...` 是开发者工具渲染层的兼容性提示，
与本项目代码无关，不影响渲染，忽略即可。

## 表单取值（踩过坑）

**不要用 `v-model` 绑 `<input>`，一律 `:value` + `@input` + `inputValue()`。**

Taro 4 在微信端给 `v-model` 绑定的 ref 赋的**不是字符串，而是输入事件对象**，
于是 `phone.value.trim()` 直接抛 `TypeError: xxx.trim is not a function`（登录页实测，
点「登录」必崩；但输入框本身的显示是正常的，很容易误判成绑定没生效）。

```vue
<input :value="phone" type="number" maxlength="11" @input="onPhoneInput" />
```

```ts
import { inputValue } from '@/utils/input'

const onPhoneInput = (event: unknown) => {
  phone.value = inputValue(event)
}
```

`inputValue()` 兼容「事件对象 / `detail.value` / `target.value`」三种形态，
并把 `type="number"` 可能给出的数字统一转成字符串，保证后续 `.trim()`、正则安全。

C 端项目里也用了 `v-model`，但那边从没对值调用过 `.trim()`，所以问题一直没暴露——不代表这写法可用。

## 文档

- 方案总览：[docs/admin-app/README.md](docs/admin-app/README.md)
- UI 规范：[docs/admin-app/02-UI设计规范.md](docs/admin-app/02-UI设计规范.md)
- 后端契约：[docs/admin-app/03-后端技术方案.md](docs/admin-app/03-后端技术方案.md)
- 验收用例：[docs/admin-app/05-实施与验收.md](docs/admin-app/05-实施与验收.md)
