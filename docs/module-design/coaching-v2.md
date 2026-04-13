# 模块详细设计: 学员班 + 固定私教学员 (Coaching v2)

> 本文档描述学员班（GB）和固定私教学员（GC）功能的详细设计和接口契约。
> 系统级架构和数据模型见 [docs/architecture-coaching-v2.md](../architecture-coaching-v2.md)。

## 1. 模块概述

- **职责**: 学员班（GB）— 学员班 CRUD、学员管理、课程管理、训练内容/笔记/标签；固定私教学员（GC）— 学员添加/移除、私教课程管理、训练内容/笔记/标签
- **类型**: 后端模块扩展（在 coaching 模块内扩展）
- **业务模块映射**: PRD 中的「教练管理（FC）」→ 学员班（GB）+ 固定私教学员（GC）
- **依赖层级**: 中间层（依赖 user、venue、notification）

---

## 2. 内部架构

### 分层结构

```
coaching/
├── controller.ts      # 请求处理、参数校验、响应格式化（扩展新路由）
├── service.ts         # 业务逻辑、规则执行、状态流转（扩展新方法）
├── repository.ts      # 数据访问、Prisma 查询封装（扩展新查询）
├── types.ts           # 模块内类型定义（扩展新类型和枚举）
└── index.ts           # 对外导出（扩展新公开接口）
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Controller | 接收请求、参数校验、调用 Service、格式化响应 | Service |
| Service | 业务逻辑（学员班 CRUD、学员管理、课程 CRUD、笔记/标签管理、固定私教学员管理）、通知发送编排 | Repository, UserService, VenueService, NotificationService, infra（logger、config） |
| Repository | 数据库操作、Prisma 查询封装 | Prisma Client（infra） |

### 控制流

```
HTTP 请求 → Controller（校验）→ Service（业务逻辑）→ Repository（数据访问）→ 响应
```

---

## 3. 数据模型

数据模型定义见 [docs/architecture-coaching-v2.md](../architecture-coaching-v2.md) 第 3 节，此处仅列出本模块涉及的表和关键字段。

### StudentClass

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| coachId | string (uuid) | NOT NULL, FK → User.id | 教练用户 ID |
| name | string | NOT NULL | 班级名称（2-30 字符） |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### StudentClassMember

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| studentClassId | string (uuid) | NOT NULL, FK → StudentClass.id, ON DELETE CASCADE | 所属学员班 |
| studentId | string (uuid) | NOT NULL, FK → User.id | 学员用户 ID |
| joinedAt | datetime | NOT NULL | 加入时间 |

**唯一约束**: `(studentClassId, studentId)`

### ClassLesson

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| studentClassId | string (uuid) | NOT NULL, FK → StudentClass.id, ON DELETE CASCADE | 所属学员班 |
| coachId | string (uuid) | NOT NULL, FK → User.id | 教练用户 ID |
| venueId | string (uuid) \| null | FK → Venue.id, ON DELETE SET NULL | 球馆 ID |
| startTime | datetime | NOT NULL | 开始时间 |
| endTime | datetime | NOT NULL | 结束时间 |
| trainingContent | string \| null | | 训练内容（最多 2000 字符） |
| status | string | NOT NULL, DEFAULT 'scheduled' | 课程状态 |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### PrivateStudent

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| coachId | string (uuid) | NOT NULL, FK → User.id | 教练用户 ID |
| studentId | string (uuid) | NOT NULL, FK → User.id | 学员用户 ID |
| isActive | boolean | NOT NULL, DEFAULT true | 是否活跃（false 为软删除） |
| joinedAt | datetime | NOT NULL | 加入时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

**唯一约束**: `(coachId, studentId)`

### PrivateLessonV2

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| privateStudentId | string (uuid) | NOT NULL, FK → PrivateStudent.id | 所属私教关系 |
| coachId | string (uuid) | NOT NULL, FK → User.id | 教练用户 ID |
| studentId | string (uuid) | NOT NULL, FK → User.id | 学员用户 ID |
| venueId | string (uuid) \| null | FK → Venue.id, ON DELETE SET NULL | 球馆 ID |
| startTime | datetime | NOT NULL | 开始时间 |
| endTime | datetime | NOT NULL | 结束时间 |
| trainingContent | string \| null | | 训练内容（最多 2000 字符） |
| status | string | NOT NULL, DEFAULT 'scheduled' | 课程状态 |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### LessonNote

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| classLessonId | string (uuid) \| null | FK → ClassLesson.id, ON DELETE CASCADE | 学员班课程 ID（与 privateLessonId 互斥） |
| privateLessonId | string (uuid) \| null | FK → PrivateLessonV2.id, ON DELETE CASCADE | 固定私教课程 ID（与 classLessonId 互斥） |
| coachId | string (uuid) | NOT NULL, FK → User.id | 教练用户 ID |
| content | string | NOT NULL | 笔记内容（1-500 字符） |
| createdAt | datetime | NOT NULL | 创建时间 |

### StudentNote

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| coachId | string (uuid) | NOT NULL, FK → User.id | 教练用户 ID |
| studentId | string (uuid) | NOT NULL, FK → User.id | 学员用户 ID |
| studentClassId | string (uuid) \| null | | 学员班 ID（与 privateStudentId 互斥） |
| privateStudentId | string (uuid) \| null | | 固定私教学员 ID（与 studentClassId 互斥） |
| content | string | NOT NULL | 笔记内容（1-500 字符） |
| createdAt | datetime | NOT NULL | 创建时间 |

### StudentTag

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| coachId | string (uuid) | NOT NULL, FK → User.id | 教练用户 ID |
| studentId | string (uuid) | NOT NULL, FK → User.id | 学员用户 ID |
| studentClassId | string (uuid) \| null | | 学员班 ID（与 privateStudentId 互斥） |
| privateStudentId | string (uuid) \| null | | 固定私教学员 ID（与 studentClassId 互斥） |
| tag | string | NOT NULL | 标签文本（最多 20 字符） |
| createdAt | datetime | NOT NULL | 创建时间 |

**唯一约束**: `(coachId, studentId, studentClassId, tag)` 和 `(coachId, studentId, privateStudentId, tag)`

### 课程状态枚举（ClassLesson.status / PrivateLessonV2.status）

| 枚举值 | 说明 | 可执行的操作 |
|--------|------|-------------|
| scheduled | 未开始 | 教练编辑、教练取消 |
| in_progress | 进行中 | 录入训练内容、笔记、战绩 |
| completed | 已结束 | 录入训练内容、笔记、战绩 |
| cancelled | 已取消 | 无 |

> 训练内容可在课程创建后任何非取消状态下修改（PRD：创建时即可填写，之后随时可修改）。课程笔记在任何非取消状态下均可新增。战绩仅在 in_progress 或 completed 状态下可录入。

### 模型关系

```
User 1 ← N StudentClass（教练可创建多个学员班，通过 coachId）
User N ← M StudentClass（多对多，通过 StudentClassMember 关联）
StudentClass 1 ← N StudentClassMember（ON DELETE CASCADE）
StudentClass 1 ← N ClassLesson（ON DELETE CASCADE）
ClassLesson 1 ← N LessonNote（ON DELETE CASCADE，通过 classLessonId）
User 1 ← N PrivateStudent（教练维度，通过 coachId）
User 1 ← N PrivateStudent（学员维度，通过 studentId）
PrivateStudent 1 ← N PrivateLessonV2（一对固定私教关系下可有多次课程）
PrivateLessonV2 1 ← N LessonNote（ON DELETE CASCADE，通过 privateLessonId）
```

### 与其他模块数据的关系

- ClassLesson.id 被 match-record 模块的 MatchRecord.sourceId（sourceType = 'class_lesson'）引用（多态关联，无物理外键）
- PrivateLessonV2.id 被 match-record 模块的 MatchRecord.sourceId（sourceType = 'private_lesson_v2'）引用（多态关联，无物理外键）

---

## 4. 接口契约

> 每个接口必须包含五要素：**输入、输出、业务规则、错误码、consumers**。
> 接口通用约定（认证方式、响应格式、分页、HTTP 状态码）见 architecture.md。

### 4.1 学员班（GB）

#### POST /api/student-classes

**描述**: 创建学员班

**认证**: 需要（教练）

**Consumers**: web-app（学员班列表页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 班级名称（2-30 字符） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "coachId": "uuid",
    "name": "周三进阶班",
    "memberCount": 0,
    "lessonCount": 0,
    "createdAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅审核通过的教练（isCoach = true）可创建（PRD GB-1）
- 教练可创建多个学员班，数量无上限（PRD GB 规则 2）
- 班级名称不可为空，长度 2-30 字符（PRD GB 规则 3）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_CLASS_NAME | 班级名称为空或长度不在 2-30 字符范围内 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_COACH_ROLE_REQUIRED | 当前用户不是教练角色 |

---

#### GET /api/student-classes

**描述**: 获取教练的学员班列表

**认证**: 需要（教练）

**Consumers**: web-app（学员班列表页）

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "coachId": "uuid",
        "name": "周三进阶班",
        "memberCount": 5,
        "lessonCount": 12,
        "createdAt": "2026-04-13T10:00:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 仅返回当前教练创建的学员班（coachId = 当前用户 ID）
- 按创建时间倒序排列
- memberCount 实时计算（StudentClassMember 记录数）
- lessonCount 实时计算（ClassLesson 非 cancelled 记录数）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_COACH_ROLE_REQUIRED | 当前用户不是教练角色 |

---

#### GET /api/student-classes/:id

**描述**: 获取学员班详情

**认证**: 需要（教练）

**Consumers**: web-app（学员班详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "coachId": "uuid",
    "name": "周三进阶班",
    "memberCount": 5,
    "lessonCount": 12,
    "members": [
      {
        "studentId": "uuid",
        "nickname": "学员小王",
        "avatarUrl": "https://...",
        "joinedAt": "2026-04-13T10:00:00.000Z"
      }
    ],
    "createdAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅学员班创建教练可查看详情（校验 studentClass.coachId === 当前用户 ID）
- members 按加入时间升序排列
- 学员信息通过 UserService.getUsersByIds() 批量获取

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |

---

#### PUT /api/student-classes/:id

**描述**: 编辑学员班名称

**认证**: 需要（教练）

**Consumers**: web-app（学员班详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 新班级名称（2-30 字符） |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "coachId": "uuid",
    "name": "周五高级班",
    "updatedAt": "2026-04-14T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅学员班创建教练可编辑（校验 studentClass.coachId === 当前用户 ID）（PRD GB-2）
- 名称长度 2-30 字符（PRD GB 规则 3）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_CLASS_NAME | 班级名称为空或长度不在 2-30 字符范围内 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |

---

#### DELETE /api/student-classes/:id

**描述**: 删除学员班

**认证**: 需要（教练）

**Consumers**: web-app（学员班详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "success": true
  }
}
```

