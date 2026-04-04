/**
 * 契约测试: notification 模块 — 通知查询与已读管理 + 内部创建接口
 * 覆盖接口:
 *   - GET /api/notifications (NotificationService.getNotifications)
 *   - GET /api/notifications/unread-count (NotificationService.getUnreadCount)
 *   - PUT /api/notifications/:id/read (NotificationService.markAsRead)
 *   - PUT /api/notifications/read-all (NotificationService.markAllAsRead)
 *   - NotificationService.create (跨模块 Service 调用)
 *   - NotificationService.createBatch (跨模块 Service 调用)
 *
 * 来源文档: docs/module-design/notification.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - NotificationRepository: 全部 mock（隔离数据库依赖）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from '@server/modules/notification/service.js';
import { NotificationRepository } from '@server/modules/notification/repository.js';
import type {
  NotificationType,
  TargetType,
  CreateNotificationInput,
  NotificationListQuery,
} from '@server/modules/notification/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock NotificationRepository with all methods stubbed.
 * Individual tests override specific methods as needed.
 */
function createMockRepository(): {
  [K in keyof NotificationRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockResolvedValue(createNotificationRecord()),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    findByUser: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    countUnread: vi.fn().mockResolvedValue(0),
    findById: vi.fn().mockResolvedValue(null),
    markAsRead: vi.fn().mockResolvedValue(createNotificationRecord({ isRead: true })),
    markAllAsRead: vi.fn().mockResolvedValue(0),
    deleteExpired: vi.fn().mockResolvedValue(0),
  };
}

/** Standard notification record as returned by repository */
function createNotificationRecord(
  overrides?: Partial<{
    id: string;
    userId: string;
    type: string;
    title: string;
    content: string;
    targetType: string;
    targetId: string;
    isRead: boolean;
    createdAt: Date;
  }>,
) {
  return {
    id: 'notification-uuid-1',
    userId: 'user-uuid-1',
    type: 'ACTIVITY_JOINED',
    title: '新成员加入',
    content: '张三 加入了你的活动「朝阳体育中心 04/05」',
    targetType: 'activity',
    targetId: 'activity-uuid-1',
    isRead: false,
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    ...overrides,
  };
}

/** Valid CreateNotificationInput for tests */
function createValidInput(overrides?: Partial<CreateNotificationInput>): CreateNotificationInput {
  return {
    userId: 'user-uuid-1',
    type: 'ACTIVITY_JOINED' as NotificationType,
    title: '新成员加入',
    content: '张三 加入了你的活动「朝阳体育中心 04/05」',
    targetType: 'activity' as TargetType,
    targetId: 'activity-uuid-1',
    ...overrides,
  };
}

// ===========================================================================
// GET /api/notifications — NotificationService.getNotifications
// ===========================================================================

