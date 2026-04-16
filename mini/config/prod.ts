export default {
  env: {
    TARO_APP_API_BASE_URL: '"https://api.smashmate.com/api"',
  },
  mini: {
    webpackChain(chain) {
      chain.mode('production')
    },
  },
}
