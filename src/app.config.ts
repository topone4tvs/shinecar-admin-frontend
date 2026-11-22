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
    { root: 'packageOrder', pages: ['pages/detail/index'] },
    { root: 'packageUser', pages: ['pages/detail/index'] },
  ],
  // 原生 tabBar；81×81 透明底线性图标，普通态 #9AA1A9 / 选中态 #E6436E（见 assets/tab/）
  tabBar: {
    color: '#9AA1A9',
    selectedColor: '#E6436E',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/workbench/index',
        text: '现场',
        iconPath: 'assets/tab/workbench.png',
        selectedIconPath: 'assets/tab/workbench_active.png',
      },
      {
        pagePath: 'pages/query/index',
        text: '查询',
        iconPath: 'assets/tab/query.png',
        selectedIconPath: 'assets/tab/query_active.png',
      },
      {
        pagePath: 'pages/review/index',
        text: '审核',
        iconPath: 'assets/tab/review.png',
        selectedIconPath: 'assets/tab/review_active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab/profile.png',
        selectedIconPath: 'assets/tab/profile_active.png',
      },
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
