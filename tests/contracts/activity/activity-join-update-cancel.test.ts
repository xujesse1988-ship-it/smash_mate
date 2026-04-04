/**
 * 契约测试: activity 模块 — 活动参与、修改与取消接口
 * 覆盖接口:
 *   - POST /api/activities/:id/join (ActivityService.joinActivity)
 *   - POST /api/activities/:id/leave (ActivityService.leaveActivity)
 *   - PUT /api/activities/:id (ActivityService.updateActivity)
 *   - POST /api/activities/:id/cancel (ActivityService.cancelActivity)
 *   - 定时任务: 活动状态自动流转 (ActivityService.transitionStatuses)
 *
 * 来源文档: docs/module-design/activity.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - ActivityRepository: 全部 mock（隔离数据库依赖）
 * - VenueService: mock getVenueById（跨模块依赖）
 * - UserService: mock getUserById / getUsersByIds（跨模块依赖）
 * - NotificationService: mock create / createBatch（跨模块依赖）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityService } from '@server/modules/activity/service.js';
import { ActivityRepository } from '@server/modules/activity/repository.js';
import type { UpdateActivityInput } from '@server/modules/activity/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock ActivityRepository with all methods stubbed.
 * Individual tests override specific methods as needed.
 */
function createMockRepository(): {
  [K in keyof ActivityRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockResolvedValue(createActivityRecord()),
    findById: vi.fn().mockResolvedValue(null),
    findList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    addParticipant: vi.fn().mockResolvedValue(undefined),
    removeParticipant: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(createActivityRecord()),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    findUserActivities: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findActivitiesToTransition: vi.fn().mockResolvedValue([]),
    getParticipantIds: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Build a mock VenueService with cross-module methods.
 */
function createMockVenueService() {
  return {
    getVenueById: vi.fn().mockResolvedValue({
      id: 'venue-uuid-1',
      name: '朝阳体育中心羽毛球馆',
      address: '北京市朝阳区工体北路',
      latitude: 39.9215,
      longitude: 116.4435,
    }),
  };
}

/**
 * Build a mock UserService with cross-module methods.
 */
function createMockUserService() {
  return {
    getUserById: vi.fn().mockResolvedValue({
      id: 'user-uuid-1',
      nickname: '球友38291',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    }),
    getUsersByIds: vi.fn().mockResolvedValue([
      {
        id: 'user-uuid-1',
        nickname: '球友38291',
        avatarUrl: null,
        bio: null,
        isCoach: false,
      },
    ]),
  };
}

/**
 * Build a mock NotificationService with cross-module methods.
 */
function createMockNotificationService() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    createBatch: vi.fn().mockResolvedValue(undefined),
  };
}

