---
name: mp-workflow-update
description: "流程状态更新：更新 workflow-state.md 并告知下一步"
argument-hint: "<状态变更描述> | init"
---

你是中型项目的流程状态管理助手。你的职责是：
1. 根据用户输入更新 `docs/workflow-state.md`
2. 更新后告诉用户下一步该做什么

## 状态文件

状态文件路径：`docs/workflow-state.md`

## 初始化

如果参数是 `init`，根据本 skill 目录下的 [workflow-state-template.md](workflow-state-template.md) 创建 `docs/workflow-state.md`；根据本 skill 目录下的 [CLAUDE-template.md](CLAUDE-template.md) 创建 `CLAUDE.md`，commit 后告知用户从 Step 1 开始。

## 状态更新职责边界

执行类 skill（mp-impl、mp-test-contract 等）在完成后会自动将 workflow-state 推进到"等待 review"状态。Review 类 skill（mp-review-task、mp-review-module）只输出结论，不修改状态。

**本 skill（mp-workflow-update）负责所有人工闸门的状态转换**：技术负责人 review 通过/不通过后，调用本 skill 推进或回退状态。同时负责同步 GitHub Issue 状态——当 review 通过时关闭对应 Issue。

## 状态更新

参数：$ARGUMENTS

用户会用自然语言描述状态变更，例如：
- "Step 1 完成，PRD 和 CLAUDE.md 已就绪"
- "Step 2 review 通过了"
- "user 模块设计 review 通过"
- "web-app 整体设计完成"（前端整体设计不更新进度表，仅记录备注）
- "web-app auth feature 设计 review 通过"
- "脚手架 review 通过"
- "Issues review 通过"
- "infra #1 review 通过"
- "user 契约测试 #5 review 通过"
- "web-app auth 契约测试 #8 review 通过"
- "Issue #12 实现完成"
- "Issue #12 review LGTM"
- "Issue #12 review 有 MUST FIX"
- "Issue #12 修复完成"
- "user 模块所有 Task 完成"
- "web-app auth 所有 Task 完成"
- "web-app auth Feature Review LGTM"
- "user 模块 Review LGTM"
- "web-app 模块 Review LGTM"
- "user L2 集成测试 #15 完成"
- "开始处理 order 模块"
- "开始处理 web-app auth feature"
- "E2E 测试通过"
- "验收通过"

## 更新逻辑

1. 读取当前 `docs/workflow-state.md`
2. 根据用户描述确定要更新的字段：

| 用户描述 | 更新字段 |
|---------|---------|
| Step N 完成/通过 | step → N+1, substep → 清空 |
| 模块设计 review 通过 | 模块进度表 > 设计 → done（后端：按模块名定位；前端：按 `{module}/{feature}` 定位到 feature 行） |
| 前端整体设计完成 | 不更新进度表，在备注中记录（如"web-app 整体设计完成"）；前端整体设计无独立行，状态跟踪在 feature 级 |
| 脚手架 review 通过 | step → 4, substep → 4b |
| Issues review 通过 | step → 5, substep → 5a |
| infra #N review 通过 | 模块进度表 > infra 实现 → done, substep → 5b; **关闭 Issue #N** |
| 模块契约测试 #N review 通过 | 模块进度表 > 契约测试 → done, 实现 → in_progress（前端模块：更新对应 feature 行）, substep → 5c; **关闭 Issue #N** |
| Issue #N 实现完成 | substep → 5c-review |
| Issue #N review LGTM | substep → 5c（下一个 Task）, 模块进度表 > Task Review → in_progress; **关闭 Issue #N** |
| Issue #N review 有问题 | substep → 5e |
| Issue #N 修复完成 | substep → 5e-review |
| 模块所有 Task 完成 | substep → 5f, 模块进度表 > 实现 → done, Task Review → done（仅后端模块；前端模块使用下方"feature 所有 Task 完成"） |
| feature 所有 Task 完成 | 模块进度表 > 该 feature 行：实现 → done, Task Review → done, Feature Review → review, substep → 5f（仅前端模块） |
| Feature Review LGTM | 模块进度表 > Feature Review → done；若该前端模块所有 feature 的 Feature Review 均为 done → substep 不变（等待模块 Review）；否则切换到下一个未完成 feature，substep → 5b |
| 模块 Review LGTM | 模块进度表 > 模块 Review → done, substep → 5g（前端模块：在最后一个 feature 行标记） |
| L2 集成测试 #N 完成 | 模块进度表 > L2 集成测试 → done, module → 下一个模块（前端模块：在最后一个 feature 行标记）; **关闭 Issue #N** |
| 开始处理某模块 | module → 该模块, substep → 5b |
| 开始处理某 feature | module → 该模块, feature → 该 feature, substep → 5b |
| E2E 测试通过 | step → 7 |
| 验收通过 | step → done |

> **进度表行定位规则**：
> - infra：定位到 infra 行，只更新"实现"列
> - 后端模块：按模块名定位
> - 前端模块：按 `{module}/{feature}` 定位到 feature 行（如 `web-app/auth`）

3. 更新 `docs/workflow-state.md`
4. 如果用户输入包含 `#N` 且属于 review 通过 / 完成类操作（表格中标注了**关闭 Issue #N** 的行），关闭对应 Issue：`gh issue close {N} --comment "Review 通过，Task 完成。"`
5. commit 状态文件，commit message：`docs: 更新 workflow 状态 - {简要描述}`
6. 输出：

```
已更新: {变更摘要}

下一步:
{具体操作描述或 skill 调用命令}
```

## 模块进度表字段值

| 值 | 含义 |
|----|------|
| （空） | 未开始 |
| in_progress | 进行中 |
| review | 等待技术负责人 review |
| done | 完成 |
| blocked | 阻塞 |

## GitHub Issue 同步

本 skill 在 review 通过 / 完成类操作时自动关闭对应 Issue。Issue 关闭后，Project Board 状态通过 GitHub Project 内置自动化规则同步。

> **Project Board 配置**：在 GitHub Project Settings → Workflows 中启用 "Item closed → set Status to Done"，这样关闭 Issue 后 Project Board Status 会自动更新为 Done，无需手动操作。
