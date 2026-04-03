# 模块详细设计: user

> 本文档描述 user 后端模块的内部设计和接口契约。系统级架构见 architecture.md。

## 1. 模块概述

- **职责**: 用户注册/登录（手机号+验证码）、JWT 令牌签发与刷新、个人资料管理、教练角色开启（一期不支持关闭）、个人主页数据聚合
- **类型**: 后端模块
- **业务模块映射**: PRD 中的「用户管理（FA）」
- **依赖层级**: 基础层（不依赖其他业务模块）

---

## 2. 内部架构

### 分层结构

```
user/
├── controller.ts      # 请求处理、参数校验、响应格式化
├── service.ts         # 业务逻辑、规则执行
├── repository.ts      # 数据访问、Prisma 查询封装
├── types.ts           # 模块内类型定义
└── index.ts           # 对外导出（公开接口）
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Controller | 接收请求、参数校验、调用 Service、格式化响应 | Service |
| Service | 业务逻辑（验证码管理、登录/注册判断、令牌签发、资料更新、教练角色开启） | Repository, infra（JWT、logger、config） |
| Repository | 数据库操作、Prisma 查询封装 | Prisma Client（infra） |

### 控制流

```
请求 → Controller（校验）→ Service（业务逻辑）→ Repository（数据访问）→ 响应
```

---

## 3. 数据模型

### User

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| phone | string | NOT NULL, UNIQUE | 手机号（11 位中国大陆手机号） |
| nickname | string | NOT NULL | 昵称（2-20 字符） |
| avatarUrl | string \| null | | 头像 URL |
| bio | string \| null | | 个人简介 |
| isCoach | boolean | NOT NULL, DEFAULT false | 是否为教练角色 |
| createdAt | datetime | NOT NULL | 注册时间 |
| updatedAt | datetime | NOT NULL | 最后更新时间 |

### VerificationCode

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| phone | string | NOT NULL | 手机号 |
| code | string | NOT NULL | 6 位数字验证码 |
| expiresAt | datetime | NOT NULL | 过期时间（创建时间 + 5 分钟） |
| used | boolean | NOT NULL, DEFAULT false | 是否已使用 |
| createdAt | datetime | NOT NULL | 创建时间 |

### PhoneLock

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| phone | string | NOT NULL | 手机号 |
| failCount | int | NOT NULL, DEFAULT 0 | 连续验证失败次数 |
| lockedUntil | datetime \| null | | 锁定截止时间（失败 5 次后设置为当前 + 30 分钟） |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### 模型关系

```
User 无外键关联其他模块表（user 为基础层）
VerificationCode 通过 phone 字段与 User 关联（非外键，因注册前用户尚不存在）
PhoneLock 通过 phone 字段管理验证失败次数（非外键，同上理由）
```

### 与其他模块数据的关系

- User.id 被 activity、coaching、match-record、review、notification 模块通过外键引用
- 本模块不存储其他模块的外键

---

## 4. 接口契约

> 每个接口必须包含五要素：**输入、输出、业务规则、错误码、consumers**。
> 接口通用约定（认证方式、响应格式、分页、HTTP 状态码）见 architecture.md。

### 发送验证码

`POST /api/auth/send-code`

**描述**: 向指定手机号发送 6 位数字验证码

**认证**: 不需要

**Consumers**: web-app（注册/登录页）, admin（管理员登录页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 是 | 中国大陆手机号（11 位，1 开头） |

**Response 200**:
```json
{
  "data": {
    "message": "验证码已发送"
  }
}
```

**业务规则**:
- 手机号格式校验：11 位数字，以 1 开头（正则：`/^1\d{10}$/`）
- 同一手机号 60 秒内不可重复发送验证码（基于最近一条 VerificationCode 的 createdAt 判断）
- 验证码为 6 位随机数字，有效期 5 分钟
- 如果该手机号当前处于锁定状态（PhoneLock.lockedUntil > 当前时间），拒绝发送
- 一期不实际发短信，日志记录策略：
  - info 级别：记录"验证码已发送"事件，包含脱敏手机号（如 `138****1234`），不记录验证码值
  - debug 级别（仅开发/测试环境）：记录实际验证码值，用于调试测试
  - 生产环境 LOG_LEVEL 应设为 info 及以上，确保验证码值不会输出

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | AUTH_INVALID_PHONE | 手机号格式不合法 |
| 429 | AUTH_CODE_RATE_LIMITED | 60 秒内重复发送 |
| 429 | AUTH_PHONE_LOCKED | 该手机号已被锁定（验证失败超过 5 次） |

---

### 登录/注册

`POST /api/auth/login`

**描述**: 使用手机号 + 验证码登录；若手机号未注册，自动注册新用户

**认证**: 不需要

**Consumers**: web-app（注册/登录页）, admin（管理员登录页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 是 | 中国大陆手机号 |
| code | string | 是 | 6 位数字验证码 |
| isCoach | boolean | 否 | 是否注册为教练角色（仅新用户注册时生效，默认 false；对已存在用户该参数被忽略） |

**Response 200**:
```json
{
  "data": {
    "token": "jwt-token-string",
    "user": {
      "id": "uuid",
      "phone": "138****1234",
      "nickname": "球友12345",
      "avatarUrl": null,
      "bio": null,
      "isCoach": false,
      "createdAt": "2026-04-01T10:00:00.000Z"
    },
    "isNewUser": true
  }
}
```

**业务规则**:
- 无论新用户注册还是老用户登录，统一返回 HTTP 200（接口的主要语义是"登录"，非"创建用户"）
- 手机号格式校验同 send-code
- 验证码匹配最近一条未使用的 VerificationCode 记录（同一手机号、code 匹配、expiresAt > 当前时间、used = false）
- 验证成功后标记该验证码为已使用（used = true），并重置 PhoneLock 的 failCount
- 验证失败时递增 PhoneLock.failCount；达到 5 次时设置 lockedUntil = 当前时间 + 30 分钟
- 若手机号不存在于 User 表，自动创建新用户：
  - nickname 自动生成：`球友` + 5 位随机数字（如 `球友38291`）
  - isCoach 取请求参数值（默认 false）
- JWT payload 包含：`{ userId: string, role: "user" }`
- JWT 有效期 7 天
- 响应中 phone 字段做脱敏处理（如 `138****1234`）
- isNewUser 字段标识是否为新注册用户（前端可据此引导完善资料）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | AUTH_INVALID_PHONE | 手机号格式不合法 |
| 400 | AUTH_INVALID_CODE | 验证码格式不合法（非 6 位数字） |
| 401 | AUTH_CODE_WRONG | 验证码错误 |
| 401 | AUTH_CODE_EXPIRED | 验证码已过期 |
| 429 | AUTH_PHONE_LOCKED | 该手机号已被锁定 |

---

### 获取当前用户信息

`GET /api/users/me`

**描述**: 获取当前登录用户的完整信息

**认证**: 需要

**Consumers**: web-app（全局：页面加载时获取用户信息）, admin（管理后台用户信息）

**Request**: 无参数

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "phone": "138****1234",
    "nickname": "昵称",
    "avatarUrl": "https://...",
    "bio": "个人简介",
    "isCoach": false,
    "createdAt": "2026-04-01T10:00:00.000Z"
  }
}
```

