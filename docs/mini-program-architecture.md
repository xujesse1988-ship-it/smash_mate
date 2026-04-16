# 微信小程序端（Taro）架构设计

## 一、技术选型

| 层面 | 选型 | 版本 | 理由 |
|---|---|---|---|
| 跨端框架 | **Taro 4.x** | ^4.0 | React 语法，团队零切换成本；支持微信/支付宝/H5 多端编译 |
| UI 框架 | **NutUI-React** | ^3.0 | 京东出品，Taro 官方推荐，组件覆盖全且适配小程序 |
| 状态管理 | **Zustand** | ^5.0 | 与 Web 端一致，API 完全相同，可直接复用 store 设计 |
| 请求管理 | **TanStack Query (React Query)** | ^5.0 | 与 Web 端一致，缓存/重试/乐观更新策略可复用 |
| 网络请求 | **Taro.request** 封装 | — | 小程序不支持 fetch/XMLHttpRequest，必须用 Taro API |
| 类型系统 | **TypeScript** | ^5.0 | 全栈一致 |
| CSS 方案 | **CSS Modules + px→rpx** | — | Taro 内置转换，NutUI 配合良好 |

## 二、项目结构

```
mini/                              # 小程序独立目录（与 web/ 平级）
├── project.config.json            # 微信开发者工具配置
├── config/
│   ├── index.ts                   # Taro 构建配置入口
│   ├── dev.ts                     # 开发环境配置
│   └── prod.ts                    # 生产环境配置
├── src/
│   ├── app.ts                     # 入口文件（全局生命周期、QueryClient 初始化）
│   ├── app.config.ts              # 全局配置（pages、tabBar、window）
│   ├── app.scss                   # 全局样式
│   │
│   ├── apis/                      # 统一 API 层
│   │   ├── client.ts              # 请求封装（Taro.request + 拦截器）
│   │   ├── auth.ts                # 认证相关 API
│   │   ├── activity.ts            # 约球 API
│   │   ├── coaching.ts            # 教练/课程 API
│   │   ├── match-record.ts        # 战绩 API
│   │   ├── venue.ts               # 场馆 API
│   │   ├── notification.ts        # 通知 API
│   │   ├── review.ts              # 评价 API
│   │   ├── user.ts                # 用户 API
│   │   └── types.ts               # 共享 API 类型（响应 envelope、分页等）
│   │
│   ├── stores/                    # Zustand 状态
│   │   └── auth-store.ts          # 认证状态（token、userId、coachMode）
│   │
│   ├── hooks/                     # 全局 hooks
│   │   ├── use-auth.ts            # 认证相关 hook
│   │   ├── use-location.ts        # 位置获取（wx.getLocation 封装）
│   │   └── use-login-check.ts     # 页面级登录态守卫
│   │
│   ├── shared/                    # 共享组件
│   │   ├── Empty.tsx              # 空状态
│   │   ├── LoadMore.tsx           # 加载更多/上拉加载
│   │   ├── Avatar.tsx             # 头像组件
│   │   ├── StatusTag.tsx          # 状态标签
│   │   └── VenueCard.tsx          # 场馆卡片
│   │
│   ├── pages/                     # 页面（小程序页面必须在此目录）
│   │   ├── index/                 # 首页（TabBar 页 - 约球列表）
│   │   │   ├── index.tsx
│   │   │   ├── index.config.ts
│   │   │   └── index.module.scss
│   │   ├── login/                 # 登录页
│   │   ├── activity-detail/       # 活动详情
│   │   ├── activity-create/       # 发起约球
│   │   ├── coach-list/            # 教练列表
│   │   ├── coach-detail/          # 教练主页
│   │   ├── group-class-detail/    # 团课详情
│   │   ├── private-lesson-detail/ # 私教详情
│   │   ├── match-record-create/   # 记录战绩
│   │   ├── match-record-list/     # 战绩历史
│   │   ├── notification-list/     # 通知列表
│   │   ├── profile/               # 个人主页（TabBar 页）
│   │   ├── profile-edit/          # 资料编辑
│   │   ├── settings/              # 设置
│   │   └── user-profile/         # 他人主页
│   │
│   └── utils/                     # 工具函数
│       ├── storage.ts             # Taro.getStorageSync 封装
│       ├── navigate.ts            # 导航封装
│       ├── format.ts              # 日期/手机号格式化
│       └── constants.ts           # 常量
│
├── types/                         # 全局类型声明
│   └── global.d.ts
├── tsconfig.json
├── babel.config.js
└── package.json
```

