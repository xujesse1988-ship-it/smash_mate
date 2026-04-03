# Feature 详细设计: web-app — match-record

> 本文档描述 web-app 的 match-record feature 的页面细节。
> 整体架构（路由结构、共享层、类型定义）见 `web-app.md`。

## 1. Feature 概述

- **职责**: 战绩的录入（单打/双打，关联到活动/团课/私教课）和个人战绩历史列表的查看
- **包含页面**: 战绩录入页（CreateMatchRecordPage）、战绩历史列表页（MatchRecordHistoryPage）
- **对应后端模块**: match-record（核心）、activity（获取活动参与者列表）、coaching（获取课程参与者列表）

**说明**:
- 战绩列表展示和删除操作位于 activity feature（活动详情页的 MatchRecordSection）和 coaching feature（团课详情页的 MatchRecordSection），不属于本 feature
- 战绩汇总统计展示位于 profile feature（个人主页的战绩汇总卡片），不属于本 feature
- 本 feature 负责「录入」和「个人战绩历史」两个独立页面

---

## 2. 页面与路由

### CreateMatchRecordPage 页面

**UI 原型**:
- 单打模式: `docs/prototypes/prototype-match-record.png`
- 双打模式: `docs/prototypes/prototype-match-record-doubles.png`

> **原型偏差说明**（来自 PRD）：
> - 单打原型图中缺少顶部"比赛类型"切换按钮（单打/双打），实际开发时需在表单顶部增加类型切换控件，默认选中"单打"。
> - 双打原型图中，勾选"非平台用户"后缺少昵称输入框。实际开发时，勾选"非平台用户"开关后，下拉选择器应替换为文本输入框（用于输入昵称），交互方式与单打模式一致。

**路由**: `/match-records/create`

**入口**: 从活动详情页（ActivityDetailPage）、团课详情页（GroupClassDetailPage）点击"录入战绩"按钮跳转，携带 URL 查询参数 `sourceType` 和 `sourceId`。

**功能**: 录入一条比赛战绩记录。用户选择比赛类型（单打/双打），选择对战双方/两组选手（平台用户从参与者列表中下拉选择，非平台用户输入昵称），输入每局比分（支持动态添加/删除局），提交后创建战绩记录。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| sourceType | `SourceType` | URL 查询参数 | 来源类型: 'activity' / 'group-class' / 'private-lesson' |
| sourceId | string | URL 查询参数 | 来源 ID（活动/团课/私教课的 ID） |
| participants | `ActivityParticipant[]` | API | 来源活动/课程的参与者列表（用于下拉选择） |
| isParticipantsLoading | boolean | API 请求状态 | 参与者列表加载中 |
| matchType | `MatchType` | 用户选择 | 比赛类型: 'singles'（默认） / 'doubles' |
| sideA | `PlayerFormItem[]` | 用户输入 | A 方选手列表 |
| sideB | `PlayerFormItem[]` | 用户输入 | B 方选手列表 |
| games | `GameFormItem[]` | 用户输入 | 每局比分列表（初始 1 局） |
| submitting | boolean | API 请求状态 | 提交中 |
| formErrors | `Record<string, string>` | 前端校验 / API 响应 | 各字段的错误提示 |

> `PlayerFormItem` 类型定义:
> ```typescript
> interface PlayerFormItem {
>   isGuest: boolean;          // 是否为非平台用户
>   userId: string | null;     // 平台用户 ID（isGuest=false 时使用）
>   guestName: string;         // 非平台用户昵称（isGuest=true 时使用）
> }
> ```

