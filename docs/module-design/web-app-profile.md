# Feature 详细设计: web-app — profile

> 本文档描述 web-app 的 profile feature 的页面细节。
> 整体架构（路由结构、共享层、类型定义）见 `web-app.md`。

## 1. Feature 概述

- **职责**: 用户个人主页展示（基本信息、战绩汇总、快捷入口）、个人资料编辑（头像、昵称、简介）、教练资料编辑（简介、擅长方向）、设置（教练角色开启、退出登录）
- **包含页面**: 个人主页（UserProfilePage）、个人资料编辑页（ProfileEditPage）、教练资料编辑页（CoachProfileEditPage）、设置页（SettingsPage）
- **对应后端模块**: user（用户信息、资料更新、教练角色开启）、coaching（教练资料更新）、match-record（战绩汇总）

---

## 2. 页面与路由

### UserProfilePage 页面

**UI 原型**: `docs/prototypes/prototype-my-profile.png`

**路由**: `/users/:id`

**功能**: 展示指定用户的个人主页，包含基本信息（头像、昵称）、战绩汇总（总场次、胜场、胜率）以及快捷入口列表。当查看的是当前登录用户自己的主页时（`:id` 等于当前用户 ID，或路由为底部导航 Tab "我的" 入口），显示完整的快捷入口列表（我发起的活动、我参加的活动、我的课程、战绩记录、个人资料、设置）；查看他人主页时仅展示基本信息和战绩汇总。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| userInfo | `UserPublicInfo \| null` | API（GET /api/users/:id） | 用户公开信息 |
| matchStats | `MatchStats \| null` | API（GET /api/users/:id/match-stats） | 战绩汇总统计 |
| isOwnProfile | boolean | 计算（比较 :id 与当前用户 ID） | 是否为当前用户自己的主页 |
| isCoach | boolean | useCurrentUser（currentUser.isCoach） | 当前登录用户是否为教练角色（仅 isOwnProfile 时用于区分课程相关快捷入口） |
| isLoading | boolean | API 请求状态 | 数据加载中 |
| error | string \| null | API 响应 | 加载错误信息 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/users/:id` | 页面加载 | 渲染用户基本信息（头像、昵称、简介） | USER_NOT_FOUND: 显示"用户不存在"提示；其他: 显示 PageError 组件 |
| `GET /api/users/:id/match-stats` | 页面加载（与用户信息并行请求） | 渲染战绩汇总卡片（总场次、胜场、胜率） | 显示战绩汇总区域错误提示，不阻塞页面其他部分渲染 |

**交互流程**:

```
用户进入 /users/:id 页面
  → 并行发起两个请求:
    1. GET /api/users/:id（获取用户公开信息）
    2. GET /api/users/:id/match-stats（获取战绩汇总）
  → 判断 isOwnProfile（:id === authStore.userId）
  → 两个请求均返回后渲染页面

isOwnProfile = true（查看自己的主页）时:
  渲染:
    - 用户信息区域（头像、昵称）
    - 战绩汇总卡片（总场次 | 胜场 | 胜率）
    - 快捷入口列表:
      - "我发起的活动" → 跳转 /my-activities?role=initiated（activity feature）
      - "我参加的活动" → 跳转 /my-activities?role=participated（activity feature）
      - 课程相关入口（根据用户角色区分）:
        - 普通用户（isCoach = false）: "我的课程" → 跳转 /my-enrollments（coaching feature）
        - 教练用户（isCoach = true）: "我的报名" → 跳转 /my-enrollments（coaching feature） + "课程管理" → 跳转 /my-courses（coaching feature）
      - "战绩记录" → 跳转 /users/:id/match-records（match-record feature）
      - "个人资料" → 跳转 /profile/edit
      - "设置" → 跳转 /settings

isOwnProfile = false（查看他人主页）时:
  渲染:
    - 用户信息区域（头像、昵称、简介）
    - 战绩汇总卡片（总场次 | 胜场 | 胜率）
    - 不显示快捷入口列表
```

**组件结构**:

```
UserProfilePage
├── UserInfoSection              # 用户信息区域（头像、昵称、简介）
│   └── UserAvatar               # 共享组件：用户头像
├── MatchStatsCard               # 战绩汇总卡片（总场次 | 胜场 | 胜率）
└── QuickLinkList                # 快捷入口列表（仅 isOwnProfile 时渲染）
    └── QuickLinkItem            # 单个快捷入口行（图标 + 文字 + 右箭头）
