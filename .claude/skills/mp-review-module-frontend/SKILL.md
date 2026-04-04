---
context: fork
name: mp-review-module-frontend
description: "前端模块所有 feature 的 Task 完成后的整体 Review"
argument-hint: "<module-name>"
---

你是一个代码审查工程师。请对指定前端模块进行整体 Review。

模块名：$ARGUMENTS

该前端模块的所有 feature 的 Task 已逐个 Review 通过。本次 Review 关注模块级的一致性和完整性。

请先阅读以下文件：
- CLAUDE.md
- docs/module-design/{module}.md（整体设计：共享层、路由结构、API Client 配置）

然后确定该模块的 feature 列表：
- 在 `docs/module-design/` 中查找所有 `{module}-*.md` 文件，每个文件对应一个 feature
- 逐个阅读 feature 设计文档 `docs/module-design/{module}-{feature}.md`

然后阅读该模块的全部源代码：
- `{web|admin}/features/` 下各 feature 目录
- `{web|admin}/shared/`（共享层）

> **Review 策略**：先按 feature 分段 review（逐个 `{web|admin}/features/{feature}/`），再做跨 feature 一致性检查（feature 间无隐式依赖、共享层无 feature 专属逻辑）。

检查清单：
1. 模块内命名风格是否一致（变量、函数、文件命名）
2. 错误处理方式是否统一（API 错误处理、用户提示方式）
3. module-design 中定义的所有页面和路由是否都已实现
4. 页面组件是否只通过 hooks/API 层获取数据（不直接发起请求）
5. 路由结构是否与 module-design 中的路由表一致
6. 共享组件与 feature 私有组件的边界是否清晰（共享层无 feature 专属逻辑，feature 内无重复的共享组件）
7. 状态管理策略是否符合约定（页面内 useState、跨页面 Zustand、服务端数据 TanStack Query）
8. feature 间是否存在隐式依赖（直接 import 其他 feature 内部文件）
9. 是否有不必要的代码重复
10. CLAUDE.md 中的约定是否都被遵守

输出格式（同 Task Review）：
- MUST FIX / SHOULD FIX / OPTIONAL / LGTM

完成后：将 Review 结果（LGTM / MUST FIX / SHOULD FIX 清单）输出给技术负责人，**不自动更新 `docs/workflow-state.md`**。

> **状态更新边界**：Review 类 skill 只输出结论，不修改 workflow-state。状态转换由技术负责人根据 Review 结论调用 `/mp-workflow-update` 触发（如 `/mp-workflow-update web-app 模块 Review LGTM`）。
