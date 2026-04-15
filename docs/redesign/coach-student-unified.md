# 重构方案：统一教练学员管理 + 统一私教模型

> 状态：已定稿，待分期实施
> 生效前提：**项目未上线，无历史数据包袱**，可以大刀阔斧重构 schema

## 1. 目标

把教练端的学员管理和私教模型做三件事：

1. **引入统一学员库**：教练只看到一个"我的学员"列表，合并原来的固定私教学员 + 学员班成员 + 团课/私教的上课学员
2. **统一私教模型**：合并 `PrivateLesson` + `PrivateLessonV2` + `PrivateLessonSlot` 为单表 `PrivateLesson`
3. **"固定私教"降级为标签**：删除 `PrivateStudent` 实体表，固定私教仅作为 `StudentTag` 里一条 `tag='固定私教'` 记录

## 2. 产品决策汇总

| # | 决策 | 说明 |
|---|---|---|
| 1 | 学员入库时机：课程开始后（`in_progress`）且未取消 | scheduler 状态流转时触发 |
| 2 | 仍保留手动添加学员入口 | `source='manual'` |
| 3 | 手机号添加：必须已注册 | 未注册返回 404 `COACH_STUDENT_NOT_REGISTERED`，前端 toast 提示 |
| 4 | `source` 字段只记首次成为学员的来源 | 用 `createMany({ skipDuplicates: true })` 保证不覆盖 |
| 5 | 菜单：统一叫"我的学员"，仅教练可见 | 非教练无此菜单 |
| 6 | 不做软删除/隐藏 | `CoachStudent` 无 `isActive` 字段 |
| 7 | 所有课程开始后禁止退课/取消 | 统一校验 `status !== 'in_progress' && status !== 'completed'` |
| 8 | "固定私教"走通用 `StudentTag` | tag 字符串为 `'固定私教'`，通过 `PUT /api/coach-students/:id/tags` 操作 |
| 9 | 教练安排的私教课学员可见 | 统一 endpoint 权限校验：`lesson.studentId === requester \|\| lesson.coachId === requester` |
| 10 | 过期 slot 处理：新增 `expired` 终态 + 30 天后物理删除 | daily scheduler 负责清理 |
| 11 | `source` 字段 nullable | 开放时段创建时为 null；被预约/直接排课时写入 |

## 3. 数据模型变更

### 3.1 新增表：`CoachStudent`

```prisma
model CoachStudent {
  id         String   @id @default(uuid())
  coachId    String
  studentId  String
  source     String   // 'manual' | 'group-class' | 'private-lesson' | 'class-lesson'
  firstMetAt DateTime @default(now())
  createdAt  DateTime @default(now())

  coach   User @relation("CoachStudents", fields: [coachId], references: [id])
  student User @relation("StudentOfCoaches", fields: [studentId], references: [id])

  @@unique([coachId, studentId])
  @@index([coachId])
  @@index([studentId])
}
```

### 3.2 重构表：`PrivateLesson`（合并 v2 / Slot）

```prisma
model PrivateLesson {
  id              String   @id @default(uuid())
  coachId         String
  studentId       String?  // null = 教练开放未预约的 slot；非 null = 已确定学员
  venueId         String?  // 已确定学员后固化
  venueIds        String[] @default([])  // 仅 slot 模式：教练设置的候选球馆列表
  startTime       DateTime
  endTime         DateTime
  feeDescription  String?
  trainingContent String?
  source          String?  // null | 'booked' | 'scheduled'
  status          String   @default("scheduled") // scheduled | in_progress | completed | cancelled | expired
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  coach   User   @relation("CoachPrivateLessons", fields: [coachId], references: [id])
  student User?  @relation("StudentPrivateLessons", fields: [studentId], references: [id])
  venue   Venue? @relation(fields: [venueId], references: [id], onDelete: SetNull)
  notes   LessonNote[]

  @@index([coachId, status])
  @@index([studentId, status])
  @@index([status, startTime])
  @@index([coachId, studentId])
}
```

