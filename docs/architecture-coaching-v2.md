# 教练功能增强 (Coaching v2) 架构设计文档

> 本文档描述 Coaching v2（教练审核、学员班、固定私教学员）的系统级架构设计。
> 基于 docs/architecture.md 中的现有架构，本文档为增量设计。
> 详细接口契约见 docs/module-design/coach-verification.md 和 docs/module-design/coaching-v2.md

## 1. 概述

### 1.1 功能与模块映射

| PRD 功能 | 功能 ID | 映射到的后端模块 | 新增/修改 |
|----------|---------|----------------|----------|
| 教练审核 | GA | coaching | 修改（扩展） |
| 学员班 | GB | coaching | 修改（扩展） |
| 固定私教学员 | GC | coaching | 修改（扩展） |

**设计决策**：三个新功能均扩展到现有 `coaching` 模块中，而非创建独立模块。理由如下：

1. 教练审核（GA）是教练角色的准入机制，与 coaching 模块的教练资料管理职责紧密相关
2. 学员班（GB）和固定私教学员（GC）是教练对学员的管理工具，属于教练维度的课程管理，与一期的团课/私教共享教练身份校验和课程状态流转逻辑
3. 保持一个 PRD 业务模块（FC 教练管理）对应一个技术模块（coaching）的 1:1 映射，避免模块碎片化

### 1.2 与现有模块的关系

```
                         infra
            ┌──────┬──────┼──────┬──────┬──────┬──────┐
            ↓      ↓      ↓      ↓      ↓      ↓      ↓
          user   venue  notification  activity  coaching  match-record  review
                                                  │ (扩展)
                                                  │
                                    ┌─────────────┼────────────────┐
                                    ↓             ↓                ↓
                              教练审核(GA)   学员班(GB)    固定私教学员(GC)
```

coaching 模块的依赖关系不变：
- 依赖：user（基础层）、venue（基础层）、notification（基础层）
- 被依赖：match-record（上层）、review（上层）

### 1.3 关键约束

- 依赖方向不变：coaching 属于中间层，只调用基础层（user、venue、notification），不调用上层（match-record、review）
- match-record 模块需扩展新的 sourceType 以支持学员班课程和固定私教课程的战绩关联
- 通知创建失败不阻塞主流程
- 课程状态流转复用一期的定时任务轮询机制（每分钟）

## 2. 新增/修改的后端模块

### 2.1 coaching 模块（修改）

#### 职责扩展

一期职责：教练资料管理、团课发布与报名管理、私教时间设置与预约管理、课程状态自动流转

新增职责：
- **教练审核管理**：教练申请提交、管理员审核（通过/拒绝）、审核状态查询
- **学员班管理**：学员班 CRUD、学员添加/移除、学员班课程 CRUD、课程训练内容/笔记管理、学员笔记/标签管理
- **固定私教学员管理**：固定私教学员添加/移除、私教课程 CRUD、课程训练内容/笔记管理、学员笔记/标签管理

#### 层级结构

```
coaching/
├── controller.ts      # 请求处理、参数校验、响应格式化（扩展新路由）
├── service.ts         # 业务逻辑、规则执行、状态流转（扩展新方法）
├── repository.ts      # 数据访问、Prisma 查询封装（扩展新查询）
├── types.ts           # 模块内类型定义（扩展新类型和枚举）
└── index.ts           # 对外导出（扩展新公开接口）
```

#### 依赖

| 依赖模块 | 调用接口 | 用途 |
|---------|---------|------|
| user | `UserService.getUserById(id)` | 校验教练身份、获取用户信息 |
| user | `UserService.getUsersByIds(ids)` | 批量获取学员信息（搜索结果展示、列表展示） |
| venue | `VenueService.getVenueById(id)` | 校验课程球馆存在性 |
| notification | `NotificationService.create(notification)` | 发送审核结果通知、学员添加/移除通知、课程通知 |
| notification | `NotificationService.createBatch(notifications)` | 批量通知学员班课程创建/修改/取消 |

#### 新增 Service 方法概要

**教练审核相关**：提交申请、获取申请状态、管理员审核列表（分页）、审核详情、审核通过/拒绝

**学员班相关**：学员班 CRUD（创建/列表/详情/编辑/删除）、学员添加/移除、用户搜索、课程 CRUD（创建/详情/编辑/取消）、课程训练内容更新、课程笔记（添加/列表）、学员笔记（添加/列表）、学员标签（设置/获取）

**固定私教学员相关**：学员添加/移除/列表/详情、课程 CRUD（创建/详情/编辑/取消）、课程笔记（添加/列表）、学员笔记（添加/列表）、学员标签（设置/获取）

