# 模块详细设计: coaching

> 本文档描述 coaching 后端模块的内部设计和接口契约。系统级架构见 architecture.md。

## 1. 模块概述

- **职责**: 教练资料管理、团课发布与报名管理、私教时间设置与预约管理、课程状态自动流转
- **类型**: 后端模块
- **业务模块映射**: PRD 中的「教练管理（FC）」
- **依赖层级**: 中间层（依赖 user、venue、notification）

---

## 2. 内部架构

### 分层结构

```
coaching/
├── controller.ts      # 请求处理、参数校验、响应格式化
├── service.ts         # 业务逻辑、规则执行、状态流转、定时任务注册
├── repository.ts      # 数据访问、Prisma 查询封装
├── types.ts           # 模块内类型定义（课程状态枚举、擅长方向枚举、输入输出类型）
└── index.ts           # 对外导出（公开接口）
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Controller | 接收请求、参数校验、调用 Service、格式化响应 | Service |
| Service | 业务逻辑（教练资料管理、团课发布/报名/修改/取消、私教时间设置/预约/取消、状态流转、定时任务注册）、通知发送编排 | Repository, UserService, VenueService, NotificationService, infra（logger、config、scheduler） |
| Repository | 数据库操作、Prisma 查询封装 | Prisma Client（infra） |

### 控制流

```
HTTP 请求 → Controller（校验）→ Service（业务逻辑）→ Repository（数据访问）→ 响应

定时任务 → scheduler 触发 → Service（课程状态流转扫描）→ Repository（批量更新）→ 通知发送
```

---

## 3. 数据模型

### CoachProfile

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| userId | string (uuid) | NOT NULL, UNIQUE, FK → User.id | 关联的用户 ID（一对一） |
| bio | string \| null | | 教练简介 |
| specialties | string[] | NOT NULL, DEFAULT [] | 擅长方向标签列表（见下方枚举） |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

> 教练评分（averageRating）和历史学员数（studentCount）不在本模型中存储。评分由 review 模块实时计算（遵循 architecture.md 决策 6）；历史学员数由本模块实时计算（查询团课和私教课的不重复参与人数）。

### 擅长方向枚举（specialties）

| 枚举值 | 说明 |
|--------|------|
| singles | 单打 |
| doubles | 双打 |
| footwork | 步法 |
| fitness | 体能 |
| tactics | 战术 |

### GroupClass

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| coachId | string (uuid) | NOT NULL, FK → User.id | 教练用户 ID |
| venueId | string (uuid) \| null | FK → Venue.id, ON DELETE SET NULL | 上课球馆 ID（球馆被管理员移除后为 null） |
| title | string | NOT NULL | 课程名称（最长 50 字符） |
| startTime | datetime | NOT NULL | 开始时间 |
| endTime | datetime | NOT NULL | 结束时间 |
| maxParticipants | int | NOT NULL | 限定人数（2-30） |
| feeDescription | string \| null | | 费用说明（文本，选填） |
| status | string (enum) | NOT NULL, DEFAULT 'open' | 课程状态（见下方枚举） |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### GroupClassEnrollment

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| groupClassId | string (uuid) | NOT NULL, FK → GroupClass.id, ON DELETE CASCADE | 团课 ID |
| userId | string (uuid) | NOT NULL, FK → User.id | 学员用户 ID |
| enrolledAt | datetime | NOT NULL | 报名时间 |

**唯一约束**: `(groupClassId, userId)` 联合唯一（同一学员不可重复报名同一团课）

### 团课状态枚举（GroupClass.status）

| 枚举值 | 说明 | 可执行的操作 |
|--------|------|-------------|
| open | 报名中（未满员） | 报名、取消报名、修改、取消课程 |
| full | 已满员 | 取消报名、修改、取消课程 |
| in_progress | 进行中 | 无 |
| completed | 已结束 | 无（可录入战绩和评价，由 match-record/review 模块处理） |
| cancelled | 已取消 | 无 |

### PrivateLessonSlot

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| coachId | string (uuid) | NOT NULL, FK → User.id | 教练用户 ID |
| startTime | datetime | NOT NULL | 时间段开始时间 |
| endTime | datetime | NOT NULL | 时间段结束时间（startTime + N 小时，最小粒度 1 小时） |
| venueIds | string[] | NOT NULL, DEFAULT [] | 可选球馆 ID 列表（空数组表示不限地点） |
| feeDescription | string \| null | | 费用说明（文本，选填） |
| isBooked | boolean | NOT NULL, DEFAULT false | 是否已被预约 |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### PrivateLesson

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| slotId | string (uuid) | NOT NULL, UNIQUE, FK → PrivateLessonSlot.id | 关联的时间段 ID |
| coachId | string (uuid) | NOT NULL, FK → User.id | 教练用户 ID |
| studentId | string (uuid) | NOT NULL, FK → User.id | 学员用户 ID |
| venueId | string (uuid) \| null | FK → Venue.id, ON DELETE SET NULL | 上课球馆 ID（从时间段可选球馆中选择；球馆被移除后为 null） |
| startTime | datetime | NOT NULL | 课程开始时间（冗余自 PrivateLessonSlot，便于查询） |
| endTime | datetime | NOT NULL | 课程结束时间（冗余自 PrivateLessonSlot，便于查询） |
| status | string (enum) | NOT NULL, DEFAULT 'scheduled' | 预约状态（见下方枚举） |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### 私教课状态枚举（PrivateLesson.status）

| 枚举值 | 说明 | 可执行的操作 |
|--------|------|-------------|
| scheduled | 待上课 | 学员取消、教练取消 |
| in_progress | 进行中 | 无 |
| completed | 已结束 | 无（可录入战绩和评价，由 match-record/review 模块处理） |
| cancelled | 已取消 | 无 |

### 索引

- `CoachProfile.userId` -- UNIQUE 索引（一个用户只有一条教练资料）
- `GroupClass.coachId` -- 索引（查询教练发布的团课）
- `GroupClass.status` -- 索引（定时任务状态流转查询）
- `GroupClass.startTime` -- 索引（按时间排序、定时任务查询）
- `GroupClass.venueId` -- 外键索引（按球馆查询）
- `GroupClass.(status, startTime)` -- 联合索引（定时任务扫描：状态+开始时间条件组合）
- `GroupClass.(status, endTime)` -- 联合索引（定时任务扫描：状态+结束时间条件组合）
- `GroupClassEnrollment.(groupClassId, userId)` -- UNIQUE 联合索引（防止重复报名）
- `GroupClassEnrollment.userId` -- 索引（查询学员报名的团课）
- `PrivateLessonSlot.coachId` -- 索引（查询教练的空闲时间）
- `PrivateLessonSlot.(coachId, startTime)` -- 联合索引（查询教练指定时间范围的空闲时间）
- `PrivateLesson.slotId` -- UNIQUE 索引（一个时间段只能有一个预约）
- `PrivateLesson.coachId` -- 索引（查询教练的私教课）
- `PrivateLesson.studentId` -- 索引（查询学员预约的私教课）
- `PrivateLesson.status` -- 索引（定时任务状态流转查询）
- `PrivateLesson.(status, startTime)` -- 联合索引（定时任务扫描）
- `PrivateLesson.(status, endTime)` -- 联合索引（定时任务扫描）

### 模型关系

```
User 1 ← 1 CoachProfile（一个用户对应一条教练资料，通过 userId）
User 1 ← N GroupClass（一个教练可发布多个团课，通过 coachId）
Venue 1 ← N GroupClass（一个球馆可关联多个团课，通过 venueId）
GroupClass 1 ← N GroupClassEnrollment（一个团课可有多个报名记录）
User 1 ← N GroupClassEnrollment（一个学员可报名多个团课，通过 userId）
User 1 ← N PrivateLessonSlot（一个教练可设置多个空闲时间段，通过 coachId）
PrivateLessonSlot 1 ← 1 PrivateLesson（一个时间段对应最多一个预约，通过 slotId）
User 1 ← N PrivateLesson（教练维度，通过 coachId）
User 1 ← N PrivateLesson（学员维度，通过 studentId）
```

### 与其他模块数据的关系

- CoachProfile.userId 引用 User（user 模块）的主键
- GroupClass.coachId 引用 User（user 模块）的主键
- GroupClass.venueId 引用 Venue（venue 模块）的主键，ON DELETE SET NULL
- GroupClassEnrollment.userId 引用 User（user 模块）的主键
- PrivateLessonSlot.coachId 引用 User（user 模块）的主键
- PrivateLessonSlot.venueIds 存储 Venue（venue 模块）的 ID 列表（非外键，通过接口调用校验）
- PrivateLesson.coachId 引用 User（user 模块）的主键
- PrivateLesson.studentId 引用 User（user 模块）的主键
- PrivateLesson.venueId 引用 Venue（venue 模块）的主键，ON DELETE SET NULL
- GroupClass.id 被 match-record 模块的 MatchRecord.sourceId（sourceType = 'group-class'）引用（多态关联，无物理外键）
- PrivateLesson.id 被 match-record 模块的 MatchRecord.sourceId（sourceType = 'private-lesson'）引用（多态关联，无物理外键）
- GroupClass.id 和 PrivateLesson.id 被 review 模块引用（校验学员参与关系）

---

## 4. 接口契约

> 每个接口必须包含五要素：**输入、输出、业务规则、错误码、consumers**。
> 接口通用约定（认证方式、响应格式、分页、HTTP 状态码）见 architecture.md。

### 教练列表

`GET /api/coaches`

**描述**: 获取教练列表，支持按擅长方向筛选和分页

**认证**: 需要

**Consumers**: web-app（找教练列表页）

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页条数（默认 20，最大 100） |
| specialty | string | 否 | 按擅长方向筛选：singles / doubles / footwork / fitness / tactics；不传则不限 |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "userId": "uuid",
        "nickname": "教练张",
        "avatarUrl": "https://...",
        "bio": "10年教学经验",
        "specialties": ["singles", "footwork"],
        "studentCount": 42
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 20
  }
}
```