> `GameFormItem` 类型定义:
> ```typescript
> interface GameFormItem {
>   scoreA: number | null;     // A 方得分
>   scoreB: number | null;     // B 方得分
> }
> ```

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/activities/:id` | 页面加载且 sourceType='activity' | 获取活动参与者列表 | 显示 PageError 组件 |
| `GET /api/group-classes/:id` | 页面加载且 sourceType='group-class' | 获取团课报名学员列表 | 显示 PageError 组件 |
| `POST /api/match-records` | 用户点击"提交战绩"按钮 | message.success 提示"战绩录入成功"，跳转回来源详情页 | 根据错误码显示对应提示（见下方错误处理表） |

**获取参与者列表说明**:
- sourceType='activity' 时：调用 `GET /api/activities/:id`，从响应的 `participants` 字段获取参与者列表
- sourceType='group-class' 时：调用 `GET /api/group-classes/:id`，从响应的 `enrollments` 字段获取报名学员列表
- sourceType='private-lesson' 时：不需要获取参与者列表（私教课仅教练和学员两人，前端通过 URL 参数中的 sourceId 确定来源，由后端校验参与关系）。页面仍可正常显示，所有选手需手动选择或输入

**录入战绩错误处理**:

| error.code | 用户提示 |
|-----------|---------|
| MATCH_RECORD_INVALID_SOURCE_TYPE | "无效的来源类型" |
| MATCH_RECORD_INVALID_MATCH_TYPE | "请选择比赛类型" |
| MATCH_RECORD_INVALID_PLAYERS | "选手数量不正确（单打各1人，双打各2人）" |
| MATCH_RECORD_INVALID_PLAYER | "选手信息不完整" |
| MATCH_RECORD_INVALID_GUEST_NAME | "非平台用户昵称不能为空，且不超过20个字符" |
| MATCH_RECORD_INVALID_GAMES | "请至少录入1局比分" |
| MATCH_RECORD_INVALID_SCORE | "单局比分需在0-30之间，且不可同时为0" |
| MATCH_RECORD_DUPLICATE_PLAYER | "同一选手不能同时出现在两侧" |
| MATCH_RECORD_NOT_PARTICIPANT | "你不是该活动/课程的参与者，无法录入战绩" |
| MATCH_RECORD_PLAYER_NOT_PARTICIPANT | "所选选手不是该活动/课程的参与者" |
| MATCH_RECORD_SOURCE_NOT_FOUND | "关联的活动/课程不存在" |
| MATCH_RECORD_SOURCE_NOT_COMPLETED | "活动/课程尚未结束，暂时无法录入战绩" |

**交互流程**:

```
用户从活动详情页/团课详情页点击"录入战绩"
  → 跳转到 /match-records/create?sourceType=activity&sourceId={id}
  → 页面加载 → 解析 URL 参数获取 sourceType 和 sourceId
  → 根据 sourceType 加载参与者列表（activity → GET /api/activities/:id, group-class → GET /api/group-classes/:id）
  → 渲染录入表单

选择比赛类型:
  点击"单打"/"双打"切换按钮 → 设置 matchType
  → 切换时重置选手表单:
    单打 → sideA = [空PlayerFormItem], sideB = [空PlayerFormItem]
    双打 → sideA = [空PlayerFormItem, 空PlayerFormItem], sideB = [空PlayerFormItem, 空PlayerFormItem]

选择/输入选手:
  每个选手位置:
    默认模式（isGuest=false）→ 显示参与者下拉选择器 → 选择平台用户 → 设置 userId
    点击"非平台用户"开关 → isGuest=true → 下拉选择器替换为文本输入框 → 输入昵称 → 设置 guestName
    再次点击"非平台用户"开关 → isGuest=false → 恢复为下拉选择器

输入比分:
  初始显示 1 局比分输入行（scoreA 和 scoreB 两个数字输入框）
  点击"添加一局" → 追加一行比分输入
  点击某局的删除按钮 → 移除该局（至少保留 1 局，最后一局不可删除）

提交:
  点击"提交战绩"按钮 → 前端校验（见下方校验规则）
  → 校验通过 → 构建请求体 → 调用 POST /api/match-records
  → 成功 → message.success "战绩录入成功"
    → 跳转回来源详情页:
      sourceType=activity → /activities/{sourceId}
      sourceType=group-class → /group-classes/{sourceId}
      sourceType=private-lesson → 浏览器后退
  → 失败 → 显示对应错误提示

返回:
  点击顶部返回按钮 → 返回上一页