**业务规则**:
- 仅学员班创建教练可删除（校验 studentClass.coachId === 当前用户 ID）（PRD GB-3）
- 删除学员班时级联删除：StudentClassMember、ClassLesson、LessonNote（通过 ClassLesson 级联）、StudentNote（studentClassId 匹配）、StudentTag（studentClassId 匹配）均被删除（PRD GB 规则 30）
- **已录入的战绩（MatchRecord，sourceType='class_lesson'）不删除**——战绩为独立数据，通过多态关联引用课程 ID，无物理外键，不受级联影响（PRD GB 规则 30）
- 前端需做二次确认弹窗后再调用此接口

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |

---

#### POST /api/student-classes/:id/members

**描述**: 添加学员到学员班

**认证**: 需要（教练）

**Consumers**: web-app（学员班详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | 是 | 学员用户 ID |

**Response 201**:
```json
{
  "data": {
    "studentClassId": "uuid",
    "studentId": "uuid",
    "nickname": "学员小王",
    "joinedAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅学员班的创建教练可添加学员（PRD GB-4）
- 调用 UserService.getUserById() 校验学员存在（PRD GB 规则 6）
- 同一用户不可重复添加到同一学员班（PRD GB 规则 7）
- 添加成功后通过 NotificationService.create() 通知学员：「教练 {教练昵称} 将你加入了学员班「{班级名称}」」（PRD GB 规则 8）
- 通知创建失败不阻塞主流程（try-catch + error 日志）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | USER_NOT_FOUND | 学员用户不存在 |
| 409 | COACHING_STUDENT_ALREADY_IN_CLASS | 学员已在班级中 |

---

#### GET /api/student-classes/:id/members

**描述**: 获取学员班学员列表

**认证**: 需要（教练）

**Consumers**: web-app（学员班详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "studentId": "uuid",
        "nickname": "学员小王",
        "avatarUrl": "https://...",
        "joinedAt": "2026-04-13T10:00:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 仅学员班创建教练可查看学员列表
- 学员信息通过 UserService.getUsersByIds() 批量获取
- 按加入时间升序排列

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |

---

#### DELETE /api/student-classes/:id/members/:studentId

**描述**: 从学员班移除学员

**认证**: 需要（教练）

**Consumers**: web-app（学员班详情页 / 学员档案页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| studentId | string (uuid) | 学员用户 ID |

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "success": true
  }
}
```

**业务规则**:
- 仅学员班创建教练可移除学员（PRD GB-5）
- 移除后通过 NotificationService.create() 通知学员：「你已被移出学员班「{班级名称}」」（PRD GB 规则 9）
- 通知创建失败不阻塞主流程

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_STUDENT_NOT_IN_CLASS | 学员不在该班级中 |

---

#### POST /api/student-classes/:id/lessons

**描述**: 创建学员班课程

**认证**: 需要（教练）

**Consumers**: web-app（学员班详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| startTime | string (ISO 8601) | 是 | 开始时间 |
| endTime | string (ISO 8601) | 是 | 结束时间 |
| venueId | string (uuid) | 是 | 球馆 ID |
| trainingContent | string | 否 | 训练内容（最多 2000 字符） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "studentClassId": "uuid",
    "coachId": "uuid",
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心",
      "address": "..."
    },
    "startTime": "2026-04-15T14:00:00.000Z",
    "endTime": "2026-04-15T16:00:00.000Z",
    "trainingContent": "步法训练 + 高远球",
    "status": "scheduled",
    "createdAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅学员班的创建教练可创建课程（PRD GB-6）
- startTime 必须晚于当前时间，endTime 必须晚于 startTime（PRD GB 规则 11）
- 调用 VenueService.getVenueById() 验证球馆存在（PRD GB 规则 12）
- trainingContent 选填，最多 2000 字符（PRD GB 规则 19）
- 课程初始状态为 scheduled
- 创建成功后，通过 NotificationService.createBatch() 通知学员班内所有学员（PRD GB 规则 13）
- 通知创建失败不阻塞主流程

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_TIME | 开始时间不晚于当前时间，或结束时间不晚于开始时间 |
| 400 | COACHING_INVALID_TRAINING_CONTENT | 训练内容超过 2000 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_VENUE_NOT_FOUND | 球馆不存在 |

---

#### GET /api/student-classes/:id/lessons

**描述**: 获取学员班课程列表

**认证**: 需要（教练）

**Consumers**: web-app（学员班详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 状态筛选：scheduled / in_progress / completed / cancelled；不传则返回全部 |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "venue": {
          "id": "uuid",
          "name": "朝阳体育中心",
          "address": "..."
        },
        "startTime": "2026-04-15T14:00:00.000Z",
        "endTime": "2026-04-15T16:00:00.000Z",
        "trainingContent": "步法训练 + 高远球",
        "status": "scheduled",
        "createdAt": "2026-04-13T10:00:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 仅学员班创建教练可查看课程列表
- 按 startTime 降序排列（最近的排前面）
- 支持按 status 筛选

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |

---

#### GET /api/student-classes/:id/lessons/:lessonId

**描述**: 获取学员班课程详情

**认证**: 需要（教练）