> `studentCount` 为该教练所有团课和私教课的不重复参与人数，实时计算。
> 教练评分（averageRating、reviewCount）不在本接口返回，由前端单独调用 review 模块的 `ReviewService.getCoachAverageRating` 对应的 HTTP 接口获取（遵循 architecture.md 决策 6，保持模块间单向依赖）。

**业务规则**:
- 仅返回 `isCoach = true` 的用户对应的教练资料
- 用户信息（nickname、avatarUrl）通过 UserService.getUsersByIds() 批量获取
- specialty 筛选：教练的 specialties 数组中包含指定值即匹配
- 默认按 createdAt 倒序排列（最新注册的教练在前）；前端拿到列表后可结合 review 模块的评分数据做客户端排序
- 不返回课程详情，仅展示教练基本信息
- studentCount 通过查询该教练的 GroupClassEnrollment 和 PrivateLesson 中的不重复 userId 计算

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_SPECIALTY | specialty 值不在枚举范围内 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 教练主页

`GET /api/coaches/:id`

**描述**: 获取指定教练的主页信息，包含教练资料、课程列表

**认证**: 需要

**Consumers**: web-app（教练主页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 教练的用户 ID |

**Response 200**:
```json
{
  "data": {
    "userId": "uuid",
    "nickname": "教练张",
    "avatarUrl": "https://...",
    "bio": "10年教学经验",
    "specialties": ["singles", "footwork"],
    "studentCount": 42,
    "groupClasses": [
      {
        "id": "uuid",
        "title": "初级单打提升班",
        "startTime": "2026-04-10T14:00:00.000Z",
        "endTime": "2026-04-10T16:00:00.000Z",
        "venue": {
          "id": "uuid",
          "name": "朝阳体育中心羽毛球馆",
          "address": "北京市朝阳区..."
        },
        "maxParticipants": 10,
        "currentParticipants": 5,
        "feeDescription": "200元/人",
        "status": "open"
      }
    ],
    "privateLessonSlots": [
      {
        "id": "uuid",
        "startTime": "2026-04-11T10:00:00.000Z",
        "endTime": "2026-04-11T12:00:00.000Z",
        "venues": [
          {
            "id": "uuid",
            "name": "朝阳体育中心羽毛球馆",
            "address": "北京市朝阳区..."
          }
        ],
        "feeDescription": "300元/小时",
        "isBooked": false
      }
    ]
  }
}
```

> 教练评分和评价列表不在本接口返回，由前端分别调用 review 模块的接口获取（保持单向依赖）。

**业务规则**:
- 指定用户必须是教练角色（isCoach = true），否则返回 COACHING_NOT_A_COACH
- 用户信息通过 UserService.getUserById() 获取
- groupClasses 仅返回未来的和最近 30 天内结束的团课（即 endTime > 当前时间 - 30 天），不返回更早的历史数据；按 startTime 升序排列（未来的在前）；已取消和已结束的团课也返回（前端根据 status 区分展示）
- privateLessonSlots 仅返回未来的且未被预约的空闲时间段（isBooked = false 且 startTime > 当前时间），按 startTime 升序排列
- venue 信息通过 Prisma relation 或 JOIN 获取
- privateLessonSlots 中的 venues 通过 VenueService 批量获取可选球馆信息；venueIds 为空数组时 venues 返回空数组（表示不限地点）
- studentCount 实时计算（同教练列表中的逻辑）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 404 | COACHING_NOT_A_COACH | 用户不存在或不是教练角色 |

