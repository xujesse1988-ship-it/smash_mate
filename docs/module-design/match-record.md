# 模块详细设计: match-record

> 本文档描述 match-record 后端模块的内部设计和接口契约。系统级架构见 architecture.md。

## 1. 模块概述

- **职责**: 战绩录入（单打/双打）、战绩删除、按活动/团课/私教课查看战绩列表、个人战绩历史与汇总统计；非平台用户（临时用户）的存储
- **类型**: 后端模块
- **业务模块映射**: PRD 中的「战绩记录（FD）」
- **依赖层级**: 上层（依赖 user、activity、coaching）

---

## 2. 内部架构

### 分层结构

```
match-record/
├── controller.ts      # 请求处理、参数校验、响应格式化
├── service.ts         # 业务逻辑、规则执行（参与关系校验、胜负判定、统计计算）
├── repository.ts      # 数据访问、Prisma 查询封装
├── types.ts           # 模块内类型定义（比赛类型枚举、来源类型枚举、输入输出类型）
└── index.ts           # 对外导出（公开接口）
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Controller | 接收请求、参数校验、调用 Service、格式化响应 | Service |
| Service | 业务逻辑（参与关系校验、胜负判定、战绩统计计算）、调用外部模块 Service 校验来源和参与者 | Repository, UserService, ActivityService, CoachingService, infra（logger） |
| Repository | 数据库操作、Prisma 查询封装（含统计聚合查询） | Prisma Client（infra） |

### 控制流

```
HTTP 请求 → Controller（校验）→ Service（业务逻辑）→ Repository（数据访问）→ 响应
```

---

## 3. 数据模型

### MatchRecord

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| sourceType | string (enum) | NOT NULL | 来源类型（见下方枚举） |
| sourceId | string (uuid) | NOT NULL | 来源 ID（活动/团课/私教课的 ID） |
| matchType | string (enum) | NOT NULL | 比赛类型（见下方枚举） |
| recordedBy | string (uuid) | NOT NULL, FK → User.id | 录入者用户 ID |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### MatchPlayer

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| matchRecordId | string (uuid) | NOT NULL, FK → MatchRecord.id, ON DELETE CASCADE | 关联的战绩记录 ID |
| side | string (enum) | NOT NULL | 所属方（'A' 或 'B'） |
| userId | string (uuid) \| null | FK → User.id | 平台用户 ID（与 guestId 二选一） |
| guestId | string (uuid) \| null | FK → GuestPlayer.id | 临时用户 ID（与 userId 二选一） |

**约束**: `CHECK (userId IS NOT NULL OR guestId IS NOT NULL)` — 每个选手至少有一个身份标识
**约束**: `CHECK (NOT (userId IS NOT NULL AND guestId IS NOT NULL))` — userId 和 guestId 互斥

### GuestPlayer

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| nickname | string | NOT NULL | 临时用户昵称 |
| createdAt | datetime | NOT NULL | 创建时间 |

### MatchGame

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| matchRecordId | string (uuid) | NOT NULL, FK → MatchRecord.id, ON DELETE CASCADE | 关联的战绩记录 ID |
| gameNumber | int | NOT NULL | 局号（从 1 开始） |
| scoreA | int | NOT NULL | A 方得分（0-30） |
| scoreB | int | NOT NULL | B 方得分（0-30） |

**唯一约束**: `(matchRecordId, gameNumber)` 联合唯一（同一战绩记录中局号不可重复）
**约束**: `CHECK (scoreA >= 0 AND scoreA <= 30)` — A 方得分在 0-30 范围内
**约束**: `CHECK (scoreB >= 0 AND scoreB <= 30)` — B 方得分在 0-30 范围内
**约束**: `CHECK (NOT (scoreA = 0 AND scoreB = 0))` — 单局比分不可同时为 0

### 来源类型枚举（sourceType）

| 枚举值 | 说明 |
|--------|------|
| activity | 约球活动 |
| group-class | 团课 |
| private-lesson | 私教课 |

### 比赛类型枚举（matchType）

| 枚举值 | 说明 |
|--------|------|
| singles | 单打（1v1） |
| doubles | 双打（2v2） |

### 索引

- `MatchRecord.sourceType, MatchRecord.sourceId` -- 联合索引（按来源查询战绩列表）
- `MatchRecord.recordedBy` -- 索引（查询用户录入的战绩，用于删除权限校验）
- `MatchPlayer.matchRecordId` -- 索引（查询战绩的选手）
- `MatchPlayer.userId` -- 索引（查询某用户参与的所有战绩，用于个人战绩历史和统计）
- `MatchGame.matchRecordId` -- 索引（查询战绩的所有局）
- `MatchGame.(matchRecordId, gameNumber)` -- UNIQUE 联合索引（防止重复局号）

### 模型关系

```
MatchRecord 1 ← N MatchPlayer（一条战绩记录有多个选手）
MatchRecord 1 ← N MatchGame（一条战绩记录有多局比分）
User 1 ← N MatchPlayer（一个用户可参与多条战绩，通过 userId）
GuestPlayer 1 ← N MatchPlayer（一个临时用户可参与多条战绩，通过 guestId）
User 1 ← N MatchRecord（一个用户可录入多条战绩，通过 recordedBy）
```

### 与其他模块数据的关系

- MatchRecord.recordedBy 引用 User（user 模块）的主键
- MatchPlayer.userId 引用 User（user 模块）的主键
- MatchRecord.sourceId 通过多态关联关联到 Activity（activity 模块）、GroupClass（coaching 模块）、PrivateLesson（coaching 模块），**无物理外键**，通过 sourceType 区分
- Activity.id / GroupClass.id / PrivateLesson.id 的存在性通过接口调用验证，不直接访问其他模块的表

---

## 4. 接口契约

> 每个接口必须包含五要素：**输入、输出、业务规则、错误码、consumers**。
> 接口通用约定（认证方式、响应格式、分页、HTTP 状态码）见 architecture.md。

### 录入战绩

`POST /api/match-records`

**描述**: 录入一条比赛战绩记录（关联到某次活动/团课/私教课）

**认证**: 需要

**Consumers**: web-app（战绩录入页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sourceType | string | 是 | 来源类型：'activity' / 'group-class' / 'private-lesson' |
| sourceId | string (uuid) | 是 | 来源 ID |
| matchType | string | 是 | 比赛类型：'singles' / 'doubles' |
| players | object | 是 | 对战双方选手信息（见下方说明） |
| games | array | 是 | 每局比分（至少 1 局） |

**players 结构**:

```typescript
{
  sideA: PlayerInput[];  // A 方选手列表
  sideB: PlayerInput[];  // B 方选手列表
}

