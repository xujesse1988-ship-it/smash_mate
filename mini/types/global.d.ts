/// <reference types="@tarojs/taro" />

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare namespace NodeJS {
  interface ProcessEnv {
    TARO_APP_API_BASE_URL: string
  }
}
