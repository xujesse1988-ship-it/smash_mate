# 模块详细设计: admin

> 本文档描述 admin 前端模块的整体架构和页面细节。
> 由于 admin 页面较少（3 个页面），不拆分 feature 级文档，整体 + 页面细节合并于本文件。
> 系统级架构见 architecture.md。

## 1. 模块概述

- **职责**: 管理后台 SPA，提供管理员登录、城市管理、球馆管理功能，一期聚焦平台基础数据维护
- **类型**: 前端模块
- **业务模块映射**: PRD 中的「管理后台（FH）」

---

## 2. Feature 划分

| Feature | 包含页面 | 对应后端模块 | 说明 |
|---------|---------|------------|------|
| auth | 管理员登录页 | user | 管理员通过手机号+验证码登录 |
| venue-management | 城市管理页、球馆管理页 | venue | 城市和球馆数据的查看与管理 |

**划分原则**: 与 web-app 一致，auth 为未登录态页面，venue-management 为登录态页面，生命周期不同。admin 仅 3 个页面，不再进一步拆分 feature 级文档。

---

## 3. 内部架构

### 目录结构

```
admin/
├── features/          # 按业务域组织
│   ├── auth/
│   │   ├── pages/             # 管理员登录页
│   │   └── api/               # 认证相关 API 调用
│   └── venue-management/
│       ├── pages/             # 城市管理页、球馆管理页
│       ├── components/        # 城市表格、球馆表格、添加城市弹窗等
│       └── api/               # 城市/球馆管理 API 调用
├── shared/            # 共享组件、hooks、工具函数、类型
│   ├── components/    # 全局复用的 UI 组件
│   ├── hooks/         # 共享 hooks
│   ├── utils/         # 工具函数
│   └── types/         # 跨 feature 共享的类型定义
├── stores/            # 全局状态管理（跨 feature 共享）
├── routes.ts          # 统一路由
└── main.tsx
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Pages | 页面组件（React Router 路由对应），组合子组件 | Components, Hooks |
| Components | Ant Design 基础上的业务组件，只接收 props，不直接调用 API | -- |
| Hooks | TanStack Query 数据获取 + 业务逻辑封装 | API, Stores |
| API | 封装后端接口调用（fetch / axios），处理请求/响应转换 | 后端模块接口 |
| Stores | Zustand 跨页面共享状态（仅在需要时使用） | -- |

### 控制流

```
用户操作 → Page → Hook（useQuery/useMutation）→ API 层（fetch）→ TanStack Query 缓存更新 → 重新渲染
```

---

## 4. 路由结构

| 路由 | 页面组件 | 所属 Feature | 功能描述 | 认证要求 |
|------|---------|-------------|---------|---------|
| /login | AdminLoginPage | auth | 管理员手机号+验证码登录 | 不需要 |
| /cities | CityManagementPage | venue-management | 城市列表查看、添加城市 | 需要（管理员） |
| /venues | VenueManagementPage | venue-management | 球馆列表查看、按城市筛选、移除球馆、手动触发同步 | 需要（管理员） |

**路由保护策略**:
- 未登录管理员访问 `/cities` 或 `/venues` 时，自动重定向到 `/login`
- 登录成功后重定向到默认首页 `/cities`
- 已登录管理员访问 `/login` 时，直接重定向到 `/cities`

---

## 5. 布局设计

### 全局布局

```
AdminLayout
├── Header             # 顶部栏（Logo"羽约管理后台"、当前管理员手机号脱敏显示、退出登录按钮）
├── Sider              # 左侧菜单栏（Ant Design Layout.Sider）
│   └── Menu           # 导航菜单
└── Content            # 页面内容区域（由 React Router 渲染）
```

**说明**:
- AdminLayout 仅在已登录页面使用，登录页使用独立的全屏居中布局
- Header 固定在顶部，显示应用名称和管理员操作区
- Sider 在左侧，收纳导航菜单，默认展开
- Content 区域占满剩余空间

### 导航结构

**左侧菜单（Sider Menu）**:

| 菜单项 | 路由 | 图标 | 说明 |
|--------|------|------|------|
| 城市管理 | /cities | Ant Design EnvironmentOutlined | 城市列表和添加 |
| 球馆管理 | /venues | Ant Design ShopOutlined | 球馆列表和管理 |

---

## 6. 共享层设计

### 共享组件

| 组件 | 用途 | 使用方 |
|------|------|--------|
| AdminLayout | 管理后台布局容器（Header + Sider + Content） | venue-management |
| AdminAuthGuard | 路由保护组件，未登录重定向到 /login | venue-management |
| LoadingSpinner | 加载状态组件 | auth, venue-management |
| PageError | 页面级错误展示组件 | venue-management |

### 共享 Hooks

| Hook | 用途 | 使用方 |
|------|------|--------|
| useAdminAuth | 获取当前管理员登录状态、退出登录功能 | AdminLayout（退出按钮）, AdminAuthGuard |
| useAdminUser | 获取当前管理员用户信息（通过 TanStack Query 缓存 GET /api/users/me） | AdminLayout（显示管理员手机号） |

### 全局状态管理（Zustand）

| Store | 状态 | 用途 | 使用方 |
|-------|------|------|--------|
| adminAuthStore | `token: string \| null`, `userId: string \| null`, `isLoggedIn: boolean` | 管理员认证令牌管理、登录状态持久化（localStorage，key 使用 `admin_token` / `admin_userId` 与 web-app 隔离） | auth, venue-management（通过 useAdminAuth hook 间接使用） |

**设计原则**:
- 与 web-app 的 authStore 使用不同的 localStorage key，互不干扰
- 页面内临时状态使用 useState（如表单输入、弹窗开关）
- 服务端数据使用 TanStack Query 管理（自动缓存、失效重新获取）
- 不在 Zustand 中缓存服务端数据

### API Client 配置

- **基础 URL**: `/api`（开发环境通过 Vite proxy 代理到后端开发服务器）
- **请求拦截器**:
  - 从 adminAuthStore 读取 token，自动附加 `Authorization: Bearer <token>` 请求头
  - 无 token 的请求不附加认证头（公开接口）
- **响应拦截器**:
  - 401 响应：清除 adminAuthStore 中的 token，重定向到 `/login`
  - 403 响应（AUTH_ADMIN_REQUIRED）：清除 adminAuthStore，重定向到 `/login`，提示"无管理员权限"
  - 其他错误：提取 `error.code` 和 `error.message`，统一抛出便于各页面处理
- **错误处理策略**:
  - 操作类错误：通过 useMutation 的 onError 回调处理，使用 Ant Design message 提示用户可读的错误信息
  - 数据加载错误：通过 useQuery 的 error 状态渲染 PageError 组件
  - 网络错误：统一提示"网络异常，请稍后重试"

---

## 7. 核心类型定义

```typescript
// ===== 城市相关 =====

