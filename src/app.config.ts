export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/workbench/index',
    'pages/query/index',
    'pages/review/index',
    'pages/profile/index',
  ],
  subPackages: [
    { root: 'packageStation', pages: ['pages/station-detail/index', 'pages/parking/index'] },
    { root: 'packageOrder', pages: ['pages/detail/index', 'pages/create/index'] },
    { root: 'packageUser', pages: ['pages/detail/index'] },
  ],
  // 原生 tabBar；图标（assets/tab/*.png）在 P1 补齐，未配 iconPath 时微信仅显示文字
  tabBar: {
    color: '#9AA1A9',
    selectedColor: '#E6436E',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/workbench/index', text: '现场' },
      { pagePath: 'pages/query/index', text: '查询' },
      { pagePath: 'pages/review/index', text: '审核' },
      { pagePath: 'pages/profile/index', text: '我的' },
    ],
  },
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#F7F8FA',
    navigationBarTitleText: '焕车掌柜',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F7F8FA',
  },
  lazyCodeLoading: 'requiredComponents',
})
