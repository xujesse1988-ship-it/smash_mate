# 模块详细设计: 教练资质审核 (Coach Verification)

> 本文档描述教练资质审核（GA）功能的详细设计和接口契约。
> 系统级架构和数据模型见 [docs/architecture-coaching-v2.md](../architecture-coaching-v2.md)。
> PRD 业务规则和验收标准见 [docs/prd-coaching-v2.md](../prd-coaching-v2.md) 第 3.1 节。

## 1. 模块概述

- **职责**: 教练资质审核（GA）— 用户提交教练申请、管理员审核通过/拒绝、审核状态查询、教练功能准入拦截
- **所属模块**: coaching（后端模块扩展，不是独立模块）
- **业务模块映射**: PRD 中的「教练管理（FC）」→ 教练审核子功能（GA-1 ~ GA-5）
- **依赖层级**: 中间层（依赖 user、notification）

---

## 2. 内部架构

### 分层结构

教练审核功能扩展在 coaching 模块现有的分层结构中：

```
coaching/
├── controller.ts      # 请求处理、参数校验、响应格式化（扩展教练审核路由）
├── service.ts         # 业务逻辑、规则执行、审核状态机（扩展审核相关方法）
├── repository.ts      # 数据访问、Prisma 查询封装（扩展 CoachApplication 查询）
├── types.ts           # 模块内类型定义（扩展审核相关类型和枚举）
└── index.ts           # 对外导出（扩展公开接口）
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Controller | 接收请求、参数校验（含文件格式/大小校验）、调用 Service、格式化响应 | Service |
| Service | 业务逻辑（提交申请、审核通过/拒绝、状态查询、教练准入校验）、通知发送编排 | Repository, UserService, NotificationService, infra（logger） |
| Repository | 数据库操作、CoachApplication 表的 Prisma 查询封装 | Prisma Client（infra） |

### 控制流

```
HTTP 请求 → Controller（参数校验 + 文件校验）→ Service（业务逻辑）→ Repository（数据访问）→ 响应
```

---

## 3. 数据模型

数据模型定义在 architecture-coaching-v2.md 第 3.1 节，此处引用 CoachApplication 模型：

### CoachApplication

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| userId | string | NOT NULL, FK → User.id | 申请人用户 ID |
| certificateUrls | string[] | NOT NULL | 证书/奖状图片 URL 列表（1-5 张） |
| description | string \| null | | 简要说明（最多 200 字符） |
| status | string | NOT NULL, DEFAULT "pending" | 审核状态：pending / approved / rejected |
| rejectReason | string \| null | | 拒绝原因（拒绝时必填，最少 5 字符） |
| reviewedBy | string \| null | | 审核管理员 ID |
| reviewedAt | datetime \| null | | 审核时间 |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### 索引

- `@@index([userId])` — 查询用户的申请记录
- `@@index([status])` — 按状态筛选
- `@@index([status, createdAt])` — 管理员列表按状态+时间查询

### 模型关系

```
User 1 ← N CoachApplication（一个用户可多次提交申请，但同时只有一个 pending 状态的）
```

---

## 4. 接口契约

> 每个接口必须包含五要素：**输入、输出、业务规则、错误码、consumers**。
> 接口通用约定（认证方式、响应格式、分页、HTTP 状态码）见 architecture.md。

### POST /api/coach-applications

**描述**: 用户提交教练资质申请

**认证**: 需要（用户）

**Consumers**: web-app（教练申请页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| certificateUrls | string[] | 是 | 证书/奖状图片 URL 列表（1-5 张） |
| description | string | 否 | 简要说明（最多 200 字符） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "certificateUrls": ["https://..."],
    "description": "国家二级运动员",
    "status": "pending",
    "createdAt": "2026-04-13T10:00:00.000Z",
    "updatedAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- certificateUrls 至少 1 个，最多 5 个（PRD 规则 #2）
- 每个 URL 必须以 http:// 或 https:// 开头
- 图片格式仅支持 JPG/PNG，服务端通过 URL 扩展名校验（`.jpg`、`.jpeg`、`.png`）；前端应在上传时做 MIME type 校验（PRD 规则 #3）
- 单张图片大小不超过 5MB，由图片上传接口（复用一期头像上传方案）在上传时校验；本接口接收的是已上传的 URL，不再重复校验文件大小（PRD 规则 #3）
- 用户已是教练（isCoach = true）不可提交申请
- 用户当前有 pending 状态的申请不可重复提交（PRD 规则 #6）
- 被拒绝后可重新提交（创建新的 CoachApplication 记录）（PRD 规则 #7）
- description 选填，最多 200 字符（PRD 规则 #4）

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_CERTIFICATES | certificateUrls 为空或超过 5 个 |
| 400 | COACHING_INVALID_CERTIFICATE_URL | URL 格式不合法 |
| 400 | COACHING_INVALID_CERTIFICATE_FORMAT | URL 扩展名不是 .jpg/.jpeg/.png（服务端格式校验） |
| 400 | COACHING_INVALID_DESCRIPTION | 说明超过 200 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 409 | COACHING_APPLICATION_PENDING | 已有审核中的申请 |
| 409 | COACHING_ALREADY_COACH | 用户已是教练 |

> **文件大小校验说明**: 5MB 限制在图片上传接口（`POST /api/uploads`，复用一期方案）中强制执行。上传接口返回 `UPLOAD_FILE_TOO_LARGE` 错误码。本接口仅接收已上传成功的 URL。

---

### GET /api/coach-applications/me

**描述**: 获取当前用户最新的教练申请状态

**认证**: 需要（用户）

**Consumers**: web-app（教练申请页、设置页教练入口状态展示）

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "status": "pending",
    "certificateUrls": ["https://..."],
    "description": "国家二级运动员",
    "rejectReason": null,
    "createdAt": "2026-04-13T10:00:00.000Z",
    "updatedAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 返回用户最新的一条 CoachApplication 记录（按 createdAt 倒序取第一条）
- 未提交过申请时返回 `{ "data": null }`
- 响应中包含 updatedAt 字段

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### GET /api/admin/coach-applications

**描述**: 管理员获取教练审核列表

**认证**: 需要（管理员）

**Consumers**: admin（教练审核列表页）

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 筛选状态：pending / approved / rejected，默认不限 |
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页条数（默认 20） |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "userId": "uuid",
        "nickname": "张三",
        "avatarUrl": "https://...",
        "certificateUrls": ["https://..."],
        "description": "国家二级运动员",
        "status": "pending",
        "createdAt": "2026-04-13T10:00:00.000Z",
        "updatedAt": "2026-04-13T10:00:00.000Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20
  }
}
```