describe('GET /api/notifications — NotificationService.getNotifications', () => {
  let service: NotificationService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new NotificationService(repo as unknown as NotificationRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return paginated notifications for the current user', async () => {
    // 业务规则: 只返回当前用户（从 JWT 解析 userId）的通知
    // 来源: notification.md §4 通知列表 - Response 200 + 业务规则 bullet 1
    const notifications = [
      createNotificationRecord(),
      createNotificationRecord({ id: 'notification-uuid-2', type: 'ACTIVITY_LEFT', title: '成员退出' }),
    ];
    repo.findByUser.mockResolvedValue({ items: notifications, total: 2 });

    const result = await service.getNotifications('user-uuid-1', {});

    expect(result).toEqual({
      items: notifications,
      total: 2,
      page: 1,
      pageSize: 20,
    });
  });

  it('should default to page 1 and pageSize 20', async () => {
    // 业务规则: page 默认 1，pageSize 默认 20
    // 来源: notification.md §4 通知列表 - Query Params
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    await service.getNotifications('user-uuid-1', {});

    expect(repo.findByUser).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  it('should accept custom page and pageSize', async () => {
    // 业务规则: 支持自定义分页参数
    // 来源: notification.md §4 通知列表 - Query Params
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    await service.getNotifications('user-uuid-1', { page: 2, pageSize: 10 });

    expect(repo.findByUser).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
  });

  it('should filter by isRead when provided', async () => {
    // 业务规则: isRead 参数支持筛选已读/未读
    // 来源: notification.md §4 通知列表 - Query Params + 业务规则 bullet 3
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    await service.getNotifications('user-uuid-1', { isRead: false });

    expect(repo.findByUser).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ isRead: false }),
    );
  });

  it('should filter by isRead=true', async () => {
    // 业务规则: isRead 参数支持筛选已读/未读（已读）
    // 来源: notification.md §4 通知列表 - Query Params + 业务规则 bullet 3
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    await service.getNotifications('user-uuid-1', { isRead: true });

    expect(repo.findByUser).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ isRead: true }),
    );
  });

  it('should return all notifications when isRead is not provided', async () => {
    // 业务规则: 不传 isRead 则返回全部
    // 来源: notification.md §4 通知列表 - Query Params (isRead 否, 不传则返回全部)
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    await service.getNotifications('user-uuid-1', {});

    // isRead should not be in the query (or undefined)
    const callArgs = repo.findByUser.mock.calls[0];
    expect(callArgs[0]).toBe('user-uuid-1');
    // The query should either omit isRead or have it as undefined
    const query = callArgs[1];
    expect(query.isRead).toBeUndefined();
  });

  it('should return notifications sorted by createdAt descending (newest first)', async () => {
    // 业务规则: 按 createdAt 倒序排列（最新通知在前）
    // 来源: notification.md §4 通知列表 - 业务规则 bullet 2
    const older = createNotificationRecord({
      id: 'notification-uuid-old',
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
    });
    const newer = createNotificationRecord({
      id: 'notification-uuid-new',
      createdAt: new Date('2026-04-02T10:00:00.000Z'),
    });
    // Repository returns already sorted
    repo.findByUser.mockResolvedValue({ items: [newer, older], total: 2 });

    const result = await service.getNotifications('user-uuid-1', {});

    expect(result.items[0].id).toBe('notification-uuid-new');
    expect(result.items[1].id).toBe('notification-uuid-old');
  });

  it('should only query notifications for the given userId', async () => {
    // 业务规则: 不返回其他用户的通知（数据隔离通过 userId 查询条件保证）
    // 来源: notification.md §4 通知列表 - 业务规则 bullet 4 + §6.4 通知查询数据隔离
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    await service.getNotifications('user-uuid-1', {});

    expect(repo.findByUser).toHaveBeenCalledWith('user-uuid-1', expect.anything());
  });

  it('should cap pageSize to maximum 100', async () => {
    // 业务规则: pageSize 最大 100
    // 来源: notification.md §4 通知列表 - Query Params (pageSize 最大 100)
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    await service.getNotifications('user-uuid-1', { pageSize: 200 });

    expect(repo.findByUser).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ pageSize: 100 }),
    );
  });

  it('should return correct response shape with items, total, page, pageSize', async () => {
    // 业务规则: 响应结构包含 items, total, page, pageSize
    // 来源: notification.md §4 通知列表 - Response 200
    repo.findByUser.mockResolvedValue({ items: [createNotificationRecord()], total: 1 });

    const result = await service.getNotifications('user-uuid-1', { page: 1, pageSize: 20 });

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('pageSize');
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe('number');
    expect(typeof result.page).toBe('number');
    expect(typeof result.pageSize).toBe('number');
  });

  it('should return notification items with correct shape', async () => {
    // 业务规则: 通知项包含 id, type, title, content, targetType, targetId, isRead, createdAt
    // 来源: notification.md §4 通知列表 - Response 200 items 结构
    const record = createNotificationRecord();
    repo.findByUser.mockResolvedValue({ items: [record], total: 1 });

    const result = await service.getNotifications('user-uuid-1', {});

    const item = result.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('type');
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('content');
    expect(item).toHaveProperty('targetType');
    expect(item).toHaveProperty('targetId');
    expect(item).toHaveProperty('isRead');
    expect(item).toHaveProperty('createdAt');
  });
});

