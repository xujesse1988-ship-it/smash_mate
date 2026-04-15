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
| coaching | 业务模块 | 后端 | 教练资料/审核、团课、统一私教（slot/学员预约/教练排课）、学员班、统一学员库、课程状态流转 |
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
| 教练管理（FC + GA + GB + GC） | coaching | 1:1 直接对应（含团课、统一私教、教练审核、学员班、统一学员库） |
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
- **职责**: 教练资料/审核、团课发布与报名管理、**统一私教**（slot 设置 / 学员预约 / 教练对学员排课）、**学员班**管理、**统一学员库**（4 来源聚合）、课程状态自动流转、过期 slot 清理
- **边界**: 负责教练维度的课程、学员关系和训练记录管理；不负责用户基本信息（通过 user 获取）；不负责球馆数据（通过 venue 获取）；不负责评价（属于 review）；不负责通知发送（通过 notification 创建）
- **对外接口**（按域分组，详见 module-design/coaching.md §3）:
  - 教练资料：`GET /api/coaches`、`GET /api/coaches/:id`、`PUT /api/coaches/me`
  - 教练审核（GA）：`POST /api/coach-applications`、`GET /api/coach-applications/me`、`GET /api/admin/coach-applications`、`GET /api/admin/coach-applications/:id`、`POST /api/admin/coach-applications/:id/review`
  - 团课：`POST /api/group-classes`、`GET /api/group-classes/:id`、`PUT /api/group-classes/:id`、`POST /api/group-classes/:id/cancel`、`POST /api/group-classes/:id/enroll`、`POST /api/group-classes/:id/cancel-enrollment`
  - 统一私教：`POST /api/private-lessons/availability`、`GET /api/coaches/:id/availability`、`POST /api/private-lessons/:id/book`、`GET /api/private-lessons/:id`、`PUT /api/private-lessons/:id`、`POST /api/private-lessons/:id/cancel`、`PUT /api/private-lessons/:id/training-content`、`POST /api/private-lessons/:id/notes`、`GET /api/private-lessons/:id/notes`
  - 教练给学员排课：`POST /api/coach-students/:studentId/lessons`、`GET /api/coach-students/:studentId/lessons`
  - 统一学员库（GC）：`GET /api/coach-students`、`GET /api/coach-students/:studentId`、`POST /api/coach-students`、`POST /api/coach-students/search-by-phone`、`PUT /api/coach-students/:studentId/tags`
  - 学员班（GB）：`POST /api/student-classes`、`GET /api/student-classes`、`GET /api/student-classes/:id`、`PUT /api/student-classes/:id`、`DELETE /api/student-classes/:id`、`POST /api/student-classes/:id/members`、`DELETE /api/student-classes/:id/members/:studentId`、`POST /api/student-classes/:id/lessons`、`GET /api/student-classes/:id/lessons`、`GET /api/student-classes/:id/lessons/:lessonId`、`PUT /api/student-classes/:id/lessons/:lessonId`、`POST /api/student-classes/:id/lessons/:lessonId/cancel`、`PUT /api/student-classes/:id/lessons/:lessonId/training-content`、`POST /api/student-classes/:id/lessons/:lessonId/notes`、`GET /api/student-classes/:id/lessons/:lessonId/notes`、`POST /api/student-classes/:id/members/:studentId/notes`、`GET /api/student-classes/:id/members/:studentId/notes`、`PUT /api/student-classes/:id/members/:studentId/tags`、`GET /api/student-classes/:id/members/:studentId/tags`
  - 我的课程 / 教练私教视图：`GET /api/users/:id/enrollments`、`GET /api/coaches/:id/private-lessons`
  - 模块间调用：`CoachingService.getGroupClassById(id)`、`CoachingService.getPrivateLessonById(id)`、`CoachingService.getParticipantIds(classId, type)`
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
  - `NotificationService.createBatch(notifications)` — 模块间调用：批量创建通知（供其他业务模块调用）
- **详细设计**: module-design/notification.md

#### review
- **职责**: 学员对教练提交评价评分、评价列表查询、教练平均评分计算
- **边界**: 负责评价数据的写入和查询；不负责教练资料管理（属于 coaching）；需通过 coaching 校验学员是否参加过该教练的课程
- **对外接口**:
  - `POST /api/reviews` — 提交评价
  - `GET /api/coaches/:id/reviews` — 教练的评价列表（分页）
  - `GET /api/coaches/:id/rating` — 教练评分查询
  - `POST /api/coaches/ratings` — 批量教练评分查询
  - `ReviewService.getCoachAverageRating(coachId)` — 模块间调用：获取教练平均评分
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

**路径 3: 统一私教预约流程**

> v3 重构：原 PrivateLessonSlot + PrivateLesson 合并为单表 PrivateLesson，slot 即 `studentId IS NULL` 的 PrivateLesson。

