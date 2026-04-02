# 模块详细设计: notification

> 本文档描述 notification 后端模块的内部设计和接口契约。系统级架构见 architecture.md。

## 1. 模块概述

- **职责**: 站内通知的创建、查询（已读/未读）、标记已读、未读计数、过期自动清理
- **类型**: 后端模块
- **业务模块映射**: PRD 中的「通知（FF）」
- **依赖层级**: 基础层（不依赖其他业务模块）

---

## 2. 内部架构

### 分层结构

```
notification/
├── controller.ts      # 请求处理、参数校验、响应格式化
├── service.ts         # 业务逻辑、通知创建、已读管理、定时清理注册
├── repository.ts      # 数据访问、Prisma 查询封装
├── types.ts           # 模块内类型定义（通知类型枚举、输入输出类型）
└── index.ts           # 对外导出（公开接口）
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Controller | 接收请求、参数校验、调用 Service、格式化响应 | Service |
| Service | 业务逻辑（通知创建、查询、已读标记、定时清理注册） | Repository, infra（logger、config、scheduler） |
| Repository | 数据库操作、Prisma 查询封装 | Prisma Client（infra） |

### 控制流

```
HTTP 请求 → Controller（校验）→ Service（业务逻辑）→ Repository（数据访问）→ 响应

跨模块调用 → NotificationService.create() → Repository（写入通知记录）→ 返回

定时任务 → scheduler 触发 → Service（清理过期通知）→ Repository（批量删除）
```

---

## 3. 数据模型

### Notification

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| userId | string (uuid) | NOT NULL, FK → User.id | 通知接收者 |
| type | string (enum) | NOT NULL | 通知类型（见下方枚举定义） |
| title | string | NOT NULL | 通知标题（用于列表展示的简短摘要） |
| content | string | NOT NULL | 通知内容（按 PRD 模板生成的完整文案） |
| targetType | string (enum) | NOT NULL | 跳转目标类型：activity / group-class / private-lesson / coach-profile |
| targetId | string (uuid) | NOT NULL | 跳转目标资源 ID |
| isRead | boolean | NOT NULL, DEFAULT false | 是否已读 |
| createdAt | datetime | NOT NULL | 创建时间 |

### 通知类型枚举（type）

| 枚举值 | 说明 | PRD 对应事件 |
|--------|------|-------------|
| ACTIVITY_JOINED | 有人加入约球活动 | 通知发起人 |
| ACTIVITY_LEFT | 有人退出约球活动 | 通知发起人 |
| ACTIVITY_UPDATED | 活动信息被修改 | 通知所有参与者 |
| ACTIVITY_CANCELLED | 活动被取消 | 通知所有参与者 |
| GROUP_CLASS_ENROLLED | 学员报名团课 | 通知教练 |
| GROUP_CLASS_ENROLLMENT_CANCELLED | 学员取消团课报名 | 通知教练 |
| GROUP_CLASS_UPDATED | 教练修改团课信息 | 通知所有已报名学员 |
| GROUP_CLASS_CANCELLED | 教练取消团课 | 通知所有已报名学员 |
| PRIVATE_LESSON_BOOKED | 学员预约私教课 | 通知教练 |
| PRIVATE_LESSON_CANCELLED_BY_STUDENT | 学员取消私教预约 | 通知教练 |
| PRIVATE_LESSON_CANCELLED_BY_COACH | 教练取消私教预约 | 通知学员 |
| REVIEW_RECEIVED | 课程收到新评价 | 通知教练 |

### 跳转目标类型枚举（targetType）

| 枚举值 | 说明 | 前端跳转路由 |
|--------|------|-------------|
| activity | 活动详情页 | /activities/:id |
| group-class | 团课详情页 | /group-classes/:id |
| private-lesson | 私教预约管理页 | /coaching/lessons（前端自行处理） |
| coach-profile | 教练主页（评价列表） | /coaches/:id |

### 索引

- `Notification.(userId, isRead, createdAt)` — 联合索引（支持按用户 + 已读状态查询 + 时间排序）
- `Notification.createdAt` — 索引（支持过期清理定时任务的时间范围查询）

### 模型关系

```
User 1 ← N Notification（一个用户可收到多条通知）
Notification.userId → User.id（外键）
```

### 与其他模块数据的关系

- Notification.userId 引用 User（user 模块）的主键
- Notification.targetId 引用 Activity（activity 模块）、GroupClass / PrivateLesson（coaching 模块）或 User（user 模块，教练主页场景）的主键，通过 targetType 区分，不建立物理外键约束（多态引用）

---

## 4. 接口契约

> 每个接口必须包含五要素：**输入、输出、业务规则、错误码、consumers**。
> 接口通用约定（认证方式、响应格式、分页、HTTP 状态码）见 architecture.md。

### 通知列表

`GET /api/notifications`

**描述**: 获取当前用户的通知列表，支持分页和已读/未读筛选

**认证**: 需要

**Consumers**: web-app（通知列表页）

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页条数（默认 20，最大 100） |
| isRead | boolean | 否 | 筛选已读/未读（不传则返回全部） |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "type": "ACTIVITY_JOINED",
        "title": "新成员加入",
        "content": "张三 加入了你的活动「朝阳体育中心 04/05」",
        "targetType": "activity",
        "targetId": "uuid",
        "isRead": false,
        "createdAt": "2026-04-02T10:00:00.000Z"
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 20
  }
}
```

