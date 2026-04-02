# Feature 详细设计: web-app — auth

> 本文档描述 web-app 的 auth feature 的页面细节。
> 整体架构（路由结构、共享层、类型定义）见 `web-app.md`。

## 1. Feature 概述

- **职责**: 提供手机号+验证码的注册/登录流程，支持注册时勾选教练角色；管理用户认证状态（token 存储与清除）
- **包含页面**: 注册/登录页（LoginPage）
- **对应后端模块**: user

---

## 2. 页面与路由

### LoginPage 页面

**UI 原型**: `docs/prototypes/prototype-login.png`

**路由**: `/login`

**功能**: 用户通过手机号+验证码完成注册或登录。页面包含"登录"和"注册"两个 Tab，登录 Tab 仅需手机号和验证码，注册 Tab 额外提供"我是教练"勾选项。两个 Tab 共用同一后端接口（`POST /api/auth/login`），通过 `isNewUser` 响应字段区分新注册和已有用户登录。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| activeTab | `'login' \| 'register'` | 用户切换 | 当前激活的 Tab（登录 / 注册），默认"登录" |
| phone | string | 用户输入 | 手机号，最多 11 位数字 |
| code | string | 用户输入 | 6 位数字验证码 |
| isCoach | boolean | 用户输入 | 是否勾选"我是教练"（仅注册 Tab 可见），默认 false |
| countdown | number | 定时器 | "获取验证码"按钮的倒计时秒数（60→0），为 0 时按钮可点击 |
| sendingCode | boolean | API 请求状态 | 发送验证码请求进行中 |
| submitting | boolean | API 请求状态 | 登录/注册请求进行中 |
| phoneError | string \| null | 前端校验 / API 响应 | 手机号相关的错误提示 |
| codeError | string \| null | 前端校验 / API 响应 | 验证码相关的错误提示 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `POST /api/auth/send-code` | 用户点击"获取验证码"按钮 | 启动 60 秒倒计时，message.success 提示"验证码已发送" | 根据错误码显示对应提示（见下方错误处理表） |
| `POST /api/auth/login` | 用户点击"登录"/"注册"按钮 | 存储 token 和 userId 到 authStore，重定向到目标页面 | 根据错误码显示对应提示（见下方错误处理表） |

**发送验证码错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| AUTH_INVALID_PHONE | "请输入正确的手机号" |
| AUTH_CODE_RATE_LIMITED | "请稍后再试"（同时前端应通过倒计时防止重复点击） |
| AUTH_PHONE_LOCKED | "操作过于频繁，请 30 分钟后再试" |

**登录/注册错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| AUTH_INVALID_PHONE | "请输入正确的手机号" |
| AUTH_INVALID_CODE | "请输入 6 位数字验证码" |
| AUTH_CODE_WRONG | "验证码错误，请重新输入"（清空验证码输入框） |
| AUTH_CODE_EXPIRED | "验证码已过期，请重新获取" |
| AUTH_PHONE_LOCKED | "操作过于频繁，请 30 分钟后再试" |

**交互流程**:

```
用户打开 /login 页面
  ├→ 已登录（authStore 中存在有效 token）→ 重定向到目标页面（默认 /activities）
  └→ 未登录 → 渲染登录/注册页面

Tab 切换:
  用户点击"登录"/"注册" Tab → 切换 activeTab → 清空表单错误提示（保留已输入的手机号和验证码）

获取验证码:
  1. 前端校验手机号格式（11 位，1 开头）→ 不通过则显示 phoneError
  2. 校验通过 → 调用 POST /api/auth/send-code { phone }
  3. 请求成功 → 启动 60 秒倒计时，按钮变为"重新获取(60s)"不可点击
  4. 请求失败 → 显示对应错误提示
  5. 倒计时结束 → 按钮恢复为"获取验证码"可点击

登录（登录 Tab）:
  1. 前端校验手机号格式和验证码格式（6 位数字）
  2. 校验通过 → 调用 POST /api/auth/login { phone, code }
  3. 请求成功 → 将 token 和 user.id 存入 authStore → 重定向到来源页面（默认 /activities）
  4. 请求失败 → 显示对应错误提示

注册（注册 Tab）:
  1. 前端校验手机号格式和验证码格式（6 位数字）
  2. 校验通过 → 调用 POST /api/auth/login { phone, code, isCoach }
  3. 请求成功:
     a. isNewUser = true → 注册成功，存入 authStore → 重定向（默认 /activities）
     b. isNewUser = false → 该手机号已注册，提示"该手机号已注册，已自动登录" → 存入 authStore → 重定向
  4. 请求失败 → 显示对应错误提示
```

**组件结构**:

```
LoginPage
├── AppLogo                    # 应用 Logo + 名称"羽约"（页面顶部品牌展示）
├── Tabs                       # Ant Design Tabs 组件（登录 / 注册）
│   ├── LoginForm              # 登录表单
│   │   ├── PhoneInput         # 手机号输入框
│   │   ├── CodeInput          # 验证码输入框 + 获取验证码按钮
│   │   └── SubmitButton       # "登录"按钮
│   └── RegisterForm           # 注册表单
│       ├── PhoneInput         # 手机号输入框（与登录 Tab 共享输入值）
│       ├── CodeInput          # 验证码输入框 + 获取验证码按钮
│       ├── CoachCheckbox      # "我是教练"复选框
│       └── SubmitButton       # "注册"按钮
```