```
教练请求 POST /api/private-lessons/availability
  → coaching.Controller
  → coaching.Service 校验教练身份、时间段不重叠
  → 调用 venue.Service.getVenueById() 验证候选球馆（如有）
  → coaching.Repository 创建 PrivateLesson(studentId=null, source=null, status='scheduled')
  → 返回成功

学员请求 POST /api/private-lessons/:id/book  body { venueId? }
  → coaching.Controller
  → coaching.Service 校验 slot 可用、球馆选择合法
  → coaching.Repository 用 updateMany + WHERE studentId=null AND status='scheduled' 做乐观锁
  → 调用 notification.Service.create() 通知教练（有新预约）
  → 返回成功（updateMany 返回 0 则抛 409 COACHING_SLOT_ALREADY_BOOKED）

学员/教练请求 POST /api/private-lessons/:id/cancel
  → coaching.Controller
  → coaching.Service 调 assertCancellable() — in_progress/completed 直接 409
  → coaching.Repository 更新 status='cancelled'
  → 调用 notification.Service.create() 通知对方
  → 返回成功

定时任务（每分钟）触发课程状态流转
  → 已约的 scheduled → in_progress 时，把 (coachId, studentId) 写入 CoachStudent
    （source='private-lesson'，幂等：createMany skipDuplicates）
  → in_progress → completed 时通知学员（可评价 + 录入战绩）
  → 未约且过期的 slot → expired

定时任务（每日凌晨）清理过期 slot
  → 删除 status='expired' AND startTime < NOW() - 30 days 的 PrivateLesson
```

**路径 4: 教练对学员排课流程（GC 统一学员库子能力）**

```
教练请求 POST /api/coach-students/:studentId/lessons
  → coaching.Controller
  → coaching.Service 校验 (coachId, studentId) 已在 CoachStudent 表
  → 调用 venue.Service.getVenueById() 验证球馆（如填）
  → coaching.Repository 创建 PrivateLesson(studentId=:studentId, source='scheduled', status='scheduled')
  → 调用 notification.Service.create() 通知学员
  → 返回成功
```

**路径 5: 学员入库聚合（CoachStudent）**

```
来源 1: 团课 — scheduler 把 GroupClass 从 open/full → in_progress 时，遍历 enrollments 把 (coachId, studentId, source='group-class') 写入 CoachStudent
来源 2: 私教 — scheduler 把 PrivateLesson 从 scheduled → in_progress 时，写入 (coachId, studentId, source='private-lesson')
来源 3: 学员班 — scheduler 把 ClassLesson 从 scheduled → in_progress 时，遍历 StudentClassMember 写入 (coachId, studentId, source='class-lesson')
来源 4: 手动 — POST /api/coach-students 立即写入 (source='manual')

写入策略：所有路径都用 createMany({ data, skipDuplicates: true })，靠 (coachId, studentId) 唯一约束兜底；
失败被 try/catch 包裹，仅记录 error log，不阻塞主流程。
```

### 4.2 事件流

本项目一期不使用消息队列或事件总线，所有跨模块调用均为**同步服务调用**。通知创建通过 `notification.Service.create()` 同步调用。

如需异步化的场景（如球馆数据定时更新），使用 Node.js 定时任务（cron job / setInterval）实现，不引入额外中间件。

| 定时任务 | 所属模块 | 触发频率 | 处理逻辑 |
|---------|---------|---------|---------|
| 球馆数据更新 | venue | 每周一次 | 调用地图服务更新已添加城市的球馆数据 |
| 活动状态流转 | activity | 每分钟 | 扫描需要状态变更的活动（报名中→进行中→已结束） |
| 团课/私教/学员班课状态流转 + 学员入库 | coaching | 每分钟 | 扫描需要状态变更的课程；课程进入 in_progress 时把参与者写入 CoachStudent；过期未约的私教 slot → expired |
| 过期 slot 清理 | coaching | 每天一次（凌晨） | 物理删除 30 天前的 expired PrivateLesson |
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
├── routes.tsx                  # 统一路由
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
├── routes.tsx
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
User 1 ← N PrivateLesson（统一私教：教练拥有多条 PrivateLesson；学员可作为 studentId 关联多条；slot 即 studentId=null 的 PrivateLesson）
User 1 ← N CoachStudent（统一学员库：每个教练拥有多条 CoachStudent；同一学员可属于多个教练）
User 1 ← N StudentClass（一个教练可创建多个学员班）
User 1 ← N CoachApplication（一个用户可有多个历史申请，但同时仅一个 pending）
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
| 私教教练 | User（user） | PrivateLesson（coaching） | 1:N | coaching（存储 coachId 外键，统一表） |
| 私教学员 | User（user） | PrivateLesson（coaching） | 1:N | coaching（存储 studentId 外键，nullable=slot） |
| 教练学员关系 | User（user） | CoachStudent（coaching） | N:M | coaching（管理 CoachStudent 关联表） |
| 学员班 | User（user） | StudentClass（coaching） | 1:N | coaching（存储 coachId 外键） |
| 学员班成员 | User（user） | StudentClass（coaching） | N:M | coaching（管理 StudentClassMember 关联表） |
| 学员班课程 | StudentClass（coaching） | ClassLesson（coaching） | 1:N | coaching（存储 studentClassId 外键） |
| 战绩关联活动 | Activity（activity） | MatchRecord（match-record） | 1:N | match-record（存储 sourceId + sourceType） |
| 战绩关联团课 | GroupClass（coaching） | MatchRecord（match-record） | 1:N | match-record（存储 sourceId + sourceType） |
| 战绩关联私教 | PrivateLesson（coaching） | MatchRecord（match-record） | 1:N | match-record（存储 sourceId + sourceType） |
| 战绩录入者 | User（user） | MatchRecord（match-record） | 1:N | match-record（存储 recordedBy 外键） |
| 评价关系 | User（user） | Review（review） | 1:N | review（存储 reviewerId 和 coachId 外键） |
| 通知接收者 | User（user） | Notification（notification） | 1:N | notification（存储 userId 外键） |

