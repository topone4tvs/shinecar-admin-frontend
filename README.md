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

### 真机预览（不需要认证、不需要配域名）

1. `yarn dev:weapp`
2. 微信开发者工具导入本目录（`miniprogramRoot` 为 `dist/`）
3. 点「预览」，弹窗询问是否校验合法域名时选 **不校验**
4. 手机扫码打开

演示模式不发起网络请求，所以**认证、备案、类目、服务器域名、体验成员都不会阻塞预览**。只在需要连真实后端时，才要去 mp 后台配置 `request` 合法域名。

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

## 文档

- 方案总览：[docs/admin-app/README.md](docs/admin-app/README.md)
- UI 规范：[docs/admin-app/02-UI设计规范.md](docs/admin-app/02-UI设计规范.md)
- 后端契约：[docs/admin-app/03-后端技术方案.md](docs/admin-app/03-后端技术方案.md)
- 验收用例：[docs/admin-app/05-实施与验收.md](docs/admin-app/05-实施与验收.md)
