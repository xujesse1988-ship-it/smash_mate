# Project: 羽约 (SmashMate)

## 一句话描述
羽毛球社交平台，帮助球友约球、记录战绩、找教练，解决信息分散在微信群的痛点。

## Tech Stack
- Language: TypeScript（全栈）
- Runtime: Node.js
- Backend: Express + Prisma + PostgreSQL
- Frontend: React + Vite + React Router + Ant Design + TanStack Query + Zustand
- Test: Vitest + React Testing Library + MSW (Mock Service Worker)
- E2E: Playwright

## 项目文档
- docs/prd.md — 产品需求
- docs/architecture.md — 系统架构
- docs/module-design/ — 模块详细设计 + 接口契约
- 任务管理 — GitHub Projects（`gh issue list` 查看）

## 常用命令
- `docker compose up -d` — 启动本地依赖（PostgreSQL 开发库 5432 + 测试库 5433）
- `docker compose down` — 停止本地依赖
- `npm run dev:server` — 启动后端开发服务器（tsx watch，端口 3000）
- `npm run dev:web` — 启动前端 SPA（Vite，端口 5173，自动代理 /api 到后端）
- `npm run dev:admin` — 启动管理后台（Vite，端口 5174，自动代理 /api 到后端）
- `npx vitest` — 跑全部测试（watch 模式）
- `npx vitest run` — 跑全部测试（单次运行）
- `npx vitest tests/contracts` — 只跑契约测试
- `npx vitest tests/integration` — 只跑集成测试
- `npx vitest {file}` — 跑单个文件测试
- `npm run lint` — ESLint + Prettier 检查
- `npm run lint:fix` — 自动修复 lint 和格式问题
- `npm run db:generate` — 生成 Prisma Client
- `npm run db:migrate` — 运行数据库迁移
- `npm run db:push` — 推送 schema 到数据库（开发用，不生成迁移文件）
- `npm run db:seed` — 填充种子数据
- `npm run build` — 构建全部（server + web + admin）
- `npx playwright test` — 跑 E2E 测试

## 项目结构
```
server/                        # 后端
├── modules/
│   ├── user/                  # 用户注册/登录、认证、资料管理、教练角色
│   ├── activity/              # 约球活动全生命周期
│   ├── coaching/              # 教练资料、团课、私教
│   ├── match-record/          # 战绩录入、删除、统计
│   ├── venue/                 # 球馆数据、城市管理
│   ├── notification/          # 站内通知
│   └── review/                # 教练评价评分
│   （每个模块内部：controller.ts / service.ts / repository.ts / types.ts / index.ts）
├── infra/
│   ├── database.ts            # Prisma 客户端
│   ├── config.ts              # 配置
│   ├── logger.ts              # 日志
│   ├── auth.ts                # JWT 认证中间件
│   ├── admin-auth.ts          # 管理员认证中间件
│   ├── error-handler.ts       # 全局错误处理
│   ├── response.ts            # 标准响应格式
│   └── scheduler.ts           # 定时任务调度
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── app.ts

web/                           # 前端 SPA
├── features/
│   ├── auth/                  # 注册/登录
│   ├── activity/              # 约球列表、发起约球、活动详情
│   ├── coaching/              # 教练列表、教练主页、团课详情、私教预约、课程管理
│   ├── match-record/          # 战绩录入、战绩历史
│   ├── profile/               # 个人主页、资料编辑、设置
│   └── notification/          # 通知列表
│   （每个 feature 内部：pages/ / components/ / hooks/ / api/）
├── shared/                    # 共享组件、hooks、工具函数、类型
├── stores/                    # 全局状态管理（Zustand）
├── routes.ts
└── main.tsx

admin/                         # 管理后台
├── features/
│   ├── auth/                  # 管理员登录
│   └── venue-management/      # 城市管理、球馆管理
├── shared/
├── stores/
├── routes.ts
└── main.tsx

tests/
├── contracts/                 # 契约测试（按后端模块组织）
├── unit/                      # 单元测试（按模块组织）
├── integration/               # 集成测试
│   ├── {module}/              # L1: 后端模块内集成
│   ├── web-app/{feature}/     # L1: 前端按 feature 子目录
│   └── paths/                 # L2: 关键路径集成
├── e2e/                       # E2E 测试（按用户流程）
└── fixtures/                  # 共享测试数据（工厂函数，非硬编码）
```

