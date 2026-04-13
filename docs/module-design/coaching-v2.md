# 模块详细设计: 学员班 + 固定私教学员 (Coaching v2)

> 本文档描述学员班（GB）和固定私教学员（GC）功能的详细设计和接口契约。
> 系统级架构和数据模型见 [docs/architecture-coaching-v2.md](../architecture-coaching-v2.md)。

## 1. 模块概述

- **功能**: 学员班（GB）— 学员班 CRUD、学员管理、课程管理、笔记/标签；固定私教学员（GC）— 学员添加/移除、私教课程管理、笔记/标签
- **所属模块**: coaching（后端模块扩展）
- **业务模块映射**: PRD 中的「教练管理（FC）」→ 学员班 + 固定私教学员子功能
- **依赖层级**: 中间层（依赖 user、venue、notification）

---

## 2. Service 方法签名

### 2.1 学员班相关

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

// 搜索用户（添加学员时使用）
searchUsers(query: string): Promise<UserSearchResult[]>

// 创建学员班课程
createClassLesson(classId: string, coachId: string, input: {
  date: string;               // 日期 (YYYY-MM-DD)
  startTime: string;          // 开始时间 (ISO 8601)
  endTime: string;            // 结束时间 (ISO 8601)
  venueId: string;            // 球馆 ID
  trainingContent?: string;   // 训练内容（最多 2000 字符）
}): Promise<ClassLesson>

// 编辑学员班课程
updateClassLesson(lessonId: string, coachId: string, input: Partial<{
  date: string;
  startTime: string;
  endTime: string;
  venueId: string;
  trainingContent: string;
}>): Promise<ClassLesson>

// 取消学员班课程
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

### 2.2 固定私教学员相关

```typescript
// 添加固定私教学员
addPrivateStudent(coachId: string, studentId: string): Promise<PrivateStudent>

// 移除固定私教学员
removePrivateStudent(coachId: string, studentId: string): Promise<void>

// 获取教练的固定私教学员列表
getPrivateStudents(coachId: string): Promise<PrivateStudent[]>

// 获取固定私教学员详情
getPrivateStudentDetail(coachId: string, studentId: string): Promise<PrivateStudentDetail>

// 创建固定私教课程
createPrivateLessonV2(coachId: string, studentId: string, input: {
  date: string;
  startTime: string;
  endTime: string;
  venueId: string;
  trainingContent?: string;
}): Promise<PrivateLessonV2>

// 编辑固定私教课程
updatePrivateLessonV2(lessonId: string, coachId: string, input: Partial<{
  date: string;
  startTime: string;
  endTime: string;
  venueId: string;
  trainingContent: string;
}>): Promise<PrivateLessonV2>

// 取消固定私教课程
cancelPrivateLessonV2(lessonId: string, coachId: string): Promise<PrivateLessonV2>

// 获取固定私教课程详情
getPrivateLessonV2ById(lessonId: string): Promise<PrivateLessonV2 | null>

// 固定私教的课程笔记、学员笔记、学员标签方法签名与学员班一致
// addPrivateLessonNote, getPrivateLessonNotes
// addPrivateStudentNote, getPrivateStudentNotes
// setPrivateStudentTags, getPrivateStudentTags
```

### 2.3 扩展的跨模块 Service 接口（被 match-record 模块调用）

```typescript
// 获取学员班课程信息（供 match-record 模块调用）
getClassLessonById(lessonId: string): Promise<ClassLesson | null>

// 获取固定私教课程信息（供 match-record 模块调用）
getPrivateLessonV2ById(lessonId: string): Promise<PrivateLessonV2 | null>

// 获取学员班课程参与者 ID 列表（供 match-record 模块校验参与关系）
getClassLessonParticipantIds(lessonId: string): Promise<string[]>
```

---

## 3. 接口契约

> 每个接口必须包含五要素：**输入、输出、业务规则、错误码、consumers**。
> 接口通用约定（认证方式、响应格式、分页、HTTP 状态码）见 architecture.md。

### 3.1 学员班（GB）

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
- 仅审核通过的教练（isCoach = true）可创建
- 班级名称不可为空，长度 2-30 字符

---

#### POST /api/student-classes/:id/members

**描述**: 添加学员到学员班

**认证**: 需要（教练）

**Consumers**: web-app（学员班详情页）

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
- 仅学员班的创建教练可添加学员
- 调用 UserService.getUserById() 校验学员存在
- 同一用户不可重复添加到同一学员班
- 添加成功后通过 NotificationService.create() 通知学员

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 404 | USER_NOT_FOUND | 学员用户不存在 |
| 409 | COACHING_STUDENT_ALREADY_IN_CLASS | 学员已在班级中 |

---

#### POST /api/student-classes/:id/lessons

**描述**: 创建学员班课程

**认证**: 需要（教练）

**Consumers**: web-app（学员班详情页）

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
- 仅学员班的创建教练可创建课程
- startTime 必须晚于当前时间，endTime 必须晚于 startTime
- 调用 VenueService.getVenueById() 验证球馆存在
- trainingContent 选填，最多 2000 字符
- 创建成功后，通过 NotificationService.createBatch() 通知学员班内所有学员

---

#### PUT /api/student-classes/:id/lessons/:lessonId/training-content

**描述**: 更新课程训练内容

**认证**: 需要（教练）

**Consumers**: web-app（课程详情页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| trainingContent | string | 是 | 训练内容（最多 2000 字符） |

**业务规则**:
- 课程状态不为 cancelled 时均可修改训练内容
- 可传空字符串清空训练内容

---

