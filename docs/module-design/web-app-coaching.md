# Feature 详细设计: web-app — coaching

> 本文档描述 web-app 的 coaching feature 的页面细节。
> 整体架构（路由结构、共享层、类型定义）见 `web-app.md`。

## 1. Feature 概述

- **职责**: 教练浏览与筛选、教练主页查看（含评价和评分）、团课详情与报名/取消报名、私教空闲时间查看与预约、评价提交、教练课程管理（发布团课、设置私教时间、修改/取消团课、取消私教预约）、学员课程报名列表
- **包含页面**: 教练列表页（CoachListPage）、教练主页（CoachProfilePage）、团课详情页（GroupClassDetailPage）、私教预约页（PrivateLessonBookingPage）、我的课程管理页（MyCourseManagementPage）、我的课程报名页（MyEnrollmentListPage）
- **对应后端模块**: coaching（核心）、review（评分/评价）、venue（球馆搜索）、match-record（课程战绩列表）

---

## 2. 页面与路由

### CoachListPage 页面

**UI 原型**: `docs/prototypes/prototype-coach-list.png`

**路由**: `/coaches`

**功能**: 教练列表页，作为"找教练"入口。展示教练头像、昵称、擅长方向标签、评分、历史学员数。支持按擅长方向筛选。默认按评分排序（前端客户端排序）。点击教练卡片进入教练主页。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| coaches | `CoachListItem[]` | API（GET /api/coaches + POST /api/coaches/ratings 聚合） | 教练列表数据（已合并评分） |
| total | number | API | 教练总数 |
| specialtyFilter | `CoachSpecialty \| null` | 用户选择 | 擅长方向筛选，null 表示不限 |
| isLoading | boolean | API 请求状态 | 列表加载中 |
| error | string \| null | API 响应 | 加载错误信息 |

> 注：教练列表排序在前端完成。获取教练列表和评分数据后，按 averageRating 降序排列（null 排最后）。分页由 useInfiniteQuery 内部管理。

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/coaches` | 页面加载、筛选条件变化、滚动加载更多 | 获取教练基本信息列表 | 显示 PageError 组件 |
| `POST /api/coaches/ratings` | 教练列表加载成功后，传入当前页所有 coachId | 将评分数据合并到对应教练列表项 | 静默失败，评分显示"暂无评价" |

**交互流程**:

```
用户进入 /coaches → 并行加载教练列表（GET /api/coaches）
  → 教练列表返回后 → 提取所有 coachId → 批量查询评分（POST /api/coaches/ratings）
  → 两个请求均完成 → 按 coachId 匹配合并 averageRating 和 totalCount
  → 按评分降序排列（null 排最后）→ 渲染教练卡片列表

筛选操作:
  擅长方向筛选 → 点击筛选按钮 → 弹出标签选择面板（单打/双打/步法/体能/战术/全部）
  → 选择后关闭面板 → useInfiniteQuery 重置，从第一页重新加载

查看教练:
  点击教练卡片 → 跳转到 /coaches/:id

下拉刷新:
  下拉触发 → 重新加载当前筛选条件的第一页数据

上拉加载更多:
  滚动到底部 → 加载下一页教练列表 → 批量查询新一页的评分 → 合并到列表中
```

**组件结构**:

```
CoachListPage
├── SpecialtyFilter              # 擅长方向筛选栏
│   └── SpecialtyTag             # 单个擅长方向标签（可选中/取消）
├── CoachCardList                # 教练卡片列表
│   └── CoachCard                # 单个教练卡片（头像、昵称、擅长方向标签、评分、学员数）
├── EmptyState                   # 无教练时的空状态（共享组件）
└── LoadingSpinner               # 加载中状态（共享组件）
```

---

### CoachProfilePage 页面

**UI 原型**: `docs/prototypes/prototype-coach-profile.png`

**路由**: `/coaches/:id`

**功能**: 教练主页，展示教练完整信息：基本资料（头像、昵称、简介、擅长方向）、评分与评价数量、历史学员数、团课列表、私教空闲时间概览、评价列表。提供报名团课入口（点击团课进入详情页）、预约私教入口（跳转到私教预约页）、提交评价入口。评分和评价数据由前端聚合（分别调用 review 模块的接口）。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| coach | `CoachProfile \| null` | API（GET /api/coaches/:id） | 教练主页数据（含团课列表和私教时间概览） |
| rating | `CoachRating \| null` | API（GET /api/coaches/:id/rating） | 教练评分数据 |
| reviews | `Review[]` | API（GET /api/coaches/:id/reviews） | 评价列表数据 |
| reviewsTotal | number | API | 评价总数 |
| reviewsPage | number | 分页状态 | 当前评价列表页码 |
| isCoachLoading | boolean | API 请求状态 | 教练数据加载中 |
| isRatingLoading | boolean | API 请求状态 | 评分数据加载中 |
| isReviewsLoading | boolean | API 请求状态 | 评价列表加载中 |
| error | string \| null | API 响应 | 教练数据加载错误 |
| showReviewModal | boolean | 用户操作 | 是否显示提交评价弹窗 |
| activeTab | `'courses' \| 'reviews'` | 用户操作 | 当前激活的 Tab（课程 / 评价），默认 'courses' |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/coaches/:id` | 页面加载 | 渲染教练资料、团课列表、私教时间概览 | 显示 PageError 组件（404 时提示"教练不存在"） |
| `GET /api/coaches/:id/rating` | 页面加载（与教练数据并行） | 渲染评分区域（星级 + 数字 + 评价数量） | 静默失败，显示"暂无评价" |
| `GET /api/coaches/:id/reviews` | 页面加载（评价 Tab 首次显示时）或切换到评价 Tab | 渲染评价列表 | 显示评价列表加载错误提示 |
| `POST /api/reviews` | 用户在评价弹窗中提交评价 | message.success "评价提交成功"，关闭弹窗，刷新评价列表和评分 | 根据错误码显示对应提示（见下方错误处理表） |

**提交评价错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| REVIEW_COACH_NOT_FOUND | "教练不存在" |
| REVIEW_COURSE_NOT_FOUND | "课程不存在" |
| REVIEW_COURSE_NOT_COMPLETED | "课程尚未结束，暂不可评价" |
| REVIEW_NOT_PARTICIPANT | "仅参加过该课程的学员可以评价" |
| REVIEW_CANNOT_REVIEW_SELF | "不能评价自己" |
| REVIEW_DUPLICATE | "你已经评价过此课程" |
| REVIEW_COURSE_COACH_MISMATCH | "课程与教练不匹配" |

