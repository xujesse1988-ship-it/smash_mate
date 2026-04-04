/**
 * L1 集成测试: notification 模块 — 通知查询、已读管理与过期清理
 *
 * 测试层级: Controller → Service → Repository 真实串联
 * 数据库: 真实 PostgreSQL 测试库
 * Mock: 无（notification 为基础层，不依赖其他业务模块）
 *
 * 覆盖接口:
 * - GET /api/notifications (通知列表，分页 + 已读筛选)
 * - GET /api/notifications/unread-count (未读计数)
 * - PUT /api/notifications/:id/read (标记单条已读)
 * - PUT /api/notifications/read-all (全部标记已读)
 * - NotificationService.create (跨模块 Service 调用)
 * - NotificationService.createBatch (跨模块 Service 调用)
 * - NotificationService.cleanExpiredNotifications (定时清理)
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@server/app.js';
import { config } from '@server/infra/config.js';
import { NotificationService } from '@server/modules/notification/service.js';
import { NotificationRepository } from '@server/modules/notification/repository.js';
import { createTestUser, cleanupUserTestData } from '@tests/fixtures/user.js';
import {
  createTestNotification,
  createTestNotifications,
  cleanupNotificationTestData,
  getTestPrisma,
} from '@tests/fixtures/notification.js';

const prisma = getTestPrisma();

/**
 * Helper: create a JWT token for a given user ID
 */
function signToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, config.jwtSecret, {
    expiresIn: '7d',
  });
}

beforeAll(async () => {
  await cleanupNotificationTestData();
  await cleanupUserTestData();
});

