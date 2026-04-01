# 羽约 (SmashMate) 系统架构文档

> 本文档描述**系统级**架构：模块划分、依赖关系、跨模块数据流、接口通用约定、部署概要。
> 每个模块的内部设计和接口契约见 module-design/{module}.md。

## 1. 技术选型

| 类别 | 选择 |
|------|------|
| 语言 | TypeScript（全栈） |
| 运行时 | Node.js |
| 后端框架 | Express |
| ORM | Prisma |
| 数据库 | PostgreSQL |
| 前端框架 | React + Vite |
| 路由 | React Router |
| UI 组件库 | Ant Design |
| 数据请求 | TanStack Query |
| 状态管理 | Zustand |
| 单元/集成测试 | Vitest + React Testing Library |
| 前端 Mock | MSW (Mock Service Worker) |
| E2E 测试 | Playwright |
| 代码规范 | ESLint + Prettier |

## 2. 模块划分

### 2.1 模块总览

| 模块 | 类型 | 端 | 职责（一句话） |
|------|------|-----|--------------|
| infra | 技术模块 | 后端 | 基础设施：数据库连接、配置管理、认证中间件、全局错误处理、标准响应格式、日志 |
| user | 业务模块 | 后端 | 用户注册/登录、身份认证、个人资料管理、教练角色管理 |
| activity | 业务模块 | 后端 | 约球活动的创建、加入、退出、修改、取消、状态流转 |
| coaching | 业务模块 | 后端 | 教练资料、团课发布与报名、私教时间设置与预约、课程状态流转 |
| match-record | 业务模块 | 后端 | 战绩录入、删除、个人战绩汇总统计 |
| venue | 业务模块 | 后端 | 球馆数据管理、球馆搜索、城市管理、定时数据更新 |
| notification | 业务模块 | 后端 | 站内通知的创建、查询、已读标记、过期清理 |
| review | 业务模块 | 后端 | 学员对教练的评价评分、教练平均分计算 |
| web-app | 业务模块 | 前端 | 用户端 SPA，提供约球、找教练、战绩记录、通知等功能（10 个核心页面） |
| admin | 业务模块 | 前端 | 管理后台，提供城市管理、球馆管理功能（3 个页面） |

### 2.2 业务模块与 PRD 映射

| 业务模块（PRD） | 技术模块 | 说明 |
|----------------|---------|------|
| 用户管理（FA） | user | 1:1 直接对应 |
| 约球（FB） | activity | 1:1 直接对应 |
| 教练管理（FC） | coaching | 1:1 直接对应（含团课、私教） |
| 战绩记录（FD） | match-record | 1:1 直接对应 |
| 球馆管理（FE） | venue | 1:1 直接对应 |
| 通知（FF） | notification | 1:1 直接对应 |
| 评价评分（FG） | review | 1:1 直接对应 |
| 管理后台（FH） | admin（前端）+ venue（后端管理接口） | 前端独立模块，后端复用 venue 和 user 的管理接口 |

### 2.3 模块定义

#### infra
- **职责**: 数据库连接、配置管理、JWT 认证中间件、全局错误处理、标准响应格式、结构化日志
- **修改权限**: 仅技术负责人审批后修改（业务模块开发期间）

#### user
- **职责**: 用户注册/登录（手机号+验证码）、JWT 令牌签发与刷新、个人资料管理、教练角色开启（一期不支持关闭）、个人主页数据聚合
- **边界**: 负责身份认证与用户资料；不负责教练的课程管理（属于 coaching）；不负责战绩数据（属于 match-record，但个人主页会聚合展示）
- **对外接口**:
  - `POST /api/auth/send-code` — 发送验证码
  - `POST /api/auth/login` — 登录/注册
  - `GET /api/users/me` — 获取当前用户信息
  - `PUT /api/users/me` — 更新个人资料
  - `PUT /api/users/me/coach-role` — 开启教练角色（一期仅支持开启，不支持关闭）
  - `GET /api/users/:id` — 获取用户公开信息（个人主页）
  - `UserService.getUserById(id)` — 模块间调用：获取用户基本信息
  - `UserService.getUsersByIds(ids)` — 模块间调用：批量获取用户基本信息