**交互流程**:

```
用户进入 /coaches/:id
  → 并行请求：GET /api/coaches/:id + GET /api/coaches/:id/rating
  → 教练数据返回 → 渲染教练基本资料、课程 Tab（团课列表 + 私教时间概览）
  → 评分数据返回 → 渲染评分区域

Tab 切换:
  点击"课程" Tab → 显示团课列表和私教时间概览
  点击"评价" Tab → 首次切换时加载评价列表（GET /api/coaches/:id/reviews）→ 渲染评价列表

查看团课详情:
  点击团课卡片 → 跳转到 /group-classes/:id

预约私教:
  点击"预约私教"按钮 → 跳转到 /coaches/:id/private-lessons

提交评价:
  点击"写评价"按钮
  → 检查用户是否有已结束的课程（前端从教练主页的团课列表中找 status=completed 的课程，或展示课程选择下拉框）
  → 弹出评价弹窗 → 选择课程（下拉选择已结束的团课或私教课）→ 选择评分（1-5星）→ 输入评价文字（可选）→ 提交
  → 成功 → message.success → 关闭弹窗 → 刷新评价列表和评分数据

评价列表分页:
  滚动加载更多评价（useInfiniteScroll）
```

**组件结构**:

```
CoachProfilePage
├── CoachInfoHeader              # 教练基本信息区域（头像、昵称、简介）
│   ├── UserAvatar               # 用户头像（共享组件）
│   ├── SpecialtyTagList         # 擅长方向标签列表
│   └── CoachStats               # 教练统计（评分、学员数）
│       ├── RatingDisplay        # 评分展示（星级 + 数值 + 评价数量，或"暂无评价"）
│       └── StudentCountDisplay  # 历史学员数展示
├── Tabs                         # 课程 / 评价 Tab 切换（Ant Design Tabs）
│   ├── CoursesTab               # 课程 Tab 内容
│   │   ├── GroupClassSection    # 团课列表区域
│   │   │   └── GroupClassCard   # 单个团课卡片（标题、时间、球馆、人数、费用、状态）
│   │   └── PrivateLessonSection # 私教概览区域（可用时间段数量 + "预约私教"按钮）
│   └── ReviewsTab               # 评价 Tab 内容
│       ├── ReviewList           # 评价列表
│       │   └── ReviewItem       # 单条评价（评价者头像昵称、评分、文字、时间）
│       └── WriteReviewButton    # "写评价"按钮
├── ReviewModal                  # 提交评价弹窗
│   ├── CourseSelector           # 课程选择下拉框（列出用户参加过的已结束课程）
│   ├── RatingInput              # 评分输入（5 星选择）
│   └── CommentInput             # 评价文字输入（可选，最多 500 字）
└── LoadingSpinner               # 加载中状态（共享组件）
```

---

### GroupClassDetailPage 页面

**UI 原型**: `docs/prototypes/prototype-group-class-detail.png`

**路由**: `/group-classes/:id`

**功能**: 团课详情页，展示团课完整信息（课程名称、教练信息、球馆、时间、费用说明、状态、已报名人数/限定人数）和报名学员列表。根据当前用户身份和团课状态，提供报名/取消报名操作。已结束的团课可查看战绩列表并进入战绩录入页。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| groupClass | `GroupClassDetail \| null` | API（GET /api/group-classes/:id） | 团课详情数据（含报名学员列表） |
| matchRecords | `MatchRecord[]` | API（GET /api/group-classes/:id/match-records） | 团课战绩列表（仅 status=completed 时加载） |
| isLoading | boolean | API 请求状态 | 团课数据加载中 |
| isMatchRecordsLoading | boolean | API 请求状态 | 战绩列表加载中 |
| error | string \| null | API 响应 | 加载错误信息 |
| enrolling | boolean | API 请求状态 | 报名请求进行中 |
| cancellingEnrollment | boolean | API 请求状态 | 取消报名请求进行中 |
| showCancelEnrollConfirm | boolean | 用户操作 | 是否显示取消报名确认弹窗 |
| showDeleteConfirm | boolean | 用户操作 | 是否显示删除战绩确认弹窗 |
| deletingRecordId | string \| null | 用户操作 | 当前待删除的战绩 ID |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/group-classes/:id` | 页面加载 | 渲染团课详情和报名学员列表 | 显示 PageError 组件（404 时提示"团课不存在"） |
| `POST /api/group-classes/:id/enroll` | 用户点击"报名"按钮 | message.success "报名成功"，刷新团课详情 | 根据错误码显示对应提示（见下方错误处理表） |
| `POST /api/group-classes/:id/cancel-enrollment` | 用户确认取消报名 | message.success "已取消报名"，刷新团课详情 | 根据错误码显示对应提示 |
| `GET /api/group-classes/:id/match-records` | 团课状态为 completed 时页面加载 | 渲染战绩列表 | message.error "战绩加载失败" |
| `DELETE /api/match-records/:id` | 用户确认删除战绩 | message.success "战绩已删除"，刷新战绩列表 | message.error 显示错误信息 |

**报名错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| COACHING_GROUP_CLASS_NOT_FOUND | "团课不存在" |
| COACHING_CLASS_FULL | "团课已满员" |
| COACHING_ALREADY_ENROLLED | "你已报名该团课" |
| COACHING_CLASS_NOT_ENROLLABLE | "团课当前状态不可报名" |
| COACHING_CANNOT_ENROLL_OWN_CLASS | "教练不可报名自己的团课" |

**取消报名错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| COACHING_GROUP_CLASS_NOT_FOUND | "团课不存在" |
| COACHING_NOT_ENROLLED | "你未报名该团课" |
| COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT | "团课当前状态不可取消报名" |

**交互流程**:

```
用户进入 /group-classes/:id → 加载团课详情（GET /api/group-classes/:id）→ 渲染团课信息和报名学员列表