### 关键约束

- **外键行为**: User 删除时不级联删除业务数据（一期不支持注销账号，无需处理）；Venue 删除时使用 SET NULL 或保留引用（已关联的活动/课程不受影响，PRD 明确要求）
- **唯一约束**: 手机号唯一（User）；同一学员对同一次课程只能评价一次（Review）；同一时间段不可重复设置私教空闲（PrivateLesson 中由业务层校验时段不重叠）；`(coachId, studentId)` 唯一（CoachStudent）；`(coachId, studentId, tag)` 唯一（StudentTag）
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

### 决策 4: 管理员认证复用用户认证流程
- **问题**: 管理后台需要认证机制，如何确定管理员身份
- **方案**: 管理员使用手机号+验证码登录，复用 user 模块的认证接口（POST /api/auth/send-code、POST /api/auth/login）；后端通过 admin-auth 中间件校验管理员身份（检查 JWT 中的用户是否为 config 中预设的管理员手机号列表成员）；非管理员用户登录后访问管理接口时返回 403（AUTH_ADMIN_REQUIRED）
- **理由**: 一期管理后台功能极简（城市和球馆管理），复用已有的手机号+验证码登录流程，避免引入独立的账号密码体系；通过 admin-auth 中间件实现权限隔离

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
- **管理后台**: 复用用户端 JWT（仅含 userId），通过 admin-auth 中间件查询用户手机号是否在 ADMIN_PHONES 预设列表中来校验管理员身份
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

### 10.1 HTTP API 接口

| 接口 | 提供方 | 消费方 | 变更影响级别 |
|------|--------|--------|------------|
| `POST /api/auth/send-code` | user | web-app, admin | 高 |
| `POST /api/auth/login` | user | web-app, admin | 高 |
| `GET /api/users/me` | user | web-app, admin | 高 |
| `PUT /api/users/me` | user | web-app | 中 |
| `PUT /api/users/me/coach-role` | user | web-app | 中 |
| `GET /api/users/:id` | user | web-app | 中 |
| `POST /api/activities` | activity | web-app | 中 |
| `GET /api/activities` | activity | web-app | 中 |
| `GET /api/activities/:id` | activity | web-app | 中 |
| `POST /api/activities/:id/join` | activity | web-app | 中 |
| `POST /api/activities/:id/leave` | activity | web-app | 中 |
| `PUT /api/activities/:id` | activity | web-app | 中 |
| `POST /api/activities/:id/cancel` | activity | web-app | 中 |
| `GET /api/users/:id/activities` | activity | web-app | 中 |
| `GET /api/coaches` | coaching | web-app | 中 |
| `GET /api/coaches/:id` | coaching | web-app | 中 |
| `PUT /api/coaches/me` | coaching | web-app | 中 |
| `POST /api/group-classes` | coaching | web-app | 中 |
| `GET /api/group-classes/:id` | coaching | web-app | 中 |
| `PUT /api/group-classes/:id` | coaching | web-app | 中 |
| `POST /api/group-classes/:id/cancel` | coaching | web-app | 中 |
| `POST /api/group-classes/:id/enroll` | coaching | web-app | 中 |
| `POST /api/group-classes/:id/cancel-enrollment` | coaching | web-app | 中 |
| `POST /api/private-lessons/availability` | coaching | web-app | 中 |
| `GET /api/coaches/:id/availability` | coaching | web-app | 中 |
| `POST /api/private-lessons/:id/book` | coaching | web-app | 中 |
| `GET /api/private-lessons/:id` | coaching | web-app | 中 |
| `PUT /api/private-lessons/:id` | coaching | web-app | 中 |
| `POST /api/private-lessons/:id/cancel` | coaching | web-app | 中 |
| `PUT /api/private-lessons/:id/training-content` | coaching | web-app | 中 |
| `POST /api/private-lessons/:id/notes` | coaching | web-app | 中 |
| `GET /api/private-lessons/:id/notes` | coaching | web-app | 中 |
| `GET /api/users/:id/enrollments` | coaching | web-app | 中 |
| `GET /api/coaches/:id/private-lessons` | coaching | web-app | 中 |
| `POST /api/coach-applications` | coaching | web-app | 中 |
| `GET /api/coach-applications/me` | coaching | web-app | 中 |
| `GET /api/admin/coach-applications` | coaching | admin | 中 |
| `GET /api/admin/coach-applications/:id` | coaching | admin | 中 |
| `POST /api/admin/coach-applications/:id/review` | coaching | admin | 中 |
| `GET /api/coach-students` | coaching | web-app | 中 |
| `GET /api/coach-students/:studentId` | coaching | web-app | 中 |
| `POST /api/coach-students` | coaching | web-app | 中 |
| `POST /api/coach-students/search-by-phone` | coaching | web-app | 中 |
| `PUT /api/coach-students/:studentId/tags` | coaching | web-app | 中 |
| `POST /api/coach-students/:studentId/lessons` | coaching | web-app | 中 |
| `GET /api/coach-students/:studentId/lessons` | coaching | web-app | 中 |
| `POST /api/student-classes` 等 GB 全套 | coaching | web-app | 中 |
| `POST /api/match-records` | match-record | web-app | 中 |
| `DELETE /api/match-records/:id` | match-record | web-app | 中 |
| `GET /api/activities/:id/match-records` | match-record | web-app | 中 |
| `GET /api/group-classes/:id/match-records` | match-record | web-app | 中 |
| `GET /api/private-lessons/:id/match-records` | match-record | web-app | 中 |
| `GET /api/users/:id/match-records` | match-record | web-app | 中 |
| `GET /api/users/:id/match-stats` | match-record | web-app | 中 |
| `GET /api/venues/search` | venue | web-app, admin | 高 |
| `GET /api/venues/:id` | venue | web-app, admin | 高 |
| `POST /api/admin/cities` | venue | admin | 中 |
| `GET /api/admin/cities` | venue | admin | 中 |
| `GET /api/admin/venues` | venue | admin | 中 |
| `DELETE /api/admin/venues/:id` | venue | admin | 中 |
| `POST /api/admin/venues/sync` | venue | admin | 中 |
| `GET /api/notifications` | notification | web-app | 中 |
| `GET /api/notifications/unread-count` | notification | web-app | 中 |
| `PUT /api/notifications/:id/read` | notification | web-app | 中 |
| `PUT /api/notifications/read-all` | notification | web-app | 中 |
| `POST /api/reviews` | review | web-app | 中 |
| `GET /api/coaches/:id/reviews` | review | web-app | 中 |
| `GET /api/coaches/:id/rating` | review | web-app | 中 |
| `POST /api/coaches/ratings` | review | web-app | 中 |

