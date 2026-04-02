# 模块详细设计: activity

> 本文档描述 activity 后端模块的内部设计和接口契约。系统级架构见 architecture.md。

## 1. 模块概述

- **职责**: 约球活动的全生命周期管理（创建、加入、退出、修改、取消、状态自动流转）
- **类型**: 后端模块
- **业务模块映射**: PRD 中的「约球（FB）」
- **依赖层级**: 中间层（依赖 user、venue、notification）

---

## 2. 内部架构

### 分层结构

```
activity/
├── controller.ts      # 请求处理、参数校验、响应格式化
├── service.ts         # 业务逻辑、规则执行、状态流转、定时任务注册
├── repository.ts      # 数据访问、Prisma 查询封装
├── types.ts           # 模块内类型定义（活动状态枚举、输入输出类型）
└── index.ts           # 对外导出（公开接口）
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Controller | 接收请求、参数校验、调用 Service、格式化响应 | Service |
| Service | 业务逻辑（活动创建、加入/退出、修改/取消、状态流转、定时任务注册）、通知发送编排 | Repository, UserService, VenueService, NotificationService, infra（logger、config、scheduler） |
| Repository | 数据库操作、Prisma 查询封装（含距离计算排序的 SQL） | Prisma Client（infra） |

### 控制流

```
HTTP 请求 → Controller（校验）→ Service（业务逻辑）→ Repository（数据访问）→ 响应