```

**组件结构**:

```
CreateMatchRecordPage
├── MatchTypeSelector             # 比赛类型切换（单打/双打）
├── PlayerSection                 # 对战双方选手区域
│   ├── SidePanel (A)             # A 方选手面板
│   │   └── PlayerSelector        # 单个选手选择器（可复用）
│   │       ├── ParticipantSelect # 参与者下拉选择（isGuest=false）
│   │       ├── GuestNameInput    # 非平台用户昵称输入（isGuest=true）
│   │       └── GuestToggle       # "非平台用户"开关
│   └── SidePanel (B)             # B 方选手面板
│       └── PlayerSelector        # 同上
├── ScoreSection                  # 比分录入区域
│   ├── ScoreRow                  # 单局比分行（scoreA + scoreB）
│   ├── AddGameButton             # "添加一局"按钮
│   └── RemoveGameButton          # 删除某局按钮（局数>1时显示）
├── SubmitButton                  # "提交战绩"按钮
├── LoadingSpinner                # 参与者列表加载中（共享组件）
└── PageError                     # 参与者加载失败（共享组件）
```

---

### MatchRecordHistoryPage 页面

**UI 原型**: `docs/prototypes/prototype-match-history.png`

**路由**: `/users/:id/match-records`

**入口**: 从个人主页（UserProfilePage，属于 profile feature）点击"战绩历史"入口跳转。

**功能**: 展示某个用户参与的所有战绩记录（个人战绩历史列表）。顶部显示战绩汇总统计（总场次、胜场、负场、平局、胜率），下方为战绩记录列表，支持按来源类型筛选和分页加载。

**页面状态**:

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| userId | string | URL 路径参数 | 查看的用户 ID |
| matchStats | `MatchStats \| null` | API（GET /api/users/:id/match-stats） | 战绩汇总统计数据 |
| matchRecords | `MatchRecord[]` | API（GET /api/users/:id/match-records） | 战绩记录列表 |
| sourceTypeFilter | `SourceType \| null` | 用户选择 | 按来源类型筛选（全部/约球活动/团课/私教课），默认 null（全部） |
| isStatsLoading | boolean | API 请求状态 | 汇总数据加载中 |
| isRecordsLoading | boolean | API 请求状态 | 列表加载中 |
| error | string \| null | API 响应 | 加载错误信息 |

> 注：分页由 useInfiniteQuery 内部管理，页面状态中无需显式维护 page 字段。

**调用的后端接口**:

| 接口 | 触发时机 | 成功处理 | 错误处理 |
|------|---------|---------|---------|
| `GET /api/users/:id/match-stats` | 页面加载 | 渲染战绩汇总统计卡片 | 显示默认全 0 汇总 |
| `GET /api/users/:id/match-records` | 页面加载、筛选条件变化、滚动加载更多 | 渲染战绩记录列表 | 显示 PageError 组件 |

**交互流程**:

```
用户从个人主页点击"战绩历史" → 跳转到 /users/:id/match-records
  → 并行加载战绩汇总（GET /api/users/:id/match-stats）+ 战绩列表（GET /api/users/:id/match-records）
  → 渲染页面

页面展示:
  ┌─ 汇总统计区域: 总场次、胜场、负场、平局、胜率
  └─ 战绩列表区域: 按时间倒序排列的战绩记录卡片

来源类型筛选:
  Tab 切换（全部/约球活动/团课/私教课）→ 设置 sourceTypeFilter
  → useInfiniteQuery 重置，从第一页重新加载

战绩卡片展示:
  每条战绩卡片显示:
    - 比赛日期（createdAt 格式化）
    - 来源场地名称（后续可扩展）
    - 比赛类型标识（单打/双打 Tag）
    - 对战双方选手名（A方 vs B方）
    - 每局比分
    - 该用户在本场比赛的结果（userResult: WIN/LOSE/DRAW，用颜色区分）

下拉刷新:
  下拉触发 → 重新加载当前筛选条件的第一页数据

上拉加载更多:
  滚动到底部 → 加载下一页数据（useInfiniteScroll）

返回:
  点击顶部返回按钮 → 返回上一页