**语义映射**

| 状态 | studentId | source | 含义 |
|---|---|---|---|
| scheduled | null | null | 教练开放的空闲时段（未被预约） |
| scheduled | 非空 | 'booked' | 学员已预约，待上课 |
| scheduled | 非空 | 'scheduled' | 教练直接对学员排课，待上课 |
| in_progress | 非空 | booked/scheduled | 课程进行中 |
| completed | 非空 | booked/scheduled | 已完成 |
| cancelled | 非空 | booked/scheduled | 已取消 |
| expired | null | null | 开放时段到期未被预约（scheduler 自动标记） |

### 3.3 删除的表

- `PrivateStudent` — 固定私教降级为 tag
- `PrivateLessonV2` — 合入统一 `PrivateLesson`
- `PrivateLessonSlot` — 合入统一 `PrivateLesson`

### 3.4 调整的表

#### `StudentTag`
```prisma
model StudentTag {
  id        String   @id @default(uuid())
  coachId   String
  studentId String
  tag       String
  createdAt DateTime @default(now())

  coach   User @relation("CoachStudentTags", fields: [coachId], references: [id])
  student User @relation("StudentTagsReceived", fields: [studentId], references: [id])

  @@unique([coachId, studentId, tag])
  @@index([coachId, studentId])
}
```
- 去掉 `studentClassId` / `privateStudentId` 字段
- 唯一约束简化为 `(coachId, studentId, tag)`

#### `StudentNote`
- 去掉 `privateStudentId` 字段
- 保留 `studentClassId?`（班级维度笔记仍需要）

#### `LessonNote`
- `privateLessonId?` 继续存在，改指向合并后的 `PrivateLesson`
- `classLessonId?` 不变

#### `User` 的 relations
- 删除：`coachPrivateStudents`、`privateStudentRelations`、`coachPrivateLessonsV2`、`studentPrivateLessonsV2`、`privateLessonsAsCoach`（旧名）、`privateLessonsAsStudent`（旧名）等旧关系
- 新增：`coachStudents` / `studentOfCoaches`（CoachStudent 的双向关系）
- 合并：`coachPrivateLessons` / `studentPrivateLessons`（统一 PrivateLesson）

## 4. 接口契约

### 4.1 新增 — CoachStudent 相关

```
GET  /api/coach-students
  query: tag?, search?, page=1, pageSize=20
  response: {
    items: [{
      studentId, nickname, avatarUrl, phoneLast4,
      firstMetAt, source,
      tags: ['团课学员', '私教学员', '固定私教', ...],  // 派生 + 自定义标签合并
      studentClasses: [{id, name}]  // 所属学员班（可能多个）
    }],
    total, page, pageSize
  }

GET  /api/coach-students/:studentId
  response: 上述 item + 历史课程概览（最近 5 次，跨三类聚合）+ 自定义标签详情

POST /api/coach-students
  body: { studentId }
  response: CoachStudent (source='manual')
  规则: 幂等；已存在则不改 source（决策 4）

POST /api/coach-students/search-by-phone
  body: { phone }
  response: 成功 → { userId, nickname, phoneLast4 }
           失败 → 404 { code: 'COACH_STUDENT_NOT_REGISTERED' }

PUT  /api/coach-students/:studentId/tags
  body: { tags: string[] }
  response: { tags: [...] }
  说明: 设置/覆盖该学员的自定义标签；'固定私教' 就是标签字符串之一
```

### 4.2 新增 — 教练给学员排课

```
POST /api/coach-students/:studentId/lessons
  body: { startTime, endTime, venueId?, feeDescription?, trainingContent? }
  response: PrivateLesson (source='scheduled', studentId=<param>)
  规则: 校验该学员已在当前教练的 CoachStudent 列表内

GET  /api/coach-students/:studentId/lessons
  query: status?, page, pageSize
  response: { items: PrivateLesson[], total, page, pageSize }
```