afterEach(async () => {
  await cleanupNotificationTestData();
  await cleanupUserTestData();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ===========================================================================
// GET /api/notifications — 通知列表
// ===========================================================================

describe('GET /api/notifications', () => {
  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return paginated notifications for the current user', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    await createTestNotifications(user.id, 3);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(20);
  });

  it('should return notifications sorted by createdAt descending', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    // Create notifications with different timestamps
    const older = await createTestNotification({
      userId: user.id,
      title: '旧通知',
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
    });
    const newer = await createTestNotification({
      userId: user.id,
      title: '新通知',
      createdAt: new Date('2026-04-02T10:00:00.000Z'),
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].id).toBe(newer.id);
    expect(res.body.data.items[1].id).toBe(older.id);
  });

  it('should support pagination with page and pageSize', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    await createTestNotifications(user.id, 5);

    const res = await request(app)
      .get('/api/notifications?page=2&pageSize=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(5);
    expect(res.body.data.page).toBe(2);
    expect(res.body.data.pageSize).toBe(2);
  });

  it('should filter by isRead=false to return only unread notifications', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    await createTestNotification({ userId: user.id, isRead: false, title: '未读' });
    await createTestNotification({ userId: user.id, isRead: true, title: '已读' });

    const res = await request(app)
      .get('/api/notifications?isRead=false')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].title).toBe('未读');
    expect(res.body.data.items[0].isRead).toBe(false);
  });

  it('should filter by isRead=true to return only read notifications', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    await createTestNotification({ userId: user.id, isRead: false, title: '未读' });
    await createTestNotification({ userId: user.id, isRead: true, title: '已读' });

    const res = await request(app)
      .get('/api/notifications?isRead=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].title).toBe('已读');
    expect(res.body.data.items[0].isRead).toBe(true);
  });

  it('should return all notifications when isRead is not provided', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    await createTestNotification({ userId: user.id, isRead: false });
    await createTestNotification({ userId: user.id, isRead: true });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
  });

  it('should not return other users notifications (data isolation)', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const token1 = signToken(user1.id);

    await createTestNotification({ userId: user1.id, title: '自己的通知' });
    await createTestNotification({ userId: user2.id, title: '别人的通知' });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].title).toBe('自己的通知');
  });

  it('should cap pageSize to maximum 100', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/notifications?pageSize=200')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pageSize).toBe(100);
  });

  it('should return notification items with correct shape', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    await createTestNotification({ userId: user.id });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const item = res.body.data.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('type');
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('content');
    expect(item).toHaveProperty('targetType');
    expect(item).toHaveProperty('targetId');
    expect(item).toHaveProperty('isRead');
    expect(item).toHaveProperty('createdAt');
  });

  it('should return empty list when no notifications exist', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 认证
  // -----------------------------------------------------------------------

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('should reject request with invalid token', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/notifications/unread-count — 未读通知数
// ===========================================================================

describe('GET /api/notifications/unread-count', () => {
  it('should return unread count for the current user', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    await createTestNotification({ userId: user.id, isRead: false });
    await createTestNotification({ userId: user.id, isRead: false });
    await createTestNotification({ userId: user.id, isRead: true });

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
  });

  it('should return 0 when no unread notifications', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    await createTestNotification({ userId: user.id, isRead: true });

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });

  it('should not count other users unread notifications', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const token1 = signToken(user1.id);

    await createTestNotification({ userId: user1.id, isRead: false });
    await createTestNotification({ userId: user2.id, isRead: false });

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
  });

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/notifications/unread-count');
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// PUT /api/notifications/:id/read — 标记单条已读
// ===========================================================================

describe('PUT /api/notifications/:id/read', () => {
  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should mark an unread notification as read', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const notification = await createTestNotification({ userId: user.id, isRead: false });

    const res = await request(app)
      .put(`/api/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(notification.id);
    expect(res.body.data.isRead).toBe(true);

    // Verify in database
    const updated = await prisma.notification.findUnique({ where: { id: notification.id } });
    expect(updated!.isRead).toBe(true);
  });

  it('should be idempotent — marking already-read notification returns current state', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const notification = await createTestNotification({ userId: user.id, isRead: true });

    const res = await request(app)
      .put(`/api/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(notification.id);
    expect(res.body.data.isRead).toBe(true);
  });

  it('should return notification with correct shape after marking as read', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const notification = await createTestNotification({ userId: user.id });

    const res = await request(app)
      .put(`/api/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('type');
    expect(res.body.data).toHaveProperty('title');
    expect(res.body.data).toHaveProperty('content');
    expect(res.body.data).toHaveProperty('targetType');
    expect(res.body.data).toHaveProperty('targetId');
    expect(res.body.data).toHaveProperty('isRead');
    expect(res.body.data).toHaveProperty('createdAt');
  });

  it('should decrease unread count after marking as read', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const notification = await createTestNotification({ userId: user.id, isRead: false });
    await createTestNotification({ userId: user.id, isRead: false });

    // Initially 2 unread
    let countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(countRes.body.data.count).toBe(2);

    // Mark one as read
    await request(app)
      .put(`/api/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${token}`);

    // Now 1 unread
    countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(countRes.body.data.count).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should return 404 for non-existent notification', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/notifications/00000000-0000-0000-0000-000000000000/read')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('should return 403 when trying to mark another users notification', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const token1 = signToken(user1.id);
    const notification = await createTestNotification({ userId: user2.id });

    const res = await request(app)
      .put(`/api/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOTIFICATION_FORBIDDEN');
  });

  it('should reject request without token', async () => {
    const user = await createTestUser();
    const notification = await createTestNotification({ userId: user.id });

    const res = await request(app).put(`/api/notifications/${notification.id}/read`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// PUT /api/notifications/read-all — 全部标记已读
// ===========================================================================

describe('PUT /api/notifications/read-all', () => {
  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should mark all unread notifications as read and return count', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    await createTestNotification({ userId: user.id, isRead: false });
    await createTestNotification({ userId: user.id, isRead: false });
    await createTestNotification({ userId: user.id, isRead: true });

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.updatedCount).toBe(2);

    // Verify in database: all should be read
    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });
    expect(unreadCount).toBe(0);
  });

  it('should return updatedCount 0 when no unread notifications', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    await createTestNotification({ userId: user.id, isRead: true });

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.updatedCount).toBe(0);
  });

  it('should only mark current users notifications (data isolation)', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    const token1 = signToken(user1.id);

    await createTestNotification({ userId: user1.id, isRead: false });
    await createTestNotification({ userId: user2.id, isRead: false });

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.updatedCount).toBe(1);

    // Verify user2's notification is still unread
    const user2Unread = await prisma.notification.count({
      where: { userId: user2.id, isRead: false },
    });
    expect(user2Unread).toBe(1);
  });

  it('should reject request without token', async () => {
    const res = await request(app).put('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// NotificationService.create — 跨模块 Service 调用
// ===========================================================================

describe('NotificationService.create — cross-module integration', () => {
  let service: NotificationService;

  beforeAll(() => {
    const repo = new NotificationRepository();
    service = new NotificationService(repo);
  });

  it('should create a notification and persist to database', async () => {
    const user = await createTestUser();

    const result = await service.create({
      userId: user.id,
      type: 'ACTIVITY_JOINED',
      title: '新成员加入',
      content: '张三 加入了你的活动「朝阳体育中心 04/05」',
      targetType: 'activity',
      targetId: 'activity-uuid-1',
    });

    expect(result.id).toBeDefined();
    expect(result.userId).toBe(user.id);
    expect(result.type).toBe('ACTIVITY_JOINED');
    expect(result.title).toBe('新成员加入');
    expect(result.isRead).toBe(false);

    // Verify in database
    const dbRecord = await prisma.notification.findUnique({ where: { id: result.id } });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord!.userId).toBe(user.id);
  });

  it('should reject invalid notification type', async () => {
    const user = await createTestUser();

    await expect(
      service.create({
        userId: user.id,
        type: 'INVALID_TYPE' as never,
        title: '测试',
        content: '测试内容',
        targetType: 'activity',
        targetId: 'test-id',
      }),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_TYPE',
    });
  });

  it('should reject invalid target type', async () => {
    const user = await createTestUser();

    await expect(
      service.create({
        userId: user.id,
        type: 'ACTIVITY_JOINED',
        title: '测试',
        content: '测试内容',
        targetType: 'invalid' as never,
        targetId: 'test-id',
      }),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_TARGET_TYPE',
    });
  });

  it('should reject empty required fields', async () => {
    const user = await createTestUser();

    await expect(
      service.create({
        userId: user.id,
        type: 'ACTIVITY_JOINED',
        title: '',
        content: '测试内容',
        targetType: 'activity',
        targetId: 'test-id',
      }),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_PARAMS',
    });
  });
});

