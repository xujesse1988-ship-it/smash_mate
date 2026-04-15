# Coaching 模块详细设计

> **版本**: v3.0（统一学员管理 + 统一私教模型 + 教练审核 + 学员班）
> **最后更新**: 2026-04-15
> **范围**: 后端 coaching 模块完整设计与接口契约
> **历史**:
> - v1.0 (2026-04-01) — 初版（团课 + 私教 slot/booking）
> - v2.0 (2026-04-13) — 教练审核(GA) + 学员班(GB) + 固定私教学员(GC) 三个增量模块
> - v3.0 (2026-04-15) — **统一学员管理** + **统一 PrivateLesson 模型** + **退课禁止规则**。设计依据：`docs/redesign/coach-student-unified.md`

---

## 1. 模块概述

### 1.1 职责

教练业务的全部后端能力，涵盖：

1. **教练资料与列表** — 教练资料编辑、教练列表、教练主页
2. **教练资质审核（GA）** — 用户提交教练资质材料、管理员审核
3. **团课** — 教练发布/修改/取消团课、学员报名/退课
4. **私教（统一模型）** — 教练设置空闲时段、学员预约、教练直接对学员排课、训练内容、笔记、状态流转
5. **学员班（GB）** — 教练创建班级、管理成员、班级排课、班级笔记
6. **统一学员库（GC）** — 教练的"我的学员"聚合视图（合并团课/私教/学员班/手动 4 种来源）+ 学员标签 + 学员档案
7. **课程笔记 / 学员笔记 / 学员标签** — 教练侧的训练记录工具
8. **课程定时状态流转** — 团课 / 私教 / 学员班课的 `scheduled → in_progress → completed` 自动流转
9. **过期 slot 清理** — 未被预约的私教时段标记 expired + 30 天后物理删除

### 1.2 边界

| 不负责 | 由谁负责 |
|---|---|
| 用户基本信息、教练角色字段 | user |
| 球馆数据 | venue |
| 通知发送 | notification（本模块只调用 `NotificationService.create`） |
| 评价评分 | review |
| 战绩 | match-record |
| 管理员认证 | infra/admin-auth |

### 1.3 一期统一学员管理重构核心决策

| # | 决策 | 一句话说明 |
|---|---|---|
| 1 | 三类私教合并为一张 `PrivateLesson` 表 | 通过 `studentId IS NULL` + `source` 区分 slot / booked / 教练排课 |
| 2 | 引入 `CoachStudent` 表作为统一学员库 | 三类课程开始（in_progress）+ 手动添加 共 4 种来源都写入此表 |
| 3 | "固定私教" 降级为 `StudentTag` 中字符串 `'固定私教'` | 删除原 `PrivateStudent` 表 |
| 4 | 学员入库时机 = 课程进入 `in_progress` 时，由 scheduler 触发 | 入库失败不阻塞状态流转（log error） |
| 5 | `source` 字段只记首次来源 | 用 `createMany({ skipDuplicates: true })` 保证不覆盖 |
| 6 | 学员手动添加要求"已注册" | 未注册返回 `404 COACH_STUDENT_NOT_REGISTERED` |
| 7 | 课程进入 `in_progress` / `completed` 后禁止退课/取消 | 统一通过 `assertCancellable()` 在 service 层校验 |
| 8 | 过期未预约 slot → `expired` 终态，30 天后物理删除 | 每分钟流转 + 每日凌晨清理 |
| 9 | 学员 book slot 用乐观锁 | `updateMany` + `where { studentId: null, status: 'scheduled' }` |

---

## 2. 数据模型

### 2.1 模型清单