// PlayerInput:
{
  userId?: string;       // 平台用户 ID（与 guestName 二选一）
  guestName?: string;    // 非平台用户昵称（与 userId 二选一）
}
```

**games 结构**:

```typescript
Array<{
  scoreA: number;  // A 方得分（0-30）
  scoreB: number;  // B 方得分（0-30）
}>
```

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "sourceType": "activity",
    "sourceId": "uuid",
    "matchType": "singles",
    "recordedBy": "uuid",
    "players": {
      "sideA": [
        { "userId": "uuid", "nickname": "张三", "avatarUrl": "https://..." }
      ],
      "sideB": [
        { "guestId": "uuid", "nickname": "临时球友A" }
      ]
    },
    "games": [
      { "gameNumber": 1, "scoreA": 21, "scoreB": 18 },
      { "gameNumber": 2, "scoreA": 21, "scoreB": 15 }
    ],
    "result": "A_WIN",
    "createdAt": "2026-04-05T18:30:00.000Z"
  }
}
```

**业务规则**:
- 录入者必须是该活动/课程的参与者（通过 ActivityService.getParticipantIds 或 CoachingService.getParticipantIds 校验）
- sourceType 为 'activity' 时：调用 ActivityService.getActivityById(sourceId) 验证活动存在且状态为 completed（已结束）
- sourceType 为 'group-class' 时：调用 CoachingService.getGroupClassById(sourceId) 验证团课存在且状态为 completed
- sourceType 为 'private-lesson' 时：调用 CoachingService.getPrivateLessonById(sourceId) 验证私教课存在且状态为 completed
- 单打模式：sideA 和 sideB 各有且仅有 1 名选手
- 双打模式：sideA 和 sideB 各有且仅有 2 名选手
- 每个 PlayerInput 必须提供 userId 或 guestName 其中之一（不可同时提供或同时为空）
- userId 对应的用户必须是该活动/课程的参与者（通过 ActivityService.getParticipantIds 或 CoachingService.getParticipantIds 校验）
- guestName 不为空且长度不超过 20 字符
- games 至少有 1 局，不限上限
- 每局 scoreA 和 scoreB 为 0-30 之间的整数，且不可同时为 0
- 胜负判定：赢得多数局的一方为胜方；若总局数为偶数且双方胜局数相同，记为平局
- 非平台用户（guestName）在录入时自动创建 GuestPlayer 记录
- 同一选手不可出现在 sideA 和 sideB 中（userId 不可重复出现在两侧）
- 一期不需要对方确认，录入即生效

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | MATCH_RECORD_INVALID_SOURCE_TYPE | sourceType 不在枚举范围内 |
| 400 | MATCH_RECORD_INVALID_MATCH_TYPE | matchType 不在枚举范围内 |
| 400 | MATCH_RECORD_INVALID_PLAYERS | 选手数量不符合比赛类型要求（单打各1人、双打各2人） |
| 400 | MATCH_RECORD_INVALID_PLAYER | 选手信息不合法（userId 和 guestName 同时提供或同时为空） |
| 400 | MATCH_RECORD_INVALID_GUEST_NAME | guestName 为空或超过 20 字符 |
| 400 | MATCH_RECORD_INVALID_GAMES | games 为空或非数组 |
| 400 | MATCH_RECORD_INVALID_SCORE | 单局比分不在 0-30 范围内，或双方同时为 0 |
| 400 | MATCH_RECORD_DUPLICATE_PLAYER | 同一选手出现在两侧 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | MATCH_RECORD_NOT_PARTICIPANT | 录入者不是该活动/课程的参与者 |
| 403 | MATCH_RECORD_PLAYER_NOT_PARTICIPANT | 指定的平台用户选手不是该活动/课程的参与者 |
| 404 | MATCH_RECORD_SOURCE_NOT_FOUND | 来源活动/课程不存在 |
| 409 | MATCH_RECORD_SOURCE_NOT_COMPLETED | 来源活动/课程尚未结束（状态不是 completed） |