```

---

### ProfileEditPage 页面

**UI 原型**: `docs/prototypes/prototype-edit-profile.png`

**路由**: `/profile/edit`

**功能**: 编辑当前登录用户的个人资料，包括头像 URL、昵称、简介。手机号以脱敏格式显示，不可编辑（一期不支持修改手机号）。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| currentUser | `User \| null` | API（GET /api/users/me） | 当前用户信息（用于回填表单） |
| nickname | string | 用户输入 | 昵称输入值（初始值来自 currentUser.nickname） |
| avatarUrl | string | 用户输入 | 头像 URL 输入值（初始值来自 currentUser.avatarUrl） |
| bio | string | 用户输入 | 简介输入值（初始值来自 currentUser.bio） |
| submitting | boolean | API 请求状态 | 保存请求进行中 |
| errors | `Record<string, string>` | 前端校验 / API 响应 | 各字段的错误提示 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/users/me` | 页面加载（通过 useCurrentUser 获取，有缓存时直接使用） | 回填表单字段 | 显示 PageError 组件 |
| `PUT /api/users/me` | 用户点击"保存"按钮 | message.success 提示"保存成功"，使 useCurrentUser 缓存失效（TanStack Query invalidate），返回上一页 | 根据错误码显示对应字段的错误提示（见下方错误处理表） |

**资料更新错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| USER_INVALID_NICKNAME | "昵称长度需在 2-20 个字符之间" |
| USER_INVALID_BIO | "简介不能超过 200 个字符" |
| USER_INVALID_AVATAR_URL | "请输入合法的头像链接" |

**交互流程**:

```
用户进入 /profile/edit 页面
  → 通过 useCurrentUser 获取当前用户信息（有缓存直接使用，无缓存发起 GET /api/users/me）
  → 将 currentUser 的 nickname、avatarUrl、bio 回填到表单输入框
  → 手机号以脱敏格式只读显示

用户编辑表单:
  → 修改昵称 / 头像 URL / 简介

用户点击"保存":
  1. 前端校验（见关键业务逻辑 6.1）
  2. 校验不通过 → 显示对应字段错误
  3. 校验通过 → 调用 PUT /api/users/me { nickname, avatarUrl, bio }
     - 仅发送有变更的字段（与初始值比较，未变更的不包含在请求体中）
  4. 成功 → message.success("保存成功") → invalidate useCurrentUser 缓存 → 返回上一页
  5. 失败 → 显示对应错误提示

用户点击 TopBar "返回"按钮:
  → 如果有未保存的修改 → 提示"有未保存的修改，确定离开？"（ConfirmDialog）
  → 确认离开 → 返回上一页
  → 取消 → 留在当前页面
```

**组件结构**:

```
ProfileEditPage
├── TopBar                       # 共享组件：顶部栏（返回按钮 + "编辑资料" + "保存"按钮）
├── AvatarEditor                 # 头像编辑区域（头像预览 + 头像 URL 输入框）
│   └── UserAvatar               # 共享组件：头像展示
├── ProfileForm                  # 资料表单
│   ├── NicknameInput            # 昵称输入框
│   ├── BioInput                 # 简介输入框（多行文本）
│   └── PhoneDisplay             # 手机号只读显示（脱敏格式）
```

---

### CoachProfileEditPage 页面

**UI 原型**: `docs/prototypes/prototype-coach-edit.png`

**路由**: `/profile/coach-edit`