**Consumers**: web-app（学员班课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| lessonId | string (uuid) | 课程 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "studentClassId": "uuid",
    "coachId": "uuid",
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心",
      "address": "..."
    },
    "startTime": "2026-04-15T14:00:00.000Z",
    "endTime": "2026-04-15T16:00:00.000Z",
    "trainingContent": "步法训练 + 高远球",
    "status": "completed",
    "createdAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅学员班创建教练可查看课程详情
- 课程必须属于指定的学员班（校验 classLesson.studentClassId === id）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_CLASS_LESSON_NOT_FOUND | 课程不存在或不属于该学员班 |

---

#### PUT /api/student-classes/:id/lessons/:lessonId

**描述**: 编辑学员班课程

**认证**: 需要（教练）

**Consumers**: web-app（学员班课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| lessonId | string (uuid) | 课程 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| startTime | string (ISO 8601) | 否 | 开始时间 |
| endTime | string (ISO 8601) | 否 | 结束时间 |
| venueId | string (uuid) | 否 | 球馆 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "studentClassId": "uuid",
    "coachId": "uuid",
    "venue": {
      "id": "uuid",
      "name": "海淀体育馆",
      "address": "..."
    },
    "startTime": "2026-04-16T14:00:00.000Z",
    "endTime": "2026-04-16T16:00:00.000Z",
    "trainingContent": "步法训练 + 高远球",
    "status": "scheduled",
    "updatedAt": "2026-04-14T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅学员班创建教练可编辑课程（PRD GB-7）
- **只有 status = scheduled 的课程可以编辑**（PRD GB 规则 16, 18）
- 已开始（in_progress）、已结束（completed）或已取消（cancelled）的课程不可编辑
- 只更新请求体中包含的字段，未提供的字段保持不变
- 若修改 startTime，新的开始时间必须晚于当前时间
- 若修改 endTime 或 startTime，endTime 必须晚于 startTime（使用修改后的值比较）
- 若修改 venueId，调用 VenueService.getVenueById() 验证球馆存在
- 编辑成功后，通过 NotificationService.createBatch() 通知学员班内所有学员：「你的学员班「{班级名称}」课程信息已更新」（PRD GB 规则 16）
- 通知创建失败不阻塞主流程

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_TIME | 开始时间不晚于当前时间，或结束时间不晚于开始时间 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_CLASS_LESSON_NOT_FOUND | 课程不存在或不属于该学员班 |
| 404 | COACHING_VENUE_NOT_FOUND | 球馆不存在（修改 venueId 时） |
| 409 | COACHING_LESSON_NOT_EDITABLE | 课程状态不为 scheduled，不可编辑 |

---

#### POST /api/student-classes/:id/lessons/:lessonId/cancel

**描述**: 取消学员班课程

**认证**: 需要（教练）

**Consumers**: web-app（学员班课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| lessonId | string (uuid) | 课程 ID |

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
- 仅学员班创建教练可取消课程（PRD GB-8）
- **只有 status = scheduled 的课程可以取消**（PRD GB 规则 17, 18）
- 已开始（in_progress）、已结束（completed）的课程不可取消
- 已取消的课程不可重复取消（幂等：返回当前状态，不报错）
- 取消后课程状态变为 cancelled，不可恢复
- 取消成功后，通过 NotificationService.createBatch() 通知学员班内所有学员：「学员班「{班级名称}」的课程已取消」（PRD GB 规则 17）
- 通知创建失败不阻塞主流程

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_CLASS_LESSON_NOT_FOUND | 课程不存在或不属于该学员班 |
| 409 | COACHING_LESSON_NOT_CANCELLABLE | 课程状态不为 scheduled，不可取消 |

---

#### PUT /api/student-classes/:id/lessons/:lessonId/training-content

**描述**: 更新课程训练内容

**认证**: 需要（教练）

**Consumers**: web-app（课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| lessonId | string (uuid) | 课程 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| trainingContent | string | 是 | 训练内容（最多 2000 字符） |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "trainingContent": "步法训练 + 高远球 + 网前搓球",
    "updatedAt": "2026-04-14T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅学员班创建教练可更新训练内容（PRD GB-9）
- 课程状态不为 cancelled 时均可修改训练内容（PRD GB 规则 19：创建时即可填写，之后随时可修改）
- 可传空字符串清空训练内容
- 训练内容最多 2000 字符

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_TRAINING_CONTENT | 训练内容超过 2000 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_CLASS_LESSON_NOT_FOUND | 课程不存在或不属于该学员班 |
| 409 | COACHING_LESSON_CANCELLED | 课程已取消，不可操作 |

---

#### POST /api/student-classes/:id/lessons/:lessonId/notes

**描述**: 添加课程笔记

**认证**: 需要（教练）

**Consumers**: web-app（课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| lessonId | string (uuid) | 课程 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 笔记内容（1-500 字符） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "classLessonId": "uuid",
    "coachId": "uuid",
    "content": "今天步法训练效果不错，下次加强网前",
    "createdAt": "2026-04-15T16:30:00.000Z"
  }
}
```

**业务规则**:
- 仅学员班创建教练可添加课程笔记（PRD GB-10）
- 课程状态不为 cancelled 时可添加笔记（PRD GB 规则 20）
- 追加模式，每次新增一条，不修改已有笔记（PRD GB 规则 20）
- 单条笔记不可为空，最多 500 字符（PRD GB 规则 21）
- 仅教练可见（PRD GB 规则 22, 29）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_NOTE_CONTENT | 笔记内容为空或超过 500 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_CLASS_LESSON_NOT_FOUND | 课程不存在或不属于该学员班 |
| 409 | COACHING_LESSON_CANCELLED | 课程已取消，不可操作 |

---

#### GET /api/student-classes/:id/lessons/:lessonId/notes

**描述**: 获取课程笔记列表

**认证**: 需要（教练）

**Consumers**: web-app（课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| lessonId | string (uuid) | 课程 ID |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "content": "今天步法训练效果不错，下次加强网前",
        "createdAt": "2026-04-15T16:30:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 仅教练可查看（笔记仅教练可见）（PRD GB 规则 22, 29）
- 按创建时间倒序展示（PRD GB 规则 22）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_CLASS_LESSON_NOT_FOUND | 课程不存在或不属于该学员班 |

---

#### POST /api/student-classes/:id/members/:studentId/notes

**描述**: 添加学员笔记

**认证**: 需要（教练）

**Consumers**: web-app（学员档案页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| studentId | string (uuid) | 学员用户 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 笔记内容（1-500 字符） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "coachId": "uuid",
    "studentId": "uuid",
    "studentClassId": "uuid",
    "content": "步法需要加强，建议多练跳绳",
    "createdAt": "2026-04-15T16:30:00.000Z"
  }
}
```

**业务规则**:
- 仅学员班创建教练可添加学员笔记（PRD GB-12）
- 学员必须在该学员班中
- 追加模式，每次新增一条（PRD GB 规则 25）
- 单条笔记不可为空，最多 500 字符
- 仅教练可见，学员看不到（PRD GB 规则 29）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_NOTE_CONTENT | 笔记内容为空或超过 500 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_STUDENT_NOT_IN_CLASS | 学员不在该班级中 |

---

#### GET /api/student-classes/:id/members/:studentId/notes

**描述**: 获取学员笔记列表

**认证**: 需要（教练）

**Consumers**: web-app（学员档案页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| studentId | string (uuid) | 学员用户 ID |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "content": "步法需要加强，建议多练跳绳",
        "createdAt": "2026-04-15T16:30:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 仅教练可查看（仅教练可见）（PRD GB 规则 29）
- 按创建时间倒序展示

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_STUDENT_NOT_IN_CLASS | 学员不在该班级中 |

---

#### PUT /api/student-classes/:id/members/:studentId/tags

**描述**: 设置学员标签

**认证**: 需要（教练）

**Consumers**: web-app（学员档案页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| studentId | string (uuid) | 学员用户 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tags | string[] | 是 | 标签列表（最多 10 个，每个最多 20 字符） |

**Response 200**:
```json
{
  "data": {
    "tags": ["左手", "进攻型", "需加强步法"]
  }
}
```

