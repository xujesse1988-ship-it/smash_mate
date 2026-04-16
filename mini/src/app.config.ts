export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/login/index',
  ],
  tabBar: {
    color: '#999999',
    selectedColor: '#4ADE80',
    backgroundColor: '#1a1a1a',
    list: [
      { pagePath: 'pages/index/index', text: '约球' },
    ],
  },
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#141414',
    navigationBarTitleText: '羽约',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0a0a0a',
  },
})
