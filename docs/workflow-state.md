# Workflow State

## 当前阶段
step: 5
substep: 5b

## 当前模块
module: venue
feature:

## 模块进度

| 模块 | 类型 | 设计 | 契约测试 | 实现 | Task Review | 模块 Review | L2 集成测试 |
|------|------|------|---------|------|------------|------------|------------|
| infra | 基础设施 | N/A | N/A | done | N/A | N/A | N/A |
| user | 后端 | done | done | done | done | done | N/A |
| venue | 后端 | done | in_progress | | | | |
| notification | 后端 | done | | | | | |
| activity | 后端 | done | | | | | |
| coaching | 后端 | done | | | | | |
| match-record | 后端 | done | | | | | |
| review | 后端 | done | | | | | |
| web-app/auth | 前端 | done | | | | | |
| web-app/activity | 前端 | done | | | | | |
| web-app/coaching | 前端 | done | | | | | |
| web-app/match-record | 前端 | done | | | | | |
| web-app/profile | 前端 | done | | | | | |
| web-app/notification | 前端 | done | | | | | |
| admin | 前端 | done | | | | | |

> **填写规则**：
> - **infra**：只跟踪"实现"列，其余标 `N/A`（infra 设计在 architecture.md 中，无契约测试、无独立模块 Review、无 L2 集成测试）
> - **后端模块**：每个模块一行，所有列均适用
> - **前端模块**：按 feature 粒度拆行（如 `web-app/auth`、`web-app/activity`），以匹配 feature 级设计文档和测试粒度；"模块 Review"和"L2 集成测试"仅在该前端模块的最后一个 feature 行标记
> - 如果 admin 页面较少未拆 feature，保留为一行

## Issue 总览

### Milestone 1: 基础设施 + 基础层
| Issue | 标题 | 类型 | 模块 |
|-------|------|------|------|
| #1 | [infra] 实现: 基础设施模块 | infra | infra |
| #2 | [user] 用户模块（父） | 模块 | user |
| #16 | [user] 契约测试: 认证接口 | 契约测试 | user |
| #17 | [user] 契约测试: 用户信息与资料管理接口 | 契约测试 | user |
| #18 | [user] 实现: 认证功能 | 实现 | user |
| #19 | [user] 实现: 用户资料管理与教练角色开启 | 实现 | user |
| #3 | [venue] 球馆管理模块（父） | 模块 | venue |
| #20 | [venue] 契约测试: 球馆搜索与详情接口 | 契约测试 | venue |
| #21 | [venue] 契约测试: 城市与球馆管理接口 | 契约测试 | venue |
| #22 | [venue] 实现: 球馆搜索、详情与模块间接口 | 实现 | venue |
| #23 | [venue] 实现: 城市管理、球馆管理与数据同步 | 实现 | venue |
| #4 | [notification] 通知模块（父） | 模块 | notification |
| #24 | [notification] 契约测试: 通知查询与已读管理 | 契约测试 | notification |
| #25 | [notification] 实现: 通知查询、已读管理与过期清理 | 实现 | notification |

### Milestone 2: 中间层 + 上层后端
| Issue | 标题 | 类型 | 模块 |
|-------|------|------|------|
| #5 | [activity] 约球活动模块（父） | 模块 | activity |
| #26 | [activity] 契约测试: 活动创建、列表与详情 | 契约测试 | activity |
| #27 | [activity] 契约测试: 活动参与、修改与取消 | 契约测试 | activity |
| #28 | [activity] 实现: 活动创建、列表查询与详情 | 实现 | activity |
| #29 | [activity] 实现: 活动参与、修改、取消与状态流转 | 实现 | activity |
| #6 | [coaching] 教练管理模块（父） | 模块 | coaching |
| #30 | [coaching] 契约测试: 教练资料与团课 | 契约测试 | coaching |
| #31 | [coaching] 契约测试: 团课报名与私教预约 | 契约测试 | coaching |
| #32 | [coaching] 实现: 教练资料与团课发布/修改/取消 | 实现 | coaching |
| #33 | [coaching] 实现: 团课报名、私教预约与状态流转 | 实现 | coaching |
| #7 | [match-record] 战绩记录模块（父） | 模块 | match-record |
| #34 | [match-record] 契约测试: 战绩录入与删除 | 契约测试 | match-record |
| #35 | [match-record] 契约测试: 战绩列表与统计 | 契约测试 | match-record |
| #36 | [match-record] 实现: 战绩录入与删除 | 实现 | match-record |
| #37 | [match-record] 实现: 战绩列表查询与统计 | 实现 | match-record |
| #8 | [review] 评价评分模块（父） | 模块 | review |
| #38 | [review] 契约测试: 评价提交、列表与评分查询 | 契约测试 | review |
| #39 | [review] 实现: 评价提交、列表与评分计算 | 实现 | review |