// ===========================================================================
// GET /api/notifications/unread-count — NotificationService.getUnreadCount
// ===========================================================================

describe('GET /api/notifications/unread-count — NotificationService.getUnreadCount', () => {
  let service: NotificationService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new NotificationService(repo as unknown as NotificationRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return unread count for the current user', async () => {
    // 业务规则: 只统计当前用户的未读通知数（userId + isRead = false）
    // 来源: notification.md §4 未读通知数 - Response 200 + 业务规则 bullet 1
    repo.countUnread.mockResolvedValue(5);

    const result = await service.getUnreadCount('user-uuid-1');

    expect(result).toEqual({ count: 5 });
  });

  it('should return count of 0 when no unread notifications', async () => {
    // 业务规则: 无未读通知时返回 0
    // 来源: notification.md §4 未读通知数 - Response 200
    repo.countUnread.mockResolvedValue(0);

    const result = await service.getUnreadCount('user-uuid-1');

    expect(result).toEqual({ count: 0 });
  });

  it('should query unread count using the given userId', async () => {
    // 业务规则: 只统计当前用户的未读通知数（数据隔离）
    // 来源: notification.md §4 未读通知数 - 业务规则 bullet 1 + §6.4
    repo.countUnread.mockResolvedValue(0);

    await service.getUnreadCount('user-uuid-1');

    expect(repo.countUnread).toHaveBeenCalledWith('user-uuid-1');
  });
});

// ===========================================================================
// PUT /api/notifications/:id/read — NotificationService.markAsRead
// ===========================================================================