**业务规则**:
- 只返回当前用户（从 JWT 解析 userId）的通知
- 按 createdAt 倒序排列（最新通知在前）
- isRead 参数支持字符串 "true" / "false" 解析为布尔值
- 不返回其他用户的通知（数据隔离通过 userId 查询条件保证）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 未读通知数

`GET /api/notifications/unread-count`

**描述**: 获取当前用户的未读通知数量，用于导航栏角标展示

**认证**: 需要

**Consumers**: web-app（全局导航栏角标）

**Request**: 无参数

**Response 200**:
```json
{
  "data": {
    "count": 5
  }
}
```

**业务规则**:
- 只统计当前用户的未读通知数（userId + isRead = false）
- 该接口为高频调用（页面加载/切换时），应保持轻量

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 标记单条已读

`PUT /api/notifications/:id/read`

**描述**: 标记指定通知为已读

**认证**: 需要

**Consumers**: web-app（通知列表页，点击通知时标记已读）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 通知 ID |

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "type": "ACTIVITY_JOINED",
    "title": "新成员加入",
    "content": "张三 加入了你的活动「朝阳体育中心 04/05」",
    "targetType": "activity",
    "targetId": "uuid",
    "isRead": true,
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**业务规则**:
- 只能标记自己的通知为已读（校验 notification.userId === 当前用户 ID）
- 已经是已读状态的通知再次标记为幂等操作，直接返回当前状态
- 不支持标记为未读（一期不需要）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | NOTIFICATION_FORBIDDEN | 尝试标记他人的通知 |
| 404 | NOTIFICATION_NOT_FOUND | 通知不存在 |

---

### 全部标记已读

`PUT /api/notifications/read-all`

**描述**: 将当前用户的所有未读通知标记为已读

**认证**: 需要