### Milestone 3: 前端 + 集成测试
| Issue | 标题 | 类型 | 模块 |
|-------|------|------|------|
| #9 | [web-app/auth] 前端注册登录（父） | 模块 | web-app/auth |
| #40 | [web-app/auth] 前端测试: 注册/登录 | 契约测试 | web-app/auth |
| #41 | [web-app/auth] 实现: 注册/登录页面 | 实现 | web-app/auth |
| #10 | [web-app/activity] 前端约球功能（父） | 模块 | web-app/activity |
| #42 | [web-app/activity] 前端测试: 约球功能 | 契约测试 | web-app/activity |
| #43 | [web-app/activity] 实现: 约球页面 | 实现 | web-app/activity |
| #11 | [web-app/coaching] 前端教练功能（父） | 模块 | web-app/coaching |
| #44 | [web-app/coaching] 前端测试: 教练功能 | 契约测试 | web-app/coaching |
| #45 | [web-app/coaching] 实现: 教练列表、主页与团课 | 实现 | web-app/coaching |
| #46 | [web-app/coaching] 实现: 私教预约与课程管理 | 实现 | web-app/coaching |
| #12 | [web-app/match-record] 前端战绩功能（父） | 模块 | web-app/match-record |
| #47 | [web-app/match-record] 前端测试: 战绩功能 | 契约测试 | web-app/match-record |
| #48 | [web-app/match-record] 实现: 战绩页面 | 实现 | web-app/match-record |
| #13 | [web-app/profile] 前端个人主页（父） | 模块 | web-app/profile |
| #49 | [web-app/profile] 前端测试: 个人主页 | 契约测试 | web-app/profile |
| #50 | [web-app/profile] 实现: 个人主页与编辑 | 实现 | web-app/profile |
| #14 | [web-app/notification] 前端通知功能（父） | 模块 | web-app/notification |
| #51 | [web-app/notification] 前端测试: 通知 | 契约测试 | web-app/notification |
| #52 | [web-app/notification] 实现: 通知列表 | 实现 | web-app/notification |
| #15 | [admin] 管理后台模块（父） | 模块 | admin |
| #53 | [admin] 前端测试: 管理后台 | 契约测试 | admin |
| #54 | [admin] 实现: 管理后台 | 实现 | admin |
| #55 | [integration] L2: 约球活动全流程 | L2 集成测试 | activity, match-record |
| #56 | [integration] L2: 教练团课全流程 | L2 集成测试 | coaching, review, match-record |
| #57 | [integration] L2: 私教预约全流程 | L2 集成测试 | coaching, review |

## 依赖关系 DAG

```
#1 (infra)
├── #18 (user 认证) → #19 (user 资料)
├── #22 (venue 搜索) → #23 (venue 管理)
├── #25 (notification)
├── #28 (activity CRUD) ← #22
│   └── #29 (activity 操作) ← #19, #25
│       └── #36 (match-record 录入) ← #19, #33
│           └── #37 (match-record 查询)
├── #32 (coaching 教练+团课) ← #19, #22
│   └── #33 (coaching 报名+私教) ← #25
│       └── #39 (review) ← #19, #25
└── 前端依赖后端:
    #41 (auth) ← #18
    #43 (activity) ← #29, #41
    #45 (coaching-1) ← #32, #39, #41
    #46 (coaching-2) ← #33, #45
    #48 (match-record) ← #37, #41
    #50 (profile) ← #19, #41
    #52 (notification) ← #25, #41
    #54 (admin) ← #18, #23

L2 集成测试:
    #55 ← #29, #36
    #56 ← #33, #39, #36
    #57 ← #33, #39
```

## 迭代
current_milestone: Milestone 1: 基础设施 + 基础层

