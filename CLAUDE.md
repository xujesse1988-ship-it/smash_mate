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
- `docker compose up -d` — 启动本地依赖（PostgreSQL 等）
- `docker compose down` — 停止本地依赖
- `npm run dev:server` — 启动后端开发服务器
- `npm run dev:web` — 启动前端 SPA
- `npm run dev:admin` — 启动管理后台
- `npx vitest` — 跑全部测试
- `npx vitest tests/contracts` — 只跑契约测试
- `npx vitest tests/integration` — 只跑集成测试
- `npx vitest {file}` — 跑单个文件测试
- `npm run lint` — ESLint + Prettier 检查
- `npx prisma db seed` — 填充种子数据
- `npm run build` — 构建全部

## 项目结构
```
server/                        # 后端
├── modules/
│   ├── {module-a}/
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── {module-b}/
│       └── ...
├── infra/
│   ├── database.ts
│   ├── config.ts
│   ├── logger.ts
│   ├── error-handler.ts
│   └── response.ts
└── app.ts

web/                           # 前端 SPA
├── features/                  # 按业务域组织
│   ├── {feature-a}/
│   │   ├── pages/             # 页面组件
│   │   ├── components/        # feature 私有组件
│   │   ├── hooks/             # feature 私有 hooks
│   │   └── api/               # feature 私有 API 调用
│   └── {feature-b}/
│       └── ...
├── shared/                    # 共享组件、hooks、工具函数、类型
├── stores/                    # 全局状态管理
├── routes.ts                  # 统一路由
└── main.tsx

admin/                         # 管理后台（结构同 web/）
└── ...

tests/
├── contracts/                 # 契约测试（按模块组织，前端按 feature 子目录）
├── unit/                      # 单元测试（按模块组织）
├── integration/               # 集成测试
│   ├── {module-a}/            # L1: 后端模块内集成
│   ├── {module-b}/
│   ├── {frontend-module}/     # L1: 前端按 feature 子目录
│   │   ├── {feature-a}/
│   │   └── {feature-b}/
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
- 前端按 feature 组织代码，通过 api/ 层调用后端，组件不直接发请求
- 前端状态：页面内用 useState，跨页面用 Zustand，服务端数据用 TanStack Query

## 日志约定
- 使用 infra/logger.ts 提供的 logger，禁止直接 console.log
- 日志级别通过环境变量 `LOG_LEVEL` 控制（默认 info，测试时可设为 warn 减少噪音）

## 测试环境
- 测试数据库: PostgreSQL 测试库（通过 DATABASE_URL 环境变量区分，由 docker-compose 提供）
- 测试数据隔离: 每个测试文件使用事务回滚
- 前端测试: Vitest + React Testing Library + jsdom

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

## 阻塞与错误处理
遇到以下情况时，停止当前工作并通过 `gh issue comment` 报告：
- **文档矛盾或模糊** — 指出具体哪两处矛盾，不要自行假设
- **依赖未就绪** — 说明依赖什么、当前状态是什么
- **需要修改 infra/** — 说明需要什么、用途是什么，等技术负责人确认
- **发现接口需要变更** — 描述变更内容和原因，等技术负责人评估影响范围
- **同一问题修改超过 2 次未解决** — 停止，分析根本原因，给出不同方案
- **超出当前 Task 范围** — 说明哪些工作超出范围，等待确认