定时任务 → scheduler 触发 → Service（状态流转扫描）→ Repository（批量更新）
```

---

## 3. 数据模型

### Activity

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| creatorId | string (uuid) | NOT NULL, FK → User.id | 发起人用户 ID |
| venueId | string (uuid) \| null | FK → Venue.id, ON DELETE SET NULL | 活动球馆 ID（球馆被管理员移除后为 null） |
| title | string \| null | | 活动标题（可选，为空时前端使用球馆名称+日期作为展示标题） |
| startTime | datetime | NOT NULL | 活动开始时间 |
| endTime | datetime | NOT NULL | 活动结束时间 |
| maxParticipants | int | NOT NULL | 限定人数（2-50） |
| status | string (enum) | NOT NULL, DEFAULT 'open' | 活动状态（见下方枚举） |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### ActivityParticipant

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| activityId | string (uuid) | NOT NULL, FK → Activity.id, ON DELETE CASCADE | 活动 ID |
| userId | string (uuid) | NOT NULL, FK → User.id | 参与者用户 ID |
| joinedAt | datetime | NOT NULL | 加入时间 |

**唯一约束**: `(activityId, userId)` 联合唯一（同一用户不可重复加入同一活动）

### 活动状态枚举（status）

| 枚举值 | 说明 | 可执行的操作 |
|--------|------|-------------|
| open | 报名中（未满员） | 加入、退出、修改、取消 |
| full | 已满员 | 退出、修改、取消 |
| in_progress | 进行中 | 无 |
| completed | 已结束 | 无（可录入战绩，由 match-record 模块处理） |
| cancelled | 已取消 | 无 |

### 索引

- `Activity.creatorId` -- 索引（查询用户发起的活动）
- `Activity.status` -- 索引（定时任务状态流转查询）
- `Activity.startTime` -- 索引（按时间排序、定时任务查询）
- `Activity.venueId` -- 外键索引（按球馆查询）
- `Activity.(status, startTime)` -- 联合索引（定时任务扫描：状态+开始时间条件组合）
- `Activity.(status, endTime)` -- 联合索引（定时任务扫描：状态+结束时间条件组合）
- `ActivityParticipant.(activityId, userId)` -- UNIQUE 联合索引（防止重复加入）
- `ActivityParticipant.userId` -- 索引（查询用户参与的活动）

### 模型关系

```
User 1 ← N Activity（一个用户可发起多个活动，通过 creatorId）
Venue 1 ← N Activity（一个球馆可关联多个活动，通过 venueId）
Activity 1 ← N ActivityParticipant（一个活动可有多个参与者）
User 1 ← N ActivityParticipant（一个用户可参与多个活动）
```

### 与其他模块数据的关系

- Activity.creatorId 引用 User（user 模块）的主键
- Activity.venueId 引用 Venue（venue 模块）的主键，ON DELETE SET NULL
- ActivityParticipant.userId 引用 User（user 模块）的主键
- Activity.id 被 match-record 模块的 MatchRecord.sourceId（sourceType = 'activity'）引用（多态关联，无物理外键）

---

## 4. 接口契约

> 每个接口必须包含五要素：**输入、输出、业务规则、错误码、consumers**。
> 接口通用约定（认证方式、响应格式、分页、HTTP 状态码）见 architecture.md。

### 创建活动

`POST /api/activities`

**描述**: 发起一个约球活动

**认证**: 需要

**Consumers**: web-app（发起约球页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| venueId | string (uuid) | 是 | 球馆 ID |
| title | string | 否 | 活动标题（最长 50 字符，为空时前端使用球馆名称+日期展示） |
| startTime | string (ISO 8601) | 是 | 活动开始时间 |
| endTime | string (ISO 8601) | 是 | 活动结束时间 |
| maxParticipants | number | 是 | 限定人数（2-50） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "creatorId": "uuid",
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心羽毛球馆",
      "address": "北京市朝阳区...",
      "latitude": 39.9215,
      "longitude": 116.4435
    },
    "title": null,
    "startTime": "2026-04-05T14:00:00.000Z",
    "endTime": "2026-04-05T16:00:00.000Z",
    "maxParticipants": 8,
    "currentParticipants": 1,
    "status": "open",
    "participants": [
      {
        "userId": "uuid",
        "nickname": "球友38291",
        "avatarUrl": null,
        "joinedAt": "2026-04-02T10:00:00.000Z"
      }
    ],
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**业务规则**:
- 调用 VenueService.getVenueById(venueId) 验证球馆存在，不存在返回 ACTIVITY_VENUE_NOT_FOUND
- startTime 必须晚于当前时间
- endTime 必须晚于 startTime
- maxParticipants 范围为 2-50 的整数
- title 为可选字段，若提供则长度不超过 50 字符
- 发起人自动成为第一个参与者（在同一事务中创建 Activity 和 ActivityParticipant）
- 创建成功后活动状态为 open
- 由于发起人自动加入，maxParticipants 若为 2 且仅有发起人 1 人，状态保持 open

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | ACTIVITY_INVALID_VENUE | venueId 缺失或格式不合法 |
| 400 | ACTIVITY_INVALID_TIME | 开始时间不晚于当前时间，或结束时间不晚于开始时间 |
| 400 | ACTIVITY_INVALID_PARTICIPANTS | maxParticipants 不在 2-50 范围内 |
| 400 | ACTIVITY_INVALID_TITLE | title 超过 50 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 404 | ACTIVITY_VENUE_NOT_FOUND | 球馆不存在 |

---

### 活动列表

`GET /api/activities`

**描述**: 获取约球活动列表，支持筛选、排序和分页

**认证**: 需要

**Consumers**: web-app（约球列表页/首页）

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页条数（默认 20，最大 100） |
| dateFilter | string | 否 | 时间筛选：today / tomorrow / this_week / 不传则不限 |
| dateStart | string (ISO 8601) | 否 | 自定义日期范围开始（与 dateEnd 配合使用，当 dateFilter 未传时生效） |
| dateEnd | string (ISO 8601) | 否 | 自定义日期范围结束 |
| maxDistance | number | 否 | 距离筛选（单位 km）：3 / 5 / 10，需配合 latitude、longitude 使用 |
| latitude | number | 否 | 用户纬度（用于距离排序和距离筛选） |
| longitude | number | 否 | 用户经度（用于距离排序和距离筛选） |
| hasSlot | boolean | 否 | 空余筛选：true 仅显示有空位的活动（status 为 open） |
| sortBy | string | 否 | 排序方式：time（默认，按开始时间升序） / distance（按距离升序，需传入经纬度） |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "creatorId": "uuid",
        "venue": {
          "id": "uuid",
          "name": "朝阳体育中心羽毛球馆",
          "address": "北京市朝阳区...",
          "latitude": 39.9215,
          "longitude": 116.4435
        },
        "title": null,
        "startTime": "2026-04-05T14:00:00.000Z",
        "endTime": "2026-04-05T16:00:00.000Z",
        "maxParticipants": 8,
        "currentParticipants": 3,
        "status": "open",
        "distance": 1.2,
        "createdAt": "2026-04-02T10:00:00.000Z"
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 20
  }
}
```