| 模型 | 职责 | 备注 |
|---|---|---|
| `CoachProfile` | 教练资料（bio、specialties） | 1:1 User |
| `CoachApplication` | 教练资质审核申请 | 与 User 多对一 |
| `GroupClass` | 团课 | |
| `GroupClassEnrollment` | 团课报名记录 | 多对多 |
| `PrivateLesson` | **统一私教课**：包括 slot、学员预约、教练排课三种语义 | 详见 §2.3 |
| `StudentClass` | 学员班 | |
| `StudentClassMember` | 学员班成员 | |
| `ClassLesson` | 学员班排课 | |
| `CoachStudent` | **统一学员库**：教练的全部学员（聚合视图） | 详见 §2.4 |
| `StudentTag` | 教练给学员打的标签（含特殊标签 `'固定私教'`） | |
| `StudentNote` | 学员档案笔记 | 可关联到学员班 |
| `LessonNote` | 课程笔记（团课、学员班课、私教课均可关联） | |

### 2.2 已删除模型（v3 重构）

| 旧模型 | 替代方案 |
|---|---|
| `PrivateLessonSlot` | 合入 `PrivateLesson`（`studentId=null` 即 slot） |
| `PrivateLessonV2` | 合入 `PrivateLesson` |
| `PrivateStudent` | 合入 `CoachStudent` + `StudentTag(tag='固定私教')` |

### 2.3 PrivateLesson 三态语义