**业务规则**:
- 仅管理员可访问
- 按 createdAt 倒序排列（最新申请在前）
- nickname、avatarUrl 通过 UserService.getUsersByIds() 批量获取
- 响应中包含 updatedAt 字段

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | AUTH_ADMIN_REQUIRED | 非管理员 |

---

### GET /api/admin/coach-applications/:id

**描述**: 管理员获取教练审核详情

**认证**: 需要（管理员）

**Consumers**: admin（教练审核详情页）

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "nickname": "张三",
    "avatarUrl": "https://...",
    "phone": "138****1234",
    "certificateUrls": ["https://..."],
    "description": "国家二级运动员",
    "status": "pending",
    "rejectReason": null,
    "reviewedBy": null,
    "reviewedAt": null,
    "createdAt": "2026-04-13T10:00:00.000Z",
    "updatedAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 仅管理员可访问
- 手机号脱敏展示（中间 4 位替换为 *）
- nickname、avatarUrl、phone 通过 UserService.getUserById() 获取
- 响应中包含 updatedAt 字段

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | AUTH_ADMIN_REQUIRED | 非管理员 |
| 404 | COACHING_APPLICATION_NOT_FOUND | 申请不存在 |

---

### POST /api/admin/coach-applications/:id/review

**描述**: 管理员审核教练申请（通过或拒绝）

**认证**: 需要（管理员）

**Consumers**: admin（教练审核详情页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 是 | 审核结果：'approved' 或 'rejected' |
| rejectReason | string | 拒绝时必填 | 拒绝原因（最少 5 字符） |