- **详细设计**: module-design/user.md

#### activity
- **职责**: 约球活动的全生命周期管理（创建、加入、退出、修改、取消、状态自动流转）
- **边界**: 负责活动参与关系管理；不负责球馆数据（通过 venue 获取）；不负责活动内的战绩（属于 match-record）；不负责通知发送（通过 notification 创建通知）
- **对外接口**:
  - `POST /api/activities` — 创建活动
  - `GET /api/activities` — 活动列表（支持筛选、分页）
  - `GET /api/activities/:id` — 活动详情
  - `POST /api/activities/:id/join` — 加入活动
  - `POST /api/activities/:id/leave` — 退出活动
  - `PUT /api/activities/:id` — 修改活动
  - `POST /api/activities/:id/cancel` — 取消活动
  - `GET /api/users/:id/activities` — 用户参与的活动列表
  - `ActivityService.getActivityById(id)` — 模块间调用：获取活动信息
  - `ActivityService.getParticipantIds(activityId)` — 模块间调用：获取活动参与者 ID 列表
- **详细设计**: module-design/activity.md

#### coaching
- **职责**: 教练资料管理、团课发布与报名管理、私教时间设置与预约管理、课程状态自动流转
- **边界**: 负责教练维度的课程和预约管理；不负责用户基本信息（通过 user 获取）；不负责球馆数据（通过 venue 获取）；不负责评价（属于 review）；不负责通知发送（通过 notification 创建）
- **对外接口**:
  - `GET /api/coaches` — 教练列表（支持筛选、分页）
  - `GET /api/coaches/:id` — 教练主页
  - `PUT /api/coaches/me` — 更新教练资料
  - `POST /api/group-classes` — 发布团课
  - `GET /api/group-classes/:id` — 团课详情
  - `PUT /api/group-classes/:id` — 修改团课
  - `POST /api/group-classes/:id/cancel` — 取消团课
  - `POST /api/group-classes/:id/enroll` — 报名团课
  - `POST /api/group-classes/:id/cancel-enrollment` — 取消团课报名
  - `POST /api/private-lessons/availability` — 设置私教空闲时间
  - `GET /api/coaches/:id/availability` — 获取教练空闲时间
  - `POST /api/private-lessons/book` — 预约私教课
  - `POST /api/private-lessons/:id/cancel` — 取消私教预约
  - `GET /api/users/:id/enrollments` — 用户的课程报名列表
  - `CoachingService.getGroupClassById(id)` — 模块间调用：获取团课信息
  - `CoachingService.getPrivateLessonById(id)` — 模块间调用：获取私教课信息
  - `CoachingService.getParticipantIds(classId, type)` — 模块间调用：获取课程参与者
- **详细设计**: module-design/coaching.md

#### match-record
- **职责**: 战绩录入（单打/双打）、战绩删除、按活动查看战绩列表、个人战绩历史与汇总统计
- **边界**: 负责战绩数据的写入和统计；不负责活动/课程的管理（通过 activity/coaching 校验参与关系）；非平台用户（临时用户）的存储属于本模块
- **对外接口**:
  - `POST /api/match-records` — 录入战绩
  - `DELETE /api/match-records/:id` — 删除战绩
  - `GET /api/activities/:id/match-records` — 活动的战绩列表
  - `GET /api/group-classes/:id/match-records` — 团课的战绩列表
  - `GET /api/private-lessons/:id/match-records` — 私教课的战绩列表
  - `GET /api/users/:id/match-records` — 个人战绩历史
  - `GET /api/users/:id/match-stats` — 个人战绩汇总
- **详细设计**: module-design/match-record.md