---

### 更新教练资料

`PUT /api/coaches/me`

**描述**: 教练更新自己的资料（简介、擅长方向）

**认证**: 需要

**Consumers**: web-app（教练资料编辑页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bio | string | 否 | 教练简介（最长 500 字符） |
| specialties | string[] | 否 | 擅长方向标签列表（从预定义枚举中选择） |

**Response 200**:
```json
{
  "data": {
    "userId": "uuid",
    "bio": "10年教学经验，擅长单打技术",
    "specialties": ["singles", "footwork"],
    "updatedAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**业务规则**:
- 当前用户必须是教练角色（isCoach = true），否则返回 COACHING_COACH_ROLE_REQUIRED
- 如果 CoachProfile 记录不存在，自动创建（教练首次编辑资料时）
- 只更新请求体中包含的字段，未提供的字段保持不变
- bio 长度限制最长 500 字符
- specialties 中每个值必须在预定义枚举范围内
- specialties 不可有重复值（去重后存储）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_BIO | 简介超过 500 字符 |
| 400 | COACHING_INVALID_SPECIALTY | specialties 中有值不在枚举范围内 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_COACH_ROLE_REQUIRED | 当前用户不是教练角色，无权执行此操作 |

---

### 发布团课

`POST /api/group-classes`

**描述**: 教练发布一个团课

**认证**: 需要

**Consumers**: web-app（我的课程管理页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 课程名称（最长 50 字符） |
| venueId | string (uuid) | 是 | 球馆 ID |
| startTime | string (ISO 8601) | 是 | 开始时间 |
| endTime | string (ISO 8601) | 是 | 结束时间 |
| maxParticipants | number | 是 | 限定人数（2-30） |
| feeDescription | string | 否 | 费用说明（最长 200 字符） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "coachId": "uuid",
    "title": "初级单打提升班",
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心羽毛球馆",
      "address": "北京市朝阳区...",
      "latitude": 39.9215,
      "longitude": 116.4435
    },
    "startTime": "2026-04-10T14:00:00.000Z",
    "endTime": "2026-04-10T16:00:00.000Z",
    "maxParticipants": 10,
    "currentParticipants": 0,
    "feeDescription": "200元/人",
    "status": "open",
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**业务规则**:
- 当前用户必须是教练角色（isCoach = true）
- 调用 VenueService.getVenueById(venueId) 验证球馆存在，不存在返回 COACHING_VENUE_NOT_FOUND
- title 不可为空，最长 50 字符
- startTime 必须晚于当前时间
- endTime 必须晚于 startTime
- maxParticipants 范围为 2-30 的整数
- feeDescription 选填，最长 200 字符
- 创建成功后课程状态为 open
- coachId 取当前用户 ID

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_TITLE | title 为空或超过 50 字符 |
| 400 | COACHING_INVALID_VENUE | venueId 缺失或格式不合法 |
| 400 | COACHING_INVALID_TIME | 开始时间不晚于当前时间，或结束时间不晚于开始时间 |
| 400 | COACHING_INVALID_PARTICIPANTS | maxParticipants 不在 2-30 范围内 |
| 400 | COACHING_INVALID_FEE_DESCRIPTION | feeDescription 超过 200 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_COACH_ROLE_REQUIRED | 当前用户不是教练角色，无权执行此操作 |
| 404 | COACHING_VENUE_NOT_FOUND | 球馆不存在 |

---

### 团课详情

`GET /api/group-classes/:id`

**描述**: 获取指定团课的详细信息，包含报名学员列表

**认证**: 需要

**Consumers**: web-app（团课详情页）, match-record（录入战绩时展示团课信息）, review（校验课程信息）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 团课 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "coachId": "uuid",
    "coach": {
      "id": "uuid",
      "nickname": "教练张",
      "avatarUrl": "https://..."
    },
    "title": "初级单打提升班",
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心羽毛球馆",
      "address": "北京市朝阳区...",
      "latitude": 39.9215,
      "longitude": 116.4435
    },
    "startTime": "2026-04-10T14:00:00.000Z",
    "endTime": "2026-04-10T16:00:00.000Z",
    "maxParticipants": 10,
    "currentParticipants": 5,
    "feeDescription": "200元/人",
    "status": "open",
    "enrollments": [
      {
        "userId": "uuid",
        "nickname": "羽球达人",
        "avatarUrl": "https://...",
        "enrolledAt": "2026-04-03T09:00:00.000Z"
      }
    ],
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**业务规则**:
- 任何已登录用户均可查看团课详情（包括已取消、已结束的团课）
- enrollments 列表按报名时间（enrolledAt）升序排列
- 学员信息通过 UserService.getUsersByIds() 批量获取
- coach 信息通过 UserService.getUserById() 获取
- venue 为 null 时（球馆被管理员移除），venue 字段返回 null

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 404 | COACHING_GROUP_CLASS_NOT_FOUND | 团课不存在 |

---

### 修改团课

`PUT /api/group-classes/:id`

**描述**: 教练修改团课信息

**认证**: 需要

**Consumers**: web-app（我的课程管理页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 团课 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 否 | 课程名称（最长 50 字符） |
| venueId | string (uuid) | 否 | 球馆 ID |
| startTime | string (ISO 8601) | 否 | 开始时间 |
| endTime | string (ISO 8601) | 否 | 结束时间 |
| maxParticipants | number | 否 | 限定人数（2-30） |
| feeDescription | string | 否 | 费用说明（最长 200 字符） |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "coachId": "uuid",
    "title": "中级单打提升班",
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心羽毛球馆",
      "address": "北京市朝阳区...",
      "latitude": 39.9215,
      "longitude": 116.4435
    },
    "startTime": "2026-04-10T15:00:00.000Z",
    "endTime": "2026-04-10T17:00:00.000Z",
    "maxParticipants": 12,
    "currentParticipants": 5,
    "feeDescription": "250元/人",
    "status": "open",
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅教练本人可修改自己的团课（校验 groupClass.coachId === 当前用户 ID）
- 团课状态必须为 open 或 full 才能修改（即课程尚未开始）
- 已开始（in_progress）或已结束（completed）的团课不可修改
- 已取消的团课不可修改
- 只更新请求体中包含的字段，未提供的字段保持不变
- 若修改 venueId，调用 VenueService.getVenueById() 验证球馆存在
- 若修改 startTime，新的开始时间必须晚于当前时间
- 若修改 endTime 或 startTime，endTime 必须晚于 startTime（使用修改后的值进行比较）
- 若修改 maxParticipants，新值不能小于当前报名人数（否则需先有学员取消报名）
- 修改 maxParticipants 后重新检查满员状态：
  - 修改后 currentParticipants == maxParticipants → status 设为 full
  - 修改后 currentParticipants < maxParticipants 且当前 status 为 full → status 恢复为 open
- 修改成功后，通过 NotificationService.createBatch() 通知所有已报名学员：
  - type: GROUP_CLASS_UPDATED
  - title: "团课已更新"
  - content: "你报名的团课「{课程名称}」信息已更新"
  - targetType: "group-class"
  - targetId: 团课 ID
- 通知创建失败不阻塞主流程（try-catch + error 日志）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_TITLE | title 为空或超过 50 字符 |
| 400 | COACHING_INVALID_VENUE | venueId 格式不合法 |
| 400 | COACHING_INVALID_TIME | 开始时间不晚于当前时间，或结束时间不晚于开始时间 |
| 400 | COACHING_INVALID_PARTICIPANTS | maxParticipants 不在 2-30 范围内 |
| 400 | COACHING_INVALID_FEE_DESCRIPTION | feeDescription 超过 200 字符 |
| 400 | COACHING_PARTICIPANTS_EXCEED | maxParticipants 小于当前报名人数 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该团课的教练尝试修改 |
| 404 | COACHING_GROUP_CLASS_NOT_FOUND | 团课不存在 |
| 404 | COACHING_VENUE_NOT_FOUND | 球馆不存在（修改 venueId 时） |
| 409 | COACHING_CLASS_NOT_MODIFIABLE | 团课状态不允许修改（in_progress / completed / cancelled） |

---

### 取消团课

`POST /api/group-classes/:id/cancel`

**描述**: 教练取消团课

**认证**: 需要

**Consumers**: web-app（我的课程管理页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 团课 ID |

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
- 仅教练本人可取消自己的团课（校验 groupClass.coachId === 当前用户 ID）
- 团课状态必须为 open 或 full 才能取消（即课程尚未开始）
- 已开始（in_progress）或已结束（completed）的团课不可取消
- 已取消的团课不可重复取消（幂等：返回当前状态，不报错）
- 取消后课程状态变为 cancelled，不可恢复
- 取消成功后，通过 NotificationService.createBatch() 通知所有已报名学员：
  - type: GROUP_CLASS_CANCELLED
  - title: "团课已取消"
  - content: "教练取消了团课「{课程名称}」"
  - targetType: "group-class"
  - targetId: 团课 ID
- 通知创建失败不阻塞主流程

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该团课的教练尝试取消 |
| 404 | COACHING_GROUP_CLASS_NOT_FOUND | 团课不存在 |
| 409 | COACHING_CLASS_NOT_CANCELLABLE | 团课状态不允许取消（in_progress / completed） |

---

### 报名团课

`POST /api/group-classes/:id/enroll`

**描述**: 学员报名指定团课

**认证**: 需要

**Consumers**: web-app（团课详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 团课 ID |

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "groupClassId": "uuid",
    "userId": "uuid",
    "currentParticipants": 6,
    "status": "open",
    "enrolledAt": "2026-04-03T09:00:00.000Z"
  }
}
```