**扩展的跨模块接口**（被 match-record 模块调用）：获取学员班课程信息、获取固定私教课程信息、获取学员班课程参与者 ID 列表

### 2.2 match-record 模块（修改）

#### 变更内容

扩展 `sourceType` 枚举，新增两个值以支持新课程类型的战绩关联：

| 枚举值 | 说明 |
|--------|------|
| activity | 约球活动（一期已有） |
| group-class | 团课（一期已有） |
| private-lesson | 私教课（一期已有） |
| **class_lesson** | **学员班课程（新增）** |
| **private_lesson_v2** | **固定私教课程（新增）** |

#### 参与者校验逻辑扩展

录入战绩时（`POST /api/match-records`），根据 sourceType 调用不同的参与者校验：

- `class_lesson`：调用 `CoachingService.getClassLessonParticipantIds(lessonId)` 获取学员班学员列表，参与者必须是学员班内的学员
- `private_lesson_v2`：不限制参与者（PRD 规定对手可以是任意平台用户），仅校验课程存在且状态为 in_progress 或 completed

### 2.3 user 模块（无代码修改）

user 模块本身不需修改。教练申请审核改变了 `isCoach` 的设置方式（从用户自行开启改为管理员审核后设置），但 `isCoach` 字段仍在 User 模型中，由 coaching 模块的审核通过逻辑直接更新。

> **注意**：一期的 `PUT /api/users/me/coach-role` 接口在 v2 中语义变更——该入口将重定向到教练申请流程，不再直接开启教练角色。此变更在前端路由层处理，后端接口保持兼容（可在 v2 上线时标记为 deprecated 或修改为返回提示）。

## 3. 数据模型（Prisma Schema 新增）

### 3.1 新增模型

```prisma
// ===== Coaching Module v2 Extensions =====

model CoachApplication {
  id              String   @id @default(uuid())
  userId          String
  certificateUrls String[]
  description     String?
  status          String   @default("pending") // pending | approved | rejected
  rejectReason    String?
  reviewedBy      String?
  reviewedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
  @@index([status, createdAt])
}

model StudentClass {
  id        String   @id @default(uuid())
  coachId   String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  coach    User                  @relation("CoachStudentClasses", fields: [coachId], references: [id])
  members  StudentClassMember[]
  lessons  ClassLesson[]

  @@index([coachId])
}

model StudentClassMember {
  id             String   @id @default(uuid())
  studentClassId String
  studentId      String
  joinedAt       DateTime @default(now())

  studentClass StudentClass @relation(fields: [studentClassId], references: [id], onDelete: Cascade)
  student      User         @relation("StudentClassMemberships", fields: [studentId], references: [id])

  @@unique([studentClassId, studentId])
  @@index([studentId])
}

model ClassLesson {
  id              String   @id @default(uuid())
  studentClassId  String
  coachId         String
  venueId         String?
  startTime       DateTime
  endTime         DateTime
  trainingContent String?
  status          String   @default("scheduled") // scheduled | in_progress | completed | cancelled
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  studentClass StudentClass @relation(fields: [studentClassId], references: [id], onDelete: Cascade)
  coach        User         @relation("CoachClassLessons", fields: [coachId], references: [id])
  venue        Venue?       @relation("VenueClassLessons", fields: [venueId], references: [id], onDelete: SetNull)
  notes        LessonNote[] @relation("ClassLessonNotes")

  @@index([studentClassId])
  @@index([coachId])
  @@index([status])
  @@index([status, startTime])
  @@index([status, endTime])
  @@index([venueId])
}

model PrivateStudent {
  id        String   @id @default(uuid())
  coachId   String
  studentId String
  isActive  Boolean  @default(true)
  joinedAt  DateTime @default(now())
  updatedAt DateTime @updatedAt

  coach   User @relation("CoachPrivateStudents", fields: [coachId], references: [id])
  student User @relation("PrivateStudentRelations", fields: [studentId], references: [id])
  lessons PrivateLessonV2[]

  @@unique([coachId, studentId])
  @@index([coachId])
  @@index([studentId])
}

model PrivateLessonV2 {
  id               String   @id @default(uuid())
  privateStudentId String
  coachId          String
  studentId        String
  venueId          String?
  startTime        DateTime
  endTime          DateTime
  trainingContent  String?
  status           String   @default("scheduled") // scheduled | in_progress | completed | cancelled
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  privateStudent PrivateStudent @relation(fields: [privateStudentId], references: [id])
  coach          User           @relation("CoachPrivateLessonsV2", fields: [coachId], references: [id])
  student        User           @relation("StudentPrivateLessonsV2", fields: [studentId], references: [id])
  venue          Venue?         @relation("VenuePrivateLessonsV2", fields: [venueId], references: [id], onDelete: SetNull)
  notes          LessonNote[]   @relation("PrivateLessonV2Notes")

  @@index([privateStudentId])
  @@index([coachId])
  @@index([studentId])
  @@index([status])
  @@index([status, startTime])
  @@index([status, endTime])
  @@index([venueId])
}

model LessonNote {
  id              String   @id @default(uuid())
  classLessonId   String?
  privateLessonId String?
  coachId         String
  content         String
  createdAt       DateTime @default(now())

  classLesson   ClassLesson?   @relation("ClassLessonNotes", fields: [classLessonId], references: [id], onDelete: Cascade)
  privateLesson PrivateLessonV2? @relation("PrivateLessonV2Notes", fields: [privateLessonId], references: [id], onDelete: Cascade)
  coach         User             @relation("CoachLessonNotes", fields: [coachId], references: [id])

  @@index([classLessonId])
  @@index([privateLessonId])
  @@index([coachId])
}

model StudentNote {
  id             String   @id @default(uuid())
  coachId        String
  studentId      String
  studentClassId String?
  privateStudentId String?
  content        String
  createdAt      DateTime @default(now())

  coach          User          @relation("CoachStudentNotes", fields: [coachId], references: [id])
  student        User          @relation("StudentNotesReceived", fields: [studentId], references: [id])

  @@index([coachId, studentId])
  @@index([studentClassId])
  @@index([privateStudentId])
}

model StudentTag {
  id             String  @id @default(uuid())
  coachId        String
  studentId      String
  studentClassId String?
  privateStudentId String?
  tag            String
  createdAt      DateTime @default(now())

  coach   User @relation("CoachStudentTags", fields: [coachId], references: [id])
  student User @relation("StudentTagsReceived", fields: [studentId], references: [id])

  @@unique([coachId, studentId, studentClassId, tag])
  @@unique([coachId, studentId, privateStudentId, tag])
  @@index([coachId, studentId, studentClassId])
  @@index([coachId, studentId, privateStudentId])
}
```

