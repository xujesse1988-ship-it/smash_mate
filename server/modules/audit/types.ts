import type { Request } from 'express';

/**
 * 输入参数：audit.log 接口
 *
 * 业务规则：
 * - `action` 必填，形如 "activity.cancel"、"auth.login.wx"（建议使用 "<module>.<verb>" 命名）
 * - `userId` 可选：未登录场景（登录失败、未授权访问）时允许为空
 * - `targetType` / `targetId` 可选：用于定位被操作对象
 * - `metadata` 可选：业务语义字段（取消原因、关键快照等），不做全量 diff
 * - `req` 可选：传入后会自动抽取 `req.ip` 和 `req.headers['user-agent']`，
 *   调用方也可以直接通过 `ip` / `userAgent` 显式传入覆盖
 */
export interface AuditLogInput {
  userId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  req?: Pick<Request, 'ip' | 'headers'>;
}