**Response 200**:

返回审核后的完整申请对象：

```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "certificateUrls": ["https://..."],
    "description": "国家二级运动员",
    "status": "approved",
    "rejectReason": null,
    "reviewedBy": "admin-uuid",
    "reviewedAt": "2026-04-13T11:00:00.000Z",
    "createdAt": "2026-04-13T10:00:00.000Z",
    "updatedAt": "2026-04-13T11:00:00.000Z"
  }
}
```

**业务规则**:
- 申请状态必须为 pending 才能审核（PRD 规则 #5）
- 通过时（PRD 规则 #9）：
  - 更新 CoachApplication.status 为 approved
  - 更新 User.isCoach 为 true
  - 自动创建 CoachProfile（如不存在）
  - 通过 NotificationService.create() 通知用户审核通过（PRD 规则 #11）
- 拒绝时（PRD 规则 #10）：
  - 更新 CoachApplication.status 为 rejected
  - 记录 rejectReason（最少 5 个字符）
  - 通过 NotificationService.create() 通知用户审核未通过及原因（PRD 规则 #11）
- rejectReason 拒绝时必填，最少 5 个字符（PRD 规则 #10）
- 通知创建失败不阻塞审核结果（try-catch + error 日志）
- 响应返回完整的 CoachApplication 对象（含所有字段），便于前端/admin 直接使用更新后的数据，无需额外请求

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_REVIEW_STATUS | status 不是 approved 或 rejected |
| 400 | COACHING_REJECT_REASON_REQUIRED | 拒绝时未填写原因 |
| 400 | COACHING_REJECT_REASON_TOO_SHORT | 拒绝原因少于 5 个字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | AUTH_ADMIN_REQUIRED | 非管理员 |
| 404 | COACHING_APPLICATION_NOT_FOUND | 申请不存在 |
| 409 | COACHING_APPLICATION_ALREADY_REVIEWED | 申请已审核过（非 pending 状态） |

---

## 5. 消费的外部接口

| 接口 | 提供方 | 调用场景 |
|------|--------|---------|
| UserService.getUserById(id) | user | 审核详情页获取申请人信息（昵称、头像、手机号）；通知文案中获取用户昵称 |
| UserService.getUsersByIds(ids) | user | 审核列表批量获取申请人信息（昵称、头像） |
| NotificationService.create(notification) | notification | 审核通过/拒绝后通知申请人 |

### 通知文案

| 事件 | type | title | content 模板 | 通知对象 | targetType | targetId |
|------|------|-------|-------------|---------|------------|----------|
| 审核通过 | COACH_APPLICATION_APPROVED | 教练资质审核已通过 | 恭喜！你的教练资质审核已通过，现在可以使用全部教练功能 | 申请人 | coach-application | 申请 ID |
| 审核拒绝 | COACH_APPLICATION_REJECTED | 教练资质审核未通过 | 你的教练资质审核未通过，原因：{拒绝原因}。你可以修改后重新提交申请 | 申请人 | coach-application | 申请 ID |

---

## 6. 关键业务逻辑

### 6.1 审核状态机

```
           (PRD 规则 #5 状态流转)

  未申请 ──────── 提交申请 ──────── pending
                                      │
                            ┌─────────┴─────────┐
                            │                   │
                        管理员通过           管理员拒绝
                            │                   │
                            v                   v
                        approved             rejected
                            │                   │
                            │                   └── 重新提交 ──→ pending (新记录)
                            │                          (PRD 规则 #7)
                            v
                  用户获得教练功能
                  (isCoach = true)

约束:
- pending 状态同一时间只能有一条（PRD 规则 #6）
- 重新提交时创建新的 CoachApplication 记录，旧记录保留（rejected 状态）
- approved 是终态，一旦通过不可撤回（一期）
```

### 6.2 一期已注册教练自动免审（PRD 规则 #1）

一期已注册的教练（数据库中 User.isCoach = true 的用户）自动保留教练资格，无需重新审核。

**实现方式**: 通过数据迁移脚本处理，不通过应用代码。详见 architecture-coaching-v2.md 第 7.1 节。

