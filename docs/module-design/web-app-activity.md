# Feature 详细设计: web-app — activity

> 本文档描述 web-app 的 activity feature 的页面细节。
> 整体架构（路由结构、共享层、类型定义）见 `web-app.md`。

## 1. Feature 概述

- **职责**: 约球活动的浏览、筛选、发起、详情查看、加入/退出/修改/取消、战绩查看与录入入口、我的活动列表
- **包含页面**: 约球列表页（ActivityListPage）、发起约球页（CreateActivityPage）、活动详情页（ActivityDetailPage）、我的活动页（MyActivityListPage）
- **对应后端模块**: activity（核心）、venue（球馆搜索）、match-record（活动战绩列表、战绩删除）

---

## 2. 页面与路由

### ActivityListPage 页面

**UI 原型**: `docs/prototypes/prototype-home.png`

**路由**: `/activities`

**功能**: 约球活动列表，作为应用首页。列表默认仅返回未来活动（startTime > 当前时间）且状态不为 cancelled 的活动。支持按时间/距离/空余筛选活动，支持按时间或距离排序。右下角悬浮按钮进入"发起约球"页面。点击活动卡片进入活动详情页。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| activities | `Activity[]` | API（GET /api/activities） | 活动列表数据 |
| total | number | API | 活动总数 |
| dateFilter | `'today' \| 'tomorrow' \| 'this_week' \| null` | 用户选择 | 时间快捷筛选 |
| dateRange | `[string, string] \| null` | 用户选择 | 自定义日期范围（dateStart, dateEnd），与 dateFilter 互斥 |
| maxDistance | `3 \| 5 \| 10 \| null` | 用户选择 | 距离筛选范围（km），需定位授权 |
| hasSlot | boolean | 用户选择 | 空余筛选开关，默认 false |
| sortBy | `'time' \| 'distance'` | 用户选择 | 排序方式，默认 'time' |
| isLoading | boolean | API 请求状态 | 列表加载中 |
| error | string \| null | API 响应 | 加载错误信息 |

> 注：分页由 useInfiniteQuery 内部管理（自动维护 page/cursor），页面状态中无需显式维护 page 字段。

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/activities` | 页面加载、筛选条件变化、排序变化、滚动加载更多 | 渲染活动列表 | 显示 PageError 组件 |

**交互流程**:

```
用户进入 /activities → 加载活动列表（GET /api/activities，默认 sortBy=time）→ 渲染活动卡片列表

筛选操作:
  时间筛选 → 点击"时间"按钮 → 弹出筛选面板（今天/明天/本周/自定义日期）→ 选择后关闭面板 → useInfiniteQuery 重置，从第一页重新加载
  距离筛选 → 点击"距离"按钮:
    ├→ 已授权定位 → 弹出距离选择（3km/5km/10km/不限）→ 选择后重新加载
    └→ 未授权定位 → 触发浏览器定位请求（useGeolocation）
        ├→ 用户授权 → 弹出距离选择
        └→ 用户拒绝 → 距离筛选按钮隐藏，message.warning 提示"需要定位权限才能使用距离筛选"
  空余筛选 → 点击"有空位"开关 → 切换 hasSlot → 重新加载列表

排序操作:
  默认按时间排序 → 用户可切换为"按距离"排序（需定位授权）
  距离排序不可用时（未授权定位），排序选项中"距离"项不可点击

发起约球:
  点击右下角悬浮"+"按钮 → 跳转到 /activities/create

查看详情:
  点击活动卡片 → 跳转到 /activities/:id

下拉刷新:
  下拉触发 → 重新加载当前筛选条件的第一页数据

上拉加载更多:
  滚动到底部 → 加载下一页数据（useInfiniteScroll）
