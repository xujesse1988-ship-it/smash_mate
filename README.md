# 羽约 SmashMate

羽毛球社交平台，帮助球友约球、记录战绩、找教练，解决信息分散在微信群的痛点。

## 功能模块

- **约球活动** — 发起/加入活动、自动状态流转、满员提醒
- **战绩记录** — 录入比赛结果、胜负统计、历史查看
- **教练服务** — 教练入驻、团课/私教管理、学员评价
- **球馆管理** — 城市球馆数据维护（管理后台）
- **站内通知** — 活动变更、报名提醒等实时通知

## 技术栈

| 层级 | 技术 |
|------|------|
| 语言 | TypeScript（全栈） |
| 后端 | Express + Prisma + PostgreSQL |
| 前端 SPA | React + Vite + Ant Design + TanStack Query + Zustand |
| 管理后台 | React + Vite + Ant Design |
| 测试 | Vitest + React Testing Library + MSW + Playwright |

## 环境要求

- Node.js >= 20
- npm >= 10
- Docker & Docker Compose

## 快速开始

### 1. 克隆项目

```bash
git clone <repo-url>
cd smash_mate_20260401
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

按需修改 `.env` 中的配置项，关键配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://smashmate:smashmate_dev@localhost:5432/smashmate_dev` |
| `JWT_SECRET` | JWT 签名密钥（生产环境务必修改） | `your-jwt-secret-change-in-production` |
| `ADMIN_PHONES` | 管理员手机号，逗号分隔 | `13800000001` |
| `MAP_API_KEY` | 高德地图 API Key | - |

### 4. 启动数据库

```bash
docker compose up -d
```

这会启动两个 PostgreSQL 实例：
- **开发库** — 端口 5432
- **测试库** — 端口 5433

### 5. 初始化数据库

```bash
# 生成 Prisma Client
npm run db:generate

# 执行数据库迁移
npm run db:migrate

# （可选）填充种子数据
npm run db:seed
```

### 6. 启动开发服务

分别在三个终端中运行：

```bash
# 后端 API 服务（端口 3000）
npm run dev:server

# 前端 SPA（端口 5173，自动代理 /api 到后端）
npm run dev:web

# 管理后台（端口 5174，自动代理 /api 到后端）
npm run dev:admin
```

启动后访问：
- 前端应用：http://localhost:5173
- 管理后台：http://localhost:5174
- 后端 API：http://localhost:3000

## 常用命令

```bash
# 开发
npm run dev:server          # 启动后端（热重载）
npm run dev:web             # 启动前端 SPA
npm run dev:admin           # 启动管理后台

# 构建
npm run build               # 构建全部（server + web + admin）

# 测试
npm test                    # 运行全部测试
npm run test:contracts      # 契约测试
npm run test:integration    # 集成测试
npm run test:e2e            # E2E 测试（Playwright）

# 代码检查
npm run lint                # ESLint + Prettier 检查
npm run lint:fix            # 自动修复

# 数据库
npm run db:generate         # 生成 Prisma Client
npm run db:migrate          # 运行迁移
npm run db:push             # 推送 schema（开发用）
npm run db:seed             # 填充种子数据

# 本地依赖
docker compose up -d        # 启动 PostgreSQL
docker compose down         # 停止 PostgreSQL
```

## 项目结构

```
server/                     # 后端 API
├── modules/                # 业务模块（user, activity, coaching, match-record, venue, notification, review）
├── infra/                  # 基础设施（数据库、认证、日志、错误处理等）
├── prisma/                 # 数据库 Schema 和迁移
└── app.ts                  # 入口

web/                        # 前端 SPA
├── features/               # 按功能划分（auth, activity, coaching, match-record, profile, notification）
├── shared/                 # 共享组件、hooks、工具
├── stores/                 # Zustand 全局状态
└── main.tsx

admin/                      # 管理后台
├── features/               # 功能模块（auth, venue-management）
├── shared/
├── stores/
└── main.tsx

tests/                      # 测试
├── contracts/              # 契约测试
├── integration/            # 集成测试
└── e2e/                    # E2E 测试
```