迁移脚本为每个已有教练创建一条 `status = 'approved'` 的 CoachApplication 记录（certificateUrls 为空数组），确保：
- 查询审核状态时不显示为"未申请"
- 已有教练继续正常使用所有教练功能
- isCoach 字段保持为 true，不受审核流程影响

### 6.3 教练功能准入拦截（PRD 规则 #8）

审核状态为"审核中"或"已拒绝"的用户不能使用教练功能。所有教练专属端点在执行业务逻辑前必须校验用户的教练准入资格。

**拦截范围**（以下端点均需校验）：
- 发布团课（`POST /api/group-classes`）
- 修改/取消团课（`PUT/POST /api/group-classes/:id/...`）
- 设置私教空闲时间（`POST /api/private-lessons/availability`）
- 创建学员班（`POST /api/student-classes`）
- 学员班管理（添加学员、创建课程等）
- 添加固定私教学员（`POST /api/private-students`）
- 固定私教学员管理（创建课程等）

**校验逻辑**（在 Service 层实现）：

```
判断用户是否有教练功能权限:
1. 检查 User.isCoach === true
   - 若为 true → 通过（包括一期遗留教练和新审核通过的教练）
   - 若为 false → 拒绝，返回 COACHING_COACH_ROLE_REQUIRED（403）
```

> **设计说明**: 不需要额外查询 CoachApplication 表。审核通过时 Service 层会将 User.isCoach 设为 true，因此只需检查 isCoach 字段即可。一期遗留教练的 isCoach 本来就是 true，同样满足条件。这保持了与一期教练校验逻辑的兼容性。

### 6.4 提交申请校验流程

```
1. 校验 certificateUrls 不为空且不超过 5 个
2. 校验每个 URL 格式合法（http/https 开头）
3. 校验每个 URL 扩展名为 .jpg/.jpeg/.png（PRD 规则 #3 服务端格式校验）
4. 校验 description 不超过 200 字符（如果提供）
5. 查询 User.isCoach → 若 true 则拒绝（COACHING_ALREADY_COACH）
6. 查询用户最新的 CoachApplication → 若 status 为 pending 则拒绝（COACHING_APPLICATION_PENDING）
7. 创建 CoachApplication 记录（status = pending）
8. 返回创建的申请对象
```

### 6.5 管理员审核流程

```
1. 校验申请存在（COACHING_APPLICATION_NOT_FOUND）
2. 校验申请状态为 pending（COACHING_APPLICATION_ALREADY_REVIEWED）
3. 校验 status 为 approved 或 rejected（COACHING_INVALID_REVIEW_STATUS）
4. 若拒绝：校验 rejectReason 存在且长度 >= 5

5a. 若通过（在数据库事务中）：
    - 更新 CoachApplication.status = 'approved'
    - 更新 CoachApplication.reviewedBy = 管理员 ID
    - 更新 CoachApplication.reviewedAt = 当前时间
    - 更新 User.isCoach = true（PRD 规则 #9）
    - 创建 CoachProfile（如不存在）

5b. 若拒绝（在数据库事务中）：
    - 更新 CoachApplication.status = 'rejected'
    - 更新 CoachApplication.rejectReason = 拒绝原因
    - 更新 CoachApplication.reviewedBy = 管理员 ID
    - 更新 CoachApplication.reviewedAt = 当前时间

6. 事务外：发送通知（try-catch，失败不阻塞）（PRD 规则 #11）
7. 返回完整的 CoachApplication 对象
```

### 6.6 一期入口变更（PRD 规则 #12）

一期的"注册时勾选教练"和"设置中开启教练角色"入口改为"申请成为教练"，引导用户进入审核流程。

**后端变更**:
- 一期的 `PUT /api/users/me/coach-role` 接口标记为 deprecated
- 该接口的行为变更为：返回提示信息指引用户走审核流程，不再直接开启教练角色
- 过渡期（30 天）后可完全废弃该接口

**前端变更**:
- 设置页中"开启教练角色"入口改为"申请成为教练"
- 点击后跳转到 `/coach-apply` 教练申请页
- 注册流程中移除"我是教练"勾选项