### 10.2 内部 Service 接口（跨模块调用）

| 接口 | 提供方 | 消费方 | 变更影响级别 |
|------|--------|--------|------------|
| `UserService.getUserById(id)` | user | activity, coaching, match-record, review | 高 |
| `UserService.getUsersByIds(ids)` | user | activity, coaching, match-record, review | 高 |
| `VenueService.getVenueById(id)` | venue | activity, coaching | 高 |
| `NotificationService.create(notification)` | notification | activity, coaching, review | 高 |
| `NotificationService.createBatch(notifications)` | notification | activity, coaching | 高 |
| `ActivityService.getActivityById(id)` | activity | match-record | 中 |
| `ActivityService.getParticipantIds(activityId)` | activity | match-record | 中 |
| `CoachingService.getGroupClassById(id)` | coaching | match-record, review | 高 |
| `CoachingService.getPrivateLessonById(id)` | coaching | match-record, review | 高 |
| `CoachingService.getParticipantIds(classId, type)` | coaching | match-record, review | 高 |
| `ReviewService.getCoachAverageRating(coachId)` | review | 仅内部（通过 HTTP 接口暴露） | 低 |

### 变更影响级别定义

| 级别 | 消费方数量 | 处理方式 |
|------|-----------|---------|
| 低 | 0（仅内部使用） | 提供方自行更新 |
| 中 | 1 | 提供方更新 + 通知消费方更新契约测试 |
| 高 | 2+ | 技术负责人评估影响 + 所有消费方更新契约测试和实现 |

## 11. 需求追溯表

> 确保 PRD 中的每条业务规则和验收标准都已在模块设计的接口契约中落地。
> 技术负责人 Review 时逐行核对：**"对应接口定义"不允许为空**。

### 11.1 用户管理（FA）

