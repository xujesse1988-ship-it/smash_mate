# 模块详细设计: review

> 本文档描述 review 后端模块的内部设计和接口契约。系统级架构见 architecture.md。

## 1. 模块概述

- **职责**: 学员对教练提交评价评分、评价列表查询、教练平均评分与评价数量计算
- **类型**: 后端模块
- **业务模块映射**: PRD 中的「评价评分（FG）」
- **依赖层级**: 上层（依赖 user、coaching、notification）

---

## 2. 内部架构

### 分层结构

```
review/
├── controller.ts      # 请求处理、参数校验、响应格式化
├── service.ts         # 业务逻辑、规则执行、通知发送编排
├── repository.ts      # 数据访问、Prisma 查询封装
├── types.ts           # 模块内类型定义（课程类型枚举、输入输出类型）
└── index.ts           # 对外导出（公开接口）
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Controller | 接收请求、参数校验、调用 Service、格式化响应 | Service |
| Service | 业务逻辑（评价提交、列表查询、评分计算）、通知发送编排 | Repository, UserService, CoachingService, NotificationService, infra（logger） |
| Repository | 数据库操作、Prisma 查询封装 | Prisma Client（infra） |

### 控制流

```
HTTP 请求 → Controller（校验）→ Service（业务逻辑）→ Repository（数据访问）→ 响应
```

---

## 3. 数据模型

### Review

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| reviewerId | string (uuid) | NOT NULL, FK → User.id | 评价者（学员）用户 ID |
| coachId | string (uuid) | NOT NULL, FK → User.id | 被评价的教练用户 ID |
| courseType | string (enum) | NOT NULL | 课程类型：group-class / private-lesson |
| courseId | string (uuid) | NOT NULL | 课程 ID（团课 ID 或私教课 ID） |
| rating | int | NOT NULL | 评分（1-5 整数） |
| comment | string \| null | | 文字评价（最长 500 字符，可选） |
| createdAt | datetime | NOT NULL | 创建时间 |

**唯一约束**: `(reviewerId, courseType, courseId)` 联合唯一（同一学员对同一次课程只能评价一次）

### 索引

- `Review.(reviewerId, courseType, courseId)` — UNIQUE 联合索引（防止重复评价）
- `Review.coachId` — 索引（查询教练的所有评价、计算平均分）
- `Review.(coachId, createdAt)` — 联合索引（教练评价列表按时间倒序分页查询）

### 模型关系

```
User 1 ← N Review（一个学员可提交多条评价，通过 reviewerId）
User 1 ← N Review（一个教练可收到多条评价，通过 coachId）
```

### 与其他模块数据的关系

- Review.reviewerId 引用 User（user 模块）的主键
- Review.coachId 引用 User（user 模块）的主键
- Review.courseId 引用 GroupClass（coaching 模块）或 PrivateLesson（coaching 模块）的主键，通过 courseType 区分（多态引用，无物理外键约束）

---

## 4. 接口契约

> 每个接口必须包含五要素：**输入、输出、业务规则、错误码、consumers**。
> 接口通用约定（认证方式、响应格式、分页、HTTP 状态码）见 architecture.md。

### 提交评价

`POST /api/reviews`

**描述**: 学员对教练的某次课程（团课或私教课）提交评价评分

**认证**: 需要

**Consumers**: web-app（教练主页 -- 提交评价）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| coachId | string (uuid) | 是 | 被评价的教练用户 ID |
| courseType | string | 是 | 课程类型：group-class / private-lesson |
| courseId | string (uuid) | 是 | 课程 ID |
| rating | number | 是 | 评分（1-5 整数） |
| comment | string | 否 | 文字评价（最长 500 字符） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "reviewerId": "uuid",
    "coachId": "uuid",
    "courseType": "group-class",
    "courseId": "uuid",
    "rating": 5,
    "comment": "教练讲解很细致，推荐！",
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**业务规则**:
- 当前用户（从 JWT 解析 userId）为评价者（reviewerId）
- 校验 coachId 对应的用户存在且为教练角色（isCoach = true），否则返回 REVIEW_COACH_NOT_FOUND
- 根据 courseType 校验课程存在：
  - courseType = group-class → 调用 CoachingService.getGroupClassById(courseId)
  - courseType = private-lesson → 调用 CoachingService.getPrivateLessonById(courseId)
  - 课程不存在返回 REVIEW_COURSE_NOT_FOUND
- 校验课程所属教练与 coachId 一致（课程的 coachId === 请求中的 coachId），否则返回 REVIEW_COURSE_COACH_MISMATCH
- 校验课程状态为 completed（已结束），否则返回 REVIEW_COURSE_NOT_COMPLETED
- 调用 CoachingService.getParticipantIds(courseId, courseType) 校验当前用户是课程参与者，否则返回 REVIEW_NOT_PARTICIPANT
- 学员不可评价自己（reviewerId !== coachId），否则返回 REVIEW_CANNOT_REVIEW_SELF
- 校验唯一约束（reviewerId + courseType + courseId），重复评价返回 REVIEW_DUPLICATE
- 评价创建成功后，通过 NotificationService.create() 通知教练：
  - type: REVIEW_RECEIVED
  - title: 收到新评价
  - content: {学员昵称} 对你的课程「{课程名称}」发表了评价
  - targetType: coach-profile
  - targetId: coachId
  - 通知创建失败不阻塞主流程，记录 error 日志后继续

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | REVIEW_INVALID_COACH_ID | coachId 缺失或格式不合法 |
| 400 | REVIEW_INVALID_COURSE_TYPE | courseType 不在枚举范围内（group-class / private-lesson） |
| 400 | REVIEW_INVALID_COURSE_ID | courseId 缺失或格式不合法 |
| 400 | REVIEW_INVALID_RATING | rating 不在 1-5 范围内或非整数 |
| 400 | REVIEW_INVALID_COMMENT | comment 超过 500 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | REVIEW_NOT_PARTICIPANT | 当前用户不是该课程的参与者 |
| 403 | REVIEW_CANNOT_REVIEW_SELF | 学员尝试评价自己（reviewerId === coachId） |
| 404 | REVIEW_COACH_NOT_FOUND | coachId 对应的用户不存在或不是教练角色 |
| 404 | REVIEW_COURSE_NOT_FOUND | 课程不存在 |
| 409 | REVIEW_COURSE_COACH_MISMATCH | 课程所属教练与 coachId 不一致 |
| 409 | REVIEW_COURSE_NOT_COMPLETED | 课程尚未结束（状态不是 completed） |
| 409 | REVIEW_DUPLICATE | 同一学员对同一次课程已评价过 |

---

### 教练评价列表

`GET /api/coaches/:id/reviews`

**描述**: 获取指定教练的评价列表，支持分页，按时间倒序展示

**认证**: 需要

**Consumers**: web-app（教练主页 -- 评价列表）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 教练用户 ID |

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页条数（默认 20，最大 100） |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "reviewer": {
          "id": "uuid",
          "nickname": "张三",
          "avatarUrl": "https://example.com/avatar.jpg"
        },
        "courseType": "group-class",
        "courseId": "uuid",
        "rating": 5,
        "comment": "教练讲解很细致，推荐！",
        "createdAt": "2026-04-02T10:00:00.000Z"
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 20
  }
}
```