#### venue
- **职责**: 球馆数据的获取、存储、搜索，城市管理，定时更新球馆数据
- **边界**: 负责球馆和城市的 CRUD 以及地图服务集成；不负责活动或课程的关联逻辑
- **对外接口**:
  - `GET /api/venues/search` — 球馆搜索（关键词 + 可选经纬度排序）
  - `GET /api/venues/:id` — 球馆详情
  - `POST /api/admin/cities` — 添加城市（管理员）
  - `DELETE /api/admin/cities/:id` — 移除城市（管理员）
  - `GET /api/admin/cities` — 城市列表（管理员）
  - `GET /api/admin/venues` — 球馆列表（管理员）
  - `DELETE /api/admin/venues/:id` — 移除球馆（管理员）
  - `POST /api/admin/venues/sync` — 手动触发球馆数据更新（管理员）
  - `VenueService.getVenueById(id)` — 模块间调用：获取球馆信息
- **详细设计**: module-design/venue.md

#### notification
- **职责**: 站内通知的创建、查询（已读/未读）、标记已读、未读计数、过期自动清理
- **边界**: 负责通知的存储和查询；不负责决定何时发送通知（由业务模块调用本模块创建通知）；不负责短信/推送等外部渠道
- **对外接口**:
  - `GET /api/notifications` — 通知列表（分页、已读/未读筛选）
  - `GET /api/notifications/unread-count` — 未读通知数
  - `PUT /api/notifications/:id/read` — 标记单条已读
  - `PUT /api/notifications/read-all` — 全部标记已读
  - `NotificationService.create(notification)` — 模块间调用：创建通知（供其他业务模块调用）
- **详细设计**: module-design/notification.md

#### review
- **职责**: 学员对教练提交评价评分、评价列表查询、教练平均评分计算
- **边界**: 负责评价数据的写入和查询；不负责教练资料管理（属于 coaching）；需通过 coaching 校验学员是否参加过该教练的课程
- **对外接口**:
  - `POST /api/reviews` — 提交评价
  - `GET /api/coaches/:id/reviews` — 教练的评价列表（分页）
  - `ReviewService.getCoachAverageRating(coachId)` — 模块间调用：获取教练平均评分
  - `ReviewService.getCoachReviewCount(coachId)` — 模块间调用：获取评价数量
- **详细设计**: module-design/review.md

#### web-app（前端）
- **职责**: 用户端 SPA，提供约球、找教练、战绩记录、通知查看、个人主页等功能
- **边界**: 所有面向普通用户和教练用户的页面
- **页面数**: 约 15 个页面
- **Feature 划分**:
  - `auth`（注册/登录页）
  - `activity`（约球列表、发起约球页、活动详情页）
  - `coaching`（教练列表、教练主页、团课详情页、私教预约页、我的课程管理页）
  - `match-record`（战绩录入页、战绩历史列表页）
  - `profile`（个人主页、个人资料编辑页、教练资料编辑页、设置页）
  - `notification`（通知列表页）
- **调用的后端模块**: user, activity, coaching, match-record, venue, notification, review
- **详细设计**: module-design/web-app.md（整体）+ module-design/web-app-{feature}.md（逐 feature）

#### admin（前端）
- **职责**: 管理后台，提供城市管理和球馆管理功能
- **边界**: 仅管理员使用的管理页面
- **页面数**: 3 个页面（登录页、城市管理页、球馆管理页）
- **调用的后端模块**: user（管理员认证）, venue（城市/球馆管理接口）
- **详细设计**: module-design/admin.md

## 3. 模块依赖关系

### 3.1 依赖关系图

```
                         infra
            ┌──────┬──────┼──────┬──────┬──────┬──────┐
            ↓      ↓      ↓      ↓      ↓      ↓      ↓
          user   venue  notification  activity  coaching  match-record  review
                                        │        │          │            │
                                        │        │          │            │
                                        ↓        ↓          ↓            ↓
                                       user    user       user         user
                                       venue   venue     activity     coaching
                                   notification notification coaching
                                                          notification

  依赖方向（自上而下读）:
  activity    → user, venue, notification
  coaching    → user, venue, notification
  match-record → user, activity, coaching
  review      → user, coaching, notification

                              ↑ HTTP API ↑
                        web-app        admin
                       （调用后端 API）
```

### 3.2 依赖规则

