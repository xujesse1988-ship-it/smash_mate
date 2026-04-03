# Feature 详细设计: web-app — notification

> 本文档描述 web-app 的 notification feature 的页面细节。
> 整体架构（路由结构、共享层、类型定义）见 `web-app.md`。

## 1. Feature 概述

- **职责**: 提供通知消息的列表展示、已读/未读筛选、标记已读（单条/全部）、点击通知跳转到对应目标页面
- **包含页面**: 通知列表页（NotificationListPage）
- **对应后端模块**: notification

---

## 2. 页面与路由

### NotificationListPage 页面

**路由**: `/notifications`

**UI 原型**: docs/prototypes/prototype-notifications.png

**功能**: 展示当前用户的站内通知列表，按时间倒序排列。支持已读/未读筛选、标记单条已读、一键全部标记已读。点击通知项可跳转到对应的目标页面（活动详情、团课详情、私教预约管理、教练主页），同时标记该通知为已读。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| filterStatus | `'all' \| 'unread' \| 'read'` | 用户切换 | 筛选条件：全部 / 未读 / 已读，默认 `'all'` |
| notifications | `Notification[]` | API 响应 | 当前页的通知列表数据 |
| total | number | API 响应 | 符合筛选条件的通知总数 |
| isLoading | boolean | API 请求状态 | 通知列表加载中 |
| isMarkingAllRead | boolean | API 请求状态 | "全部已读"操作进行中 |

> 注：分页状态（当前页码、是否有下一页等）由 useInfiniteQuery 内部管理，无需在页面状态中维护。

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/notifications` | 页面加载、筛选条件切换、分页切换、标记已读后 | 渲染通知列表 | 显示 PageError 组件 |
| `PUT /api/notifications/:id/read` | 用户点击通知项时 | 更新该通知的 isRead 为 true，刷新未读计数，跳转到目标页面 | message.error 提示"操作失败" |
| `PUT /api/notifications/read-all` | 用户点击"全部已读"按钮时 | message.success 提示"已全部标记为已读"，刷新通知列表和未读计数 | message.error 提示"操作失败" |
| `GET /api/notifications/unread-count` | 标记已读或全部已读后（通过 invalidate useUnreadCount 的 query） | 更新 TopBar 角标数字 | 静默失败（角标不更新） |

**交互流程**:

```
用户点击 TopBar 通知图标 → 进入 /notifications 页面

页面加载:
  1. 调用 GET /api/notifications?page=1&pageSize=20（默认不传 isRead，获取全部通知）
  2. 渲染通知列表（未读通知显示未读标记圆点，已读通知样式变淡）
  3. 若列表为空 → 显示 EmptyState（"暂无通知"）

筛选切换:
  1. 用户点击筛选 Tab（全部 / 未读 / 已读）
  2. 重置 page = 1
  3. 调用 GET /api/notifications?page=1&pageSize=20&isRead={true/false/不传}
  4. 重新渲染通知列表

点击通知项:
  1. 如果该通知 isRead = false → 使用乐观更新立即标记为已读（参见 6.6 节），不阻塞页面跳转
  2. 根据 targetType 跳转到对应目标页面:
     - activity → /activities/:targetId
     - group-class → /group-classes/:targetId
     - private-lesson → /my-courses（教练视角：PRIVATE_LESSON_BOOKED、PRIVATE_LESSON_CANCELLED_BY_STUDENT）
     - coach-profile → /coaches/:targetId
  3. 如果已是已读状态 → 直接跳转，不调用标记已读接口

全部标记已读:
  1. 用户点击"全部已读"按钮
  2. 弹出确认提示（可选，轻量操作可不弹）
  3. 调用 PUT /api/notifications/read-all
  4. 成功 → message.success("已全部标记为已读")
  5. invalidate 通知列表 query 和未读计数 query（刷新列表和角标）
  6. 如当前筛选为"未读" → 列表变空，显示 EmptyState

上拉加载更多:
  1. 用户滚动到底部 → 加载下一页 GET /api/notifications?page={next}&pageSize=20&isRead={...}
  2. 追加到现有列表（使用 useInfiniteScroll）
  3. 无更多数据时显示"没有更多了"