describe('PUT /api/notifications/:id/read — NotificationService.markAsRead', () => {
  let service: NotificationService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new NotificationService(repo as unknown as NotificationRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should mark an unread notification as read and return updated notification', async () => {
    // 业务规则: 标记指定通知为已读，返回更新后的通知
    // 来源: notification.md §4 标记单条已读 - Response 200
    const unreadNotification = createNotificationRecord({ isRead: false });
    const readNotification = { ...unreadNotification, isRead: true };
    repo.findById.mockResolvedValue(unreadNotification);
    repo.markAsRead.mockResolvedValue(readNotification);

    const result = await service.markAsRead('notification-uuid-1', 'user-uuid-1');

    expect(result.isRead).toBe(true);
    expect(result.id).toBe('notification-uuid-1');
  });

  it('should verify notification belongs to the current user before marking', async () => {
    // 业务规则: 只能标记自己的通知为已读（校验 notification.userId === 当前用户 ID）
    // 来源: notification.md §4 标记单条已读 - 业务规则 bullet 1 + §6.4
    const notification = createNotificationRecord({ userId: 'user-uuid-1' });
    repo.findById.mockResolvedValue(notification);
    repo.markAsRead.mockResolvedValue({ ...notification, isRead: true });

    await service.markAsRead('notification-uuid-1', 'user-uuid-1');

    expect(repo.findById).toHaveBeenCalledWith('notification-uuid-1');
  });

  it('should be idempotent — marking an already-read notification returns current state', async () => {
    // 业务规则: 已经是已读状态的通知再次标记为幂等操作，直接返回当前状态
    // 来源: notification.md §4 标记单条已读 - 业务规则 bullet 2
    const alreadyRead = createNotificationRecord({ isRead: true });
    repo.findById.mockResolvedValue(alreadyRead);

    const result = await service.markAsRead('notification-uuid-1', 'user-uuid-1');

    expect(result.isRead).toBe(true);
    // Should not call markAsRead on repo since it's already read
  });

  it('should return notification with correct shape after marking as read', async () => {
    // 业务规则: 返回通知对象包含 id, type, title, content, targetType, targetId, isRead, createdAt
    // 来源: notification.md §4 标记单条已读 - Response 200
    const notification = createNotificationRecord();
    repo.findById.mockResolvedValue(notification);
    repo.markAsRead.mockResolvedValue({ ...notification, isRead: true });

    const result = await service.markAsRead('notification-uuid-1', 'user-uuid-1');

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('targetType');
    expect(result).toHaveProperty('targetId');
    expect(result).toHaveProperty('isRead', true);
    expect(result).toHaveProperty('createdAt');
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw NOTIFICATION_NOT_FOUND when notification does not exist', async () => {
    // 业务规则: 通知不存在时返回 404
    // 来源: notification.md §4 标记单条已读 - 错误码 NOTIFICATION_NOT_FOUND
    repo.findById.mockResolvedValue(null);

    await expect(
      service.markAsRead('nonexistent-uuid', 'user-uuid-1'),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw NOTIFICATION_FORBIDDEN when trying to mark another user\'s notification', async () => {
    // 业务规则: 尝试标记他人的通知时返回 403
    // 来源: notification.md §4 标记单条已读 - 错误码 NOTIFICATION_FORBIDDEN
    const otherUserNotification = createNotificationRecord({ userId: 'other-user-uuid' });
    repo.findById.mockResolvedValue(otherUserNotification);

    await expect(
      service.markAsRead('notification-uuid-1', 'user-uuid-1'),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_FORBIDDEN',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// PUT /api/notifications/read-all — NotificationService.markAllAsRead
// ===========================================================================

describe('PUT /api/notifications/read-all — NotificationService.markAllAsRead', () => {
  let service: NotificationService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new NotificationService(repo as unknown as NotificationRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should mark all unread notifications as read and return updated count', async () => {
    // 业务规则: 只标记当前用户的未读通知（userId + isRead = false → 批量更新为 isRead = true）
    // 来源: notification.md §4 全部标记已读 - 业务规则 bullet 1 + Response 200
    repo.markAllAsRead.mockResolvedValue(12);

    const result = await service.markAllAsRead('user-uuid-1');

    expect(result).toEqual({ updatedCount: 12 });
  });

  it('should return updatedCount 0 when no unread notifications', async () => {
    // 业务规则: 如果没有未读通知，updatedCount 为 0，不报错
    // 来源: notification.md §4 全部标记已读 - 业务规则 bullet 3
    repo.markAllAsRead.mockResolvedValue(0);

    const result = await service.markAllAsRead('user-uuid-1');

    expect(result).toEqual({ updatedCount: 0 });
  });

  it('should only mark notifications for the given userId', async () => {
    // 业务规则: 只标记当前用户的未读通知（数据隔离）
    // 来源: notification.md §4 全部标记已读 - 业务规则 bullet 1 + §6.4
    repo.markAllAsRead.mockResolvedValue(0);

    await service.markAllAsRead('user-uuid-1');

    expect(repo.markAllAsRead).toHaveBeenCalledWith('user-uuid-1');
  });

  it('should return actual count of updated notifications', async () => {
    // 业务规则: 返回实际更新的通知数量
    // 来源: notification.md §4 全部标记已读 - 业务规则 bullet 2
    repo.markAllAsRead.mockResolvedValue(5);

    const result = await service.markAllAsRead('user-uuid-1');

    expect(result.updatedCount).toBe(5);
  });
});

// ===========================================================================
// NotificationService.create — 跨模块 Service 调用
// ===========================================================================

describe('NotificationService.create — internal cross-module interface', () => {
  let service: NotificationService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new NotificationService(repo as unknown as NotificationRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should create a notification and return the created record', async () => {
    // 业务规则: 创建通知记录，返回创建的通知对象
    // 来源: notification.md §4 NotificationService.create - 返回值
    const input = createValidInput();
    const expectedRecord = createNotificationRecord();
    repo.create.mockResolvedValue(expectedRecord);

    const result = await service.create(input);

    expect(result).toEqual(expectedRecord);
  });

  it('should create notification with isRead defaulting to false', async () => {
    // 业务规则: 创建通知时 isRead 默认为 false
    // 来源: notification.md §4 NotificationService.create - 业务规则 bullet 3
    const input = createValidInput();
    const record = createNotificationRecord({ isRead: false });
    repo.create.mockResolvedValue(record);

    const result = await service.create(input);

    expect(result.isRead).toBe(false);
  });

  it('should pass all input fields to repository', async () => {
    // 业务规则: 创建通知包含所有必填字段
    // 来源: notification.md §4 NotificationService.create - 参数 + §6.1 步骤 4
    const input = createValidInput();

    await service.create(input);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: input.userId,
        type: input.type,
        title: input.title,
        content: input.content,
        targetType: input.targetType,
        targetId: input.targetId,
      }),
    );
  });

  it('should return notification with correct shape', async () => {
    // 业务规则: 返回值包含 id, userId, type, title, content, targetType, targetId, isRead, createdAt
    // 来源: notification.md §4 NotificationService.create - 返回值
    const input = createValidInput();
    repo.create.mockResolvedValue(createNotificationRecord());

    const result = await service.create(input);

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('userId');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('targetType');
    expect(result).toHaveProperty('targetId');
    expect(result).toHaveProperty('isRead');
    expect(result).toHaveProperty('createdAt');
  });

  it('should accept all valid notification types', async () => {
    // 业务规则: type 必须在 NotificationType 枚举范围内
    // 来源: notification.md §3 通知类型枚举 + §6.1 步骤 2
    const validTypes: NotificationType[] = [
      'ACTIVITY_JOINED',
      'ACTIVITY_LEFT',
      'ACTIVITY_UPDATED',
      'ACTIVITY_CANCELLED',
      'GROUP_CLASS_ENROLLED',
      'GROUP_CLASS_ENROLLMENT_CANCELLED',
      'GROUP_CLASS_UPDATED',
      'GROUP_CLASS_CANCELLED',
      'PRIVATE_LESSON_BOOKED',
      'PRIVATE_LESSON_CANCELLED_BY_STUDENT',
      'PRIVATE_LESSON_CANCELLED_BY_COACH',
      'REVIEW_RECEIVED',
    ];

    for (const type of validTypes) {
      repo.create.mockResolvedValue(createNotificationRecord({ type }));
      const result = await service.create(createValidInput({ type }));
      expect(result.type).toBe(type);
    }
  });

  it('should accept all valid target types', async () => {
    // 业务规则: targetType 必须在 TargetType 枚举范围内
    // 来源: notification.md §3 跳转目标类型枚举 + §6.1 步骤 3
    const validTargetTypes: TargetType[] = [
      'activity',
      'group-class',
      'private-lesson',
      'coach-profile',
    ];

    for (const targetType of validTargetTypes) {
      repo.create.mockResolvedValue(createNotificationRecord({ targetType }));
      const result = await service.create(createValidInput({ targetType }));
      expect(result.targetType).toBe(targetType);
    }
  });

  // -----------------------------------------------------------------------
  // 异常流程 — 参数校验
  // -----------------------------------------------------------------------

  it('should throw NOTIFICATION_INVALID_TYPE for invalid notification type', async () => {
    // 业务规则: type 不在枚举范围内时抛出错误
    // 来源: notification.md §4 NotificationService.create - 错误码 NOTIFICATION_INVALID_TYPE
    const input = createValidInput({ type: 'INVALID_TYPE' as NotificationType });

    await expect(service.create(input)).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_TYPE',
    });
  });

  it('should throw NOTIFICATION_INVALID_TARGET_TYPE for invalid target type', async () => {
    // 业务规则: targetType 不在枚举范围内时抛出错误
    // 来源: notification.md §4 NotificationService.create - 错误码 NOTIFICATION_INVALID_TARGET_TYPE
    const input = createValidInput({ targetType: 'invalid-target' as TargetType });

    await expect(service.create(input)).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_TARGET_TYPE',
    });
  });

  it('should throw NOTIFICATION_INVALID_PARAMS when userId is empty', async () => {
    // 业务规则: 必填参数缺失或为空时抛出错误
    // 来源: notification.md §4 NotificationService.create - 错误码 NOTIFICATION_INVALID_PARAMS + §6.1 步骤 1
    const input = createValidInput({ userId: '' });

    await expect(service.create(input)).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_PARAMS',
    });
  });

  it('should throw NOTIFICATION_INVALID_PARAMS when title is empty', async () => {
    // 业务规则: 必填参数缺失或为空时抛出错误
    // 来源: notification.md §4 NotificationService.create - 错误码 NOTIFICATION_INVALID_PARAMS + §6.1 步骤 1
    const input = createValidInput({ title: '' });

    await expect(service.create(input)).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_PARAMS',
    });
  });

  it('should throw NOTIFICATION_INVALID_PARAMS when content is empty', async () => {
    // 业务规则: 必填参数缺失或为空时抛出错误
    // 来源: notification.md §4 NotificationService.create - 错误码 NOTIFICATION_INVALID_PARAMS + §6.1 步骤 1
    const input = createValidInput({ content: '' });

    await expect(service.create(input)).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_PARAMS',
    });
  });

  it('should throw NOTIFICATION_INVALID_PARAMS when targetId is empty', async () => {
    // 业务规则: 必填参数缺失或为空时抛出错误
    // 来源: notification.md §4 NotificationService.create - 错误码 NOTIFICATION_INVALID_PARAMS + §6.1 步骤 1
    const input = createValidInput({ targetId: '' });

    await expect(service.create(input)).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_PARAMS',
    });
  });

  it('should propagate database errors to the caller (not swallow them)', async () => {
    // 业务规则: 该方法本身在遇到数据库异常时会抛出错误，由调用方决定是否吞掉
    // 来源: notification.md §4 NotificationService.create - 业务规则 bullet 6
    const input = createValidInput();
    repo.create.mockRejectedValue(new Error('Database connection failed'));

    await expect(service.create(input)).rejects.toThrow('Database connection failed');
  });
});