---

### 删除战绩

`DELETE /api/match-records/:id`

**描述**: 删除一条战绩记录（仅录入者可删除）

**认证**: 需要

**Consumers**: web-app（活动详情页战绩列表）

**Path Parameters**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 战绩记录 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid"
  }
}
```

**业务规则**:
- 仅录入者（recordedBy === 当前用户 ID）可删除战绩
- 删除战绩时级联删除关联的 MatchPlayer 和 MatchGame 记录（通过 ON DELETE CASCADE）
- 删除后相关平台用户的战绩汇总自动更新（汇总为实时计算，无需额外操作）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | MATCH_RECORD_NOT_RECORDER | 当前用户不是该战绩的录入者 |
| 404 | MATCH_RECORD_NOT_FOUND | 战绩记录不存在 |

---

### 活动的战绩列表

`GET /api/activities/:id/match-records`

**描述**: 获取某个约球活动下的所有战绩记录

**认证**: 需要

**Consumers**: web-app（活动详情页）

**Path Parameters**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 活动 ID |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "sourceType": "activity",
        "sourceId": "uuid",
        "matchType": "singles",
        "recordedBy": "uuid",
        "recorder": {
          "id": "uuid",
          "nickname": "王五",
          "avatarUrl": "https://..."
        },
        "players": {
          "sideA": [
            { "userId": "uuid", "nickname": "张三", "avatarUrl": "https://..." }
          ],
          "sideB": [
            { "guestId": "uuid", "nickname": "临时球友A" }
          ]
        },
        "games": [
          { "gameNumber": 1, "scoreA": 21, "scoreB": 18 },
          { "gameNumber": 2, "scoreA": 21, "scoreB": 15 }
        ],
        "result": "A_WIN",
        "createdAt": "2026-04-05T18:30:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 返回 sourceType = 'activity' 且 sourceId = :id 的所有战绩记录
- 按 createdAt 倒序排列
- 每条记录包含选手信息（平台用户含 nickname、avatarUrl；临时用户含 nickname）和每局比分
- 一期不做分页，返回全部记录（单个活动的战绩数量有限）
- 不校验活动是否存在，不存在时返回空列表

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 团课的战绩列表

`GET /api/group-classes/:id/match-records`

**描述**: 获取某个团课下的所有战绩记录

**认证**: 需要

**Consumers**: web-app（团课详情页）

**Path Parameters**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 团课 ID |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "sourceType": "group-class",
        "sourceId": "uuid",
        "matchType": "doubles",
        "recordedBy": "uuid",
        "recorder": {
          "id": "uuid",
          "nickname": "李四",
          "avatarUrl": null
        },
        "players": {
          "sideA": [
            { "userId": "uuid", "nickname": "张三", "avatarUrl": "https://..." },
            { "userId": "uuid", "nickname": "李四", "avatarUrl": null }
          ],
          "sideB": [
            { "userId": "uuid", "nickname": "王五", "avatarUrl": "https://..." },
            { "guestId": "uuid", "nickname": "临时球友B" }
          ]
        },
        "games": [
          { "gameNumber": 1, "scoreA": 21, "scoreB": 19 },
          { "gameNumber": 2, "scoreA": 18, "scoreB": 21 },
          { "gameNumber": 3, "scoreA": 21, "scoreB": 17 }
        ],
        "result": "A_WIN",
        "createdAt": "2026-04-06T20:00:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 返回 sourceType = 'group-class' 且 sourceId = :id 的所有战绩记录
- 按 createdAt 倒序排列
- 一期不做分页，返回全部记录
- 不校验团课是否存在，不存在时返回空列表

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 私教课的战绩列表

`GET /api/private-lessons/:id/match-records`

**描述**: 获取某个私教课下的所有战绩记录

**认证**: 需要

**Consumers**: web-app（私教课详情相关页面）

**Path Parameters**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 私教课 ID |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "sourceType": "private-lesson",
        "sourceId": "uuid",
        "matchType": "singles",
        "recordedBy": "uuid",
        "recorder": {
          "id": "uuid",
          "nickname": "张三",
          "avatarUrl": "https://..."
        },
        "players": {
          "sideA": [
            { "userId": "uuid", "nickname": "张三", "avatarUrl": "https://..." }
          ],
          "sideB": [
            { "userId": "uuid", "nickname": "教练A", "avatarUrl": "https://..." }
          ]
        },
        "games": [
          { "gameNumber": 1, "scoreA": 15, "scoreB": 21 }
        ],
        "result": "B_WIN",
        "createdAt": "2026-04-07T11:00:00.000Z"
      }
    ]
  }
}
```