操作按钮逻辑（根据用户身份和团课状态动态展示）:
  当前用户是教练本人 → 不显示报名/取消报名按钮（教练通过"我的课程管理"页管理）
  团课状态 open 且用户未报名 → 显示"报名"按钮
  团课状态 open/full 且用户已报名 → 显示"取消报名"按钮
  团课状态 full 且用户未报名 → 显示"已满员"按钮（灰色不可点击）
  团课状态 in_progress → 显示"进行中"状态标签，无操作按钮
  团课状态 completed → 显示"已结束"状态标签 + "录入战绩"按钮（跳转到战绩录入页）
  团课状态 cancelled → 显示"已取消"状态标签，无操作按钮

报名:
  点击"报名"按钮 → 调用 POST /api/group-classes/:id/enroll → 成功 → 刷新团课详情

取消报名:
  点击"取消报名"按钮 → 弹出确认弹窗（ConfirmDialog）→ 用户确认 → 调用 POST /api/group-classes/:id/cancel-enrollment → 成功 → 刷新团课详情

战绩查看（仅 completed 状态）:
  团课状态为 completed → 自动加载战绩列表（GET /api/group-classes/:id/match-records）→ 渲染战绩列表
  录入者可删除自己录入的战绩（需确认弹窗）

录入战绩:
  点击"录入战绩"按钮 → 跳转到 /match-records/create?sourceType=group-class&sourceId={id}

查看教练主页:
  点击教练头像/昵称 → 跳转到 /coaches/:coachId
```

**组件结构**:

```
GroupClassDetailPage
├── GroupClassInfo                # 团课基本信息区域
│   ├── CoachBrief               # 教练简要信息（头像、昵称，可点击跳转）
│   ├── StatusTag                # 团课状态标签（共享组件）
│   ├── ClassDetailFields        # 详情字段（课程名称、球馆、时间、费用说明、人数）
│   └── ActionButton             # 操作按钮区域（报名/取消报名/已满员/录入战绩）
├── EnrollmentList               # 报名学员列表
│   └── EnrollmentItem           # 单个学员（头像、昵称、报名时间）
├── MatchRecordSection           # 战绩区域（仅 completed 状态显示）
│   ├── MatchRecordList          # 战绩列表
│   │   └── MatchRecordCard      # 单条战绩卡片（同 activity feature 复用样式）
│   └── CreateRecordButton       # "录入战绩"按钮
├── ConfirmDialog                # 取消报名确认弹窗（共享组件）
├── ConfirmDialog                # 删除战绩确认弹窗（共享组件）
└── LoadingSpinner               # 加载中状态（共享组件）
```

---

### PrivateLessonBookingPage 页面

**UI 原型**: 本页面暂无 UI 原型

**路由**: `/coaches/:id/private-lessons`

**功能**: 私教预约页，展示指定教练的可预约空闲时间段列表。每个时间段显示日期、时间范围、可选球馆、费用说明、预约状态。学员选择未预约的时间段，若教练设置了可选球馆则须选择一个上课地点，确认后完成预约。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| coachNickname | string | API 或路由参数 | 教练昵称（从上一页带入或从教练数据获取） |
| slots | `PrivateLessonSlot[]` | API（GET /api/coaches/:id/availability） | 空闲时间段列表 |
| startDate | string | 用户选择 | 查询起始日期（默认今天） |
| endDate | string | 用户选择 | 查询结束日期（默认起始日期 + 14 天） |
| isLoading | boolean | API 请求状态 | 时间段加载中 |
| error | string \| null | API 响应 | 加载错误信息 |
| selectedSlot | `PrivateLessonSlot \| null` | 用户选择 | 当前选中的时间段 |
| selectedVenueId | string \| null | 用户选择 | 选中的上课球馆 ID（当时间段有可选球馆时） |
| booking | boolean | API 请求状态 | 预约请求进行中 |
| showBookingConfirm | boolean | 用户操作 | 是否显示预约确认弹窗 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/coaches/:id/availability` | 页面加载、日期范围变化 | 渲染空闲时间段列表 | 显示 PageError 组件（404 时提示"教练不存在"） |
| `POST /api/private-lessons/book` | 用户确认预约 | message.success "预约成功"，刷新时间段列表 | 根据错误码显示对应提示（见下方错误处理表） |

**预约错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| COACHING_SLOT_NOT_FOUND | "时间段不存在" |
| COACHING_SLOT_ALREADY_BOOKED | "该时间段已被预约" |
| COACHING_SLOT_EXPIRED | "该时间段已过期" |
| COACHING_VENUE_REQUIRED | "请选择上课地点" |
| COACHING_INVALID_VENUE_CHOICE | "选择的球馆不在可选范围内" |
| COACHING_VENUE_NOT_FOUND | "球馆不存在" |
| COACHING_CANNOT_BOOK_OWN_LESSON | "不能预约自己的私教课" |

**交互流程**:

```
用户进入 /coaches/:id/private-lessons → 加载空闲时间段（GET /api/coaches/:id/availability）
  → 渲染按日期分组的时间段列表

日期范围切换:
  点击日期选择器 → 修改 startDate/endDate → 重新加载时间段列表

选择时间段:
  点击某个未预约的时间段卡片 → 设置 selectedSlot
  → 若该时间段有可选球馆（venues.length > 0）→ 展开球馆选择区域
  → 若该时间段无可选球馆（venues.length === 0，不限地点）→ 直接显示"确认预约"按钮

选择球馆（当时间段有可选球馆时）:
  从可选球馆列表中选择一个 → 设置 selectedVenueId

确认预约:
  点击"确认预约"按钮 → 弹出确认弹窗（显示时间、球馆、费用说明）
  → 用户确认 → 调用 POST /api/private-lessons/book { slotId, venueId }
  → 成功 → message.success → 刷新时间段列表（该时间段变为"已约"）

已预约时间段:
  isBooked = true 的时间段 → 显示"已约"标签，不可点击

返回:
  点击顶部返回按钮 → 返回教练主页（/coaches/:id）
```

**组件结构**:

```
PrivateLessonBookingPage
├── CoachBriefHeader             # 页面顶部教练简要信息
├── DateRangePicker              # 日期范围选择器
├── SlotList                     # 按日期分组的时间段列表
│   ├── DayGroup                 # 单日分组（日期标题 + 该日的时间段列表）
│   │   └── SlotCard             # 单个时间段卡片
│   │       ├── TimeRange        # 时间范围显示
│   │       ├── VenueList        # 可选球馆列表（若有）
│   │       ├── FeeDescription   # 费用说明
│   │       └── StatusTag        # 预约状态标签（可预约 / 已约）（共享组件）
├── VenueSelector                # 球馆选择区域（选中时间段后展示，若该时间段有可选球馆）
├── BookingConfirmDialog         # 预约确认弹窗（时间、球馆、费用说明汇总）
├── EmptyState                   # 无可预约时间段时的空状态（共享组件）
└── LoadingSpinner               # 加载中状态（共享组件）
```

---

### MyCourseManagementPage 页面

**UI 原型**: `docs/prototypes/prototype-private-lesson-schedule.png`（私教时间设置部分）

**路由**: `/my-courses`

**功能**: 教练的课程管理页面（需教练角色）。页面分为三个 Tab：团课管理、私教时间设置、私教预约管理。团课管理展示教练发布的所有团课，支持发布新团课、修改团课、取消团课。私教时间设置展示教练设置的空闲时间段，支持添加新时间段。私教预约管理展示已预约的私教课列表，支持取消预约。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| activeTab | `'group-classes' \| 'private-schedule' \| 'private-lessons'` | 用户操作 | 当前激活的 Tab，默认 'group-classes' |
| coachProfile | `CoachProfile \| null` | API（GET /api/coaches/:id，id 为当前用户） | 教练数据（含团课列表和私教时间概览） |
| isLoading | boolean | API 请求状态 | 数据加载中 |
| error | string \| null | API 响应 | 加载错误信息 |
| showCreateClassModal | boolean | 用户操作 | 是否显示发布团课弹窗 |
| showEditClassModal | boolean | 用户操作 | 是否显示修改团课弹窗 |
| editingClassId | string \| null | 用户操作 | 当前编辑的团课 ID |
| showCancelClassConfirm | boolean | 用户操作 | 是否显示取消团课确认弹窗 |
| cancellingClassId | string \| null | 用户操作 | 当前待取消的团课 ID |
| showAddSlotModal | boolean | 用户操作 | 是否显示添加私教时间弹窗 |
| showCancelLessonConfirm | boolean | 用户操作 | 是否显示取消私教预约确认弹窗 |
| cancellingLessonId | string \| null | 用户操作 | 当前待取消的私教课 ID |
| privateLessons | `CoachPrivateLesson[]` | API（GET /api/coaches/:id/private-lessons） | 教练视角的私教预约列表 |
| availability | `PrivateLessonSlot[]` | API（GET /api/coaches/:id/availability） | 教练的空闲时间段列表 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/coaches/:id` (id=当前用户) | 页面加载 | 渲染教练团课列表 | 显示 PageError 组件 |
| `GET /api/coaches/:id/availability` (id=当前用户) | 切换到"私教时间"Tab | 渲染空闲时间段列表 | message.error "加载失败" |
| `POST /api/group-classes` | 用户在发布团课弹窗中提交 | message.success "团课发布成功"，关闭弹窗，刷新教练数据 | 根据错误码显示对应提示（见下方） |
| `PUT /api/group-classes/:id` | 用户在修改团课弹窗中提交 | message.success "团课已更新"，关闭弹窗，刷新教练数据 | 根据错误码显示对应提示 |
| `POST /api/group-classes/:id/cancel` | 用户确认取消团课 | message.success "团课已取消"，刷新教练数据 | 根据错误码显示对应提示 |
| `POST /api/private-lessons/availability` | 用户在添加私教时间弹窗中提交 | message.success "私教时间已添加"，关闭弹窗，刷新时间段列表 | 根据错误码显示对应提示 |
| `GET /api/coaches/:id/private-lessons` (id=当前用户) | 切换到"私教预约"Tab | 渲染私教预约列表 | message.error "加载失败" |
| `POST /api/private-lessons/:id/cancel` | 用户确认取消私教预约 | message.success "私教预约已取消"，刷新数据 | 根据错误码显示对应提示 |
| `GET /api/venues/search` | 发布/修改团课、添加私教时间时选择球馆 | 下拉展示匹配球馆 | message.error "球馆搜索失败" |

**发布/修改团课错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| COACHING_COACH_ROLE_REQUIRED | "请先开启教练角色" |
| COACHING_INVALID_TITLE | "课程名称不能为空且不超过 50 字" |
| COACHING_INVALID_VENUE | "请选择球馆" |
| COACHING_VENUE_NOT_FOUND | "球馆不存在，请重新选择" |
| COACHING_INVALID_TIME | "开始时间必须晚于当前时间，结束时间必须晚于开始时间" |
| COACHING_INVALID_PARTICIPANTS | "限定人数需在 2-30 之间" |
| COACHING_INVALID_FEE_DESCRIPTION | "费用说明不超过 200 字" |
| COACHING_PARTICIPANTS_EXCEED | "限定人数不能小于当前报名人数" |
| COACHING_NOT_COACH_OWNER | "无权修改此团课" |
| COACHING_CLASS_NOT_MODIFIABLE | "团课当前状态不可修改" |

**取消团课错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| COACHING_NOT_COACH_OWNER | "无权取消此团课" |
| COACHING_GROUP_CLASS_NOT_FOUND | "团课不存在" |
| COACHING_CLASS_NOT_CANCELLABLE | "团课当前状态不可取消" |

**添加私教时间错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| COACHING_COACH_ROLE_REQUIRED | "请先开启教练角色" |
| COACHING_INVALID_SLOTS | "请添加至少一个时间段" |
| COACHING_INVALID_SLOT_TIME | "时间设置有误：开始时间必须晚于当前时间，结束时间必须晚于开始时间" |
| COACHING_SLOT_TOO_SHORT | "时间段至少为 1 小时" |
| COACHING_INVALID_FEE_DESCRIPTION | "费用说明不超过 200 字" |
| COACHING_VENUE_NOT_FOUND | "选择的球馆不存在" |
| COACHING_SLOT_OVERLAP | "时间段与已有时间段重叠" |

**取消私教预约错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| COACHING_PRIVATE_LESSON_NOT_FOUND | "私教课不存在" |
| COACHING_NOT_LESSON_PARTICIPANT | "无权取消此私教课" |
| COACHING_LESSON_NOT_CANCELLABLE | "私教课当前状态不可取消" |

**交互流程**:

```
用户进入 /my-courses → CoachGuard 校验教练角色
  → 非教练 → 提示并引导至 /settings 开启教练角色
  → 是教练 → 加载教练数据（GET /api/coaches/:id）→ 渲染团课管理 Tab