#### POST /api/student-classes/:id/lessons/:lessonId/notes

**描述**: 添加课程笔记

**认证**: 需要（教练）

**Consumers**: web-app（课程详情页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 笔记内容（1-500 字符） |

**业务规则**:
- 课程状态不为 cancelled 时可添加笔记
- 追加模式，每次新增一条，不修改已有笔记
- 笔记按创建时间倒序展示
- 仅教练可见

---

#### PUT /api/student-classes/:id/members/:studentId/tags

**描述**: 设置学员标签

**认证**: 需要（教练）

**Consumers**: web-app（学员档案页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tags | string[] | 是 | 标签列表（最多 10 个，每个最多 20 字符） |

**业务规则**:
- 全量替换该学员在该学员班中的标签
- 仅教练可见
- 单个标签不可为空字符串，最多 20 字符
- 同一学员在同一学员班最多 10 个标签

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
- 昵称模糊匹配（LIKE '%keyword%'），手机号精确匹配完整号码或后 4 位
- 最多返回 20 条结果
- 不返回完整手机号（隐私保护），仅返回后 4 位
- 搜索关键词最少 1 个字符

> 注意：此接口定义在 user 模块的 HTTP 路由上，但由 coaching 模块在前端消费。从模块依赖角度，这是前端调用 user 模块的 HTTP API，不违反后端模块间的依赖规则。

---

### 3.2 固定私教学员（GC）

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
    "joinedAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅审核通过的教练（isCoach = true）可添加
- 同一用户不可被同一教练重复添加为固定私教学员
- 添加后通知学员

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 404 | USER_NOT_FOUND | 学员不存在 |
| 409 | COACHING_STUDENT_ALREADY_PRIVATE | 学员已是固定私教学员 |

---

#### DELETE /api/private-students/:id

**描述**: 移除固定私教学员

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员详情页）

**业务规则**:
- 将 PrivateStudent.isActive 设为 false（软删除）
- 历史课程、笔记、标签数据保留
- 教练仍可查看历史数据，但不能为该学员创建新课程
- 通知学员

---

#### POST /api/private-students/:id/lessons

**描述**: 创建固定私教课程

**认证**: 需要（教练）

**Consumers**: web-app（固定私教学员详情页）

与学员班课程创建逻辑一致，区别在于：
- 关联到 PrivateStudent 而非 StudentClass
- 仅通知该私教学员一人

---

### 3.3 战绩录入

学员班课程和固定私教课程的战绩录入复用一期的 `POST /api/match-records` 接口：
- 学员班课程战绩：`sourceType = 'class_lesson'`, `sourceId = ClassLesson.id`
- 固定私教课程战绩：`sourceType = 'private_lesson_v2'`, `sourceId = PrivateLessonV2.id`

对应的战绩列表查询新增两个端点：

| HTTP 方法 | 路径 | 认证 | 描述 |
|-----------|------|------|------|
| GET | `/api/class-lessons/:id/match-records` | 教练 | 学员班课程的战绩列表 |
| GET | `/api/private-lessons-v2/:id/match-records` | 教练 | 固定私教课程的战绩列表 |

---

### 3.4 学员视角接口

学员在 web-app 中需要查看自己被加入的学员班和课程安排：

| HTTP 方法 | 路径 | 认证 | 描述 |
|-----------|------|------|------|
| GET | `/api/my-classes` | 用户 | 获取我作为学员的学员班列表 |
| GET | `/api/my-classes/:id` | 用户 | 获取某学员班详情（学员视角，不含笔记/标签） |
| GET | `/api/my-private-coaches` | 用户 | 获取我的固定私教教练列表 |
| GET | `/api/my-lessons` | 用户 | 获取我的所有课程安排（学员班课程 + 固定私教课程合并） |

**业务规则**:
- 学员只能看到课程安排、训练内容、球馆信息
- 学员看不到教练写的笔记和标签（API 层不返回）

---

## 4. 前端页面

### 4.1 web-app 新增页面（教练视角）

| 页面 | 路径 | 入口 | 说明 |
|------|------|------|------|
| 学员班列表页 | `/my-student-classes` | 个人中心 → 我的学员班 | 教练视角，列表展示 |
| 学员班详情页 | `/my-student-classes/:id` | 学员班列表 → 点击某班 | 学员列表 + 课程列表 |
| 学员班课程详情页 | `/my-student-classes/:classId/lessons/:lessonId` | 学员班详情 → 点击某课程 | 训练内容、笔记、战绩 |
| 学员档案页 | `/my-student-classes/:classId/members/:studentId` | 学员班详情 → 点击某学员 | 标签、笔记列表 |
| 固定私教学员列表页 | `/my-private-students` | 个人中心 → 我的私教学员 | 教练视角 |
| 固定私教学员详情页 | `/my-private-students/:id` | 私教学员列表 → 点击某学员 | 课程列表、笔记、标签 |
| 固定私教课程详情页 | `/my-private-students/:id/lessons/:lessonId` | 学员详情 → 点击某课程 | 训练内容、笔记、战绩 |

### 4.2 web-app 新增页面（学员视角）

| 页面 | 路径 | 入口 | 说明 |
|------|------|------|------|
| 我的课程 | `/my-lessons` | 个人中心 → 我的课程 | 学员视角，查看课程安排 |

### 4.3 状态管理

- 学员班列表/详情、课程列表/详情：使用 TanStack Query，key 按资源层级组织（如 `['student-classes', classId, 'lessons', lessonId]`）
- 固定私教学员相关数据同理
- 无需新增 Zustand store（所有数据为服务端数据，使用 TanStack Query 管理）