**功能**: 编辑当前用户的教练资料，包括教练简介和擅长方向标签选择。仅教练角色用户可访问。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| coachProfile | `{ bio: string \| null; specialties: CoachSpecialty[] } \| null` | API（GET /api/coaches/:id） | 教练资料（用于回填表单；从 `GET /api/coaches/:id` 响应中仅提取 `bio` 和 `specialties` 字段用于表单初始化；首次编辑时可能不存在 CoachProfile，此时字段为空） |
| bio | string | 用户输入 | 教练简介输入值 |
| specialties | `CoachSpecialty[]` | 用户选择 | 已选择的擅长方向标签列表 |
| submitting | boolean | API 请求状态 | 保存请求进行中 |
| errors | `Record<string, string>` | 前端校验 / API 响应 | 各字段的错误提示 |
| isLoading | boolean | API 请求状态 | 初始数据加载中 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/coaches/:id`（:id 为当前用户 ID） | 页面加载 | 回填教练简介和擅长方向标签 | COACHING_NOT_A_COACH（404）: 表示用户已是教练角色（isCoach=true）但尚未创建 CoachProfile 记录（惰性创建机制，见 coaching.md 6.9 节），使用空值初始化表单（首次编辑场景）；注意：此处不是指用户不是教练——CoachGuard 已提前过滤非教练用户；其他: 显示 PageError 组件 |
| `PUT /api/coaches/me` | 用户点击"保存"按钮 | message.success 提示"保存成功"，返回上一页 | 根据错误码显示对应字段的错误提示（见下方错误处理表） |

**教练资料更新错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| COACHING_INVALID_BIO | "简介不能超过 500 个字符" |
| COACHING_INVALID_SPECIALTY | "请选择有效的擅长方向" |
| COACHING_COACH_ROLE_REQUIRED | "请先在设置中开启教练模式" |

**交互流程**:

```
用户进入 /profile/coach-edit 页面
  → CoachGuard 检查用户是否为教练角色（currentUser.isCoach）
    → 非教练 → 提示"请先在设置中开启教练模式"，提供跳转到 /settings 的按钮
    → 是教练 → 继续加载页面

  → 调用 GET /api/coaches/:id（:id = 当前用户 ID）获取教练资料
    → 成功 → 回填 bio 和 specialties 到表单
    → COACHING_NOT_A_COACH → 说明尚未创建教练资料，表单使用空值初始化（首次编辑）

用户编辑表单:
  → 修改教练简介（多行文本输入框）
  → 选择/取消擅长方向标签（单打、双打、步法、体能、战术，可多选）

用户点击"保存":
  1. 前端校验（见关键业务逻辑 6.2）
  2. 校验不通过 → 显示对应字段错误
  3. 校验通过 → 调用 PUT /api/coaches/me { bio, specialties }
  4. 成功 → message.success("保存成功") → 返回上一页
  5. 失败 → 显示对应错误提示
```

**组件结构**:

```
CoachProfileEditPage
├── CoachGuard                   # 共享组件：教练角色保护
├── TopBar                       # 共享组件：顶部栏（返回按钮 + "教练资料" + "保存"按钮）
├── CoachBioInput                # 教练简介输入框（多行文本，最长 500 字符）
└── SpecialtySelector            # 擅长方向标签选择器（5 个预定义标签，可多选）
```

---

### SettingsPage 页面

**UI 原型**: `docs/prototypes/prototype-settings.png`

**路由**: `/settings`

**功能**: 应用设置页面，包含教练模式开关（仅在非教练用户时可操作）、修改手机号入口（一期不可用，显示为灰色不可点击）、关于我们、退出登录。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| currentUser | `User \| null` | useCurrentUser hook | 当前用户信息（判断 isCoach 状态） |
| isEnablingCoach | boolean | API 请求状态 | 开启教练角色请求进行中 |
| showLogoutConfirm | boolean | 用户操作 | 退出登录确认弹窗显示状态 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `PUT /api/users/me/coach-role` | 用户开启"教练模式"开关 | message.success 提示"教练模式已开启"，invalidate useCurrentUser 缓存（更新 isCoach 状态） | 根据错误码显示提示（见下方错误处理表） |

**教练角色开启错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| USER_INVALID_COACH_ROLE | "操作失败，请重试" |
| USER_COACH_ROLE_CLOSE_NOT_SUPPORTED | 前端不会触发（开关仅支持开启方向），保底提示"当前不支持关闭教练模式" |

**交互流程**:

```
用户进入 /settings 页面
  → 通过 useCurrentUser 获取当前用户信息

页面渲染:
  - 教练模式开关:
    - currentUser.isCoach = true → 开关显示为开启状态且不可操作（一期不支持关闭教练角色）
    - currentUser.isCoach = false → 开关显示为关闭状态，可点击开启

教练模式开关操作:
  1. 用户点击开关（从关闭切到开启）
  2. 弹出确认弹窗: "开启教练模式后，您可以发布团课和私教课。确认开启？"
  3. 用户确认 → 调用 PUT /api/users/me/coach-role { isCoach: true }
  4. 成功 → message.success("教练模式已开启") → invalidate useCurrentUser 缓存 → 开关状态更新为开启（不可操作）
  5. 失败 → message.error 提示错误信息 → 开关状态恢复