```

**组件结构**:

```
NotificationListPage
├── NotificationFilter         # 筛选 Tab（全部 / 未读 / 已读）
├── MarkAllReadButton          # "全部已读"按钮（有未读通知时显示）
├── NotificationList           # 通知列表容器
│   └── NotificationItem       # 单条通知项（标题、内容、时间、未读标记）
├── EmptyState                 # 空状态（共享组件）
└── LoadingSpinner             # 加载状态（共享组件）
```

---

## 3. Feature 私有组件

| 组件 | 用途 | 使用页面 |
|------|------|---------|
| NotificationFilter | 通知筛选 Tab 组件，包含"全部"、"未读"、"已读"三个选项；切换时触发列表刷新 | NotificationListPage |
| MarkAllReadButton | "全部已读"按钮，仅在存在未读通知时显示；点击后调用全部已读接口；loading 状态下禁用 | NotificationListPage |
| NotificationList | 通知列表容器，接收通知数组并渲染 NotificationItem 列表；处理上拉加载更多逻辑 | NotificationListPage |
| NotificationItem | 单条通知展示组件；显示通知标题（title）、内容（content）、时间（createdAt，相对时间格式如"5 分钟前"）；未读通知左侧显示蓝色圆点标记，整体背景色区分已读/未读；点击触发标记已读和跳转 | NotificationListPage |

## 4. Feature 私有 Hooks

| Hook | 用途 | 使用页面 |
|------|------|---------|
| useNotifications | 封装通知列表查询（useInfiniteQuery），支持 isRead 筛选参数；返回通知列表、加载状态、分页信息、fetchNextPage 方法 | NotificationListPage |
| useMarkAsRead | 封装标记单条通知已读（useMutation），成功后 invalidate 通知列表和未读计数的 query key | NotificationListPage |
| useMarkAllAsRead | 封装全部标记已读（useMutation），成功后 invalidate 通知列表和未读计数的 query key | NotificationListPage |
| useNotificationNavigate | 封装通知跳转逻辑，根据 targetType 和 targetId 计算目标路由并执行 navigate；private-lesson 类型固定跳转 `/my-courses`，不使用 targetId | NotificationListPage |

## 5. 消费的后端接口汇总

| 接口 | 提供方 | 调用页面 | 调用场景 |
|------|--------|---------|---------|
| `GET /api/notifications` | notification | NotificationListPage | 页面加载时获取通知列表，筛选切换时重新获取 |
| `GET /api/notifications/unread-count` | notification | NotificationListPage（间接，通过 invalidate 共享 hook useUnreadCount） | 标记已读/全部已读后刷新 TopBar 角标 |
| `PUT /api/notifications/:id/read` | notification | NotificationListPage | 用户点击通知项时标记该通知为已读 |
| `PUT /api/notifications/read-all` | notification | NotificationListPage | 用户点击"全部已读"按钮时标记所有未读通知为已读 |

## 6. 关键业务逻辑

### 6.1 通知跳转路由映射

根据通知的 `targetType` 字段，将通知点击跳转映射到对应的前端路由：

| targetType | 前端跳转路由 | 说明 |
|-----------|-------------|------|
| activity | `/activities/:targetId` | 活动详情页 |
| group-class | `/group-classes/:targetId` | 团课详情页 |
| private-lesson | `/my-courses` | 教练的课程管理页（教练视角） |
| coach-profile | `/coaches/:targetId` | 教练主页（查看评价列表） |

说明：
- `private-lesson` targetType 仅用于教练视角的通知（PRIVATE_LESSON_BOOKED、PRIVATE_LESSON_CANCELLED_BY_STUDENT），跳转到教练的课程管理页 `/my-courses`，不使用 targetId 作为路由参数。
- 学员收到的 PRIVATE_LESSON_CANCELLED_BY_COACH 通知，后端设定的 targetType 为 `coach-profile`（targetId 为教练用户 ID），自动走 `coach-profile → /coaches/:targetId` 的跳转逻辑，无需前端额外处理。

### 6.2 未读状态视觉区分

```
未读通知:
  - 左侧显示蓝色圆点标记（直径 8px）
  - 背景色使用浅蓝底色（如 #F0F5FF）
  - 标题文字加粗

已读通知:
  - 无圆点标记
  - 背景色使用白色
  - 标题文字正常粗细，内容文字颜色变淡（如 #999）
```

### 6.3 时间格式化

通知的 `createdAt` 字段在列表中展示为相对时间格式：

| 时间范围 | 展示格式 | 示例 |
|---------|---------|------|
| 1 分钟以内 | "刚刚" | 刚刚 |
| 1-59 分钟 | "{n} 分钟前" | 5 分钟前 |
| 1-23 小时 | "{n} 小时前" | 3 小时前 |
| 1-6 天 | "{n} 天前" | 2 天前 |
| 7 天以上 | "MM-DD HH:mm" | 03-25 14:30 |
| 跨年 | "YYYY-MM-DD HH:mm" | 2025-12-20 09:15 |

### 6.4 筛选与分页交互

```
筛选切换时:
  1. 重置分页到第 1 页
  2. 清空已加载的通知列表
  3. 重新发起查询请求
  4. 滚动到页面顶部

isRead 参数映射:
  - 筛选"全部" → 不传 isRead 参数
  - 筛选"未读" → isRead=false
  - 筛选"已读" → isRead=true

分页策略:
  - 使用无限滚动加载（useInfiniteScroll），每次加载 20 条
  - 到底部自动触发加载下一页
  - 所有数据加载完毕后显示"没有更多了"提示
```

### 6.5 "全部已读"按钮显示逻辑

```
"全部已读"按钮的显示条件:
  - 存在未读通知时显示（通过 useUnreadCount 的 count > 0 判断）
  - 没有未读通知时隐藏按钮
  - 按钮位于筛选 Tab 右侧，与筛选 Tab 同一行

操作后的更新:
  1. 调用 PUT /api/notifications/read-all 成功
  2. invalidate 通知列表 query → 列表中所有通知变为已读样式
  3. invalidate 未读计数 query → TopBar 角标消失
  4. 按钮自身隐藏（因为 count 变为 0）
```

### 6.6 标记已读与跳转的顺序

```
用户点击未读通知项:
  1. 立即执行乐观更新（optimistic update）：本地将该通知 isRead 设为 true，更新视觉样式
  2. 同时发起 PUT /api/notifications/:id/read 请求（不阻塞跳转）
  3. 立即根据 targetType 执行页面跳转
  4. 后台异步 invalidate 未读计数 query（目标页面加载后 TopBar 角标更新）
  5. 如果标记已读请求失败 → 不回滚视觉状态（因为用户已跳转到其他页面，保持操作流畅）

用户点击已读通知项:
  1. 不调用标记已读接口
  2. 直接根据 targetType 执行页面跳转
```

### 6.7 错误码到用户提示映射

| error.code | 用户提示 |
|-----------|---------|
| NOTIFICATION_NOT_FOUND | 通知不存在 |
| NOTIFICATION_FORBIDDEN | 无权操作此通知 |