### 4.3 统一 — PrivateLesson 原有接口合并

```
POST /api/coaches/:id/availability
  body: { startTime, endTime, venueIds?, feeDescription? }
  response: PrivateLesson (studentId=null, source=null, status='scheduled')

GET  /api/coaches/:id/availability
  query: from?, to?
  response: { items: PrivateLesson[] }  // studentId=null AND status='scheduled'

POST /api/private-lessons/:id/book
  body: { venueId? }
  response: PrivateLesson (studentId=当前用户, source='booked')
  规则: 事务里校验 studentId IS NULL AND status='scheduled' AND startTime > NOW()
        用 updateMany + where 做乐观并发控制

GET  /api/private-lessons/:id
  权限: lesson.studentId === requester.userId || lesson.coachId === requester.userId
  
PUT  /api/private-lessons/:id
POST /api/private-lessons/:id/cancel
PUT  /api/private-lessons/:id/training-content
POST /api/private-lessons/:id/notes
GET  /api/private-lessons/:id/notes
```

### 4.4 删除的接口

```
POST   /api/private-students
GET    /api/private-students
GET    /api/private-students/:id
DELETE /api/private-students/:id
POST   /api/private-students/:id/lessons
GET    /api/private-students/:id/lessons
GET    /api/private-students/:id/lessons/:lessonId
PUT    /api/private-students/:id/lessons/:lessonId
POST   /api/private-students/:id/lessons/:lessonId/cancel
PUT    /api/private-students/:id/lessons/:lessonId/training-content
POST   /api/private-students/:id/lessons/:lessonId/notes
GET    /api/private-students/:id/lessons/:lessonId/notes
POST   /api/private-students/:id/notes
GET    /api/private-students/:id/notes
PUT    /api/private-students/:id/tags
GET    /api/private-students/:id/tags
```

## 5. Scheduler 调整

每分钟轮询：

```ts
// 1) 过期未预约的 slot → expired
await prisma.privateLesson.updateMany({
  where: { studentId: null, status: 'scheduled', startTime: { lte: now } },
  data: { status: 'expired' },
});

// 2) 已约的 scheduled → in_progress；同时把参与学员写入 CoachStudent
const newlyInProgress = await prisma.privateLesson.findMany({
  where: { studentId: { not: null }, status: 'scheduled', startTime: { lte: now } },
});
for (const lesson of newlyInProgress) {
  await prisma.privateLesson.update({ where: { id: lesson.id }, data: { status: 'in_progress' } });
  await coachStudentService.record(lesson.coachId, lesson.studentId, 'private-lesson');
}

// 3) 类似地处理 GroupClass / ClassLesson 状态流转 + CoachStudent 入库
```

每日（凌晨）：

```ts
// 清理 30 天前的 expired slot
await prisma.privateLesson.deleteMany({
  where: { status: 'expired', startTime: { lt: subDays(now, 30) } },
});
```

## 6. 退课/取消禁止规则

统一在 service 层加：

```ts
function assertCancellable(status: string) {
  if (status === 'in_progress' || status === 'completed') {
    throw new AppError(409, 'COACHING_ALREADY_STARTED', '课程已开始，不可退课/取消');
  }
}
```

作用于：
- 团课：`cancelGroupClassEnrollment`（学员退课）
- 团课：`cancelGroupClass`（教练取消）
- 一次性私教：`cancelPrivateLesson`（学员取消）
- 教练排的私教课：`cancelPrivateLesson`（教练取消）
- 学员班排课：`cancelClassLesson`（教练取消）
- 约球活动：`leaveActivity`（如有需要，按现有业务调整）

## 7. 前端改造

### 7.1 菜单 `quick-link-list.tsx`