详见 architecture-coaching-v2.md 第 7.3 节。

---

## 7. 模块特有约定

### 安全要求
- 提交申请需要用户认证（JWT Token）
- 管理员端点（`/api/admin/...`）需要管理员认证中间件校验
- 审核详情中手机号脱敏展示（中间 4 位替换为 *），不暴露完整手机号
- 日志中不记录完整手机号和证书图片 URL

### 图片上传约定
- 证书图片上传复用一期的头像上传方案（本地 uploads 目录，`POST /api/uploads`）
- 图片格式限制：仅 JPG/PNG（PRD 规则 #3）
  - 前端：上传时校验 MIME type（image/jpeg、image/png）
  - 后端上传接口：校验文件扩展名和 MIME type
  - 后端申请接口：校验 URL 扩展名
- 图片大小限制：单张不超过 5MB（PRD 规则 #3）
  - 在上传接口中强制执行
  - 超过大小时上传接口返回 `UPLOAD_FILE_TOO_LARGE`

### 错误处理
- HTTP 接口的错误通过抛出带 error code 的异常，由 infra/error-handler.ts 统一处理
- 通知发送失败不阻塞审核主流程（try-catch + error 日志）

### 日志策略
- 提交申请：info 级别记录 userId（前 8 位）、certificateUrls 数量
- 管理员审核：info 级别记录 applicationId、reviewedBy（前 8 位）、审核结果（approved/rejected）
- 不记录证书图片 URL、手机号、拒绝原因等敏感内容

### 并发控制
- 同一用户重复提交申请：通过 Service 层先查询 pending 状态记录来防止，极端并发场景下依赖数据库事务隔离级别
- 管理员并发审核同一申请：通过先检查 status = pending 的条件更新（WHERE status = 'pending'）保证幂等

---

## 8. 已知限制和 TODO

### 已知限制

- 图片格式校验仅检查 URL 扩展名，不校验实际文件内容（MIME sniffing），一期复杂度可接受
- 证书图片存储在本地 uploads 目录，不支持 CDN 加速，一期数据量小可接受
- 管理员审核通过后不可撤回（一期不支持取消教练资格的操作）
- 迁移脚本创建的已有教练 CoachApplication 记录 certificateUrls 为空数组，与正常申请不同

### TODO

- TODO: 二期可考虑支持管理员撤销教练资格
- TODO: 二期可考虑图片 CDN 存储
- TODO: 二期可考虑上传时使用 MIME sniffing 校验文件实际内容
- TODO: 过渡期结束后废弃 `PUT /api/users/me/coach-role` 接口

---

## 附录 A: PRD 业务规则覆盖矩阵

下表列出 PRD 3.1 节所有 12 条业务规则的设计覆盖情况：

| # | PRD 业务规则 | 设计覆盖位置 |
|---|-------------|-------------|
| 1 | 一期已注册教练自动免审 | 6.2 节（数据迁移方案） |
| 2 | 上传 1-5 张证书图片 | 4 节 POST /api/coach-applications 业务规则 + 错误码 |
| 3 | JPG/PNG 格式，5MB 限制 | 4 节 POST 接口错误码（COACHING_INVALID_CERTIFICATE_FORMAT）+ 7 节图片上传约定 |
| 4 | 简要说明选填，最多 200 字符 | 4 节 POST 接口业务规则 + 错误码（COACHING_INVALID_DESCRIPTION） |
| 5 | 审核状态流转 | 6.1 节审核状态机 |
| 6 | 审核中不可重复提交 | 4 节 POST 接口错误码（COACHING_APPLICATION_PENDING） |
| 7 | 被拒绝后可重新提交 | 6.1 节状态机 + 4 节 POST 接口业务规则 |
| 8 | 审核中/已拒绝不能使用教练功能 | 6.3 节教练功能准入拦截 |
| 9 | 审核通过后 isCoach=true | 4 节 POST review 接口业务规则 + 6.5 节审核流程 |
| 10 | 拒绝时必填原因（最少 5 字符） | 4 节 POST review 接口错误码 |
| 11 | 审核结果自动通知 | 5 节通知文案 + 6.5 节审核流程 |
| 12 | 一期入口改为"申请成为教练" | 6.6 节入口变更 + `PUT /api/users/me/coach-role` 废弃说明 |