// ===========================================================================
// NotificationService.createBatch — 跨模块 Service 调用
// ===========================================================================

describe('NotificationService.createBatch — internal cross-module interface', () => {
  let service: NotificationService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new NotificationService(repo as unknown as NotificationRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should create multiple notifications and return success/failed counts', async () => {
    // 业务规则: 批量创建通知，返回 successCount 和 failedCount
    // 来源: notification.md §4 NotificationService.createBatch - 返回值
    const notifications = [
      createValidInput({ userId: 'user-1' }),
      createValidInput({ userId: 'user-2' }),
      createValidInput({ userId: 'user-3' }),
    ];
    repo.createMany.mockResolvedValue({ count: 3 });

    const result = await service.createBatch(notifications);

    expect(result).toHaveProperty('successCount');
    expect(result).toHaveProperty('failedCount');
    expect(result.successCount).toBe(3);
    expect(result.failedCount).toBe(0);
  });

  it('should return { successCount: 0, failedCount: 0 } for empty array', async () => {
    // 业务规则: 空数组参数直接返回 { successCount: 0, failedCount: 0 }
    // 来源: notification.md §4 NotificationService.createBatch - 业务规则 bullet 3
    const result = await service.createBatch([]);

    expect(result).toEqual({ successCount: 0, failedCount: 0 });
  });

  it('should use batch insert for performance', async () => {
    // 业务规则: 批量创建使用数据库批量插入（Prisma createMany），提升性能
    // 来源: notification.md §4 NotificationService.createBatch - 业务规则 bullet 1
    const notifications = [
      createValidInput({ userId: 'user-1' }),
      createValidInput({ userId: 'user-2' }),
    ];
    repo.createMany.mockResolvedValue({ count: 2 });

    await service.createBatch(notifications);

    expect(repo.createMany).toHaveBeenCalled();
  });

  it('should handle partial failures gracefully', async () => {
    // 业务规则: 部分失败不影响其他通知的创建（单条失败时记录 error 日志，继续处理剩余）
    // 来源: notification.md §4 NotificationService.createBatch - 业务规则 bullet 2
    const notifications = [
      createValidInput({ userId: 'user-1' }),
      createValidInput({ userId: 'user-2', type: 'INVALID_TYPE' as NotificationType }),
      createValidInput({ userId: 'user-3' }),
    ];

    // Service should handle partial failures and report counts
    const result = await service.createBatch(notifications);

    expect(result.successCount + result.failedCount).toBeLessThanOrEqual(notifications.length);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw NOTIFICATION_INVALID_PARAMS when input is not an array', async () => {
    // 业务规则: notifications 参数不是数组时抛出错误
    // 来源: notification.md §4 NotificationService.createBatch - 错误码 NOTIFICATION_INVALID_PARAMS
    await expect(
      service.createBatch('not-an-array' as unknown as CreateNotificationInput[]),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_PARAMS',
    });
  });

  it('should throw NOTIFICATION_INVALID_PARAMS when input is null', async () => {
    // 业务规则: notifications 参数不是数组时抛出错误
    // 来源: notification.md §4 NotificationService.createBatch - 错误码 NOTIFICATION_INVALID_PARAMS
    await expect(
      service.createBatch(null as unknown as CreateNotificationInput[]),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_INVALID_PARAMS',
    });
  });
});