**业务规则**:
- 任何已登录用户均可查看教练的评价列表（公开信息）
- 按 createdAt 倒序排列（最新评价在前）
- 当 coachId 对应的用户不存在时，返回空列表（不暴露用户是否存在）
- 评价者信息（reviewer）通过 UserService.getUsersByIds() 批量获取 nickname 和 avatarUrl
- 如果评价者用户已被删除（getUsersByIds 中未返回），reviewer 字段返回 `{ id: "uuid", nickname: "已注销用户", avatarUrl: null }`

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 内部接口（跨模块 Service 调用）

> 非 HTTP 暴露的接口。用于其他模块的 Service 层直接调用本模块的 Service。

#### ReviewService.getCoachAverageRating(coachId)

**描述**: 计算并返回指定教练的平均评分（供前端在教练主页/教练列表聚合展示）

**Consumers**: web-app（通过 HTTP 接口间接调用，见下方说明）

> 说明：architecture.md 决策 6 规定教练评分由 review 模块实时计算，前端在教练主页聚合展示。此内部接口供 coaching 模块的教练主页接口和教练列表接口在 Service 层调用，以便在同一响应中返回评分数据。但由于 coaching 模块为中间层，不可依赖上层的 review 模块（architecture.md 3.2 依赖规则）。因此，此接口改为通过独立的 HTTP 接口暴露（见下方 `GET /api/coaches/:id/rating`），由前端直接调用聚合。

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| coachId | string | 是 | 教练用户 ID (uuid) |

**返回值**:
```typescript
{
  averageRating: number | null;  // 平均评分（保留一位小数），无评价时为 null
  totalCount: number;            // 评价总数
}
```