**业务规则**:
- 仅学员班创建教练可设置学员标签（PRD GB-13）
- 学员必须在该学员班中
- 全量替换该学员在该学员班中的标签（PRD GB 规则 26）
- 单个标签不可为空字符串，最多 20 字符（PRD GB 规则 27）
- 同一学员在同一学员班最多 10 个标签（PRD GB 规则 28）
- 仅教练可见，学员看不到（PRD GB 规则 29）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_TAGS | 标签超过 10 个，或单个标签为空或超过 20 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_STUDENT_NOT_IN_CLASS | 学员不在该班级中 |

---

#### GET /api/student-classes/:id/members/:studentId/tags

**描述**: 获取学员标签

**认证**: 需要（教练）

**Consumers**: web-app（学员档案页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 学员班 ID |
| studentId | string (uuid) | 学员用户 ID |

**Response 200**:
```json
{
  "data": {
    "tags": ["左手", "进攻型", "需加强步法"]
  }
}
```

**业务规则**:
- 仅教练可查看（仅教练可见）（PRD GB 规则 29）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该学员班的教练 |
| 404 | COACHING_STUDENT_CLASS_NOT_FOUND | 学员班不存在 |
| 404 | COACHING_STUDENT_NOT_IN_CLASS | 学员不在该班级中 |

---

#### GET /api/users/search

**描述**: 搜索已注册用户（供添加学员时使用）

**认证**: 需要（用户）

**Consumers**: web-app（添加学员弹窗）

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| q | string | 是 | 搜索关键词（昵称模糊匹配 / 完整手机号精确匹配 / 手机号后 4 位精确匹配） |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "nickname": "学员小王",
        "avatarUrl": "https://...",
        "phoneLast4": "1234"
      }
    ]
  }
}
```

**业务规则**:
- 昵称模糊匹配（LIKE '%keyword%'），手机号精确匹配完整号码或后 4 位（PRD GB 规则 4）
- 最多返回 20 条结果
- 不返回完整手机号（隐私保护），仅返回后 4 位（PRD GB 规则 5）
- 搜索关键词最少 1 个字符

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_SEARCH_QUERY | 搜索关键词为空 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

> 注意：此接口定义在 user 模块的 HTTP 路由上，但由 coaching 模块在前端消费。从模块依赖角度，这是前端调用 user 模块的 HTTP API，不违反后端模块间的依赖规则。

---

### 4.2 固定私教学员（GC）

#### POST /api/private-students

**描述**: 添加固定私教学员

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员列表页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | 是 | 学员用户 ID |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "coachId": "uuid",
    "studentId": "uuid",
    "nickname": "学员小王",
    "avatarUrl": "https://...",
    "isActive": true,
    "joinedAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅审核通过的教练（isCoach = true）可添加（PRD GC 规则 1）
- 教练可添加多个固定私教学员，数量无上限（PRD GC 规则 2）
- 调用 UserService.getUserById() 校验学员存在
- 同一用户不可被同一教练重复添加为固定私教学员（PRD GC 规则 4）
- 若该学员之前被移除过（存在 isActive=false 的记录），重新添加时将 isActive 恢复为 true
- 添加后通过 NotificationService.create() 通知学员：「教练 {教练昵称} 将你添加为固定私教学员」（PRD GC 规则 5）
- 通知创建失败不阻塞主流程

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_COACH_ROLE_REQUIRED | 当前用户不是教练角色 |
| 404 | USER_NOT_FOUND | 学员不存在 |
| 409 | COACHING_STUDENT_ALREADY_PRIVATE | 学员已是该教练的活跃固定私教学员 |

---

#### GET /api/private-students

**描述**: 获取教练的固定私教学员列表

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员列表页）

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| includeInactive | boolean | 否 | 是否包含已移除的学员（默认 false，仅返回 isActive=true） |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "studentId": "uuid",
        "nickname": "学员小王",
        "avatarUrl": "https://...",
        "isActive": true,
        "lessonCount": 8,
        "joinedAt": "2026-04-13T10:00:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 仅返回当前教练的固定私教学员（coachId = 当前用户 ID）
- 默认仅返回 isActive = true 的学员
- lessonCount 实时计算（该学员的非 cancelled 课程数）
- 按加入时间倒序排列
- 学员信息通过 UserService.getUsersByIds() 批量获取

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_COACH_ROLE_REQUIRED | 当前用户不是教练角色 |

---

#### GET /api/private-students/:id

**描述**: 获取固定私教学员详情（含课程列表、笔记、标签、战绩概要）

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "coachId": "uuid",
    "studentId": "uuid",
    "nickname": "学员小王",
    "avatarUrl": "https://...",
    "isActive": true,
    "lessonCount": 8,
    "joinedAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅该学员所属教练可查看详情（校验 privateStudent.coachId === 当前用户 ID）
- 教练可查看已移除学员的详情（isActive=false 的记录也可查看历史数据）（PRD GC 规则 15）
- 学员信息通过 UserService.getUserById() 获取

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |

---

#### DELETE /api/private-students/:id

**描述**: 移除固定私教学员（软删除）

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "isActive": false
  }
}
```

**业务规则**:
- 仅该学员所属教练可移除（PRD GC-2）
- 将 PrivateStudent.isActive 设为 false（软删除）（PRD GC 规则 15）
- 历史课程、笔记、标签数据保留，教练仍可查看历史数据（PRD GC 规则 15）
- 移除后不能为该学员创建新课程（由 POST /api/private-students/:id/lessons 校验 isActive）（PRD GC 规则 15）
- 移除后通过 NotificationService.create() 通知学员：「教练 {教练昵称} 已将你从固定私教学员中移除」（PRD GC 规则 6）
- 通知创建失败不阻塞主流程

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |
| 409 | COACHING_STUDENT_ALREADY_INACTIVE | 学员已被移除（isActive=false） |

---

#### POST /api/private-students/:id/lessons

**描述**: 创建固定私教课程

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| startTime | string (ISO 8601) | 是 | 开始时间 |
| endTime | string (ISO 8601) | 是 | 结束时间 |
| venueId | string (uuid) | 是 | 球馆 ID |
| trainingContent | string | 否 | 训练内容（最多 2000 字符） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "privateStudentId": "uuid",
    "coachId": "uuid",
    "studentId": "uuid",
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心",
      "address": "..."
    },
    "startTime": "2026-04-15T14:00:00.000Z",
    "endTime": "2026-04-15T16:00:00.000Z",
    "trainingContent": "反手技术训练",
    "status": "scheduled",
    "createdAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅该学员所属教练可创建课程（PRD GC-3）
- **PrivateStudent.isActive 必须为 true，否则拒绝创建**（PRD GC 规则 15：移除后不能为该学员创建新课程）
- startTime 必须晚于当前时间，endTime 必须晚于 startTime（PRD GC 规则 8，复用 GB 规则 11）
- 调用 VenueService.getVenueById() 验证球馆存在（PRD GC 规则 8，复用 GB 规则 12）
- trainingContent 选填，最多 2000 字符（PRD GC 规则 10）
- 课程初始状态为 scheduled
- studentId 从 PrivateStudent 记录获取
- 创建成功后，通过 NotificationService.create() 通知该学员（PRD GC 规则 9）
- 通知创建失败不阻塞主流程

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_TIME | 开始时间不晚于当前时间，或结束时间不晚于开始时间 |
| 400 | COACHING_INVALID_TRAINING_CONTENT | 训练内容超过 2000 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |
| 404 | COACHING_VENUE_NOT_FOUND | 球馆不存在 |
| 409 | COACHING_STUDENT_INACTIVE | 学员已被移除（isActive=false），不能创建新课程 |

---

#### GET /api/private-students/:id/lessons

**描述**: 获取固定私教学员的课程列表

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 状态筛选：scheduled / in_progress / completed / cancelled；不传则返回全部 |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "venue": {
          "id": "uuid",
          "name": "朝阳体育中心",
          "address": "..."
        },
        "startTime": "2026-04-15T14:00:00.000Z",
        "endTime": "2026-04-15T16:00:00.000Z",
        "trainingContent": "反手技术训练",
        "status": "completed",
        "createdAt": "2026-04-13T10:00:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 仅该学员所属教练可查看课程列表