- 所有后端业务模块依赖 infra（省略不画）
- 业务模块间依赖方向**单向**，禁止循环
- `user`、`venue`、`notification` 为基础层，不依赖其他业务模块
- `activity`、`coaching` 为中间层，依赖基础层
- `match-record`、`review` 为上层，依赖中间层和基础层
- 当出现双向需求时（如 coaching 需要 review 的评分数据），通过接口调用方向保持单向：coaching 不依赖 review，而是由 review 提供查询接口，前端在教练主页聚合展示

### 3.3 依赖矩阵

| 模块 | 依赖（调用方） | 被依赖（提供方） |
|------|-------------|----------------|
| user | infra | activity, coaching, match-record, review |
| venue | infra | activity, coaching |
| notification | infra | activity, coaching, review |
| activity | infra, user, venue, notification | match-record |
| coaching | infra, user, venue, notification | match-record, review |
| match-record | infra, user, activity, coaching | 无 |
| review | infra, user, coaching, notification | 无 |

## 4. 跨模块数据流

### 4.1 关键业务路径

**路径 1: 约球活动全流程（发起 → 加入 → 结束 → 录入战绩）**

```
用户请求 POST /api/activities
  → activity.Controller
  → activity.Service 校验参数
  → 调用 venue.Service.getVenueById(venueId) 验证球馆存在
  → activity.Repository 创建活动
  → 返回活动信息

用户请求 POST /api/activities/:id/join
  → activity.Controller
  → activity.Service 校验活动状态和名额
  → activity.Repository 添加参与者
  → 调用 notification.Service.create() 通知发起人
  → 返回成功

定时任务触发（活动状态流转）
  → activity.Service 扫描并更新状态（报名中→进行中→已结束）

用户请求 POST /api/match-records
  → match-record.Controller
  → match-record.Service 校验参数
  → 调用 activity.Service.getParticipantIds(activityId) 校验参与关系
  → match-record.Repository 创建战绩记录
  → 返回成功
```

**路径 2: 教练团课全流程（发布 → 报名 → 结束 → 评价 + 战绩）**

```
教练请求 POST /api/group-classes
  → coaching.Controller
  → coaching.Service 校验教练身份
  → 调用 venue.Service.getVenueById(venueId) 验证球馆
  → coaching.Repository 创建团课
  → 返回团课信息

学员请求 POST /api/group-classes/:id/enroll
  → coaching.Controller
  → coaching.Service 校验团课状态和名额
  → coaching.Repository 添加报名记录
  → 调用 notification.Service.create() 通知教练
  → 返回成功

学员请求 POST /api/reviews
  → review.Controller
  → review.Service 校验参数
  → 调用 coaching.Service.getParticipantIds(classId, type) 校验学员参与关系
  → review.Repository 创建评价
  → 调用 notification.Service.create() 通知教练
  → 返回成功
```

**路径 3: 私教预约流程**

```
教练请求 POST /api/private-lessons/availability
  → coaching.Controller
  → coaching.Service 校验教练身份、时间段不重叠
  → 调用 venue.Service.getVenueById() 验证可选球馆（如有）
  → coaching.Repository 创建空闲时间段
  → 返回成功

学员请求 POST /api/private-lessons/book
  → coaching.Controller
  → coaching.Service 校验时间段可用、球馆选择合法
  → coaching.Repository 创建预约记录、标记时间段为已预约
  → 调用 notification.Service.create() 通知教练（有新预约）
  → 调用 notification.Service.create() 通知学员（预约成功确认）
  → 返回成功

学员请求 POST /api/private-lessons/:id/cancel
  → coaching.Controller
  → coaching.Service 校验预约存在、取消权限
  → coaching.Repository 更新预约状态为已取消、释放时间段
  → 调用 notification.Service.create() 通知教练（学员取消预约）
  → 调用 notification.Service.create() 通知学员（取消确认）
  → 返回成功

私教课结束后（定时任务触发状态流转为"已完成"）
  → 调用 notification.Service.create() 通知学员（课程已结束，可评价和录入战绩）
```

### 4.2 事件流

本项目一期不使用消息队列或事件总线，所有跨模块调用均为**同步服务调用**。通知创建通过 `notification.Service.create()` 同步调用。