== 团课管理 Tab ==
发布团课:
  点击"发布团课"按钮 → 弹出发布团课表单弹窗
  → 填写课程名称、选择球馆（VenueSearchInput）、选择开始/结束时间、设置限定人数、填写费用说明（可选）
  → 前端校验 → 提交 POST /api/group-classes → 成功 → 刷新团课列表

修改团课:
  点击某团课的"修改"按钮（仅 open/full 状态的团课显示）
  → 弹出修改表单弹窗（预填当前值）→ 修改字段 → 提交 PUT /api/group-classes/:id → 成功 → 刷新团课列表

取消团课:
  点击某团课的"取消"按钮（仅 open/full 状态的团课显示）
  → 弹出确认弹窗（ConfirmDialog）→ 确认 → POST /api/group-classes/:id/cancel → 成功 → 刷新团课列表

查看团课详情:
  点击团课卡片 → 跳转到 /group-classes/:id

== 私教时间设置 Tab ==
切换到此 Tab → 加载空闲时间段（GET /api/coaches/:id/availability）→ 渲染时间段列表

添加私教时间:
  点击"添加时间段"按钮 → 弹出添加私教时间弹窗
  → 选择开始时间、结束时间、可选球馆（VenueSearchInput，可多选）、费用说明（可选）
  → 支持批量添加（表单中可添加多个时间段）
  → 前端校验 → 提交 POST /api/private-lessons/availability → 成功 → 刷新时间段列表

== 私教预约管理 Tab ==
切换到此 Tab → 加载教练的私教课列表（GET /api/coaches/:id/private-lessons，id 为当前用户）
→ 渲染私教预约列表（学员昵称、时间、球馆、状态）

取消私教预约:
  点击某私教课的"取消"按钮（仅 scheduled 状态的私教课显示）
  → 弹出确认弹窗 → 确认 → POST /api/private-lessons/:id/cancel → 成功 → 刷新列表
```

**组件结构**:

```
MyCourseManagementPage（CoachGuard 包裹）
├── Tabs                           # Tab 切换（团课管理 / 私教时间 / 私教预约）
│   ├── GroupClassManagementTab    # 团课管理 Tab
│   │   ├── CreateClassButton     # "发布团课"按钮
│   │   ├── GroupClassList        # 教练发布的团课列表
│   │   │   └── ManageableGroupClassCard  # 可管理的团课卡片（含修改/取消按钮）
│   │   └── EmptyState            # 无团课时的空状态（共享组件）
│   ├── PrivateScheduleTab         # 私教时间设置 Tab
│   │   ├── AddSlotButton         # "添加时间段"按钮
│   │   ├── SlotList              # 空闲时间段列表（按日期分组）
│   │   │   └── ManageableSlotCard  # 可管理的时间段卡片（显示预约状态）
│   │   └── EmptyState            # 无时间段时的空状态（共享组件）
│   └── PrivateLessonTab           # 私教预约管理 Tab
│       ├── PrivateLessonList     # 私教预约列表
│       │   └── PrivateLessonCard # 私教课卡片（学员、时间、球馆、状态、取消按钮）
│       └── EmptyState            # 无预约时的空状态（共享组件）
├── CreateGroupClassModal          # 发布团课弹窗
│   ├── TitleInput                # 课程名称输入
│   ├── VenueSearchInput          # 球馆搜索选择（共享组件）
│   ├── DateTimePicker            # 开始/结束时间选择器
│   ├── ParticipantStepper        # 限定人数设置
│   └── FeeDescriptionInput       # 费用说明输入（可选）
├── EditGroupClassModal            # 修改团课弹窗（与创建弹窗结构类似，预填当前值）
├── AddSlotModal                   # 添加私教时间段弹窗
│   ├── SlotFormList              # 时间段表单列表（支持批量添加多个）
│   │   └── SlotFormItem          # 单个时间段表单（开始时间、结束时间、可选球馆、费用说明）
│   │       └── VenueSearchInput  # 球馆搜索选择（共享组件，可多选模式）
│   └── AddMoreSlotButton        # "再添加一个时间段"按钮
├── ConfirmDialog                  # 取消团课确认弹窗（共享组件）
└── ConfirmDialog                  # 取消私教确认弹窗（共享组件）
```

---

### MyEnrollmentListPage 页面

**路由**: `/my-enrollments`

**功能**: 学员视角的课程报名列表页。展示当前用户报名的团课和预约的私教课。支持按类型（团课/私教）和状态筛选。列表按课程开始时间倒序排列。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| enrollments | `EnrollmentListItem[]` | API（GET /api/users/:id/enrollments） | 课程报名列表 |
| total | number | API | 记录总数 |
| typeFilter | `'group-class' \| 'private-lesson' \| null` | 用户选择 | 类型筛选，null 表示全部 |
| statusFilter | `string \| null` | 用户选择 | 状态筛选，null 表示全部 |
| isLoading | boolean | API 请求状态 | 列表加载中 |
| error | string \| null | API 响应 | 加载错误信息 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/users/:id/enrollments` | 页面加载、筛选条件变化、滚动加载更多 | 渲染课程报名列表 | 显示 PageError 组件 |

**交互流程**:

```
用户进入 /my-enrollments → 加载课程报名列表（GET /api/users/:id/enrollments，使用当前用户 ID 替换 :id）→ 渲染列表

筛选操作:
  类型筛选 → 选择"全部/团课/私教" → 重新加载列表（传入 type 参数）
  状态筛选 → 选择"全部/进行中/已结束/已取消" → 重新加载列表（传入 status 参数）
    映射关系:
      "全部"   → 不传 status 参数（返回所有状态的记录，包括 open/full/scheduled 等）
      "进行中" → status=in_progress
      "已结束" → status=completed
      "已取消" → status=cancelled
    说明: open/full/scheduled 状态的课程仅在"全部"筛选中可见，不单独提供筛选选项

查看课程详情:
  点击团课报名项 → 跳转到 /group-classes/:id
  点击私教报名项 → 跳转到 /coaches/:coachId（教练主页）

上拉加载更多:
  滚动到底部 → 加载下一页（useInfiniteScroll）
```

