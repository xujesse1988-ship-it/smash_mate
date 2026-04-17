/**
 * L1 集成测试: audit 模块 — 写入与容错
 *
 * 测试层级: Service → Repository → 真实 PostgreSQL 测试库
 *
 * 覆盖场景:
 * - 写入真实数据库：log() 调用后可通过 findByUser / findByAction 查询到
 * - userId 为 null 时（未登录场景）可正常写入
 * - 关联 User 被删除时 userId 变为 null（onDelete: SetNull）
 * - 写入失败（mock repository 抛错）时不影响主流程
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AuditService, auditService } from '@server/modules/audit/service.js';
import { AuditRepository } from '@server/modules/audit/repository.js';
import { createTestUser } from '@tests/fixtures/user.js';
import { getTestPrisma } from '@tests/fixtures/notification.js';
import { resetTestDatabase } from '@tests/fixtures/database.js';

const prisma = getTestPrisma();

beforeAll(async () => {
  await resetTestDatabase();
});

afterEach(async () => {
  await resetTestDatabase();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ===========================================================================
// 写入真实数据库
// ===========================================================================

describe('auditService.log — 真实数据库写入', () => {
  it('should persist a log record and allow querying by user', async () => {
    const user = await createTestUser();

    await auditService.log({
      userId: user.id,
      action: 'activity.cancel',
      targetType: 'Activity',
      targetId: 'activity-uuid-1',
      metadata: { reason: '场地被占用' },
      ip: '127.0.0.1',
      userAgent: 'integration-test',
    });

    const repo = new AuditRepository();
    const result = await repo.findByUser(user.id);

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      userId: user.id,
      action: 'activity.cancel',
      targetType: 'Activity',
      targetId: 'activity-uuid-1',
      ip: '127.0.0.1',
      userAgent: 'integration-test',
    });
    expect(result.items[0].metadata).toEqual({ reason: '场地被占用' });
  });

  it('should allow querying by action across users', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();

    await auditService.log({ userId: user1.id, action: 'auth.login.wx' });
    await auditService.log({ userId: user2.id, action: 'auth.login.wx' });
    await auditService.log({ userId: user1.id, action: 'activity.cancel' });

    const repo = new AuditRepository();
    const result = await repo.findByAction('auth.login.wx');

    expect(result.total).toBe(2);
    expect(result.items.every((r) => r.action === 'auth.login.wx')).toBe(true);
  });

  it('should accept null userId (未登录/登录失败场景)', async () => {
    await auditService.log({
      action: 'auth.login.failed',
      metadata: { phone: '138****1234', reason: 'invalid code' },
      ip: '1.2.3.4',
    });

    const logs = await prisma.operationLog.findMany({
      where: { action: 'auth.login.failed' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBeNull();
    expect(logs[0].ip).toBe('1.2.3.4');
  });

  it('should extract ip and user-agent from express-like req object', async () => {
    const user = await createTestUser();
    const fakeReq = {
      ip: '10.0.0.99',
      headers: { 'user-agent': 'SmashMate/1.0 (iPhone)' },
    } as unknown as Parameters<typeof auditService.log>[0]['req'];

    await auditService.log({
      userId: user.id,
      action: 'profile.update',
      req: fakeReq,
    });

    const log = await prisma.operationLog.findFirst({
      where: { userId: user.id, action: 'profile.update' },
    });

    expect(log).not.toBeNull();
    expect(log!.ip).toBe('10.0.0.99');
    expect(log!.userAgent).toBe('SmashMate/1.0 (iPhone)');
  });

  it('should set userId to null when referenced user is deleted (onDelete: SetNull)', async () => {
    const user = await createTestUser();

    await auditService.log({
      userId: user.id,
      action: 'activity.create',
    });

    // 删除用户，OperationLog 保留，userId 置空
    await prisma.user.delete({ where: { id: user.id } });

    const log = await prisma.operationLog.findFirst({
      where: { action: 'activity.create' },
    });

    expect(log).not.toBeNull();
    expect(log!.userId).toBeNull();
  });

  it('should support deleteOlderThan for retention cleanup', async () => {
    const user = await createTestUser();

    // 创建一条最近的日志
    await auditService.log({ userId: user.id, action: 'recent.event' });

    // 手写一条 100 天前的日志（auditService.log 不支持指定 createdAt）
    await prisma.operationLog.create({
      data: {
        userId: user.id,
        action: 'old.event',
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      },
    });

    const repo = new AuditRepository();
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const deletedCount = await repo.deleteOlderThan(cutoff);

    expect(deletedCount).toBe(1);

    const remaining = await prisma.operationLog.findMany({ where: { userId: user.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].action).toBe('recent.event');
  });
});

// ===========================================================================
// 失败不阻塞主流程
// ===========================================================================

describe('auditService.log — 失败不阻塞主流程', () => {
  it('should not throw when repository.create fails', async () => {
    const brokenRepo = new AuditRepository();
    vi.spyOn(brokenRepo, 'create').mockRejectedValue(new Error('simulated DB failure'));
    const isolatedService = new AuditService(brokenRepo);

    await expect(
      isolatedService.log({
        userId: 'any-user-uuid',
        action: 'activity.cancel',
      }),
    ).resolves.toBeUndefined();
  });

  it('should not block a caller simulating business flow when audit fails', async () => {
    const brokenRepo = new AuditRepository();
    vi.spyOn(brokenRepo, 'create').mockRejectedValue(new Error('simulated DB failure'));
    const isolatedService = new AuditService(brokenRepo);

    // 模拟业务主流程：audit.log 失败不应影响返回值
    async function businessFlow(): Promise<string> {
      await isolatedService.log({ action: 'activity.cancel' });
      return 'ok';
    }

    await expect(businessFlow()).resolves.toBe('ok');
  });

  it('should not throw for invalid action even when DB is reachable', async () => {
    await expect(
      // @ts-expect-error — intentionally invalid
      auditService.log({ userId: 'x' }),
    ).resolves.toBeUndefined();

    const count = await prisma.operationLog.count();
    expect(count).toBe(0);
  });
});