```
status × studentId × source 组合：
┌─────────────────┬────────────┬─────────────┬─────────────────────────────┐
│ status          │ studentId  │ source      │ 含义                        │
├─────────────────┼────────────┼─────────────┼─────────────────────────────┤
│ scheduled       │ null       │ null        │ 教练开放的空闲时段（未预约）│
│ scheduled       │ 非空       │ 'booked'    │ 学员已预约（待上课）        │
│ scheduled       │ 非空       │ 'scheduled' │ 教练直接对学员排课（待上课）│
│ in_progress     │ 非空       │ booked/sch  │ 课程进行中                  │
│ completed       │ 非空       │ booked/sch  │ 已完成                      │
│ cancelled       │ 非空       │ booked/sch  │ 已取消                      │
│ expired         │ null       │ null        │ 开放时段过期未被预约（终态）│
└─────────────────┴────────────┴─────────────┴─────────────────────────────┘
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid (PK) | |
| coachId | uuid (FK→User) | |
| studentId | uuid? (FK→User) | null = slot |
| venueId | uuid? (FK→Venue) | 已确定球馆后填充 |
| venueIds | string[] | slot 模式下的候选球馆列表，非 slot 不使用 |
| startTime | timestamptz | |
| endTime | timestamptz | |
| feeDescription | string? | |
| trainingContent | string? | 训练内容（可在课程开始前后修改） |
| source | string? | null \| 'booked' \| 'scheduled' |
| status | string | scheduled \| in_progress \| completed \| cancelled \| expired |
| createdAt / updatedAt | timestamptz | |

索引：
- `(coachId, status)` — 教练视角列表
- `(studentId, status)` — 学员视角列表
- `(status, startTime)` — scheduler 扫描
- `(coachId, studentId)` — 跨学员/教练关联查询

### 2.4 CoachStudent — 统一学员库

```prisma
model CoachStudent {
  id         String   @id @default(uuid())
  coachId    String
  studentId  String
  source     String   // 'manual' | 'group-class' | 'private-lesson' | 'class-lesson'
  firstMetAt DateTime @default(now())
  createdAt  DateTime @default(now())

  @@unique([coachId, studentId])
  @@index([coachId])
  @@index([studentId])
}
```

- `source` **只记首次成为学员的来源**。重复入库通过 `createMany({ skipDuplicates: true })` 保证幂等
- `firstMetAt` 同样只在首次入库时设置
- 不设软删除字段，删除靠 hard delete（一期不需要）

### 2.5 跨模块关系（外键）

| 字段 | 指向 | onDelete |
|---|---|---|
| `PrivateLesson.coachId` / `studentId` | User | 默认（无） |
| `PrivateLesson.venueId` | Venue | SetNull |
| `GroupClass.coachId` | User | 默认 |
| `GroupClass.venueId` | Venue | SetNull |
| `StudentClass.coachId` | User | 默认 |
| `ClassLesson.studentClassId` | StudentClass | Cascade |
| `ClassLesson.venueId` | Venue | SetNull |
| `CoachStudent.coachId` / `studentId` | User | 默认 |
| `LessonNote.classLessonId` / `privateLessonId` | ClassLesson / PrivateLesson | Cascade |

---

## 3. 接口契约

> 所有接口走标准响应：成功 `{ data }`、失败 `{ error: { code, message } }`；分页参数 `page` 默认 1，`pageSize` 默认 20、最大 100。

### 3.1 教练资料 / 列表

#### GET /api/coaches
- 用途：教练列表
- Query: `page?`, `pageSize?`, `specialty?` (singles | doubles | footwork | fitness | tactics)
- Response data: `{ items: CoachListItem[], total, page, pageSize }`
- CoachListItem: `{ id, nickname, avatarUrl, bio, specialties, studentCount }`

#### GET /api/coaches/:id
- 用途：教练主页
- Response data: `{ id, nickname, avatarUrl, bio, specialties, studentCount, isCoach }`
- 错误：`404 COACHING_NOT_A_COACH` — 用户不存在或非教练

#### PUT /api/coaches/me
- 用途：编辑教练资料
- Auth: Bearer
- Body: `{ bio?, specialties? }`，specialties 为枚举数组
- Response data: 更新后的 CoachProfile
- 错误：`400 COACHING_INVALID_SPECIALTY` / `403 COACHING_COACH_ROLE_REQUIRED`

### 3.2 教练资质审核（GA）

#### POST /api/coach-applications
- Body: `{ certificateUrls: string[], description? }`
- 规则：1≤certificates≤5；同一用户不可有 2 个 pending 申请
- Response data (201): `{ id, status: 'pending', certificateUrls, description, createdAt }`
- 错误：`409 COACHING_APPLICATION_PENDING` / `400 COACHING_INVALID_CERTIFICATES`

#### GET /api/coach-applications/me
- Response data: `{ id, status, rejectReason?, createdAt, updatedAt } | null`

#### GET /api/admin/coach-applications
- Auth: admin
- Query: `status?` (pending | approved | rejected), `page?`, `pageSize?`
- Response data: `{ items: ApplicationItem[], total, page, pageSize }`

#### GET /api/admin/coach-applications/:id
- Auth: admin
- Response data: 完整申请详情（含 user 信息、证书 URL 列表）

#### POST /api/admin/coach-applications/:id/review
- Auth: admin
- Body: `{ status: 'approved' | 'rejected', rejectReason? }`
- 通过 → user.isCoach = true + 通知；拒绝 → 通知（含 rejectReason）
- 错误：`409 COACHING_APPLICATION_ALREADY_REVIEWED` / `400 COACHING_REJECT_REASON_REQUIRED`

### 3.3 团课

#### POST /api/group-classes
- Body: `{ venueId, title, startTime, endTime, maxParticipants, feeDescription? }`
- Auth: Bearer + 教练角色
- Response data (201): GroupClass
- 错误：`400 COACHING_INVALID_TIME` / `403 COACHING_COACH_ROLE_REQUIRED` / `404 COACHING_VENUE_NOT_FOUND`

#### GET /api/group-classes/:id
- Response data: `{ id, coachId, coach: User, venue, title, startTime, endTime, maxParticipants, feeDescription, status, enrollmentCount, isEnrolled }`

#### PUT /api/group-classes/:id
- Auth: Bearer + 教练本人
- Body: 同 POST 的子集
- 规则：仅 `status='open' | 'full'` 时允许；修改后通知所有学员
- 错误：`409 COACHING_CLASS_NOT_MODIFIABLE`

#### POST /api/group-classes/:id/cancel
- Auth: Bearer + 教练本人
- 规则：`assertCancellable(status)` — `in_progress / completed` 禁止
- 错误：`409 COACHING_ALREADY_STARTED`

#### POST /api/group-classes/:id/enroll
- Auth: Bearer
- 规则：状态必须 `open`；学员未报过；满员后 status → `full`
- 错误：`409 COACHING_CLASS_FULL` / `409 COACHING_ALREADY_ENROLLED` / `409 COACHING_CLASS_NOT_ENROLLABLE`

#### POST /api/group-classes/:id/cancel-enrollment
- Auth: Bearer
- 规则：`assertCancellable(status)` — `in_progress / completed` 禁止
- 错误：`409 COACHING_ALREADY_STARTED`

### 3.4 私教（统一）

#### POST /api/private-lessons/availability
- Body: `{ slots: Array<{ startTime, endTime, venueIds?, feeDescription? }> }`
- Auth: Bearer + 教练角色
- 行为：批量创建 `PrivateLesson(studentId=null, source=null, status='scheduled')`
- Response data (201): `{ slots: PrivateLesson[] }`
- 错误：`400 COACHING_SLOT_TOO_SHORT` / `409 COACHING_SLOT_OVERLAP`

#### GET /api/coaches/:id/availability
- Query: `startDate?`, `endDate?`（默认未来 14 天）
- Response data: `{ slots: Array<{ id, startTime, endTime, venues, feeDescription, isBooked: false }> }`
- 仅返回 `studentId IS NULL AND status='scheduled' AND startTime > NOW()` 的 slot

#### POST /api/private-lessons/:id/book
- Auth: Bearer
- Body: `{ venueId? }`
- 规则：
  - lesson 必须 `studentId IS NULL AND status='scheduled' AND startTime > NOW()`
  - 教练不可预约自己（`COACHING_CANNOT_BOOK_OWN_LESSON`）
  - 候选 venueIds 不为空时必须从中选；为空时如果传 venueId 必须存在
  - **乐观锁**：repository 用 `updateMany({ where: { id, studentId: null, status: 'scheduled' } })` 更新
- 通知教练：新私教预约
- Response data (201): PrivateLesson(source='booked')
- 错误：`409 COACHING_SLOT_ALREADY_BOOKED` / `409 COACHING_SLOT_EXPIRED` / `400 COACHING_VENUE_REQUIRED` / `400 COACHING_INVALID_VENUE_CHOICE` / `403 COACHING_CANNOT_BOOK_OWN_LESSON`

#### GET /api/private-lessons/:id
- Auth: Bearer
- 权限：`coachId === requester || studentId === requester`
- Response data: PrivateLesson 详情（含 coach、student、venue、notes 摘要）
- 错误：`403 COACHING_NOT_LESSON_PARTICIPANT` / `404 COACHING_PRIVATE_LESSON_NOT_FOUND`

#### PUT /api/private-lessons/:id
- Auth: Bearer + 教练本人
- Body: `{ venueId?, startTime?, endTime?, feeDescription?, trainingContent? }`
- 规则：仅 `status='scheduled'` 可修改；修改时间需检查不冲突
- 修改后通知学员（如 studentId 非空）

#### POST /api/private-lessons/:id/cancel
- Auth: Bearer + 教练或学员
- 规则：`assertCancellable(status)`；status 必须 `scheduled`
- 通知对方（教练取消通知学员；学员取消通知教练）
- 错误：`409 COACHING_ALREADY_STARTED` / `409 COACHING_LESSON_NOT_CANCELLABLE`

#### PUT /api/private-lessons/:id/training-content
- Auth: Bearer + 教练本人
- Body: `{ trainingContent: string }`
- 任何状态下教练都可修改训练内容
- Response data: `{ id, trainingContent }`

#### POST /api/private-lessons/:id/notes
- Auth: Bearer + 教练本人
- Body: `{ content: string }` (1-500 字符)
- Response data (201): LessonNote
- 笔记仅教练可见

#### GET /api/private-lessons/:id/notes
- Auth: Bearer + 教练本人
- Response data: `{ items: LessonNote[] }`（按 createdAt 倒序）
- 学员调用返回 `403 COACHING_NOTES_COACH_ONLY`

### 3.5 教练给学员排课（统一学员库子能力）

#### POST /api/coach-students/:studentId/lessons
- Auth: Bearer + 教练
- Body: `{ startTime, endTime, venueId?, feeDescription?, trainingContent? }`
- 规则：
  - 校验 `(coachId, studentId)` 已在 CoachStudent 表（"先把人加入学员，再排课"）
  - 创建 `PrivateLesson(studentId=:studentId, source='scheduled', status='scheduled')`
  - 通知学员
- Response data (201): PrivateLesson
- 错误：`404 COACH_STUDENT_NOT_FOUND` / `400 COACHING_INVALID_TIME`

#### GET /api/coach-students/:studentId/lessons
- Auth: Bearer + 教练
- Query: `status?`, `page?`, `pageSize?`
- Response data: `{ items: PrivateLesson[], total, page, pageSize }`

### 3.6 统一学员库（CoachStudent）

#### GET /api/coach-students
- Auth: Bearer + 教练
- Query: `tag?`, `search?`, `page?`, `pageSize?`
- 行为：列出当前教练的所有学员，附带每个学员的派生标签（如 `团课学员`、`私教学员`、`学员班:XX`）+ 自定义标签
- Response data:
  ```
  {
    items: [{
      studentId, nickname, avatarUrl, phoneLast4,
      firstMetAt, source,
      tags: string[],                 // 派生 + 自定义合并
      studentClasses: [{id, name}],   // 所属学员班
    }],
    total, page, pageSize
  }
  ```

#### GET /api/coach-students/:studentId
- Auth: Bearer + 教练
- Response data: 上述 item 字段 + `recentLessons` 数组（聚合 group-class / private-lesson / class-lesson 三类，最近 5 条，按时间倒序）
- 错误：`404 COACH_STUDENT_NOT_FOUND`

#### POST /api/coach-students
- Auth: Bearer + 教练
- Body: `{ studentId }`
- 行为：手动添加学员（source='manual'），幂等（已存在则返回当前记录，不覆盖 source）
- Response data (201): CoachStudent
- 错误：`404 USER_NOT_FOUND`（studentId 不存在）

#### POST /api/coach-students/search-by-phone
- Auth: Bearer + 教练
- Body: `{ phone: string }` (11 位手机号)
- 行为：根据手机号精确查找已注册用户
- Response data: 成功 → `{ userId, nickname, phoneLast4 }`
- 错误：`404 COACH_STUDENT_NOT_REGISTERED` — 手机号未注册

#### PUT /api/coach-students/:studentId/tags
- Auth: Bearer + 教练
- Body: `{ tags: string[] }`（覆盖式设置；空数组清空所有自定义标签）
- 行为：保存到 `StudentTag` 表，按 `(coachId, studentId, tag)` 唯一约束
- 派生标签（团课学员/私教学员/学员班:XX）不能通过此接口写入；若传入会被忽略
- "固定私教" 是普通字符串标签，遵循同一接口
- Response data: `{ tags: string[] }`（最终保存的自定义标签）

### 3.7 学员班（GB）

#### POST /api/student-classes
- Body: `{ name }`（2-30 字符）
- Response data (201): StudentClass

#### GET /api/student-classes
- Auth: Bearer + 教练
- Response data: `{ items: StudentClass[] }`（含 memberCount、lessonCount）

#### GET /api/student-classes/:id
- Auth: Bearer + 教练本人
- Response data: 班级详情 + members + lessons 摘要

#### PUT /api/student-classes/:id
- Body: `{ name }`

#### DELETE /api/student-classes/:id
- 行为：删除班级、成员、课程、笔记、标签关联（不删战绩）
- Cascade 由 schema 保证

#### POST /api/student-classes/:id/members
- Body: `{ studentId }`
- 错误：`409 COACHING_STUDENT_ALREADY_IN_CLASS`

#### DELETE /api/student-classes/:id/members/:studentId
- 通知该学员"被移出班级"

#### POST /api/student-classes/:id/lessons
- Body: `{ venueId?, startTime, endTime, trainingContent? }`
- 行为：创建 ClassLesson + 通知班内全部学员
- Response data (201): ClassLesson
- 错误：`400 COACHING_INVALID_TIME`

#### GET /api/student-classes/:id/lessons
- Query: `status?`, `page?`, `pageSize?`

#### GET /api/student-classes/:id/lessons/:lessonId
- Response data: 课程详情 + notes 摘要

#### PUT /api/student-classes/:id/lessons/:lessonId
- 仅 `status='scheduled'` 可改；修改后通知学员

#### POST /api/student-classes/:id/lessons/:lessonId/cancel
- `assertCancellable` 限制；通知学员

#### PUT /api/student-classes/:id/lessons/:lessonId/training-content
- Body: `{ trainingContent }`，任何状态下都可改

#### POST /api/student-classes/:id/lessons/:lessonId/notes
- Body: `{ content }` (1-500)
- Response data (201): LessonNote

#### GET /api/student-classes/:id/lessons/:lessonId/notes
- 仅教练可见

### 3.8 学员档案（班级内）

> 班级内的学员档案是统一学员库 §3.6 的子视图。标签和笔记都按 `(coachId, studentId)` 维度共享，与"我的学员"详情页是同一份数据。

#### POST /api/student-classes/:id/members/:studentId/notes
- Body: `{ content }`（1-500）
- Response data (201): StudentNote（带 studentClassId）

#### GET /api/student-classes/:id/members/:studentId/notes
- 班级维度的笔记列表（按 createdAt 倒序）

#### PUT /api/student-classes/:id/members/:studentId/tags
- Body: `{ tags: string[] }`（覆盖式）
- 与 `PUT /api/coach-students/:studentId/tags` 写同一份数据，仅入口不同

#### GET /api/student-classes/:id/members/:studentId/tags
- Response data: `{ tags: string[] }`

### 3.9 我的课程 / 教练私教视图

#### GET /api/users/:id/enrollments
- Auth: Bearer + 本人
- Query: `type?` (group-class | private-lesson | class-lesson | all), `status?`, `page?`, `pageSize?`
- 行为：聚合学员视角的 4 类课程
- Response data: `{ items: EnrollmentItem[], total, page, pageSize }`

#### GET /api/coaches/:id/private-lessons
- Auth: Bearer + 教练本人
- Query: `status?` (scheduled | in_progress | completed | cancelled | expired), `page?`, `pageSize?`
- 行为：教练视角的私教课列表
- Response data: `{ items: PrivateLesson[], total, page, pageSize }`

---

## 4. 业务规则

### 4.1 学员入库时机（CoachStudent）

| 触发场景 | 时机 | source 值 |
|---|---|---|
| 学员预约私教被消费（status → in_progress） | scheduler 状态流转 | `private-lesson` |
| 教练对学员排课的私教被消费 | 同上 | `private-lesson` |
| 学员报名团课开始上课 | scheduler 状态流转 | `group-class` |
| 学员班课程开始上课 | scheduler 状态流转 | `class-lesson` |
| 教练手动添加 | 实时 | `manual` |

**唯一性兜底**：所有入库都使用 `prisma.coachStudent.createMany({ data, skipDuplicates: true })`。`(coachId, studentId)` 唯一约束 + `skipDuplicates` 共同保证 source 字段只记首次。

**失败处理**：入库失败不阻塞 scheduler 状态流转；记录 `error` 日志后继续。

### 4.2 退课/取消禁止规则

统一在 service 层调用 `assertCancellable(status)` 守卫：

```ts
function assertCancellable(status: string, errorCode = 'COACHING_ALREADY_STARTED') {
  if (status === 'in_progress' || status === 'completed') {
    throw new AppError(409, errorCode, '课程已开始，不可退课/取消');
  }
}
```

适用接口：
- `POST /api/group-classes/:id/cancel-enrollment`（学员退团课）
- `POST /api/group-classes/:id/cancel`（教练取消团课）
- `POST /api/private-lessons/:id/cancel`（教练或学员取消私教，含教练排课）
- `POST /api/student-classes/:id/lessons/:lessonId/cancel`（教练取消班课）

注：`cancelled` 状态等价于 noop（接口可幂等返回成功），避免对已取消的课再报错。

### 4.3 "固定私教" = 标签

- 不再有专用 API。教练在学员详情页通过 `PUT /api/coach-students/:studentId/tags` 添加/去除字符串 `'固定私教'`
- 列表/筛选时通过 `GET /api/coach-students?tag=固定私教` 过滤
- 派生 vs 自定义标签：
  - 派生（不可写）：`团课学员`、`私教学员`、`学员班:XX`（聚合自历史课程和班级关系）
  - 自定义（可写）：包括 `固定私教` 在内的任意字符串

### 4.4 过期 slot 处理

- 每分钟 scheduler 把 `studentId IS NULL AND status='scheduled' AND startTime <= NOW()` 的 slot 标记为 `expired`
- 每日凌晨 scheduler 把 `status='expired' AND startTime < NOW() - 30 days` 的记录物理删除
- `GET /api/coaches/:id/availability` 始终过滤 `status='scheduled' AND startTime > NOW()`，所以学员看不到过期 slot

### 4.5 学员预约的事务 + 乐观锁

```ts
// repository.bookPrivateLesson
const result = await prisma.privateLesson.updateMany({
  where: { id: lessonId, studentId: null, status: 'scheduled' },
  data: { studentId: userId, source: 'booked', venueId },
});
if (result.count === 0) return null; // 被 race 抢走或已 expired
return prisma.privateLesson.findUnique({ where: { id: lessonId } });
```

service 层若拿到 `null` 抛 `409 COACHING_SLOT_ALREADY_BOOKED`。

### 4.6 教练资质审核与发课权限

- 用户 `isCoach=false` 时调用任何"教练能力"接口（发布团课、设置私教 slot、创建学员班、添加学员等）返回 `403 COACHING_COACH_ROLE_REQUIRED`
- 一期已存在的 `isCoach=true` 用户**自动视为已通过审核**，无需补提交申请
- 新申请通过后由 review handler 写 `User.isCoach = true`

---

## 5. 跨模块依赖

```
coaching → user                # UserService.getUserById/getUsersByIds/getUserByPhone
coaching → venue               # VenueService.getVenueById
coaching → notification        # NotificationService.create
```

被依赖：
- `match-record → coaching`：通过 `CoachingService.getGroupClassById/getPrivateLessonById` + `getParticipantIds(classId, type)` 校验战绩参与人
- `review → coaching`：通过 `getParticipantIds` 校验评价资格

依赖方向严格单向：coaching 不依赖 review/match-record。

---

## 6. 状态机

### 6.1 团课

```
open ──(满员)── full ──(取消报名)── open
 │                │
 │                └──(开始时间到)── in_progress ──(结束时间到)── completed
 │
 └──(开始时间到)── in_progress ──(结束时间到)── completed
 │
 └──(教练 cancel)── cancelled (终态)