**业务规则**:
- 返回 sourceType = 'private-lesson' 且 sourceId = :id 的所有战绩记录
- 按 createdAt 倒序排列
- 一期不做分页，返回全部记录
- 不校验私教课是否存在，不存在时返回空列表

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 个人战绩历史

`GET /api/users/:id/match-records`

**描述**: 获取某个用户参与的所有战绩记录（个人战绩历史列表）

**认证**: 需要

**Consumers**: web-app（个人主页 - 战绩历史列表页）

**Path Parameters**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 用户 ID |

**Query Parameters**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 20，最大 100 |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "sourceType": "activity",
        "sourceId": "uuid",
        "matchType": "singles",
        "recordedBy": "uuid",
        "recorder": {
          "id": "uuid",
          "nickname": "王五",
          "avatarUrl": "https://..."
        },
        "players": {
          "sideA": [
            { "userId": "uuid", "nickname": "张三", "avatarUrl": "https://..." }
          ],
          "sideB": [
            { "userId": "uuid", "nickname": "李四", "avatarUrl": null }
          ]
        },
        "games": [
          { "gameNumber": 1, "scoreA": 21, "scoreB": 18 },
          { "gameNumber": 2, "scoreA": 19, "scoreB": 21 },
          { "gameNumber": 3, "scoreA": 21, "scoreB": 16 }
        ],
        "result": "A_WIN",
        "userResult": "WIN",
        "createdAt": "2026-04-05T18:30:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

**业务规则**:
- 返回 MatchPlayer.userId = :id 的所有关联战绩记录
- 按 createdAt 倒序排列
- 支持分页（page 从 1 开始，pageSize 默认 20，最大 100）
- 每条记录额外包含 `userResult` 字段，表示该用户在这场比赛中的结果（'WIN' / 'LOSE' / 'DRAW'）
- 任何已登录用户均可查看其他用户的战绩历史（公开数据）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 个人战绩汇总