## 三、全局配置与 TabBar

```typescript
// src/app.config.ts
export default defineAppConfig({
  pages: [
    'pages/index/index',            // 约球（首页）
    'pages/coach-list/index',       // 教练
    'pages/notification-list/index',// 消息
    'pages/profile/index',          // 我的
    'pages/login/index',
    'pages/activity-detail/index',
    'pages/activity-create/index',
    // ... 其他非 tab 页面
  ],
  tabBar: {
    color: '#999999',
    selectedColor: '#4ADE80',       // 与 Web 端主色一致
    backgroundColor: '#1a1a1a',     // 暗色主题
    list: [
      { pagePath: 'pages/index/index',             text: '约球',  iconPath: '...', selectedIconPath: '...' },
      { pagePath: 'pages/coach-list/index',        text: '教练',  iconPath: '...', selectedIconPath: '...' },
      { pagePath: 'pages/notification-list/index', text: '消息',  iconPath: '...', selectedIconPath: '...' },
      { pagePath: 'pages/profile/index',           text: '我的',  iconPath: '...', selectedIconPath: '...' },
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
```

## 四、认证架构

小程序端支持两种登录方式，与后端用户体系打通。

### 4.1 登录流程

```
┌──────────────────────────────────────────────────────────┐
│                    小程序登录流程                          │
│                                                          │
│   ┌─────────┐     ┌──────────┐     ┌───────────────┐    │
│   │ 首次进入 │────→│ 登录页   │────→│ 手机号登录     │    │
│   └─────────┘     └──────────┘     │ (短信验证码)   │    │
│                        │           └───────┬───────┘    │
│                        │                   │             │
│                        ▼                   ▼             │
│                   ┌──────────┐     ┌───────────────┐    │
│                   │ 微信快捷  │     │ POST           │    │
│                   │ 手机号登录│     │ /auth/login    │    │
│                   └────┬─────┘     └───────┬───────┘    │
│                        │                   │             │
│                        ▼                   │             │
│                   ┌──────────────┐         │             │
│                   │ wx.login()   │         │             │
│                   │ 获取 code    │         │             │
│                   │      +       │         │             │
│                   │ 获取加密手机 │         │             │
│                   └──────┬───────┘         │             │
│                          ▼                 │             │
│                   ┌──────────────┐         │             │
│                   │ POST         │         │             │
│                   │ /auth/       │         │             │
│                   │ wx-login     │         │             │
│                   │ (新接口)     │         │             │
│                   └──────┬───────┘         │             │
│                          │                 │             │
│                          ▼                 ▼             │
│                   ┌──────────────────────────┐          │
│                   │ 返回 JWT token           │          │
│                   │ 存入 Taro.setStorageSync │          │
│                   └──────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

**两种登录方式并存：**

1. **手机号 + 短信验证码**（与 Web 端完全一致）
   - 复用现有 `POST /api/auth/send-code` + `POST /api/auth/login`
   - 作为兜底方式，保证用户一定能登录

2. **微信快捷手机号登录**（新增，小程序专属）
   - 用户点击授权按钮 → 获取加密手机号 → 连同 `wx.login()` 的 code 发给后端
   - 后端新增 `POST /api/auth/wx-login` 接口，解密获取真实手机号，走同样的注册/登录逻辑
   - 用户体验更好（一键授权，无需手动输入）

### 4.2 后端新增接口

```typescript
// POST /api/auth/wx-login
// 请求体
{
  code: string          // wx.login() 返回的 code
  encryptedData: string // 加密的手机号数据（button getPhoneNumber 返回）
  iv: string            // 加密向量
  isCoach?: boolean     // 可选，是否教练身份
}