```

**组件结构**:

```
MatchRecordHistoryPage
├── MatchStatsCard                # 战绩汇总统计卡片
│   ├── StatItem (总场次)          # 单个统计数值
│   ├── StatItem (胜场)            # 绿色
│   ├── StatItem (负场)            # 红色
│   ├── StatItem (平局)            # 灰色
│   └── WinRateDisplay            # 胜率展示
├── SourceTypeFilter              # 来源类型筛选 Tab（全部/约球/团课/私教）
├── MatchRecordList               # 战绩列表
│   └── HistoryMatchRecordCard    # 单条战绩卡片（含 userResult 标识）
│       ├── PlayerInfo            # 选手信息（A方 vs B方）
│       └── ScoreDisplay          # 每局比分展示
├── EmptyState                    # 无战绩时提示"暂无战绩记录"（共享组件）
└── LoadingSpinner                # 加载中（共享组件）
```

---

## 3. Feature 私有组件

| 组件 | 用途 | 使用页面 |
|------|------|---------|
| MatchTypeSelector | 比赛类型切换按钮组（单打/双打），使用 Ant Design Segmented 或 Radio.Group | CreateMatchRecordPage |
| PlayerSection | 对战双方选手区域容器，根据 matchType 展示不同数量的 PlayerSelector | CreateMatchRecordPage |
| SidePanel | 单方选手面板（A 组/B 组），包含标题和 PlayerSelector 列表 | CreateMatchRecordPage |
| PlayerSelector | 单个选手选择器，支持平台用户下拉选择和非平台用户昵称输入的切换 | CreateMatchRecordPage |
| ParticipantSelect | 参与者下拉选择器（Ant Design Select），数据源为加载的参与者列表 | CreateMatchRecordPage |
| GuestNameInput | 非平台用户昵称输入框 | CreateMatchRecordPage |
| GuestToggle | "非平台用户"开关（Ant Design Switch / Checkbox） | CreateMatchRecordPage |
| ScoreSection | 比分录入区域容器，管理多局比分行的增删 | CreateMatchRecordPage |
| ScoreRow | 单局比分输入行（局号标签 + scoreA 输入框 + scoreB 输入框 + 删除按钮） | CreateMatchRecordPage |
| MatchStatsCard | 战绩汇总统计卡片，展示总场次/胜/负/平/胜率 | MatchRecordHistoryPage |
| StatItem | 单个统计数值展示（标签 + 数字，支持自定义颜色） | MatchRecordHistoryPage |
| WinRateDisplay | 胜率数值展示（百分比格式） | MatchRecordHistoryPage |
| SourceTypeFilter | 来源类型筛选 Tab（全部/约球活动/团课/私教课） | MatchRecordHistoryPage |
| MatchRecordList | 战绩记录列表容器（支持无限滚动） | MatchRecordHistoryPage |
| HistoryMatchRecordCard | 战绩历史列表中的单条战绩卡片（与 activity/coaching feature 的 MatchRecordCard 相似但增加 userResult 颜色标识和来源类型标签） | MatchRecordHistoryPage |

## 4. Feature 私有 Hooks

| Hook | 用途 | 使用页面 |
|------|------|---------|
| useSourceParticipants | 根据 sourceType 和 sourceId 获取参与者列表（activity → GET /api/activities/:id 取 participants；group-class → GET /api/group-classes/:id 取 enrollments；private-lesson → 返回空数组），统一转换为 `{ userId, nickname, avatarUrl }[]` 格式 | CreateMatchRecordPage |
| useCreateMatchRecord | 封装 POST /api/match-records 的 useMutation，处理请求体构建、成功后缓存失效和页面跳转 | CreateMatchRecordPage |
| useMatchRecordHistory | 封装 GET /api/users/:id/match-records 的 useInfiniteQuery（支持 sourceType 筛选），通过 useInfiniteScroll 实现无限滚动 | MatchRecordHistoryPage |
| useMatchStats | 封装 GET /api/users/:id/match-stats 的 useQuery | MatchRecordHistoryPage |

## 5. 消费的后端接口汇总

| 接口 | 提供方 | 调用页面 | 调用场景 |
|------|--------|---------|---------|
| `GET /api/activities/:id` | activity | CreateMatchRecordPage | sourceType='activity' 时加载参与者列表 |
| `GET /api/group-classes/:id` | coaching | CreateMatchRecordPage | sourceType='group-class' 时加载报名学员列表 |
| `POST /api/match-records` | match-record | CreateMatchRecordPage | 提交战绩录入表单 |
| `GET /api/users/:id/match-records` | match-record | MatchRecordHistoryPage | 加载个人战绩历史列表（支持 sourceType 筛选和分页） |
| `GET /api/users/:id/match-stats` | match-record | MatchRecordHistoryPage | 加载个人战绩汇总统计 |

## 6. 关键业务逻辑

### 6.1 前端表单校验规则

```
提交前的前端校验（在调用 POST /api/match-records 之前执行）:

1. sourceType 和 sourceId 必须存在（从 URL 参数获取，缺失则显示错误页面）
2. matchType 必须为 'singles' 或 'doubles'
3. 选手数量校验:
   - singles → sideA 有且仅有 1 个选手，sideB 有且仅有 1 个选手
   - doubles → sideA 有且仅有 2 个选手，sideB 有且仅有 2 个选手
4. 每个选手信息完整性:
   - isGuest=false → userId 不为 null（必须选择一个平台用户）
   - isGuest=true → guestName 不为空，长度不超过 20 字符
5. 选手去重:
   - 所有非空的 userId 不可重复（同一平台用户不可出现在多个位置）
