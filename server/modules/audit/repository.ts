import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/database.js';

export interface OperationLogCreateData {
  userId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

/**
 * OperationLog 数据访问层。
 *
 * 注意：
 * - `metadata` 字段在 schema 中为 `Json?`，Prisma 会在写入时序列化，
 *   传入 `null` 会清空字段，传入 `undefined` 会被忽略。
 * - `findByUser` / `findByAction` 默认按 `createdAt desc` 排序，
 *   与 schema 上的复合索引 `(userId, createdAt)` / `(action, createdAt)` 对齐。
 */
export class AuditRepository {
  async create(data: OperationLogCreateData) {
    return prisma.operationLog.create({
      data: {
        userId: data.userId ?? null,
        action: data.action,
        targetType: data.targetType ?? null,
        targetId: data.targetId ?? null,
        // Json 字段：使用 Prisma.JsonNull 表示显式空；undefined 时交给 Prisma 用默认（不写入）
        metadata:
          data.metadata === undefined
            ? undefined
            : data.metadata === null
              ? Prisma.JsonNull
              : (data.metadata as Prisma.InputJsonValue),
        ip: data.ip ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }

  async findByUser(userId: string, pagination: PaginationInput = {}) {
    const page = pagination.page ?? 1;
    const pageSize = Math.min(pagination.pageSize ?? 20, 100);

    const [items, total] = await Promise.all([
      prisma.operationLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.operationLog.count({ where: { userId } }),
    ]);

    return { items, total, page, pageSize };
  }

  async findByAction(action: string, pagination: PaginationInput = {}) {
    const page = pagination.page ?? 1;
    const pageSize = Math.min(pagination.pageSize ?? 20, 100);

    const [items, total] = await Promise.all([
      prisma.operationLog.findMany({
        where: { action },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.operationLog.count({ where: { action } }),
    ]);

    return { items, total, page, pageSize };
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await prisma.operationLog.deleteMany({
      where: { createdAt: { lt: date } },
    });
    return result.count;
  }
}