**业务规则**:
- 团课状态必须为 open 才能报名
- 团课状态为 full/in_progress/completed/cancelled 时不可报名
- 教练不可报名自己发布的团课
- 学员不能重复报名同一团课
- 报名后检查参与人数：若 currentParticipants == maxParticipants，自动将状态更新为 full
- 报名成功后，通过 NotificationService.create() 通知教练：
  - type: GROUP_CLASS_ENROLLED
  - title: "新学员报名"
  - content: "{学员昵称} 报名了你的团课「{课程名称}」"
  - targetType: "group-class"
  - targetId: 团课 ID
- 通知创建失败不阻塞主流程

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_CANNOT_ENROLL_OWN_CLASS | 教练尝试报名自己的团课 |
| 404 | COACHING_GROUP_CLASS_NOT_FOUND | 团课不存在 |
| 409 | COACHING_CLASS_FULL | 团课已满员（状态为 full） |
| 409 | COACHING_ALREADY_ENROLLED | 学员已报名该团课 |
| 409 | COACHING_CLASS_NOT_ENROLLABLE | 团课状态不允许报名（in_progress / completed / cancelled） |

---

### 取消团课报名

`POST /api/group-classes/:id/cancel-enrollment`

**描述**: 学员取消团课报名

**认证**: 需要