| PRD 来源 | 业务规则 / 验收标准 | 对应接口定义 | 备注 |
|---------|-------------------|------------|------|
| FA 规则 1 | 注册方式为手机号+短信验证码，不设密码 | user.md: `POST /api/auth/send-code` + `POST /api/auth/login` | 登录注册合一 |
| FA 规则 2 | 手机号格式校验：中国大陆手机号（11 位，1 开头） | user.md: `POST /api/auth/send-code` 业务规则，正则 `/^1\d{10}$/` | |
| FA 规则 3 | 同一手机号不可重复注册 | user.md: `POST /api/auth/login` 业务规则，已存在手机号视为登录 | |
| FA 规则 4 | 短信验证码为 6 位数字，有效期 5 分钟 | user.md: `POST /api/auth/send-code` 业务规则 + VerificationCode.expiresAt | |
| FA 规则 5 | 同一手机号 60 秒内不可重复发送验证码 | user.md: `POST /api/auth/send-code` 错误码 AUTH_CODE_RATE_LIMITED | |
| FA 规则 6 | 验证码输入错误超过 5 次后锁定 30 分钟 | user.md: `POST /api/auth/login` 业务规则 + PhoneLock 模型 + 错误码 AUTH_PHONE_LOCKED | |
| FA 规则 7 | 登录方式同为手机号+短信验证码 | user.md: `POST /api/auth/login` | |
| FA 规则 8 | 登录成功后保持登录态 7 天 | user.md: `POST /api/auth/login` 业务规则，JWT 有效期 7 天 | |
| FA 规则 9 | 昵称不可为空，长度限制 2-20 个字符 | user.md: `PUT /api/users/me` 错误码 USER_INVALID_NICKNAME | |
| FA 规则 10 | 注册时勾选教练角色后自动拥有教练功能权限 | user.md: `POST /api/auth/login` 请求体 isCoach 参数 | |
| FA 规则 11 | 未在注册时勾选教练的用户，登录后可在设置中开启教练角色 | user.md: `PUT /api/users/me/coach-role` | |
| FA 规则 12 | 一个账号同时具备普通用户和教练两种身份 | user.md: User.isCoach 字段，不需要切换账号 | |
| FA 验收 1 | 输入手机号并获取验证码，输入正确验证码后注册成功 | user.md: `POST /api/auth/send-code` + `POST /api/auth/login` | |
| FA 验收 2 | 60 秒内重复点击获取验证码提示 | user.md: 错误码 AUTH_CODE_RATE_LIMITED | |
| FA 验收 3 | 验证码过期提示 | user.md: 错误码 AUTH_CODE_EXPIRED | |
| FA 验收 4 | 验证码错误超过 5 次后提示 | user.md: 错误码 AUTH_PHONE_LOCKED | |
| FA 验收 5 | 已注册手机号再次注册 | user.md: `POST /api/auth/login` 自动识别已存在用户进行登录 | PRD 写"提示已注册"，设计为登录注册合一（不区分） |
| FA 验收 6 | 登录成功后 7 天内无需重新登录 | user.md: JWT 有效期 7 天 | |
| FA 验收 7 | 注册时勾选我是教练后可发布课程 | user.md: `POST /api/auth/login` isCoach 参数 + coaching 模块教练权限校验 | |
| FA 验收 8 | 非教练用户在设置中开启教练角色后立即获得发布课程能力 | user.md: `PUT /api/users/me/coach-role` | |
| FA 验收 9 | 个人主页正确展示历史战绩汇总 | match-record.md: `GET /api/users/:id/match-stats` | 前端聚合展示 |

### 11.2 约球（FB）

| PRD 来源 | 业务规则 / 验收标准 | 对应接口定义 | 备注 |
|---------|-------------------|------------|------|
| FB 规则 1 | 发起活动时必填：球馆、开始时间、限定人数（2-50） | activity.md: `POST /api/activities` 请求体 + 错误码 | 结束时间也必填（规则 6） |
| FB 规则 2 | 球馆通过关键词自动匹配系统已有球馆 | venue.md: `GET /api/venues/search` | |
| FB 规则 3 | 活动开始时间必须晚于当前时间 | activity.md: `POST /api/activities` 错误码 ACTIVITY_INVALID_TIME | |
| FB 规则 4 | 活动状态：报名中→已满员→进行中→已结束/已取消 | activity.md: 活动状态枚举（open/full/in_progress/completed/cancelled） | |
| FB 规则 5 | 人数达到上限后状态自动变为已满员，退出后恢复 | activity.md: `POST /api/activities/:id/join` + `POST /api/activities/:id/leave` 业务规则 | |
| FB 规则 6 | 必须设定结束时间，结束时间晚于开始时间 | activity.md: `POST /api/activities` 请求体 endTime 必填 + 错误码 ACTIVITY_INVALID_TIME | |
| FB 规则 7 | 开始时间到达后自动变为进行中，结束后变为已结束 | activity.md: 6.2 定时任务 -- 活动状态自动流转 | |
| FB 规则 8 | 修改活动后通知所有参与者 | activity.md: `PUT /api/activities/:id` 业务规则（调用 NotificationService.createBatch） | |
| FB 规则 9 | 取消活动后通知所有参与者 | activity.md: `POST /api/activities/:id/cancel` 业务规则 | |
| FB 规则 10 | 已取消的活动不可恢复 | activity.md: cancelled 状态为终态 | |
| FB 规则 11 | 发起人自动算作第一个参与者 | activity.md: `POST /api/activities` 业务规则 | |
| FB 规则 12 | 已开始或已结束的活动不可修改、不可加入、不可退出 | activity.md: 各接口错误码 ACTIVITY_NOT_MODIFIABLE / ACTIVITY_NOT_JOINABLE / ACTIVITY_NOT_LEAVABLE | |
| FB 规则 13 | 发起人不可退出自己发起的活动 | activity.md: `POST /api/activities/:id/leave` 错误码 ACTIVITY_CREATOR_CANNOT_LEAVE | |
| FB 规则 14 | 参与者退出活动后通知发起人 | activity.md: `POST /api/activities/:id/leave` 业务规则 | |
| FB 规则 15 | 参与者在活动开始前均可退出活动 | activity.md: `POST /api/activities/:id/leave` 业务规则（状态为 open 或 full） | |
| FB 规则 16 | 活动列表按距离排序依赖用户定位授权 | activity.md: `GET /api/activities` sortBy=distance 需 latitude + longitude | 前端处理定位授权 |
| FB 规则 17 | 拒绝定位时按距离排序不可用 | activity.md: `GET /api/activities` 未提供经纬度时 sortBy=distance 回退到 time | 前端控制 |
| FB 规则 18 | 筛选交互定义 | activity.md: `GET /api/activities` Query Params（dateFilter/maxDistance/hasSlot） | |
| FB 规则 19 | 距离计算基准为用户实时定位坐标 | activity.md: `GET /api/activities` latitude + longitude 参数 | 前端传入实时坐标 |
| FB 验收 1-14 | 所有验收标准 | 上述接口定义覆盖 | 每条验收标准均可追溯到对应接口 |

