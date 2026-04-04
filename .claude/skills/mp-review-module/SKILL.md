---
context: fork
name: mp-review-module
description: "后端模块所有 Task 完成后的整体 Review"
argument-hint: "<module-name>"
---

你是一个代码审查工程师。请对指定后端模块进行整体 Review。

模块名：$ARGUMENTS

该模块的所有 Task 已逐个 Review 通过。本次 Review 关注模块级的一致性和完整性。

请先阅读以下文件：
- CLAUDE.md
- docs/module-design/{module}.md

然后阅读该模块的全部源代码：
- server/modules/{module}/

检查清单：
1. 模块内命名风格是否一致（变量、函数、文件命名）
2. 错误处理方式是否统一（错误码格式、异常抛出方式）
3. module-design/{module}.md 中的所有接口是否都已实现
4. 模块内各层职责是否清晰（controller 不含业务逻辑、repository 不含校验逻辑等）
5. 是否有跨层泄漏（如 controller 直接调用 repository）
6. 是否有不必要的代码重复
7. CLAUDE.md 中的约定是否都被遵守

输出格式（同 Task Review）：
- MUST FIX / SHOULD FIX / OPTIONAL / LGTM

完成后：将 Review 结果（LGTM / MUST FIX / SHOULD FIX 清单）输出给技术负责人，**不自动更新 `docs/workflow-state.md`**。

> **状态更新边界**：Review 类 skill 只输出结论，不修改 workflow-state。状态转换由技术负责人根据 Review 结论调用 `/mp-workflow-update` 触发（如 `/mp-workflow-update user 模块 Review LGTM`）。
