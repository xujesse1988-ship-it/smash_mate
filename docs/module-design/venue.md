# 模块详细设计: venue

> 本文档描述 venue 后端模块的内部设计和接口契约。系统级架构见 architecture.md。

## 1. 模块概述

- **职责**: 球馆数据的获取、存储、搜索，城市管理，定时更新球馆数据
- **类型**: 后端模块
- **业务模块映射**: PRD 中的「球馆管理（FE）」+「管理后台（FH）」中的城市/球馆管理部分
- **依赖层级**: 基础层（不依赖其他业务模块）

---

## 2. 内部架构

### 分层结构

```
venue/
├── controller.ts      # 请求处理、参数校验、响应格式化
├── service.ts         # 业务逻辑、地图服务集成、定时任务注册
├── repository.ts      # 数据访问、Prisma 查询封装
├── types.ts           # 模块内类型定义
└── index.ts           # 对外导出（公开接口）
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Controller | 接收请求、参数校验、调用 Service、格式化响应 | Service |
| Service | 业务逻辑（城市增删、球馆搜索、地图服务调用、数据同步编排、定时任务注册） | Repository, infra（logger、config、scheduler） |
| Repository | 数据库操作、Prisma 查询封装（含地理距离排序的 SQL） | Prisma Client（infra） |

### 控制流

```
请求 → Controller（校验）→ Service（业务逻辑）→ Repository（数据访问）→ 响应

定时任务 → scheduler 触发 → Service（同步编排）→ 地图服务 API → Repository（批量写入）
```

---

## 3. 数据模型

### City

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| name | string | NOT NULL, UNIQUE | 城市名称（如"北京"、"上海"） |
| isActive | boolean | NOT NULL, DEFAULT true | 是否启用（启用的城市参与定时数据更新） |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### Venue

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string (uuid) | PK | 主键 |
| name | string | NOT NULL | 球馆名称 |
| address | string | NOT NULL | 详细地址 |
| latitude | float | NOT NULL | 纬度 |
| longitude | float | NOT NULL | 经度 |
| cityId | string (uuid) | NOT NULL, FK → City.id | 所属城市 |
| mapPoiId | string | NOT NULL, UNIQUE | 地图服务返回的 POI ID（用于去重和增量更新） |
| createdAt | datetime | NOT NULL | 创建时间 |
| updatedAt | datetime | NOT NULL | 更新时间 |

### 模型关系

```
City 1 ← N Venue（一个城市对应多个球馆）
```

### 索引

- `City.name` — UNIQUE 索引（城市名不可重复）
- `Venue.mapPoiId` — UNIQUE 索引（地图 POI ID 唯一，用于去重）
- `Venue.cityId` — 外键索引（按城市查询球馆）
- `Venue.name` — 普通索引（支持名称模糊搜索）
- `Venue.(latitude, longitude)` — 联合索引（支持距离排序查询）

### 与其他模块数据的关系

- Venue.id 被 activity 模块（Activity.venueId）和 coaching 模块（GroupClass.venueId、PrivateLessonSlot 的可选球馆）引用
- 本模块不存储其他业务模块的外键

---

## 4. 接口契约

> 每个接口必须包含五要素：**输入、输出、业务规则、错误码、consumers**。
> 接口通用约定（认证方式、响应格式、分页、HTTP 状态码）见 architecture.md。

### 球馆搜索

`GET /api/venues/search`

**描述**: 根据关键词搜索球馆，支持可选的经纬度排序（距离近的排前面）

**认证**: 需要

**Consumers**: web-app（发起约球页球馆选择、教练发布课程时球馆选择）, admin（球馆列表搜索）

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词（球馆名称模糊匹配），最少 1 个字符 |
| latitude | number | 否 | 用户纬度（传入时按距离排序） |
| longitude | number | 否 | 用户经度（传入时按距离排序） |
| limit | number | 否 | 返回条数（默认 10，最大 50） |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "朝阳体育中心羽毛球馆",
        "address": "北京市朝阳区...",
        "latitude": 39.9215,
        "longitude": 116.4435,
        "distance": 1.2
      }
    ]
  }
}
```

> `distance` 字段：仅当请求中传入了 `latitude` 和 `longitude` 时返回，单位为千米（km），保留一位小数。未传入经纬度时该字段不返回。