**组件结构**:

```
MyEnrollmentListPage
├── EnrollmentFilterBar            # 筛选栏
│   ├── TypeFilter                # 类型筛选（全部/团课/私教）
│   └── StatusFilter              # 状态筛选（全部/进行中/已结束/已取消）
├── EnrollmentCardList            # 课程报名卡片列表
│   └── EnrollmentCard            # 单个报名卡片（课程类型图标、课程名称/时间、教练昵称、球馆、状态标签）
├── EmptyState                    # 无报名记录时的空状态（共享组件）
└── LoadingSpinner                # 加载中状态（共享组件）
```

---

## 3. Feature 私有组件

| 组件 | 用途 | 使用页面 |
|------|------|---------|
| CoachCard | 教练卡片（头像、昵称、擅长方向标签、评分、学员数），点击可跳转到教练主页 | CoachListPage |
| SpecialtyFilter | 擅长方向筛选栏（单打/双打/步法/体能/战术/全部），支持单选 | CoachListPage |
| SpecialtyTag | 擅长方向标签展示（彩色标签），不可操作 | CoachCard, CoachInfoHeader |
| SpecialtyTagList | 擅长方向标签列表，水平排列 | CoachCard, CoachInfoHeader |
| CoachInfoHeader | 教练主页顶部信息区域（头像、昵称、简介、标签、统计数据） | CoachProfilePage |
| CoachStats | 教练统计信息展示（评分 + 学员数） | CoachInfoHeader |
| RatingDisplay | 评分展示组件（星级图标 + 数值 + 评价数量），null 时显示"暂无评价" | CoachStats, CoachCard |
| StudentCountDisplay | 历史学员数展示 | CoachStats |
| GroupClassCard | 团课卡片（标题、时间、球馆、人数、费用、状态），用于教练主页课程列表 | CoachProfilePage |
| ManageableGroupClassCard | 可管理的团课卡片（继承 GroupClassCard，增加修改/取消按钮） | MyCourseManagementPage |
| CoachBrief | 教练简要信息（头像 + 昵称，可点击跳转） | GroupClassDetailPage |
| EnrollmentList | 报名学员列表 | GroupClassDetailPage |
| EnrollmentItem | 单个报名学员（头像、昵称、报名时间） | EnrollmentList |
| ReviewList | 评价列表 | CoachProfilePage |
| ReviewItem | 单条评价展示（评价者头像昵称、星级评分、文字、时间） | ReviewList |
| ReviewModal | 提交评价弹窗（课程选择、评分输入、文字输入） | CoachProfilePage |
| CourseSelector | 课程选择下拉框（列出用户参加过的已结束课程） | ReviewModal |
| RatingInput | 评分输入组件（5 星选择，支持点击设置分值） | ReviewModal |
| SlotCard | 私教时间段卡片（时间范围、球馆、费用、预约状态） | PrivateLessonBookingPage |
| ManageableSlotCard | 可管理的时间段卡片（显示预约状态，已预约的显示学员信息） | MyCourseManagementPage |
| DayGroup | 按日期分组的容器（日期标题 + 时间段列表） | PrivateLessonBookingPage, MyCourseManagementPage |
| VenueSelector | 球馆选择区域（从时间段的可选球馆中选择一个） | PrivateLessonBookingPage |
| BookingConfirmDialog | 预约确认弹窗（汇总时间、球馆、费用说明） | PrivateLessonBookingPage |
| CreateGroupClassModal | 发布团课表单弹窗 | MyCourseManagementPage |
| EditGroupClassModal | 修改团课表单弹窗（预填当前值） | MyCourseManagementPage |
| AddSlotModal | 添加私教时间段弹窗（支持批量添加多个时间段） | MyCourseManagementPage |
| SlotFormItem | 单个时间段表单组件（开始时间、结束时间、球馆选择、费用说明） | AddSlotModal |
| PrivateLessonCard | 私教课卡片（学员昵称、时间、球馆、状态、取消按钮） | MyCourseManagementPage |
| EnrollmentCard | 课程报名卡片（课程类型图标、课程名/时间、教练、球馆、状态） | MyEnrollmentListPage |
| EnrollmentFilterBar | 课程报名筛选栏（类型 + 状态） | MyEnrollmentListPage |
| MatchRecordSection | 战绩区域组件（战绩列表 + 录入战绩按钮，仅 completed 状态显示） | GroupClassDetailPage |

## 4. Feature 私有 Hooks

| Hook | 用途 | 使用页面 |
|------|------|---------|
| useCoachList | 获取教练列表（useInfiniteQuery 封装 GET /api/coaches），支持 specialty 筛选参数 | CoachListPage |
| useCoachRatings | 批量获取教练评分（useMutation 封装 POST /api/coaches/ratings），在教练列表加载成功后调用并合并到列表数据 | CoachListPage |
| useCoachProfile | 获取教练主页数据（useQuery 封装 GET /api/coaches/:id） | CoachProfilePage |
| useCoachRating | 获取单个教练评分（useQuery 封装 GET /api/coaches/:id/rating） | CoachProfilePage |
| useCoachReviews | 获取教练评价列表（useInfiniteQuery 封装 GET /api/coaches/:id/reviews） | CoachProfilePage |
| useSubmitReview | 提交评价（useMutation 封装 POST /api/reviews），成功后使评价列表和评分查询缓存失效 | CoachProfilePage |
| useGroupClassDetail | 获取团课详情（useQuery 封装 GET /api/group-classes/:id） | GroupClassDetailPage |
| useEnrollGroupClass | 报名团课（useMutation 封装 POST /api/group-classes/:id/enroll），成功后使团课详情缓存失效 | GroupClassDetailPage |
| useCancelEnrollment | 取消团课报名（useMutation 封装 POST /api/group-classes/:id/cancel-enrollment），成功后使团课详情缓存失效 | GroupClassDetailPage |
| useGroupClassMatchRecords | 获取团课战绩列表（useQuery 封装 GET /api/group-classes/:id/match-records），仅 completed 状态时 enabled | GroupClassDetailPage |
| useCoachAvailability | 获取教练空闲时间（useQuery 封装 GET /api/coaches/:id/availability），支持 startDate/endDate 参数 | PrivateLessonBookingPage, MyCourseManagementPage |
| useBookPrivateLesson | 预约私教课（useMutation 封装 POST /api/private-lessons/book），成功后使空闲时间缓存失效 | PrivateLessonBookingPage |
| useCreateGroupClass | 发布团课（useMutation 封装 POST /api/group-classes），成功后使教练主页缓存失效 | MyCourseManagementPage |
| useUpdateGroupClass | 修改团课（useMutation 封装 PUT /api/group-classes/:id），成功后使教练主页和团课详情缓存失效 | MyCourseManagementPage |
| useCancelGroupClass | 取消团课（useMutation 封装 POST /api/group-classes/:id/cancel），成功后使教练主页缓存失效 | MyCourseManagementPage |
| useSetAvailability | 设置私教空闲时间（useMutation 封装 POST /api/private-lessons/availability），成功后使空闲时间缓存失效 | MyCourseManagementPage |
| useCancelPrivateLesson | 取消私教预约（useMutation 封装 POST /api/private-lessons/:id/cancel），成功后使相关缓存失效 | MyCourseManagementPage |
| useCoachPrivateLessons | 获取教练的私教预约列表（useQuery 封装 GET /api/coaches/:id/private-lessons），支持 status 筛选 | MyCourseManagementPage |
| useMyEnrollments | 获取当前用户的课程报名列表（useInfiniteQuery 封装 GET /api/users/:id/enrollments），支持 type 和 status 筛选 | MyEnrollmentListPage |