### 11.3 教练管理（FC）

| PRD 来源 | 业务规则 / 验收标准 | 对应接口定义 | 备注 |
|---------|-------------------|------------|------|
| FC 规则 1 | 只有教练角色的用户可以发布团课和设置私教时间 | coaching.md: 各教练操作接口错误码 COACHING_COACH_ROLE_REQUIRED | |
| FC 规则 2 | 团课必填项和限制 | coaching.md: `POST /api/group-classes` 请求体 + 错误码 | |
| FC 规则 3 | 团课时间约束 | coaching.md: `POST /api/group-classes` 错误码 COACHING_INVALID_TIME | |
| FC 规则 4 | 费用说明为选填文本 | coaching.md: `POST /api/group-classes` feeDescription 选填 | |
| FC 规则 5 | 私教时间段最小粒度为 1 小时 | coaching.md: `POST /api/private-lessons/availability` 错误码 COACHING_SLOT_TOO_SHORT | |
| FC 规则 6 | 同一时间段不可重复设置 | coaching.md: `POST /api/private-lessons/availability` 错误码 COACHING_SLOT_OVERLAP | |
| FC 规则 7 | 教练设置私教课时可选择上课球馆（可多选或不选） | coaching.md: `POST /api/private-lessons/availability` slots[].venueIds | |
| FC 规则 8 | 费用说明 | coaching.md: `POST /api/private-lessons/availability` slots[].feeDescription | |
| FC 规则 9 | 学员预约私教课时须从可选球馆中选择 | coaching.md: `POST /api/private-lessons/book` 错误码 COACHING_VENUE_REQUIRED / COACHING_INVALID_VENUE_CHOICE | |
| FC 规则 10 | 团课状态流转 | coaching.md: 团课状态枚举 + 6.1 团课状态机 | |
| FC 规则 11 | 团课开始/结束时间到达后自动变更状态 | coaching.md: 6.3 定时任务 -- 课程状态自动流转 | |
| FC 规则 12 | 团课满员/取消报名后状态变化 | coaching.md: `POST /api/group-classes/:id/enroll` + `POST /api/group-classes/:id/cancel-enrollment` 业务规则 | |
| FC 规则 13 | 私教课状态流转 | coaching.md: 私教课状态枚举 + 6.2 私教课状态机 | |
| FC 规则 14 | 私教课开始/结束时间到达后自动变更状态 | coaching.md: 6.3 定时任务 | |
| FC 规则 15 | 仅已结束的课程可录入战绩和评价 | match-record.md: 录入战绩校验 status===completed; review.md: 提交评价校验 status===completed | |
| FC 规则 16 | 教练可修改团课信息，修改后通知学员 | coaching.md: `PUT /api/group-classes/:id` 业务规则 | |
| FC 规则 17 | 已开始或已结束的团课不可修改 | coaching.md: `PUT /api/group-classes/:id` 错误码 COACHING_CLASS_NOT_MODIFIABLE | |
| FC 规则 18 | 教练取消团课时通知学员 | coaching.md: `POST /api/group-classes/:id/cancel` 业务规则 | |
| FC 规则 19 | 教练取消私教预约时通知学员 | coaching.md: `POST /api/private-lessons/:id/cancel` 业务规则 | |
| FC 规则 20 | 一期不设取消时间限制 | coaching.md: 取消接口业务规则明确说明 | |
| FC 规则 21 | 教练评分 = 所有评价的平均分；无评价时显示暂无评价 | review.md: `GET /api/coaches/:id/rating` | 前端聚合展示 |
| FC 规则 22 | 历史学员数 = 不重复参与人数 | coaching.md: `GET /api/coaches` + `GET /api/coaches/:id` studentCount 实时计算 | |
| FC 规则 23 | 教练列表默认按评分排序，支持按擅长方向筛选 | coaching.md: `GET /api/coaches` specialty 筛选 + review.md: `POST /api/coaches/ratings` 评分数据 | 前端客户端排序 |
| FC 规则 24 | 学员报名团课：未满员且未开始时可报名 | coaching.md: `POST /api/group-classes/:id/enroll` 业务规则 | |
| FC 规则 25 | 团课满员后不可报名 | coaching.md: `POST /api/group-classes/:id/enroll` 错误码 COACHING_CLASS_FULL | |
| FC 规则 26 | 学员预约私教 | coaching.md: `POST /api/private-lessons/book` 业务规则 | |
| FC 规则 27 | 学员取消团课报名 | coaching.md: `POST /api/group-classes/:id/cancel-enrollment` 业务规则 | |
| FC 规则 28 | 学员取消私教预约 | coaching.md: `POST /api/private-lessons/:id/cancel` 业务规则 | |
| FC 规则 29 | 已开始或已结束的课程不可报名、不可取消 | coaching.md: 各接口错误码 COACHING_CLASS_NOT_ENROLLABLE / COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT / COACHING_LESSON_NOT_CANCELLABLE | |
| FC 验收 1-17 | 所有验收标准 | 上述接口定义覆盖 | |