**Consumers**: web-app（团课详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 团课 ID |

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "groupClassId": "uuid",
    "userId": "uuid",
    "currentParticipants": 5,
    "status": "open"
  }
}
```

**业务规则**:
- 团课状态必须为 open 或 full 才能取消报名（即课程尚未开始）
- 已开始（in_progress）或已结束（completed）的团课不可取消报名
- 已取消的团课不可取消报名
- 学员必须已报名该团课
- 取消后检查参与人数：若当前状态为 full 且取消后人数 < maxParticipants，自动将状态恢复为 open
- 取消成功后，通过 NotificationService.create() 通知教练：
  - type: GROUP_CLASS_ENROLLMENT_CANCELLED
  - title: "学员取消报名"
  - content: "{学员昵称} 取消了团课「{课程名称}」的报名"
  - targetType: "group-class"
  - targetId: 团课 ID
- 通知创建失败不阻塞主流程

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 404 | COACHING_GROUP_CLASS_NOT_FOUND | 团课不存在 |
| 409 | COACHING_NOT_ENROLLED | 学员未报名该团课 |
| 409 | COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT | 团课状态不允许取消报名（in_progress / completed / cancelled） |

---

### 设置私教空闲时间

`POST /api/private-lessons/availability`

**描述**: 教练设置一个或多个私教空闲时间段

**认证**: 需要

**Consumers**: web-app（我的课程管理页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| slots | object[] | 是 | 空闲时间段列表 |
| slots[].startTime | string (ISO 8601) | 是 | 时间段开始时间 |
| slots[].endTime | string (ISO 8601) | 是 | 时间段结束时间 |
| slots[].venueIds | string[] | 否 | 可选球馆 ID 列表（空数组或不传表示不限地点） |
| slots[].feeDescription | string | 否 | 费用说明（最长 200 字符） |

**Response 201**:
```json
{
  "data": {
    "slots": [
      {
        "id": "uuid",
        "coachId": "uuid",
        "startTime": "2026-04-11T10:00:00.000Z",
        "endTime": "2026-04-11T12:00:00.000Z",
        "venueIds": ["uuid1", "uuid2"],
        "feeDescription": "300元/小时",
        "isBooked": false,
        "createdAt": "2026-04-02T10:00:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 当前用户必须是教练角色（isCoach = true）
- slots 不能为空数组
- 每个时间段：
  - startTime 必须晚于当前时间
  - endTime 必须晚于 startTime
  - 时间段时长最小为 1 小时（endTime - startTime >= 60 分钟）
  - 同一教练的时间段不可重叠（与该教练已存在的 PrivateLessonSlot 时间范围不冲突）
  - 同一批次提交的时间段之间也不可重叠
- venueIds 中的每个 ID 通过 VenueService.getVenueById() 验证存在
- feeDescription 选填，最长 200 字符
- 批量创建时，如果某个时间段校验失败，整批拒绝（原子操作），返回第一个失败的错误

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_SLOTS | slots 为空数组或非数组 |
| 400 | COACHING_INVALID_SLOT_TIME | 时间段开始时间不晚于当前时间，或结束时间不晚于开始时间 |
| 400 | COACHING_SLOT_TOO_SHORT | 时间段时长不足 1 小时 |
| 400 | COACHING_INVALID_FEE_DESCRIPTION | feeDescription 超过 200 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_COACH_ROLE_REQUIRED | 当前用户不是教练角色，无权执行此操作 |
| 404 | COACHING_VENUE_NOT_FOUND | venueIds 中有球馆不存在 |
| 409 | COACHING_SLOT_OVERLAP | 时间段与已有时间段重叠 |

---

### 获取教练空闲时间

`GET /api/coaches/:id/availability`

**描述**: 获取指定教练的可预约空闲时间段

**认证**: 需要

**Consumers**: web-app（教练主页 -- 私教预约区域）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 教练的用户 ID |

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| startDate | string (ISO 8601) | 否 | 查询起始日期（默认今天） |
| endDate | string (ISO 8601) | 否 | 查询结束日期（默认起始日期 + 14 天） |

**Response 200**:
```json
{
  "data": {
    "slots": [
      {
        "id": "uuid",
        "startTime": "2026-04-11T10:00:00.000Z",
        "endTime": "2026-04-11T12:00:00.000Z",
        "venues": [
          {
            "id": "uuid",
            "name": "朝阳体育中心羽毛球馆",
            "address": "北京市朝阳区..."
          }
        ],
        "feeDescription": "300元/小时",
        "isBooked": false
      }
    ]
  }
}
```

**业务规则**:
- 指定用户必须是教练角色（isCoach = true）
- 仅返回指定日期范围内的时间段
- 仅返回 startTime > 当前时间 的时间段（过期的不返回）
- 返回所有时间段，包括已预约的（isBooked = true），前端根据 isBooked 控制 UI 状态
- 按 startTime 升序排列
- venues 信息通过 VenueService 批量获取

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 404 | COACHING_NOT_A_COACH | 用户不存在或不是教练角色 |

---

### 预约私教课

`POST /api/private-lessons/book`

**描述**: 学员预约教练的私教课

**认证**: 需要

**Consumers**: web-app（教练主页 -- 私教预约区域）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| slotId | string (uuid) | 是 | 空闲时间段 ID |
| venueId | string (uuid) | 否 | 上课球馆 ID（当时间段设置了可选球馆时必填，从可选球馆中选择一个） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "slotId": "uuid",
    "coachId": "uuid",
    "studentId": "uuid",
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心羽毛球馆",
      "address": "北京市朝阳区..."
    },
    "startTime": "2026-04-11T10:00:00.000Z",
    "endTime": "2026-04-11T12:00:00.000Z",
    "status": "scheduled",
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**业务规则**:
- 时间段必须存在且未被预约（isBooked = false）
- 时间段的 startTime 必须晚于当前时间（不能预约已过期的时间段）
- 学员不能预约自己的私教课（如果该学员同时也是教练）
- 若时间段设置了 venueIds（非空数组），学员必须提供 venueId 且该 venueId 必须在 venueIds 列表中
- 若时间段未设置 venueIds（空数组，不限地点），venueId 为可选；如提供则通过 VenueService.getVenueById() 验证存在
- 预约成功后：
  - 在同一事务中：标记 PrivateLessonSlot.isBooked = true，创建 PrivateLesson 记录
  - PrivateLesson 的 startTime、endTime 从 PrivateLessonSlot 冗余复制
  - PrivateLesson 的 coachId 从 PrivateLessonSlot 获取
  - PrivateLesson 的 status 初始为 scheduled
- 事务外：通过 NotificationService.create() 通知教练：
  - type: PRIVATE_LESSON_BOOKED
  - title: "新私教预约"
  - content: "{学员昵称} 预约了你的私教课（{日期MM/DD} {时间段HH:mm-HH:mm}）"
  - targetType: "private-lesson"
  - targetId: 私教课 ID
- 事务外：通过 NotificationService.create() 通知学员（预约确认）：
  - 类型和内容可省略（学员本人发起的操作，接口返回即为确认；按照 architecture.md 路径 3 的描述，需要通知学员预约成功确认）
  - 这里选择：不发通知给学员本人（学员通过接口响应已得到确认），仅通知教练。因为 PRD 的通知事件表中未列出"学员预约成功通知学员"的事件，而 architecture.md 路径 3 中提到"通知教练和学员"为概要描述，以 PRD 的通知事件列表为准
- 通知创建失败不阻塞主流程

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_SLOT | slotId 缺失或格式不合法 |
| 400 | COACHING_VENUE_REQUIRED | 时间段设置了可选球馆，但学员未提供 venueId |
| 400 | COACHING_INVALID_VENUE_CHOICE | 学员提供的 venueId 不在时间段的可选球馆列表中 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_CANNOT_BOOK_OWN_LESSON | 教练尝试预约自己的私教课 |
| 404 | COACHING_SLOT_NOT_FOUND | 时间段不存在 |
| 404 | COACHING_VENUE_NOT_FOUND | 球馆不存在（学员选择的球馆） |
| 409 | COACHING_SLOT_ALREADY_BOOKED | 时间段已被预约 |
| 409 | COACHING_SLOT_EXPIRED | 时间段已过期（startTime <= 当前时间） |

---

### 取消私教预约

`POST /api/private-lessons/:id/cancel`

**描述**: 学员或教练取消私教预约

**认证**: 需要

**Consumers**: web-app（我的课程管理页 / 教练主页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 私教课 ID |

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
- 只有该私教课的学员或教练可以取消
- 私教课状态必须为 scheduled 才能取消（即课程尚未开始）
- 已开始（in_progress）或已结束（completed）的私教课不可取消
- 已取消的私教课不可重复取消（幂等：返回当前状态，不报错）
- 取消成功后：
  - 在同一事务中：更新 PrivateLesson.status 为 cancelled，释放时间段（PrivateLessonSlot.isBooked = false）
- 事务外发送通知：
  - 若学员取消：通过 NotificationService.create() 通知教练
    - type: PRIVATE_LESSON_CANCELLED_BY_STUDENT
    - title: "学员取消私教"
    - content: "{学员昵称} 取消了私教课预约（{日期MM/DD} {时间段HH:mm-HH:mm}）"
    - targetType: "private-lesson"
    - targetId: 私教课 ID
  - 若教练取消：通过 NotificationService.create() 通知学员
    - type: PRIVATE_LESSON_CANCELLED_BY_COACH
    - title: "教练取消私教"
    - content: "教练取消了你的私教课预约（{日期MM/DD} {时间段HH:mm-HH:mm}）"
    - targetType: "coach-profile"
    - targetId: 教练用户 ID
- 通知创建失败不阻塞主流程
- 一期不设取消时间限制，课程开始前均可取消

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_LESSON_PARTICIPANT | 当前用户既不是该私教课的学员也不是教练 |
| 404 | COACHING_PRIVATE_LESSON_NOT_FOUND | 私教课不存在 |
| 409 | COACHING_LESSON_NOT_CANCELLABLE | 私教课状态不允许取消（in_progress / completed） |

---

### 用户的课程报名列表

`GET /api/users/:id/enrollments`

**描述**: 获取指定用户的课程报名列表（包含团课报名和私教预约）

**认证**: 需要

**Consumers**: web-app（个人主页 -- 我的课程）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 用户 ID |

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页条数（默认 20，最大 100） |
| type | string | 否 | 类型筛选：group-class / private-lesson；不传则返回全部 |
| status | string | 否 | 状态筛选：open / full / scheduled / in_progress / completed / cancelled；不传则返回全部 |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "type": "group-class",
        "groupClass": {
          "id": "uuid",
          "title": "初级单打提升班",
          "coachId": "uuid",
          "coachNickname": "教练张",
          "venue": {
            "id": "uuid",
            "name": "朝阳体育中心羽毛球馆"
          },
          "startTime": "2026-04-10T14:00:00.000Z",
          "endTime": "2026-04-10T16:00:00.000Z",
          "status": "open",
          "enrolledAt": "2026-04-03T09:00:00.000Z"
        },
        "privateLesson": null
      },
      {
        "type": "private-lesson",
        "groupClass": null,
        "privateLesson": {
          "id": "uuid",
          "coachId": "uuid",
          "coachNickname": "教练李",
          "venue": {
            "id": "uuid",
            "name": "海淀体育馆"
          },
          "startTime": "2026-04-11T10:00:00.000Z",
          "endTime": "2026-04-11T12:00:00.000Z",
          "status": "scheduled",
          "createdAt": "2026-04-03T10:00:00.000Z"
        }
      }
    ],
    "total": 8,
    "page": 1,
    "pageSize": 20
  }
}
```

**业务规则**:
- 当 userId 对应的用户不存在时，返回空列表（不暴露用户是否存在）
- 任何已登录用户均可查看其他用户的课程报名列表（公开信息）
- 合并团课报名（GroupClassEnrollment）和私教预约（PrivateLesson）两种类型
- type 筛选：仅返回指定类型的记录
- status 筛选：
  - 团课报名的状态取关联团课的 status
  - 私教预约取 PrivateLesson 的 status
- 按各自的开始时间倒序排列（最近的排前面）
- 教练昵称通过 UserService.getUsersByIds() 批量获取

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 教练的私教预约列表

`GET /api/coaches/:id/private-lessons`

**描述**: 获取教练的私教预约列表（教练视角），返回 coachId = :id 的已预约私教课记录

**认证**: 需要

**Consumers**: web-app（教练课程管理页 -- 私教预约管理 Tab）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 教练用户 ID |

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 状态筛选：scheduled / in_progress / completed / cancelled；不传则返回全部 |
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页条数（默认 20，最大 100） |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "slot": {
          "startTime": "2026-04-11T10:00:00.000Z",
          "endTime": "2026-04-11T12:00:00.000Z"
        },
        "venue": {
          "id": "uuid",
          "name": "朝阳体育中心羽毛球馆",
          "address": "北京市朝阳区..."
        },
        "student": {
          "id": "uuid",
          "nickname": "羽球达人",
          "avatarUrl": "https://example.com/avatar.jpg"
        },
        "status": "scheduled",
        "createdAt": "2026-04-03T10:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

**业务规则**:
- 指定用户必须是教练角色（isCoach = true），否则返回 COACHING_NOT_A_COACH
- 只返回 coachId = :id 的 PrivateLesson 记录（已预约的私教课）
- 按 slot.startTime 降序排列（最近的排前面）
- status 筛选：仅返回匹配状态的记录
- student 信息通过 UserService.getUsersByIds() 批量获取
- venue 为 null 时（球馆被管理员移除或未选择球馆），venue 字段返回 null
- slot 的 startTime 和 endTime 从 PrivateLesson 的冗余字段获取

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_A_COACH | 用户不存在或不是教练角色 |

---

### 内部接口（跨模块 Service 调用）

> 非 HTTP 暴露的接口。用于其他模块的 Service 层直接调用本模块的 Service。

#### CoachingService.getGroupClassById(id)

**描述**: 根据团课 ID 获取团课信息（供其他模块校验团课存在性或获取团课信息）

**Consumers**: match-record, review

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 团课 ID (uuid) |

**返回值**:
```typescript
{
  id: string;
  coachId: string;
  title: string;
  venueId: string | null;
  startTime: Date;
  endTime: Date;
  status: string;
} | null
```

**业务规则**:
- 团课不存在时返回 null（由调用方决定如何处理）
- 返回字段包含 status，供调用方校验团课状态（如 match-record 校验团课是否已结束）

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 团课不存在时返回 null，不抛错 |

---

#### CoachingService.getPrivateLessonById(id)

**描述**: 根据私教课 ID 获取私教课信息（供其他模块校验私教课存在性或获取私教课信息）

**Consumers**: match-record, review

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 私教课 ID (uuid) |

**返回值**:
```typescript
{
  id: string;
  coachId: string;
  studentId: string;
  venueId: string | null;
  startTime: Date;
  endTime: Date;
  status: string;
} | null
```

**业务规则**:
- 私教课不存在时返回 null（由调用方决定如何处理）
- 返回字段包含 status，供调用方校验私教课状态

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 私教课不存在时返回 null，不抛错 |

---

#### CoachingService.getParticipantIds(classId, type)

**描述**: 获取课程的所有参与者用户 ID 列表（供 match-record、review 模块校验用户是否为课程参与者）

**Consumers**: match-record, review

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| classId | string | 是 | 课程 ID (uuid) |
| type | string | 是 | 课程类型：'group-class' 或 'private-lesson' |

**返回值**:
```typescript
string[]  // 用户 ID 列表
```

**业务规则**:
- 对于 group-class：返回所有报名学员的 userId 列表 + 教练的 coachId
- 对于 private-lesson：返回学员 studentId + 教练 coachId
- 课程不存在时返回空数组（由调用方决定如何处理）
- 返回顺序不保证

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 始终返回结果，不抛错 |

---

## 5. 消费的外部接口

| 接口 | 提供方 | 调用场景 |
|------|--------|---------|
| UserService.getUserById(id) | user | 教练主页获取教练用户信息；通知文案中获取用户昵称 |
| UserService.getUsersByIds(ids) | user | 教练列表批量获取用户信息；团课详情批量获取报名学员信息；课程报名列表获取教练昵称 |
| VenueService.getVenueById(id) | venue | 发布团课时验证球馆存在；修改团课时验证球馆存在；设置私教空闲时间时验证可选球馆存在；预约私教时验证学员选择的球馆存在 |
| NotificationService.create(notification) | notification | 学员报名团课时通知教练；学员取消报名时通知教练；学员预约私教时通知教练；学员取消私教时通知教练；教练取消私教时通知学员 |
| NotificationService.createBatch(notifications) | notification | 教练修改团课时通知所有报名学员；教练取消团课时通知所有报名学员；私教课结束时通知学员（定时任务触发） |

---

## 6. 关键业务逻辑

### 6.1 团课状态机

```
                         发布
                          |
                          v
                  +---- open <---+
                  |       |      |
           满员   |       |      | 有人取消报名（从 full）
                  |       |      |
                  v       |      |
                full -----+------+
                  |
                  |  教练取消（open 或 full）
                  +-----------------------------> cancelled
                  |
    startTime 到达|                              （终态，不可恢复）
                  |
                  v
            in_progress
                  |
    endTime 到达  |
                  |
                  v
             completed