**业务规则**:
- keyword 按球馆名称进行模糊匹配（LIKE '%keyword%'）
- 当 latitude 和 longitude 都提供时，按直线距离（Haversine 公式）升序排序
- 当 latitude 和 longitude 未提供时，按球馆名称排序
- latitude 和 longitude 必须同时提供或同时不提供
- limit 参数超出范围时取默认值（小于 1 取 10，大于 50 取 50）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | VENUE_INVALID_KEYWORD | keyword 为空或缺失 |
| 400 | VENUE_INVALID_COORDINATES | 经纬度只提供了一个，或格式不合法（latitude 超出 -90~90，longitude 超出 -180~180） |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |

---

### 球馆详情

`GET /api/venues/:id`

**描述**: 获取指定球馆的详细信息

**认证**: 需要

**Consumers**: web-app（活动详情页展示球馆信息）, admin（球馆管理页查看详情）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 球馆 ID |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "name": "朝阳体育中心羽毛球馆",
    "address": "北京市朝阳区...",
    "latitude": 39.9215,
    "longitude": 116.4435,
    "cityId": "uuid"
  }
}
```

**业务规则**:
- 任何已登录用户均可查看球馆详情

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 404 | VENUE_NOT_FOUND | 球馆不存在 |

---

### 添加城市（管理员）

`POST /api/admin/cities`

**描述**: 管理员添加一个城市，添加后系统自动调用地图服务获取该城市的羽毛球球馆

**认证**: 需要（管理员）

**Consumers**: admin（城市管理页）

**Request Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 城市名称（如"北京"、"上海"） |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "name": "北京",
    "isActive": true,
    "venueCount": 42,
    "createdAt": "2026-04-01T10:00:00.000Z"
  }
}
```

> `venueCount` 为本次同步获取到的球馆数量。

**业务规则**:
- 仅管理员可调用（通过 admin-auth 中间件校验）
- 城市名称不可重复（大小写不敏感匹配，但存储保留原文）
- 添加城市后，**同步**调用地图服务获取该城市的羽毛球场馆数据并入库
- 地图服务返回的球馆通过 `mapPoiId` 去重：已存在的更新名称和地址，不存在的新增
- 地图服务调用失败时：城市记录仍然创建成功，但返回 venueCount 为 0，并记录 error 日志；球馆数据会在下次定时更新时补齐

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 400 | VENUE_INVALID_CITY_NAME | 城市名称为空 |
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | AUTH_ADMIN_REQUIRED | 非管理员身份 |
| 409 | VENUE_CITY_DUPLICATE | 城市名称已存在 |

---

### 移除城市（管理员）

`DELETE /api/admin/cities/:id`

**描述**: 管理员移除一个城市。移除后该城市的球馆数据保留但不再自动更新

**认证**: 需要（管理员）

**Consumers**: admin（城市管理页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 城市 ID |

**Response 200**:
```json
{
  "data": {
    "message": "城市已移除"
  }
}
```

**业务规则**:
- 仅管理员可调用
- 移除城市 = 将 City.isActive 设为 false（软删除），不物理删除
- 移除后该城市的球馆数据保留，用户仍可搜索到这些球馆
- 移除后该城市不再参与定时球馆数据更新
- 已关联该城市球馆的活动/课程不受影响（PRD 明确要求）

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | AUTH_ADMIN_REQUIRED | 非管理员身份 |
| 404 | VENUE_CITY_NOT_FOUND | 城市不存在 |

---

### 城市列表（管理员）

`GET /api/admin/cities`

**描述**: 获取城市列表（包含每个城市的球馆数量），供管理员管理

**认证**: 需要（管理员）

**Consumers**: admin（城市管理页）

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
        "name": "北京",
        "isActive": true,
        "venueCount": 42,
        "createdAt": "2026-04-01T10:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

**业务规则**:
- 仅管理员可调用
- 返回所有城市（包括 isActive = false 的已移除城市），管理员需看到完整列表
- venueCount 为该城市下的球馆数量（实时计算）
- 按创建时间倒序排列

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | AUTH_ADMIN_REQUIRED | 非管理员身份 |

---

### 球馆列表（管理员）

`GET /api/admin/venues`

**描述**: 获取球馆列表，供管理员查看和管理

**认证**: 需要（管理员）

**Consumers**: admin（球馆管理页）

**Query Params**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cityId | string | 否 | 按城市筛选 |
| keyword | string | 否 | 按球馆名称模糊搜索 |
| page | number | 否 | 页码（默认 1） |
| pageSize | number | 否 | 每页条数（默认 20，最大 100） |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "朝阳体育中心羽毛球馆",
        "address": "北京市朝阳区...",
        "latitude": 39.9215,
        "longitude": 116.4435,
        "cityId": "uuid",
        "cityName": "北京",
        "createdAt": "2026-04-01T10:00:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

