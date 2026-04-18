#!/usr/bin/env bash
#
# 生产部署脚本
# 用法：在项目根目录执行 CONFIRM_PROD=yes ./scripts/deploy.prod.sh
#
# 职责：拉代码 → 装依赖 → 生成 Prisma Client → 应用迁移 → 构建 → 重启服务
#
# 前置要求：
#   - 服务器已配置 .env（含 DATABASE_URL 等）
#   - git 仓库已有远端权限
#   - 需要的 Node / npm 版本已就绪
#
# 安全：需要设置环境变量 CONFIRM_PROD=yes 才会执行，避免误跑。

set -euo pipefail

if [[ "${CONFIRM_PROD:-}" != "yes" ]]; then
  printf '\n\033[1;31m[deploy][拒绝执行]\033[0m 这是生产部署脚本。\n'
  printf '若确认要部署生产，请执行：\n    CONFIRM_PROD=yes ./scripts/deploy.prod.sh\n'
  printf '测试环境请使用 ./scripts/deploy.test.sh\n\n'
  exit 1
fi

# ---------------------------------------------------------------------------
# 配置区
# ---------------------------------------------------------------------------

# 进程管理器的重启命令。根据你的实际部署方式改一行即可。
# 示例：
#   pm2:      RESTART_CMD="pm2 reload smash-mate-server"
#   systemd:  RESTART_CMD="sudo systemctl restart smash-mate-server"
#   docker:   RESTART_CMD="docker compose restart server"
RESTART_CMD="${RESTART_CMD:-pm2 reload smash-mate-server}"

# 要追踪的 git 分支
BRANCH="${BRANCH:-main}"

# Prisma schema 路径
SCHEMA_PATH="server/prisma/schema.prisma"

# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

log() {
  printf '\n\033[1;34m[deploy]\033[0m %s\n' "$*"
}

fail() {
  printf '\n\033[1;31m[deploy][FAIL]\033[0m %s\n' "$*" >&2
  exit 1
}

# 切到项目根目录（脚本所在目录的上一级）
cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------
# 1. 拉取最新代码
# ---------------------------------------------------------------------------

log "Step 1/6  git pull (branch=${BRANCH})"
git fetch origin "${BRANCH}"
# 若本地有未提交改动则中止，避免覆盖
if ! git diff-index --quiet HEAD --; then
  fail "本地有未提交改动，请先处理后重试"
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
# 4. 应用数据库迁移（生产专用，非交互）
# ---------------------------------------------------------------------------

log "Step 4/6  prisma migrate deploy"
npx prisma migrate deploy --schema="${SCHEMA_PATH}"

# ---------------------------------------------------------------------------
# 5. 构建
# ---------------------------------------------------------------------------

log "Step 5/6  npm run build"
npm run build

# ---------------------------------------------------------------------------
# 6. 重启服务
# ---------------------------------------------------------------------------

log "Step 6/6  restart service"
log "执行: ${RESTART_CMD}"
eval "${RESTART_CMD}"

log "部署完成 ✓  (commit ${CURRENT_COMMIT})"
