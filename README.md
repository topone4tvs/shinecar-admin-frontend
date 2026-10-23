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
  utils/request.ts      统一请求（Bearer / 幂等键 / 401 处理 / GET 重试）
  utils/token.ts        admin_token 读写
  api/                  接口封装，按域拆分
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