`GET /api/users/:id/match-stats`

**描述**: 获取某个用户的战绩汇总统计数据

**认证**: 需要

**Consumers**: web-app（个人主页 - 战绩汇总展示）

**Path Parameters**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 用户 ID |

**Response 200**:
```json
{
  "data": {
    "totalMatches": 42,
    "wins": 25,
    "losses": 15,
    "draws": 2,
    "winRate": 62.5
  }
}
```

**业务规则**:
- 统计该用户作为平台用户（MatchPlayer.userId = :id）参与的所有战绩
- totalMatches = wins + losses + draws（总场次）
- wins：用户所在方赢得多数局的场次
- losses：用户所在方输掉多数局的场次
- draws：总局数为偶数且双方胜局数相同的场次
- winRate = wins / (wins + losses) * 100，保留一位小数；若 wins + losses = 0 则 winRate 为 0
- 仅统计平台用户的数据，临时用户不生成汇总
- 任何已登录用户均可查看其他用户的战绩汇总（公开数据）
- 用户无战绩时返回全 0 的汇总数据（不返回 404）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 内部接口（跨模块 Service 调用）

> 非 HTTP 暴露的接口。用于其他模块的 Service 层直接调用本模块的 Service。

当前 match-record 模块无需向其他模块暴露内部 Service 接口。match-record 为上层模块，无下游消费方。个人战绩汇总数据通过 HTTP API `GET /api/users/:id/match-stats` 由前端直接调用，不需要其他后端模块通过 Service 层调用。

---

## 5. 消费的外部接口

| 接口 | 提供方 | 调用场景 |
|------|--------|---------|
| ActivityService.getActivityById(id) | activity | 录入战绩时验证活动存在性和状态（必须为 completed） |
| ActivityService.getParticipantIds(activityId) | activity | 录入战绩时校验录入者和选手是否为活动参与者 |
| CoachingService.getGroupClassById(id) | coaching | 录入战绩时验证团课存在性和状态（必须为 completed） |
| CoachingService.getPrivateLessonById(id) | coaching | 录入战绩时验证私教课存在性和状态（必须为 completed） |
| CoachingService.getParticipantIds(classId, type) | coaching | 录入战绩时校验录入者和选手是否为课程参与者 |
| UserService.getUsersByIds(ids) | user | 战绩列表和详情中批量获取平台用户的 nickname、avatarUrl |

---

## 6. 关键业务逻辑

### 6.1 胜负判定算法

```
输入: games（每局比分列表）
输出: 'A_WIN' | 'B_WIN' | 'DRAW'

逻辑:
1. 遍历所有局，统计 A 方和 B 方各赢的局数:
   - scoreA > scoreB → A 赢一局
   - scoreB > scoreA → B 赢一局
   - scoreA === scoreB → 该局平局，不计入任何一方胜局数
2. 比较双方胜局数:
   - winsA > winsB → A_WIN
   - winsB > winsA → B_WIN
   - winsA === winsB → DRAW（包含总局数为奇数但因单局平局导致双方胜局数相同的情况）
```

### 6.2 个人战绩结果判定

```
输入: matchResult（A_WIN / B_WIN / DRAW）, userSide（用户所在方 'A' 或 'B'）
输出: 'WIN' | 'LOSE' | 'DRAW'

逻辑:
- matchResult === 'DRAW' → 'DRAW'
- matchResult === 'A_WIN' && userSide === 'A' → 'WIN'
- matchResult === 'A_WIN' && userSide === 'B' → 'LOSE'
- matchResult === 'B_WIN' && userSide === 'A' → 'LOSE'
- matchResult === 'B_WIN' && userSide === 'B' → 'WIN'
```

### 6.3 战绩统计计算

```
输入: userId
输出: { totalMatches, wins, losses, draws, winRate }

计算方式（实时查询，不存储冗余字段）:
1. 查询 MatchPlayer.userId === userId 的所有 matchRecordId
2. 对每条 matchRecord:
   a. 确定用户所在方（side）
   b. 计算 matchResult（通过胜负判定算法）
   c. 计算 userResult（通过个人战绩结果判定）
3. 汇总:
   - wins = userResult === 'WIN' 的数量
   - losses = userResult === 'LOSE' 的数量
   - draws = userResult === 'DRAW' 的数量
   - totalMatches = wins + losses + draws
   - winRate = (wins + losses) > 0 ? round(wins / (wins + losses) * 100, 1) : 0

优化:
- 使用 SQL 聚合查询在数据库层完成统计，避免将全量数据加载到应用层
- 查询 MatchPlayer JOIN MatchGame，在 SQL 层完成胜局数统计和胜负判定
```