// 响应（与现有 /auth/login 一致）
{
  data: {
    token: string
    user: { id, nickname, avatarUrl, phone, isCoach }
    isNewUser: boolean
  }
}
```

**后端实现要点：**
- 用 code 调用微信 `code2Session` 接口获取 `session_key`
- 用 `session_key` 解密 `encryptedData` 获取手机号
- 拿到手机号后走与现有 `login()` 相同的逻辑（查找/创建用户 → 签发 JWT）
- 需要配置 `WX_APP_ID` 和 `WX_APP_SECRET` 环境变量

### 4.3 Auth Store（小程序端）

```typescript
// mini/src/stores/auth-store.ts
import Taro from '@tarojs/taro'
import { create } from 'zustand'

interface AuthState {
  token: string | null
  userId: string | null
  isLoggedIn: boolean
  coachMode: boolean
  setAuth: (token: string, userId: string) => void
  clearAuth: () => void
  setCoachMode: (enabled: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  // 启动时从 Storage 恢复
  token: Taro.getStorageSync('token') || null,
  userId: Taro.getStorageSync('userId') || null,
  isLoggedIn: !!Taro.getStorageSync('token'),
  coachMode: Taro.getStorageSync('coachMode') === 'true',

  setAuth: (token, userId) => {
    Taro.setStorageSync('token', token)
    Taro.setStorageSync('userId', userId)
    set({ token, userId, isLoggedIn: true })
  },

  clearAuth: () => {
    Taro.removeStorageSync('token')
    Taro.removeStorageSync('userId')
    set({ token: null, userId: null, isLoggedIn: false })
  },

  setCoachMode: (enabled) => {
    Taro.setStorageSync('coachMode', String(enabled))
    set({ coachMode: enabled })
  },
}))
```

## 五、网络请求层

```typescript
// mini/src/apis/client.ts
import Taro from '@tarojs/taro'
import { useAuthStore } from '../stores/auth-store'

const BASE_URL = process.env.TARO_APP_API_BASE_URL || 'https://api.smashmate.com'

interface ApiResponse<T> {
  data: T
}

interface ApiError {
  statusCode: number
  code: string
  message: string
}

/** 统一请求封装 */
export async function request<T>(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  needAuth?: boolean  // 默认 true
}): Promise<T> {
  const { url, method = 'GET', data, needAuth = true } = options
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (needAuth) {
    const token = useAuthStore.getState().token
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }
  }

  const response = await Taro.request({
    url: `${BASE_URL}${url}`,
    method,
    data,
    header,
  })

  // 401 → 清除登录态，跳转登录页
  if (response.statusCode === 401) {
    useAuthStore.getState().clearAuth()
    Taro.redirectTo({ url: '/pages/login/index' })
    throw new ApiRequestError('AUTH_REQUIRED', '请重新登录')
  }

  // 其他错误
  if (response.statusCode >= 400) {
    const err = response.data as ApiError
    throw new ApiRequestError(err.code, err.message)
  }

  // 成功：解包 { data: T }
  return (response.data as ApiResponse<T>).data
}

export class ApiRequestError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
```

### 与 Web 端的差异点

| 对比项 | Web 端 | 小程序端 |
|---|---|---|
| 网络请求 | `fetch()` | `Taro.request()` |
| 基础 URL | Vite proxy `/api` | 完整域名 `https://api.smashmate.com/api` |
| Token 存储 | `localStorage` | `Taro.getStorageSync` |
| 401 处理 | `window.location = '/login'` | `Taro.redirectTo({ url: '/pages/login/index' })` |
| 文件上传 | `FormData` + `fetch` | `Taro.uploadFile()` |