### 3.2 User 模型 relation 扩展

User 模型需新增以下 relation 字段（仅 relation 定义，不修改 User 表结构）：

```prisma
model User {
  // ... 一期已有字段和 relations ...

  // v2 新增 relations
  coachApplications       CoachApplication[]
  coachStudentClasses     StudentClass[]        @relation("CoachStudentClasses")
  studentClassMemberships StudentClassMember[]   @relation("StudentClassMemberships")
  coachClassLessons       ClassLesson[]          @relation("CoachClassLessons")
  coachPrivateStudents    PrivateStudent[]        @relation("CoachPrivateStudents")
  privateStudentRelations PrivateStudent[]        @relation("PrivateStudentRelations")
  coachPrivateLessonsV2   PrivateLessonV2[]      @relation("CoachPrivateLessonsV2")
  studentPrivateLessonsV2 PrivateLessonV2[]      @relation("StudentPrivateLessonsV2")
  coachLessonNotes        LessonNote[]           @relation("CoachLessonNotes")
  coachStudentNotes       StudentNote[]          @relation("CoachStudentNotes")
  studentNotesReceived    StudentNote[]          @relation("StudentNotesReceived")
  coachStudentTags        StudentTag[]           @relation("CoachStudentTags")
  studentTagsReceived     StudentTag[]           @relation("StudentTagsReceived")
}
```

### 3.3 Venue 模型 relation 扩展

```prisma
model Venue {
  // ... 一期已有字段和 relations ...

  // v2 新增 relations
  classLessons     ClassLesson[]     @relation("VenueClassLessons")
  privateLessonsV2 PrivateLessonV2[] @relation("VenuePrivateLessonsV2")
}
```

### 3.4 模型关系说明

```
User 1 ← N CoachApplication（一个用户可多次提交申请，但同时只有一个 pending 状态的）
User 1 ← N StudentClass（教练可创建多个学员班）
User N ← M StudentClass（多对多，通过 StudentClassMember 关联）
StudentClass 1 ← N ClassLesson（一个学员班可有多次课程）
User 1 ← N PrivateStudent（教练可有多个固定私教学员，通过 coachId）
User 1 ← N PrivateStudent（学员可被多个教练添加为固定私教学员，通过 studentId）
PrivateStudent 1 ← N PrivateLessonV2（一对固定私教关系下可有多次课程）
ClassLesson 1 ← N LessonNote（一堂课可有多条笔记）
PrivateLessonV2 1 ← N LessonNote（一堂私教课可有多条笔记）
```