如需异步化的场景（如球馆数据定时更新），使用 Node.js 定时任务（cron job / setInterval）实现，不引入额外中间件。

| 定时任务 | 所属模块 | 触发频率 | 处理逻辑 |
|---------|---------|---------|---------|
| 球馆数据更新 | venue | 每周一次 | 调用地图服务更新已添加城市的球馆数据 |
| 活动状态流转 | activity | 每分钟 | 扫描需要状态变更的活动（报名中→进行中→已结束） |
| 团课/私教状态流转 | coaching | 每分钟 | 扫描需要状态变更的课程 |
| 通知过期清理 | notification | 每天一次 | 删除 90 天前的通知 |

## 5. 目录结构

```
server/                        # 后端
├── modules/
│   ├── user/
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── activity/
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── coaching/
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── match-record/
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── venue/
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── notification/
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── review/
│       ├── controller.ts
│       ├── service.ts
│       ├── repository.ts
│       ├── types.ts
│       └── index.ts
├── infra/
│   ├── database.ts            # Prisma 客户端实例
│   ├── config.ts              # 环境变量与配置
│   ├── logger.ts              # 结构化日志
│   ├── auth.ts                # JWT 认证中间件
│   ├── admin-auth.ts          # 管理员认证中间件
│   ├── error-handler.ts       # 全局错误处理
│   ├── response.ts            # 标准响应格式
│   └── scheduler.ts           # 定时任务调度
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   └── seed.ts                # 种子数据
└── app.ts                     # Express 应用入口

web/                           # 前端 SPA
├── features/
│   ├── auth/
│   │   ├── pages/             # 注册/登录页
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api/
│   ├── activity/
│   │   ├── pages/             # 约球列表、发起约球、活动详情
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api/
│   ├── coaching/
│   │   ├── pages/             # 教练列表、教练主页、团课详情、私教预约、课程管理
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api/
│   ├── match-record/
│   │   ├── pages/             # 战绩录入、战绩历史
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api/
│   ├── profile/
│   │   ├── pages/             # 个人主页、资料编辑、教练资料编辑、设置
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api/
│   └── notification/
│       ├── pages/             # 通知列表
│       ├── components/
│       ├── hooks/
│       └── api/
├── shared/                    # 共享组件、hooks、工具函数、类型
├── stores/                    # 全局状态管理（Zustand）
├── routes.ts                  # 统一路由
└── main.tsx

admin/                         # 管理后台
├── features/
│   ├── auth/
│   │   ├── pages/             # 管理员登录
│   │   └── api/
│   └── venue-management/
│       ├── pages/             # 城市管理、球馆管理
│       ├── components/
│       └── api/
├── shared/
├── stores/
├── routes.ts
└── main.tsx

tests/
├── contracts/                 # 契约测试
│   ├── user/
│   ├── activity/
│   ├── coaching/
│   ├── match-record/
│   ├── venue/
│   ├── notification/
│   └── review/
├── unit/                      # 单元测试
│   ├── user/
│   ├── activity/
│   ├── coaching/
│   ├── match-record/
│   ├── venue/
│   ├── notification/
│   └── review/
├── integration/               # 集成测试
│   ├── user/                  # L1: 后端模块内集成
│   ├── activity/
│   ├── coaching/
│   ├── match-record/
│   ├── venue/
│   ├── notification/
│   ├── review/
│   ├── web-app/               # L1: 前端 feature 集成
│   │   ├── auth/
│   │   ├── activity/
│   │   ├── coaching/
│   │   ├── match-record/
│   │   ├── profile/
│   │   └── notification/
│   └── paths/                 # L2: 关键路径集成
├── e2e/                       # E2E 测试（按用户流程）
└── fixtures/                  # 共享测试数据（工厂函数）
```

## 6. 数据模型概览

> 只列出跨模块关系的数据模型。模块内部的数据模型详见 module-design/{module}.md。

### 模型关系总览