```

**组件结构**:

```
ActivityListPage
├── FilterBar                  # 筛选栏（时间、距离、有空位）
│   ├── DateFilterButton       # 时间筛选按钮+弹出面板
│   ├── DistanceFilterButton   # 距离筛选按钮+弹出面板（定位拒绝时隐藏）
│   └── SlotFilterSwitch       # "有空位"开关
├── SortSelector               # 排序选择（按时间/按距离）
├── ActivityCardList           # 活动卡片列表
│   └── ActivityCard           # 单个活动卡片
├── EmptyState                 # 无活动时的空状态（共享组件）
├── LoadingSpinner             # 加载中状态（共享组件）
└── CreateActivityFAB          # 右下角悬浮"发起约球"按钮
```

---

### CreateActivityPage 页面

**UI 原型**: `docs/prototypes/prototype-create-activity.png`

**路由**: `/activities/create`

**功能**: 发起约球活动。用户填写球馆（搜索选择）、开始时间、结束时间、限定人数，可选填活动标题和备注，提交后创建活动。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| venueId | string \| null | 用户选择 | 选中的球馆 ID |
| venueName | string | 用户选择 | 选中的球馆名称（用于展示） |
| title | string | 用户输入 | 活动标题（可选，最长 50 字符） |
| startTime | string \| null | 用户选择 | 开始时间（ISO 8601） |
| endTime | string \| null | 用户选择 | 结束时间（ISO 8601） |
| maxParticipants | number | 用户输入 | 限定人数（默认 6） |
| submitting | boolean | API 请求状态 | 提交中 |
| formErrors | Record<string, string> | 前端校验 / API 响应 | 各字段的错误提示 |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/venues/search` | 球馆搜索框输入（通过 VenueSearchInput 共享组件） | 下拉展示匹配球馆列表 | message.error 提示"球馆搜索失败" |
| `POST /api/activities` | 用户点击"发布"按钮 | message.success 提示"发布成功"，跳转到活动详情页 `/activities/:id` | 根据错误码显示对应提示（见下方错误处理表） |

**创建活动错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| ACTIVITY_INVALID_VENUE | "请选择球馆" |
| ACTIVITY_INVALID_TIME | "开始时间必须晚于当前时间，结束时间必须晚于开始时间" |
| ACTIVITY_INVALID_PARTICIPANTS | "限定人数需在 2-50 之间" |
| ACTIVITY_INVALID_TITLE | "标题不能超过 50 个字符" |
| ACTIVITY_VENUE_NOT_FOUND | "选择的球馆不存在，请重新选择" |

**交互流程**:

```
用户进入 /activities/create → 渲染发起约球表单

选择球馆:
  使用 VenueSearchInput 共享组件 → 输入关键词 → debounce 300ms → 调用 GET /api/venues/search
  → 下拉展示匹配结果 → 用户选择 → 设置 venueId 和 venueName

选择时间:
  点击开始时间选择器 → 选择日期+时间 → 设置 startTime
  点击结束时间选择器 → 选择日期+时间 → 设置 endTime

设置人数:
  使用数字步进器 → 输入或点击+/- → 设置 maxParticipants（范围 2-50）

填写标题（可选）:
  输入活动标题 → 设置 title

提交:
  点击"发布"按钮 → 前端校验 → 校验通过 → 调用 POST /api/activities
  → 成功 → message.success → 跳转到 /activities/:id
  → 失败 → 显示错误提示

返回:
  点击顶部返回按钮 → 返回上一页（/activities）
```

**组件结构**:

```
CreateActivityPage
├── VenueSearchInput           # 球馆搜索选择（共享组件）
├── DateTimePicker (startTime) # 开始时间选择器（Ant Design DatePicker）
├── DateTimePicker (endTime)   # 结束时间选择器
├── ParticipantStepper         # 人数设置（数字步进器）
├── TitleInput                 # 活动标题输入框（可选）
└── SubmitButton               # "发布"按钮
```

---

### ActivityDetailPage 页面

**UI 原型**: `docs/prototypes/prototype-activity-detail.png`

**路由**: `/activities/:id`