## 六、与 Web 端的代码复用策略

```
复用程度从高到低：

直接复用（不改代码）
├── Zustand store 设计模式（接口相同，存储层替换为 Taro Storage）
├── TanStack Query 的 queryKey 设计和缓存策略
├── API 类型定义（请求/响应 interface）
└── 工具函数（日期格式化、手机号掩码等纯逻辑）

模式复用（相同结构，不同实现）
├── API 调用函数（fetch → Taro.request，URL 拼接方式不同）
├── 认证流程（增加微信登录路径）
├── 位置获取（navigator.geolocation → wx.getLocation）
└── 图片上传（FormData → Taro.uploadFile + Taro.chooseImage）

不能复用（需要重写）
├── UI 组件（Ant Design → NutUI-React）
├── 路由（React Router → Taro 原生页面路由）
├── 页面布局（AppLayout → 小程序 tabBar + navigationBar）
└── 样式（CSS → CSS Modules + rpx 适配）
```

**不做 monorepo 共享包。** 原因：
- 共享的主要是类型定义和工具函数，代码量小，复制维护成本低于抽包成本
- 小程序构建链路（Taro CLI）和 Web（Vite）完全不同，强行共享会增加构建复杂度
- 后续如果 API 类型偏差增大（小程序独有接口），独立维护更灵活

## 七、页面与功能模块映射

```
TabBar 页面（4个）
─────────────────────────────────────────────────
约球（首页）    教练        消息         我的
index/       coach-list/ notification/ profile/

子页面
─────────────────────────────────────────────────
约球模块：
  ├── activity-detail/     活动详情（报名/退出/取消）
  └── activity-create/     发起约球（选场馆/时间/人数）

教练模块：
  ├── coach-detail/             教练主页（资料+课程列表+评价）
  ├── group-class-detail/       团课详情（报名/取消）
  ├── private-lesson-detail/    私教详情（预约/取消）
  └── coach-apply/              申请成为教练

战绩模块：
  ├── match-record-create/      录入战绩
  └── match-record-list/        战绩历史

用户模块：
  ├── profile-edit/             编辑资料
  ├── user-profile/             他人主页
  └── settings/                 设置页
```

## 八、小程序能力适配

### 8.1 位置服务

```typescript
// mini/src/hooks/use-location.ts
import Taro from '@tarojs/taro'

export async function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // 先检查权限
    const setting = await Taro.getSetting()
    if (!setting.authSetting['scope.userLocation']) {
      await Taro.authorize({ scope: 'scope.userLocation' })
    }
    const res = await Taro.getLocation({ type: 'gcj02' }) // 国测局坐标，与高德一致
    return { latitude: res.latitude, longitude: res.longitude }
  } catch {
    return null // 用户拒绝授权，不阻塞流程
  }
}
```

### 8.2 图片上传

```typescript
// 小程序图片上传：选图 → 压缩 → 上传
export async function uploadAvatar(): Promise<string> {
  const res = await Taro.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
  })

  const uploadRes = await Taro.uploadFile({
    url: `${BASE_URL}/api/upload/avatar`,
    filePath: res.tempFilePaths[0],
    name: 'avatar',
    header: { Authorization: `Bearer ${useAuthStore.getState().token}` },
  })

  const body = JSON.parse(uploadRes.data)
  return body.data.avatarUrl
}
```

### 8.3 订阅消息（替代站内通知推送）

```typescript
// 小程序订阅消息 — 在关键操作后请求授权
// 场景：报名活动成功后，引导订阅「活动变更通知」
export async function requestSubscribeMessage(templateIds: string[]) {
  try {
    await Taro.requestSubscribeMessage({ tmplIds: templateIds })
  } catch {
    // 用户拒绝，不阻塞
  }
}

// 使用时机：
// 1. 报名活动成功 → 订阅 ACTIVITY_UPDATED / ACTIVITY_CANCELLED
// 2. 报名团课成功 → 订阅 GROUP_CLASS_UPDATED / GROUP_CLASS_CANCELLED
// 3. 预约私教成功 → 订阅 PRIVATE_LESSON_CANCELLED_BY_COACH
```