### 6.4 录入战绩参与者校验流程

```
1. 根据 sourceType 调用对应模块获取来源信息:
   - activity → ActivityService.getActivityById(sourceId)
   - group-class → CoachingService.getGroupClassById(sourceId)
   - private-lesson → CoachingService.getPrivateLessonById(sourceId)

2. 校验来源存在（返回值不为 null），否则返回 MATCH_RECORD_SOURCE_NOT_FOUND

3. 校验来源状态为 completed，否则返回 MATCH_RECORD_SOURCE_NOT_COMPLETED

4. 获取参与者 ID 列表:
   - activity → ActivityService.getParticipantIds(sourceId)
   - group-class → CoachingService.getParticipantIds(sourceId, 'group-class')
   - private-lesson → CoachingService.getParticipantIds(sourceId, 'private-lesson')

5. 校验录入者（当前用户 ID）在参与者列表中，否则返回 MATCH_RECORD_NOT_PARTICIPANT

6. 校验 players 中所有 userId 类型的选手都在参与者列表中，否则返回 MATCH_RECORD_PLAYER_NOT_PARTICIPANT
```

### 6.5 非平台用户（GuestPlayer）创建流程

```
录入战绩时，对 players 中的每个 guestName:
1. 创建新的 GuestPlayer 记录（nickname = guestName）
2. 使用生成的 guestId 创建 MatchPlayer 记录

注意:
- 每次录入都创建新的 GuestPlayer，不进行昵称去重（不同场次中同名的临时用户可能是不同的人）
- GuestPlayer 仅在战绩中显示，不支持搜索查找
- GuestPlayer 不参与战绩汇总统计
```

---

## 7. 模块特有约定

### 安全要求
- 删除战绩必须校验 recordedBy === 当前用户 ID，非录入者不可删除
- 战绩列表和统计为公开数据，任何已登录用户均可查看
- 录入战绩必须校验录入者为来源活动/课程的参与者

### 性能约束
- 个人战绩汇总接口使用 SQL 聚合查询在数据库层完成统计，不加载全量战绩数据到应用层
- 战绩列表中的选手信息通过 Prisma relation 或 JOIN 获取 MatchPlayer 和 GuestPlayer 数据，不逐条查询
- 平台用户信息（nickname、avatarUrl）通过 UserService.getUsersByIds 批量获取，不逐条调用
- 个人战绩历史支持分页控制返回数据量

### 并发控制
- 录入战绩无并发冲突风险（一期不做重复录入校验，由用户自行判断和处理）
- 删除战绩使用主键定位，无并发问题

### 错误处理
- HTTP 接口的错误通过抛出带 error code 的异常，由 infra/error-handler.ts 统一处理
- 外部 Service 调用返回 null 时（来源不存在），转换为对应的业务错误码返回

### 日志策略
- 录入战绩：info 级别记录 sourceType、sourceId、matchType、recordedBy（前 8 位）
- 删除战绩：info 级别记录 matchRecordId、recordedBy（前 8 位）
- 查询战绩列表和统计：不记录 info 日志（读操作不产生副作用）
- 外部 Service 调用失败：warn 级别记录调用详情

---

## 8. 已知限制和 TODO

- 一期不需要对方确认，录入即生效
- 一期不做重复战绩校验（用户通过删除后重新录入处理冲突）
- 一期来源活动/课程的战绩列表不做分页（单个来源的战绩数量有限）
- 一期 GuestPlayer 不做昵称去重（每次录入创建新记录）
- 一期战绩汇总实时计算，不存储冗余统计字段；数据量大时可考虑缓存或预计算
- 一期 MatchRecord.sourceId 为多态关联，无物理外键约束，数据一致性依赖应用层校验
- TODO: 二期可考虑战绩双方确认机制
- TODO: 二期可考虑战绩修改功能（当前只支持删除后重新录入）
- TODO: 二期可考虑战绩汇总缓存或预计算优化
- TODO: 二期可考虑来源活动/课程的战绩列表分页