> `distance` 字段：仅当请求中传入了 `latitude` 和 `longitude` 时返回，单位为千米（km），保留一位小数。未传入经纬度时该字段不返回。

**业务规则**:
- 默认仅返回未来的活动（startTime > 当前时间）且状态不为 cancelled 的活动
- 时间筛选（dateFilter）：
  - today: startTime 在今天 0:00-23:59:59 之间
  - tomorrow: startTime 在明天 0:00-23:59:59 之间
  - this_week: startTime 在本周一 0:00 到本周日 23:59:59 之间
  - dateFilter 和 dateStart/dateEnd 互斥，dateFilter 优先
- 自定义日期范围（dateStart + dateEnd）：startTime 在指定范围内；dateStart 和 dateEnd 必须同时提供
- 距离筛选（maxDistance）：仅返回球馆距离用户位置不超过指定公里数的活动，需 latitude 和 longitude 同时提供
- 空余筛选（hasSlot）：true 时仅返回 status 为 open 的活动
- 排序方式（sortBy）：
  - time（默认）：按 startTime 升序（最近的排前面）
  - distance：按距离升序，需 latitude 和 longitude 同时提供；未提供经纬度时忽略此排序，回退到 time
- latitude 和 longitude 必须同时提供或同时不提供
- 活动列表中不返回参与者详情列表（仅返回 currentParticipants 数量），减少数据传输
- venue 信息通过 JOIN 或批量查询获取，不逐条调用 VenueService（性能考虑）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | ACTIVITY_INVALID_COORDINATES | 经纬度只提供了一个，或格式不合法 |
| 400 | ACTIVITY_INVALID_DATE_RANGE | dateStart 和 dateEnd 只提供了一个，或 dateEnd 早于 dateStart |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 活动详情

`GET /api/activities/:id`

**描述**: 获取指定活动的详细信息，包含参与者列表

**认证**: 需要

**Consumers**: web-app（活动详情页）, match-record（录入战绩时展示活动信息）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 活动 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "creatorId": "uuid",
    "creator": {
      "id": "uuid",
      "nickname": "球友38291",
      "avatarUrl": null
    },
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心羽毛球馆",
      "address": "北京市朝阳区...",
      "latitude": 39.9215,
      "longitude": 116.4435
    },
    "title": null,
    "startTime": "2026-04-05T14:00:00.000Z",
    "endTime": "2026-04-05T16:00:00.000Z",
    "maxParticipants": 8,
    "currentParticipants": 3,
    "status": "open",
    "participants": [
      {
        "userId": "uuid",
        "nickname": "球友38291",
        "avatarUrl": null,
        "joinedAt": "2026-04-02T10:00:00.000Z"
      },
      {
        "userId": "uuid",
        "nickname": "羽球达人",
        "avatarUrl": "https://...",
        "joinedAt": "2026-04-02T11:00:00.000Z"
      }
    ],
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**业务规则**:
- 任何已登录用户均可查看活动详情（包括已取消、已结束的活动）
- 参与者列表按加入时间（joinedAt）升序排列，发起人排第一
- 参与者信息通过 UserService.getUsersByIds() 批量获取
- venue 为 null 时（球馆被管理员移除），venue 字段返回 null
- creator 信息通过 UserService.getUserById() 获取

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 404 | ACTIVITY_NOT_FOUND | 活动不存在 |

---

### 加入活动

`POST /api/activities/:id/join`

**描述**: 当前用户加入指定活动

**认证**: 需要

