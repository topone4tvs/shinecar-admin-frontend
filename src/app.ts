import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './app.scss'

const App = createApp({
  onLaunch() {
    // 登录态校验与冷启动跳转在 P0a 实现（见 docs/admin-app/04-前端技术方案.md §5）
  },
  // 入口组件不需要实现 render 方法，即使实现了也会被 taro 所覆盖
})

App.use(createPinia())

export default App
