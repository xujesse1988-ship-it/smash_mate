# 模块详细设计: 教练资质审核 (Coach Verification)

> 本文档描述教练资质审核（GA）功能的详细设计和接口契约。
> 系统级架构和数据模型见 [docs/architecture-coaching-v2.md](../architecture-coaching-v2.md)。

## 1. 模块概述

- **功能**: 教练资质审核（GA）— 用户提交教练申请、管理员审核通过/拒绝、审核状态查询
- **所属模块**: coaching（后端模块扩展）
- **业务模块映射**: PRD 中的「教练管理（FC）」→ 教练审核子功能
- **依赖层级**: 中间层（依赖 user、notification）

---

## 2. Service 方法签名

```typescript
// 提交教练申请
submitCoachApplication(userId: string, input: {
  certificateUrls: string[];  // 证书图片 URL 列表（1-5 张）
  description?: string;       // 简要说明（最多 200 字符）
}): Promise<CoachApplication>

// 获取当前用户的教练申请状态
getMyApplicationStatus(userId: string): Promise<CoachApplication | null>

// 管理员审核教练申请
reviewCoachApplication(applicationId: string, input: {
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

---

## 3. 接口契约

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
    "createdAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- certificateUrls 至少 1 个，最多 5 个
- 每个 URL 必须以 http:// 或 https:// 开头
- 用户已是教练（isCoach = true）不可提交申请
- 用户当前有 pending 状态的申请不可重复提交
- 被拒绝后可重新提交（创建新的 CoachApplication 记录）
- description 选填，最多 200 字符

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_CERTIFICATES | certificateUrls 为空或超过 5 个 |
| 400 | COACHING_INVALID_CERTIFICATE_URL | URL 格式不合法 |
| 400 | COACHING_INVALID_DESCRIPTION | 说明超过 200 字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 409 | COACHING_APPLICATION_PENDING | 已有审核中的申请 |
| 409 | COACHING_ALREADY_COACH | 用户已是教练 |

---

### GET /api/coach-applications/me

**描述**: 获取当前用户最新的教练申请状态

**认证**: 需要（用户）

**Consumers**: web-app（教练申请页）

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "status": "pending",
    "certificateUrls": ["https://..."],
    "description": "国家二级运动员",
    "rejectReason": null,
    "createdAt": "2026-04-13T10:00:00.000Z"
  }
}
```

**业务规则**:
- 返回用户最新的一条 CoachApplication 记录
- 未提交过申请时返回 `{ "data": null }`

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
        "createdAt": "2026-04-13T10:00:00.000Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20
  }
}
```

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
    "createdAt": "2026-04-13T10:00:00.000Z"
  }
}
```

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
```json
{
  "data": {
    "id": "uuid",
    "status": "approved",
    "reviewedBy": "admin-uuid",
    "reviewedAt": "2026-04-13T11:00:00.000Z"
  }
}
```

**业务规则**:
- 申请状态必须为 pending 才能审核
- 通过时：更新 CoachApplication.status 为 approved，更新 User.isCoach 为 true，自动创建 CoachProfile（如不存在），通知用户审核通过
- 拒绝时：更新 CoachApplication.status 为 rejected，记录 rejectReason，通知用户审核未通过及原因
- rejectReason 拒绝时必填，最少 5 个字符
- 通知创建失败不阻塞审核结果

**错误码**:

| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | COACHING_INVALID_REVIEW_STATUS | status 不是 approved 或 rejected |
| 400 | COACHING_REJECT_REASON_REQUIRED | 拒绝时未填写原因 |
| 400 | COACHING_REJECT_REASON_TOO_SHORT | 拒绝原因少于 5 个字符 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | AUTH_ADMIN_REQUIRED | 非管理员 |
| 404 | COACHING_APPLICATION_NOT_FOUND | 申请不存在 |
| 409 | COACHING_APPLICATION_ALREADY_REVIEWED | 申请已审核过 |

---

## 4. 前端页面

### 4.1 web-app: 教练申请页

- **路径**: `/coach-apply`
- **入口**: 设置页 → 申请成为教练
- **功能**: 证书上传 + 说明填写 + 审核状态展示
- **状态管理**: TanStack Query 缓存 `GET /api/coach-applications/me`，key 为 `['coach-application', 'me']`

### 4.2 admin: 教练审核

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