**Consumers**: web-app（通知列表页，一键全部已读按钮）

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "updatedCount": 12
  }
}
```

**业务规则**:
- 只标记当前用户的未读通知（userId + isRead = false → 批量更新为 isRead = true）
- 返回实际更新的通知数量
- 如果没有未读通知，updatedCount 为 0，不报错

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 内部接口（跨模块 Service 调用）

> 非 HTTP 暴露的接口。用于其他模块的 Service 层直接调用本模块的 Service。

#### NotificationService.create(notification)

**描述**: 创建一条站内通知（供其他业务模块在关键事件发生时调用）

**Consumers**: activity, coaching, review

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string | 是 | 通知接收者用户 ID |
| type | NotificationType | 是 | 通知类型（见枚举定义） |
| title | string | 是 | 通知标题 |
| content | string | 是 | 通知内容（调用方按 PRD 模板生成） |
| targetType | TargetType | 是 | 跳转目标类型 |
| targetId | string | 是 | 跳转目标资源 ID |

**返回值**:
```typescript
{
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  targetType: string;
  targetId: string;
  isRead: boolean;
  createdAt: Date;
}
```

**业务规则**:
- 通知内容（content）由调用方根据 PRD 定义的文案模板生成，notification 模块不负责模板渲染
- 通知标题（title）由调用方提供，用于列表展示的简短摘要
- 创建通知时 isRead 默认为 false
- **关键约定**: 通知创建失败不阻塞主流程。调用方应使用 try-catch 包裹调用，失败时记录 error 日志后继续（遵循 architecture.md 决策 5）
- 该方法本身在遇到数据库异常时会抛出错误，由调用方决定是否吞掉

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| NOTIFICATION_INVALID_TYPE | type 不在枚举范围内 |
| NOTIFICATION_INVALID_TARGET_TYPE | targetType 不在枚举范围内 |
| NOTIFICATION_INVALID_PARAMS | 必填参数缺失或为空 |

---

#### NotificationService.createBatch(notifications)

**描述**: 批量创建通知（用于一次事件需要通知多个用户的场景，如活动取消通知所有参与者）

**Consumers**: activity, coaching

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| notifications | CreateNotificationInput[] | 是 | 通知列表，每个元素结构同 create() 的参数 |

**返回值**:
```typescript
{
  successCount: number;
  failedCount: number;
}
```

**业务规则**:
- 批量创建使用数据库批量插入（Prisma createMany），提升性能
- 部分失败不影响其他通知的创建（单条失败时记录 error 日志，继续处理剩余）
- 空数组参数直接返回 `{ successCount: 0, failedCount: 0 }`
- 同 create() 方法，调用方应使用 try-catch 包裹调用

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| NOTIFICATION_INVALID_PARAMS | notifications 参数不是数组 |

---

## 5. 消费的外部接口

| 接口 | 提供方 | 调用场景 |
|------|--------|---------|
| 无 | - | notification 为基础层模块，不依赖其他业务模块 |

> notification 模块仅依赖 infra 层（Prisma Client、logger、config、scheduler），不调用任何其他业务模块的接口。
> 通知的内容文案由调用方（activity、coaching、review）在调用 NotificationService.create() 时传入，notification 模块不需要反向查询用户昵称、活动名称等信息。

---

## 6. 关键业务逻辑

### 6.1 通知创建流程

```
调用方调用 NotificationService.create(notification):
1. 校验参数完整性（userId、type、title、content、targetType、targetId 不能为空）
2. 校验 type 在 NotificationType 枚举范围内
3. 校验 targetType 在 TargetType 枚举范围内
4. Repository 创建 Notification 记录（isRead = false）
5. 返回创建的通知对象
6. 异常时抛出错误（由调用方 try-catch 处理，不在本模块内吞掉）
```

### 6.2 通知文案生成（调用方职责）

通知内容由调用方根据 PRD 定义的文案模板生成，示例：

| 通知类型 | title 示例 | content 示例 | 调用方 |
|---------|-----------|-------------|--------|
| ACTIVITY_JOINED | 新成员加入 | {用户昵称} 加入了你的活动「{球馆名称} {开始日期}」 | activity |
| ACTIVITY_LEFT | 成员退出 | {用户昵称} 退出了你的活动「{球馆名称} {开始日期}」 | activity |
| ACTIVITY_UPDATED | 活动已更新 | 你参加的活动「{球馆名称} {开始日期}」信息已更新 | activity |
| ACTIVITY_CANCELLED | 活动已取消 | 你参加的活动「{球馆名称} {原开始日期}」已被取消 | activity |
| GROUP_CLASS_ENROLLED | 新学员报名 | {用户昵称} 报名了你的团课「{课程名称}」 | coaching |
| GROUP_CLASS_ENROLLMENT_CANCELLED | 学员取消报名 | {用户昵称} 取消了团课「{课程名称}」的报名 | coaching |
| GROUP_CLASS_UPDATED | 团课已更新 | 你报名的团课「{课程名称}」信息已更新 | coaching |
| GROUP_CLASS_CANCELLED | 团课已取消 | 教练取消了团课「{课程名称}」 | coaching |
| PRIVATE_LESSON_BOOKED | 新私教预约 | {用户昵称} 预约了你的私教课（{日期} {时间段}） | coaching |
| PRIVATE_LESSON_CANCELLED_BY_STUDENT | 学员取消私教 | {用户昵称} 取消了私教课预约（{日期} {时间段}） | coaching |
| PRIVATE_LESSON_CANCELLED_BY_COACH | 教练取消私教 | 教练取消了你的私教课预约（{日期} {时间段}） | coaching |
| REVIEW_RECEIVED | 收到新评价 | {用户昵称} 对你的课程「{课程名称}」发表了评价 | review |

> notification 模块不关心文案内容的正确性，只负责存储和查询。文案模板的变量替换由调用方完成。

### 6.3 通知过期自动清理

```
触发: 每天一次（通过 infra/scheduler 注册 cron 任务）
逻辑:
1. 计算截止时间：当前时间 - 90 天
2. 删除 createdAt < 截止时间 的所有通知记录（物理删除）
3. 记录 info 日志：清理的通知数量
4. 异常时记录 error 日志，不影响服务稳定性
```

### 6.4 通知查询数据隔离

```
所有用户端查询接口（通知列表、未读计数、标记已读）均通过 JWT 中的 userId 作为查询条件，
确保用户只能访问自己的通知数据。