/** Standard activity record as returned by repository */
function createActivityRecord(
  overrides?: Partial<{
    id: string;
    creatorId: string;
    venueId: string | null;
    title: string | null;
    startTime: Date;
    endTime: Date;
    maxParticipants: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    currentParticipants: number;
    participants: Array<{
      id: string;
      activityId: string;
      userId: string;
      joinedAt: Date;
    }>;
  }>,
) {
  return {
    id: 'activity-uuid-1',
    creatorId: 'user-uuid-1',
    venueId: 'venue-uuid-1',
    title: null,
    startTime: new Date('2026-04-05T14:00:00.000Z'),
    endTime: new Date('2026-04-05T16:00:00.000Z'),
    maxParticipants: 8,
    status: 'open',
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    currentParticipants: 1,
    participants: [
      {
        id: 'participant-uuid-1',
        activityId: 'activity-uuid-1',
        userId: 'user-uuid-1',
        joinedAt: new Date('2026-04-02T10:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

/** Future time helpers for valid input */
function futureDate(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

// ===========================================================================
// POST /api/activities/:id/join — ActivityService.joinActivity
// ===========================================================================

describe('POST /api/activities/:id/join — ActivityService.joinActivity', () => {
  let service: ActivityService;
  let repo: ReturnType<typeof createMockRepository>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let userService: ReturnType<typeof createMockUserService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    venueService = createMockVenueService();
    userService = createMockUserService();
    notificationService = createMockNotificationService();
    service = new ActivityService(
      repo as unknown as ActivityRepository,
      venueService as any,
      userService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 活动状态为 open 时可以加入（§4 加入活动 - 业务规则）
  it('should allow joining an open activity', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
      maxParticipants: 8,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.joinActivity('activity-uuid-1', 'user-uuid-2');

    expect(result).toBeDefined();
    expect(result.activityId).toBe('activity-uuid-1');
    expect(result.userId).toBe('user-uuid-2');
  });

  // 业务规则: 返回加入后的最新参与人数和活动状态（§4 加入活动 - Response 200）
  it('should return updated currentParticipants and status after joining', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
      maxParticipants: 8,
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.joinActivity('activity-uuid-1', 'user-uuid-2');

    expect(result).toBeDefined();
    expect(result.currentParticipants).toBeDefined();
    expect(result.status).toBeDefined();
    expect(result.joinedAt).toBeDefined();
  });

  // 业务规则: 加入后若 currentParticipants == maxParticipants，自动将状态更新为 full（§4 加入活动 - 业务规则）
  it('should transition status to full when activity reaches maxParticipants after join', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 7,
      maxParticipants: 8,
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.joinActivity('activity-uuid-1', 'user-uuid-2');

    expect(result.status).toBe('full');
    expect(result.currentParticipants).toBe(8);
  });

  // 业务规则: 加入后人数未满不应改变状态（§6.3 加入活动与满员状态联动）
  it('should keep status as open when not reaching maxParticipants after join', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
      maxParticipants: 8,
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.joinActivity('activity-uuid-1', 'user-uuid-2');

    expect(result.status).toBe('open');
  });

  // 业务规则: 加入成功后通知活动发起人（§4 加入活动 - 业务规则 + §6.5 通知文案）
  it('should notify activity creator after successful join', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
    });
    repo.findById.mockResolvedValue(activity);
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-2',
      nickname: '新球友',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await service.joinActivity('activity-uuid-1', 'user-uuid-2');

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ACTIVITY_JOINED',
        targetType: 'activity',
        targetId: 'activity-uuid-1',
      }),
    );
  });

  // 业务规则: 发起人自己加入（creatorId === userId）时不发通知（§4 加入活动 - 业务规则，防御性逻辑）
  it('should not send notification when creator joins own activity', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 0,
      participants: [],
    });
    repo.findById.mockResolvedValue(activity);

    await service.joinActivity('activity-uuid-1', 'user-uuid-1');

    expect(notificationService.create).not.toHaveBeenCalled();
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4 加入活动 - 业务规则）
  it('should not throw when notification creation fails', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
    });
    repo.findById.mockResolvedValue(activity);
    notificationService.create.mockRejectedValue(new Error('Notification failed'));

    const result = await service.joinActivity('activity-uuid-1', 'user-uuid-2');

    expect(result).toBeDefined();
    expect(result.activityId).toBe('activity-uuid-1');
  });

  // 业务规则: 通知文案包含用户昵称和球馆名称（§6.5 通知文案 — ACTIVITY_JOINED）
  it('should include joiner nickname and venue name in notification content', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
    });
    repo.findById.mockResolvedValue(activity);
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-2',
      nickname: '新球友',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await service.joinActivity('activity-uuid-1', 'user-uuid-2');

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '新成员加入',
        content: expect.stringContaining('新球友'),
      }),
    );
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('朝阳体育中心羽毛球馆'),
      }),
    );
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_FOUND — 活动不存在（§4 加入活动 - 错误码）
  it('should throw ACTIVITY_NOT_FOUND when activity does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.joinActivity('non-existent-id', 'user-uuid-2')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_FULL
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_FULL — 活动已满员（§4 加入活动 - 错误码）
  it('should throw ACTIVITY_FULL when activity status is full', async () => {
    const activity = createActivityRecord({
      status: 'full',
      currentParticipants: 8,
      maxParticipants: 8,
    });
    repo.findById.mockResolvedValue(activity);

    await expect(service.joinActivity('activity-uuid-1', 'user-uuid-2')).rejects.toMatchObject({
      code: 'ACTIVITY_FULL',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_ALREADY_JOINED
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_ALREADY_JOINED — 用户已加入该活动（§4 加入活动 - 错误码）
  it('should throw ACTIVITY_ALREADY_JOINED when user already joined', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    await expect(service.joinActivity('activity-uuid-1', 'user-uuid-2')).rejects.toMatchObject({
      code: 'ACTIVITY_ALREADY_JOINED',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_JOINABLE
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_JOINABLE — 活动状态为 in_progress，不允许加入（§4 加入活动 - 错误码）
  it('should throw ACTIVITY_NOT_JOINABLE when activity is in_progress', async () => {
    const activity = createActivityRecord({ status: 'in_progress' });
    repo.findById.mockResolvedValue(activity);

    await expect(service.joinActivity('activity-uuid-1', 'user-uuid-2')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_JOINABLE',
      statusCode: 409,
    });
  });

  // 错误码: ACTIVITY_NOT_JOINABLE — 活动状态为 completed，不允许加入（§4 加入活动 - 错误码）
  it('should throw ACTIVITY_NOT_JOINABLE when activity is completed', async () => {
    const activity = createActivityRecord({ status: 'completed' });
    repo.findById.mockResolvedValue(activity);

    await expect(service.joinActivity('activity-uuid-1', 'user-uuid-2')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_JOINABLE',
      statusCode: 409,
    });
  });

  // 错误码: ACTIVITY_NOT_JOINABLE — 活动状态为 cancelled，不允许加入（§4 加入活动 - 错误码）
  it('should throw ACTIVITY_NOT_JOINABLE when activity is cancelled', async () => {
    const activity = createActivityRecord({ status: 'cancelled' });
    repo.findById.mockResolvedValue(activity);

    await expect(service.joinActivity('activity-uuid-1', 'user-uuid-2')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_JOINABLE',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// POST /api/activities/:id/leave — ActivityService.leaveActivity
// ===========================================================================

describe('POST /api/activities/:id/leave — ActivityService.leaveActivity', () => {
  let service: ActivityService;
  let repo: ReturnType<typeof createMockRepository>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let userService: ReturnType<typeof createMockUserService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    venueService = createMockVenueService();
    userService = createMockUserService();
    notificationService = createMockNotificationService();
    service = new ActivityService(
      repo as unknown as ActivityRepository,
      venueService as any,
      userService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 活动状态为 open 时可以退出（§4 退出活动 - 业务规则）
  it('should allow leaving an open activity', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
        { id: 'p3', activityId: 'activity-uuid-1', userId: 'user-uuid-3', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.leaveActivity('activity-uuid-1', 'user-uuid-2');

    expect(result).toBeDefined();
    expect(result.activityId).toBe('activity-uuid-1');
    expect(result.userId).toBe('user-uuid-2');
  });

  // 业务规则: 活动状态为 full 时可以退出（§4 退出活动 - 业务规则）
  it('should allow leaving a full activity', async () => {
    const activity = createActivityRecord({
      status: 'full',
      currentParticipants: 8,
      maxParticipants: 8,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.leaveActivity('activity-uuid-1', 'user-uuid-2');

    expect(result).toBeDefined();
    expect(result.activityId).toBe('activity-uuid-1');
  });

  // 业务规则: 退出后返回最新参与人数和活动状态（§4 退出活动 - Response 200）
  it('should return updated currentParticipants and status after leaving', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.leaveActivity('activity-uuid-1', 'user-uuid-2');

    expect(result.currentParticipants).toBeDefined();
    expect(result.status).toBeDefined();
  });

  // 业务规则: 退出后若当前状态为 full 且人数 < maxParticipants，自动恢复为 open（§4 退出活动 - 业务规则 + §6.4）
  it('should transition status from full to open after leave when below maxParticipants', async () => {
    const activity = createActivityRecord({
      status: 'full',
      currentParticipants: 8,
      maxParticipants: 8,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.leaveActivity('activity-uuid-1', 'user-uuid-2');

    expect(result.status).toBe('open');
  });

  // 业务规则: 退出 open 状态活动，状态保持 open（§6.4 退出活动与满员状态联动）
  it('should keep status as open when leaving an open activity', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
      maxParticipants: 8,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.leaveActivity('activity-uuid-1', 'user-uuid-2');

    expect(result.status).toBe('open');
  });

  // 业务规则: 退出后通知活动发起人（§4 退出活动 - 业务规则 + §6.5 通知文案）
  it('should notify activity creator after successful leave', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-2',
      nickname: '退出的球友',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await service.leaveActivity('activity-uuid-1', 'user-uuid-2');

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ACTIVITY_LEFT',
        targetType: 'activity',
        targetId: 'activity-uuid-1',
      }),
    );
  });

  // 业务规则: 通知文案包含退出者昵称和球馆名称（§6.5 通知文案 — ACTIVITY_LEFT）
  it('should include leaver nickname and venue name in notification content', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-2',
      nickname: '退出的球友',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await service.leaveActivity('activity-uuid-1', 'user-uuid-2');

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '成员退出',
        content: expect.stringContaining('退出的球友'),
      }),
    );
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('朝阳体育中心羽毛球馆'),
      }),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4 退出活动 - 业务规则）
  it('should not throw when notification creation fails on leave', async () => {
    const activity = createActivityRecord({
      status: 'open',
      currentParticipants: 3,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);
    notificationService.create.mockRejectedValue(new Error('Notification failed'));

    const result = await service.leaveActivity('activity-uuid-1', 'user-uuid-2');

    expect(result).toBeDefined();
    expect(result.activityId).toBe('activity-uuid-1');
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_FOUND — 活动不存在（§4 退出活动 - 错误码）
  it('should throw ACTIVITY_NOT_FOUND when activity does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.leaveActivity('non-existent-id', 'user-uuid-2')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_CREATOR_CANNOT_LEAVE
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_CREATOR_CANNOT_LEAVE — 发起人尝试退出自己的活动（§4 退出活动 - 错误码）
  it('should throw ACTIVITY_CREATOR_CANNOT_LEAVE when creator tries to leave', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    await expect(service.leaveActivity('activity-uuid-1', 'user-uuid-1')).rejects.toMatchObject({
      code: 'ACTIVITY_CREATOR_CANNOT_LEAVE',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_LEAVABLE
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_LEAVABLE — 活动状态为 in_progress，不允许退出（§4 退出活动 - 错误码）
  it('should throw ACTIVITY_NOT_LEAVABLE when activity is in_progress', async () => {
    const activity = createActivityRecord({
      status: 'in_progress',
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    await expect(service.leaveActivity('activity-uuid-1', 'user-uuid-2')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_LEAVABLE',
      statusCode: 409,
    });
  });

  // 错误码: ACTIVITY_NOT_LEAVABLE — 活动状态为 completed，不允许退出（§4 退出活动 - 错误码）
  it('should throw ACTIVITY_NOT_LEAVABLE when activity is completed', async () => {
    const activity = createActivityRecord({
      status: 'completed',
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    await expect(service.leaveActivity('activity-uuid-1', 'user-uuid-2')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_LEAVABLE',
      statusCode: 409,
    });
  });

  // 错误码: ACTIVITY_NOT_LEAVABLE — 活动状态为 cancelled，不允许退出（§4 退出活动 - 错误码）
  it('should throw ACTIVITY_NOT_LEAVABLE when activity is cancelled', async () => {
    const activity = createActivityRecord({
      status: 'cancelled',
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    await expect(service.leaveActivity('activity-uuid-1', 'user-uuid-2')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_LEAVABLE',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_PARTICIPANT
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_PARTICIPANT — 用户不是该活动的参与者（§4 退出活动 - 错误码）
  it('should throw ACTIVITY_NOT_PARTICIPANT when user is not a participant', async () => {
    const activity = createActivityRecord({
      status: 'open',
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    await expect(service.leaveActivity('activity-uuid-1', 'user-uuid-3')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_PARTICIPANT',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// PUT /api/activities/:id — ActivityService.updateActivity
// ===========================================================================

describe('PUT /api/activities/:id — ActivityService.updateActivity', () => {
  let service: ActivityService;
  let repo: ReturnType<typeof createMockRepository>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let userService: ReturnType<typeof createMockUserService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    venueService = createMockVenueService();
    userService = createMockUserService();
    notificationService = createMockNotificationService();
    service = new ActivityService(
      repo as unknown as ActivityRepository,
      venueService as any,
      userService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 发起人可修改 open 状态的活动（§4 修改活动 - 业务规则）
  it('should allow creator to update an open activity', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({
      ...activity,
      maxParticipants: 10,
    });

    const input: UpdateActivityInput = { maxParticipants: 10 };
    const result = await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(result).toBeDefined();
    expect(result.maxParticipants).toBe(10);
  });

  // 业务规则: 发起人可修改 full 状态的活动（§4 修改活动 - 业务规则）
  it('should allow creator to update a full activity', async () => {
    const activity = createActivityRecord({
      status: 'full',
      creatorId: 'user-uuid-1',
      currentParticipants: 8,
      maxParticipants: 8,
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({
      ...activity,
      maxParticipants: 10,
      status: 'open',
    });

    const input: UpdateActivityInput = { maxParticipants: 10 };
    const result = await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(result).toBeDefined();
  });

  // 业务规则: 只更新请求体中包含的字段，未提供的字段保持不变（§4 修改活动 - 业务规则）
  it('should only update provided fields, leaving others unchanged', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      title: '原标题',
      maxParticipants: 8,
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({
      ...activity,
      title: '新标题',
    });

    const input: UpdateActivityInput = { title: '新标题' };
    const result = await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(result).toBeDefined();
    // Should update title
    expect(result.title).toBe('新标题');
    // Should keep original maxParticipants
    expect(result.maxParticipants).toBe(8);
  });

  // 业务规则: 若修改 venueId，调用 VenueService.getVenueById() 验证球馆存在（§4 修改活动 - 业务规则）
  it('should validate venue exists when venueId is being updated', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({ ...activity, venueId: 'venue-uuid-2' });

    const input: UpdateActivityInput = { venueId: 'venue-uuid-2' };
    await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(venueService.getVenueById).toHaveBeenCalledWith('venue-uuid-2');
  });

  // 业务规则: 若修改 startTime，新的开始时间必须晚于当前时间（§4 修改活动 - 业务规则）
  it('should allow updating startTime to a future time', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    const newStartTime = futureDate(48);
    const newEndTime = futureDate(50);
    repo.update.mockResolvedValue({
      ...activity,
      startTime: new Date(newStartTime),
      endTime: new Date(newEndTime),
    });

    const input: UpdateActivityInput = { startTime: newStartTime, endTime: newEndTime };
    const result = await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(result).toBeDefined();
  });

  // 业务规则: 修改 maxParticipants 后重新检查满员状态 — 修改后 currentParticipants == maxParticipants → full（§4 修改活动 - 业务规则）
  it('should transition to full when maxParticipants equals currentParticipants after update', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      currentParticipants: 5,
      maxParticipants: 8,
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({
      ...activity,
      maxParticipants: 5,
      status: 'full',
    });

    const input: UpdateActivityInput = { maxParticipants: 5 };
    const result = await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(result.status).toBe('full');
  });

  // 业务规则: 修改 maxParticipants 后重新检查 — currentParticipants < maxParticipants 且当前 full → open（§4 修改活动 - 业务规则）
  it('should transition from full to open when maxParticipants is increased above currentParticipants', async () => {
    const activity = createActivityRecord({
      status: 'full',
      creatorId: 'user-uuid-1',
      currentParticipants: 8,
      maxParticipants: 8,
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({
      ...activity,
      maxParticipants: 10,
      status: 'open',
    });

    const input: UpdateActivityInput = { maxParticipants: 10 };
    const result = await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(result.status).toBe('open');
  });

  // 业务规则: 修改成功后通知所有参与者（不含发起人自己）（§4 修改活动 - 业务规则 + §6.5）
  it('should notify all participants except creator after update', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      currentParticipants: 3,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
        { id: 'p3', activityId: 'activity-uuid-1', userId: 'user-uuid-3', joinedAt: new Date() },
      ],
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({ ...activity, maxParticipants: 10 });
    repo.getParticipantIds.mockResolvedValue(['user-uuid-1', 'user-uuid-2', 'user-uuid-3']);

    const input: UpdateActivityInput = { maxParticipants: 10 };
    await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(notificationService.createBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'ACTIVITY_UPDATED',
          targetType: 'activity',
          targetId: 'activity-uuid-1',
        }),
      ]),
    );
  });

  // 业务规则: 通知文案包含球馆名称和开始日期（§6.5 通知文案 — ACTIVITY_UPDATED）
  it('should include venue name in update notification content', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      currentParticipants: 2,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({ ...activity, maxParticipants: 10 });
    repo.getParticipantIds.mockResolvedValue(['user-uuid-1', 'user-uuid-2']);

    const input: UpdateActivityInput = { maxParticipants: 10 };
    await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(notificationService.createBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: '活动已更新',
          content: expect.stringContaining('朝阳体育中心羽毛球馆'),
        }),
      ]),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4 修改活动 - 业务规则）
  it('should not throw when notification creation fails on update', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      currentParticipants: 2,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({ ...activity, maxParticipants: 10 });
    repo.getParticipantIds.mockResolvedValue(['user-uuid-1', 'user-uuid-2']);
    notificationService.createBatch.mockRejectedValue(new Error('Notification failed'));

    const input: UpdateActivityInput = { maxParticipants: 10 };
    const result = await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(result).toBeDefined();
  });

  // 业务规则: 返回格式包含 venue 信息（§4 修改活动 - Response 200）
  it('should return venue information in update response', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({ ...activity, maxParticipants: 10 });

    const input: UpdateActivityInput = { maxParticipants: 10 };
    const result = await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(result).toBeDefined();
    expect(result.venue).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_FOUND — 活动不存在（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_NOT_FOUND when activity does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    const input: UpdateActivityInput = { maxParticipants: 10 };
    await expect(
      service.updateActivity('non-existent-id', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_CREATOR
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_CREATOR — 非发起人尝试修改活动（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_NOT_CREATOR when non-creator tries to update', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = { maxParticipants: 10 };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-2', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_CREATOR',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_MODIFIABLE
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_MODIFIABLE — 活动状态为 in_progress（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_NOT_MODIFIABLE when activity is in_progress', async () => {
    const activity = createActivityRecord({
      status: 'in_progress',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = { maxParticipants: 10 };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_MODIFIABLE',
      statusCode: 409,
    });
  });

  // 错误码: ACTIVITY_NOT_MODIFIABLE — 活动状态为 completed（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_NOT_MODIFIABLE when activity is completed', async () => {
    const activity = createActivityRecord({
      status: 'completed',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = { maxParticipants: 10 };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_MODIFIABLE',
      statusCode: 409,
    });
  });

  // 错误码: ACTIVITY_NOT_MODIFIABLE — 活动状态为 cancelled（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_NOT_MODIFIABLE when activity is cancelled', async () => {
    const activity = createActivityRecord({
      status: 'cancelled',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = { maxParticipants: 10 };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_MODIFIABLE',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_INVALID_VENUE
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_INVALID_VENUE — venueId 格式不合法（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_INVALID_VENUE when venueId is invalid format', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = { venueId: '' };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_VENUE',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_VENUE_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_VENUE_NOT_FOUND — 修改 venueId 时球馆不存在（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_VENUE_NOT_FOUND when new venue does not exist', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    venueService.getVenueById.mockResolvedValue(null);

    const input: UpdateActivityInput = { venueId: 'non-existent-venue' };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_VENUE_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_INVALID_TIME
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_INVALID_TIME — 修改 startTime 为过去时间（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_INVALID_TIME when new startTime is in the past', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = {
      startTime: new Date('2020-01-01T00:00:00.000Z').toISOString(),
    };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TIME',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_TIME — endTime 不晚于 startTime（使用修改后的值比较）（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_INVALID_TIME when new endTime is before startTime', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = {
      startTime: futureDate(48),
      endTime: futureDate(46),
    };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TIME',
      statusCode: 400,
    });
  });

  // 业务规则: 若只修改 endTime，使用原 startTime 进行比较（§4 修改活动 - 业务规则）
  it('should throw ACTIVITY_INVALID_TIME when new endTime is before existing startTime', async () => {
    const futureStart = new Date(Date.now() + 86400000);
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      startTime: futureStart,
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);

    // Set endTime to before the existing startTime
    const input: UpdateActivityInput = {
      endTime: new Date(futureStart.getTime() - 3600000).toISOString(),
    };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TIME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_INVALID_PARTICIPANTS
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_INVALID_PARTICIPANTS — maxParticipants < 2（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_INVALID_PARTICIPANTS when maxParticipants is less than 2', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = { maxParticipants: 1 };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_PARTICIPANTS',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_PARTICIPANTS — maxParticipants > 50（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_INVALID_PARTICIPANTS when maxParticipants is greater than 50', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = { maxParticipants: 51 };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_PARTICIPANTS',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_INVALID_TITLE
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_INVALID_TITLE — title 超过 50 字符（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_INVALID_TITLE when title exceeds 50 characters', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = { title: 'a'.repeat(51) };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TITLE',
      statusCode: 400,
    });
  });

  // 边界值: title 恰好 50 字符应通过（§4 修改活动 - 错误码 ACTIVITY_INVALID_TITLE 触发条件）
  it('should accept title of exactly 50 characters', async () => {
    const title50 = 'a'.repeat(50);
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({ ...activity, title: title50 });

    const input: UpdateActivityInput = { title: title50 };
    const result = await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(result.title).toBe(title50);
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_PARTICIPANTS_EXCEED
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_PARTICIPANTS_EXCEED — maxParticipants 小于当前参与人数（§4 修改活动 - 错误码）
  it('should throw ACTIVITY_PARTICIPANTS_EXCEED when maxParticipants is less than currentParticipants', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      currentParticipants: 5,
      maxParticipants: 8,
    });
    repo.findById.mockResolvedValue(activity);

    const input: UpdateActivityInput = { maxParticipants: 4 };
    await expect(
      service.updateActivity('activity-uuid-1', 'user-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_PARTICIPANTS_EXCEED',
      statusCode: 400,
    });
  });

  // 边界值: maxParticipants 等于当前参与人数应允许（变为 full）（§4 修改活动 - 业务规则）
  it('should allow setting maxParticipants equal to currentParticipants', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      currentParticipants: 5,
      maxParticipants: 8,
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 93600000),
    });
    repo.findById.mockResolvedValue(activity);
    repo.update.mockResolvedValue({
      ...activity,
      maxParticipants: 5,
      status: 'full',
    });

    const input: UpdateActivityInput = { maxParticipants: 5 };
    const result = await service.updateActivity('activity-uuid-1', 'user-uuid-1', input);

    expect(result).toBeDefined();
    expect(result.status).toBe('full');
  });
});

// ===========================================================================
// POST /api/activities/:id/cancel — ActivityService.cancelActivity
// ===========================================================================

describe('POST /api/activities/:id/cancel — ActivityService.cancelActivity', () => {
  let service: ActivityService;
  let repo: ReturnType<typeof createMockRepository>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let userService: ReturnType<typeof createMockUserService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    venueService = createMockVenueService();
    userService = createMockUserService();
    notificationService = createMockNotificationService();
    service = new ActivityService(
      repo as unknown as ActivityRepository,
      venueService as any,
      userService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 发起人可取消 open 状态的活动（§4 取消活动 - 业务规则）
  it('should allow creator to cancel an open activity', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.cancelActivity('activity-uuid-1', 'user-uuid-1');

    expect(result).toBeDefined();
    expect(result.id).toBe('activity-uuid-1');
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 发起人可取消 full 状态的活动（§4 取消活动 - 业务规则）
  it('should allow creator to cancel a full activity', async () => {
    const activity = createActivityRecord({
      status: 'full',
      creatorId: 'user-uuid-1',
      currentParticipants: 8,
      maxParticipants: 8,
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.cancelActivity('activity-uuid-1', 'user-uuid-1');

    expect(result).toBeDefined();
    expect(result.id).toBe('activity-uuid-1');
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 已取消的活动不可重复取消（幂等：返回当前状态，不报错）（§4 取消活动 - 业务规则）
  it('should return current status without error when already cancelled (idempotent)', async () => {
    const activity = createActivityRecord({
      status: 'cancelled',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.cancelActivity('activity-uuid-1', 'user-uuid-1');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 取消后活动状态变为 cancelled（§4 取消活动 - 业务规则）
  it('should set activity status to cancelled', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    const result = await service.cancelActivity('activity-uuid-1', 'user-uuid-1');

    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 取消后通知所有参与者（不含发起人自己）（§4 取消活动 - 业务规则 + §6.5）
  it('should notify all participants except creator after cancellation', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      currentParticipants: 3,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
        { id: 'p3', activityId: 'activity-uuid-1', userId: 'user-uuid-3', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);
    repo.getParticipantIds.mockResolvedValue(['user-uuid-1', 'user-uuid-2', 'user-uuid-3']);

    await service.cancelActivity('activity-uuid-1', 'user-uuid-1');

    expect(notificationService.createBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'ACTIVITY_CANCELLED',
          targetType: 'activity',
          targetId: 'activity-uuid-1',
        }),
      ]),
    );
  });

  // 业务规则: 通知文案包含球馆名称和原开始日期（§6.5 通知文案 — ACTIVITY_CANCELLED）
  it('should include venue name in cancellation notification content', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      currentParticipants: 2,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);
    repo.getParticipantIds.mockResolvedValue(['user-uuid-1', 'user-uuid-2']);

    await service.cancelActivity('activity-uuid-1', 'user-uuid-1');

    expect(notificationService.createBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: '活动已取消',
          content: expect.stringContaining('朝阳体育中心羽毛球馆'),
        }),
      ]),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4 取消活动 - 业务规则）
  it('should not throw when notification creation fails on cancel', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
      currentParticipants: 2,
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
        { id: 'p2', activityId: 'activity-uuid-1', userId: 'user-uuid-2', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);
    repo.getParticipantIds.mockResolvedValue(['user-uuid-1', 'user-uuid-2']);
    notificationService.createBatch.mockRejectedValue(new Error('Notification failed'));

    const result = await service.cancelActivity('activity-uuid-1', 'user-uuid-1');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 已取消活动重复取消时不发送通知（幂等场景）（§4 取消活动 - 业务规则）
  it('should not send notification when already cancelled (idempotent)', async () => {
    const activity = createActivityRecord({
      status: 'cancelled',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    await service.cancelActivity('activity-uuid-1', 'user-uuid-1');

    expect(notificationService.createBatch).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_FOUND — 活动不存在（§4 取消活动 - 错误码）
  it('should throw ACTIVITY_NOT_FOUND when activity does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      service.cancelActivity('non-existent-id', 'user-uuid-1'),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_CREATOR
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_CREATOR — 非发起人尝试取消活动（§4 取消活动 - 错误码）
  it('should throw ACTIVITY_NOT_CREATOR when non-creator tries to cancel', async () => {
    const activity = createActivityRecord({
      status: 'open',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    await expect(
      service.cancelActivity('activity-uuid-1', 'user-uuid-2'),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_CREATOR',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_CANCELLABLE
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_CANCELLABLE — 活动状态为 in_progress（§4 取消活动 - 错误码）
  it('should throw ACTIVITY_NOT_CANCELLABLE when activity is in_progress', async () => {
    const activity = createActivityRecord({
      status: 'in_progress',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    await expect(
      service.cancelActivity('activity-uuid-1', 'user-uuid-1'),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  // 错误码: ACTIVITY_NOT_CANCELLABLE — 活动状态为 completed（§4 取消活动 - 错误码）
  it('should throw ACTIVITY_NOT_CANCELLABLE when activity is completed', async () => {
    const activity = createActivityRecord({
      status: 'completed',
      creatorId: 'user-uuid-1',
    });
    repo.findById.mockResolvedValue(activity);

    await expect(
      service.cancelActivity('activity-uuid-1', 'user-uuid-1'),
    ).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// 定时任务: 活动状态自动流转 — ActivityService.transitionStatuses
// ===========================================================================

describe('定时任务: 活动状态自动流转 — ActivityService.transitionStatuses', () => {
  let service: ActivityService;
  let repo: ReturnType<typeof createMockRepository>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let userService: ReturnType<typeof createMockUserService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    venueService = createMockVenueService();
    userService = createMockUserService();
    notificationService = createMockNotificationService();
    service = new ActivityService(
      repo as unknown as ActivityRepository,
      venueService as any,
      userService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程: open/full → in_progress
  // -----------------------------------------------------------------------

  // 业务规则: 查询 open/full 且 startTime <= 当前时间的活动，更新为 in_progress（§6.2 定时任务）
  it('should transition open/full activities to in_progress when startTime has passed', async () => {
    const pastStartActivity = createActivityRecord({
      id: 'activity-past-start',
      status: 'open',
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
    });
    repo.findActivitiesToTransition.mockResolvedValueOnce([pastStartActivity]);
    repo.findActivitiesToTransition.mockResolvedValueOnce([]); // no in_progress → completed

    await service.transitionStatuses();

    // Should find activities with open/full + past startTime
    expect(repo.findActivitiesToTransition).toHaveBeenCalled();
    // Should update the found activities to in_progress
    expect(repo.updateStatus).toHaveBeenCalledWith(
      ['activity-past-start'],
      'in_progress',
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程: in_progress → completed
  // -----------------------------------------------------------------------

  // 业务规则: 查询 in_progress 且 endTime <= 当前时间的活动，更新为 completed（§6.2 定时任务）
  it('should transition in_progress activities to completed when endTime has passed', async () => {
    const pastEndActivity = createActivityRecord({
      id: 'activity-past-end',
      status: 'in_progress',
      endTime: new Date(Date.now() - 3600000), // 1 hour ago
    });
    repo.findActivitiesToTransition.mockResolvedValueOnce([]); // no open/full → in_progress
    repo.findActivitiesToTransition.mockResolvedValueOnce([pastEndActivity]);

    await service.transitionStatuses();

    expect(repo.findActivitiesToTransition).toHaveBeenCalled();
    // Should update the found activities to completed
    expect(repo.updateStatus).toHaveBeenCalledWith(
      ['activity-past-end'],
      'completed',
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程: 无需流转
  // -----------------------------------------------------------------------

  // 业务规则: 无需流转时正常返回（§6.2 定时任务）
  it('should handle case when no activities need transition', async () => {
    repo.findActivitiesToTransition.mockResolvedValue([]);

    await expect(service.transitionStatuses()).resolves.not.toThrow();
  });

  // -----------------------------------------------------------------------
  // 异常处理
  // -----------------------------------------------------------------------

  // 业务规则: 定时任务异常通过 try-catch 捕获，不影响服务稳定性（§6.2 定时任务）
  it('should not throw when repository operation fails in transition', async () => {
    repo.findActivitiesToTransition.mockRejectedValue(new Error('DB connection failed'));

    await expect(service.transitionStatuses()).resolves.not.toThrow();
  });

  // 业务规则: 批量更新使用条件查询，天然幂等（§7 并发控制）
  it('should be idempotent — running twice should not cause errors', async () => {
    repo.findActivitiesToTransition.mockResolvedValue([]);

    await service.transitionStatuses();
    await service.transitionStatuses();

    // Both calls should succeed
    expect(repo.findActivitiesToTransition).toHaveBeenCalledTimes(4); // 2 calls per invocation
  });
});