**业务规则**:
- 从 JWT token 中解析 userId，查询 User 表
- phone 字段做脱敏处理

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 404 | USER_NOT_FOUND | 用户不存在（异常情况：token 有效但用户已被删除） |

---

### 更新个人资料

`PUT /api/users/me`

**描述**: 更新当前登录用户的个人资料

**认证**: 需要

**Consumers**: web-app（个人资料编辑页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nickname | string | 否 | 昵称（2-20 字符） |
| avatarUrl | string | 否 | 头像 URL |
| bio | string | 否 | 个人简介（最长 200 字符） |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "phone": "138****1234",
    "nickname": "新昵称",
    "avatarUrl": "https://...",
    "bio": "新简介",
    "isCoach": false,
    "createdAt": "2026-04-01T10:00:00.000Z"
  }
}
```

**业务规则**:
- 只更新请求体中包含的字段，未提供的字段保持不变
- nickname 不可为空字符串，长度限制 2-20 个字符
- bio 长度限制最长 200 字符
- avatarUrl 格式要求：必须以 `http://` 或 `https://` 开头的合法 URL（一期不做图片上传，仅存储外部 URL；一期不限制域名白名单）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | USER_INVALID_NICKNAME | 昵称为空或长度不在 2-20 之间 |
| 400 | USER_INVALID_BIO | 简介超过 200 字符 |
| 400 | USER_INVALID_AVATAR_URL | 头像 URL 格式不合法 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 开启教练角色