```
User 1 ← N Activity（一个用户可发起多个活动）
User N ← M Activity（多对多，通过 ActivityParticipant 关联）
User 1 ← N GroupClass（一个教练可发布多个团课）
User N ← M GroupClass（多对多，通过 GroupClassEnrollment 关联）
User 1 ← N PrivateLessonSlot（一个教练可设置多个空闲时间段）
User 1 ← N PrivateLesson（一个学员可预约多个私教课）
Venue 1 ← N Activity（一个球馆关联多个活动）
Venue 1 ← N GroupClass（一个球馆关联多个团课）
User 1 ← N MatchRecord（一个用户可录入多条战绩）
User 1 ← N Review（一个学员可提交多条评价）
User 1 ← N Notification（一个用户可收到多条通知）
```

### 跨模块数据关系

| 关系 | 模型A（模块） | 模型B（模块） | 关系类型 | 关联管理方 |
|------|-------------|-------------|---------|----------|
| 活动发起人 | User（user） | Activity（activity） | 1:N | activity（存储 creatorId 外键） |
| 活动参与者 | User（user） | Activity（activity） | N:M | activity（管理 ActivityParticipant 关联表） |
| 活动场地 | Venue（venue） | Activity（activity） | 1:N | activity（存储 venueId 外键） |
| 团课教练 | User（user） | GroupClass（coaching） | 1:N | coaching（存储 coachId 外键） |
| 团课报名 | User（user） | GroupClass（coaching） | N:M | coaching（管理 GroupClassEnrollment 关联表） |
| 团课场地 | Venue（venue） | GroupClass（coaching） | 1:N | coaching（存储 venueId 外键） |
| 私教教练 | User（user） | PrivateLessonSlot（coaching） | 1:N | coaching（存储 coachId 外键） |
| 私教学员 | User（user） | PrivateLesson（coaching） | 1:N | coaching（存储 studentId 外键） |
| 战绩关联活动 | Activity（activity） | MatchRecord（match-record） | 1:N | match-record（存储 sourceId + sourceType） |
| 战绩关联团课 | GroupClass（coaching） | MatchRecord（match-record） | 1:N | match-record（存储 sourceId + sourceType） |
| 战绩关联私教 | PrivateLesson（coaching） | MatchRecord（match-record） | 1:N | match-record（存储 sourceId + sourceType） |
| 战绩录入者 | User（user） | MatchRecord（match-record） | 1:N | match-record（存储 recordedBy 外键） |
| 评价关系 | User（user） | Review（review） | 1:N | review（存储 reviewerId 和 coachId 外键） |
| 通知接收者 | User（user） | Notification（notification） | 1:N | notification（存储 userId 外键） |

### 关键约束

- **外键行为**: User 删除时不级联删除业务数据（一期不支持注销账号，无需处理）；Venue 删除时使用 SET NULL 或保留引用（已关联的活动/课程不受影响，PRD 明确要求）
- **唯一约束**: 手机号唯一（User）；同一学员对同一次课程只能评价一次（Review）；同一时间段不可重复设置私教空闲（PrivateLessonSlot）
- **多态关联**: MatchRecord 通过 sourceType（activity / group-class / private-lesson）+ sourceId 关联到不同来源，而非使用多个外键列
- **跨模块数据一致性**: 一期采用数据库事务保证同模块内操作的原子性；跨模块调用（如创建通知）失败时不影响主流程（通知为非关键路径，记录日志后继续）

## 7. 关键架构决策

### 决策 1: 模块间通过 Service 层直接调用，不引入事件总线
- **问题**: 模块间如何通信（如 activity 创建后需要通知 notification）
- **方案**: 调用方直接 import 被调用方的 Service 方法
- **理由**: 一期业务复杂度低，模块数量可控，直接调用简单直观；事件总线增加理解成本和调试难度，等业务规模增长后再考虑引入

### 决策 2: 战绩来源使用多态关联（sourceType + sourceId）
- **问题**: 战绩可关联约球活动、团课、私教课三种来源
- **方案**: 使用 sourceType 枚举 + sourceId 字段，而非三个独立外键
- **理由**: 避免大量 nullable 外键列，扩展新来源时只需增加枚举值；查询时通过 sourceType 区分来源，业务逻辑清晰