6. 比分校验:
   - games 至少 1 局
   - 每局 scoreA 和 scoreB 均为 0-30 之间的整数
   - 每局 scoreA 和 scoreB 不可同时为 0
7. 校验失败时在对应字段下方显示错误提示（formErrors），不弹出全局消息
```

### 6.2 请求体构建

```
将表单数据转换为 POST /api/match-records 的请求体:

{
  sourceType: sourceType,
  sourceId: sourceId,
  matchType: matchType,
  players: {
    sideA: sideA.map(player =>
      player.isGuest
        ? { guestName: player.guestName }
        : { userId: player.userId }
    ),
    sideB: sideB.map(player =>
      player.isGuest
        ? { guestName: player.guestName }
        : { userId: player.userId }
    )
  },
  games: games.map(game => ({
    scoreA: game.scoreA,
    scoreB: game.scoreB
  }))
}
```

### 6.3 比赛类型切换时的表单重置

```
用户切换 matchType 时:
  单打 → 双打:
    sideA 从 1 个选手位扩展为 2 个（保留第一个，追加一个空的）
    sideB 从 1 个选手位扩展为 2 个（保留第一个，追加一个空的）
  双打 → 单打:
    sideA 截断为 1 个选手位（保留第一个，移除第二个）
    sideB 截断为 1 个选手位（保留第一个，移除第二个）

比分数据保留不变（切换比赛类型不影响已输入的比分）
```

### 6.4 参与者下拉选择器的可选项过滤

```
每个 ParticipantSelect 的可选列表:
  = 完整参与者列表 - 已被其他位置选中的平台用户

具体逻辑:
  1. 收集所有 PlayerSelector 中已选的 userId（排除当前位置）
  2. 从参与者列表中过滤掉已选的 userId
  3. 剩余的参与者作为当前位置的可选项

目的: 防止同一平台用户被选择到多个位置
```

### 6.5 战绩历史列表中的结果颜色标识

```
每条 HistoryMatchRecordCard 根据 userResult 字段显示不同颜色:
  userResult === 'WIN'  → 绿色（#4CAF50）标签"胜"
  userResult === 'LOSE' → 红色（#F44336）标签"负"
  userResult === 'DRAW' → 灰色（#9E9E9E）标签"平"

颜色使用视觉风格中定义的状态色
```

### 6.6 URL 参数缺失处理

```
用户直接访问 /match-records/create（无 sourceType 或 sourceId 查询参数）:
  → 显示错误提示"请从活动或课程详情页进入战绩录入"
  → 不渲染录入表单
  → 提供返回按钮，返回上一页或首页

sourceType 不在 'activity' / 'group-class' / 'private-lesson' 范围内:
  → 同上处理
```

### 6.7 私教课来源的选手选择

```
sourceType = 'private-lesson' 时:
  由于不调用详情接口获取参与者列表，participants 为空数组
  所有选手位置默认为"非平台用户"模式（isGuest=true），展示昵称输入框
  用户也可切换为平台用户模式手动输入 userId（但无下拉选择，需自行确认）

说明:
  私教课通常仅教练和学员两人，场景简单
  参与关系由后端 POST /api/match-records 校验，前端不做参与关系预校验
  如果用户选择了不是参与者的平台用户，后端会返回 MATCH_RECORD_PLAYER_NOT_PARTICIPANT 错误
```

### 6.8 TanStack Query 缓存策略

```
来源活动详情 (GET /api/activities/:id):
  queryKey: ['activity', sourceId]
  说明: 复用 activity feature 已有的 queryKey，如已缓存则直接使用

来源团课详情 (GET /api/group-classes/:id):
  queryKey: ['groupClass', sourceId]
  说明: 复用 coaching feature 已有的 queryKey

个人战绩历史 (GET /api/users/:id/match-records):
  queryKey: ['user-match-records', userId, { sourceType: sourceTypeFilter }]
  staleTime: 30 秒

个人战绩汇总 (GET /api/users/:id/match-stats):
  queryKey: ['user-match-stats', userId]
  staleTime: 30 秒

操作成功后的缓存失效:
  录入战绩成功 →
    invalidate ['activity-match-records', sourceId]（如 sourceType=activity）
    invalidate ['groupClass', sourceId, 'matchRecords']（如 sourceType=group-class）
    invalidate ['user-match-records']（所有用户的战绩历史列表）
    invalidate ['user-match-stats']（所有用户的战绩汇总）
```
