/**
 * 契约测试: audit 模块 — auditService.log 接口
 *
 * 覆盖行为:
 * - `log()` 写入成功时 repository.create 收到正确的参数
 * - `log()` 从 req 自动抽取 ip / user-agent
 * - 显式传入的 ip / userAgent 覆盖 req 中的值
 * - action 为空 / input 非法时仅记 error 日志，不抛错
 * - repository.create 抛错时被 service 吞掉，不抛给调用方
 *
 * Mock 策略:
 * - AuditRepository: 全部 mock（隔离数据库依赖）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from '@server/modules/audit/service.js';
import { AuditRepository } from '@server/modules/audit/repository.js';
import type { AuditLogInput } from '@server/modules/audit/types.js';

function createMockRepository(): {
  create: ReturnType<typeof vi.fn>;
  findByUser: ReturnType<typeof vi.fn>;
  findByAction: ReturnType<typeof vi.fn>;
  deleteOlderThan: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockResolvedValue({ id: 'op-log-uuid-1' }),
    findByUser: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    findByAction: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    deleteOlderThan: vi.fn().mockResolvedValue(0),
  };
}

describe('AuditService.log — 契约测试', () => {
  let service: AuditService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new AuditService(repo as unknown as AuditRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should call repository.create with all provided fields', async () => {
    const input: AuditLogInput = {
      userId: 'user-uuid-1',
      action: 'activity.cancel',
      targetType: 'Activity',
      targetId: 'activity-uuid-1',
      metadata: { reason: '场地临时被占用' },
      ip: '1.2.3.4',
      userAgent: 'test-agent/1.0',
    };

    await service.log(input);

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith({
      userId: 'user-uuid-1',
      action: 'activity.cancel',
      targetType: 'Activity',
      targetId: 'activity-uuid-1',
      metadata: { reason: '场地临时被占用' },
      ip: '1.2.3.4',
      userAgent: 'test-agent/1.0',
    });
  });

  it('should allow userId / targetType / targetId / metadata to be omitted (未登录场景)', async () => {
    await service.log({ action: 'auth.login.failed' });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        action: 'auth.login.failed',
        targetType: null,
        targetId: null,
        metadata: null,
      }),
    );
  });

  it('should extract ip and user-agent from req when provided', async () => {
    const fakeReq = {
      ip: '10.0.0.1',
      headers: { 'user-agent': 'Mozilla/5.0 TestBrowser' },
    } as unknown as AuditLogInput['req'];

    await service.log({
      userId: 'user-uuid-1',
      action: 'activity.cancel',
      req: fakeReq,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '10.0.0.1',
        userAgent: 'Mozilla/5.0 TestBrowser',
      }),
    );
  });

  it('should prefer explicit ip / userAgent over req-derived values', async () => {
    const fakeReq = {
      ip: '10.0.0.1',
      headers: { 'user-agent': 'from-req-ua' },
    } as unknown as AuditLogInput['req'];

    await service.log({
      action: 'auth.login.wx',
      ip: '9.9.9.9',
      userAgent: 'explicit-ua',
      req: fakeReq,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '9.9.9.9',
        userAgent: 'explicit-ua',
      }),
    );
  });

  it('should handle req without user-agent header gracefully', async () => {
    const fakeReq = {
      ip: '10.0.0.1',
      headers: {},
    } as unknown as AuditLogInput['req'];

    await service.log({ action: 'auth.login.failed', req: fakeReq });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '10.0.0.1',
        userAgent: null,
      }),
    );
  });

  it('should return void (no payload) on success', async () => {
    const result = await service.log({ action: 'activity.cancel' });
    expect(result).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 失败不阻塞主流程
  // -----------------------------------------------------------------------

  it('should NOT throw when repository.create rejects', async () => {
    repo.create.mockRejectedValue(new Error('DB connection lost'));

    await expect(
      service.log({
        userId: 'user-uuid-1',
        action: 'activity.cancel',
      }),
    ).resolves.not.toThrow();
  });

  it('should NOT throw when action is missing and should not call repository', async () => {
    await expect(
      // @ts-expect-error — intentionally passing invalid input
      service.log({ userId: 'user-uuid-1' }),
    ).resolves.not.toThrow();

    expect(repo.create).not.toHaveBeenCalled();
  });

  it('should NOT throw when action is an empty string', async () => {
    await expect(service.log({ action: '   ' })).resolves.not.toThrow();

    expect(repo.create).not.toHaveBeenCalled();
  });

  it('should NOT throw when input itself is null/undefined', async () => {
    await expect(
      // @ts-expect-error — intentionally passing invalid input
      service.log(null),
    ).resolves.not.toThrow();
    await expect(
      // @ts-expect-error — intentionally passing invalid input
      service.log(undefined),
    ).resolves.not.toThrow();

    expect(repo.create).not.toHaveBeenCalled();
  });
});