// ===========================================================================
// NotificationService.createBatch — 跨模块 Service 调用
// ===========================================================================

describe('NotificationService.createBatch — cross-module integration', () => {
  let service: NotificationService;

  beforeAll(() => {
    const repo = new NotificationRepository();
    service = new NotificationService(repo);
  });

  it('should batch create notifications and persist to database', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();

    const result = await service.createBatch([
      {
        userId: user1.id,
        type: 'ACTIVITY_CANCELLED',
        title: '活动已取消',
        content: '你参加的活动已取消',
        targetType: 'activity',
        targetId: 'activity-uuid-1',
      },
      {
        userId: user2.id,
        type: 'ACTIVITY_CANCELLED',
        title: '活动已取消',
        content: '你参加的活动已取消',
        targetType: 'activity',
        targetId: 'activity-uuid-1',
      },
    ]);

    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(0);

    // Verify in database
    const count = await prisma.notification.count();
    expect(count).toBe(2);
  });

  it('should return { successCount: 0, failedCount: 0 } for empty array', async () => {
    const result = await service.createBatch([]);
    expect(result).toEqual({ successCount: 0, failedCount: 0 });
  });

  it('should handle partial failures (invalid items)', async () => {
    const user = await createTestUser();

    const result = await service.createBatch([
      {
        userId: user.id,
        type: 'ACTIVITY_JOINED',
        title: '有效通知',
        content: '有效内容',
        targetType: 'activity',
        targetId: 'activity-uuid-1',
      },
      {
        userId: user.id,
        type: 'INVALID_TYPE' as never,
        title: '无效通知',
        content: '无效内容',
        targetType: 'activity',
        targetId: 'activity-uuid-2',
      },
    ]);

    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
  });

  it('should reject non-array input', async () => {
    await expect(
      service.createBatch('not-an-array' as never),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_PARAMS',
    });
  });
});

// ===========================================================================
// NotificationService.cleanExpiredNotifications — 过期通知清理
// ===========================================================================

describe('NotificationService.cleanExpiredNotifications — integration', () => {
  let service: NotificationService;

  beforeAll(() => {
    const repo = new NotificationRepository();
    service = new NotificationService(repo);
  });

  it('should delete notifications older than 90 days', async () => {
    const user = await createTestUser();

    // Create an old notification (100 days ago)
    await createTestNotification({
      userId: user.id,
      title: '过期通知',
      createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    });

    // Create a recent notification
    await createTestNotification({
      userId: user.id,
      title: '新通知',
    });

    await service.cleanExpiredNotifications();

    // Only the recent notification should remain
    const remaining = await prisma.notification.findMany({
      where: { userId: user.id },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('新通知');
  });

  it('should not delete notifications within 90 days', async () => {
    const user = await createTestUser();

    await createTestNotification({
      userId: user.id,
      title: '89天前的通知',
      createdAt: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000),
    });

    await service.cleanExpiredNotifications();

    const remaining = await prisma.notification.count({ where: { userId: user.id } });
    expect(remaining).toBe(1);
  });

  it('should not throw errors even on failure (resilience)', async () => {
    // This tests the try-catch behavior; the method should never throw
    await expect(service.cleanExpiredNotifications()).resolves.not.toThrow();
  });
});