### 3.5 状态枚举

**CoachApplication.status**:

| 枚举值 | 说明 |
|--------|------|
| pending | 审核中 |
| approved | 已通过 |
| rejected | 已拒绝 |

**ClassLesson.status 和 PrivateLessonV2.status**:

| 枚举值 | 说明 | 可执行的操作 |
|--------|------|-------------|
| scheduled | 未开始 | 教练编辑、教练取消 |
| in_progress | 进行中 | 录入训练内容、笔记、战绩 |
| completed | 已结束 | 录入训练内容、笔记、战绩 |
| cancelled | 已取消 | 无 |

> 注意：训练内容可在课程创建后任何非取消状态下修改（PRD：创建时即可填写，之后随时可修改）。课程笔记在任何非取消状态下均可新增。战绩仅在 in_progress 或 completed 状态下可录入。

## 4. API 端点

### 4.1 教练审核（GA）

| HTTP 方法 | 路径 | 认证 | 描述 | Consumers |
|-----------|------|------|------|-----------|
| POST | `/api/coach-applications` | 用户 | 提交教练申请 | web-app |
| GET | `/api/coach-applications/me` | 用户 | 获取我的教练申请状态 | web-app |
| GET | `/api/admin/coach-applications` | 管理员 | 管理员获取审核列表 | admin |
| GET | `/api/admin/coach-applications/:id` | 管理员 | 管理员获取审核详情 | admin |
| POST | `/api/admin/coach-applications/:id/review` | 管理员 | 管理员审核（通过/拒绝） | admin |

> 详细请求/响应格式、业务规则和错误码见 [docs/module-design/coach-verification.md](module-design/coach-verification.md)

---

### 4.2 学员班（GB）

| HTTP 方法 | 路径 | 认证 | 描述 |
|-----------|------|------|------|
| POST | `/api/student-classes` | 教练 | 创建学员班 |
| GET | `/api/student-classes` | 教练 | 获取我的学员班列表 |
| GET | `/api/student-classes/:id` | 教练 | 获取学员班详情 |
| PUT | `/api/student-classes/:id` | 教练 | 编辑学员班名称 |
| DELETE | `/api/student-classes/:id` | 教练 | 删除学员班 |
| POST | `/api/student-classes/:id/members` | 教练 | 添加学员 |
| DELETE | `/api/student-classes/:id/members/:studentId` | 教练 | 移除学员 |
| GET | `/api/student-classes/:id/members/:studentId` | 教练 | 获取学员档案（标签、笔记） |
| POST | `/api/student-classes/:id/lessons` | 教练 | 创建课程 |
| GET | `/api/student-classes/:id/lessons/:lessonId` | 教练 | 获取课程详情 |
| PUT | `/api/student-classes/:id/lessons/:lessonId` | 教练 | 编辑课程 |
| POST | `/api/student-classes/:id/lessons/:lessonId/cancel` | 教练 | 取消课程 |
| PUT | `/api/student-classes/:id/lessons/:lessonId/training-content` | 教练 | 更新训练内容 |
| POST | `/api/student-classes/:id/lessons/:lessonId/notes` | 教练 | 添加课程笔记 |
| GET | `/api/student-classes/:id/lessons/:lessonId/notes` | 教练 | 获取课程笔记列表 |
| POST | `/api/student-classes/:id/members/:studentId/notes` | 教练 | 添加学员笔记 |
| GET | `/api/student-classes/:id/members/:studentId/notes` | 教练 | 获取学员笔记列表 |
| PUT | `/api/student-classes/:id/members/:studentId/tags` | 教练 | 设置学员标签 |
| GET | `/api/student-classes/:id/members/:studentId/tags` | 教练 | 获取学员标签 |
| GET | `/api/users/search` | 用户 | 搜索用户（添加学员时使用） |

> 详细请求/响应格式、业务规则和错误码见 [docs/module-design/coaching-v2.md](module-design/coaching-v2.md)

---

### 4.3 固定私教学员（GC）