### 决策 3: 活动/课程状态流转使用定时任务轮询
- **问题**: 活动开始时间到达后需自动变更状态（如"报名中"→"进行中"）
- **方案**: 使用定时任务每分钟扫描并更新需变更状态的记录
- **理由**: 实现简单，一期数据量小（百级活动），性能无压力；相比定时器/延迟队列方案，无需引入额外组件

### 决策 4: 管理员认证与用户认证分离
- **问题**: 管理后台需要独立认证，管理员账号不同于普通用户
- **方案**: 管理员使用预设账号密码登录，通过独立的 admin-auth 中间件认证，JWT 中包含 role: admin 标识
- **理由**: 一期管理后台功能极简（城市和球馆管理），不需要复杂的权限系统；与用户端认证解耦，安全隔离

### 决策 5: 通知创建失败不阻塞主流程
- **问题**: 业务操作中创建通知如果失败，是否应该回滚主操作
- **方案**: 通知创建放在主事务之外，失败时记录 error 日志但不影响主流程返回
- **理由**: 通知为辅助功能，不应影响核心业务操作的成功率；一期无补偿机制，通过日志监控发现丢失情况

### 决策 6: 教练评分由前端聚合，不在 coaching 模块存冗余字段
- **问题**: 教练主页需展示平均评分，coaching 是否需要存储冗余的平均分字段
- **方案**: 教练平均分由 review 模块实时计算并提供查询接口，前端在教练主页聚合展示；不在 coaching 存冗余字段
- **理由**: 保持模块间单向依赖（review → coaching，而非反向）；一期评价量小，实时计算无性能问题；避免数据同步的一致性问题

### 决策 7: 一期仅支持开启教练角色，不支持关闭
- **问题**: 用户开启教练角色后，是否允许再关闭回普通用户
- **方案**: 一期 `PUT /api/users/me/coach-role` 仅支持开启操作；不提供关闭教练角色的功能
- **理由**: 关闭教练角色涉及已发布课程、进行中预约、学员评价等关联数据的处理策略（取消/归档/保留），业务规则复杂；一期优先保障核心流程，后续版本再评估关闭需求和数据处理方案

## 8. 日志约定

> 所有模块统一的日志策略，由 infra 提供基础能力。

### 日志级别

| 级别 | 用途 | 示例 |
|------|------|------|
| error | 需要关注的异常 | 未捕获异常、外部服务（地图 API）调用失败、数据库连接失败 |
| warn | 潜在问题但不影响主流程 | 参数校验失败、通知创建失败、验证码发送频率超限 |
| info | 关键业务事件 | 请求进出、用户注册/登录、活动创建/加入/取消、课程报名 |
| debug | 开发调试信息 | SQL 查询、请求参数详情、定时任务执行细节（生产环境关闭） |

### 日志格式

```json
{
  "level": "info",
  "timestamp": "2026-04-01T10:30:00.000Z",
  "requestId": "uuid-v4",
  "module": "activity",
  "message": "User joined activity",
  "data": { "userId": "123", "activityId": "456" }
}
```

### 日志规则

- 每个请求通过中间件注入 `requestId`，贯穿整个调用链（包括跨模块 Service 调用）
- 日志输出到 stdout（JSON 格式），由运行环境负责收集
- 敏感信息（手机号、验证码、token）禁止写入日志；手机号如需记录，使用脱敏格式（如 138****1234）
- 日志级别通过环境变量 `LOG_LEVEL` 控制，默认 `info`
- 定时任务日志使用对应模块名标记（如 module: "venue-sync"）

## 9. 接口通用约定

> 各模块的接口契约定义在 module-design/{module}.md 中，此处定义所有模块共用的约定。

### 认证方式

- **用户端**: Bearer Token（JWT），登录成功后签发，有效期 7 天
- **管理后台**: Bearer Token（JWT），管理员登录后签发，token 中包含 `role: "admin"`
- **公开接口**: 不需要认证的接口（如发送验证码、登录/注册）在路由级别标注为公开
- **Token 传递**: 通过 HTTP Header `Authorization: Bearer <token>` 传递