**Consumers**: web-app（活动详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 活动 ID |

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "activityId": "uuid",
    "userId": "uuid",
    "currentParticipants": 4,
    "status": "open",
    "joinedAt": "2026-04-02T12:00:00.000Z"
  }
}
```

**业务规则**:
- 活动状态必须为 open 才能加入
- 活动状态为 full/in_progress/completed/cancelled 时不可加入
- 用户不能重复加入同一活动
- 加入后检查参与人数：若 currentParticipants == maxParticipants，自动将状态更新为 full
- 加入成功后，通过 NotificationService.create() 通知活动发起人：
  - type: ACTIVITY_JOINED
  - title: "新成员加入"
  - content: "{加入者昵称} 加入了你的活动「{球馆名称} {开始日期}」"
  - targetType: "activity"
  - targetId: 活动 ID
  - 发起人自己加入（即 creatorId === 加入者 userId）时不发通知（实际上发起人在创建时已自动加入，此场景不应发生，但作为防御性逻辑保留）
- 通知创建失败不阻塞主流程（try-catch + error 日志）
- 返回加入后的最新参与人数和活动状态

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 404 | ACTIVITY_NOT_FOUND | 活动不存在 |
| 409 | ACTIVITY_FULL | 活动已满员（状态为 full） |
| 409 | ACTIVITY_ALREADY_JOINED | 用户已加入该活动 |
| 409 | ACTIVITY_NOT_JOINABLE | 活动状态不允许加入（in_progress / completed / cancelled） |

---

### 退出活动

`POST /api/activities/:id/leave`

**描述**: 当前用户退出指定活动

**认证**: 需要

**Consumers**: web-app（活动详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 活动 ID |

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "activityId": "uuid",
    "userId": "uuid",
    "currentParticipants": 3,
    "status": "open"
  }
}
```

**业务规则**:
- 发起人不可退出自己发起的活动（应使用"取消活动"功能），返回 ACTIVITY_CREATOR_CANNOT_LEAVE
- 活动状态必须为 open 或 full 才能退出（即活动尚未开始）
- 已开始（in_progress）或已结束（completed）的活动不可退出
- 已取消的活动不可退出
- 用户必须是该活动的参与者才能退出
- 退出后检查参与人数：若当前状态为 full 且退出后人数 < maxParticipants，自动将状态恢复为 open
- 退出成功后，通过 NotificationService.create() 通知活动发起人：
  - type: ACTIVITY_LEFT
  - title: "成员退出"
  - content: "{退出者昵称} 退出了你的活动「{球馆名称} {开始日期}」"
  - targetType: "activity"
  - targetId: 活动 ID
- 通知创建失败不阻塞主流程

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | ACTIVITY_CREATOR_CANNOT_LEAVE | 发起人尝试退出自己的活动 |
| 404 | ACTIVITY_NOT_FOUND | 活动不存在 |
| 409 | ACTIVITY_NOT_LEAVABLE | 活动状态不允许退出（in_progress / completed / cancelled） |
| 409 | ACTIVITY_NOT_PARTICIPANT | 用户不是该活动的参与者 |

---

### 修改活动

`PUT /api/activities/:id`

**描述**: 发起人修改活动信息

**认证**: 需要

**Consumers**: web-app（活动详情页 -- 编辑模式）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 活动 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| venueId | string (uuid) | 否 | 球馆 ID |
| title | string | 否 | 活动标题（最长 50 字符） |
| startTime | string (ISO 8601) | 否 | 活动开始时间 |
| endTime | string (ISO 8601) | 否 | 活动结束时间 |
| maxParticipants | number | 否 | 限定人数（2-50） |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "creatorId": "uuid",
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心羽毛球馆",
      "address": "北京市朝阳区...",
      "latitude": 39.9215,
      "longitude": 116.4435
    },
    "title": null,
    "startTime": "2026-04-05T15:00:00.000Z",
    "endTime": "2026-04-05T17:00:00.000Z",
    "maxParticipants": 10,
    "currentParticipants": 3,
    "status": "open",
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅发起人可修改活动信息（校验 activity.creatorId === 当前用户 ID）
- 活动状态必须为 open 或 full 才能修改（即活动尚未开始）
- 已开始（in_progress）或已结束（completed）的活动不可修改
- 已取消的活动不可修改
- 只更新请求体中包含的字段，未提供的字段保持不变
- 若修改 venueId，调用 VenueService.getVenueById() 验证球馆存在
- 若修改 startTime，新的开始时间必须晚于当前时间
- 若修改 endTime 或 startTime，endTime 必须晚于 startTime（使用修改后的值进行比较）
- 若修改 maxParticipants，新值不能小于当前参与人数（否则需要先有人退出）
- 修改 maxParticipants 后重新检查满员状态：
  - 修改后 currentParticipants == maxParticipants → status 设为 full
  - 修改后 currentParticipants < maxParticipants 且当前 status 为 full → status 恢复为 open