**功能**: 展示活动完整信息（球馆、时间、人数、状态）、发起人信息、参与者列表、战绩列表。根据当前用户身份和活动状态，提供加入/退出/修改/取消活动等操作。已结束的活动可进入战绩录入页。录入者可在战绩列表中删除自己录入的战绩。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| activity | ActivityDetail \| null | API（GET /api/activities/:id） | 活动详情数据 |
| matchRecords | MatchRecord[] | API（GET /api/activities/:id/match-records） | 活动战绩列表 |
| isLoading | boolean | API 请求状态 | 活动数据加载中 |
| isMatchRecordsLoading | boolean | API 请求状态 | 战绩列表加载中 |
| error | string \| null | API 响应 | 加载错误信息 |
| isEditMode | boolean | 用户操作 | 是否进入编辑模式（仅发起人可触发） |
| editForm | object | 用户输入 | 编辑模式下的表单数据（venueId、title、startTime、endTime、maxParticipants） |
| showCancelConfirm | boolean | 用户操作 | 是否显示取消活动确认弹窗 |
| showLeaveConfirm | boolean | 用户操作 | 是否显示退出活动确认弹窗 |
| showDeleteConfirm | boolean | 用户操作 | 是否显示删除战绩确认弹窗 |
| deletingRecordId | string \| null | 用户操作 | 当前待删除的战绩 ID |

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/activities/:id` | 页面加载 | 渲染活动详情 | 404: 显示"活动不存在"；其他: PageError |
| `GET /api/activities/:id/match-records` | 页面加载（并行） | 渲染战绩列表 | 显示错误提示 |
| `POST /api/activities/:id/join` | 点击"加入活动"按钮 | message.success 提示"加入成功"，刷新活动详情 | 根据错误码显示提示（见下方） |
| `POST /api/activities/:id/leave` | 确认退出活动 | message.success 提示"已退出活动"，刷新活动详情 | 根据错误码显示提示（见下方） |
| `PUT /api/activities/:id` | 编辑模式下点击"保存" | message.success 提示"修改成功"，退出编辑模式，刷新活动详情 | 根据错误码显示提示（见下方） |
| `POST /api/activities/:id/cancel` | 确认取消活动 | message.success 提示"活动已取消"，刷新活动详情 | 根据错误码显示提示（见下方） |
| `DELETE /api/match-records/:id` | 确认删除战绩 | message.success 提示"战绩已删除"，刷新战绩列表 | 根据错误码显示提示（见下方） |

**加入活动错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| ACTIVITY_NOT_FOUND | "活动不存在" |
| ACTIVITY_FULL | "活动已满员" |
| ACTIVITY_ALREADY_JOINED | "你已经加入了该活动" |
| ACTIVITY_NOT_JOINABLE | "活动当前状态不允许加入" |

**退出活动错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| ACTIVITY_NOT_FOUND | "活动不存在" |
| ACTIVITY_CREATOR_CANNOT_LEAVE | "发起人不能退出活动，如需取消请使用「取消活动」" |
| ACTIVITY_NOT_LEAVABLE | "活动已开始或已结束，无法退出" |
| ACTIVITY_NOT_PARTICIPANT | "你不是该活动的参与者" |

**修改活动错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| ACTIVITY_NOT_CREATOR | "只有发起人可以修改活动" |
| ACTIVITY_NOT_MODIFIABLE | "活动已开始或已结束，无法修改" |
| ACTIVITY_INVALID_VENUE | "请选择球馆" |
| ACTIVITY_INVALID_TIME | "开始时间必须晚于当前时间，结束时间必须晚于开始时间" |
| ACTIVITY_INVALID_PARTICIPANTS | "限定人数需在 2-50 之间" |
| ACTIVITY_INVALID_TITLE | "标题不能超过 50 个字符" |
| ACTIVITY_PARTICIPANTS_EXCEED | "限定人数不能少于当前参与人数" |
| ACTIVITY_VENUE_NOT_FOUND | "选择的球馆不存在，请重新选择" |

**取消活动错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| ACTIVITY_NOT_CREATOR | "只有发起人可以取消活动" |
| ACTIVITY_NOT_CANCELLABLE | "活动已开始或已结束，无法取消" |

**删除战绩错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| MATCH_RECORD_NOT_RECORDER | "只能删除自己录入的战绩" |
| MATCH_RECORD_NOT_FOUND | "战绩不存在" |

**交互流程**:

```
用户进入 /activities/:id → 并行加载活动详情 + 战绩列表 → 渲染页面

页面展示（根据用户身份和活动状态）:
  ┌─ 活动信息区域: 状态标签、球馆名称+地址、时间、人数（当前/上限）
  ├─ 参与者区域: 参与者头像+昵称列表
  ├─ 战绩列表区域: 战绩记录卡片列表（含录入者可见的删除按钮）
  └─ 操作区域（底部固定）: 根据身份和状态展示不同按钮