| HTTP 方法 | 路径 | 认证 | 描述 |
|-----------|------|------|------|
| POST | `/api/private-students` | 教练 | 添加固定私教学员 |
| GET | `/api/private-students` | 教练 | 获取固定私教学员列表 |
| GET | `/api/private-students/:id` | 教练 | 获取学员详情（课程列表、笔记、标签、战绩） |
| DELETE | `/api/private-students/:id` | 教练 | 移除固定私教学员 |
| POST | `/api/private-students/:id/lessons` | 教练 | 创建私教课程 |
| GET | `/api/private-students/:id/lessons/:lessonId` | 教练 | 获取私教课程详情 |
| PUT | `/api/private-students/:id/lessons/:lessonId` | 教练 | 编辑私教课程 |
| POST | `/api/private-students/:id/lessons/:lessonId/cancel` | 教练 | 取消私教课程 |
| PUT | `/api/private-students/:id/lessons/:lessonId/training-content` | 教练 | 更新训练内容 |
| POST | `/api/private-students/:id/lessons/:lessonId/notes` | 教练 | 添加课程笔记 |
| GET | `/api/private-students/:id/lessons/:lessonId/notes` | 教练 | 获取课程笔记列表 |
| POST | `/api/private-students/:id/notes` | 教练 | 添加学员笔记 |
| GET | `/api/private-students/:id/notes` | 教练 | 获取学员笔记列表 |
| PUT | `/api/private-students/:id/tags` | 教练 | 设置学员标签 |
| GET | `/api/private-students/:id/tags` | 教练 | 获取学员标签 |

> 详细请求/响应格式、业务规则和错误码见 [docs/module-design/coaching-v2.md](module-design/coaching-v2.md)

#### 战绩录入

学员班课程和固定私教课程的战绩录入复用一期的 `POST /api/match-records` 接口：
- 学员班课程战绩：`sourceType = 'class_lesson'`, `sourceId = ClassLesson.id`
- 固定私教课程战绩：`sourceType = 'private_lesson_v2'`, `sourceId = PrivateLessonV2.id`

对应的战绩列表查询新增两个端点：

| HTTP 方法 | 路径 | 认证 | 描述 |
|-----------|------|------|------|
| GET | `/api/class-lessons/:id/match-records` | 教练 | 学员班课程的战绩列表 |
| GET | `/api/private-lessons-v2/:id/match-records` | 教练 | 固定私教课程的战绩列表 |

---

### 4.4 学员视角接口

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

## 5. 前端变更

### 5.1 web-app 新增页面

在 `web/features/coaching/` 下扩展或新增以下页面和组件：

| 页面 | 路径 | 入口 | 说明 |
|------|------|------|------|
| 教练申请页 | `/coach-apply` | 设置页 → 申请成为教练 | 证书上传 + 说明填写 + 审核状态展示 |
| 学员班列表页 | `/my-student-classes` | 个人中心 → 我的学员班 | 教练视角，列表展示 |
| 学员班详情页 | `/my-student-classes/:id` | 学员班列表 → 点击某班 | 学员列表 + 课程列表 |
| 学员班课程详情页 | `/my-student-classes/:classId/lessons/:lessonId` | 学员班详情 → 点击某课程 | 训练内容、笔记、战绩 |
| 学员档案页 | `/my-student-classes/:classId/members/:studentId` | 学员班详情 → 点击某学员 | 标签、笔记列表 |
| 固定私教学员列表页 | `/my-private-students` | 个人中心 → 我的私教学员 | 教练视角 |
| 固定私教学员详情页 | `/my-private-students/:id` | 私教学员列表 → 点击某学员 | 课程列表、笔记、标签 |
| 固定私教课程详情页 | `/my-private-students/:id/lessons/:lessonId` | 学员详情 → 点击某课程 | 训练内容、笔记、战绩 |
| 我的课程（学员视角） | `/my-lessons` | 个人中心 → 我的课程 | 学员视角，查看课程安排 |

在 `web/features/profile/` 中修改：
- **设置页**：将"开启教练角色"入口改为"申请成为教练"，跳转到教练申请页

新增 Feature：无需新增 feature 目录，所有页面在 `coaching` feature 下扩展。

### 5.2 admin 新增页面

在 `admin/features/` 下新增 `coach-review/` feature：

```
admin/features/
├── auth/
├── venue-management/
└── coach-review/          # 新增
    ├── pages/
    │   ├── CoachReviewListPage.tsx      # 教练审核列表
    │   └── CoachReviewDetailPage.tsx    # 教练审核详情
    ├── components/
    │   ├── ApplicationList.tsx
    │   └── CertificateViewer.tsx
    └── api/
        └── coach-review-api.ts
```

| 页面 | 路径 | 说明 |
|------|------|------|
| 教练审核列表 | `/coach-review` | 待审核/已通过/已拒绝筛选 |
| 教练审核详情 | `/coach-review/:id` | 证书大图、申请说明、通过/拒绝操作 |

Admin 侧边栏新增"教练审核"入口。

### 5.3 前端路由扩展

