#!/usr/bin/env bash
#
# 测试环境部署脚本
# 用法：在项目根目录执行 ./scripts/deploy.test.sh
#
# 职责：拉代码 → 装依赖 → 生成 Prisma Client → 应用迁移 → 构建 → 重启服务
#
# 与生产部署的差异：
#   - 不需要 CONFIRM_PROD 二次确认
#   - RESTART_CMD 默认留空，如果未设置只打印提示，不强制重启
#   - 允许本地有未提交改动（仅 warn）

set -euo pipefail

# ---------------------------------------------------------------------------
# 配置区
# ---------------------------------------------------------------------------

# 重启命令：根据测试环境实际进程管理方式设置，未设置则跳过。
# 例：RESTART_CMD="pm2 reload smash-mate-server-test"
RESTART_CMD="${RESTART_CMD:-}"

BRANCH="${BRANCH:-main}"
SCHEMA_PATH="server/prisma/schema.prisma"

# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

log() {
  printf '\n\033[1;34m[deploy:test]\033[0m %s\n' "$*"
}

warn() {
  printf '\n\033[1;33m[deploy:test][WARN]\033[0m %s\n' "$*" >&2
}

cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------
# 1. 拉取最新代码
# ---------------------------------------------------------------------------

log "Step 1/6  git pull (branch=${BRANCH})"
git fetch origin "${BRANCH}"
if ! git diff-index --quiet HEAD --; then
  warn "本地有未提交改动，测试环境继续执行（生产会拒绝）"
fi
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

CURRENT_COMMIT=$(git rev-parse --short HEAD)
log "当前 commit: ${CURRENT_COMMIT}"

# ---------------------------------------------------------------------------
# 2. 安装依赖
# ---------------------------------------------------------------------------

log "Step 2/6  npm ci"
npm ci

# ---------------------------------------------------------------------------
# 3. 生成 Prisma Client
# ---------------------------------------------------------------------------

log "Step 3/6  prisma generate"
npx prisma generate --schema="${SCHEMA_PATH}"

# ---------------------------------------------------------------------------
# 4. 应用数据库迁移
# ---------------------------------------------------------------------------

log "Step 4/6  prisma migrate deploy"
npx prisma migrate deploy --schema="${SCHEMA_PATH}"

# ---------------------------------------------------------------------------
# 5. 构建
# ---------------------------------------------------------------------------

log "Step 5/6  npm run build"
npm run build

# ---------------------------------------------------------------------------
# 6. 重启服务（可选）
# ---------------------------------------------------------------------------

log "Step 6/6  restart service"
if [[ -z "${RESTART_CMD}" ]]; then
  warn "未设置 RESTART_CMD，跳过重启。手动重启或设置后重跑："
  warn "  RESTART_CMD='pm2 reload xxx' ./scripts/deploy.test.sh"
else
  log "执行: ${RESTART_CMD}"
  eval "${RESTART_CMD}"
fi

log "部署完成 ✓  (commit ${CURRENT_COMMIT})"