操作按钮逻辑:
  当前用户是发起人 且 活动状态为 open/full:
    → 显示"编辑活动"和"取消活动"按钮
  当前用户已加入(非发起人) 且 活动状态为 open/full:
    → 显示"退出活动"按钮
  当前用户未加入 且 活动状态为 open:
    → 显示"加入活动"按钮
  当前用户未加入 且 活动状态为 full:
    → 显示"已满员"（不可点击）
  活动状态为 completed 且 当前用户是参与者:
    → 显示"录入战绩"按钮
  活动状态为 in_progress:
    → 不显示操作按钮（后端要求活动状态为 completed 才允许录入战绩，in_progress 状态下活动尚未结束，不可录入）
  活动状态为 cancelled:
    → 不显示操作按钮

加入活动:
  点击"加入活动" → 调用 POST /api/activities/:id/join → 成功 → 刷新详情

退出活动:
  点击"退出活动" → 弹出 ConfirmDialog → 确认 → 调用 POST /api/activities/:id/leave → 成功 → 刷新详情

编辑活动（发起人）:
  点击"编辑活动" → 进入编辑模式（表单覆盖信息展示区）→ 修改字段 → 点击"保存"
  → 前端校验 → 调用 PUT /api/activities/:id → 成功 → 退出编辑模式 → 刷新详情
  → 点击"取消编辑" → 退出编辑模式，恢复原数据

取消活动（发起人）:
  点击"取消活动" → 弹出 ConfirmDialog（"取消后不可恢复，所有参与者将收到通知"）
  → 确认 → 调用 POST /api/activities/:id/cancel → 成功 → 刷新详情

录入战绩:
  点击"录入战绩" → 跳转到 /match-records/create?sourceType=activity&sourceId={id}

删除战绩（录入者）:
  点击战绩卡片上的删除图标 → 弹出 ConfirmDialog → 确认
  → 调用 DELETE /api/match-records/:id → 成功 → 刷新战绩列表

返回:
  点击顶部返回按钮 → 返回上一页
```

**组件结构**:

```
ActivityDetailPage
├── StatusTag                  # 活动状态标签（共享组件）
├── ActivityInfoSection        # 活动信息区域（球馆、时间、人数）
│   ├── VenueInfo              # 球馆名称+地址
│   ├── TimeInfo               # 开始/结束时间
│   └── ParticipantCount       # 当前人数/上限人数
├── ParticipantSection         # 参与者列表
│   └── ParticipantItem        # 单个参与者（头像+昵称，发起人标识）
│       └── UserAvatar         # 用户头像（共享组件）
├── MatchRecordSection         # 战绩列表区域
│   ├── MatchRecordCard        # 单条战绩卡片（选手、比分、结果）
│   │   ├── PlayerInfo         # 选手信息（头像+昵称，支持临时用户）
│   │   └── ScoreDisplay       # 比分展示（每局比分）
│   └── EmptyState             # 无战绩时提示"暂无战绩记录"（共享组件）
├── ActivityEditForm           # 编辑模式表单（仅发起人，编辑模式下显示）
│   ├── VenueSearchInput       # 球馆搜索选择（共享组件）
│   ├── DateTimePicker         # 时间选择器
│   ├── ParticipantStepper     # 人数调整
│   └── TitleInput             # 标题输入
├── ActionBar                  # 底部操作栏（固定底部）
│   ├── JoinButton             # "加入活动"按钮
│   ├── LeaveButton            # "退出活动"按钮
│   ├── EditButton             # "编辑活动"按钮
│   ├── CancelButton           # "取消活动"按钮
│   └── RecordMatchButton      # "录入战绩"按钮
├── ConfirmDialog              # 确认弹窗（共享组件）
└── LoadingSpinner             # 加载中（共享组件）
```

---

### MyActivityListPage 页面

**路由**: `/my-activities`

**入口**: 位于 profile feature 的个人主页（UserProfilePage），通过"我的活动"入口跳转。

**功能**: 展示当前用户参与（含发起）的活动列表。支持按角色（发起的/参加的）和状态筛选。点击活动卡片进入活动详情页。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| activities | Activity[] | API（GET /api/users/:id/activities） | 活动列表数据 |
| total | number | API | 活动总数 |
| role | `'creator' \| 'participant' \| null` | 用户选择 | 角色筛选（发起的/参加的/全部） |
| status | ActivityStatus \| null | 用户选择 | 状态筛选 |
| isLoading | boolean | API 请求状态 | 列表加载中 |

> 注：分页由 useInfiniteQuery 内部管理，页面状态中无需显式维护 page 字段。使用 useInfiniteScroll 实现无限滚动，与 ActivityListPage 保持一致。

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/users/:id/activities` | 页面加载、筛选条件变化、滚动加载更多 | 渲染活动列表 | 显示 PageError 组件 |