### 响应格式

```json
// 成功
{ "data": { ... } }

// 成功（列表，含分页）
{ "data": { "items": [...], "total": 100, "page": 1, "pageSize": 20 } }

// 失败
{ "error": { "code": "ERROR_CODE", "message": "用户可读的错误描述" } }
```

### 分页约定

```
Request: GET /api/items?page=1&pageSize=20
Response:
{
  "data": { "items": [...], "total": 100, "page": 1, "pageSize": 20 }
}
```

- `page` 从 1 开始，默认为 1
- `pageSize` 默认为 20，最大为 100
- 响应中 `total` 为符合条件的总记录数

### HTTP 状态码

| 状态码 | 含义 | 使用场景 |
|--------|------|---------|
| 200 | 成功 | 查询、更新、删除操作 |
| 201 | 创建成功 | 创建资源（活动、团课、战绩等） |
| 400 | 参数错误 | 请求参数校验失败 |
| 401 | 未认证 | Token 缺失或过期 |
| 403 | 无权限 | 非发起人修改活动、非教练发布课程等 |
| 404 | 资源不存在 | 查询的活动/用户/球馆不存在 |
| 409 | 资源冲突 | 手机号已注册、时间段已被预约等 |
| 429 | 请求过于频繁 | 验证码发送频率限制 |
| 500 | 服务器错误 | 未预期的服务端异常 |

### 错误码约定

错误码格式为 `MODULE_ERROR_NAME`，例如：
- `AUTH_CODE_EXPIRED` — 验证码已过期
- `AUTH_CODE_INVALID` — 验证码错误
- `AUTH_PHONE_LOCKED` — 手机号已锁定
- `ACTIVITY_FULL` — 活动已满员
- `ACTIVITY_NOT_FOUND` — 活动不存在
- `COACHING_CLASS_FULL` — 团课已满员
- `REVIEW_DUPLICATE` — 重复评价

## 10. 接口依赖矩阵

> 此表用于变更影响评估。当某个接口需要修改时，查看"消费方"列确定受影响的模块。
> 所有模块设计完成后汇总填写。

| 接口 | 提供方 | 消费方 | 变更影响级别 |
|------|--------|--------|------------|
| （所有模块设计完成后汇总填写） | | | |

### 变更影响级别定义

| 级别 | 消费方数量 | 处理方式 |
|------|-----------|---------|
| 低 | 0（仅内部使用） | 提供方自行更新 |
| 中 | 1 | 提供方更新 + 通知消费方更新契约测试 |
| 高 | 2+ | 技术负责人评估影响 + 所有消费方更新契约测试和实现 |

## 11. 需求追溯表

> 确保 PRD 中的每条业务规则和验收标准都已在模块设计的接口契约中落地。
> 技术负责人 Review 时逐行核对：**"对应接口定义"不允许为空**。
> 所有模块设计完成后汇总填写。

| PRD 来源（模块 + 规则/验收标准） | 业务规则 / 验收标准原文 | 对应接口定义 | 备注 |
|-------------------------------|----------------------|------------|------|
| （所有模块设计完成后汇总填写） | | | |

## 12. 部署概要

- **部署方式**: 前后端分离（后端 API 服务 + 两个前端 SPA 静态资源）
- **运行环境**: Docker 容器化部署
- **数据库部署**: PostgreSQL 独立实例（生产环境使用托管服务或独立容器）
- **本地开发**: docker-compose 提供 PostgreSQL 等外部依赖，前后端各自开发服务器
- **前端部署**: web-app 和 admin 分别构建为静态资源，通过 Nginx 或 CDN 分发
- **定时任务**: 随后端服务进程运行，通过 scheduler 模块管理（不引入独立任务服务）
- **定时任务并发控制**: 一期单实例部署，不存在并发问题；如需多实例部署，scheduler 启动时通过数据库行锁（`SELECT ... FOR UPDATE SKIP LOCKED`）竞争执行权，确保同一任务不会被多个实例重复执行