**业务规则**:
- 平均评分 = 所有评价的 rating 算术平均值，保留一位小数（四舍五入）
- 无评价时 averageRating 为 null，totalCount 为 0
- 教练不存在时同样返回 `{ averageRating: null, totalCount: 0 }`（不抛错）

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 始终返回结果，不抛错 |

---

#### ReviewService.getCoachReviewCount(coachId)

**描述**: 获取指定教练的评价数量

**Consumers**: web-app（通过 HTTP 接口间接调用）

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| coachId | string | 是 | 教练用户 ID (uuid) |

**返回值**:
```typescript
number  // 评价数量
```

**业务规则**:
- 教练不存在时返回 0（不抛错）

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 始终返回结果，不抛错 |

---

### 教练评分查询

`GET /api/coaches/:id/rating`

**描述**: 获取指定教练的平均评分和评价数量，供前端在教练主页和教练列表聚合展示

**认证**: 需要

**Consumers**: web-app（教练主页、教练列表）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 教练用户 ID |

**Response 200**:
```json
{
  "data": {
    "coachId": "uuid",
    "averageRating": 4.5,
    "totalCount": 15
  }
}
```

无评价时：
```json
{
  "data": {
    "coachId": "uuid",
    "averageRating": null,
    "totalCount": 0
  }
}
```

**业务规则**:
- 任何已登录用户均可查询教练评分（公开信息）
- 平均评分 = 所有评价的 rating 算术平均值，保留一位小数（四舍五入）
- 无评价时 averageRating 为 null，totalCount 为 0（前端显示"暂无评价"）
- 当 coachId 对应的用户不存在时，返回 `{ averageRating: null, totalCount: 0 }`（不暴露用户是否存在）
- 内部调用 ReviewService.getCoachAverageRating(coachId)

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 批量教练评分查询

`POST /api/coaches/ratings`

**描述**: 批量获取多个教练的平均评分和评价数量，供前端教练列表页一次性获取所有教练的评分

**认证**: 需要

**Consumers**: web-app（教练列表页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| coachIds | string[] | 是 | 教练用户 ID 列表（最多 100 个） |

**Response 200**:
```json
{
  "data": {
    "ratings": [
      {
        "coachId": "uuid-1",
        "averageRating": 4.5,
        "totalCount": 15
      },
      {
        "coachId": "uuid-2",
        "averageRating": null,
        "totalCount": 0
      }
    ]
  }
}
```

**业务规则**:
- 任何已登录用户均可查询（公开信息）
- 对每个 coachId 调用 ReviewService.getCoachAverageRating() 获取评分
- 不存在的 coachId 也会返回对应结果（averageRating: null, totalCount: 0）
- 返回顺序与输入 coachIds 顺序一致
- coachIds 为空数组时返回空 ratings 数组

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | REVIEW_INVALID_COACH_IDS | coachIds 缺失、非数组或超过 100 个 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

## 5. 消费的外部接口

| 接口 | 提供方 | 调用场景 |
|------|--------|---------|
| UserService.getUserById(id) | user | 提交评价时校验教练用户存在且为教练角色；获取学员昵称用于通知文案 |
| UserService.getUsersByIds(ids) | user | 评价列表中批量获取评价者昵称和头像 |
| CoachingService.getGroupClassById(id) | coaching | 提交评价时校验团课存在、状态、所属教练 |
| CoachingService.getPrivateLessonById(id) | coaching | 提交评价时校验私教课存在、状态、所属教练 |
| CoachingService.getParticipantIds(classId, type) | coaching | 提交评价时校验学员是否为课程参与者 |
| NotificationService.create(notification) | notification | 提交评价后通知教练收到新评价 |

---

## 6. 关键业务逻辑

### 6.1 提交评价流程