**业务规则**:
- 仅管理员可调用
- 支持按城市 ID 筛选和按名称关键词模糊搜索，两个筛选条件可组合
- 按创建时间倒序排列
- 返回球馆所属城市名称（cityName），方便管理页面展示

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | AUTH_ADMIN_REQUIRED | 非管理员身份 |

---

### 移除球馆（管理员）

`DELETE /api/admin/venues/:id`

**描述**: 管理员手动移除已关闭的球馆

**认证**: 需要（管理员）

**Consumers**: admin（球馆管理页）

**Path Params**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 球馆 ID |

**Response 200**:
```json
{
  "data": {
    "message": "球馆已移除"
  }
}
```

**业务规则**:
- 仅管理员可调用
- 物理删除球馆记录
- 已关联该球馆的历史活动/课程不受影响（activity/coaching 模块存储的 venueId 外键行为为 SET NULL，活动/课程记录保留但球馆信息显示为"已删除"或为空）
- 删除后用户端搜索不到该球馆

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | AUTH_ADMIN_REQUIRED | 非管理员身份 |
| 404 | VENUE_NOT_FOUND | 球馆不存在 |

---

### 手动触发球馆数据更新（管理员）

`POST /api/admin/venues/sync`

**描述**: 管理员手动触发所有活跃城市的球馆数据更新

**认证**: 需要（管理员）

**Consumers**: admin（球馆管理页）

**Request Body**: 无

**Response 200**:
```json
{
  "data": {
    "message": "球馆数据更新已触发",
    "syncResults": [
      {
        "cityId": "uuid",
        "cityName": "北京",
        "newVenues": 3,
        "updatedVenues": 5,
        "totalVenues": 45
      }
    ]
  }
}
```

**业务规则**:
- 仅管理员可调用
- 对所有 isActive = true 的城市调用地图服务，更新球馆数据
- 同步方式为同步执行（一期城市数量少，不需要异步队列）
- 同步逻辑：通过 mapPoiId 去重，已存在的更新名称和地址，不存在的新增；已关闭球馆不自动删除（PRD 明确要求由管理员手动处理）
- 某个城市的同步失败不影响其他城市的同步（记录 error 日志后继续）
- 为防止并发重复执行，使用内存锁：如果上一次同步尚未完成，返回提示信息

**错误码**:
| 状态码 | error.code | 触发条件 |
|--------|-----------|---------|
| 401 | AUTH_UNAUTHORIZED | Token 缺失或无效 |
| 403 | AUTH_ADMIN_REQUIRED | 非管理员身份 |
| 409 | VENUE_SYNC_IN_PROGRESS | 上一次同步尚未完成 |

---

### 内部接口（跨模块 Service 调用）

> 非 HTTP 暴露的接口。用于其他模块的 Service 层直接调用本模块的 Service。

#### VenueService.getVenueById(id)

**描述**: 根据球馆 ID 获取球馆信息（供其他模块校验球馆存在性或获取球馆信息）

**Consumers**: activity, coaching

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 球馆 ID (uuid) |

**返回值**:
```typescript
{
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
} | null
```

**业务规则**:
- 球馆不存在时返回 null（由调用方决定如何处理）
- 返回字段包含经纬度，供调用方计算距离等场景使用

**错误码**:
| error.code | 触发条件 |
|-----------|---------|
| 无 | 球馆不存在时返回 null，不抛错 |

---

## 5. 消费的外部接口

| 接口 | 提供方 | 调用场景 |
|------|--------|---------|
| 无 | - | venue 为基础层模块，不依赖其他业务模块 |

> venue 模块仅依赖 infra 层（Prisma Client、logger、config、scheduler）和外部地图服务 API，不调用任何其他业务模块的接口。

### 外部第三方服务

| 服务 | 用途 | 调用场景 |
|------|------|---------|
| 地图服务 API（如高德地图 POI 搜索） | 获取指定城市的羽毛球场馆数据 | 添加城市时同步获取；定时任务每周更新；管理员手动触发同步 |

---

## 6. 关键业务逻辑

### 6.1 城市添加与球馆数据获取流程

```
1. 管理员调用 POST /api/admin/cities，传入城市名称
2. Service 校验城市名称不重复
3. Repository 创建 City 记录
4. Service 调用地图服务 API，查询该城市的"羽毛球"关键词的 POI 数据
5. 解析地图服务返回的数据，提取球馆名称、地址、经纬度、POI ID
6. 通过 mapPoiId 与现有球馆去重：
   a. mapPoiId 已存在 → 更新球馆名称和地址
   b. mapPoiId 不存在 → 新增球馆记录
7. 返回城市信息和获取到的球馆数量
8. 若地图服务调用失败 → 记录 error 日志，城市仍然创建成功，venueCount 返回 0
```