---

## 3. Feature 私有组件

| 组件 | 用途 | 使用页面 |
|------|------|---------|
| AppLogo | 应用 Logo 和名称展示（羽毛球图标 + "羽约"文字），登录页顶部品牌区域 | LoginPage |
| PhoneInput | 手机号输入框，限制为 11 位数字输入，显示 phoneError 错误提示 | LoginPage |
| CodeInput | 验证码输入框 + "获取验证码"按钮组合组件；管理倒计时显示和按钮禁用状态；限制为 6 位数字输入 | LoginPage |
| CoachCheckbox | "我是教练"复选框组件，仅在注册 Tab 中显示 | LoginPage |

## 4. Feature 私有 Hooks

| Hook | 用途 | 使用页面 |
|------|------|---------|
| useSendCode | 封装发送验证码请求（useMutation），管理 60 秒倒计时逻辑，处理错误码映射为用户可读提示 | LoginPage |
| useLogin | 封装登录/注册请求（useMutation），成功后更新 authStore（token + userId），处理错误码映射和重定向逻辑 | LoginPage |
| useRedirectUrl | 从 URL query 参数中提取登录后的重定向目标地址（`?redirect=/xxx`），默认 `/activities` | LoginPage |

## 5. 消费的后端接口汇总

| 接口 | 提供方 | 调用页面 | 调用场景 |
|------|--------|---------|---------|
| `POST /api/auth/send-code` | user | LoginPage | 用户点击"获取验证码"按钮时发送验证码到手机号 |
| `POST /api/auth/login` | user | LoginPage | 用户点击"登录"或"注册"按钮时提交手机号+验证码完成认证 |

## 6. 关键业务逻辑

### 6.1 前端表单校验规则

| 字段 | 校验规则 | 错误提示 | 触发时机 |
|------|---------|---------|---------|
| phone | 必填；正则 `/^1\d{10}$/`（11 位数字，1 开头） | "请输入正确的手机号" | 点击"获取验证码"或"登录/注册"时 |
| code | 必填；正则 `/^\d{6}$/`（6 位数字） | "请输入 6 位数字验证码" | 点击"登录/注册"时 |

说明：前端校验为即时反馈，后端仍会做同样的校验。前端校验通过后才发起 API 请求，减少无效请求。

### 6.2 验证码倒计时逻辑

```
初始状态: countdown = 0, 按钮文字 = "获取验证码", 按钮可点击

发送成功后:
  countdown = 60
  每秒 countdown--
  按钮文字 = "重新获取({countdown}s)"
  按钮不可点击

倒计时结束（countdown = 0）:
  按钮文字 = "获取验证码"
  按钮恢复可点击

页面刷新/Tab 切换:
  倒计时状态使用 useState 管理，不持久化
  页面刷新后倒计时重置（可重新发送，后端有 60 秒频率限制兜底）
```

### 6.3 登录态持久化与恢复

```
登录成功:
  1. authStore.setToken(token) → 同步写入 localStorage
  2. authStore.setUserId(userId) → 同步写入 localStorage

应用启动时:
  1. authStore 初始化时从 localStorage 读取 token 和 userId
  2. 如果存在 token → isLoggedIn = true（不主动验证 token 有效性）
  3. 首次 API 请求如果返回 401 → 响应拦截器清除 authStore，重定向到 /login

退出登录:
  1. authStore.clearAuth() → 清除 token、userId、localStorage
  2. 重定向到 /login
```

### 6.4 路由保护与重定向

```
未登录用户访问需认证页面:
  1. AuthGuard 检测到 authStore.isLoggedIn = false
  2. 记录当前路径到 URL query: /login?redirect=/activities/123
  3. 重定向到 /login

登录成功后重定向:
  1. useRedirectUrl 从 URL query 中提取 redirect 参数
  2. 有 redirect 参数 → 重定向到该路径
  3. 无 redirect 参数 → 重定向到默认首页 /activities

已登录用户访问 /login:
  1. LoginPage 检测到 authStore.isLoggedIn = true
  2. 直接重定向到目标页面（默认 /activities）
```

### 6.5 注册 Tab 的"已注册"处理

```
用户在"注册" Tab 提交后，后端返回 isNewUser = false:
  1. 说明该手机号已注册，后端已完成登录
  2. 前端提示: message.info("该手机号已注册，已自动登录")
  3. 正常存储 token → 重定向
  注: 这对应 PRD 验收标准第 5 条"已注册手机号再次注册提示'该手机号已注册'"
```

### 6.6 手机号和验证码跨 Tab 共享

```
用户在"登录" Tab 输入手机号和验证码后切换到"注册" Tab:
  - 手机号输入值保留（phone 状态跨 Tab 共享）
  - 验证码输入值保留（code 状态跨 Tab 共享）
  - 倒计时状态保留（countdown 跨 Tab 共享）
  - 错误提示清空（避免 Tab 切换后残留无关错误）
```
