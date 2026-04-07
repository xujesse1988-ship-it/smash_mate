# Workflow State

## 当前阶段
step: 5
substep: 5e-review

## 当前模块
module: web-app
feature: activity

## 模块进度

| 模块 | 类型 | 设计 | 契约测试 | 实现 | Task Review | 模块 Review | L2 集成测试 |
|------|------|------|---------|------|------------|------------|------------|
| infra | 基础设施 | N/A | N/A | done | N/A | N/A | N/A |
| user | 后端 | done | done | done | done | done | N/A |
| venue | 后端 | done | done | done | done | done | N/A |
| notification | 后端 | done | done | done | done | done | N/A |
| activity | 后端 | done | done | done | done | done | done |
| coaching | 后端 | done | done | done | done | done | done |
| match-record | 后端 | done | done | done | done | done | |
| review | 后端 | done | done | done | done | done | done |
| web-app/auth | 前端 | done | done | done | done | | |
| web-app/activity | 前端 | done | done | in_progress | | | |
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
current_milestone: Milestone 3: 前端 + 集成测试

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
venue 契约测试 #21（城市与球馆管理接口）review 通过（2026-04-04）。venue 模块契约测试全部完成（62 个用例），进入实现阶段。
venue #22 实现完成（2026-04-04）：搜索+详情+跨模块+管理员接口（含 #23 范围）。契约测试 62 通过，L1 集成测试 23 通过，全量 238 通过。
venue #22 review 有 SHOULD FIX（2026-04-04）：syncVenues 计数不准确（忽略 upsertVenues 返回值）。需修复。
venue #22 review 问题已修复（2026-04-04）：修复 syncVenues 和 createCity 中 upsertVenues 返回值未使用导致 newVenues/updatedVenues 计数不准确。等待重新 review。
venue #22 review LGTM（2026-04-04）。Issue #22 关闭。#22 已包含 #23 全部实现，Issue #23 一并关闭。venue 模块所有 Task 完成，进入模块 Review。
venue 模块 Review 反馈（2026-04-04）：补全 mock 中 countVenuesByCity + 注册 scheduler cron task。已修复，等待重新 Review。
venue 模块 Review LGTM（2026-04-04）。venue 模块完成（基础层，无 L2 集成测试）。238 个测试全通过。进入 notification 模块。
notification 契约测试 #24 review 通过（2026-04-04）。46 个用例，进入实现阶段。
notification #25 实现完成（2026-04-04）：通知列表（分页+筛选）、未读计数、标记已读（单条+全部）、跨模块创建接口（create/createBatch）、定时清理（90天）。契约测试 46 通过，L1 集成测试 38 通过，全量 322 通过。等待 review。
notification #25 review LGTM（2026-04-04）。Issue #25 关闭。notification 模块所有 Task 完成（#25），进入模块 Review。
notification 模块 Review LGTM（2026-04-04）。notification 模块完成（基础层，无 L2 集成测试）。322 个测试全通过。Milestone 1 全部完成，进入 Milestone 2 — activity 模块。
activity 契约测试 #26（创建、列表与详情）review 通过（2026-04-04）。69 个用例。#27（参与、修改与取消）待开始。
activity 契约测试 #27（参与、修改与取消）review 通过（2026-04-04）。73 个用例。activity 模块契约测试全部完成（142 个用例），进入实现阶段。
activity #28（活动创建、列表查询与详情）实现完成（2026-04-03）：创建活动（含球馆校验、发起人自动加入）、活动列表（筛选/分页/距离排序）、活动详情（含参与者+创建者信息）、用户活动列表、加入/退出活动（满员联动）、修改/取消活动（通知参与者）、跨模块接口 getActivityById/getParticipantIds、定时任务状态流转。契约测试 142 通过，L1 集成测试 29 通过，全量 493 通过。等待 review。
activity #28 review 有 SHOULD FIX（2026-04-04）：join/leave 状态更新重复执行（并发竞态风险）、findList dead code。需修复。
activity #28 review 问题已修复（2026-04-04）：修复 3 个 SHOULD FIX（join/leave 重复状态更新、findList dead code、确认 #29 覆盖 join/leave 测试）。契约测试 142 通过，L1 集成测试 29 通过，全量 493 通过。等待重新 review。
activity #28 review LGTM（2026-04-04）。Issue #28 关闭。#28 已包含 #29 全部实现，Issue #29 一并关闭。activity 模块所有 Task 完成，进入模块 Review。
activity 模块 Review LGTM（2026-04-04）。activity 模块后端完成（L2 集成测试 #55 待 match-record 完成后触发）。进入 coaching 模块。
coaching 契约测试 #30（教练资料与团课）review 通过（2026-04-05）。172 个用例（含 #31 范围）。#31 待确认。
coaching 契约测试 #31（团课报名与私教预约）review 通过（2026-04-05）。coaching 模块契约测试全部完成（172 个用例），进入实现阶段。
coaching #32（教练资料管理与团课发布/修改/取消）实现完成（2026-04-03）：教练列表、教练主页、更新教练资料（含自动创建 CoachProfile）、发布/修改/取消团课、团课详情、课程状态自动流转定时任务、跨模块 getGroupClassById 接口。契约测试 75 通过，L1 集成测试 37 通过。等待 review。
coaching #32 review 问题已修复（第二轮，2026-04-05）：MUST FIX（findGroupClassesByCoach 契约测试兼容）、SHOULD FIX（bookPrivateLesson 201 响应码、N+1 注释）。契约测试 75 通过，L1 集成测试 37 通过。等待重新 review。
coaching #32 review LGTM（2026-04-05）。Issue #32 关闭。继续实现 #33（团课报名、私教预约与状态流转）。
coaching #33（团课报名、私教预约与状态流转）实现完成（2026-04-05）：报名/取消报名团课（满员联动）、设置/查询私教空闲时间（重叠检测）、预约/取消私教课（时间段锁定/释放）、用户课程报名列表、教练私教预约列表、跨模块 getPrivateLessonById/getParticipantIds、定时任务状态流转（私教课部分）。契约测试 172 通过，L1 集成测试 99 通过，全量 764 通过。等待 review。
coaching #33 review LGTM（2026-04-05）。Issue #33 关闭。coaching 模块所有 Task 完成（#32 + #33），进入模块 Review。
coaching 模块 Review LGTM（2026-04-05）。coaching 模块后端完成（L2 集成测试 #56 #57 待 match-record/review 完成后触发）。764 个测试全通过。进入 match-record 模块。
match-record 契约测试 #34（战绩录入与删除）编写完成（2026-04-05）。52 个用例，等待 review。
match-record 契约测试 #34（战绩录入与删除）review 通过（2026-04-05）。#35（战绩列表与统计）待开始。
match-record 契约测试 #35（战绩列表与统计）review 通过（2026-04-05）。match-record 模块契约测试全部完成（103 个用例），进入实现阶段。
match-record #36（战绩录入与删除）实现完成（2026-04-05）：录入战绩（单打/双打，三种来源）、删除战绩（仅录入者）、活动/团课/私教课战绩列表、个人战绩历史（分页+筛选）、个人战绩汇总（winRate 计算）、参与关系校验（跨模块）、GuestPlayer 自动创建、胜负判定算法。契约测试 103 通过，L1 集成测试 20 通过，单元测试 18 通过，全量 905 通过。等待 review。
match-record #36 review LGTM（2026-04-05）。Issue #36 关闭。#36 已包含 #37 全部实现，Issue #37 一并关闭。match-record 模块所有 Task 完成，进入模块 Review。
match-record 模块 Review LGTM（2026-04-05）。match-record 模块后端完成。L2 #55（约球活动全流程）依赖已满足（activity + match-record），可触发。进入 L2 集成测试阶段。
L2 #55（约球活动全流程）review 通过（2026-04-05）。12 个用例，Issue #55 关闭。activity 模块全部完成。进入 review 模块。
review 契约测试 #38（评价提交、列表与评分查询）review 通过（2026-04-05）。65 个用例，进入实现阶段。
review #39（评价提交、列表与评分计算）实现完成（2026-04-05）：评价提交（教练/课程/参与者校验、去重、通知）、教练评价列表（分页、批量获取评价者信息、已注销用户占位）、教练评分查询（实时聚合计算）、批量教练评分查询（GROUP BY 避免 N+1）、模块间接口 getCoachAverageRating。契约测试 65 通过，L1 集成测试 25 通过。等待 review。
review #39 review LGTM（2026-04-05）。Issue #39 关闭。review 模块所有 Task 完成（#39），进入模块 Review。
review 模块 Review 反馈（2026-04-05）：SHOULD FIX — getCoachAverageRating 使用 as CoachRating 强转但返回对象缺少 coachId 字段。已修复（新增 AverageRatingResult 类型），等待重新 Review。
review 模块 Review LGTM（2026-04-05）。review 模块后端完成。全部后端模块完成。L2 #56（教练团课全流程）和 #57（私教预约全流程）依赖已满足，可触发。
L2 #56（教练团课全流程）集成测试完成（2026-04-05）：10 个用例覆盖发布→报名→状态流转→评价→评分验证→战绩录入→战绩列表→满员联动。全量 1018 通过。等待 review。
L2 #56 review 通过（2026-04-05）。Issue #56 关闭。coaching 模块全部完成。
L2 #57（私教预约全流程）集成测试完成（2026-04-05）：16 个用例覆盖设置空闲时间→预约→时间段锁定→取消→时间段释放→重新预约→状态流转→评价→评分验证、时间段冲突、取消幂等性、不可取消状态、教练自约拦截、课程未结束评价拦截、非参与者评价拦截、重复评价拦截、球馆选择校验。全量 1034 通过。等待 review。
L2 #57 review 通过（2026-04-05）。Issue #57 关闭。review 模块全部完成。Milestone 2 全部完成（全部后端模块 + 3 个 L2 集成测试）。1034 个测试全通过。进入 Milestone 3（前端 + 集成测试），从 web-app/auth 开始。
web-app/auth 前端契约测试 #40 编写完成（2026-04-05）：API 层 16 用例（sendCode 5 + login 11）+ LoginPage 渲染 24 用例，共 40 用例。TDD 状态全部红色。等待 review。
web-app/auth 前端契约测试 #40 review 通过（2026-04-05）。40 个用例，进入实现阶段。
web-app/auth #41 实现完成（2026-04-05）：LoginPage 页面（登录/注册 Tab、手机号+验证码表单、教练复选框、路由保护）、API 层（sendCode/login）、Hooks（useSendCode/useLogin/useRedirectUrl）、路由注册。契约测试 40 通过，L1 集成测试 14 通过，全量 1088 通过。
web-app/auth #41 review 问题已修复（2026-04-05）：hooks 改用 useMutation、useLogin 参数改为直接 boolean、auth-api 添加 TODO 标注统一 API Client、移除无效 polyfill、L1 集成测试添加 QueryClientProvider。全量 1088 通过。等待重新 review。
web-app/auth #41 review LGTM（2026-04-05）。Issue #41 关闭。web-app/auth feature 所有 Task 完成（#41），进入 Feature Review。
web-app/auth Feature Review LGTM（2026-04-05）。auth feature 完成。进入下一个 feature: web-app/activity。
web-app/activity 前端契约测试 #42 编写完成（2026-04-05）：API 层 60 用例 + 页面渲染 72 用例，共 132 用例。TDD 状态 126 红色 + 6 绿色（negative 断言）。等待 review。
web-app/activity 契约测试 #42 review 通过（2026-04-07）。132 个用例，进入实现阶段。
web-app/activity #43 实现完成（2026-04-07）：ActivityListPage（筛选/排序/距离联动）、CreateActivityPage（表单校验）、ActivityDetailPage（加入/退出/编辑/取消/战绩）、MyActivityListPage（角色+状态筛选）、10 个 hooks、API 层。契约测试 142 通过，L1 集成测试 26 通过，全量 222 通过（web-app project）。
web-app/activity #43 review 问题已修复（2026-04-07）：SHOULD FIX 1（match-record HTTP 请求移至 API 层）、SHOULD FIX 2（共享代码 useGeolocation 事后报备）、SHOULD FIX 3（ActivityCard 提取为共享组件）、SHOULD FIX 4（STATUS_LABELS 提取为常量）。契约测试 168 通过，L1 集成测试 26 通过。等待重新 review。