web-app `routes.tsx` 新增：
```
/coach-apply                                    → CoachApplyPage
/my-student-classes                              → StudentClassListPage
/my-student-classes/:id                          → StudentClassDetailPage
/my-student-classes/:classId/lessons/:lessonId   → ClassLessonDetailPage
/my-student-classes/:classId/members/:studentId  → StudentProfilePage
/my-private-students                             → PrivateStudentListPage
/my-private-students/:id                         → PrivateStudentDetailPage
/my-private-students/:id/lessons/:lessonId       → PrivateLessonV2DetailPage
/my-lessons                                      → MyLessonsPage
```

admin `routes.tsx` 新增：
```
/coach-review                                    → CoachReviewListPage
/coach-review/:id                                → CoachReviewDetailPage
```

### 5.4 状态管理

- 教练申请状态：使用 TanStack Query 缓存 `GET /api/coach-applications/me` 结果，key 为 `['coach-application', 'me']`
- 学员班列表/详情、课程列表/详情：使用 TanStack Query，key 按资源层级组织（如 `['student-classes', classId, 'lessons', lessonId]`）
- 固定私教学员相关数据同理
- 无需新增 Zustand store（所有数据为服务端数据，使用 TanStack Query 管理）

## 6. 跨模块交互

### 6.1 教练申请审核流程

```
用户提交申请 POST /api/coach-applications
  → coaching.Controller
  → coaching.Service 校验：用户未是教练、无 pending 申请
  → coaching.Repository 创建 CoachApplication 记录
  → 返回申请信息

管理员审核 POST /api/admin/coach-applications/:id/review
  → coaching.Controller
  → coaching.Service 校验申请状态为 pending
  → coaching.Repository 更新 CoachApplication 状态
  → 若通过：coaching.Repository 更新 User.isCoach = true
  →         coaching.Repository 创建 CoachProfile（如不存在）
  → 调用 notification.Service.create() 通知申请人（try-catch，失败不阻塞）
  → 返回审核结果
```

### 6.2 学员班课程创建流程

```
教练创建课程 POST /api/student-classes/:id/lessons
  → coaching.Controller 校验参数
  → coaching.Service 校验：
      → 教练身份（isCoach = true）
      → 学员班存在且属于该教练
      → 时间校验（startTime > now，endTime > startTime）
      → 调用 venue.Service.getVenueById(venueId) 验证球馆
  → coaching.Repository 创建 ClassLesson 记录
  → coaching.Service 获取学员班所有学员 ID
  → 调用 notification.Service.createBatch() 通知所有学员（try-catch）
  → 返回课程信息
```

### 6.3 学员班课程战绩录入流程

```
教练录入战绩 POST /api/match-records
  (sourceType = 'class_lesson', sourceId = ClassLesson.id)
  → match-record.Controller 校验参数
  → match-record.Service：
      → 调用 coaching.Service.getClassLessonById(sourceId) 验证课程存在
      → 校验课程状态为 in_progress 或 completed
      → 调用 coaching.Service.getClassLessonParticipantIds(sourceId) 获取学员列表
      → 校验参与者在学员班内（class_lesson 限制参与者为班内学员）
  → match-record.Repository 创建 MatchRecord + MatchPlayer + MatchGame
  → 返回战绩信息
```

### 6.4 固定私教课程战绩录入流程

```
教练录入战绩 POST /api/match-records
  (sourceType = 'private_lesson_v2', sourceId = PrivateLessonV2.id)
  → match-record.Controller 校验参数
  → match-record.Service：
      → 调用 coaching.Service.getPrivateLessonV2ById(sourceId) 验证课程存在
      → 校验课程状态为 in_progress 或 completed
      → 对手可以是任意平台用户（不限制参与者范围）
  → match-record.Repository 创建 MatchRecord + MatchPlayer + MatchGame
  → 返回战绩信息
```

### 6.5 课程状态自动流转

复用一期的定时任务机制，在 coaching 模块的定时任务中扩展扫描范围：

| 定时任务 | 触发频率 | 扫描模型 |
|---------|---------|---------|
| 团课/私教状态流转（一期） | 每分钟 | GroupClass, PrivateLesson |
| **学员班课程状态流转（新增）** | 每分钟 | ClassLesson |
| **固定私教课程状态流转（新增）** | 每分钟 | PrivateLessonV2 |

流转规则（与一期一致）：
- `scheduled` + startTime <= now → `in_progress`
- `in_progress` + endTime <= now → `completed`

### 6.6 通知类型扩展

notification 模块的通知类型枚举新增：

