import { createModuleLogger } from '../../infra/logger.js';
import { AuditRepository } from './repository.js';
import type { AuditLogInput } from './types.js';

const logger = createModuleLogger('audit');

/**
 * 审计日志服务。
 *
 * 设计原则（对齐 CLAUDE.md "通知创建失败不阻塞主流程"）：
 * - `log()` 内部 try/catch，任何异常（参数错误、数据库异常）只记 error 日志，不向上抛出
 * - 调用方无需额外 try/catch，一行 `auditService.log({...})` 即可埋点
 * - 不依赖其他业务模块（归属基础层，与 user / venue / notification 同层）
 */
export class AuditService {
  private repo: AuditRepository;

  constructor(repo: AuditRepository) {
    this.repo = repo;
  }

  /**
   * 记录一条操作日志。失败不阻塞主流程。
   *
   * - 若传入 `req`，自动抽取 `req.ip` 和 `req.headers['user-agent']`
   * - 调用方显式传入的 `ip` / `userAgent` 优先级高于从 `req` 抽取的值
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      if (!input || typeof input.action !== 'string' || input.action.trim() === '') {
        logger.error({ input }, 'audit.log 调用缺少 action 参数');
        return;
      }

      const fromReqIp = input.req?.ip;
      const fromReqUa = input.req?.headers?.['user-agent'];
      const userAgentFromReq = Array.isArray(fromReqUa) ? fromReqUa[0] : fromReqUa;

      await this.repo.create({
        userId: input.userId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? null,
        ip: input.ip ?? fromReqIp ?? null,
        userAgent: input.userAgent ?? userAgentFromReq ?? null,
      });
    } catch (error) {
      // 失败不阻塞主流程：仅记录 error 日志
      logger.error(
        {
          action: input?.action,
          targetType: input?.targetType,
          targetId: input?.targetId,
          error: (error as Error).message,
        },
        '审计日志写入失败',
      );
    }
  }
}

/**
 * 全局单例：业务模块直接 import 使用
 *   import { auditService } from '@server/modules/audit';
 *   await auditService.log({ userId, action: 'activity.cancel', ... });
 */
export const auditService = new AuditService(new AuditRepository());