## 备注
architecture.md Review 通过，进入 Step 3 模块详细设计。
user 模块设计 review 通过（2026-04-02）。
venue 模块设计 review 通过（2026-04-02）。
notification 模块设计 review 通过（2026-04-02）。基础层后端模块设计全部完成。
activity 模块设计 review 通过（2026-04-02）。
coaching 模块设计 review 通过（2026-04-02）。中间层后端模块设计全部完成。
match-record 模块设计 review 通过（2026-04-02）。
review 模块设计 review 通过（2026-04-02）。全部后端模块设计完成。
web-app 前端整体设计 review 通过（2026-04-02）。
web-app/auth feature 设计 review 通过（2026-04-02）。
web-app/activity feature 设计 review 通过（2026-04-02）。
web-app/coaching feature 设计 review 通过（2026-04-03）。
web-app/match-record feature 设计 review 通过（2026-04-03）。
web-app/profile feature 设计 review 通过（2026-04-03）。
web-app/notification feature 设计 review 通过（2026-04-03）。全部 web-app feature 设计完成。
admin 模块设计 review 通过（2026-04-03）。全部模块设计完成，进入汇总检查。
汇总补充完成（2026-04-03）：architecture.md 已补充接口依赖矩阵（10 节）和需求追溯表（11 节）。
汇总 review 通过（2026-04-03）。Step 3 模块详细设计 + 接口契约全部完成，进入 Step 4a 脚手架。
脚手架完成（2026-04-03）：项目目录结构、依赖安装、构建配置、Prisma schema、所有模块桩文件、前端页面和 API 桩文件、docker-compose、测试框架验证通过。
脚手架 review 通过（2026-04-03），进入 Step 4b 任务拆分。
任务拆分完成（2026-04-03）：创建 57 个 GitHub Issues（#1-#57），包含 15 个模块父 Issue、1 个 infra Issue、12 个契约测试 Issue、15 个实现 Issue、7 个前端测试 Issue、7 个前端实现 Issue、3 个 L2 集成测试 Issue。3 个 Milestone 已创建。
Issues review 通过（2026-04-03），进入 Step 5 实现阶段。首先实现 infra（#1）。
infra 实现完成（2026-04-03）：数据库连接、配置管理、认证中间件（JWT + 管理员）、全局错误处理、标准响应格式、结构化日志、requestId 中间件、请求日志、初始迁移、种子脚本。等待 review。
infra #1 review 通过（2026-04-03）。进入 Step 5b，开始 user 模块契约测试。
user 契约测试 #16（认证接口）review 通过（2026-04-03）。#17（用户信息与资料管理接口）待开始。
user 契约测试 #17（用户信息与资料管理接口）review 通过（2026-04-03）。user 模块契约测试全部完成（85 个用例），进入实现阶段。
user #18（认证功能）实现完成（2026-04-03）：验证码发送/验证、登录/注册合一、JWT 签发、手机号锁定、脱敏日志。契约测试 39 通过，L1 集成测试 21 通过。等待 review。
user #18 review 有 SHOULD FIX（2026-04-03）：频率限制查询条件过严、PhoneLock 并发竞态、controller 冗余 re-export、测试数据隔离策略。需修复。
user #18 review 问题已修复（2026-04-03）：修复 3 个 SHOULD FIX（频率限制、upsert 竞态、冗余导出），测试隔离策略保留 deleteMany（需 infra 层变更，建议后续独立处理）。等待重新 review。
user #18 review LGTM（2026-04-03）。Issue #18 关闭。继续实现 #19（用户资料管理与教练角色开启）。
user #19（用户资料管理与教练角色开启）实现完成（2026-04-03）：更新个人资料、开启教练角色、用户公开信息、跨模块 Service 接口。契约测试 49 通过，L1 集成测试 43 通过。等待 review。
user #19 review LGTM（2026-04-03）。Issue #19 关闭。user 模块所有 Task 完成（#18 + #19），进入模块 Review。
user 模块 Review LGTM（2026-04-03）。user 模块完成（基础层，无 L2 集成测试）。152 个测试全通过。进入 venue 模块。
venue 契约测试编写完成（2026-04-03）：#20（搜索+详情+跨模块，27 用例）+ #21（城市管理+球馆管理+数据同步，33 用例），共 60 个用例。等待 review。
venue 契约测试 #20（球馆搜索与详情接口）review 通过（2026-04-04）。#21（城市与球馆管理接口）待确认。