## 5. 消费的后端接口汇总

| 接口 | 提供方 | 调用页面 | 调用场景 |
|------|--------|---------|---------|
| `GET /api/coaches` | coaching | CoachListPage | 页面加载时获取教练列表 |
| `POST /api/coaches/ratings` | review | CoachListPage | 教练列表加载后批量获取评分 |
| `GET /api/coaches/:id` | coaching | CoachProfilePage, MyCourseManagementPage | 获取教练主页数据（含团课列表和私教时间概览） |
| `GET /api/coaches/:id/rating` | review | CoachProfilePage | 获取教练评分 |
| `GET /api/coaches/:id/reviews` | review | CoachProfilePage | 获取教练评价列表 |
| `POST /api/reviews` | review | CoachProfilePage | 提交评价 |
| `GET /api/group-classes/:id` | coaching | GroupClassDetailPage | 获取团课详情 |
| `POST /api/group-classes/:id/enroll` | coaching | GroupClassDetailPage | 报名团课 |
| `POST /api/group-classes/:id/cancel-enrollment` | coaching | GroupClassDetailPage | 取消团课报名 |
| `GET /api/group-classes/:id/match-records` | match-record | GroupClassDetailPage | 获取团课战绩列表（已结束团课） |
| `DELETE /api/match-records/:id` | match-record | GroupClassDetailPage | 删除战绩记录 |
| `GET /api/coaches/:id/availability` | coaching | PrivateLessonBookingPage, MyCourseManagementPage | 获取教练空闲时间段 |
| `POST /api/private-lessons/book` | coaching | PrivateLessonBookingPage | 预约私教课 |
| `POST /api/group-classes` | coaching | MyCourseManagementPage | 发布团课 |
| `PUT /api/group-classes/:id` | coaching | MyCourseManagementPage | 修改团课 |
| `POST /api/group-classes/:id/cancel` | coaching | MyCourseManagementPage | 取消团课 |
| `POST /api/private-lessons/availability` | coaching | MyCourseManagementPage | 设置私教空闲时间 |
| `GET /api/coaches/:id/private-lessons` | coaching | MyCourseManagementPage | 获取教练的私教预约列表（教练视角） |
| `POST /api/private-lessons/:id/cancel` | coaching | MyCourseManagementPage | 取消私教预约 |
| `GET /api/venues/search` | venue | MyCourseManagementPage（通过 VenueSearchInput） | 发布/修改团课、添加私教时间时搜索球馆 |
| `GET /api/users/:id/enrollments` | coaching | MyEnrollmentListPage | 获取学员的课程报名列表 |

## 6. 关键业务逻辑

### 6.1 教练列表评分聚合逻辑

```
数据获取流程（遵循 architecture.md 决策 6）:
1. 调用 GET /api/coaches 获取教练列表（不含评分数据）
2. 从返回的教练列表中提取所有 userId 组成 coachIds 数组
3. 调用 POST /api/coaches/ratings { coachIds } 批量获取评分
4. 按 coachId 匹配，将 averageRating 和 totalCount 合并到对应的 CoachListItem
5. 合并后按 averageRating 降序排列（null 值排最后，即无评价的教练排最后）

分页处理:
  使用 useInfiniteQuery 管理分页
  每次加载新一页教练后，为新一页的教练批量查询评分并合并
  排序在全量数据上执行（前端客户端排序）

异常处理:
  教练列表请求失败 → 显示 PageError
  评分请求失败 → 教练列表正常展示，评分区域显示"暂无评价"（降级处理）
```

### 6.2 教练主页数据聚合逻辑

```
并行请求:
1. GET /api/coaches/:id → 教练资料 + 团课列表 + 私教时间概览
2. GET /api/coaches/:id/rating → 教练评分
3. GET /api/coaches/:id/reviews → 评价列表（延迟到用户切换到评价 Tab 时才请求）

数据组合:
  教练资料（coaching 模块）+ 评分和评价数量（review 模块）= 完整教练主页

评分显示规则:
  averageRating !== null → 显示星级图标 + 数值（如 "4.5"）+ 评价数量（如 "(15条评价)"）
  averageRating === null → 显示"暂无评价"
```

### 6.3 团课详情操作按钮逻辑

```
确定操作按钮需要以下信息:
  currentUserId: 当前登录用户 ID（来自 useAuth hook）
  groupClass.coachId: 团课教练 ID
  groupClass.status: 团课状态
  isEnrolled: 当前用户是否已报名（检查 enrollments 列表中是否包含 currentUserId）

按钮矩阵:
  | 条件 | 显示按钮 |
  |------|---------|
  | currentUserId === coachId | 无操作按钮（教练通过"我的课程管理"管理） |
  | status=open && !isEnrolled | "报名"按钮（绿色） |
  | status=open && isEnrolled | "取消报名"按钮（红色） |
  | status=full && !isEnrolled | "已满员"按钮（灰色，不可点击） |
  | status=full && isEnrolled | "取消报名"按钮（红色） |
  | status=in_progress | "进行中"状态标签 |
  | status=completed | "已结束"状态标签 + "录入战绩"按钮 |
  | status=cancelled | "已取消"状态标签 |
```