`PUT /api/users/me/coach-role`

**描述**: 开启当前用户的教练角色（一期不支持关闭）

**认证**: 需要

**Consumers**: web-app（设置页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| isCoach | boolean | 是 | 仅接受 true（开启教练角色）；传入 false 返回错误 |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "phone": "138****1234",
    "nickname": "昵称",
    "avatarUrl": "https://...",
    "bio": "简介",
    "isCoach": true,
    "createdAt": "2026-04-01T10:00:00.000Z"
  }
}
```

**业务规则**:
- 开启教练角色后，用户同时具备普通用户和教练两种身份（不需要切换账号）
- 一期不支持关闭教练角色，传入 isCoach = false 时返回 400 错误
- 已经是教练的用户再次调用（isCoach = true）视为幂等操作，直接返回当前用户信息

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | USER_INVALID_COACH_ROLE | isCoach 字段缺失或非布尔值 |
| 400 | USER_COACH_ROLE_CLOSE_NOT_SUPPORTED | isCoach 为 false（一期不支持关闭教练角色） |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 获取用户公开信息（个人主页）

`GET /api/users/:id`

**描述**: 获取指定用户的公开信息，用于个人主页展示

**认证**: 需要

**Consumers**: web-app（个人主页）, activity（显示参与者信息时前端调用）, coaching（显示教练/学员信息时前端调用）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 用户 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "nickname": "昵称",
    "avatarUrl": "https://...",
    "bio": "简介",
    "isCoach": false,
    "createdAt": "2026-04-01T10:00:00.000Z"
  }
}
```

**业务规则**:
- 公开信息不包含 phone 字段（隐私保护）
- 任何已登录用户均可查看其他用户的公开信息
- 本接口不返回战绩汇总和教练评分数据；个人主页的战绩汇总由前端单独调用 match-record 模块的 `GET /api/users/:id/match-stats` 接口获取，教练评分由前端调用 review 模块接口获取

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 404 | USER_NOT_FOUND | 用户不存在 |

---

### 内部接口（跨模块 Service 调用）

> 非 HTTP 暴露的接口。用于其他模块的 Service 层直接调用本模块的 Service。

#### UserService.getUserById(id)

**描述**: 根据用户 ID 获取用户基本信息（供其他模块校验用户存在性或获取用户信息）

**Consumers**: activity, coaching, match-record, review

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 用户 ID (uuid) |

**返回值**:
```typescript
{
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
} | null
```

**业务规则**:
- 用户不存在时返回 null（由调用方决定如何处理）
- 返回字段不包含敏感信息（不返回 phone）
- 包含 bio 字段，供个人主页等聚合场景使用，避免消费方额外查询

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 用户不存在时返回 null，不抛错 |

---

#### UserService.getUsersByIds(ids)

**描述**: 根据用户 ID 列表批量获取用户基本信息（用于列表页面展示参与者/成员信息）

**Consumers**: activity, coaching, match-record, review

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ids | string[] | 是 | 用户 ID 列表 |

**返回值**:
```typescript
Array<{
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
}>
```

**业务规则**:
- 不存在的 ID 不会出现在返回列表中（不报错）
- 空数组参数返回空数组
- 返回顺序不保证与输入一致

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 始终返回结果，不抛错 |

---

## 5. 消费的外部接口

| 接口 | 提供方 | 调用场景 |
|------|--------|---------|
| 无 | - | user 为基础层模块，不依赖其他业务模块 |

> user 模块仅依赖 infra 层（Prisma Client、JWT 工具、logger、config），不调用任何其他业务模块的接口。

---

## 6. 关键业务逻辑

### 6.1 验证码发送与验证流程