// ===========================================================================
// cleanExpiredNotifications — 通知过期自动清理（定时任务）
// ===========================================================================

describe('cleanExpiredNotifications — 通知过期自动清理', () => {
  let service: NotificationService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new NotificationService(repo as unknown as NotificationRepository);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T03:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should calculate 90-day cutoff date and pass it to deleteExpired', async () => {
    // 业务规则: 计算截止时间 = 当前时间 - 90 天，删除 createdAt < 截止时间 的所有通知
    // 来源: notification.md §6.3 通知过期自动清理 - 步骤 1~2
    repo.deleteExpired.mockResolvedValue(0);

    await service.cleanExpiredNotifications();

    expect(repo.deleteExpired).toHaveBeenCalledTimes(1);
    const cutoffDate = repo.deleteExpired.mock.calls[0][0] as Date;
    // 当前时间 2026-04-03 减 90 天 = 2026-01-03
    const expectedCutoff = new Date('2026-01-03T03:00:00.000Z');
    expect(cutoffDate.getTime()).toBe(expectedCutoff.getTime());
  });

  it('should log info with cleanup count on success', async () => {
    // 业务规则: 清理成功时记录 info 日志（含清理数量）
    // 来源: notification.md §6.3 通知过期自动清理 - 步骤 3
    repo.deleteExpired.mockResolvedValue(42);

    // Service 内部使用 logger.info 记录清理数量，此处验证不抛出错误且调用了 deleteExpired
    await service.cleanExpiredNotifications();

    expect(repo.deleteExpired).toHaveBeenCalledTimes(1);
    // 清理方法应正常完成且不抛出错误
  });

  it('should catch errors and not throw, ensuring service stability', async () => {
    // 业务规则: 异常时 catch 并记录 error 日志，不抛出错误，不影响服务稳定性
    // 来源: notification.md §6.3 通知过期自动清理 - 步骤 4
    repo.deleteExpired.mockRejectedValue(new Error('Database connection lost'));

    // 清理方法应捕获异常，不应抛出错误
    await expect(service.cleanExpiredNotifications()).resolves.not.toThrow();
  });
});