状态流转触发条件:
- open -> full:      报名后 currentParticipants == maxParticipants
- full -> open:      取消报名后 currentParticipants < maxParticipants;
                     修改 maxParticipants 后 currentParticipants < maxParticipants
- open -> in_progress:  定时任务检测 startTime <= 当前时间
- full -> in_progress:  定时任务检测 startTime <= 当前时间
- in_progress -> completed: 定时任务检测 endTime <= 当前时间
- open/full -> cancelled:   教练主动取消
```

### 6.2 私教课状态机

```
                       预约
                        |
                        v
                    scheduled
                        |
                        |  学员取消 / 教练取消（scheduled）
                        +----------------------------> cancelled
                        |
      startTime 到达    |                              （终态，不可恢复）
                        |
                        v
                   in_progress
                        |
      endTime 到达      |
                        |
                        v
                    completed

状态流转触发条件:
- scheduled -> in_progress:  定时任务检测 startTime <= 当前时间
- in_progress -> completed:  定时任务检测 endTime <= 当前时间
- scheduled -> cancelled:    学员或教练主动取消
```

### 6.3 定时任务 -- 课程状态自动流转

```
触发: 每分钟一次（通过 infra/scheduler 注册 cron 任务）

逻辑:
1. 团课状态流转:
   a. 查询状态为 open 或 full 且 startTime <= 当前时间 的团课
   b. 批量更新状态为 in_progress
   c. 查询状态为 in_progress 且 endTime <= 当前时间 的团课
   d. 批量更新状态为 completed