## 附录 B: PRD 验收标准可测试路径

| # | PRD 验收标准 | 可测试的 API 路径 |
|---|-------------|-----------------|
| 1 | 上传 1-5 张证书提交后状态变为"审核中" | `POST /api/coach-applications` → 响应 status = "pending" |
| 2 | 审核中不可重复提交 | `POST /api/coach-applications`（二次）→ 409 COACHING_APPLICATION_PENDING |
| 3 | 上传非 JPG/PNG 格式提示错误 | `POST /api/coach-applications`（含 .gif URL）→ 400 COACHING_INVALID_CERTIFICATE_FORMAT |
| 4 | 上传超 5MB 提示文件过大 | `POST /api/uploads`（>5MB 文件）→ 400 UPLOAD_FILE_TOO_LARGE |
| 5 | 管理员看到待审核列表 | `GET /api/admin/coach-applications?status=pending` → 列表包含申请 |
| 6 | 管理员通过后申请人收通知 + 可用教练功能 | `POST /api/admin/coach-applications/:id/review`（approved）→ 200；查询 User.isCoach = true；查询 notification |
| 7 | 管理员拒绝填原因后申请人收通知 | `POST /api/admin/coach-applications/:id/review`（rejected + rejectReason）→ 200；查询 notification 含拒绝原因 |
| 8 | 被拒绝后可重新提交 | `POST /api/coach-applications`（被拒绝后再次提交）→ 201 新记录 |
| 9 | 一期已有教练无需审核 | `GET /api/coach-applications/me`（已有教练）→ 返回 status = "approved" 记录 |
| 10 | 审核中/已拒绝无法发布团课 | `POST /api/group-classes`（非教练用户）→ 403 COACHING_COACH_ROLE_REQUIRED |

## 附录 C: 前端页面

### C.1 web-app: 教练申请页

- **路径**: `/coach-apply`
- **入口**: 设置页 → 申请成为教练
- **功能**: 证书上传 + 说明填写 + 审核状态展示
- **状态管理**: TanStack Query 缓存 `GET /api/coach-applications/me`，key 为 `['coach-application', 'me']`
- **页面状态**:
  - 未申请：展示上传表单
  - 审核中：展示"审核中"提示，不可重复提交
  - 已通过：展示"已通过"状态，引导进入教练功能
  - 已拒绝：展示拒绝原因，允许重新提交

### C.2 admin: 教练审核

在 `admin/features/coach-review/` 下：

| 页面 | 路径 | 说明 |
|------|------|------|
| CoachReviewListPage | `/coach-review` | 待审核/已通过/已拒绝筛选 |
| CoachReviewDetailPage | `/coach-review/:id` | 证书大图、申请说明、通过/拒绝操作 |

```
admin/features/coach-review/
├── pages/
│   ├── CoachReviewListPage.tsx
│   └── CoachReviewDetailPage.tsx
├── components/
│   ├── ApplicationList.tsx
│   └── CertificateViewer.tsx
└── api/
    └── coach-review-api.ts
```

## 附录 D: Service 方法签名

```typescript
// 提交教练申请
submitCoachApplication(userId: string, input: {
  certificateUrls: string[];  // 证书图片 URL 列表（1-5 张）
  description?: string;       // 简要说明（最多 200 字符）
}): Promise<CoachApplication>

// 获取当前用户的教练申请状态
getMyApplicationStatus(userId: string): Promise<CoachApplication | null>

// 管理员审核教练申请
reviewCoachApplication(applicationId: string, adminId: string, input: {
  status: 'approved' | 'rejected';
  rejectReason?: string;      // 拒绝时必填（最少 5 字符）
}): Promise<CoachApplication>

// 管理员获取审核列表
getApplicationList(query: {
  status?: 'pending' | 'approved' | 'rejected';
  page: number;
  pageSize: number;
}): Promise<PaginatedResult<CoachApplication>>

// 获取审核详情
getApplicationById(applicationId: string): Promise<CoachApplication | null>
```