```
发送验证码:
1. 校验手机号格式
2. 检查 PhoneLock：lockedUntil > 当前时间 → 拒绝（AUTH_PHONE_LOCKED）
3. 检查频率限制：最近一条 VerificationCode 的 createdAt + 60s > 当前时间 → 拒绝（AUTH_CODE_RATE_LIMITED）
4. 生成 6 位随机数字验证码
5. 创建 VerificationCode 记录（expiresAt = 当前时间 + 5 分钟）
6. 日志记录发送事件（手机号脱敏）
7. 返回成功

验证码验证（登录时调用）:
1. 查询最近一条匹配的 VerificationCode（phone 匹配、used = false）
2. 不存在 → AUTH_CODE_WRONG
3. expiresAt < 当前时间 → AUTH_CODE_EXPIRED
4. code 不匹配 → 递增 PhoneLock.failCount，达到 5 次时设置 lockedUntil → AUTH_CODE_WRONG
5. 匹配成功 → 标记 used = true，重置 PhoneLock.failCount = 0

注：步骤 2（无未使用的验证码记录）和步骤 4（验证码不匹配）统一返回 AUTH_CODE_WRONG，
这是安全设计——避免攻击者通过错误码差异探测某手机号是否发送过验证码。
```

### 6.2 登录/注册合一流程

```
1. 校验手机号和验证码格式
2. 检查 PhoneLock 锁定状态
3. 验证码验证（见 6.1）
4. 查询 User 表：
   a. 手机号已存在 → 现有用户登录，isNewUser = false
   b. 手机号不存在 → 创建新用户（自动生成昵称），isNewUser = true
5. 签发 JWT token（payload: { userId, role: "user" }，有效期 7 天）
6. 返回 token、用户信息、isNewUser 标识
```

### 6.3 手机号锁定机制

```
状态:
- 正常: failCount < 5 且（lockedUntil 为 null 或 lockedUntil < 当前时间）
- 锁定: lockedUntil > 当前时间

流转:
- 验证失败 → failCount++
- failCount 达到 5 → 设置 lockedUntil = 当前时间 + 30 分钟
- 验证成功 → failCount 重置为 0，lockedUntil 清空
- 锁定过期后（lockedUntil < 当前时间）→ 自动恢复为正常状态，failCount 重置
```

### 6.4 手机号脱敏规则

```
原始: 13812345678
脱敏: 138****5678
规则: 保留前 3 位 + **** + 后 4 位
```

---

## 7. 模块特有约定

### 安全要求
- 手机号在日志中必须使用脱敏格式（138****5678），禁止记录原文
- 验证码值禁止出现在 info 级别及以上日志中；仅在 debug 级别（开发/测试环境）输出
- JWT token 禁止写入日志
- 验证码有效期和锁定时长通过 infra/config.ts 配置，支持环境变量覆盖

### 性能约束
- 验证码查询和频率限制需要高效索引：VerificationCode 表在 (phone, createdAt) 上建联合索引
- PhoneLock 表在 phone 上建唯一索引

### 数据清理
- VerificationCode 表中过期且已使用的记录可定期清理（一期不实现定时清理，表数据量可控）
- 频率限制检查（60 秒内不可重复发送）的查询应限定时间范围（如只查最近 5 分钟内的记录），避免数据量增长后全表扫描
- PhoneLock 表中锁定已过期的记录可保留（failCount 在下次验证成功时重置）

### 错误处理
- 本模块所有错误通过抛出带 error code 的异常，由 infra/error-handler.ts 统一处理
- 不吞掉异常，不返回模糊错误信息

---

## 8. 已知限制和 TODO

- 一期不支持注销账号（User 无删除接口）
- 一期不支持修改手机号
- 一期验证码不实际发送短信，通过日志输出（开发/测试环境 debug 级别）
- 一期不做图片上传，头像 avatarUrl 仅支持外部 URL
- 一期不做 token 刷新机制（7 天过期后重新登录）
- 一期不支持关闭教练角色（用户开启教练角色后不可取消，二期可考虑支持）
- TODO: 二期可考虑引入 Redis 存储验证码和频率限制数据，提升性能
- TODO: 二期可考虑接入真实短信服务商
- TODO: 二期可考虑 token 刷新（refresh token）机制