2. 私教课状态流转:
   a. 查询状态为 scheduled 且 startTime <= 当前时间 的私教课
   b. 批量更新状态为 in_progress
   c. 查询状态为 in_progress 且 endTime <= 当前时间 的私教课
   d. 批量更新状态为 completed
   e. 对于新完成的私教课，通过 NotificationService.create() 通知学员
      - type: PRIVATE_LESSON_CANCELLED_BY_COACH（复用不恰当，应定义新的通知类型）
      - 实际上此通知场景为"课程已结束，可评价和录入战绩"，但 PRD 通知事件表中未列出此事件，且 notification 模块的通知类型枚举中也未定义此类型
      - **决定**: 不在定时任务中发送"课程结束"通知。architecture.md 路径 3 提到的"通知学员（课程已结束，可评价和录入战绩）"为概要描述，PRD 通知事件表（FF-1）中未列出此事件，以 PRD 为准

3. 记录 info 日志：本次状态变更的团课数量和私教课数量

注意:
- 批量更新使用 Prisma updateMany，不逐条更新
- 定时任务异常通过 try-catch 捕获，记录 error 日志，不影响服务稳定性
- 日志使用 module: "coaching-status" 标记
```

### 6.4 报名团课与满员状态联动

```
1. 校验团课状态为 open
2. 校验学员未重复报名（查询 GroupClassEnrollment 是否存在记录）
3. 校验学员不是该团课的教练
4. 在同一事务中:
   a. 创建 GroupClassEnrollment 记录
   b. 计算当前报名人数
   c. 若 currentParticipants == maxParticipants -> 更新 groupClass.status 为 full
5. 事务外: 发送通知（try-catch）
```

### 6.5 取消报名与满员状态联动

```
1. 校验学员已报名该团课
2. 校验团课状态为 open 或 full
3. 在同一事务中:
   a. 删除 GroupClassEnrollment 记录
   b. 若当前 groupClass.status 为 full -> 计算报名人数，若 < maxParticipants -> 更新为 open
4. 事务外: 发送通知（try-catch）
```

### 6.6 私教预约与时间段锁定

```
1. 校验时间段存在且 isBooked = false
2. 校验时间段 startTime > 当前时间
3. 校验学员不是该时间段的教练
4. 校验球馆选择合法性（见预约接口业务规则）
5. 在同一事务中:
   a. 更新 PrivateLessonSlot.isBooked = true
   b. 创建 PrivateLesson 记录
6. 事务外: 发送通知（try-catch）
```

### 6.7 取消私教预约与时间段释放

```
1. 校验私教课存在且状态为 scheduled
2. 校验当前用户是该私教课的学员或教练
3. 在同一事务中:
   a. 更新 PrivateLesson.status 为 cancelled
   b. 更新 PrivateLessonSlot.isBooked = false（释放时间段）