## 代码规范
- ESLint + Prettier，提交前必须通过 lint
- 文件命名：kebab-case（如 user-service.ts）
- 组件命名：PascalCase（如 UserList.tsx）

## 架构约定
- 后端模块间依赖单向，禁止循环
- 后端分层：controller → service → repository，不跳层
- 后端模块依赖分层：基础层（user, venue, notification）→ 中间层（activity, coaching）→ 上层（match-record, review）；只能上层调用下层，不可反向
- 模块间通过 Service 层方法直接调用，不使用事件总线
- 通知创建失败不阻塞主流程，记录 error 日志后继续
- 前端按 feature 组织代码，通过 api/ 层调用后端，组件不直接发请求
- 前端状态：页面内用 useState，跨页面用 Zustand，服务端数据用 TanStack Query
- 战绩来源使用多态关联（sourceType + sourceId），不使用多个 nullable 外键
- 教练平均评分由 review 模块实时计算，coaching 不存冗余字段
- 活动/课程状态流转使用定时任务轮询（每分钟），不使用延迟队列

## 日志约定
- 使用 infra/logger.ts 提供的 logger，禁止直接 console.log
- 日志级别通过环境变量 `LOG_LEVEL` 控制（默认 info，测试时可设为 warn 减少噪音）

## 测试环境
- 测试数据库: PostgreSQL 测试库（docker-compose 中 postgres-test 服务，端口 5433，通过 DATABASE_URL_TEST 环境变量区分）
- 测试数据隔离: 每个测试文件使用事务回滚
- 后端测试: Vitest（environment: node），含契约测试和集成测试
- 前端测试: Vitest + React Testing Library + jsdom（通过 vitest.config.ts 中 environmentMatchGlobs 自动为 web-app 测试切换 jsdom 环境）
- E2E 测试: Playwright（Chromium），配置在 playwright.config.ts
- Mock: MSW (Mock Service Worker) 用于前端测试中拦截 HTTP 请求

## Git 规则
- 每次完成一个有意义的改动后，主动 commit
- commit message 格式：`<type>(<module>): <描述为什么改> [#issue-number]`
- type: feat / fix / docs / refactor / test
- 不要把无关改动放在同一个 commit

## 共享代码修改规则
- 修改 infra/、共享类型、共享工具前，先在 Issue comment 中说明需求，获得技术负责人确认

## 不要做的事
> 注意：CLAUDE.md 会被所有 Agent 加载。如果某条规则只针对特定角色，请标注适用角色。

- 不要修改契约测试代码（仅限 Implementer agent）
- 不要修改其他模块目录下的文件（仅限 Implementer agent）
- 不要引入事件总线、消息队列等异步通信机制（一期不需要）
- 不要在 coaching 模块中存储教练评分冗余字段（由 review 模块实时计算）
- 不要让下层模块依赖上层模块（如 user 不可依赖 activity，activity 不可依赖 match-record）
- 不要在 controller 层直接操作数据库，必须通过 service → repository 链路
- 不要在业务模块中直接使用 console.log，必须使用 infra/logger.ts
- 不要在日志中记录敏感信息（手机号全文、验证码、JWT token）
- 不要为活动/课程状态流转引入延迟队列或定时器，统一使用定时任务轮询

## 阻塞与错误处理
遇到以下情况时，停止当前工作并通过 `gh issue comment` 报告：
- **文档矛盾或模糊** — 指出具体哪两处矛盾，不要自行假设
- **依赖未就绪** — 说明依赖什么、当前状态是什么
- **需要修改 infra/** — 说明需要什么、用途是什么，等技术负责人确认
- **发现接口需要变更** — 描述变更内容和原因，等技术负责人评估影响范围
- **同一问题修改超过 2 次未解决** — 停止，分析根本原因，给出不同方案
- **超出当前 Task 范围** — 说明哪些工作超出范围，等待确认