### 6.4 私教预约球馆选择逻辑

```
选择时间段后的球馆处理:
  slot.venues.length === 0（不限地点）:
    → 不显示球馆选择区域
    → venueId 参数不传（可选）
    → 直接显示"确认预约"按钮

  slot.venues.length === 1（仅一个可选球馆）:
    → 自动选中该球馆
    → 显示球馆名称（不可更改）
    → 显示"确认预约"按钮

  slot.venues.length > 1（多个可选球馆）:
    → 显示球馆选择列表（Radio 单选）
    → 用户必须选择一个球馆后才能点击"确认预约"
```

### 6.5 前端表单校验规则

**发布/修改团课**:

| 字段 | 校验规则 | 错误提示 | 触发时机 |
|------|---------|---------|---------|
| title | 必填；最长 50 字符 | "课程名称不能为空" / "课程名称不超过 50 字" | 提交时 |
| venueId | 必填 | "请选择球馆" | 提交时 |
| startTime | 必填；必须晚于当前时间 | "请选择开始时间" / "开始时间必须晚于当前时间" | 提交时 |
| endTime | 必填；必须晚于 startTime | "请选择结束时间" / "结束时间必须晚于开始时间" | 提交时 |
| maxParticipants | 必填；2-30 之间的整数 | "限定人数需在 2-30 之间" | 提交时 |
| feeDescription | 选填；最长 200 字符 | "费用说明不超过 200 字" | 提交时 |

**添加私教时间段**:

| 字段 | 校验规则 | 错误提示 | 触发时机 |
|------|---------|---------|---------|
| slots | 至少一个时间段 | "请添加至少一个时间段" | 提交时 |
| startTime | 必填；必须晚于当前时间 | "开始时间必须晚于当前时间" | 提交时 |
| endTime | 必填；必须晚于 startTime；与 startTime 差值 >= 60 分钟 | "结束时间必须晚于开始时间" / "时间段至少为 1 小时" | 提交时 |
| venueIds | 选填；每个 ID 必须有效 | -- | 提交时（后端校验） |
| feeDescription | 选填；最长 200 字符 | "费用说明不超过 200 字" | 提交时 |

**提交评价**:

| 字段 | 校验规则 | 错误提示 | 触发时机 |
|------|---------|---------|---------|
| courseType + courseId | 必选一个课程 | "请选择要评价的课程" | 提交时 |
| rating | 必填；1-5 整数 | "请选择评分" | 提交时 |
| comment | 选填；最长 500 字符 | "评价文字不超过 500 字" | 提交时 |

### 6.6 评价提交资格判断

```
"写评价"按钮显示条件:
  当前用户 !== 教练本人（不能评价自己）

评价弹窗中的课程选择:
  需展示用户参加过的、该教练的、已结束的课程列表

获取可评价课程的方式:
  方案：从教练主页已返回的 groupClasses 列表中筛选:
    - status === 'completed'（已结束）
    - 需要进一步判断当前用户是否为该课程的参与者
    - 前端无法直接判断（团课报名学员列表在团课详情接口中）
  
  实际实现方式:
    1. 课程选择下拉框展示教练的所有已结束课程
    2. 用户选择课程后提交
    3. 后端校验参与关系（REVIEW_NOT_PARTICIPANT）
    4. 后端校验是否重复评价（REVIEW_DUPLICATE）
    5. 前端根据后端错误码给出友好提示

  说明: 前端不做参与关系预判断（避免额外请求），依赖后端校验并给出明确的错误提示。
```

### 6.7 权限控制

```
教练角色页面:
  /my-courses → CoachGuard 校验 → 非教练用户提示"需要教练角色"并引导至 /settings

教练课程管理操作:
  发布团课、设置私教时间 → 后端校验 COACHING_COACH_ROLE_REQUIRED
  修改/取消团课 → 后端校验 COACHING_NOT_COACH_OWNER
  取消私教预约（教练操作）→ 后端校验 COACHING_NOT_LESSON_PARTICIPANT

学员操作:
  报名团课 → 后端校验教练不可报名自己的课程（COACHING_CANNOT_ENROLL_OWN_CLASS）
  预约私教 → 后端校验不可预约自己的私教课（COACHING_CANNOT_BOOK_OWN_LESSON）
  提交评价 → 后端校验不可评价自己（REVIEW_CANNOT_REVIEW_SELF）
```

### 6.8 TanStack Query 缓存策略

```
缓存 Key 设计:
  ['coaches', { specialty }] — 教练列表（按筛选条件区分）
  ['coaches', 'ratings', coachIds] — 批量教练评分
  ['coach', coachId] — 单个教练主页数据
  ['coach', coachId, 'rating'] — 单个教练评分
  ['coach', coachId, 'reviews'] — 教练评价列表
  ['groupClass', classId] — 团课详情
  ['groupClass', classId, 'matchRecords'] — 团课战绩列表
  ['coach', coachId, 'availability'] — 教练空闲时间
  ['coach', coachId, 'privateLessons'] — 教练私教预约列表（教练视角）
  ['enrollments', userId] — 用户课程报名列表

缓存失效策略:
  报名团课成功 → 失效 ['groupClass', classId]
  取消报名成功 → 失效 ['groupClass', classId]
  提交评价成功 → 失效 ['coach', coachId, 'reviews'] + ['coach', coachId, 'rating']
  预约私教成功 → 失效 ['coach', coachId, 'availability']
  发布团课成功 → 失效 ['coach', currentUserId]
  修改团课成功 → 失效 ['coach', currentUserId] + ['groupClass', classId]
  取消团课成功 → 失效 ['coach', currentUserId]
  添加私教时间成功 → 失效 ['coach', currentUserId, 'availability']
  取消私教预约成功 → 失效 ['coach', currentUserId, 'availability'] + ['coach', currentUserId] + ['coach', currentUserId, 'privateLessons']

staleTime: 30 秒（与 web-app.md 定义一致）
```