**交互流程**:

```
用户进入 /my-activities → 使用当前用户 ID 调用 GET /api/users/{me}/activities → 渲染列表

角色筛选:
  Tab 切换（全部/我发起的/我参加的）→ 设置 role → useInfiniteQuery 重置，从第一页重新加载

状态筛选:
  下拉选择状态（全部/报名中/已满员/进行中/已结束/已取消）→ 设置 status → 重新加载

查看详情:
  点击活动卡片 → 跳转到 /activities/:id

返回:
  点击顶部返回按钮 → 返回上一页
```

**组件结构**:

```
MyActivityListPage
├── RoleFilterTabs             # 角色筛选 Tab（全部/我发起的/我参加的）
├── StatusFilter               # 状态筛选下拉
├── ActivityCardList           # 活动卡片列表（复用）
│   └── ActivityCard           # 单个活动卡片（复用）
├── EmptyState                 # 空状态（共享组件）
└── LoadingSpinner             # 加载中（共享组件）
```

---

## 3. Feature 私有组件

| 组件 | 用途 | 使用页面 |
|------|------|---------|
| FilterBar | 活动列表顶部的筛选栏容器，包含时间、距离、空余筛选 | ActivityListPage |
| DateFilterButton | 时间筛选按钮+弹出面板，支持今天/明天/本周/自定义日期 | ActivityListPage（FilterBar 子组件） |
| DistanceFilterButton | 距离筛选按钮+弹出面板，支持 3km/5km/10km/不限，定位拒绝时隐藏 | ActivityListPage（FilterBar 子组件） |
| SlotFilterSwitch | "有空位"开关组件 | ActivityListPage（FilterBar 子组件） |
| SortSelector | 排序方式选择（按时间/按距离），距离排序需定位授权 | ActivityListPage |
| ActivityCard | 活动卡片组件，展示球馆名称、时间、人数、状态、距离（可选） | ActivityListPage, MyActivityListPage |
| ActivityCardList | 活动卡片列表容器 | ActivityListPage, MyActivityListPage |
| CreateActivityFAB | 右下角悬浮"发起约球"按钮（Floating Action Button） | ActivityListPage |
| ParticipantStepper | 人数数字步进器（+/-按钮 + 数字输入，范围 2-50） | CreateActivityPage, ActivityDetailPage（编辑模式） |
| TitleInput | 活动标题输入框（可选字段，最长 50 字符） | CreateActivityPage, ActivityDetailPage（编辑模式） |
| ActivityInfoSection | 活动信息展示区域（球馆、时间、人数），非编辑模式的只读展示 | ActivityDetailPage |
| ParticipantSection | 参与者列表区域，展示参与者头像和昵称，发起人有特殊标识 | ActivityDetailPage |
| ParticipantItem | 单个参与者项（头像+昵称），发起人显示"发起人"标签 | ActivityDetailPage（ParticipantSection 子组件） |
| MatchRecordSection | 活动的战绩列表区域 | ActivityDetailPage |
| MatchRecordCard | 单条战绩卡片，展示比赛类型、对战双方、比分、结果，录入者可见删除图标 | ActivityDetailPage（MatchRecordSection 子组件） |
| PlayerInfo | 战绩卡片中的选手信息（平台用户显示头像+昵称，临时用户仅显示昵称） | ActivityDetailPage（MatchRecordCard 子组件） |
| ScoreDisplay | 比分展示组件，展示每局比分和最终结果 | ActivityDetailPage（MatchRecordCard 子组件） |
| ActivityEditForm | 活动编辑表单（仅发起人使用），包含球馆、时间、人数、标题的修改 | ActivityDetailPage |
| ActionBar | 底部固定操作栏，根据用户身份和活动状态展示不同操作按钮 | ActivityDetailPage |
| RoleFilterTabs | 我的活动页的角色筛选 Tab（全部/我发起的/我参加的） | MyActivityListPage |
| StatusFilter | 活动状态筛选下拉组件 | MyActivityListPage |

## 4. Feature 私有 Hooks