4. 事务外: 根据取消方发送对应通知（try-catch）
```

### 6.8 历史学员数计算

```
历史学员数 = 该教练所有团课和私教课的不重复参与人数

计算方式:
1. 查询 GroupClassEnrollment 中 groupClass.coachId === 教练 ID 的所有 userId
2. 查询 PrivateLesson 中 coachId === 教练 ID 且 status !== 'cancelled' 的所有 studentId
3. 合并两个集合，去重后计数

注意: 实时计算，不存储冗余字段。一期数据量小，性能无压力。
```

### 6.9 教练资料自动创建

```
用户首次调用 PUT /api/coaches/me 时:
1. 查询 CoachProfile（by userId）
2. 若不存在 -> 创建 CoachProfile 记录（bio = null, specialties = []）
3. 更新请求中提供的字段
4. 返回更新后的教练资料

注意: CoachProfile 在用户开启教练角色时不自动创建，而是在首次编辑教练资料时惰性创建。
这样避免了 user 模块在开启教练角色时需要调用 coaching 模块（违反依赖方向规则）。
```

### 6.10 通知文案生成

coaching 模块负责按 PRD 定义的模板生成通知文案，通过 NotificationService 创建通知。

| 事件 | type | title | content 模板 | 通知对象 |
|------|------|-------|-------------|---------|
| 学员报名团课 | GROUP_CLASS_ENROLLED | 新学员报名 | {学员昵称} 报名了你的团课「{课程名称}」 | 教练 |
| 学员取消报名 | GROUP_CLASS_ENROLLMENT_CANCELLED | 学员取消报名 | {学员昵称} 取消了团课「{课程名称}」的报名 | 教练 |
| 教练修改团课 | GROUP_CLASS_UPDATED | 团课已更新 | 你报名的团课「{课程名称}」信息已更新 | 所有报名学员 |
| 教练取消团课 | GROUP_CLASS_CANCELLED | 团课已取消 | 教练取消了团课「{课程名称}」 | 所有报名学员 |
| 学员预约私教 | PRIVATE_LESSON_BOOKED | 新私教预约 | {学员昵称} 预约了你的私教课（{日期MM/DD} {时间段HH:mm-HH:mm}） | 教练 |
| 学员取消私教 | PRIVATE_LESSON_CANCELLED_BY_STUDENT | 学员取消私教 | {学员昵称} 取消了私教课预约（{日期MM/DD} {时间段HH:mm-HH:mm}） | 教练 |
| 教练取消私教 | PRIVATE_LESSON_CANCELLED_BY_COACH | 教练取消私教 | 教练取消了你的私教课预约（{日期MM/DD} {时间段HH:mm-HH:mm}） | 学员 |

> 学员昵称从 UserService.getUserById() 获取。
> 课程名称从 GroupClass.title 获取。
> 日期格式为 MM/DD（如 04/11），时间段格式为 HH:mm-HH:mm（如 10:00-12:00）。

---

## 7. 模块特有约定

### 安全要求
- 团课修改和取消操作必须校验 coachId === 当前用户 ID，非教练本人不可操作
- 私教预约取消操作必须校验当前用户是学员或教练之一
- 发布课程和设置空闲时间必须校验用户具有教练角色（isCoach = true）
- 教练列表、教练主页、团课详情为公开数据，任何已登录用户均可查看

### 性能约束
- 教练列表接口为用户端常用接口，需确保响应在 500ms 内：
  - CoachProfile 在 userId 上有 UNIQUE 索引
  - specialties 筛选使用 PostgreSQL 数组操作符（@>）
  - 分页控制返回数据量
  - studentCount 计算可使用子查询或在 Repository 层优化
- 定时任务（每分钟）使用批量更新，不逐条处理
- 团课详情中的 enrollments 信息通过 Prisma relation 或 JOIN 获取，不逐条调用 UserService

### 并发控制
- 报名团课的满员判断需注意并发：使用数据库事务 + 唯一约束（groupClassId, userId）防止重复报名；满员状态更新在事务内基于实际 COUNT 判断
- 预约私教的时间段锁定需注意并发：使用数据库事务 + PrivateLessonSlot.isBooked 乐观检查 + PrivateLesson.slotId UNIQUE 约束防止重复预约
- 定时任务使用 WHERE 条件（status + 时间条件）进行批量更新，天然幂等

### 错误处理
- HTTP 接口的错误通过抛出带 error code 的异常，由 infra/error-handler.ts 统一处理
- 通知发送失败不阻塞主流程（try-catch + error 日志）
- 定时任务中的异常通过 try-catch 捕获，记录 error 日志，不影响服务稳定性

### 日志策略
- 团课发布：info 级别记录 coachId（前 8 位）、title、venueId、startTime
- 报名/取消报名：info 级别记录 groupClassId、userId（前 8 位）、操作类型
- 私教时间设置：info 级别记录 coachId（前 8 位）、时间段数量
- 私教预约/取消：info 级别记录 privateLessonId、studentId（前 8 位）、coachId（前 8 位）、操作类型
- 修改/取消团课：info 级别记录 groupClassId、操作人 coachId（前 8 位）
- 定时任务：info 级别记录状态变更的团课数量和私教课数量；debug 级别记录具体 ID
- 定时任务日志使用 `module: "coaching-status"` 标记

---

## 8. 已知限制和 TODO

- 一期不支持教练删除空闲时间段（已设置的未预约时间段无删除接口，过期后自然失效）
- 一期不限制取消时间（教练和学员在课程开始前均可取消），二期考虑添加取消截止时间
- 一期不支持团课候补机制（人满后排队等候）
- 一期教练评分由 review 模块实时计算，coaching 不存储冗余评分字段
- 一期教练列表默认按创建时间排序，前端可结合 review 评分做客户端排序；二期可考虑后端支持按评分排序
- 一期教练主页团课不做分页，仅返回未来及最近 30 天内结束的团课；二期可考虑团课分页
- 一期不支持教练设置私教课时选择"不限地点"的同时指定部分球馆（要么全部指定，要么不限）
- 一期 CoachProfile 惰性创建（首次编辑教练资料时），而非开启教练角色时自动创建
- 一期 privateLessonSlots.venueIds 存储为字符串数组，不建立物理外键；球馆被删除后，venueIds 中可能存在无效 ID，获取空闲时间时通过 VenueService 过滤无效球馆
- TODO: 二期可考虑教练删除/修改空闲时间段功能
- TODO: 二期可考虑取消截止时间限制
- TODO: 二期可考虑团课候补机制
- TODO: 二期可考虑后端直接支持按评分排序教练列表（需 review 模块提供批量评分查询接口）
- TODO: 二期可考虑"课程结束"通知（当前 PRD 通知事件表中未列出）