- 修改成功后，通过 NotificationService.createBatch() 通知所有参与者（不含发起人自己）：
  - type: ACTIVITY_UPDATED
  - title: "活动已更新"
  - content: "你参加的活动「{球馆名称} {开始日期}」信息已更新"
  - targetType: "activity"
  - targetId: 活动 ID
- 通知创建失败不阻塞主流程

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | ACTIVITY_INVALID_VENUE | venueId 格式不合法 |
| 400 | ACTIVITY_INVALID_TIME | 开始时间不晚于当前时间，或结束时间不晚于开始时间 |
| 400 | ACTIVITY_INVALID_PARTICIPANTS | maxParticipants 不在 2-50 范围内 |
| 400 | ACTIVITY_INVALID_TITLE | title 超过 50 字符 |
| 400 | ACTIVITY_PARTICIPANTS_EXCEED | maxParticipants 小于当前参与人数 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | ACTIVITY_NOT_CREATOR | 非发起人尝试修改活动 |
| 404 | ACTIVITY_NOT_FOUND | 活动不存在 |
| 404 | ACTIVITY_VENUE_NOT_FOUND | 球馆不存在（修改 venueId 时） |
| 409 | ACTIVITY_NOT_MODIFIABLE | 活动状态不允许修改（in_progress / completed / cancelled） |

---

### 取消活动

`POST /api/activities/:id/cancel`

**描述**: 发起人取消活动

**认证**: 需要

**Consumers**: web-app（活动详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 活动 ID |

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "status": "cancelled"
  }
}
```

**业务规则**:
- 仅发起人可取消活动（校验 activity.creatorId === 当前用户 ID）
- 活动状态必须为 open 或 full 才能取消（即活动尚未开始）
- 已开始（in_progress）或已结束（completed）的活动不可取消
- 已取消的活动不可重复取消（幂等：返回当前状态，不报错）
- 取消后活动状态变为 cancelled，不可恢复
- 取消成功后，通过 NotificationService.createBatch() 通知所有参与者（不含发起人自己）：
  - type: ACTIVITY_CANCELLED
  - title: "活动已取消"
  - content: "你参加的活动「{球馆名称} {原开始日期}」已被取消"
  - targetType: "activity"
  - targetId: 活动 ID
- 通知创建失败不阻塞主流程

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | ACTIVITY_NOT_CREATOR | 非发起人尝试取消活动 |
| 404 | ACTIVITY_NOT_FOUND | 活动不存在 |
| 409 | ACTIVITY_NOT_CANCELLABLE | 活动状态不允许取消（in_progress / completed） |

---

### 用户参与的活动列表

`GET /api/users/:id/activities`

**描述**: 获取指定用户参与（含发起）的活动列表

**认证**: 需要

**Consumers**: web-app（个人主页 -- 我的活动）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 用户 ID |

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页条数（默认 20，最大 100） |
| role | string | 否 | 角色筛选：creator（仅我发起的）/ participant（仅我参与的，不含发起）；不传则返回全部 |
| status | string | 否 | 状态筛选：open / full / in_progress / completed / cancelled；不传则返回全部 |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "creatorId": "uuid",
        "venue": {
          "id": "uuid",
          "name": "朝阳体育中心羽毛球馆",
          "address": "北京市朝阳区...",
          "latitude": 39.9215,
          "longitude": 116.4435
        },
        "title": null,
        "startTime": "2026-04-05T14:00:00.000Z",
        "endTime": "2026-04-05T16:00:00.000Z",
        "maxParticipants": 8,
        "currentParticipants": 3,
        "status": "open",
        "createdAt": "2026-04-02T10:00:00.000Z"
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 20
  }
}
```

**业务规则**:
- 当 userId 对应的用户不存在时，返回空列表（而非 404），与社交平台惯例一致（不暴露用户是否存在）
- 任何已登录用户均可查看其他用户参与的活动列表（公开信息）
- role 筛选：
  - creator: 仅返回 creatorId === userId 的活动
  - participant: 仅返回在 ActivityParticipant 中有记录但 creatorId !== userId 的活动
  - 不传：返回所有与该用户相关的活动（发起的 + 参与的）