| Hook | 用途 | 使用页面 |
|------|------|---------|
| useActivities | 获取活动列表（useInfiniteQuery 封装），支持筛选/排序参数，集成 useInfiniteScroll 实现无限滚动 | ActivityListPage |
| useActivityDetail | 获取活动详情（useQuery 封装 GET /api/activities/:id） | ActivityDetailPage |
| useActivityMatchRecords | 获取活动的战绩列表（useQuery 封装 GET /api/activities/:id/match-records） | ActivityDetailPage |
| useJoinActivity | 加入活动操作（useMutation 封装 POST /api/activities/:id/join），成功后 invalidate 活动详情缓存 | ActivityDetailPage |
| useLeaveActivity | 退出活动操作（useMutation 封装 POST /api/activities/:id/leave），成功后 invalidate 活动详情缓存 | ActivityDetailPage |
| useUpdateActivity | 修改活动操作（useMutation 封装 PUT /api/activities/:id），成功后 invalidate 活动详情缓存和活动列表缓存 | ActivityDetailPage |
| useCancelActivity | 取消活动操作（useMutation 封装 POST /api/activities/:id/cancel），成功后 invalidate 活动详情缓存和活动列表缓存 | ActivityDetailPage |
| useDeleteMatchRecord | 删除战绩操作（useMutation 封装 DELETE /api/match-records/:id），成功后 invalidate 战绩列表缓存 | ActivityDetailPage |
| useCreateActivity | 创建活动操作（useMutation 封装 POST /api/activities），成功后跳转到活动详情页 | CreateActivityPage |
| useMyActivities | 获取当前用户的活动列表（useInfiniteQuery 封装 GET /api/users/:id/activities），支持角色和状态筛选，集成 useInfiniteScroll 实现无限滚动 | MyActivityListPage |

## 5. 消费的后端接口汇总

| 接口 | 提供方 | 调用页面 | 调用场景 |
|------|--------|---------|---------|
| `GET /api/activities` | activity | ActivityListPage | 页面加载和筛选/排序时获取活动列表 |
| `GET /api/activities/:id` | activity | ActivityDetailPage | 页面加载时获取活动详情 |
| `POST /api/activities` | activity | CreateActivityPage | 用户提交发起约球表单 |
| `POST /api/activities/:id/join` | activity | ActivityDetailPage | 用户点击"加入活动" |
| `POST /api/activities/:id/leave` | activity | ActivityDetailPage | 用户确认退出活动 |
| `PUT /api/activities/:id` | activity | ActivityDetailPage | 发起人编辑活动后保存 |
| `POST /api/activities/:id/cancel` | activity | ActivityDetailPage | 发起人确认取消活动 |
| `GET /api/users/:id/activities` | activity | MyActivityListPage | 页面加载和筛选时获取用户活动列表 |
| `GET /api/venues/search` | venue | CreateActivityPage, ActivityDetailPage（编辑模式） | 球馆搜索输入框输入时搜索匹配球馆 |
| `GET /api/activities/:id/match-records` | match-record | ActivityDetailPage | 页面加载时获取活动的战绩列表 |
| `DELETE /api/match-records/:id` | match-record | ActivityDetailPage | 录入者删除自己录入的战绩 |

## 6. 关键业务逻辑

### 6.1 前端表单校验规则（发起约球 / 编辑活动）

| 字段 | 校验规则 | 错误提示 | 触发时机 |
|------|---------|---------|---------|
| venueId | 必填，必须选择球馆 | "请选择球馆" | 提交时 |
| startTime | 必填；必须晚于当前时间 | "请选择开始时间"/"开始时间必须晚于当前时间" | 提交时 |
| endTime | 必填；必须晚于 startTime | "请选择结束时间"/"结束时间必须晚于开始时间" | 提交时 |
| maxParticipants | 必填；整数；范围 2-50 | "限定人数需在 2-50 之间" | 提交时 |
| title | 可选；若填写则最长 50 字符 | "标题不能超过 50 个字符" | 提交时 |

编辑活动时的额外校验：maxParticipants 不能小于当前参与人数（前端根据 activity.currentParticipants 校验），提示"限定人数不能少于当前参与人数（{currentParticipants} 人）"。

### 6.2 活动详情页操作按钮显示逻辑