| 枚举值 | 说明 | 触发模块 |
|--------|------|---------|
| COACH_APPLICATION_APPROVED | 教练审核通过 | coaching |
| COACH_APPLICATION_REJECTED | 教练审核未通过 | coaching |
| STUDENT_CLASS_ADDED | 被加入学员班 | coaching |
| STUDENT_CLASS_REMOVED | 被移出学员班 | coaching |
| CLASS_LESSON_CREATED | 学员班有新课程 | coaching |
| CLASS_LESSON_UPDATED | 学员班课程已变更 | coaching |
| CLASS_LESSON_CANCELLED | 学员班课程已取消 | coaching |
| PRIVATE_STUDENT_ADDED | 被添加为固定私教学员 | coaching |
| PRIVATE_STUDENT_REMOVED | 被移除固定私教学员 | coaching |
| PRIVATE_LESSON_V2_CREATED | 有新私教课程 | coaching |
| PRIVATE_LESSON_V2_UPDATED | 私教课程已变更 | coaching |
| PRIVATE_LESSON_V2_CANCELLED | 私教课程已取消 | coaching |

跳转目标类型（targetType）新增：

| 枚举值 | 说明 | 前端跳转路由 |
|--------|------|-------------|
| coach-application | 教练申请 | /coach-apply |
| student-class | 学员班 | /my-classes/:id（学员视角） |
| class-lesson | 学员班课程 | /my-lessons（学员视角） |
| private-student | 固定私教关系 | /my-private-coaches（学员视角） |
| private-lesson-v2 | 固定私教课程 | /my-lessons（学员视角） |

## 7. 迁移策略

### 7.1 已有教练自动批准

PRD 规则：一期已注册的教练（User.isCoach = true）自动保留资格，无需审核。

**迁移脚本**（在数据库迁移后运行）：

```sql
-- 为已有教练创建 CoachApplication 记录（状态为 approved）
INSERT INTO "CoachApplication" (id, "userId", "certificateUrls", status, "reviewedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  id,
  ARRAY[]::text[],
  'approved',
  NOW(),
  NOW(),
  NOW()
FROM "User"
WHERE "isCoach" = true
AND NOT EXISTS (
  SELECT 1 FROM "CoachApplication" ca WHERE ca."userId" = "User".id
);
```

此迁移确保已有教练在新的审核体系中有一条 approved 记录，查询审核状态时不会显示为"未申请"。

### 7.2 数据库迁移计划

1. **步骤 1**：创建新表（CoachApplication, StudentClass, StudentClassMember, ClassLesson, PrivateStudent, PrivateLessonV2, LessonNote, StudentNote, StudentTag）
2. **步骤 2**：在 User 和 Venue 模型上添加新的 relation（仅 Prisma schema 变更，无数据库结构变更）
3. **步骤 3**：运行迁移脚本为已有教练创建 CoachApplication 记录
4. **步骤 4**：前端发布新版本，一期的"开启教练角色"入口改为"申请成为教练"

**回滚计划**：
- 新增的表可直接 DROP（不影响一期数据）
- 一期的 isCoach 字段和 CoachProfile 数据不受影响

### 7.3 接口兼容性

- 一期的 `PUT /api/users/me/coach-role` 接口保持可用但行为变更：对于 v2 用户返回提示信息指引其走审核流程。可设置一个过渡期（如 30 天），之后废弃该接口。
- 一期已有的团课和私教相关接口不受影响。
- match-record 模块的 `POST /api/match-records` 接口扩展 sourceType 枚举，一期的值保持不变。

## 8. 接口依赖矩阵更新

### 8.1 新增 HTTP API 接口