- 按 startTime 倒序排列（最近的排前面）
- 不返回参与者详情列表，仅返回 currentParticipants 数量

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 内部接口（跨模块 Service 调用）

> 非 HTTP 暴露的接口。用于其他模块的 Service 层直接调用本模块的 Service。

#### ActivityService.getActivityById(id)

**描述**: 根据活动 ID 获取活动信息（供其他模块校验活动存在性或获取活动信息）

**Consumers**: match-record

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 活动 ID (uuid) |

**返回值**:
```typescript
{
  id: string;
  creatorId: string;
  venueId: string | null;
  startTime: Date;
  endTime: Date;
  status: string;
} | null
```

**业务规则**:
- 活动不存在时返回 null（由调用方决定如何处理）
- 返回字段包含 status，供调用方校验活动状态（如 match-record 校验活动是否已结束）

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 活动不存在时返回 null，不抛错 |

---

#### ActivityService.getParticipantIds(activityId)

**描述**: 获取活动的所有参与者用户 ID 列表（供 match-record 模块校验用户是否为活动参与者）

**Consumers**: match-record

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityId | string | 是 | 活动 ID (uuid) |

**返回值**:
```typescript
string[]  // 用户 ID 列表
```

**业务规则**:
- 返回该活动所有参与者的 userId 列表（包含发起人）
- 活动不存在时返回空数组（由调用方决定如何处理）
- 返回顺序不保证

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 始终返回结果，不抛错 |

---

## 5. 消费的外部接口

| 接口 | 提供方 | 调用场景 |
|------|--------|---------|
| VenueService.getVenueById(id) | venue | 创建活动时验证球馆存在；修改活动球馆时验证球馆存在 |
| UserService.getUserById(id) | user | 活动详情中获取发起人信息 |
| UserService.getUsersByIds(ids) | user | 活动详情中批量获取参与者信息；通知文案中获取用户昵称 |
| NotificationService.create(notification) | notification | 加入活动时通知发起人；退出活动时通知发起人 |
| NotificationService.createBatch(notifications) | notification | 修改活动时通知所有参与者；取消活动时通知所有参与者 |

---

## 6. 关键业务逻辑

### 6.1 活动状态机

```
                         创建
                          │
                          ▼
                  ┌──── open ◄───┐
                  │       │      │
           满员   │       │      │ 有人退出（从 full）
                  │       │      │
                  ▼       │      │
                full ─────┘──────┘
                  │
                  │  发起人取消（open 或 full）
                  ├──────────────────────────→ cancelled
                  │
    startTime 到达│                            （终态，不可恢复）
                  │
                  ▼
            in_progress
                  │
    endTime 到达  │
                  │
                  ▼
             completed

状态流转触发条件:
- open → full:      加入活动后 currentParticipants == maxParticipants
- full → open:      退出活动后 currentParticipants < maxParticipants;
                    修改 maxParticipants 后 currentParticipants < maxParticipants
- open → in_progress:  定时任务检测 startTime <= 当前时间
- full → in_progress:  定时任务检测 startTime <= 当前时间
- in_progress → completed: 定时任务检测 endTime <= 当前时间
- open/full → cancelled:   发起人主动取消
```

### 6.2 定时任务 -- 活动状态自动流转

```
触发: 每分钟一次（通过 infra/scheduler 注册 cron 任务）

逻辑:
1. 查询状态为 open 或 full 且 startTime <= 当前时间 的活动
2. 批量更新状态为 in_progress
3. 查询状态为 in_progress 且 endTime <= 当前时间 的活动
4. 批量更新状态为 completed
5. 记录 info 日志：本次状态变更的活动数量

注意:
- 批量更新使用 Prisma updateMany，不逐条更新
- 定时任务异常通过 try-catch 捕获，记录 error 日志，不影响服务稳定性
- 日志使用 module: "activity-status" 标记
```

### 6.3 加入活动与满员状态联动

```
1. 校验活动状态为 open
2. 校验用户未重复加入（查询 ActivityParticipant 是否存在记录）
3. 在同一事务中:
   a. 创建 ActivityParticipant 记录
   b. 计算当前参与人数
   c. 若 currentParticipants == maxParticipants → 更新 activity.status 为 full
4. 事务外: 发送通知（try-catch）
```