```
用户请求 POST /api/reviews:
1. Controller 校验请求参数格式（coachId、courseType、courseId、rating、comment）
2. Service 校验教练存在且为教练角色：
   - 调用 UserService.getUserById(coachId)
   - 返回 null 或 isCoach !== true → REVIEW_COACH_NOT_FOUND
3. Service 校验学员不可评价自己：
   - reviewerId === coachId → REVIEW_CANNOT_REVIEW_SELF
4. Service 校验课程存在：
   - courseType = 'group-class' → CoachingService.getGroupClassById(courseId)
   - courseType = 'private-lesson' → CoachingService.getPrivateLessonById(courseId)
   - 返回 null → REVIEW_COURSE_NOT_FOUND
5. Service 校验课程所属教练：
   - 课程的 coachId !== 请求中的 coachId → REVIEW_COURSE_COACH_MISMATCH
6. Service 校验课程状态：
   - 课程 status !== 'completed' → REVIEW_COURSE_NOT_COMPLETED
7. Service 校验参与关系：
   - 调用 CoachingService.getParticipantIds(courseId, courseType)
   - 当前用户 ID 不在返回列表中 → REVIEW_NOT_PARTICIPANT
8. Service 校验唯一性：
   - Repository 查询 (reviewerId, courseType, courseId) 是否已存在
   - 已存在 → REVIEW_DUPLICATE
9. Repository 创建 Review 记录
10. Service 发送通知（try-catch 包裹，失败不阻塞）：
    - 调用 UserService.getUserById(reviewerId) 获取学员昵称
    - 根据 courseType 获取课程名称：
      - group-class → 使用步骤 4 中已获取的团课 title
      - private-lesson → 使用格式"私教课（{日期MM/DD} {时间段HH:mm-HH:mm}）"
    - 调用 NotificationService.create({
        userId: coachId,
        type: 'REVIEW_RECEIVED',
        title: '收到新评价',
        content: '{学员昵称} 对你的课程「{课程名称}」发表了评价',
        targetType: 'coach-profile',
        targetId: coachId
      })
11. 返回创建的评价数据
```

### 6.2 教练平均评分计算

```
输入: coachId
输出: { averageRating: number | null, totalCount: number }

逻辑:
1. Repository 查询该教练的所有评价记录（coachId 匹配）
2. 使用 SQL 聚合函数：
   - AVG(rating) 获取平均分
   - COUNT(*) 获取评价总数
3. 处理结果：
   - totalCount === 0 → { averageRating: null, totalCount: 0 }
   - totalCount > 0 → { averageRating: round(avg, 1), totalCount }
4. 保留一位小数使用四舍五入（ROUND(AVG(rating), 1)）
```

### 6.3 通知文案生成

| 通知类型 | title | content 模板 | targetType | targetId | 通知对象 |
|---------|-------|-------------|-----------|---------|---------|
| REVIEW_RECEIVED | 收到新评价 | {学员昵称} 对你的课程「{课程名称}」发表了评价 | coach-profile | coachId | 教练 |

课程名称生成规则：
- courseType = 'group-class' → 使用团课的 title 字段
- courseType = 'private-lesson' → 使用格式"私教课（{日期MM/DD} {时间段HH:mm-HH:mm}）"（与 coaching 模块的通知文案格式一致）

---

## 7. 模块特有约定

### 安全要求
- 评价内容中可能包含用户昵称，不包含手机号等敏感信息
- 只有课程参与者可以提交评价，通过 CoachingService.getParticipantIds() 校验
- 评价一旦提交不可修改、不可删除（一期），保证评价真实性
- 评价 ID 使用 UUID，不可被枚举遍历

### 性能约束
- 教练评分查询（GET /api/coaches/:id/rating）使用 SQL 聚合函数（AVG + COUNT），在 coachId 索引上执行，一期评价量小（百级），无性能压力
- 批量教练评分查询（POST /api/coaches/ratings）一次最多 100 个教练，每个教练一次聚合查询；如后续评价量增长，可考虑引入缓存或冗余字段
- 评价列表查询通过分页控制返回数据量，联合索引 (coachId, createdAt) 支持高效排序分页

### 错误处理
- HTTP 接口的错误通过抛出带 error code 的异常，由 infra/error-handler.ts 统一处理
- 外部 Service 调用返回 null 时（课程/教练不存在），转换为对应的业务错误码返回
- 通知发送失败不阻塞主流程，使用 try-catch 包裹，记录 error 日志后继续（遵循 architecture.md 决策 5）

### 日志策略
- 评价提交：info 级别记录创建事件（reviewerId 前 8 位、coachId 前 8 位、courseType、courseId 前 8 位、rating）
- 通知发送失败：error 级别记录失败详情（coachId 前 8 位、错误信息）
- 评分查询：debug 级别记录查询事件（coachId 前 8 位、结果）

---

## 8. 已知限制和 TODO

- 一期评价提交后不可修改、不可删除，保证评价真实性
- 一期不支持评价举报/审核功能
- 一期平均评分为实时计算，不使用缓存或冗余字段
- 一期教练列表按评分排序需前端调用批量评分接口后客户端排序，或后续版本优化为服务端排序
- TODO: 二期可考虑评价举报和管理后台审核功能
- TODO: 二期如评价量增长，可考虑引入缓存或在 CoachProfile 中存储冗余评分字段（需评估一致性方案）
- TODO: 二期可考虑支持评价的点赞/有用标记功能