### 11.4 战绩记录（FD）

| PRD 来源 | 业务规则 / 验收标准 | 对应接口定义 | 备注 |
|---------|-------------------|------------|------|
| FD 规则 1 | 战绩必须关联到某次活动/团课/私教课 | match-record.md: `POST /api/match-records` sourceType + sourceId 必填 | |
| FD 规则 2 | 活动的发起人和所有参与者均可录入 | match-record.md: `POST /api/match-records` 参与者校验流程 | |
| FD 规则 3 | 录入时须选择比赛类型 | match-record.md: `POST /api/match-records` matchType 必填 | |
| FD 规则 4 | 单打各 1 人，双打各 2 人 | match-record.md: `POST /api/match-records` 错误码 MATCH_RECORD_INVALID_PLAYERS | |
| FD 规则 5 | 选手选择：平台用户从参与者中选择；非平台用户输入昵称 | match-record.md: `POST /api/match-records` players.sideA/sideB 的 userId/guestName | |
| FD 规则 6 | 非平台用户存储在临时用户表中 | match-record.md: GuestPlayer 模型 | |
| FD 规则 7 | 每条战绩记录包含的字段 | match-record.md: MatchRecord + MatchPlayer + MatchGame 模型 | |
| FD 规则 8 | 支持多局比分录入 | match-record.md: `POST /api/match-records` games 数组 | |
| FD 规则 9 | 单局比分为 0-30 之间的整数，不可同时为 0 | match-record.md: `POST /api/match-records` 错误码 MATCH_RECORD_INVALID_SCORE | |
| FD 规则 10 | 一期不需要对方确认 | match-record.md: 8. 已知限制中明确说明 | |
| FD 规则 11 | 胜负判定：赢得多数局的一方为胜 | match-record.md: 6.1 胜负判定算法 | |
| FD 规则 12 | 偶数局双方胜局数相同记为平局 | match-record.md: 6.1 胜负判定算法 DRAW 逻辑 | |
| FD 规则 13 | 双打中获胜组每位平台用户各记 1 胜场 | match-record.md: 6.2 个人战绩结果判定 + 6.3 战绩统计计算 | |
| FD 规则 14（第一个） | 战绩汇总仅统计平台用户 | match-record.md: `GET /api/users/:id/match-stats` 业务规则 | |
| FD 规则 14（第二个） | 录入者可删除自己录入的战绩 | match-record.md: `DELETE /api/match-records/:id` 错误码 MATCH_RECORD_NOT_RECORDER | |
| FD 规则 15 | 战绩的重复或冲突由用户自行处理 | match-record.md: 8. 已知限制中明确说明 | |
| FD 验收 1-13 | 所有验收标准 | 上述接口定义覆盖 | |

### 11.5 球馆管理（FE）

| PRD 来源 | 业务规则 / 验收标准 | 对应接口定义 | 备注 |
|---------|-------------------|------------|------|
| FE 规则 1 | 管理员添加城市后自动调用地图服务查询球馆 | venue.md: `POST /api/admin/cities` 业务规则 + 6.1 城市添加流程 | |
| FE 规则 2 | 球馆数据包含名称、地址、经纬度 | venue.md: Venue 模型字段定义 | |
| FE 规则 3 | 每周定时更新 | venue.md: 6.2 定时球馆数据更新 | |
| FE 规则 4 | 用户输入关键词按名称模糊匹配+距离排序 | venue.md: `GET /api/venues/search` 业务规则 | |
| FE 规则 5 | 球馆数据仅管理员可维护 | venue.md: 管理员接口使用 admin-auth 中间件 | |
| FE 验收 1-3 | 所有验收标准 | 上述接口定义覆盖 | |

### 11.6 通知（FF）

| PRD 来源 | 业务规则 / 验收标准 | 对应接口定义 | 备注 |
|---------|-------------------|------------|------|
| FF 规则 1 | 12 种触发事件 | notification.md: 通知类型枚举 12 个值，各模块设计文件中的通知发送逻辑 | |
| FF 规则 2 | 每种通知的文案模板和跳转目标 | notification.md: 6.2 通知文案生成 + targetType/targetId 定义 | 文案由调用方生成 |
| FF 规则 3 | 一期仅站内通知 | notification.md: 1. 模块概述 | |
| FF 规则 4 | 通知分为已读和未读 | notification.md: Notification.isRead 字段 | |
| FF 规则 5 | 标记单条或一键全部已读 | notification.md: `PUT /api/notifications/:id/read` + `PUT /api/notifications/read-all` | |
| FF 规则 6 | 按时间倒序平铺展示 | notification.md: `GET /api/notifications` 按 createdAt 倒序 | |
| FF 规则 7 | 通知保留 90 天 | notification.md: 6.3 通知过期自动清理 | |
| FF 验收 1 | 所有事件触发时通知送达 | 各模块设计文件中的通知发送逻辑 + notification.md 通知类型枚举 | |
| FF 验收 2 | 点击通知跳转 | notification.md: targetType + targetId + web-app-notification.md 页面跳转逻辑 | |
| FF 验收 3 | 未读通知角标 | notification.md: `GET /api/notifications/unread-count` | |
| FF 验收 4 | 通知列表展示 | notification.md: `GET /api/notifications` | |