```
获取当前用户身份:
  isCreator = activity.creatorId === currentUser.id
  isParticipant = activity.participants.some(p => p.userId === currentUser.id)

根据状态和身份决定显示按钮:

status === 'open':
  isCreator:     [编辑活动] [取消活动]
  isParticipant: [退出活动]
  未加入:        [加入活动]

status === 'full':
  isCreator:     [编辑活动] [取消活动]
  isParticipant: [退出活动]
  未加入:        [已满员]（禁用态按钮）

status === 'in_progress':
  无操作按钮
  说明: 后端 POST /api/match-records 要求来源活动状态为 completed，in_progress 状态下不可录入战绩

status === 'completed':
  isParticipant（含 isCreator）: [录入战绩]
  未加入:                       无操作按钮

status === 'cancelled':
  无操作按钮
```

### 6.3 距离筛选与定位联动

```
首次使用距离筛选:
  1. 检查 geolocationStore.permission
  2. permission === 'prompt' → 调用 useGeolocation 触发浏览器定位请求
     ├→ 用户授权 → geolocationStore 更新经纬度和 permission = 'granted' → 显示距离筛选面板
     └→ 用户拒绝 → geolocationStore 更新 permission = 'denied' → 隐藏距离筛选按钮，message.warning 提示
  3. permission === 'granted' → 直接使用缓存的经纬度 → 显示距离筛选面板
  4. permission === 'denied' → 距离筛选按钮隐藏

距离排序同理:
  permission === 'denied' → 排序选项中"按距离"不可选
  permission === 'granted' → 排序选项中"按距离"可选

活动卡片距离展示:
  有经纬度 → 后端返回 distance 字段 → 卡片展示"距你 X.X km"
  无经纬度 → 不展示距离信息
```

### 6.4 筛选条件互斥与重置逻辑

```
dateFilter 和 dateRange 互斥:
  选择 dateFilter（今天/明天/本周）→ 清除 dateRange
  选择自定义日期范围 → 清除 dateFilter

切换筛选条件后:
  useInfiniteQuery 重置（从第一页重新加载）
  列表自动重新加载
```

### 6.5 活动卡片展示标题逻辑

```
activity.title 不为空 → 显示 title 作为卡片标题
activity.title 为空 → 使用"球馆名称"作为卡片标题
activity.venue 为 null（球馆已被移除）→ 显示"已删除的球馆"
```

### 6.6 战绩列表中的删除权限判断

```
对于每条 MatchRecordCard:
  matchRecord.recordedBy === currentUser.id → 显示删除图标按钮
  否则 → 不显示删除图标

删除操作须二次确认（ConfirmDialog）
```

### 6.7 活动编辑模式的进入与退出

```
进入编辑模式:
  1. 仅 isCreator 且 status 为 open/full 时可进入
  2. 点击"编辑活动"按钮 → isEditMode = true
  3. 将当前 activity 数据填入 editForm（venueId、title、startTime、endTime、maxParticipants）

退出编辑模式:
  1. 点击"取消编辑" → isEditMode = false，丢弃修改
  2. 保存成功后 → isEditMode = false，刷新数据

编辑模式下:
  ActivityInfoSection 被 ActivityEditForm 替换
  底部操作栏变为"保存"和"取消编辑"按钮
```

### 6.8 TanStack Query 缓存策略

```
活动列表 (GET /api/activities):
  queryKey: ['activities', { filters, sortBy }]  // page 由 useInfiniteQuery 内部管理
  staleTime: 30 秒（与整体设计约定一致）

活动详情 (GET /api/activities/:id):
  queryKey: ['activity', activityId]
  staleTime: 30 秒

活动战绩 (GET /api/activities/:id/match-records):
  queryKey: ['activity-match-records', activityId]
  staleTime: 30 秒

我的活动 (GET /api/users/:id/activities):
  queryKey: ['user-activities', userId, { role, status }]  // page 由 useInfiniteQuery 内部管理
  staleTime: 30 秒

操作成功后的缓存失效:
  加入/退出活动 → invalidate ['activity', activityId] + invalidate ['activities'] (列表)
  修改/取消活动 → invalidate ['activity', activityId] + invalidate ['activities'] + invalidate ['user-activities']
  删除战绩 → invalidate ['activity-match-records', activityId]
  创建活动 → invalidate ['activities'] + invalidate ['user-activities']
```