### 6.2 定时球馆数据更新

```
触发: 每周一次（通过 infra/scheduler 注册 cron 任务）
逻辑:
1. 获取所有 isActive = true 的城市列表
2. 获取内存锁，如已锁定则跳过本次执行（记录 warn 日志）
3. 逐个城市调用地图服务 API 获取最新球馆数据
4. 通过 mapPoiId 去重：
   a. mapPoiId 已存在 → 更新球馆名称和地址
   b. mapPoiId 不存在 → 新增球馆记录
   c. 数据库中有但地图服务返回中没有的球馆 → 不自动删除（由管理员手动处理）
5. 单个城市同步失败不影响其他城市（try-catch 隔离，记录 error 日志）
6. 完成后释放内存锁
7. 记录 info 日志：每个城市的同步结果（新增数、更新数、总数）
```

### 6.3 球馆搜索距离计算

```
当用户提供了经纬度时，使用 Haversine 公式计算直线距离：

d = 2R * arcsin(sqrt(sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)))

其中 R = 6371 km（地球平均半径）

实现方式：在 Repository 层通过 Prisma raw SQL 实现距离计算和排序，避免在应用层加载大量数据后排序。
```

### 6.4 并发控制（同步锁）

```
场景: 定时任务和手动触发同步可能并发执行

方案: 模块内使用内存变量作为锁
- isSyncing: boolean（默认 false）
- 开始同步前检查 isSyncing：
  - 为 true → 跳过（定时任务）或返回 VENUE_SYNC_IN_PROGRESS（手动触发）
  - 为 false → 设为 true，执行同步，完成后设回 false

限制: 内存锁仅在单实例部署有效。一期为单实例部署，满足需求。
```

---

## 7. 模块特有约定

### 地图服务集成

- 地图服务 API Key 通过 infra/config.ts 的环境变量配置（`MAP_API_KEY`）
- 地图服务 API 基础 URL 通过环境变量配置（`MAP_API_BASE_URL`）
- 一期推荐使用高德地图 POI 搜索 API，但 Service 层封装地图服务调用逻辑，不与具体 API 耦合
- 地图服务调用超时设置为 10 秒
- 地图服务调用失败（网络错误、超时、非 200 响应）统一记录 error 日志，不向上抛出异常（不阻塞主流程）

### 性能约束

- 球馆搜索（GET /api/venues/search）为用户端高频接口，应确保响应在 200ms 内：
  - name 字段建索引支持模糊查询
  - 距离计算在数据库层完成（避免全量加载到应用层）
  - limit 参数限制返回条数（最大 50）
- 球馆数据同步为后台任务，不影响用户端请求处理

### 安全要求

- 所有管理员接口（/api/admin/*）通过 admin-auth 中间件校验，普通用户不可访问
- 地图服务 API Key 禁止写入日志或返回给前端

### 错误处理

- 本模块所有错误通过抛出带 error code 的异常，由 infra/error-handler.ts 统一处理
- 地图服务调用失败不阻塞城市创建和数据同步流程（降级处理：记录 error 日志，继续执行）
- 定时任务中的异常通过 try-catch 捕获，记录 error 日志，不影响服务稳定性

### 日志策略

- 球馆搜索：info 级别记录搜索关键词和结果数量（不记录经纬度原文，脱敏为城市粒度或省略）
- 城市增删：info 级别记录操作事件
- 数据同步：info 级别记录同步开始/结束、每个城市的同步结果；error 级别记录地图服务调用失败详情
- 定时任务执行：使用 module: "venue-sync" 标记（遵循 architecture.md 约定）

---

## 8. 已知限制和 TODO

- 一期地图服务返回的球馆数据有限，可能不覆盖所有真实球馆（依赖地图服务数据质量）
- 一期不支持管理员手动添加球馆（仅通过地图服务自动获取）
- 一期球馆搜索仅支持名称模糊匹配，不支持按地址搜索
- 一期单实例部署，内存锁满足并发控制需求；多实例部署时需改用分布式锁（如 Redis）
- 一期距离计算使用直线距离（Haversine），非导航距离
- TODO: 二期可考虑支持管理员手动添加/编辑球馆
- TODO: 二期可考虑引入 Redis 缓存热门城市的球馆数据，提升搜索性能
- TODO: 二期可考虑接入多个地图服务做数据互补