### 8.4 分享

```typescript
// 每个页面可配置分享
// Taro 页面中使用 useShareAppMessage hook
import { useShareAppMessage } from '@tarojs/taro'

// 活动详情页
useShareAppMessage(() => ({
  title: `来一起打球！${activity.title || ''}`,
  path: `/pages/activity-detail/index?id=${activity.id}`,
  imageUrl: activity.venue?.imageUrl,
}))
```

## 九、导航封装

```typescript
// mini/src/utils/navigate.ts
import Taro from '@tarojs/taro'

// Tab 页面列表（switchTab 和 navigateTo 需区分）
const TAB_PAGES = [
  '/pages/index/index',
  '/pages/coach-list/index',
  '/pages/notification-list/index',
  '/pages/profile/index',
]

export function navigateTo(url: string, params?: Record<string, string>) {
  const query = params
    ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    : ''
  const fullUrl = url + query

  if (TAB_PAGES.includes(url)) {
    Taro.switchTab({ url }) // tabBar 页面不支持带参数
  } else {
    Taro.navigateTo({ url: fullUrl })
  }
}

// 常用导航快捷方式
export const nav = {
  toActivityDetail: (id: string) => navigateTo('/pages/activity-detail/index', { id }),
  toCoachDetail:    (id: string) => navigateTo('/pages/coach-detail/index', { id }),
  toUserProfile:    (id: string) => navigateTo('/pages/user-profile/index', { id }),
  toLogin:          ()           => Taro.redirectTo({ url: '/pages/login/index' }),
  back:             ()           => Taro.navigateBack(),
}
```

## 十、后端改动清单

小程序端上线需要后端配合的改动，范围小且隔离：

| 改动 | 模块 | 描述 |
|---|---|---|
| 新增 `POST /api/auth/wx-login` | user | 微信登录接口，解密手机号后复用现有登录逻辑 |
| 新增环境变量 | infra/config | `WX_APP_ID`、`WX_APP_SECRET` |
| CORS 调整 | infra | 小程序不走 CORS，但需确保域名白名单配置 |
| 订阅消息模板 | notification | 新增 `sendWxSubscribeMessage()` 服务方法，调用微信推送 API |
| 静态资源域名 | upload | 头像等图片 URL 需返回完整域名（非 `/api/uploads/...` 相对路径） |

## 十一、构建与部署

```
开发流程：
─────────────────────────────────────────────────
1. npm run dev:mini          # Taro 编译，监听文件变化
2. 微信开发者工具打开 mini/dist  # 实时预览

CI/CD：
─────────────────────────────────────────────────
1. npm run build:mini        # Taro 生产构建
2. miniprogram-ci upload     # CI 自动上传到微信后台
3. 微信后台提交审核 → 发布

环境配置：
─────────────────────────────────────────────────
dev:   TARO_APP_API_BASE_URL=http://localhost:3000/api
prod:  TARO_APP_API_BASE_URL=https://api.smashmate.com/api
```

## 十二、实施路线

```
第一阶段（MVP）
├── 项目脚手架搭建（Taro + NutUI + Zustand + React Query）
├── 登录（手机号+验证码，复用现有接口）
├── 约球列表 + 详情 + 报名/退出
├── 个人主页 + 资料编辑
└── 基本导航和 TabBar

第二阶段（核心功能）
├── 微信快捷登录（后端新增 wx-login 接口）
├── 教练列表 + 教练主页
├── 团课详情 + 报名
├── 私教预约
└── 通知列表 + 未读数角标

第三阶段（完善体验）
├── 战绩录入 + 历史
├── 教练评价
├── 分享功能
├── 订阅消息推送
└── 发起约球（选场馆、选时间）
```