interface City {
  id: string;
  name: string;
  venueCount: number;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

// ===== 球馆相关（管理视角） =====

interface AdminVenue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  cityId: string;
  cityName: string;
  createdAt: string;  // ISO 8601
}

// ===== 同步结果 =====

interface SyncResult {
  cityId: string;
  cityName: string;
  newVenues: number;
  updatedVenues: number;
  totalVenues: number;
}

interface SyncResponse {
  message: string;
  syncResults: SyncResult[];
}

// ===== 分页相关 =====

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ===== API 响应 =====

interface ApiSuccessResponse<T> {
  data: T;
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
```

---

## 8. 页面详细设计

### 8.1 AdminLoginPage 页面

**路由**: `/login`

**功能**: 管理员通过手机号+验证码完成登录。管理员账号由系统预设（config 中配置管理员手机号列表），使用与用户端相同的验证码登录流程。登录后由后端 admin-auth 中间件校验管理员身份。

> **设计说明**: user 模块的 `POST /api/auth/send-code` 和 `POST /api/auth/login` 接口均将 admin 列为 consumer。admin 登录复用这两个接口。登录成功后，后续请求通过 admin-auth 中间件校验管理员权限（检查 JWT 中的用户是否为预设管理员）。如果非管理员用户尝试登录管理后台，首次访问管理页面时 admin-auth 中间件会返回 403（AUTH_ADMIN_REQUIRED），前端清除 token 并重定向到登录页。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| phone | string | 用户输入 | 手机号，最多 11 位数字 |
| code | string | 用户输入 | 6 位数字验证码 |
| countdown | number | 定时器 | "获取验证码"按钮的倒计时秒数（60 -> 0），为 0 时按钮可点击 |
| sendingCode | boolean | API 请求状态 | 发送验证码请求进行中 |
| submitting | boolean | API 请求状态 | 登录请求进行中 |
| phoneError | string \| null | 前端校验 / API 响应 | 手机号相关的错误提示 |
| codeError | string \| null | 前端校验 / API 响应 | 验证码相关的错误提示 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `POST /api/auth/send-code` | 管理员点击"获取验证码"按钮 | 启动 60 秒倒计时，message.success 提示"验证码已发送" | 根据错误码显示对应提示（见下方错误处理表） |
| `POST /api/auth/login` | 管理员点击"登录"按钮 | 存储 token 和 userId 到 adminAuthStore，重定向到 /cities | 根据错误码显示对应提示（见下方错误处理表） |

**发送验证码错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| AUTH_INVALID_PHONE | "请输入正确的手机号" |
| AUTH_CODE_RATE_LIMITED | "请稍后再试" |
| AUTH_PHONE_LOCKED | "操作过于频繁，请 30 分钟后再试" |

**登录错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| AUTH_INVALID_PHONE | "请输入正确的手机号" |
| AUTH_INVALID_CODE | "请输入 6 位数字验证码" |
| AUTH_CODE_WRONG | "验证码错误，请重新输入"（清空验证码输入框） |
| AUTH_CODE_EXPIRED | "验证码已过期，请重新获取" |
| AUTH_PHONE_LOCKED | "操作过于频繁，请 30 分钟后再试" |

**交互流程**:

```
管理员打开 /login 页面
  ├→ 已登录（adminAuthStore 中存在有效 token）→ 重定向到 /cities
  └→ 未登录 → 渲染登录页面

获取验证码:
  1. 前端校验手机号格式（11 位，1 开头）→ 不通过则显示 phoneError
  2. 校验通过 → 调用 POST /api/auth/send-code { phone }
  3. 请求成功 → 启动 60 秒倒计时，按钮变为"重新获取(60s)"不可点击
  4. 请求失败 → 显示对应错误提示
  5. 倒计时结束 → 按钮恢复为"获取验证码"可点击

登录:
  1. 前端校验手机号格式和验证码格式（6 位数字）
  2. 校验通过 → 调用 POST /api/auth/login { phone, code }（不传 isCoach）
  3. 请求成功 → 将 token 和 userId 存入 adminAuthStore → 重定向到 /cities
  4. 请求失败 → 显示对应错误提示

非管理员用户登录后的处理:
  1. 登录接口本身不区分管理员/普通用户，登录可成功
  2. 重定向到 /cities 后，页面加载时调用管理员接口（GET /api/admin/cities）
  3. admin-auth 中间件返回 403（AUTH_ADMIN_REQUIRED）
  4. 响应拦截器清除 adminAuthStore，重定向到 /login，message.error 提示"无管理员权限"
```

**组件结构**:

```
AdminLoginPage
├── AppLogo                    # 应用 Logo + "羽约管理后台"标题
├── LoginForm                  # 登录表单（Ant Design Form）
│   ├── PhoneInput             # 手机号输入框
│   ├── CodeInput              # 验证码输入框 + 获取验证码按钮
│   └── SubmitButton           # "登录"按钮
```

---

### 8.2 CityManagementPage 页面

**路由**: `/cities`

**功能**: 管理员查看已添加的城市列表（含每个城市的球馆数量），支持添加新城市。添加城市后系统自动获取该城市的球馆数据。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| cities | PaginatedResponse\<City\> | API（useQuery） | 城市列表数据 |
| page | number | 用户操作（分页切换） | 当前页码，默认 1 |
| pageSize | number | 用户操作 | 每页条数，默认 20 |
| addModalVisible | boolean | 用户操作 | "添加城市"弹窗是否显示 |
| cityName | string | 用户输入（弹窗内） | 新增城市名称 |
| addingCity | boolean | API 请求状态 | 添加城市请求进行中 |
| cityNameError | string \| null | 前端校验 / API 响应 | 城市名称相关的错误提示 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/admin/cities` | 页面加载、分页切换、添加城市成功后 | 渲染城市列表表格 | 渲染 PageError 组件 |
| `POST /api/admin/cities` | 管理员在弹窗中填写城市名称后点击"确定" | 关闭弹窗、刷新城市列表、message.success 提示"城市添加成功，已获取 N 个球馆" | 根据错误码显示对应提示（见下方错误处理表） |

**添加城市错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| VENUE_INVALID_CITY_NAME | "请输入城市名称" |
| VENUE_CITY_DUPLICATE | "该城市已存在" |
| AUTH_UNAUTHORIZED | 响应拦截器统一处理（重定向到登录页） |
| AUTH_ADMIN_REQUIRED | 响应拦截器统一处理（重定向到登录页） |

**交互流程**:

```
管理员进入 /cities 页面
  → 加载城市列表（GET /api/admin/cities?page=1&pageSize=20）
  → 渲染表格（城市名称、球馆数量、创建时间、更新时间）

添加城市:
  1. 管理员点击"添加城市"按钮 → 弹出 Modal 弹窗
  2. 管理员输入城市名称
  3. 前端校验城市名称非空
  4. 点击"确定" → 调用 POST /api/admin/cities { name }
  5. 请求进行中 → 确定按钮显示 loading 状态
  6. 请求成功 → 关闭弹窗、清空输入、刷新城市列表
     → message.success("城市添加成功，已获取 {venueCount} 个球馆")
  7. 请求失败 → 弹窗保持打开，显示错误提示
     → VENUE_CITY_DUPLICATE → cityNameError = "该城市已存在"

分页:
  管理员点击分页控件 → 更新 page → 重新加载城市列表
```

**组件结构**:

```
CityManagementPage
├── PageHeader                 # 页面标题"城市管理" + "添加城市"按钮
├── CityTable                  # Ant Design Table 组件
│   └── columns:
│       ├── 城市名称（name）
│       ├── 球馆数量（venueCount）
│       ├── 创建时间（createdAt，格式化为 YYYY-MM-DD HH:mm）
│       └── 更新时间（updatedAt，格式化为 YYYY-MM-DD HH:mm）
├── Pagination                 # Ant Design 分页控件（内置于 Table）
└── AddCityModal               # 添加城市弹窗
    └── CityNameInput          # 城市名称输入框
```

---

### 8.3 VenueManagementPage 页面

**路由**: `/venues`

**功能**: 管理员查看球馆列表，支持按城市筛选和按名称搜索。管理员可移除已关闭的球馆，也可手动触发全量球馆数据同步。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| venues | PaginatedResponse\<AdminVenue\> | API（useQuery） | 球馆列表数据 |
| page | number | 用户操作（分页切换） | 当前页码，默认 1 |
| pageSize | number | 用户操作 | 每页条数，默认 20 |
| cityFilter | string \| undefined | 用户操作（下拉选择） | 按城市 ID 筛选 |
| keyword | string | 用户输入 | 按球馆名称搜索关键词 |
| cities | City[] | API（useQuery） | 城市列表，用于城市筛选下拉框 |
| syncing | boolean | API 请求状态 | 球馆同步请求进行中 |
| syncResults | SyncResult[] \| null | API 响应 | 最近一次同步结果（展示在同步结果通知中） |
| removingVenueId | string \| null | API 请求状态 | 正在移除的球馆 ID（用于表格行 loading 状态） |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/admin/venues` | 页面加载、分页切换、筛选条件变化、移除球馆后、同步完成后 | 渲染球馆列表表格 | 渲染 PageError 组件 |
| `GET /api/admin/cities` | 页面加载（用于城市筛选下拉框） | 填充城市筛选下拉框选项 | message.error 提示加载失败 |
| `DELETE /api/admin/venues/:id` | 管理员确认移除球馆后 | 刷新球馆列表、message.success 提示"球馆已移除" | 根据错误码显示对应提示 |
| `POST /api/admin/venues/sync` | 管理员点击"同步球馆数据"按钮 | 刷新球馆列表、展示同步结果通知 | 根据错误码显示对应提示 |

**移除球馆错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| VENUE_NOT_FOUND | "球馆不存在或已被移除"（同时刷新列表） |
| AUTH_UNAUTHORIZED | 响应拦截器统一处理 |
| AUTH_ADMIN_REQUIRED | 响应拦截器统一处理 |

**同步球馆错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| VENUE_SYNC_IN_PROGRESS | "同步正在进行中，请稍后再试" |
| AUTH_UNAUTHORIZED | 响应拦截器统一处理 |
| AUTH_ADMIN_REQUIRED | 响应拦截器统一处理 |

**交互流程**:

```
管理员进入 /venues 页面
  → 并行加载:
    1. 球馆列表（GET /api/admin/venues?page=1&pageSize=20）
    2. 城市列表（GET /api/admin/cities，不分页，取全量用于筛选下拉框；
       一期城市数量少，可直接获取全部；使用足够大的 pageSize 如 100）
  → 渲染表格和筛选区域

筛选:
  管理员选择城市下拉框 → 更新 cityFilter → page 重置为 1 → 重新加载球馆列表
  管理员输入搜索关键词 → debounce 500ms → 更新 keyword → page 重置为 1 → 重新加载球馆列表

移除球馆:
  1. 管理员点击某行"移除"按钮
  2. 弹出确认弹窗: "确定移除该球馆吗？移除后用户端将无法搜索到该球馆。"
  3. 管理员点击"确定" → 调用 DELETE /api/admin/venues/:id
  4. 请求进行中 → 该行显示 loading 状态
  5. 请求成功 → message.success("球馆已移除") → 刷新球馆列表
  6. 请求失败 → 显示对应错误提示

同步球馆数据:
  1. 管理员点击"同步球馆数据"按钮
  2. 弹出确认弹窗: "确定同步所有城市的球馆数据吗？同步过程可能需要一些时间。"
  3. 管理员点击"确定" → 调用 POST /api/admin/venues/sync
  4. 请求进行中 → 同步按钮显示 loading 状态，不可重复点击
  5. 请求成功 → 刷新球馆列表 → 使用 Ant Design notification 展示同步结果:
     "球馆数据同步完成
      北京: 新增 3 个，更新 5 个，共 45 个
      上海: 新增 1 个，更新 2 个，共 38 个
      ..."
  6. 请求失败 → VENUE_SYNC_IN_PROGRESS → message.warning("同步正在进行中，请稍后再试")

分页:
  管理员点击分页控件 → 更新 page → 重新加载球馆列表
```

**组件结构**:

```
VenueManagementPage
├── PageHeader                 # 页面标题"球馆管理" + "同步球馆数据"按钮
├── VenueFilterBar             # 筛选区域
│   ├── CitySelect             # 城市筛选下拉框（Ant Design Select，含"全部城市"选项）
│   └── KeywordSearch          # 球馆名称搜索框（Ant Design Input.Search）
├── VenueTable                 # Ant Design Table 组件
│   └── columns:
│       ├── 球馆名称（name）
│       ├── 地址（address）
│       ├── 所属城市（cityName）
│       ├── 创建时间（createdAt，格式化为 YYYY-MM-DD HH:mm）
│       └── 操作（移除按钮 + Popconfirm 确认）
├── Pagination                 # Ant Design 分页控件（内置于 Table）
└── SyncConfirmModal           # 同步确认弹窗（Ant Design Modal.confirm）
```

---

## 9. Feature 私有组件

### auth feature

| 组件 | 用途 | 使用页面 |
|------|------|---------|
| AppLogo | 应用 Logo + "羽约管理后台"标题，登录页顶部品牌展示 | AdminLoginPage |
| PhoneInput | 手机号输入框，限制为 11 位数字输入，显示 phoneError 错误提示 | AdminLoginPage |
| CodeInput | 验证码输入框 + "获取验证码"按钮组合组件；管理倒计时显示和按钮禁用状态 | AdminLoginPage |

### venue-management feature

| 组件 | 用途 | 使用页面 |
|------|------|---------|
| AddCityModal | 添加城市弹窗，包含城市名称输入框和提交逻辑 | CityManagementPage |
| CityTable | 城市数据表格，展示城市名称、球馆数量、创建/更新时间 | CityManagementPage |
| VenueFilterBar | 球馆筛选区域，包含城市下拉框和搜索框 | VenueManagementPage |
| VenueTable | 球馆数据表格，展示球馆信息和操作按钮 | VenueManagementPage |

---

## 10. Feature 私有 Hooks

### auth feature

| Hook | 用途 | 使用页面 |
|------|------|---------|
| useSendCode | 封装发送验证码请求（useMutation），管理 60 秒倒计时逻辑，处理错误码映射 | AdminLoginPage |
| useAdminLogin | 封装登录请求（useMutation），成功后更新 adminAuthStore，处理错误码映射和重定向 | AdminLoginPage |

### venue-management feature

| Hook | 用途 | 使用页面 |
|------|------|---------|
| useCityList | 获取城市列表（useQuery，GET /api/admin/cities），支持分页参数 | CityManagementPage, VenueManagementPage（城市筛选下拉框） |
| useAddCity | 添加城市（useMutation，POST /api/admin/cities），成功后使城市列表缓存失效 | CityManagementPage |
| useVenueList | 获取球馆列表（useQuery，GET /api/admin/venues），支持 cityId/keyword/分页参数 | VenueManagementPage |
| useRemoveVenue | 移除球馆（useMutation，DELETE /api/admin/venues/:id），成功后使球馆列表缓存失效 | VenueManagementPage |
| useSyncVenues | 触发球馆数据同步（useMutation，POST /api/admin/venues/sync），成功后使球馆列表缓存失效 | VenueManagementPage |

---

## 11. 消费的后端接口汇总

| 接口 | 提供方 | 调用页面 | 调用场景 |
|------|--------|---------|---------|
| `POST /api/auth/send-code` | user | AdminLoginPage | 管理员点击"获取验证码"按钮 |
| `POST /api/auth/login` | user | AdminLoginPage | 管理员点击"登录"按钮 |
| `GET /api/users/me` | user | AdminLayout | 获取当前管理员信息（展示脱敏手机号） |
| `GET /api/admin/cities` | venue | CityManagementPage, VenueManagementPage | 城市列表展示、城市筛选下拉框 |
| `POST /api/admin/cities` | venue | CityManagementPage | 添加城市 |
| `GET /api/admin/venues` | venue | VenueManagementPage | 球馆列表展示 |
| `DELETE /api/admin/venues/:id` | venue | VenueManagementPage | 移除球馆 |
| `POST /api/admin/venues/sync` | venue | VenueManagementPage | 手动触发球馆数据同步 |

---

## 12. 关键业务逻辑

### 12.1 前端表单校验规则

| 页面 | 字段 | 校验规则 | 错误提示 | 触发时机 |
|------|------|---------|---------|---------|
| AdminLoginPage | phone | 必填；正则 `/^1\d{10}$/`（11 位数字，1 开头） | "请输入正确的手机号" | 点击"获取验证码"或"登录"时 |
| AdminLoginPage | code | 必填；正则 `/^\d{6}$/`（6 位数字） | "请输入 6 位数字验证码" | 点击"登录"时 |
| CityManagementPage | cityName | 必填；不可为空字符串（trim 后） | "请输入城市名称" | 点击"确定"添加城市时 |

### 12.2 管理员登录态持久化与恢复

```
登录成功:
  1. adminAuthStore.setToken(token) → 写入 localStorage（key: admin_token）
  2. adminAuthStore.setUserId(userId) → 写入 localStorage（key: admin_userId）

应用启动时:
  1. adminAuthStore 初始化时从 localStorage 读取 admin_token 和 admin_userId
  2. 如果存在 token → isLoggedIn = true（不主动验证 token 有效性）
  3. 首次 API 请求如果返回 401 → 响应拦截器清除 adminAuthStore，重定向到 /login
  4. 首次管理员接口返回 403（AUTH_ADMIN_REQUIRED）→ 清除 adminAuthStore，
     message.error("无管理员权限")，重定向到 /login

退出登录:
  1. adminAuthStore.clearAuth() → 清除 admin_token、admin_userId、localStorage
  2. 重定向到 /login
```

### 12.3 验证码倒计时逻辑

```
与 web-app 的 auth feature 逻辑完全一致:
初始状态: countdown = 0, 按钮文字 = "获取验证码", 按钮可点击

发送成功后:
  countdown = 60
  每秒 countdown--
  按钮文字 = "重新获取({countdown}s)"
  按钮不可点击

倒计时结束（countdown = 0）:
  按钮文字 = "获取验证码"
  按钮恢复可点击
```

### 12.4 非管理员用户的权限拦截

```
场景: 普通用户（非管理员）使用手机号登录了管理后台

处理流程:
  1. POST /api/auth/login 成功（user 模块不区分管理员/普通用户）
  2. 前端存储 token，重定向到 /cities
  3. CityManagementPage 加载，调用 GET /api/admin/cities
  4. admin-auth 中间件校验失败，返回 403 + AUTH_ADMIN_REQUIRED
  5. 响应拦截器捕获 403:
     a. 清除 adminAuthStore（token、userId）
     b. message.error("无管理员权限")
     c. 重定向到 /login

效果: 普通用户看到短暂的加载状态后被踢回登录页，无法访问管理功能
```

### 12.5 同步结果展示逻辑

```
同步成功后:
  1. 从响应中提取 syncResults 数组
  2. 使用 Ant Design notification.success 展示结果:
     - 标题: "球馆数据同步完成"
     - 内容: 逐行展示每个城市的同步结果
       "{cityName}: 新增 {newVenues} 个，更新 {updatedVenues} 个，共 {totalVenues} 个"
     - 通知持续时间: 10 秒（duration: 10）
  3. 同时刷新球馆列表（使 TanStack Query 缓存失效）
```

### 12.6 球馆搜索防抖

```
管理员在搜索框输入球馆名称:
  1. 输入变化 → debounce 500ms
  2. 500ms 内无新输入 → 更新 keyword 状态 → page 重置为 1 → 触发 useVenueList 重新查询
  3. 500ms 内有新输入 → 重置计时器
  
使用 500ms 而非 300ms（web-app 用 300ms），因为管理后台非高频操作场景，较长的防抖时间减少请求次数
```

---

## 13. 模块特有约定

- **布局适配**: admin 管理后台优先适配桌面端浏览器（最小宽度 1024px），不需要移动端适配
- **浏览器兼容**: 支持 Chrome、Edge 最新版本
- **视觉风格**: 使用 Ant Design 默认主题，不做额外定制（管理后台注重功能而非品牌视觉）；与 web-app 的活力绿主题色无关
- **性能约束**:
  - 页面较少、数据量小，不需要路由级代码分割
  - TanStack Query 缓存策略：staleTime 设为 30 秒（与 web-app 一致）
  - 球馆同步可能耗时较长（多个城市串行调用地图服务），请求超时设为 60 秒（覆盖默认超时）
- **与 web-app 的隔离**:
  - admin 和 web-app 为两个独立的 SPA，分别构建和部署
  - localStorage key 使用不同前缀（admin 使用 `admin_token` / `admin_userId`，web-app 使用 `token` / `userId`），互不干扰
  - API Client 独立配置，不共享 web-app 的 API Client 实例
- **安全约束**:
  - 管理后台所有数据操作接口（/api/admin/*）由后端 admin-auth 中间件保护
  - 前端 AdminAuthGuard 仅为用户体验优化（避免未登录用户看到管理页面），真正的安全保障在后端

---

## 14. 设计备注

### 管理员认证机制说明

architecture.md 决策 4 描述管理员使用"预设账号密码登录"，但 user 模块设计中 `POST /api/auth/send-code` 和 `POST /api/auth/login` 均将 admin 列为 consumer。本文档遵循已审批通过的 user 模块设计，admin 登录复用手机号+验证码流程。

管理员身份的校验由后端 `admin-auth` 中间件负责（检查 JWT 中的用户是否在预设管理员名单中），前端不负责判断用户是否为管理员 -- 而是通过管理员接口返回的 403 错误（AUTH_ADMIN_REQUIRED）来感知并处理。

此设计简化了前端逻辑，同时保证安全性（管理员身份由后端控制，前端无法伪造）。