标记单条已读时，额外校验 notification.userId === 当前用户 ID，
防止通过构造通知 ID 访问他人通知。
```

---

## 7. 模块特有约定

### 安全要求
- 通知内容中可能包含用户昵称，不包含手机号等敏感信息（调用方职责保证）
- 用户只能查看和操作自己的通知，不可跨用户访问
- 通知 ID 使用 UUID，不可被枚举遍历

### 性能约束
- 未读通知数（GET /api/notifications/unread-count）为高频接口（页面加载/切换时调用），需保持轻量：
  - 使用 COUNT 查询，不加载通知内容
  - 联合索引 (userId, isRead, createdAt) 覆盖查询
- 通知列表查询通过分页控制返回数据量
- 批量创建通知（createBatch）使用 Prisma createMany 减少数据库往返
- 定时清理任务在低峰期执行（建议配置为每天凌晨 3 点），避免影响正常请求

### 错误处理
- HTTP 接口的错误通过抛出带 error code 的异常，由 infra/error-handler.ts 统一处理
- 内部接口（create / createBatch）的错误由调用方 try-catch 处理，notification 模块不吞掉异常
- 定时清理任务中的异常通过 try-catch 捕获，记录 error 日志，不影响服务稳定性

### 日志策略
- 通知创建：info 级别记录创建事件（userId 脱敏或仅记录前 8 位，type，targetType）
- 通知批量创建：info 级别记录批次结果（successCount, failedCount）
- 标记已读：debug 级别记录（非关键业务事件）
- 定时清理：info 级别记录清理开始/结束、清理数量；error 级别记录清理异常
- 定时任务日志使用 `module: "notification-cleanup"` 标记

---

## 8. 已知限制和 TODO

- 一期仅支持站内通知，不支持短信/邮件/微信推送等外部渠道
- 一期通知文案模板由调用方硬编码，不支持管理后台配置通知模板
- 一期不支持通知偏好设置（如用户关闭某类通知）
- 一期不支持删除单条通知（只有过期自动清理）
- 一期不支持标记为未读（只能标记为已读）
- 定时清理为物理删除，清理后不可恢复
- TODO: 二期可考虑引入 WebSocket 实现通知实时推送（当前为前端轮询或页面刷新获取）
- TODO: 二期可考虑通知偏好设置功能
- TODO: 二期可考虑接入外部推送渠道（短信、微信模板消息等）
- TODO: 二期可考虑通知模板管理后台配置化