```

### 6.2 私教课（统一）

```
slot 模式（studentId=null）：
  scheduled ──(过期未约)── expired ──(30天后)── 物理删除
  scheduled ──(被预约)──→ 跳到下面的 booked 分支

booked / scheduled 模式（studentId 非空）：
  scheduled ──(开始时间到)── in_progress ──(结束时间到)── completed
            └──(教练或学员 cancel)── cancelled (终态)
```

### 6.3 学员班课程（ClassLesson）

```
scheduled ──(开始时间到)── in_progress ──(结束时间到)── completed
          └──(教练 cancel)── cancelled (终态)
```

---

## 7. Scheduler（定时任务）

通过 `infra/scheduler.ts` 注册，由 `CoachingService.registerScheduledTasks()` 在 controller 工厂中初始化。

### 7.1 每分钟任务

伪代码：

```ts
// 1) 团课：open/full → in_progress；in_progress → completed
//    in_progress 时把所有 enrollment 写入 CoachStudent（source='group-class'）
// 2) 学员班课程：同样的状态流转 + 把班级成员写入 CoachStudent（source='class-lesson'）
// 3) 私教（slot）：未约 + 过期 → expired
// 4) 私教（已约）：scheduled → in_progress 时把学员写入 CoachStudent（source='private-lesson'）
//                  in_progress → completed
```

入库失败被 try/catch 包裹，仅记录 error，不影响状态流转。

### 7.2 每日凌晨任务

- 清理 30 天前的 `expired` 私教 slot（物理删除）
- 通知模块的 90 天过期清理由 notification 模块负责，与本模块无关

---

## 8. 错误码清单

| 错误码 | HTTP | 触发场景 |
|---|---|---|
| `COACHING_COACH_ROLE_REQUIRED` | 403 | 非教练调用教练能力接口 |
| `COACHING_NOT_A_COACH` | 404 | 查询的 user 不存在或非教练 |
| `COACHING_INVALID_SPECIALTY` | 400 | 教练 specialties 含非枚举值 |
| `COACHING_INVALID_TIME` | 400 | 时间字段不合法（开始>结束、过去时间） |
| `COACHING_VENUE_NOT_FOUND` | 404 | venueId 不存在 |
| `COACHING_VENUE_REQUIRED` | 400 | slot 设置了候选球馆但学员未选 |
| `COACHING_INVALID_VENUE_CHOICE` | 400 | 学员选的 venueId 不在候选列表 |
| `COACHING_CLASS_FULL` | 409 | 团课报名时已满员 |
| `COACHING_ALREADY_ENROLLED` | 409 | 学员已报名该团课 |
| `COACHING_CLASS_NOT_ENROLLABLE` | 409 | 团课不在 open 状态 |
| `COACHING_CLASS_NOT_MODIFIABLE` | 409 | 团课已开始或已结束 |
| `COACHING_ALREADY_STARTED` | 409 | 退课/取消时课程已 in_progress 或 completed |
| `COACHING_SLOT_TOO_SHORT` | 400 | 私教 slot 不足 1 小时 |
| `COACHING_SLOT_OVERLAP` | 409 | 同教练时段重叠 |
| `COACHING_SLOT_ALREADY_BOOKED` | 409 | slot 被并发预约或已被预约 |
| `COACHING_SLOT_EXPIRED` | 409 | 学员预约时 slot 已过期 |
| `COACHING_CANNOT_BOOK_OWN_LESSON` | 403 | 教练预约自己的 slot |
| `COACHING_LESSON_NOT_CANCELLABLE` | 409 | 私教课状态不允许取消 |
| `COACHING_NOT_LESSON_PARTICIPANT` | 403 | 非教练/学员调取私教详情 |
| `COACHING_PRIVATE_LESSON_NOT_FOUND` | 404 | private-lesson id 不存在 |
| `COACHING_NOTES_COACH_ONLY` | 403 | 学员调取笔记列表 |
| `COACHING_APPLICATION_PENDING` | 409 | 用户已有 pending 申请 |
| `COACHING_APPLICATION_ALREADY_REVIEWED` | 409 | 申请已审核完毕 |
| `COACHING_INVALID_CERTIFICATES` | 400 | 证书数量/格式不合法 |
| `COACHING_REJECT_REASON_REQUIRED` | 400 | 拒绝时未填原因（≥5 字符） |
| `COACH_STUDENT_NOT_FOUND` | 404 | 学员不在该教练的 CoachStudent 表中 |
| `COACH_STUDENT_NOT_REGISTERED` | 404 | 手机号查找的用户未注册 |
| `COACHING_STUDENT_ALREADY_IN_CLASS` | 409 | 班级成员重复添加 |

---

## 9. 已知限制 / 第二期承接

- 前端尚未切换到 `/api/coach-students/*` 与新 `/api/private-lessons/:id/book`；部分 web 页面仍调用旧名 `setAvailability`/`bookPrivateLesson`（命中相同路由，参数兼容）
- "我的学员" 列表页和详情页 UI 待第二期实现
- 派生标签的写入校验（接口实现选 ignore 而非 `400`，未来可在前端确认后改为严格 `400`）

---

## 10. 实现文件索引

- `server/modules/coaching/controller.ts` — Express 路由
- `server/modules/coaching/service.ts` — 业务逻辑
- `server/modules/coaching/repository.ts` — Prisma 数据访问
- `server/modules/coaching/types.ts` — 类型定义
- `server/modules/coaching/index.ts` — 模块对外导出
- `server/prisma/schema.prisma` — 数据模型（搜 `coaching`/`PrivateLesson`/`CoachStudent`/`StudentClass`/`StudentTag`/`StudentNote`/`LessonNote`/`CoachApplication`/`CoachProfile`）