修改手机号:
  → 一期不可用，显示为灰色不可点击，点击后 message.info("该功能暂未开放")

关于我们:
  → 显示应用版本信息（静态页面或弹窗）

退出登录:
  1. 用户点击"退出登录"
  2. 弹出确认弹窗（ConfirmDialog）: "确定退出登录？"
  3. 用户确认 → authStore.clearAuth()（清除 token、userId、localStorage）→ 重定向到 /login
  4. 用户取消 → 关闭弹窗
```

**组件结构**:

```
SettingsPage
├── TopBar                       # 共享组件：顶部栏（返回按钮 + "设置"）
├── SettingsList                 # 设置项列表
│   ├── CoachModeSwitch          # 教练模式开关（Switch 组件 + 标签）
│   ├── SettingsLinkItem         # "修改手机号"入口（灰色不可点击）
│   └── SettingsLinkItem         # "关于我们"入口
├── LogoutButton                 # "退出登录"按钮（红色文字）
└── ConfirmDialog                # 共享组件：确认弹窗（退出登录 / 开启教练模式确认）
```

---

## 3. Feature 私有组件

| 组件 | 用途 | 使用页面 |
|------|------|---------|
| UserInfoSection | 用户信息展示区域（头像、昵称、简介），头像使用共享 UserAvatar | UserProfilePage |
| MatchStatsCard | 战绩汇总卡片，展示总场次、胜场、胜率三个数据指标 | UserProfilePage |
| QuickLinkList | 快捷入口列表容器 | UserProfilePage |
| QuickLinkItem | 单个快捷入口行（左侧图标 + 文字 + 右侧箭头），点击跳转目标路由 | UserProfilePage |
| AvatarEditor | 头像编辑区域（头像预览 + URL 输入框），预览使用 UserAvatar 组件 | ProfileEditPage |
| ProfileForm | 个人资料编辑表单（昵称、简介、手机号只读展示） | ProfileEditPage |
| PhoneDisplay | 脱敏手机号只读展示组件（如 138****5678） | ProfileEditPage |
| CoachBioInput | 教练简介多行文本输入框，含字数统计（最长 500 字符） | CoachProfileEditPage |
| SpecialtySelector | 擅长方向标签多选组件，5 个预定义标签（单打、双打、步法、体能、战术） | CoachProfileEditPage |
| CoachModeSwitch | 教练模式开关组件，含开关状态和文字标签 | SettingsPage |
| SettingsLinkItem | 设置项入口行（文字 + 右侧箭头或状态描述），支持 disabled 状态 | SettingsPage |
| LogoutButton | 退出登录按钮（红色文字，居中显示） | SettingsPage |

## 4. Feature 私有 Hooks

| Hook | 用途 | 使用页面 |
|------|------|---------|
| useUserProfile | 获取指定用户公开信息（useQuery 封装 GET /api/users/:id） | UserProfilePage |
| useMatchStats | 获取指定用户战绩汇总（useQuery 封装 GET /api/users/:id/match-stats） | UserProfilePage |
| useUpdateProfile | 更新个人资料（useMutation 封装 PUT /api/users/me），成功后 invalidate useCurrentUser 缓存 | ProfileEditPage |
| useCoachProfile | 获取教练资料（useQuery 封装 GET /api/coaches/:id），处理 COACHING_NOT_A_COACH 错误为空数据（首次编辑场景） | CoachProfileEditPage |
| useUpdateCoachProfile | 更新教练资料（useMutation 封装 PUT /api/coaches/me） | CoachProfileEditPage |
| useEnableCoachRole | 开启教练角色（useMutation 封装 PUT /api/users/me/coach-role），成功后 invalidate useCurrentUser 缓存 | SettingsPage |

## 5. 消费的后端接口汇总

| 接口 | 提供方 | 调用页面 | 调用场景 |
|------|--------|---------|---------|
| `GET /api/users/:id` | user | UserProfilePage | 页面加载时获取用户公开信息 |
| `GET /api/users/:id/match-stats` | match-record | UserProfilePage | 页面加载时获取战绩汇总统计 |
| `GET /api/users/me` | user | ProfileEditPage | 页面加载时获取当前用户信息回填表单（通过 useCurrentUser） |
| `PUT /api/users/me` | user | ProfileEditPage | 用户点击"保存"提交资料修改 |
| `GET /api/coaches/:id` | coaching | CoachProfileEditPage | 页面加载时获取教练资料回填表单 |
| `PUT /api/coaches/me` | coaching | CoachProfileEditPage | 用户点击"保存"提交教练资料修改 |
| `PUT /api/users/me/coach-role` | user | SettingsPage | 用户开启教练模式开关 |

## 6. 关键业务逻辑

### 6.1 个人资料编辑 -- 前端校验规则

| 字段 | 校验规则 | 错误提示 | 触发时机 |
|------|---------|---------|---------|
| nickname | 必填；长度 2-20 个字符；不可为纯空白字符 | "昵称长度需在 2-20 个字符之间" | 点击"保存"时 |
| avatarUrl | 选填；非空时必须以 `http://` 或 `https://` 开头 | "请输入合法的头像链接" | 点击"保存"时 |
| bio | 选填；最长 200 个字符 | "简介不能超过 200 个字符" | 点击"保存"时 |

