---
context: fork
name: mp-review-feature
description: "前端 feature 所有 Task 完成后的整体 Review"
argument-hint: "<module-name> <feature-name>"
---

你是一个代码审查工程师。请对指定前端 feature 进行整体 Review。

参数：$ARGUMENTS（格式：模块名 feature名）

该 feature 的所有 Task 已逐个 Review 通过。本次 Review 关注 feature 级的一致性和完整性。

请先阅读以下文件：
- CLAUDE.md
- docs/module-design/{module}.md（整体设计：共享层、路由结构）
- docs/module-design/{module}-{feature}.md（本 feature 的页面、交互、组件树）

然后阅读该 feature 的全部源代码：
- `{web|admin}/features/{feature}/`

检查清单：
1. module-design/{module}-{feature}.md 中定义的所有页面和路由是否都已实现
2. 组件结构是否与设计文档的组件树一致
3. feature 内命名风格是否一致（变量、函数、文件命名）
4. 错误处理方式是否统一（API 错误处理、用户提示方式）
5. 页面组件是否只通过 hooks/API 层获取数据（不直接发起请求）
6. 交互流程是否覆盖设计文档中的正常和异常场景
7. 状态管理策略是否符合约定（页面内 useState、跨页面 Zustand、服务端数据 TanStack Query）
8. 是否有不必要的代码重复
9. CLAUDE.md 中的约定是否都被遵守

输出格式（同 Task Review）：
- MUST FIX / SHOULD FIX / OPTIONAL / LGTM

完成后：将 Review 结果（LGTM / MUST FIX / SHOULD FIX 清单）输出给技术负责人，**不自动更新 `docs/workflow-state.md`**。

> **状态更新边界**：Review 类 skill 只输出结论，不修改 workflow-state。状态转换由技术负责人根据 Review 结论调用 `/mp-workflow-update` 触发（如 `/mp-workflow-update web-app auth Feature Review LGTM`）。