- 按 startTime 降序排列
- 支持按 status 筛选
- 已移除学员（isActive=false）的课程历史仍可查看（PRD GC 规则 15）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |

---

#### GET /api/private-students/:id/lessons/:lessonId

**描述**: 获取固定私教课程详情

**认证**: 需要（教练）

**Consumers**: web-app（固定私教课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |
| lessonId | string (uuid) | 课程 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "privateStudentId": "uuid",
    "coachId": "uuid",
    "studentId": "uuid",
    "venue": {
      "id": "uuid",
      "name": "朝阳体育中心",
      "address": "..."
    },
    "startTime": "2026-04-15T14:00:00.000Z",
    "endTime": "2026-04-15T16:00:00.000Z",
    "trainingContent": "反手技术训练",
    "status": "completed",
    "createdAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅该学员所属教练可查看课程详情
- 课程必须属于指定的私教学员关系（校验 privateLessonV2.privateStudentId === id）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |
| 404 | COACHING_PRIVATE_LESSON_V2_NOT_FOUND | 课程不存在或不属于该私教学员 |

---

#### PUT /api/private-students/:id/lessons/:lessonId

**描述**: 编辑固定私教课程

**认证**: 需要（教练）

**Consumers**: web-app（固定私教课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |
| lessonId | string (uuid) | 课程 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| startTime | string (ISO 8601) | 否 | 开始时间 |
| endTime | string (ISO 8601) | 否 | 结束时间 |
| venueId | string (uuid) | 否 | 球馆 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "privateStudentId": "uuid",
    "coachId": "uuid",
    "studentId": "uuid",
    "venue": {
      "id": "uuid",
      "name": "海淀体育馆",
      "address": "..."
    },
    "startTime": "2026-04-16T14:00:00.000Z",
    "endTime": "2026-04-16T16:00:00.000Z",
    "trainingContent": "反手技术训练",
    "status": "scheduled",
    "updatedAt": "2026-04-14T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅该学员所属教练可编辑课程（PRD GC-4）
- **只有 status = scheduled 的课程可以编辑**（PRD GC 规则 8，复用 GB 规则 16, 18）
- 已开始（in_progress）、已结束（completed）或已取消（cancelled）的课程不可编辑
- 只更新请求体中包含的字段，未提供的字段保持不变
- 若修改 startTime，新的开始时间必须晚于当前时间
- 若修改 endTime 或 startTime，endTime 必须晚于 startTime（使用修改后的值比较）
- 若修改 venueId，调用 VenueService.getVenueById() 验证球馆存在
- 编辑成功后，通过 NotificationService.create() 通知该学员：「你的私教课程信息已更新」
- 通知创建失败不阻塞主流程

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_TIME | 开始时间不晚于当前时间，或结束时间不晚于开始时间 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |
| 404 | COACHING_PRIVATE_LESSON_V2_NOT_FOUND | 课程不存在或不属于该私教学员 |
| 404 | COACHING_VENUE_NOT_FOUND | 球馆不存在（修改 venueId 时） |
| 409 | COACHING_LESSON_NOT_EDITABLE | 课程状态不为 scheduled，不可编辑 |

---

#### POST /api/private-students/:id/lessons/:lessonId/cancel

**描述**: 取消固定私教课程

**认证**: 需要（教练）

**Consumers**: web-app（固定私教课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |
| lessonId | string (uuid) | 课程 ID |

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
- 仅该学员所属教练可取消课程（PRD GC-5）
- **只有 status = scheduled 的课程可以取消**（PRD GC 规则 8，复用 GB 规则 17, 18）
- 已开始（in_progress）、已结束（completed）的课程不可取消
- 已取消的课程不可重复取消（幂等：返回当前状态，不报错）
- 取消后课程状态变为 cancelled，不可恢复
- 取消成功后，通过 NotificationService.create() 通知该学员：「你的私教课程已取消」
- 通知创建失败不阻塞主流程

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |
| 404 | COACHING_PRIVATE_LESSON_V2_NOT_FOUND | 课程不存在或不属于该私教学员 |
| 409 | COACHING_LESSON_NOT_CANCELLABLE | 课程状态不为 scheduled，不可取消 |

---

#### PUT /api/private-students/:id/lessons/:lessonId/training-content

**描述**: 更新固定私教课程训练内容

**认证**: 需要（教练）

**Consumers**: web-app（固定私教课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |
| lessonId | string (uuid) | 课程 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| trainingContent | string | 是 | 训练内容（最多 2000 字符） |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "trainingContent": "反手技术训练 + 实战对打",
    "updatedAt": "2026-04-14T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅该学员所属教练可更新训练内容（PRD GC-6）
- 课程状态不为 cancelled 时均可修改训练内容（PRD GC 规则 10：创建时即可填写，之后随时可修改）
- 可传空字符串清空训练内容
- 训练内容最多 2000 字符

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_TRAINING_CONTENT | 训练内容超过 2000 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |
| 404 | COACHING_PRIVATE_LESSON_V2_NOT_FOUND | 课程不存在或不属于该私教学员 |
| 409 | COACHING_LESSON_CANCELLED | 课程已取消，不可操作 |

---

#### POST /api/private-students/:id/lessons/:lessonId/notes

**描述**: 添加固定私教课程笔记

**认证**: 需要（教练）

**Consumers**: web-app（固定私教课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |
| lessonId | string (uuid) | 课程 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 笔记内容（1-500 字符） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "privateLessonId": "uuid",
    "coachId": "uuid",
    "content": "今天反手有明显进步，网前注意力还需提高",
    "createdAt": "2026-04-15T16:30:00.000Z"
  }
}
```

**业务规则**:
- 仅该学员所属教练可添加课程笔记（PRD GC-7）
- 课程状态不为 cancelled 时可添加笔记（PRD GC 规则 11）
- 追加模式，每次新增一条，不修改已有笔记
- 单条笔记不可为空，最多 500 字符
- 仅教练可见

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_NOTE_CONTENT | 笔记内容为空或超过 500 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |
| 404 | COACHING_PRIVATE_LESSON_V2_NOT_FOUND | 课程不存在或不属于该私教学员 |
| 409 | COACHING_LESSON_CANCELLED | 课程已取消，不可操作 |

---

#### GET /api/private-students/:id/lessons/:lessonId/notes

**描述**: 获取固定私教课程笔记列表

**认证**: 需要（教练）

**Consumers**: web-app（固定私教课程详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |
| lessonId | string (uuid) | 课程 ID |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "content": "今天反手有明显进步，网前注意力还需提高",
        "createdAt": "2026-04-15T16:30:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 仅教练可查看（笔记仅教练可见）
- 按创建时间倒序展示

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |
| 404 | COACHING_PRIVATE_LESSON_V2_NOT_FOUND | 课程不存在或不属于该私教学员 |

---

#### POST /api/private-students/:id/notes

**描述**: 添加固定私教学员笔记

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 笔记内容（1-500 字符） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "coachId": "uuid",
    "studentId": "uuid",
    "privateStudentId": "uuid",
    "content": "整体技术水平中上，需要重点加强体能",
    "createdAt": "2026-04-15T16:30:00.000Z"
  }
}
```

**业务规则**:
- 仅该学员所属教练可添加学员笔记（PRD GC-9）
- 追加模式，每次新增一条
- 单条笔记不可为空，最多 500 字符
- 仅教练可见，学员看不到（PRD GC 规则 14）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_NOTE_CONTENT | 笔记内容为空或超过 500 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |

---

#### GET /api/private-students/:id/notes

**描述**: 获取固定私教学员笔记列表

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "content": "整体技术水平中上，需要重点加强体能",
        "createdAt": "2026-04-15T16:30:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 仅教练可查看（笔记仅教练可见）（PRD GC 规则 14）
- 按创建时间倒序展示

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |

---

#### PUT /api/private-students/:id/tags

**描述**: 设置固定私教学员标签

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tags | string[] | 是 | 标签列表（最多 10 个，每个最多 20 字符） |