### 11.7 评价评分（FG）

| PRD 来源 | 业务规则 / 验收标准 | 对应接口定义 | 备注 |
|---------|-------------------|------------|------|
| FG 规则 1 | 只有参加过教练课程的学员可以评价 | review.md: `POST /api/reviews` 调用 CoachingService.getParticipantIds 校验 | |
| FG 规则 2 | 评分范围 1-5 分整数 | review.md: `POST /api/reviews` 错误码 REVIEW_INVALID_RATING | |
| FG 规则 3 | 文字评价最长 500 字符 | review.md: `POST /api/reviews` 错误码 REVIEW_INVALID_COMMENT | |
| FG 规则 4 | 同一学员对同一次课程只能评价一次 | review.md: `POST /api/reviews` 错误码 REVIEW_DUPLICATE + 唯一约束 | |
| FG 规则 5 | 教练评分 = 算术平均值，保留一位小数 | review.md: `GET /api/coaches/:id/rating` + 6.2 教练平均评分计算 | |
| FG 规则 6 | 评价列表按时间倒序 | review.md: `GET /api/coaches/:id/reviews` 按 createdAt 倒序 | |
| FG 验收 1-4 | 所有验收标准 | 上述接口定义覆盖 | |

### 11.8 管理后台（FH）

| PRD 来源 | 业务规则 / 验收标准 | 对应接口定义 | 备注 |
|---------|-------------------|------------|------|
| FH 规则 1 | 管理员账号由系统预设 | architecture.md: 决策 4 管理员认证，admin-auth 中间件校验预设手机号列表 | |
| FH 规则 2 | 管理后台为独立入口 | architecture.md: admin 前端模块独立部署 | |
| FH 规则 3 | 添加城市后自动获取球馆 | venue.md: `POST /api/admin/cities` 业务规则 | |
| FH 规则 4 | 管理员可手动移除球馆，不影响历史数据 | venue.md: `DELETE /api/admin/venues/:id` 业务规则（ON DELETE SET NULL） | |
| FH 验收 1 | 管理员可通过预设账号登录 | user.md: `POST /api/auth/login` + admin-auth 中间件 | |
| FH 验收 2 | 添加城市后系统自动获取球馆 | venue.md: `POST /api/admin/cities` | |
| FH 验收 3 | 管理员可手动移除球馆 | venue.md: `DELETE /api/admin/venues/:id` | |
| FH 验收 4 | 管理员可手动触发球馆数据更新 | venue.md: `POST /api/admin/venues/sync` | |

### 11.9 跨模块业务流验收标准

| PRD 来源 | 验收标准 | 对应接口定义 | 备注 |
|---------|---------|------------|------|
| 4.1 验收 1 | 约球全链路可走通 | activity 全部接口 + match-record `POST /api/match-records` | |
| 4.1 验收 2 | 活动取消后通知送达 | activity.md: `POST /api/activities/:id/cancel` + notification 接口 | |
| 4.2 验收 1 | 团课全链路可走通 | coaching 团课接口 + review `POST /api/reviews` + match-record `POST /api/match-records` | |
| 4.3 验收 1 | 私教全链路可走通 | coaching 私教接口 + review `POST /api/reviews` + match-record `POST /api/match-records` | |

### 11.10 非功能需求

| PRD 来源 | 需求 | 对应设计 | 备注 |
|---------|------|---------|------|
| 6. 性能 | 页面首次加载 <= 3 秒 | web-app.md: Vite 构建优化 + 代码分割 | |
| 6. 性能 | 活动列表接口 <= 500ms | activity.md: 索引设计 + SQL 优化 | |
| 6. 安全 | 接口身份认证和权限校验 | architecture.md: 9. 接口通用约定 认证方式 + infra auth.ts / admin-auth.ts | |
| 6. 安全 | 短信验证码频率限制防刷 | user.md: AUTH_CODE_RATE_LIMITED + AUTH_PHONE_LOCKED | |
| 6. 兼容性 | 移动端浏览器 + 桌面端 | web-app.md: 响应式布局约定 | |

## 12. 部署概要

- **部署方式**: 前后端分离（后端 API 服务 + 两个前端 SPA 静态资源）
- **运行环境**: Docker 容器化部署
- **数据库部署**: PostgreSQL 独立实例（生产环境使用托管服务或独立容器）
- **本地开发**: docker-compose 提供 PostgreSQL 等外部依赖，前后端各自开发服务器
- **前端部署**: web-app 和 admin 分别构建为静态资源，通过 Nginx 或 CDN 分发
- **定时任务**: 随后端服务进程运行，通过 scheduler 模块管理（不引入独立任务服务）
- **定时任务并发控制**: 一期单实例部署，不存在并发问题；如需多实例部署，scheduler 启动时通过数据库行锁（`SELECT ... FOR UPDATE SKIP LOCKED`）竞争执行权，确保同一任务不会被多个实例重复执行
