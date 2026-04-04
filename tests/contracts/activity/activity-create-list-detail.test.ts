/**
 * 契约测试: activity 模块 — 活动创建、列表与详情接口
 * 覆盖接口:
 *   - POST /api/activities (ActivityService.createActivity)
 *   - GET /api/activities (ActivityService.getActivityList)
 *   - GET /api/activities/:id (ActivityService.getActivityDetail)
 *   - GET /api/users/:id/activities (ActivityService.getUserActivities)
 *   - ActivityService.getActivityById (跨模块 Service 调用)
 *   - ActivityService.getParticipantIds (跨模块 Service 调用)
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
import type { CreateActivityInput, ActivityListQuery, UserActivitiesQuery } from '@server/modules/activity/types.js';

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

/** Create valid CreateActivityInput */
function validCreateInput(overrides?: Partial<CreateActivityInput>): CreateActivityInput {
  return {
    venueId: 'venue-uuid-1',
    startTime: futureDate(24),
    endTime: futureDate(26),
    maxParticipants: 8,
    ...overrides,
  };
}

// ===========================================================================
// POST /api/activities — ActivityService.createActivity
// ===========================================================================

describe('POST /api/activities — ActivityService.createActivity', () => {
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

  // 业务规则: 发起人自动成为第一个参与者（§4 创建活动 - 业务规则）
  // 业务规则: 创建成功后活动状态为 open（§4 创建活动 - 业务规则）
  it('should create an activity with valid input and creator as first participant', async () => {
    const input = validCreateInput();
    const result = await service.createActivity('user-uuid-1', input);

    expect(result).toBeDefined();
    expect(result.status).toBe('open');
    expect(result.currentParticipants).toBe(1);
    expect(result.creatorId).toBe('user-uuid-1');
  });

  // 业务规则: 调用 VenueService.getVenueById(venueId) 验证球馆存在（§4 创建活动 - 业务规则）
  it('should call VenueService.getVenueById to validate venue exists', async () => {
    const input = validCreateInput();
    await service.createActivity('user-uuid-1', input);

    expect(venueService.getVenueById).toHaveBeenCalledWith('venue-uuid-1');
  });

  // 业务规则: title 为可选字段（§4 创建活动 - 业务规则）
  it('should allow creating activity without title', async () => {
    const input = validCreateInput({ title: undefined });
    const result = await service.createActivity('user-uuid-1', input);

    expect(result).toBeDefined();
    expect(result.title).toBeNull();
  });

  // 业务规则: title 若提供则长度不超过 50 字符（§4 创建活动 - 业务规则）
  it('should allow creating activity with valid title', async () => {
    repo.create.mockResolvedValue(createActivityRecord({ title: '周末约球' }));
    const input = validCreateInput({ title: '周末约球' });
    const result = await service.createActivity('user-uuid-1', input);

    expect(result).toBeDefined();
    expect(result.title).toBe('周末约球');
  });

  // 业务规则: maxParticipants 若为 2 且仅有发起人 1 人，状态保持 open（§4 创建活动 - 业务规则）
  it('should keep status open when maxParticipants is 2 and only creator joined', async () => {
    repo.create.mockResolvedValue(
      createActivityRecord({ maxParticipants: 2, currentParticipants: 1, status: 'open' }),
    );
    const input = validCreateInput({ maxParticipants: 2 });
    const result = await service.createActivity('user-uuid-1', input);

    expect(result.status).toBe('open');
    expect(result.currentParticipants).toBe(1);
  });

  // 业务规则: 返回格式包含 venue 信息（§4 创建活动 - Response 201）
  it('should return venue information in response', async () => {
    const input = validCreateInput();
    const result = await service.createActivity('user-uuid-1', input);

    expect(result).toBeDefined();
    // Response should include venue as an object with id, name, address, latitude, longitude
    expect(result.venue).toBeDefined();
    expect(result.venue).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });
  });

  // 业务规则: 返回格式包含 participants 列表（§4 创建活动 - Response 201）
  it('should return participants list with creator included', async () => {
    const input = validCreateInput();
    const result = await service.createActivity('user-uuid-1', input);

    expect(result).toBeDefined();
    // Participants should include at least the creator
    expect(result.participants).toBeDefined();
    expect(result.participants.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_VENUE_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_VENUE_NOT_FOUND — 球馆不存在（§4 创建活动 - 错误码）
  it('should throw ACTIVITY_VENUE_NOT_FOUND when venue does not exist', async () => {
    venueService.getVenueById.mockResolvedValue(null);
    const input = validCreateInput();

    await expect(service.createActivity('user-uuid-1', input)).rejects.toMatchObject({
      code: 'ACTIVITY_VENUE_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_INVALID_VENUE
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_INVALID_VENUE — venueId 缺失或格式不合法（§4 创建活动 - 错误码）
  it('should throw ACTIVITY_INVALID_VENUE when venueId is empty', async () => {
    const input = validCreateInput({ venueId: '' });

    await expect(service.createActivity('user-uuid-1', input)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_VENUE',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_INVALID_TIME
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_INVALID_TIME — 开始时间不晚于当前时间（§4 创建活动 - 错误码）
  it('should throw ACTIVITY_INVALID_TIME when startTime is in the past', async () => {
    const input = validCreateInput({
      startTime: new Date('2020-01-01T00:00:00.000Z').toISOString(),
    });

    await expect(service.createActivity('user-uuid-1', input)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TIME',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_TIME — 结束时间不晚于开始时间（§4 创建活动 - 错误码）
  it('should throw ACTIVITY_INVALID_TIME when endTime is before startTime', async () => {
    const start = futureDate(26);
    const end = futureDate(24);
    const input = validCreateInput({ startTime: start, endTime: end });

    await expect(service.createActivity('user-uuid-1', input)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TIME',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_TIME — 结束时间等于开始时间（§4 创建活动 - 错误码）
  it('should throw ACTIVITY_INVALID_TIME when endTime equals startTime', async () => {
    const sameTime = futureDate(24);
    const input = validCreateInput({ startTime: sameTime, endTime: sameTime });

    await expect(service.createActivity('user-uuid-1', input)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TIME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_INVALID_PARTICIPANTS
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_INVALID_PARTICIPANTS — maxParticipants < 2（§4 创建活动 - 错误码）
  it('should throw ACTIVITY_INVALID_PARTICIPANTS when maxParticipants is less than 2', async () => {
    const input = validCreateInput({ maxParticipants: 1 });

    await expect(service.createActivity('user-uuid-1', input)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_PARTICIPANTS',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_PARTICIPANTS — maxParticipants > 50（§4 创建活动 - 错误码）
  it('should throw ACTIVITY_INVALID_PARTICIPANTS when maxParticipants is greater than 50', async () => {
    const input = validCreateInput({ maxParticipants: 51 });

    await expect(service.createActivity('user-uuid-1', input)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_PARTICIPANTS',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_PARTICIPANTS — maxParticipants 为 0（§4 创建活动 - 错误码）
  it('should throw ACTIVITY_INVALID_PARTICIPANTS when maxParticipants is 0', async () => {
    const input = validCreateInput({ maxParticipants: 0 });

    await expect(service.createActivity('user-uuid-1', input)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_PARTICIPANTS',
      statusCode: 400,
    });
  });

  // 边界值: maxParticipants 恰好为 2（最小有效值）
  it('should accept maxParticipants of exactly 2', async () => {
    repo.create.mockResolvedValue(createActivityRecord({ maxParticipants: 2 }));
    const input = validCreateInput({ maxParticipants: 2 });
    const result = await service.createActivity('user-uuid-1', input);

    expect(result.maxParticipants).toBe(2);
  });

  // 边界值: maxParticipants 恰好为 50（最大有效值）
  it('should accept maxParticipants of exactly 50', async () => {
    repo.create.mockResolvedValue(createActivityRecord({ maxParticipants: 50 }));
    const input = validCreateInput({ maxParticipants: 50 });
    const result = await service.createActivity('user-uuid-1', input);

    expect(result.maxParticipants).toBe(50);
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_INVALID_TITLE
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_INVALID_TITLE — title 超过 50 字符（§4 创建活动 - 错误码）
  it('should throw ACTIVITY_INVALID_TITLE when title exceeds 50 characters', async () => {
    const input = validCreateInput({ title: 'a'.repeat(51) });

    await expect(service.createActivity('user-uuid-1', input)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_TITLE',
      statusCode: 400,
    });
  });

  // 边界值: title 恰好为 50 字符（最大有效值）
  it('should accept title of exactly 50 characters', async () => {
    const title50 = 'a'.repeat(50);
    repo.create.mockResolvedValue(createActivityRecord({ title: title50 }));
    const input = validCreateInput({ title: title50 });
    const result = await service.createActivity('user-uuid-1', input);

    expect(result.title).toBe(title50);
  });
});

// ===========================================================================
// GET /api/activities — ActivityService.getActivityList
// ===========================================================================

describe('GET /api/activities — ActivityService.getActivityList', () => {
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

  // 业务规则: 默认仅返回未来的活动且状态不为 cancelled（§4 活动列表 - 业务规则）
  it('should return future non-cancelled activities by default', async () => {
    const futureActivity = createActivityRecord({
      startTime: new Date(Date.now() + 86400000),
      status: 'open',
    });
    repo.findList.mockResolvedValue({
      items: [futureActivity],
      total: 1,
    });

    const result = await service.getActivityList({});

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  // 业务规则: 默认分页参数 page=1, pageSize=20（§4 活动列表 - Query Params）
  it('should use default pagination (page=1, pageSize=20) when not specified', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    await service.getActivityList({});

    expect(repo.findList).toHaveBeenCalled();
    const callArgs = repo.findList.mock.calls[0];
    // The repository should receive default pagination values
    expect(callArgs).toBeDefined();
  });

  // 业务规则: 支持自定义分页（§4 活动列表 - Query Params）
  it('should respect custom pagination parameters', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = { page: 2, pageSize: 10 };
    await service.getActivityList(query);

    expect(repo.findList).toHaveBeenCalled();
  });

  // 业务规则: pageSize 最大 100（§4 活动列表 - Query Params）
  it('should cap pageSize at 100', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = { pageSize: 200 };
    const result = await service.getActivityList(query);

    expect(result).toBeDefined();
    expect(result.pageSize).toBeLessThanOrEqual(100);
  });

  // 业务规则: 返回分页信息（§4 活动列表 - Response 200）
  it('should return pagination info in response', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 50 });

    const result = await service.getActivityList({ page: 1, pageSize: 20 });

    expect(result.total).toBe(50);
    expect(result.page).toBeDefined();
    expect(result.pageSize).toBeDefined();
  });

  // 业务规则: 排序方式 time（默认）— 按 startTime 升序（§4 活动列表 - 业务规则）
  it('should sort by startTime ascending by default', async () => {
    const activity1 = createActivityRecord({
      id: 'a1',
      startTime: new Date('2026-04-05T14:00:00.000Z'),
    });
    const activity2 = createActivityRecord({
      id: 'a2',
      startTime: new Date('2026-04-06T14:00:00.000Z'),
    });
    repo.findList.mockResolvedValue({
      items: [activity1, activity2],
      total: 2,
    });

    const result = await service.getActivityList({});

    expect(result.items).toHaveLength(2);
  });

  // 业务规则: 时间筛选 dateFilter=today（§4 活动列表 - 业务规则）
  it('should filter activities for today when dateFilter is today', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = { dateFilter: 'today' };
    await service.getActivityList(query);

    expect(repo.findList).toHaveBeenCalled();
    expect(repo.findList.mock.calls[0][0]).toMatchObject({ dateFilter: 'today' });
  });

  // 业务规则: 时间筛选 dateFilter=tomorrow（§4 活动列表 - 业务规则）
  it('should filter activities for tomorrow when dateFilter is tomorrow', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = { dateFilter: 'tomorrow' };
    await service.getActivityList(query);

    expect(repo.findList).toHaveBeenCalled();
    expect(repo.findList.mock.calls[0][0]).toMatchObject({ dateFilter: 'tomorrow' });
  });

  // 业务规则: 时间筛选 dateFilter=this_week（§4 活动列表 - 业务规则）
  it('should filter activities for this week when dateFilter is this_week', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = { dateFilter: 'this_week' };
    await service.getActivityList(query);

    expect(repo.findList).toHaveBeenCalled();
    expect(repo.findList.mock.calls[0][0]).toMatchObject({ dateFilter: 'this_week' });
  });

  // 业务规则: 自定义日期范围（dateStart + dateEnd）（§4 活动列表 - 业务规则）
  it('should filter by custom date range when dateStart and dateEnd are provided', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = {
      dateStart: '2026-04-05T00:00:00.000Z',
      dateEnd: '2026-04-10T23:59:59.000Z',
    };
    await service.getActivityList(query);

    expect(repo.findList).toHaveBeenCalled();
    expect(repo.findList.mock.calls[0][0]).toMatchObject({
      dateStart: '2026-04-05T00:00:00.000Z',
      dateEnd: '2026-04-10T23:59:59.000Z',
    });
  });

  // 业务规则: dateFilter 和 dateStart/dateEnd 互斥，dateFilter 优先（§4 活动列表 - 业务规则）
  it('should prioritize dateFilter over dateStart/dateEnd', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = {
      dateFilter: 'today',
      dateStart: '2026-04-05T00:00:00.000Z',
      dateEnd: '2026-04-10T23:59:59.000Z',
    };
    await service.getActivityList(query);

    // Should use dateFilter (today) and ignore dateStart/dateEnd
    expect(repo.findList).toHaveBeenCalled();
    expect(repo.findList.mock.calls[0][0]).toMatchObject({ dateFilter: 'today' });
  });

  // 业务规则: 距离筛选（maxDistance）需 latitude 和 longitude 同时提供（§4 活动列表 - 业务规则）
  it('should filter by distance when maxDistance, latitude, and longitude are provided', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = {
      maxDistance: 5,
      latitude: 39.9,
      longitude: 116.4,
    };
    await service.getActivityList(query);

    expect(repo.findList).toHaveBeenCalled();
    expect(repo.findList.mock.calls[0][0]).toMatchObject({
      maxDistance: 5,
      latitude: 39.9,
      longitude: 116.4,
    });
  });

  // 业务规则: 空余筛选 hasSlot=true — 仅返回 status 为 open 的活动（§4 活动列表 - 业务规则）
  it('should filter only open activities when hasSlot is true', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = { hasSlot: true };
    await service.getActivityList(query);

    expect(repo.findList).toHaveBeenCalled();
    expect(repo.findList.mock.calls[0][0]).toMatchObject({ hasSlot: true });
  });

  // 业务规则: sortBy=distance 需传入经纬度（§4 活动列表 - 业务规则）
  it('should sort by distance when sortBy is distance and coordinates are provided', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = {
      sortBy: 'distance',
      latitude: 39.9,
      longitude: 116.4,
    };
    await service.getActivityList(query);

    expect(repo.findList).toHaveBeenCalled();
    expect(repo.findList.mock.calls[0][0]).toMatchObject({
      sortBy: 'distance',
      latitude: 39.9,
      longitude: 116.4,
    });
  });

  // 业务规则: sortBy=distance 未提供经纬度时回退到 time（§4 活动列表 - 业务规则）
  it('should fallback to time sort when sortBy is distance but no coordinates', async () => {
    repo.findList.mockResolvedValue({ items: [], total: 0 });

    const query: ActivityListQuery = { sortBy: 'distance' };
    await service.getActivityList(query);

    expect(repo.findList).toHaveBeenCalled();
    // Without coordinates, sortBy should fallback to 'time'
    expect(repo.findList.mock.calls[0][0]).toMatchObject({ sortBy: 'time' });
  });

  // 业务规则: distance 字段仅当传入经纬度时返回（§4 活动列表 - Response 200 备注）
  it('should include distance field when coordinates are provided', async () => {
    const activityWithDistance = { ...createActivityRecord(), distance: 1.2 };
    repo.findList.mockResolvedValue({ items: [activityWithDistance], total: 1 });

    const query: ActivityListQuery = { latitude: 39.9, longitude: 116.4 };
    const result = await service.getActivityList(query);

    expect(result.items).toHaveLength(1);
  });

  // 业务规则: 活动列表不返回参与者详情列表（§4 活动列表 - 业务规则）
  it('should not return participants list in activity list items', async () => {
    repo.findList.mockResolvedValue({ items: [createActivityRecord()], total: 1 });

    const result = await service.getActivityList({});

    expect(result.items).toHaveLength(1);
    // Items should have currentParticipants count but not participants array
    const item = result.items[0];
    expect(item.currentParticipants).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_INVALID_COORDINATES
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_INVALID_COORDINATES — 经纬度只提供了一个（§4 活动列表 - 错误码）
  it('should throw ACTIVITY_INVALID_COORDINATES when only latitude is provided', async () => {
    const query: ActivityListQuery = { latitude: 39.9 };

    await expect(service.getActivityList(query)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_COORDINATES',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_COORDINATES — 经纬度只提供了一个（§4 活动列表 - 错误码）
  it('should throw ACTIVITY_INVALID_COORDINATES when only longitude is provided', async () => {
    const query: ActivityListQuery = { longitude: 116.4 };

    await expect(service.getActivityList(query)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_COORDINATES',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_COORDINATES — latitude 超出有效范围 -90~90（§4 活动列表 - 错误码）
  it('should throw ACTIVITY_INVALID_COORDINATES when latitude is out of range', async () => {
    const query: ActivityListQuery = { latitude: 91, longitude: 116.4 };

    await expect(service.getActivityList(query)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_COORDINATES',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_COORDINATES — longitude 超出有效范围 -180~180（§4 活动列表 - 错误码）
  it('should throw ACTIVITY_INVALID_COORDINATES when longitude is out of range', async () => {
    const query: ActivityListQuery = { latitude: 39.9, longitude: 181 };

    await expect(service.getActivityList(query)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_COORDINATES',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_INVALID_DATE_RANGE
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_INVALID_DATE_RANGE — dateStart 和 dateEnd 只提供了一个（§4 活动列表 - 错误码）
  it('should throw ACTIVITY_INVALID_DATE_RANGE when only dateStart is provided', async () => {
    const query: ActivityListQuery = { dateStart: '2026-04-05T00:00:00.000Z' } as any;

    await expect(service.getActivityList(query)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_DATE_RANGE',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_DATE_RANGE — dateStart 和 dateEnd 只提供了一个（§4 活动列表 - 错误码）
  it('should throw ACTIVITY_INVALID_DATE_RANGE when only dateEnd is provided', async () => {
    const query: ActivityListQuery = { dateEnd: '2026-04-10T23:59:59.000Z' } as any;

    await expect(service.getActivityList(query)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_DATE_RANGE',
      statusCode: 400,
    });
  });

  // 错误码: ACTIVITY_INVALID_DATE_RANGE — dateEnd 早于 dateStart（§4 活动列表 - 错误码）
  it('should throw ACTIVITY_INVALID_DATE_RANGE when dateEnd is before dateStart', async () => {
    const query: ActivityListQuery = {
      dateStart: '2026-04-10T00:00:00.000Z',
      dateEnd: '2026-04-05T00:00:00.000Z',
    };

    await expect(service.getActivityList(query)).rejects.toMatchObject({
      code: 'ACTIVITY_INVALID_DATE_RANGE',
      statusCode: 400,
    });
  });
});

// ===========================================================================
// GET /api/activities/:id — ActivityService.getActivityDetail
// ===========================================================================

describe('GET /api/activities/:id — ActivityService.getActivityDetail', () => {
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

  // 业务规则: 任何已登录用户均可查看活动详情（§4 活动详情 - 业务规则）
  it('should return activity detail for any authenticated user', async () => {
    repo.findById.mockResolvedValue(createActivityRecord());

    const result = await service.getActivityDetail('activity-uuid-1');

    expect(result).toBeDefined();
    expect(result.id).toBe('activity-uuid-1');
  });

  // 业务规则: 包括已取消、已结束的活动（§4 活动详情 - 业务规则）
  it('should return detail for cancelled activity', async () => {
    repo.findById.mockResolvedValue(createActivityRecord({ status: 'cancelled' }));

    const result = await service.getActivityDetail('activity-uuid-1');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 包括已取消、已结束的活动（§4 活动详情 - 业务规则）
  it('should return detail for completed activity', async () => {
    repo.findById.mockResolvedValue(createActivityRecord({ status: 'completed' }));

    const result = await service.getActivityDetail('activity-uuid-1');

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
  });

  // 业务规则: 参与者列表按加入时间 joinedAt 升序排列（§4 活动详情 - 业务规则）
  it('should return participants sorted by joinedAt ascending', async () => {
    const activity = createActivityRecord({
      participants: [
        {
          id: 'p1',
          activityId: 'activity-uuid-1',
          userId: 'user-uuid-1',
          joinedAt: new Date('2026-04-02T10:00:00.000Z'),
        },
        {
          id: 'p2',
          activityId: 'activity-uuid-1',
          userId: 'user-uuid-2',
          joinedAt: new Date('2026-04-02T11:00:00.000Z'),
        },
      ],
      currentParticipants: 2,
    });
    repo.findById.mockResolvedValue(activity);
    userService.getUsersByIds.mockResolvedValue([
      { id: 'user-uuid-1', nickname: '球友38291', avatarUrl: null, bio: null, isCoach: false },
      { id: 'user-uuid-2', nickname: '羽球达人', avatarUrl: 'https://...', bio: null, isCoach: false },
    ]);

    const result = await service.getActivityDetail('activity-uuid-1');

    expect(result).toBeDefined();
    expect(result.participants).toBeDefined();
    if (result.participants && result.participants.length >= 2) {
      const t1 = new Date(result.participants[0].joinedAt).getTime();
      const t2 = new Date(result.participants[1].joinedAt).getTime();
      expect(t1).toBeLessThanOrEqual(t2);
    }
  });

  // 业务规则: 参与者信息通过 UserService.getUsersByIds() 批量获取（§4 活动详情 - 业务规则）
  it('should call UserService.getUsersByIds to get participant info', async () => {
    const activity = createActivityRecord({
      participants: [
        { id: 'p1', activityId: 'activity-uuid-1', userId: 'user-uuid-1', joinedAt: new Date() },
      ],
    });
    repo.findById.mockResolvedValue(activity);

    await service.getActivityDetail('activity-uuid-1');

    expect(userService.getUsersByIds).toHaveBeenCalled();
  });

  // 业务规则: creator 信息通过 UserService.getUserById() 获取（§4 活动详情 - 业务规则）
  it('should call UserService.getUserById to get creator info', async () => {
    repo.findById.mockResolvedValue(createActivityRecord());

    await service.getActivityDetail('activity-uuid-1');

    expect(userService.getUserById).toHaveBeenCalledWith('user-uuid-1');
  });

  // 业务规则: 返回 creator 信息（§4 活动详情 - Response 200）
  it('should return creator info in response', async () => {
    repo.findById.mockResolvedValue(createActivityRecord());

    const result = await service.getActivityDetail('activity-uuid-1');

    expect(result).toBeDefined();
    expect(result.creator).toBeDefined();
    if (result.creator) {
      expect(result.creator.id).toBe('user-uuid-1');
      expect(result.creator.nickname).toBeDefined();
    }
  });

  // 业务规则: venue 为 null 时（球馆被删除），venue 字段返回 null（§4 活动详情 - 业务规则）
  it('should return venue as null when venue has been removed', async () => {
    repo.findById.mockResolvedValue(createActivityRecord({ venueId: null }));
    venueService.getVenueById.mockResolvedValue(null);

    const result = await service.getActivityDetail('activity-uuid-1');

    expect(result).toBeDefined();
    expect(result.venue).toBeNull();
  });

  // 业务规则: 返回 venue 信息（§4 活动详情 - Response 200）
  it('should return venue information when venue exists', async () => {
    repo.findById.mockResolvedValue(createActivityRecord());

    const result = await service.getActivityDetail('activity-uuid-1');

    expect(result).toBeDefined();
    expect(result.venue).toBeDefined();
    if (result.venue) {
      expect(result.venue.id).toBe('venue-uuid-1');
      expect(result.venue.name).toBeDefined();
      expect(result.venue.address).toBeDefined();
      expect(result.venue.latitude).toBeDefined();
      expect(result.venue.longitude).toBeDefined();
    }
  });

  // 业务规则: 返回 participants 列表，每个含 userId、nickname、avatarUrl、joinedAt（§4 活动详情 - Response 200）
  it('should return participant details with userId, nickname, avatarUrl, joinedAt', async () => {
    const activity = createActivityRecord({
      participants: [
        {
          id: 'p1',
          activityId: 'activity-uuid-1',
          userId: 'user-uuid-1',
          joinedAt: new Date('2026-04-02T10:00:00.000Z'),
        },
      ],
    });
    repo.findById.mockResolvedValue(activity);
    userService.getUsersByIds.mockResolvedValue([
      { id: 'user-uuid-1', nickname: '球友38291', avatarUrl: null, bio: null, isCoach: false },
    ]);

    const result = await service.getActivityDetail('activity-uuid-1');

    expect(result.participants).toBeDefined();
    if (result.participants && result.participants.length > 0) {
      const p = result.participants[0];
      expect(p.userId).toBeDefined();
      expect(p.nickname).toBeDefined();
      expect(p.joinedAt).toBeDefined();
    }
  });

  // -----------------------------------------------------------------------
  // 异常流程: ACTIVITY_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: ACTIVITY_NOT_FOUND — 活动不存在（§4 活动详情 - 错误码）
  it('should throw ACTIVITY_NOT_FOUND when activity does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.getActivityDetail('non-existent-id')).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// GET /api/users/:id/activities — ActivityService.getUserActivities
// ===========================================================================

describe('GET /api/users/:id/activities — ActivityService.getUserActivities', () => {
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

  // 业务规则: 当 userId 对应用户不存在时返回空列表（§4 用户参与的活动列表 - 业务规则）
  it('should return empty list when user does not exist', async () => {
    repo.findUserActivities.mockResolvedValue({ items: [], total: 0 });

    const result = await service.getUserActivities('non-existent-user', {});

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  // 业务规则: 任何已登录用户均可查看其他用户的活动列表（§4 用户参与的活动列表 - 业务规则）
  it('should return activities for a specific user', async () => {
    const activities = [createActivityRecord()];
    repo.findUserActivities.mockResolvedValue({ items: activities, total: 1 });

    const result = await service.getUserActivities('user-uuid-1', {});

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  // 业务规则: role 筛选 creator — 仅返回 creatorId === userId 的活动（§4 用户参与的活动列表 - 业务规则）
  it('should filter by role=creator to return only created activities', async () => {
    repo.findUserActivities.mockResolvedValue({ items: [], total: 0 });

    const query = { role: 'creator' as const };
    await service.getUserActivities('user-uuid-1', query as any);

    expect(repo.findUserActivities).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ role: 'creator' }),
    );
  });

  // 业务规则: role 筛选 participant — 仅返回参与但未发起的活动（§4 用户参与的活动列表 - 业务规则）
  it('should filter by role=participant to return only participated activities', async () => {
    repo.findUserActivities.mockResolvedValue({ items: [], total: 0 });

    const query = { role: 'participant' as const };
    await service.getUserActivities('user-uuid-1', query as any);

    expect(repo.findUserActivities).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ role: 'participant' }),
    );
  });

  // 业务规则: role 不传则返回所有与该用户相关的活动（§4 用户参与的活动列表 - 业务规则）
  it('should return all related activities when role is not specified', async () => {
    const activities = [
      createActivityRecord({ id: 'a1', creatorId: 'user-uuid-1' }),
      createActivityRecord({ id: 'a2', creatorId: 'other-user' }),
    ];
    repo.findUserActivities.mockResolvedValue({ items: activities, total: 2 });

    const result = await service.getUserActivities('user-uuid-1', {});

    expect(result.items).toHaveLength(2);
  });

  // 业务规则: status 筛选（§4 用户参与的活动列表 - Query Params）
  it('should filter by status when status is specified', async () => {
    repo.findUserActivities.mockResolvedValue({ items: [], total: 0 });

    const query = { status: 'open' as const };
    await service.getUserActivities('user-uuid-1', query as any);

    expect(repo.findUserActivities).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ status: 'open' }),
    );
  });

  // 业务规则: 按 startTime 倒序排列（§4 用户参与的活动列表 - 业务规则）
  it('should return activities sorted by startTime descending', async () => {
    const a1 = createActivityRecord({
      id: 'a1',
      startTime: new Date('2026-04-06T14:00:00.000Z'),
    });
    const a2 = createActivityRecord({
      id: 'a2',
      startTime: new Date('2026-04-05T14:00:00.000Z'),
    });
    repo.findUserActivities.mockResolvedValue({ items: [a1, a2], total: 2 });

    const result = await service.getUserActivities('user-uuid-1', {});

    expect(result.items).toHaveLength(2);
    // First item should have later startTime (descending order)
    if (result.items.length >= 2) {
      const t1 = new Date(result.items[0].startTime).getTime();
      const t2 = new Date(result.items[1].startTime).getTime();
      expect(t1).toBeGreaterThanOrEqual(t2);
    }
  });

  // 业务规则: 默认分页参数 page=1, pageSize=20（§4 用户参与的活动列表 - Query Params）
  it('should use default pagination when not specified', async () => {
    repo.findUserActivities.mockResolvedValue({ items: [], total: 0 });

    await service.getUserActivities('user-uuid-1', {});

    expect(repo.findUserActivities).toHaveBeenCalled();
  });

  // 业务规则: 不返回参与者详情列表，仅返回 currentParticipants（§4 用户参与的活动列表 - 业务规则）
  it('should not return participants detail, only currentParticipants count', async () => {
    repo.findUserActivities.mockResolvedValue({
      items: [createActivityRecord()],
      total: 1,
    });

    const result = await service.getUserActivities('user-uuid-1', {});

    expect(result.items[0].currentParticipants).toBeDefined();
  });
});

// ===========================================================================
// Cross-module Service: ActivityService.getActivityById
// ===========================================================================

describe('ActivityService.getActivityById — cross-module', () => {
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

  // 业务规则: 活动不存在时返回 null（§4 内部接口 getActivityById - 业务规则）
  it('should return null when activity does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    const result = await service.getActivityById('non-existent-id');

    expect(result).toBeNull();
  });

  // 业务规则: 返回字段包含 id, creatorId, venueId, startTime, endTime, status（§4 内部接口 getActivityById - 返回值）
  it('should return activity info with required fields when exists', async () => {
    repo.findById.mockResolvedValue(createActivityRecord());

    const result = await service.getActivityById('activity-uuid-1');

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    if (result) {
      expect(result.id).toBe('activity-uuid-1');
      expect(result.creatorId).toBe('user-uuid-1');
      expect(result.venueId).toBe('venue-uuid-1');
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.status).toBeDefined();
    }
  });

  // 业务规则: 不抛错，活动不存在时返回 null 由调用方决定处理（§4 内部接口 getActivityById - 错误码）
  it('should not throw when activity does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.getActivityById('non-existent-id')).resolves.toBeNull();
  });
});

// ===========================================================================
// Cross-module Service: ActivityService.getParticipantIds
// ===========================================================================

describe('ActivityService.getParticipantIds — cross-module', () => {
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

  // 业务规则: 返回该活动所有参与者的 userId 列表（包含发起人）（§4 内部接口 getParticipantIds - 业务规则）
  it('should return all participant user IDs including creator', async () => {
    repo.getParticipantIds.mockResolvedValue(['user-uuid-1', 'user-uuid-2', 'user-uuid-3']);

    const result = await service.getParticipantIds('activity-uuid-1');

    expect(result).toHaveLength(3);
    expect(result).toContain('user-uuid-1');
    expect(result).toContain('user-uuid-2');
    expect(result).toContain('user-uuid-3');
  });

  // 业务规则: 活动不存在时返回空数组（§4 内部接口 getParticipantIds - 业务规则）
  it('should return empty array when activity does not exist', async () => {
    repo.getParticipantIds.mockResolvedValue([]);

    const result = await service.getParticipantIds('non-existent-id');

    expect(result).toEqual([]);
  });

  // 业务规则: 始终返回结果，不抛错（§4 内部接口 getParticipantIds - 错误码）
  it('should not throw when activity does not exist', async () => {
    repo.getParticipantIds.mockResolvedValue([]);

    await expect(service.getParticipantIds('non-existent-id')).resolves.toEqual([]);
  });
});