**Response 200**:
```json
{
  "data": {
    "tags": ["右手", "防守型", "体能好"]
  }
}
```

**业务规则**:
- 仅该学员所属教练可设置标签（PRD GC-10）
- 全量替换该学员的标签
- 单个标签不可为空字符串，最多 20 字符
- 同一学员最多 10 个标签（PRD GC 规则 14，复用 GB 规则 28）
- 仅教练可见，学员看不到（PRD GC 规则 14）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_TAGS | 标签超过 10 个，或单个标签为空或超过 20 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |

---

#### GET /api/private-students/:id/tags

**描述**: 获取固定私教学员标签

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员详情页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | PrivateStudent 记录 ID |

**Response 200**:
```json
{
  "data": {
    "tags": ["右手", "防守型", "体能好"]
  }
}
```

**业务规则**:
- 仅教练可查看（标签仅教练可见）（PRD GC 规则 14）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | COACHING_NOT_COACH_OWNER | 非该私教学员的教练 |
| 404 | COACHING_PRIVATE_STUDENT_NOT_FOUND | 固定私教学员记录不存在 |

---

### 4.3 战绩录入集成

学员班课程和固定私教课程的战绩录入复用一期的 `POST /api/match-records` 接口：
- 学员班课程战绩：`sourceType = 'class_lesson'`, `sourceId = ClassLesson.id`
- 固定私教课程战绩：`sourceType = 'private_lesson_v2'`, `sourceId = PrivateLessonV2.id`

**战绩录入状态约束**:
- 战绩只能在关联课程状态为 `in_progress` 或 `completed` 时创建（PRD GB 规则 23, 24; GC 规则 12, 13）
- 尝试为 `scheduled` 状态的课程录入战绩时，返回错误码 `MATCH_RECORD_LESSON_NOT_STARTED`（课程未开始，不可录入战绩）
- 尝试为 `cancelled` 状态的课程录入战绩时，返回错误码 `MATCH_RECORD_LESSON_CANCELLED`（课程已取消，不可录入战绩）

**参与者校验**:
- `class_lesson`：调用 `CoachingService.getClassLessonParticipantIds(lessonId)` 获取学员班学员列表，参与者必须是学员班内的学员（PRD GB 规则 23）
- `private_lesson_v2`：不限制参与者范围，对手可以是任意平台用户（PRD GC 规则 12），仅校验课程存在且状态合法

**战绩关联**:
- 学员班课程战绩关联到 ClassLesson（sourceType='class_lesson'）（PRD GB 规则 25）
- 固定私教课程战绩关联到 PrivateLessonV2（sourceType='private_lesson_v2'）（PRD GC 规则 14）

对应的战绩列表查询新增两个端点：

| HTTP 方法 | 路径 | 认证 | 描述 | Consumers |
|-----------|------|------|------|-----------|
| GET | `/api/class-lessons/:id/match-records` | 教练 | 学员班课程的战绩列表 | web-app（课程详情页） |
| GET | `/api/private-lessons-v2/:id/match-records` | 教练 | 固定私教课程的战绩列表 | web-app（课程详情页） |

---

### 4.4 学员视角接口

学员在 web-app 中需要查看自己被加入的学员班和课程安排：

#### GET /api/my-classes

**描述**: 获取我作为学员的学员班列表

**认证**: 需要（用户）

**Consumers**: web-app（我的课程页面）

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "周三进阶班",
        "coachId": "uuid",
        "coachNickname": "教练张",
        "coachAvatarUrl": "https://...",
        "memberCount": 5,
        "joinedAt": "2026-04-13T10:00:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 返回当前用户作为学员加入的所有学员班（通过 StudentClassMember 关联）
- 不返回笔记和标签数据（学员不可见）
- 教练信息通过 UserService.getUserById() 获取

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

#### GET /api/my-lessons

**描述**: 获取我的所有课程安排（学员班课程 + 固定私教课程合并）

**认证**: 需要（用户）

**Consumers**: web-app（我的课程页面）

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 状态筛选：scheduled / in_progress / completed / cancelled |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "type": "class_lesson",
        "lessonId": "uuid",
        "className": "周三进阶班",
        "coachNickname": "教练张",
        "venue": {
          "id": "uuid",
          "name": "朝阳体育中心",
          "address": "..."
        },
        "startTime": "2026-04-15T14:00:00.000Z",
        "endTime": "2026-04-15T16:00:00.000Z",
        "trainingContent": "步法训练 + 高远球",
        "status": "scheduled"
      },
      {
        "type": "private_lesson_v2",
        "lessonId": "uuid",
        "coachNickname": "教练李",
        "venue": {
          "id": "uuid",
          "name": "海淀体育馆",
          "address": "..."
        },
        "startTime": "2026-04-16T10:00:00.000Z",
        "endTime": "2026-04-16T12:00:00.000Z",
        "trainingContent": "反手技术训练",
        "status": "scheduled"
      }
    ]
  }
}
```

**业务规则**:
- 合并当前用户的学员班课程和固定私教课程
- 学员只能看到课程安排、训练内容、球馆信息
- **不返回教练写的笔记和标签**（API 层不返回）
- 按 startTime 降序排列

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

#### GET /api/my-private-coaches

**描述**: 获取我的固定私教教练列表

**认证**: 需要（用户）

**Consumers**: web-app（我的课程页面）

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "coachId": "uuid",
        "coachNickname": "教练李",
        "coachAvatarUrl": "https://...",
        "lessonCount": 8,
        "joinedAt": "2026-04-13T10:00:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 返回当前用户作为学员的所有活跃固定私教关系（isActive=true）
- 教练信息通过 UserService.getUsersByIds() 获取

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 4.5 内部接口（跨模块 Service 调用）

> 非 HTTP 暴露的接口。用于其他模块的 Service 层直接调用本模块的 Service。

#### CoachingService.getClassLessonById(id)

**描述**: 根据学员班课程 ID 获取课程信息（供 match-record 模块校验课程存在性和状态）

**Consumers**: match-record

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 学员班课程 ID (uuid) |

**返回值**:
```typescript
{
  id: string;
  studentClassId: string;
  coachId: string;
  venueId: string | null;
  startTime: Date;
  endTime: Date;
  status: string;
} | null
```

**业务规则**:
- 课程不存在时返回 null（由调用方决定如何处理）
- 返回字段包含 status，供调用方校验课程状态（match-record 校验是否为 in_progress 或 completed）

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 课程不存在时返回 null，不抛错 |

---

#### CoachingService.getPrivateLessonV2ById(id)

**描述**: 根据固定私教课程 ID 获取课程信息（供 match-record 模块校验课程存在性和状态）

**Consumers**: match-record

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 固定私教课程 ID (uuid) |

**返回值**:
```typescript
{
  id: string;
  privateStudentId: string;
  coachId: string;
  studentId: string;
  venueId: string | null;
  startTime: Date;
  endTime: Date;
  status: string;
} | null
```

**业务规则**:
- 课程不存在时返回 null（由调用方决定如何处理）
- 返回字段包含 status，供调用方校验课程状态

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 课程不存在时返回 null，不抛错 |

---

#### CoachingService.getClassLessonParticipantIds(lessonId)

**描述**: 获取学员班课程的所有参与者用户 ID 列表（供 match-record 模块校验参与者范围）

**Consumers**: match-record

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| lessonId | string | 是 | 学员班课程 ID (uuid) |

**返回值**:
```typescript
string[]  // 用户 ID 列表（学员班内所有学员的 studentId + 教练的 coachId）
```

**业务规则**:
- 返回该课程所在学员班的所有学员 userId + 教练 coachId
- 课程不存在时返回空数组
- 返回顺序不保证

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 始终返回结果，不抛错 |

---

## 5. 消费的外部接口

| 接口 | 提供方 | 调用场景 |
|------|--------|---------|
| UserService.getUserById(id) | user | 添加学员时校验用户存在；通知文案中获取教练/学员昵称 |
| UserService.getUsersByIds(ids) | user | 学员班学员列表批量获取用户信息；固定私教学员列表批量获取用户信息 |
| VenueService.getVenueById(id) | venue | 创建/编辑课程时验证球馆存在 |
| NotificationService.create(notification) | notification | 添加/移除学员通知；固定私教课程创建/编辑/取消通知 |
| NotificationService.createBatch(notifications) | notification | 学员班课程创建/编辑/取消时批量通知所有学员 |

---

## 6. 关键业务逻辑

### 6.1 学员班课程状态机

```
                       创建
                        |
                        v
                    scheduled
                        |
                        |  教练取消（仅 scheduled）
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
- scheduled -> cancelled:    教练主动取消
```

### 6.2 固定私教课程状态机

与学员班课程状态机完全一致：

```
                       创建
                        |
                        v
                    scheduled
                        |
                        |  教练取消（仅 scheduled）
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
```

### 6.3 定时任务 -- 课程状态自动流转

```
触发: 每分钟一次（复用一期定时任务，扩展扫描范围）