教练分支：
- ~~我的私教学员~~ → **我的学员** (`/my-students`)
- 课程管理 (`/my-courses`) ← 保留，含 团课/私教/学员班 3 Tab
- 教练资料 (`/profile/coach-edit`) ← 保留
- 我的报名 (`/my-enrollments`) ← 保留

非教练分支：
- 我的课程 (`/my-enrollments`) ← 保留
- **不显示** 我的学员

### 7.2 新增页面

- `CoachStudentListPage` (`/my-students`)：筛选 tag + 搜索 + 添加按钮
- `CoachStudentDetailPage` (`/my-students/:studentId`)：
  - 学员信息
  - 标签区（派生 + 自定义；"固定私教"当作普通 tag 渲染，可点击增删）
  - 历史课程（跨三类聚合时间倒序）
  - 所属学员班列表
  - "给 TA 排课"按钮 → 直接跳私教排课表单

### 7.3 删除页面

- `PrivateStudentListPage`
- `PrivateStudentDetailPage`

### 7.4 合并 API

- 新建 `web/features/coaching/api/coach-student-api.ts`
- 删除 `web/features/coaching/api/private-student-api.ts`
- 改写 `web/features/coaching/api/private-lesson-api.ts`（统一接口）

### 7.5 路由

- 新增 `/my-students`、`/my-students/:studentId`
- `/my-private-students` 永久 302 到 `/my-students`

## 8. 测试与文档

### 契约测试
- 新增 `tests/contracts/coaching/coach-student.test.ts`
- 新增 `tests/contracts/coaching/private-lesson-unified.test.ts`
- 删除 `tests/contracts/coaching/private-student.test.ts` 等
- 加退课禁止测试（四类课程）

### 集成测试
- `tests/integration/paths/group-class-to-coach-student.test.ts`
- `tests/integration/paths/private-lesson-to-coach-student.test.ts`
- `tests/integration/paths/class-lesson-to-coach-student.test.ts`
- 手动添加路径 → CoachStudent 写入

### E2E
- `tests/e2e/coach-student.e2e.ts` 覆盖主要用户故事
- 重写 / 删除 `private-student.e2e.ts`、重写 `private-lesson.e2e.ts`

### 文档
- 更新 `docs/prd.md` 教练学员管理章节
- 重写 `docs/module-design/coaching.md` 数据模型 + 接口契约
- 删除 `docs/module-design/coaching-v2.md`（合并回 coaching.md）
- 更新 `docs/architecture.md` 模块依赖图

## 9. 分期计划

### 第一期（后端）
- schema 重构（新增 CoachStudent、重构 PrivateLesson、删除 PrivateStudent/V2/Slot）
- `npx prisma migrate dev` 生成迁移
- `server/modules/coaching/` 重构：新增 coach-student 子模块；PrivateLesson 三合一合并
- scheduler hook：状态流转 + CoachStudent 入库 + expired 处理 + 30 天清理
- 退课禁止校验
- 统一接口实现
- 契约测试 + 集成测试
- 更新 coaching.md

### 第二期（前端）
- 新建 CoachStudentListPage + CoachStudentDetailPage
- 删除 PrivateStudent 相关页面
- 重写 private-lesson-api
- 菜单改名
- 前端契约测试 + 集成测试

### 第三期（收尾）
- E2E 测试重写
- 文档同步（prd / architecture）
- 清理死代码和命名

## 10. 已知风险与应对

| 风险 | 应对 |
|---|---|
| scheduler 状态流转与学员预约的并发 | 学员 book 用事务 + `updateMany + where studentId=null` 做乐观锁 |
| `CoachStudent` 入库失败不能阻塞课程状态流转 | 入库用 try/catch 包裹 + error log，幂等依靠唯一约束兜底 |
| 过期 slot 清理误删未来时段 | 清理 SQL 双重校验 `status='expired' AND startTime < NOW() - 30 days` |
| 删表的 cascade 影响 | schema 修改前 `npx prisma migrate reset` 干净重建（无历史数据，决策 2） |