### 6.4 退出活动与满员状态联动

```
1. 校验用户为活动参与者
2. 校验用户不是发起人
3. 校验活动状态为 open 或 full
4. 在同一事务中:
   a. 删除 ActivityParticipant 记录
   b. 若当前 activity.status 为 full → 计算参与人数，若 < maxParticipants → 更新为 open
5. 事务外: 发送通知（try-catch）
```

### 6.5 通知文案生成

activity 模块负责按 PRD 定义的模板生成通知文案，通过 NotificationService 创建通知。

| 事件 | type | title | content 模板 | 通知对象 |
|------|------|-------|-------------|---------|
| 加入活动 | ACTIVITY_JOINED | 新成员加入 | {用户昵称} 加入了你的活动「{球馆名称} {开始日期MM/DD}」 | 发起人 |
| 退出活动 | ACTIVITY_LEFT | 成员退出 | {用户昵称} 退出了你的活动「{球馆名称} {开始日期MM/DD}」 | 发起人 |
| 修改活动 | ACTIVITY_UPDATED | 活动已更新 | 你参加的活动「{球馆名称} {开始日期MM/DD}」信息已更新 | 所有参与者（不含发起人） |
| 取消活动 | ACTIVITY_CANCELLED | 活动已取消 | 你参加的活动「{球馆名称} {原开始日期MM/DD}」已被取消 | 所有参与者（不含发起人） |

> 球馆名称从 VenueService.getVenueById() 获取；若球馆已被删除（venueId 为 null），球馆名称使用"已删除的球馆"。
> 用户昵称从 UserService.getUserById() 获取。
> 开始日期格式为 MM/DD（如 04/05）。

---

## 7. 模块特有约定

### 安全要求
- 活动修改和取消操作必须校验 creatorId === 当前用户 ID，非发起人不可操作
- 活动详情和列表为公开数据，任何已登录用户均可查看

### 性能约束
- 活动列表接口为高频接口（首页），需确保响应在 500ms 内（PRD 非功能需求）：
  - 活动表在 status、startTime 上建索引
  - 距离排序在 Repository 层通过 SQL 实现（Haversine 公式），不加载全量数据到应用层
  - 分页控制返回数据量
- 定时任务（每分钟）使用批量更新，不逐条处理
- 活动列表中的 venue 信息通过 Prisma relation 或 JOIN 获取，不逐条调用 VenueService
- 活动列表中的 currentParticipants 通过 COUNT 子查询或预计算获取

### 并发控制
- 加入活动的满员判断需注意并发：使用数据库事务 + 唯一约束（activityId, userId）防止重复加入；满员状态更新在事务内基于实际 COUNT 判断
- 定时任务使用 WHERE 条件（status + 时间条件）进行批量更新，天然幂等

### 错误处理
- HTTP 接口的错误通过抛出带 error code 的异常，由 infra/error-handler.ts 统一处理
- 通知发送失败不阻塞主流程（try-catch + error 日志）
- 定时任务中的异常通过 try-catch 捕获，记录 error 日志，不影响服务稳定性

### 日志策略
- 活动创建：info 级别记录 creatorId（前 8 位）、venueId、startTime
- 加入/退出活动：info 级别记录 activityId、userId（前 8 位）、操作类型
- 修改/取消活动：info 级别记录 activityId、操作人 userId（前 8 位）
- 定时任务：info 级别记录状态变更的活动数量；debug 级别记录具体活动 ID
- 定时任务日志使用 `module: "activity-status"` 标记

---

## 8. 已知限制和 TODO

- 一期不支持活动候补机制（人满后排队等候）
- 一期不支持活动评论/讨论功能
- 一期活动列表距离计算使用直线距离（Haversine），非导航距离
- 一期发起人取消活动后不可恢复
- 一期不限制单个用户可发起的活动数量
- 一期不限制取消活动的截止时间（开始前均可取消）
- title 字段为可选项，一期不要求必填，前端在展示时可用球馆名称+日期作为默认标题
- TODO: 二期可考虑活动候补机制
- TODO: 二期可考虑活动讨论/评论功能
- TODO: 二期可考虑取消活动的时间限制（如开始前 2 小时不可取消）
- TODO: 二期可考虑活动搜索支持更多条件（如按球馆名称搜索）