逻辑:
1. 学员班课程状态流转:
   a. 查询 ClassLesson 中 status = 'scheduled' 且 startTime <= 当前时间 的记录
   b. 批量更新状态为 in_progress
   c. 查询 ClassLesson 中 status = 'in_progress' 且 endTime <= 当前时间 的记录
   d. 批量更新状态为 completed

2. 固定私教课程状态流转:
   a. 查询 PrivateLessonV2 中 status = 'scheduled' 且 startTime <= 当前时间 的记录
   b. 批量更新状态为 in_progress
   c. 查询 PrivateLessonV2 中 status = 'in_progress' 且 endTime <= 当前时间 的记录
   d. 批量更新状态为 completed

3. 记录 info 日志：本次状态变更的课程数量

注意:
- 批量更新使用 Prisma updateMany，不逐条更新
- 定时任务异常通过 try-catch 捕获，记录 error 日志，不影响服务稳定性
- 日志使用 module: "coaching-status" 标记
```

### 6.4 学员班添加学员流程

```
1. 校验学员班存在且属于当前教练
2. 调用 UserService.getUserById(studentId) 校验学员存在
3. 查询 StudentClassMember 是否已有记录（同一 classId + studentId）
4. 若已存在 → 返回 COACHING_STUDENT_ALREADY_IN_CLASS
5. 创建 StudentClassMember 记录
6. 事务外：调用 NotificationService.create() 通知学员（try-catch）
```

### 6.5 学员班删除流程

```
1. 校验学员班存在且属于当前教练
2. 删除学员班记录（Prisma onDelete: Cascade 自动级联删除 StudentClassMember、ClassLesson、LessonNote）
3. 手动删除 StudentNote（where studentClassId = classId）
4. 手动删除 StudentTag（where studentClassId = classId）
5. 已录入的 MatchRecord（sourceType='class_lesson'）不受影响（多态关联，无物理外键）
```

### 6.6 固定私教学员移除流程

```
1. 校验 PrivateStudent 存在且属于当前教练
2. 校验 isActive = true（已移除的不可重复移除）
3. 更新 PrivateStudent.isActive = false
4. 事务外：调用 NotificationService.create() 通知学员（try-catch）
5. 后续 POST /api/private-students/:id/lessons 创建课程时检查 isActive，为 false 则拒绝
```

### 6.7 通知文案生成

coaching 模块负责按 PRD 定义的模板生成通知文案，通过 NotificationService 创建通知。

| 事件 | type | title | content 模板 | 通知对象 |
|------|------|-------|-------------|---------|
| 学员被加入学员班 | STUDENT_CLASS_ADDED | 加入学员班 | 教练 {教练昵称} 将你加入了学员班「{班级名称}」 | 学员 |
| 学员被移出学员班 | STUDENT_CLASS_REMOVED | 移出学员班 | 你已被移出学员班「{班级名称}」 | 学员 |
| 学员班课程创建 | CLASS_LESSON_CREATED | 新课程通知 | 学员班「{班级名称}」有新课程 | 班内所有学员 |
| 学员班课程变更 | CLASS_LESSON_UPDATED | 课程变更 | 你的学员班「{班级名称}」课程信息已更新 | 班内所有学员 |
| 学员班课程取消 | CLASS_LESSON_CANCELLED | 课程取消 | 学员班「{班级名称}」的课程已取消 | 班内所有学员 |
| 被添加为固定私教学员 | PRIVATE_STUDENT_ADDED | 私教学员 | 教练 {教练昵称} 将你添加为固定私教学员 | 学员 |
| 被移除固定私教学员 | PRIVATE_STUDENT_REMOVED | 私教学员移除 | 教练 {教练昵称} 已将你从固定私教学员中移除 | 学员 |
| 固定私教课程创建 | PRIVATE_LESSON_V2_CREATED | 新课程通知 | 教练 {教练昵称} 为你安排了新的私教课程 | 学员 |
| 固定私教课程变更 | PRIVATE_LESSON_V2_UPDATED | 课程变更 | 你的私教课程信息已更新 | 学员 |
| 固定私教课程取消 | PRIVATE_LESSON_V2_CANCELLED | 课程取消 | 你的私教课程已取消 | 学员 |

> 教练昵称从 UserService.getUserById() 获取。
> 班级名称从 StudentClass.name 获取。

---

## 7. 模块特有约定

### 安全要求
- 学员班所有操作必须校验 studentClass.coachId === 当前用户 ID，非教练本人不可操作
- 固定私教学员所有操作必须校验 privateStudent.coachId === 当前用户 ID
- 创建学员班和添加私教学员必须校验用户具有教练角色（isCoach = true）
- 笔记和标签数据仅教练可访问，学员视角接口不返回
- 学员视角接口（my-classes、my-lessons、my-private-coaches）仅返回课程安排和训练内容

### 性能约束
- 学员班列表和固定私教学员列表中的 memberCount/lessonCount 通过子查询计算，不存储冗余字段
- 用户搜索（GET /api/users/search）响应时间 < 500ms
- 定时任务（每分钟）使用批量更新，不逐条处理

### 并发控制
- 添加学员到学员班使用 UNIQUE 约束 (studentClassId, studentId) 防止重复
- 添加固定私教学员使用 UNIQUE 约束 (coachId, studentId) 防止重复
- 定时任务使用 WHERE 条件（status + 时间条件）进行批量更新，天然幂等

### 错误处理
- HTTP 接口的错误通过抛出带 error code 的异常，由 infra/error-handler.ts 统一处理
- 通知发送失败不阻塞主流程（try-catch + error 日志）
- 定时任务中的异常通过 try-catch 捕获，记录 error 日志，不影响服务稳定性

### 日志策略
- 学员班创建/删除：info 级别记录 coachId（前 8 位）、classId、操作类型
- 学员添加/移除：info 级别记录 classId、studentId（前 8 位）、操作类型
- 课程创建/编辑/取消：info 级别记录 lessonId、操作人 coachId（前 8 位）
- 固定私教学员添加/移除：info 级别记录 coachId（前 8 位）、studentId（前 8 位）
- 定时任务：info 级别记录状态变更的课程数量；debug 级别记录具体 ID
- 日志使用 `module: "coaching-v2"` 标记

---

## 8. 已知限制和 TODO

- 学员班和固定私教的课程列表不做分页（当前阶段数据量小），后续可考虑分页
- 笔记不支持编辑和删除（追加模式，仅支持新增），后续可考虑支持
- 标签为自由文本，不做预定义标签库，后续可考虑常用标签推荐
- 学员视角仅能查看课程和训练内容，不能主动操作（加入/退出班级），后续可考虑
- 删除学员班为物理删除（级联删除所有关联数据），不支持恢复，前端需做二次确认
- 固定私教学员使用软删除（isActive），重新添加时恢复为 active
- 战绩录入的参与者校验逻辑由 match-record 模块负责，coaching 模块仅提供查询接口
- TODO: 后续可考虑学员主动申请加入学员班
- TODO: 后续可考虑课程签到/打卡功能
- TODO: 后续可考虑学员成长报告/数据分析

---

## 附录：Service 方法签名

### A.1 学员班相关

```typescript
// 创建学员班
createStudentClass(coachId: string, input: {
  name: string;               // 班级名称（2-30 字符）
}): Promise<StudentClass>