说明：前端校验为即时反馈，后端仍会做同样的校验。前端校验通过后才发起 API 请求，减少无效请求。

### 6.2 教练资料编辑 -- 前端校验规则

| 字段 | 校验规则 | 错误提示 | 触发时机 |
|------|---------|---------|---------|
| bio | 选填；最长 500 个字符 | "简介不能超过 500 个字符" | 点击"保存"时 |
| specialties | 选填；每个值必须在预定义枚举范围内（singles, doubles, footwork, fitness, tactics） | "请选择有效的擅长方向" | 点击"保存"时 |

### 6.3 教练模式开关行为

```
状态判断:
  - currentUser.isCoach = false → 开关关闭，可操作
  - currentUser.isCoach = true → 开关开启，不可操作（一期不支持关闭教练角色）

开启教练模式:
  1. 用户切换开关（关 → 开）→ 弹出确认弹窗
  2. 确认 → 调用 PUT /api/users/me/coach-role { isCoach: true }
  3. 成功 → invalidate useCurrentUser 缓存 → isCoach 更新为 true → 开关锁定为开启
  4. 失败 → 开关恢复为关闭状态

注意:
  - 已开启教练模式的用户再次调用此接口为幂等操作（后端不报错），但前端不会触发（开关已锁定）
  - 开启教练模式后，底部导航"我的"页面不变，但用户可以通过"个人资料" → "教练资料编辑"和"我的课程管理"访问教练功能
```

### 6.4 个人主页的 isOwnProfile 判断

```
判断逻辑:
  1. 从路由参数获取 :id
  2. 从 authStore 获取当前登录用户的 userId
  3. isOwnProfile = (:id === userId)

底部导航 Tab "我的" 入口:
  - 路由为 /users/me，前端在路由层将 /users/me 解析为 /users/{当前用户 ID}
  - 或直接在 BottomTabBar 中将"我的" Tab 链接设为 /users/{authStore.userId}

isOwnProfile 影响:
  - true: 显示快捷入口列表；TopBar 不显示返回按钮；显示 BottomTabBar
  - false: 不显示快捷入口列表；TopBar 显示返回按钮；不显示 BottomTabBar
```

### 6.5 资料编辑的未保存变更检测

```
ProfileEditPage 和 CoachProfileEditPage 都需要检测未保存的变更:

初始化:
  页面加载后，记录初始表单值（来自 API 响应）

变更检测:
  比较当前表单值与初始值:
  - 有差异 → 标记 isDirty = true
  - 无差异 → isDirty = false

离开页面时:
  - isDirty = true → 弹出 ConfirmDialog "有未保存的修改，确定离开？"
  - isDirty = false → 直接离开

保存成功后:
  - isDirty 重置为 false（允许正常离开）
```

### 6.6 设置页中不可用功能的处理

```
修改手机号（一期不可用）:
  - 显示为灰色文字 + 右箭头（视觉上为禁用状态）
  - 点击后 message.info("该功能暂未开放")
  - 不跳转任何页面

关于我们:
  - 点击后跳转到一个简单的静态信息页面或弹窗
  - 显示应用名称"羽约"、版本号、联系方式等基本信息
```