| 接口 | 提供方 | 消费方 | 变更影响级别 |
|------|--------|--------|------------|
| `POST /api/coach-applications` | coaching | web-app | 中 |
| `GET /api/coach-applications/me` | coaching | web-app | 中 |
| `GET /api/admin/coach-applications` | coaching | admin | 中 |
| `GET /api/admin/coach-applications/:id` | coaching | admin | 中 |
| `POST /api/admin/coach-applications/:id/review` | coaching | admin | 中 |
| `POST /api/student-classes` | coaching | web-app | 中 |
| `GET /api/student-classes` | coaching | web-app | 中 |
| `GET /api/student-classes/:id` | coaching | web-app | 中 |
| `PUT /api/student-classes/:id` | coaching | web-app | 中 |
| `DELETE /api/student-classes/:id` | coaching | web-app | 中 |
| `POST /api/student-classes/:id/members` | coaching | web-app | 中 |
| `DELETE /api/student-classes/:id/members/:studentId` | coaching | web-app | 中 |
| `POST /api/student-classes/:id/lessons` | coaching | web-app | 中 |
| `GET /api/student-classes/:id/lessons/:lessonId` | coaching | web-app | 中 |
| `PUT /api/student-classes/:id/lessons/:lessonId` | coaching | web-app | 中 |
| `POST /api/student-classes/:id/lessons/:lessonId/cancel` | coaching | web-app | 中 |
| `POST /api/private-students` | coaching | web-app | 中 |
| `GET /api/private-students` | coaching | web-app | 中 |
| `GET /api/private-students/:id` | coaching | web-app | 中 |
| `DELETE /api/private-students/:id` | coaching | web-app | 中 |
| `POST /api/private-students/:id/lessons` | coaching | web-app | 中 |
| `GET /api/users/search` | user | web-app | 中 |
| `GET /api/my-classes` | coaching | web-app | 中 |
| `GET /api/my-lessons` | coaching | web-app | 中 |
| `GET /api/class-lessons/:id/match-records` | match-record | web-app | 中 |
| `GET /api/private-lessons-v2/:id/match-records` | match-record | web-app | 中 |

### 8.2 新增/扩展内部 Service 接口

| 接口 | 提供方 | 消费方 | 变更影响级别 |
|------|--------|--------|------------|
| `CoachingService.getClassLessonById(id)` | coaching | match-record | 中 |
| `CoachingService.getPrivateLessonV2ById(id)` | coaching | match-record | 中 |
| `CoachingService.getClassLessonParticipantIds(id)` | coaching | match-record | 中 |

依赖方向：match-record（上层）→ coaching（中间层），符合项目依赖规则。

## 9. 关键架构决策

### 决策 V2-1: 学员班和固定私教学员功能放入 coaching 模块，不单独建模块

- **问题**: 三个新功能（教练审核、学员班、固定私教学员）是否需要独立模块
- **方案**: 均放入 coaching 模块扩展
- **理由**: 三个功能都围绕"教练"角色展开，共享教练身份校验逻辑；学员班课程和固定私教课程与一期团课/私教共享状态流转、球馆校验、通知发送等逻辑；避免模块碎片化，保持 PRD 业务模块与技术模块的 1:1 映射

### 决策 V2-2: 课程使用独立表（ClassLesson、PrivateLessonV2），不复用一期 GroupClass/PrivateLesson

- **问题**: 学员班课程和固定私教课程是否应复用一期的 GroupClass/PrivateLesson 表
- **方案**: 使用独立的新表
- **理由**: 一期的 GroupClass 是面向公开报名的团课（有 maxParticipants、feeDescription 等字段），学员班课程是面向固定学员的非公开课程（无需报名、无名额限制）；一期的 PrivateLesson 依赖 PrivateLessonSlot 时间段机制，固定私教课程是教练直接为学员排课（无时间段概念）；共用表会导致大量 nullable 字段和复杂的类型判断逻辑

### 决策 V2-3: 固定私教学员移除使用软删除

- **问题**: 移除固定私教学员时如何处理历史数据
- **方案**: PrivateStudent.isActive 字段标记软删除，不物理删除记录
- **理由**: PRD 要求移除后"课程历史、笔记、标签数据保留，教练仍可查看历史数据"；软删除保留关联关系，查询历史数据时无需特殊处理

### 决策 V2-4: 用户搜索接口放在 user 模块

- **问题**: 添加学员时需要搜索用户，搜索接口应放在哪个模块
- **方案**: `GET /api/users/search` 放在 user 模块
- **理由**: 用户搜索是对 User 表的查询操作，属于 user 模块的职责；coaching 模块通过前端调用该 HTTP API 获取搜索结果，不在后端 service 层直接依赖 user 的搜索方法（保持简单，搜索结果展示在前端完成）

### 决策 V2-5: 笔记和标签使用独立表而非 JSON 字段

- **问题**: 笔记和标签数据应使用独立表还是在课程/学员表中存储 JSON
- **方案**: 使用独立的 LessonNote、StudentNote、StudentTag 表
- **理由**: 笔记是追加模式（每次新增一条），JSON 字段不适合频繁追加；标签需要全量替换操作，独立表便于原子更新和唯一性约束；独立表便于后续按条件查询和分页

### 决策 V2-6: 证书图片复用一期的头像上传方案

- **问题**: 证书图片如何存储
- **方案**: 复用一期的本地 uploads 目录存储方案，前端先上传图片获取 URL，再提交申请时传入 URL 列表
- **理由**: PRD 明确要求"复用一期的头像上传方案"；一期已有文件上传基础设施，无需引入新的存储方案