// 获取教练的学员班列表
getStudentClasses(coachId: string): Promise<StudentClass[]>

// 获取学员班详情
getStudentClassById(classId: string): Promise<StudentClass | null>

// 编辑学员班名称
updateStudentClass(classId: string, coachId: string, input: {
  name: string;
}): Promise<StudentClass>

// 删除学员班
deleteStudentClass(classId: string, coachId: string): Promise<void>

// 添加学员到学员班
addStudentToClass(classId: string, coachId: string, studentId: string): Promise<void>

// 从学员班移除学员
removeStudentFromClass(classId: string, coachId: string, studentId: string): Promise<void>

// 获取学员班学员列表
getClassMembers(classId: string, coachId: string): Promise<StudentClassMember[]>

// 创建学员班课程
createClassLesson(classId: string, coachId: string, input: {
  startTime: string;          // 开始时间 (ISO 8601)
  endTime: string;            // 结束时间 (ISO 8601)
  venueId: string;            // 球馆 ID
  trainingContent?: string;   // 训练内容（最多 2000 字符）
}): Promise<ClassLesson>

// 获取学员班课程列表
getClassLessons(classId: string, coachId: string, filter?: {
  status?: string;
}): Promise<ClassLesson[]>

// 编辑学员班课程（仅 scheduled 状态可编辑）
updateClassLesson(lessonId: string, coachId: string, input: Partial<{
  startTime: string;
  endTime: string;
  venueId: string;
}>): Promise<ClassLesson>

// 取消学员班课程（仅 scheduled 状态可取消）
cancelClassLesson(lessonId: string, coachId: string): Promise<ClassLesson>

// 获取学员班课程详情
getClassLessonById(lessonId: string): Promise<ClassLesson | null>

// 更新课程训练内容
updateLessonTrainingContent(lessonId: string, coachId: string, content: string): Promise<ClassLesson>

// 添加课程笔记
addLessonNote(lessonId: string, coachId: string, content: string): Promise<LessonNote>

// 获取课程笔记列表
getLessonNotes(lessonId: string, coachId: string): Promise<LessonNote[]>

// 添加学员笔记（学员班内的学员）
addStudentNote(classId: string, coachId: string, studentId: string, content: string): Promise<StudentNote>

// 获取学员笔记列表
getStudentNotes(classId: string, coachId: string, studentId: string): Promise<StudentNote[]>

// 设置学员标签
setStudentTags(classId: string, coachId: string, studentId: string, tags: string[]): Promise<string[]>

// 获取学员标签
getStudentTags(classId: string, coachId: string, studentId: string): Promise<string[]>
```

### A.2 固定私教学员相关

```typescript
// 添加固定私教学员
addPrivateStudent(coachId: string, studentId: string): Promise<PrivateStudent>

// 移除固定私教学员（软删除，设置 isActive=false）
removePrivateStudent(privateStudentId: string, coachId: string): Promise<void>

// 获取教练的固定私教学员列表
getPrivateStudents(coachId: string, includeInactive?: boolean): Promise<PrivateStudent[]>

// 获取固定私教学员详情
getPrivateStudentById(privateStudentId: string): Promise<PrivateStudent | null>

// 创建固定私教课程（校验 isActive=true）
createPrivateLessonV2(privateStudentId: string, coachId: string, input: {
  startTime: string;          // 开始时间 (ISO 8601)
  endTime: string;            // 结束时间 (ISO 8601)
  venueId: string;            // 球馆 ID
  trainingContent?: string;   // 训练内容（最多 2000 字符）
}): Promise<PrivateLessonV2>

// 获取固定私教学员课程列表
getPrivateLessonsV2(privateStudentId: string, coachId: string, filter?: {
  status?: string;
}): Promise<PrivateLessonV2[]>

// 编辑固定私教课程（仅 scheduled 状态可编辑）
updatePrivateLessonV2(lessonId: string, coachId: string, input: Partial<{
  startTime: string;
  endTime: string;
  venueId: string;
}>): Promise<PrivateLessonV2>

// 取消固定私教课程（仅 scheduled 状态可取消）
cancelPrivateLessonV2(lessonId: string, coachId: string): Promise<PrivateLessonV2>

// 获取固定私教课程详情
getPrivateLessonV2ById(lessonId: string): Promise<PrivateLessonV2 | null>

// 更新固定私教课程训练内容
updatePrivateLessonV2TrainingContent(lessonId: string, coachId: string, content: string): Promise<PrivateLessonV2>

// 添加固定私教课程笔记
addPrivateLessonNote(lessonId: string, coachId: string, content: string): Promise<LessonNote>

// 获取固定私教课程笔记列表
getPrivateLessonNotes(lessonId: string, coachId: string): Promise<LessonNote[]>

// 添加固定私教学员笔记
addPrivateStudentNote(privateStudentId: string, coachId: string, content: string): Promise<StudentNote>

// 获取固定私教学员笔记列表
getPrivateStudentNotes(privateStudentId: string, coachId: string): Promise<StudentNote[]>

// 设置固定私教学员标签
setPrivateStudentTags(privateStudentId: string, coachId: string, tags: string[]): Promise<string[]>

// 获取固定私教学员标签
getPrivateStudentTags(privateStudentId: string, coachId: string): Promise<string[]>
```

### A.3 学员视角

```typescript
// 获取我作为学员的学员班列表
getMyClasses(studentId: string): Promise<MyClassInfo[]>

// 获取我的所有课程安排（学员班 + 固定私教合并）
getMyLessons(studentId: string, filter?: {
  status?: string;
}): Promise<MyLessonInfo[]>

// 获取我的固定私教教练列表
getMyPrivateCoaches(studentId: string): Promise<MyPrivateCoachInfo[]>
```

### A.4 跨模块接口（被 match-record 模块调用）

```typescript
// 获取学员班课程信息（供 match-record 模块调用）
getClassLessonById(lessonId: string): Promise<ClassLesson | null>

// 获取固定私教课程信息（供 match-record 模块调用）
getPrivateLessonV2ById(lessonId: string): Promise<PrivateLessonV2 | null>

// 获取学员班课程参与者 ID 列表（供 match-record 模块校验参与关系）
getClassLessonParticipantIds(lessonId: string): Promise<string[]>
```

---

## 附录：前端页面

### B.1 web-app 新增页面（教练视角）

| 页面 | 路径 | 入口 | 说明 |
|------|------|------|------|
| 学员班列表页 | `/my-student-classes` | 个人中心 → 我的学员班 | 教练视角，列表展示 |
| 学员班详情页 | `/my-student-classes/:id` | 学员班列表 → 点击某班 | 学员列表 + 课程列表 |
| 学员班课程详情页 | `/my-student-classes/:classId/lessons/:lessonId` | 学员班详情 → 点击某课程 | 训练内容、笔记、战绩 |
| 学员档案页 | `/my-student-classes/:classId/members/:studentId` | 学员班详情 → 点击某学员 | 标签、笔记列表 |
| 固定私教学员列表页 | `/my-private-students` | 个人中心 → 我的私教学员 | 教练视角 |
| 固定私教学员详情页 | `/my-private-students/:id` | 私教学员列表 → 点击某学员 | 课程列表、笔记、标签 |
| 固定私教课程详情页 | `/my-private-students/:id/lessons/:lessonId` | 学员详情 → 点击某课程 | 训练内容、笔记、战绩 |

### B.2 web-app 新增页面（学员视角）

| 页面 | 路径 | 入口 | 说明 |
|------|------|------|------|
| 我的课程 | `/my-lessons` | 个人中心 → 我的课程 | 学员视角，查看课程安排 |

### B.3 状态管理

- 学员班列表/详情、课程列表/详情：使用 TanStack Query，key 按资源层级组织（如 `['student-classes', classId, 'lessons', lessonId]`）
- 固定私教学员相关数据同理
- 无需新增 Zustand store（所有数据为服务端数据，使用 TanStack Query 管理）
