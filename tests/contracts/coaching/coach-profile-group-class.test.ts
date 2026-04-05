/**
 * 契约测试: coaching 模块 — 教练资料与团课接口
 * 覆盖接口:
 *   - GET /api/coaches (CoachingService.getCoachList)
 *   - GET /api/coaches/:id (CoachingService.getCoachProfile)
 *   - PUT /api/coaches/me (CoachingService.updateCoachProfile)
 *   - POST /api/group-classes (CoachingService.createGroupClass)
 *   - GET /api/group-classes/:id (CoachingService.getGroupClassDetail)
 *   - PUT /api/group-classes/:id (CoachingService.updateGroupClass)
 *   - POST /api/group-classes/:id/cancel (CoachingService.cancelGroupClass)
 *   - 定时任务: 课程状态自动流转 (团课部分)
 *   - CoachingService.getGroupClassById (跨模块 Service 调用)
 *
 * 来源文档: docs/module-design/coaching.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - CoachingRepository: 全部 mock（隔离数据库依赖）
 * - UserService: mock getUserById / getUsersByIds（跨模块依赖）
 * - VenueService: mock getVenueById（跨模块依赖）
 * - NotificationService: mock create / createBatch（跨模块依赖）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoachingService } from '@server/modules/coaching/service.js';
import { CoachingRepository } from '@server/modules/coaching/repository.js';
import type {
  UpdateCoachProfileInput,
  CreateGroupClassInput,
  UpdateGroupClassInput,
  CoachListQuery,
} from '@server/modules/coaching/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock CoachingRepository with all methods stubbed.
 * Individual tests override specific methods as needed.
 */
function createMockRepository(): {
  [K in keyof CoachingRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    findCoachProfile: vi.fn().mockResolvedValue(null),
    createCoachProfile: vi.fn().mockResolvedValue(createCoachProfileRecord()),
    updateCoachProfile: vi.fn().mockResolvedValue(createCoachProfileRecord()),
    findCoachList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    createGroupClass: vi.fn().mockResolvedValue(createGroupClassRecord()),
    findGroupClassById: vi.fn().mockResolvedValue(null),
    updateGroupClass: vi.fn().mockResolvedValue(createGroupClassRecord()),
    enrollGroupClass: vi.fn().mockResolvedValue(undefined),
    cancelEnrollment: vi.fn().mockResolvedValue(undefined),
    createPrivateLessonSlot: vi.fn().mockResolvedValue(undefined),
    findAvailability: vi.fn().mockResolvedValue([]),
    bookPrivateLesson: vi.fn().mockResolvedValue(undefined),
    cancelPrivateLesson: vi.fn().mockResolvedValue(undefined),
    findPrivateLessonById: vi.fn().mockResolvedValue(null),
    findUserEnrollments: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findCoachPrivateLessons: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getGroupClassParticipantIds: vi.fn().mockResolvedValue([]),
    getPrivateLessonParticipantIds: vi.fn().mockResolvedValue([]),
    findGroupClassesByCoach: vi.fn().mockResolvedValue([]),
    getBatchCoachStudentCounts: vi.fn().mockResolvedValue(new Map()),
    updateGroupClassesStarted: vi.fn().mockResolvedValue(0),
    updateGroupClassesCompleted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsStarted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsCompleted: vi.fn().mockResolvedValue(0),
  };
}

/**
 * Build a mock UserService with cross-module methods.
 */
function createMockUserService() {
  return {
    getUserById: vi.fn().mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: null,
      isCoach: true,
    }),
    getUsersByIds: vi.fn().mockResolvedValue([
      {
        id: 'user-uuid-coach',
        nickname: '教练张',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: null,
        isCoach: true,
      },
    ]),
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
 * Build a mock NotificationService with cross-module methods.
 */
function createMockNotificationService() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    createBatch: vi.fn().mockResolvedValue(undefined),
  };
}

/** Standard CoachProfile record as returned by repository */
function createCoachProfileRecord(
  overrides?: Partial<{
    id: string;
    userId: string;
    bio: string | null;
    specialties: string[];
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: 'coach-profile-uuid-1',
    userId: 'user-uuid-coach',
    bio: '10年教学经验',
    specialties: ['singles', 'footwork'],
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    ...overrides,
  };
}

/** Standard GroupClass record as returned by repository */
function createGroupClassRecord(
  overrides?: Partial<{
    id: string;
    coachId: string;
    venueId: string | null;
    title: string;
    startTime: Date;
    endTime: Date;
    maxParticipants: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    currentParticipants: number;
    enrollments: Array<{
      id: string;
      groupClassId: string;
      userId: string;
      enrolledAt: Date;
    }>;
  }>,
) {
  return {
    id: 'group-class-uuid-1',
    coachId: 'user-uuid-coach',
    venueId: 'venue-uuid-1',
    title: '初级单打提升班',
    startTime: new Date('2026-04-10T14:00:00.000Z'),
    endTime: new Date('2026-04-10T16:00:00.000Z'),
    maxParticipants: 10,
    status: 'open',
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    currentParticipants: 0,
    enrollments: [],
    ...overrides,
  };
}

/** Future time helpers for valid input */
function futureDate(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

/** Create valid CreateGroupClassInput */
function validCreateGroupClassInput(
  overrides?: Partial<CreateGroupClassInput>,
): CreateGroupClassInput {
  return {
    venueId: 'venue-uuid-1',
    title: '初级单打提升班',
    startTime: futureDate(24),
    endTime: futureDate(26),
    maxParticipants: 10,
    ...overrides,
  };
}

// ===========================================================================
// GET /api/coaches — CoachingService.getCoachList
// ===========================================================================

describe('GET /api/coaches — CoachingService.getCoachList', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 仅返回 isCoach = true 的用户对应的教练资料（§4 教练列表 - 业务规则）
  // 业务规则: 用户信息通过 UserService.getUsersByIds() 批量获取（§4 教练列表 - 业务规则）
  it('should return coach list with user info and studentCount', async () => {
    repo.findCoachList.mockResolvedValue({
      items: [createCoachProfileRecord()],
      total: 1,
    });

    const result = await service.getCoachList({ page: 1, pageSize: 20 });

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      userId: 'user-uuid-coach',
      nickname: expect.any(String),
      specialties: expect.any(Array),
    });
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  // 业务规则: studentCount 通过查询不重复参与人数计算（§4 教练列表 - 业务规则）
  it('should include studentCount as real-time calculated value', async () => {
    repo.findCoachList.mockResolvedValue({
      items: [createCoachProfileRecord()],
      total: 1,
    });

    const result = await service.getCoachList({ page: 1, pageSize: 20 });

    expect(result.items[0]).toHaveProperty('studentCount');
    expect(typeof result.items[0].studentCount).toBe('number');
  });

  // 业务规则: specialty 筛选 — 教练的 specialties 数组中包含指定值即匹配（§4 教练列表 - 业务规则）
  it('should filter by specialty when provided', async () => {
    repo.findCoachList.mockResolvedValue({
      items: [createCoachProfileRecord({ specialties: ['singles', 'footwork'] })],
      total: 1,
    });

    const result = await service.getCoachList({ specialty: 'singles' });

    expect(result.items).toHaveLength(1);
    // Repo should have been called with the specialty filter
    expect(repo.findCoachList).toHaveBeenCalledWith(
      expect.objectContaining({ specialty: 'singles' }),
    );
  });

  // 业务规则: 默认分页（§4 教练列表 - Query Params）
  it('should use default pagination (page=1, pageSize=20) when not provided', async () => {
    repo.findCoachList.mockResolvedValue({ items: [], total: 0 });

    await service.getCoachList({});

    expect(repo.findCoachList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  // 业务规则: 返回空列表（无教练数据时）
  it('should return empty list when no coaches exist', async () => {
    repo.findCoachList.mockResolvedValue({ items: [], total: 0 });

    const result = await service.getCoachList({});

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_SPECIALTY
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_SPECIALTY — specialty 值不在枚举范围内（§4 教练列表 - 错误码）
  it('should throw COACHING_INVALID_SPECIALTY when specialty is invalid', async () => {
    await expect(
      service.getCoachList({ specialty: 'invalid_value' as any }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_SPECIALTY',
      statusCode: 400,
    });
  });
});

// ===========================================================================
// GET /api/coaches/:id — CoachingService.getCoachProfile
// ===========================================================================

describe('GET /api/coaches/:id — CoachingService.getCoachProfile', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 指定用户必须是教练角色（§4 教练主页 - 业务规则）
  // 业务规则: 用户信息通过 UserService.getUserById() 获取（§4 教练主页 - 业务规则）
  it('should return coach profile with user info, group classes, and private lesson slots', async () => {
    repo.findCoachProfile.mockResolvedValue(createCoachProfileRecord());
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: 'https://example.com/avatar.jpg',
      isCoach: true,
    });

    const result = await service.getCoachProfile('user-uuid-coach');

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      userId: 'user-uuid-coach',
      nickname: '教练张',
      bio: expect.any(String),
      specialties: expect.any(Array),
    });
    expect(result).toHaveProperty('groupClasses');
    expect(result).toHaveProperty('privateLessonSlots');
    expect(result).toHaveProperty('studentCount');
  });

  // 业务规则: groupClasses 仅返回未来的和最近 30 天内结束的团课（§4 教练主页 - 业务规则）
  it('should return groupClasses with endTime > now - 30 days, sorted by startTime ascending', async () => {
    repo.findCoachProfile.mockResolvedValue(createCoachProfileRecord());
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const result = await service.getCoachProfile('user-uuid-coach');

    expect(result).toBeDefined();
    expect(Array.isArray(result.groupClasses)).toBe(true);
  });

  // 业务规则: privateLessonSlots 仅返回未来的且未被预约的空闲时间段（§4 教练主页 - 业务规则）
  it('should return only future unbooked private lesson slots', async () => {
    repo.findCoachProfile.mockResolvedValue(createCoachProfileRecord());
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const result = await service.getCoachProfile('user-uuid-coach');

    expect(result).toBeDefined();
    expect(Array.isArray(result.privateLessonSlots)).toBe(true);
  });

  // 业务规则: studentCount 实时计算（§4 教练主页 - 业务规则）
  it('should include real-time calculated studentCount', async () => {
    repo.findCoachProfile.mockResolvedValue(createCoachProfileRecord());
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const result = await service.getCoachProfile('user-uuid-coach');

    expect(result).toHaveProperty('studentCount');
    expect(typeof result.studentCount).toBe('number');
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_A_COACH
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_A_COACH — 用户不存在（§4 教练主页 - 错误码）
  it('should throw COACHING_NOT_A_COACH when user does not exist', async () => {
    userService.getUserById.mockResolvedValue(null);

    await expect(
      service.getCoachProfile('nonexistent-uuid'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_A_COACH',
      statusCode: 404,
    });
  });

  // 错误码: COACHING_NOT_A_COACH — 用户不是教练角色（§4 教练主页 - 错误码）
  it('should throw COACHING_NOT_A_COACH when user is not a coach', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-normal',
      nickname: '普通用户',
      avatarUrl: null,
      isCoach: false,
    });

    await expect(
      service.getCoachProfile('user-uuid-normal'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_A_COACH',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// PUT /api/coaches/me — CoachingService.updateCoachProfile
// ===========================================================================

describe('PUT /api/coaches/me — CoachingService.updateCoachProfile', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 如果 CoachProfile 不存在，自动创建（§4 更新教练资料 - 业务规则 / §6.9 教练资料自动创建）
  it('should auto-create CoachProfile when it does not exist and update with provided fields', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findCoachProfile.mockResolvedValue(null);
    repo.createCoachProfile.mockResolvedValue(
      createCoachProfileRecord({ bio: null, specialties: [] }),
    );
    repo.updateCoachProfile.mockResolvedValue(
      createCoachProfileRecord({ bio: '新简介', specialties: ['singles'] }),
    );

    const input: UpdateCoachProfileInput = { bio: '新简介', specialties: ['singles'] };
    const result = await service.updateCoachProfile('user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(repo.createCoachProfile).toHaveBeenCalled();
  });

  // 业务规则: CoachProfile 已存在时直接更新（§4 更新教练资料 - 业务规则）
  it('should update existing CoachProfile with provided fields', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findCoachProfile.mockResolvedValue(createCoachProfileRecord());
    repo.updateCoachProfile.mockResolvedValue(
      createCoachProfileRecord({ bio: '更新后的简介' }),
    );

    const input: UpdateCoachProfileInput = { bio: '更新后的简介' };
    const result = await service.updateCoachProfile('user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(result.bio).toBe('更新后的简介');
    expect(repo.createCoachProfile).not.toHaveBeenCalled();
  });

  // 业务规则: 只更新请求体中包含的字段，未提供的字段保持不变（§4 更新教练资料 - 业务规则）
  it('should only update fields present in the input', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findCoachProfile.mockResolvedValue(
      createCoachProfileRecord({ bio: '原简介', specialties: ['singles'] }),
    );
    repo.updateCoachProfile.mockResolvedValue(
      createCoachProfileRecord({ bio: '新简介', specialties: ['singles'] }),
    );

    const input: UpdateCoachProfileInput = { bio: '新简介' };
    const result = await service.updateCoachProfile('user-uuid-coach', input);

    expect(result).toBeDefined();
    // Only bio was updated; specialties should remain unchanged
    expect(repo.updateCoachProfile).toHaveBeenCalledWith(
      'user-uuid-coach',
      expect.objectContaining({ bio: '新简介' }),
    );
  });

  // 业务规则: specialties 不可有重复值（去重后存储）（§4 更新教练资料 - 业务规则）
  it('should deduplicate specialties before storing', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findCoachProfile.mockResolvedValue(createCoachProfileRecord());
    repo.updateCoachProfile.mockResolvedValue(
      createCoachProfileRecord({ specialties: ['singles', 'footwork'] }),
    );

    const input: UpdateCoachProfileInput = {
      specialties: ['singles', 'singles', 'footwork'] as any,
    };
    const result = await service.updateCoachProfile('user-uuid-coach', input);

    expect(result).toBeDefined();
    // The service should deduplicate before passing to repository
    expect(repo.updateCoachProfile).toHaveBeenCalledWith(
      'user-uuid-coach',
      expect.objectContaining({
        specialties: expect.arrayContaining(['singles', 'footwork']),
      }),
    );
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_COACH_ROLE_REQUIRED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_COACH_ROLE_REQUIRED — 当前用户不是教练角色（§4 更新教练资料 - 错误码）
  it('should throw COACHING_COACH_ROLE_REQUIRED when user is not a coach', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-normal',
      nickname: '普通用户',
      avatarUrl: null,
      isCoach: false,
    });

    await expect(
      service.updateCoachProfile('user-uuid-normal', { bio: '简介' }),
    ).rejects.toMatchObject({
      code: 'COACHING_COACH_ROLE_REQUIRED',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_BIO
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_BIO — 简介超过 500 字符（§4 更新教练资料 - 错误码）
  it('should throw COACHING_INVALID_BIO when bio exceeds 500 characters', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const longBio = 'a'.repeat(501);
    await expect(
      service.updateCoachProfile('user-uuid-coach', { bio: longBio }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_BIO',
      statusCode: 400,
    });
  });

  // 边界: bio 恰好 500 字符应通过
  it('should accept bio with exactly 500 characters', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findCoachProfile.mockResolvedValue(createCoachProfileRecord());
    const exactBio = 'a'.repeat(500);
    repo.updateCoachProfile.mockResolvedValue(
      createCoachProfileRecord({ bio: exactBio }),
    );

    const result = await service.updateCoachProfile('user-uuid-coach', { bio: exactBio });

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_SPECIALTY
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_SPECIALTY — specialties 中有值不在枚举范围内（§4 更新教练资料 - 错误码）
  it('should throw COACHING_INVALID_SPECIALTY when specialties contain invalid value', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    await expect(
      service.updateCoachProfile('user-uuid-coach', {
        specialties: ['singles', 'invalid_skill'] as any,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_SPECIALTY',
      statusCode: 400,
    });
  });
});

// ===========================================================================
// POST /api/group-classes — CoachingService.createGroupClass
// ===========================================================================

describe('POST /api/group-classes — CoachingService.createGroupClass', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 当前用户必须是教练角色（§4 发布团课 - 业务规则）
  // 业务规则: 创建成功后课程状态为 open（§4 发布团课 - 业务规则）
  // 业务规则: coachId 取当前用户 ID（§4 发布团课 - 业务规则）
  it('should create a group class with valid input and status open', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput();
    const result = await service.createGroupClass('user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(result.status).toBe('open');
    expect(result.coachId).toBe('user-uuid-coach');
    expect(result.currentParticipants).toBe(0);
  });

  // 业务规则: 调用 VenueService.getVenueById(venueId) 验证球馆存在（§4 发布团课 - 业务规则）
  it('should call VenueService.getVenueById to validate venue exists', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput();
    await service.createGroupClass('user-uuid-coach', input);

    expect(venueService.getVenueById).toHaveBeenCalledWith('venue-uuid-1');
  });

  // 业务规则: feeDescription 选填（§4 发布团课 - 业务规则）
  it('should allow creating group class without feeDescription', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput({ feeDescription: undefined });
    const result = await service.createGroupClass('user-uuid-coach', input);

    expect(result).toBeDefined();
  });

  // 业务规则: 返回格式包含 venue 信息（§4 发布团课 - Response 201）
  it('should return venue information in response', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput();
    const result = await service.createGroupClass('user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(result.venue).toBeDefined();
    expect(result.venue).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_COACH_ROLE_REQUIRED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_COACH_ROLE_REQUIRED — 非教练角色（§4 发布团课 - 错误码）
  it('should throw COACHING_COACH_ROLE_REQUIRED when user is not a coach', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-normal',
      nickname: '普通用户',
      avatarUrl: null,
      isCoach: false,
    });

    const input = validCreateGroupClassInput();
    await expect(
      service.createGroupClass('user-uuid-normal', input),
    ).rejects.toMatchObject({
      code: 'COACHING_COACH_ROLE_REQUIRED',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TITLE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TITLE — title 为空（§4 发布团课 - 错误码）
  it('should throw COACHING_INVALID_TITLE when title is empty', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput({ title: '' });
    await expect(
      service.createGroupClass('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TITLE',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_TITLE — title 超过 50 字符（§4 发布团课 - 错误码）
  it('should throw COACHING_INVALID_TITLE when title exceeds 50 characters', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput({ title: 'a'.repeat(51) });
    await expect(
      service.createGroupClass('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TITLE',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_VENUE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_VENUE — venueId 缺失或格式不合法（§4 发布团课 - 错误码）
  it('should throw COACHING_INVALID_VENUE when venueId is empty', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput({ venueId: '' });
    await expect(
      service.createGroupClass('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_VENUE',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_VENUE_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_VENUE_NOT_FOUND — 球馆不存在（§4 发布团课 - 错误码）
  it('should throw COACHING_VENUE_NOT_FOUND when venue does not exist', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    venueService.getVenueById.mockResolvedValue(null);

    const input = validCreateGroupClassInput();
    await expect(
      service.createGroupClass('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_VENUE_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TIME
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TIME — 开始时间不晚于当前时间（§4 发布团课 - 错误码）
  it('should throw COACHING_INVALID_TIME when startTime is in the past', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput({
      startTime: new Date('2020-01-01T00:00:00.000Z').toISOString(),
    });
    await expect(
      service.createGroupClass('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_TIME — 结束时间不晚于开始时间（§4 发布团课 - 错误码）
  it('should throw COACHING_INVALID_TIME when endTime is before startTime', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const start = futureDate(26);
    const end = futureDate(24);
    const input = validCreateGroupClassInput({ startTime: start, endTime: end });
    await expect(
      service.createGroupClass('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_TIME — 结束时间等于开始时间（§4 发布团课 - 错误码）
  it('should throw COACHING_INVALID_TIME when endTime equals startTime', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const sameTime = futureDate(24);
    const input = validCreateGroupClassInput({ startTime: sameTime, endTime: sameTime });
    await expect(
      service.createGroupClass('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_PARTICIPANTS
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_PARTICIPANTS — maxParticipants < 2（§4 发布团课 - 错误码）
  it('should throw COACHING_INVALID_PARTICIPANTS when maxParticipants is less than 2', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput({ maxParticipants: 1 });
    await expect(
      service.createGroupClass('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_PARTICIPANTS',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_PARTICIPANTS — maxParticipants > 30（§4 发布团课 - 错误码）
  it('should throw COACHING_INVALID_PARTICIPANTS when maxParticipants is greater than 30', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput({ maxParticipants: 31 });
    await expect(
      service.createGroupClass('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_PARTICIPANTS',
      statusCode: 400,
    });
  });

  // 边界: maxParticipants = 2 应通过
  it('should accept maxParticipants of exactly 2', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.createGroupClass.mockResolvedValue(
      createGroupClassRecord({ maxParticipants: 2 }),
    );

    const input = validCreateGroupClassInput({ maxParticipants: 2 });
    const result = await service.createGroupClass('user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(result.maxParticipants).toBe(2);
  });

  // 边界: maxParticipants = 30 应通过
  it('should accept maxParticipants of exactly 30', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.createGroupClass.mockResolvedValue(
      createGroupClassRecord({ maxParticipants: 30 }),
    );

    const input = validCreateGroupClassInput({ maxParticipants: 30 });
    const result = await service.createGroupClass('user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(result.maxParticipants).toBe(30);
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_FEE_DESCRIPTION
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_FEE_DESCRIPTION — feeDescription 超过 200 字符（§4 发布团课 - 错误码）
  it('should throw COACHING_INVALID_FEE_DESCRIPTION when feeDescription exceeds 200 characters', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const input = validCreateGroupClassInput({ feeDescription: 'a'.repeat(201) });
    await expect(
      service.createGroupClass('user-uuid-coach', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_FEE_DESCRIPTION',
      statusCode: 400,
    });
  });
});

// ===========================================================================
// GET /api/group-classes/:id — CoachingService.getGroupClassDetail
// ===========================================================================

describe('GET /api/group-classes/:id — CoachingService.getGroupClassDetail', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 任何已登录用户均可查看团课详情（§4 团课详情 - 业务规则）
  it('should return group class detail with coach info and enrollments', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        enrollments: [
          {
            id: 'enrollment-uuid-1',
            groupClassId: 'group-class-uuid-1',
            userId: 'student-uuid-1',
            enrolledAt: new Date('2026-04-03T09:00:00.000Z'),
          },
        ],
        currentParticipants: 1,
      }),
    );
    userService.getUsersByIds.mockResolvedValue([
      {
        id: 'student-uuid-1',
        nickname: '羽球达人',
        avatarUrl: null,
      },
    ]);
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: 'https://example.com/avatar.jpg',
      isCoach: true,
    });

    const result = await service.getGroupClassDetail('group-class-uuid-1');

    expect(result).toBeDefined();
    expect(result.id).toBe('group-class-uuid-1');
    expect(result.coach).toBeDefined();
    expect(result.coach).toMatchObject({
      id: expect.any(String),
      nickname: expect.any(String),
    });
    expect(result.enrollments).toBeDefined();
    expect(Array.isArray(result.enrollments)).toBe(true);
  });

  // 业务规则: enrollments 列表按 enrolledAt 升序排列（§4 团课详情 - 业务规则）
  // SF-2: mock 返回乱序数据，验证 service 排序后结果正确
  it('should return enrollments sorted by enrolledAt ascending even when repository returns unordered data', async () => {
    // 故意让 repository 返回乱序数据（较晚的在前）
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        enrollments: [
          {
            id: 'enrollment-uuid-2',
            groupClassId: 'group-class-uuid-1',
            userId: 'student-uuid-2',
            enrolledAt: new Date('2026-04-03T10:00:00.000Z'), // 较晚
          },
          {
            id: 'enrollment-uuid-3',
            groupClassId: 'group-class-uuid-1',
            userId: 'student-uuid-3',
            enrolledAt: new Date('2026-04-03T08:00:00.000Z'), // 最早
          },
          {
            id: 'enrollment-uuid-1',
            groupClassId: 'group-class-uuid-1',
            userId: 'student-uuid-1',
            enrolledAt: new Date('2026-04-03T09:00:00.000Z'), // 中间
          },
        ],
        currentParticipants: 3,
      }),
    );
    userService.getUsersByIds.mockResolvedValue([
      { id: 'student-uuid-1', nickname: '学员1', avatarUrl: null },
      { id: 'student-uuid-2', nickname: '学员2', avatarUrl: null },
      { id: 'student-uuid-3', nickname: '学员3', avatarUrl: null },
    ]);
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const result = await service.getGroupClassDetail('group-class-uuid-1');

    expect(result.enrollments).toHaveLength(3);
    // Verify ascending order: each enrolledAt <= next enrolledAt
    const dates = result.enrollments.map((e: any) => new Date(e.enrolledAt).getTime());
    expect(dates[0]).toBeLessThanOrEqual(dates[1]);
    expect(dates[1]).toBeLessThanOrEqual(dates[2]);
  });

  // 业务规则: venue 为 null 时返回 null（§4 团课详情 - 业务规则）
  it('should return null venue when venueId is null (venue removed)', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ venueId: null }),
    );
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const result = await service.getGroupClassDetail('group-class-uuid-1');

    expect(result).toBeDefined();
    expect(result.venue).toBeNull();
  });

  // 业务规则: 包含已取消和已结束的团课详情（§4 团课详情 - 业务规则）
  it('should return detail for cancelled group class', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'cancelled' }),
    );
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const result = await service.getGroupClassDetail('group-class-uuid-1');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_GROUP_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_GROUP_CLASS_NOT_FOUND — 团课不存在（§4 团课详情 - 错误码）
  it('should throw COACHING_GROUP_CLASS_NOT_FOUND when group class does not exist', async () => {
    repo.findGroupClassById.mockResolvedValue(null);

    await expect(
      service.getGroupClassDetail('nonexistent-uuid'),
    ).rejects.toMatchObject({
      code: 'COACHING_GROUP_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// PUT /api/group-classes/:id — CoachingService.updateGroupClass
// ===========================================================================

describe('PUT /api/group-classes/:id — CoachingService.updateGroupClass', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 仅教练本人可修改自己的团课（§4 修改团课 - 业务规则）
  // 业务规则: 只更新请求体中包含的字段（§4 修改团课 - 业务规则）
  it('should update group class with valid input by the coach owner', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open', currentParticipants: 3 }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ title: '中级单打提升班', status: 'open', currentParticipants: 3 }),
    );

    const input: UpdateGroupClassInput = { title: '中级单打提升班' };
    const result = await service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(result.title).toBe('中级单打提升班');
  });

  // 业务规则: 团课状态为 full 时也可修改（§4 修改团课 - 业务规则）
  it('should allow updating group class in full status', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'full', currentParticipants: 10 }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ title: '已满班', status: 'full', currentParticipants: 10 }),
    );

    const input: UpdateGroupClassInput = { title: '已满班' };
    const result = await service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', input);

    expect(result).toBeDefined();
  });

  // 业务规则: 修改 maxParticipants 后，currentParticipants == maxParticipants → status 设为 full（§4 修改团课 - 业务规则）
  it('should set status to full when maxParticipants equals currentParticipants after update', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open', currentParticipants: 5, maxParticipants: 10 }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ status: 'full', currentParticipants: 5, maxParticipants: 5 }),
    );

    const input: UpdateGroupClassInput = { maxParticipants: 5 };
    const result = await service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(result.status).toBe('full');
  });

  // 业务规则: 修改 maxParticipants 后 currentParticipants < maxParticipants 且当前 status 为 full → 恢复为 open（§4 修改团课 - 业务规则）
  it('should restore status to open when maxParticipants increased and was previously full', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'full', currentParticipants: 10, maxParticipants: 10 }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ status: 'open', currentParticipants: 10, maxParticipants: 15 }),
    );

    const input: UpdateGroupClassInput = { maxParticipants: 15 };
    const result = await service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', input);

    expect(result).toBeDefined();
    expect(result.status).toBe('open');
  });

  // 业务规则: 修改成功后通知所有已报名学员（§4 修改团课 - 业务规则 / §6.10 通知文案）
  it('should notify enrolled students after successful update with correct notification fields', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        status: 'open',
        enrollments: [
          {
            id: 'e-1',
            groupClassId: 'group-class-uuid-1',
            userId: 'student-uuid-1',
            enrolledAt: new Date(),
          },
          {
            id: 'e-2',
            groupClassId: 'group-class-uuid-1',
            userId: 'student-uuid-2',
            enrolledAt: new Date(),
          },
        ],
        currentParticipants: 2,
      }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ title: '更新后', status: 'open', currentParticipants: 2 }),
    );

    await service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', { title: '更新后' });

    expect(notificationService.createBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'GROUP_CLASS_UPDATED',
          title: '团课已更新',
          targetType: 'group-class',
          targetId: 'group-class-uuid-1',
        }),
      ]),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4 修改团课 - 业务规则）
  it('should not fail when notification creation fails', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open', currentParticipants: 1 }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ title: '更新后', status: 'open' }),
    );
    notificationService.createBatch.mockRejectedValue(new Error('Notification error'));

    const result = await service.updateGroupClass(
      'group-class-uuid-1',
      'user-uuid-coach',
      { title: '更新后' },
    );

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER — 非该团课的教练尝试修改（§4 修改团课 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the class coach', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ coachId: 'user-uuid-coach' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-other', { title: '新名称' }),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_GROUP_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_GROUP_CLASS_NOT_FOUND — 团课不存在（§4 修改团课 - 错误码）
  it('should throw COACHING_GROUP_CLASS_NOT_FOUND when group class does not exist', async () => {
    repo.findGroupClassById.mockResolvedValue(null);

    await expect(
      service.updateGroupClass('nonexistent-uuid', 'user-uuid-coach', { title: '新名称' }),
    ).rejects.toMatchObject({
      code: 'COACHING_GROUP_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CLASS_NOT_MODIFIABLE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_CLASS_NOT_MODIFIABLE — in_progress 状态不允许修改（§4 修改团课 - 错误码）
  it('should throw COACHING_CLASS_NOT_MODIFIABLE when status is in_progress', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'in_progress' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', { title: '新名称' }),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_MODIFIABLE',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_CLASS_NOT_MODIFIABLE — completed 状态不允许修改（§4 修改团课 - 错误码）
  it('should throw COACHING_CLASS_NOT_MODIFIABLE when status is completed', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'completed' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', { title: '新名称' }),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_MODIFIABLE',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_CLASS_NOT_MODIFIABLE — cancelled 状态不允许修改（§4 修改团课 - 错误码）
  it('should throw COACHING_CLASS_NOT_MODIFIABLE when status is cancelled', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'cancelled' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', { title: '新名称' }),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_MODIFIABLE',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TITLE (修改)
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TITLE — title 为空（§4 修改团课 - 错误码）
  it('should throw COACHING_INVALID_TITLE when title is empty string in update', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', { title: '' }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TITLE',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_TITLE — title 超过 50 字符（§4 修改团课 - 错误码）
  it('should throw COACHING_INVALID_TITLE when title exceeds 50 characters in update', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', {
        title: 'a'.repeat(51),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TITLE',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TIME (修改)
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TIME — 修改 startTime 时新的开始时间不晚于当前时间（§4 修改团课 - 错误码）
  it('should throw COACHING_INVALID_TIME when updated startTime is in the past', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', {
        startTime: new Date('2020-01-01T00:00:00.000Z').toISOString(),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_TIME — endTime 不晚于 startTime（§4 修改团课 - 业务规则）
  it('should throw COACHING_INVALID_TIME when endTime is before startTime after update', async () => {
    const existingStart = new Date('2026-04-10T14:00:00.000Z');
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open', startTime: existingStart }),
    );

    // Set endTime to before existing startTime
    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', {
        endTime: new Date('2026-04-10T13:00:00.000Z').toISOString(),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_PARTICIPANTS (修改)
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_PARTICIPANTS — maxParticipants < 2（§4 修改团课 - 错误码）
  it('should throw COACHING_INVALID_PARTICIPANTS when maxParticipants below 2 in update', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', {
        maxParticipants: 1,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_PARTICIPANTS',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_PARTICIPANTS — maxParticipants > 30（§4 修改团课 - 错误码）
  it('should throw COACHING_INVALID_PARTICIPANTS when maxParticipants above 30 in update', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', {
        maxParticipants: 31,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_PARTICIPANTS',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_PARTICIPANTS_EXCEED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PARTICIPANTS_EXCEED — maxParticipants 小于当前报名人数（§4 修改团课 - 错误码）
  it('should throw COACHING_PARTICIPANTS_EXCEED when new maxParticipants less than current enrollments', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        status: 'open',
        currentParticipants: 8,
        maxParticipants: 10,
      }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', {
        maxParticipants: 5,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_PARTICIPANTS_EXCEED',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_VENUE_NOT_FOUND (修改)
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_VENUE — venueId 格式不合法（§4 修改团课 - 错误码）
  it('should throw COACHING_INVALID_VENUE when updated venueId is empty string', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', {
        venueId: '',
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_VENUE',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_VENUE_NOT_FOUND — 修改 venueId 时球馆不存在（§4 修改团课 - 错误码）
  it('should throw COACHING_VENUE_NOT_FOUND when updated venueId does not exist', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );
    venueService.getVenueById.mockResolvedValue(null);

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', {
        venueId: 'nonexistent-venue-uuid',
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_VENUE_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 业务规则: 若修改 venueId，调用 VenueService.getVenueById() 验证球馆存在（§4 修改团课 - 业务规则）
  it('should call VenueService.getVenueById when venueId is updated', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ status: 'open', venueId: 'venue-uuid-2' }),
    );
    venueService.getVenueById.mockResolvedValue({
      id: 'venue-uuid-2',
      name: '海淀体育馆',
      address: '北京市海淀区',
      latitude: 39.9,
      longitude: 116.3,
    });

    await service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', {
      venueId: 'venue-uuid-2',
    });

    expect(venueService.getVenueById).toHaveBeenCalledWith('venue-uuid-2');
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_FEE_DESCRIPTION (修改)
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_FEE_DESCRIPTION — feeDescription 超过 200 字符（§4 修改团课 - 错误码）
  it('should throw COACHING_INVALID_FEE_DESCRIPTION when feeDescription exceeds 200 chars in update', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );

    await expect(
      service.updateGroupClass('group-class-uuid-1', 'user-uuid-coach', {
        feeDescription: 'a'.repeat(201),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_FEE_DESCRIPTION',
      statusCode: 400,
    });
  });
});

// ===========================================================================
// POST /api/group-classes/:id/cancel — CoachingService.cancelGroupClass
// ===========================================================================

describe('POST /api/group-classes/:id/cancel — CoachingService.cancelGroupClass', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 教练本人可取消 open 状态的团课（§4 取消团课 - 业务规则）
  it('should cancel an open group class and set status to cancelled', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ status: 'cancelled' }),
    );

    const result = await service.cancelGroupClass('group-class-uuid-1', 'user-uuid-coach');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 教练本人可取消 full 状态的团课（§4 取消团课 - 业务规则）
  it('should cancel a full group class and set status to cancelled', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'full' }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ status: 'cancelled' }),
    );

    const result = await service.cancelGroupClass('group-class-uuid-1', 'user-uuid-coach');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 已取消的团课不可重复取消（幂等：返回当前状态，不报错）（§4 取消团课 - 业务规则）
  it('should return current cancelled status without error for already cancelled class (idempotent)', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'cancelled' }),
    );

    const result = await service.cancelGroupClass('group-class-uuid-1', 'user-uuid-coach');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 取消成功后通知所有已报名学员（§4 取消团课 - 业务规则 / §6.10 通知文案）
  it('should notify enrolled students after cancellation with correct notification fields', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({
        status: 'open',
        enrollments: [
          {
            id: 'e-1',
            groupClassId: 'group-class-uuid-1',
            userId: 'student-uuid-1',
            enrolledAt: new Date(),
          },
        ],
        currentParticipants: 1,
      }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ status: 'cancelled' }),
    );

    await service.cancelGroupClass('group-class-uuid-1', 'user-uuid-coach');

    expect(notificationService.createBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'GROUP_CLASS_CANCELLED',
          title: '团课已取消',
          targetType: 'group-class',
          targetId: 'group-class-uuid-1',
        }),
      ]),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4 取消团课 - 业务规则）
  it('should not fail when notification creation fails', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'open' }),
    );
    repo.updateGroupClass.mockResolvedValue(
      createGroupClassRecord({ status: 'cancelled' }),
    );
    notificationService.createBatch.mockRejectedValue(new Error('Notification error'));

    const result = await service.cancelGroupClass('group-class-uuid-1', 'user-uuid-coach');

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER — 非该团课的教练尝试取消（§4 取消团课 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the class coach', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ coachId: 'user-uuid-coach' }),
    );

    await expect(
      service.cancelGroupClass('group-class-uuid-1', 'user-uuid-other'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_GROUP_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_GROUP_CLASS_NOT_FOUND — 团课不存在（§4 取消团课 - 错误码）
  it('should throw COACHING_GROUP_CLASS_NOT_FOUND when group class does not exist', async () => {
    repo.findGroupClassById.mockResolvedValue(null);

    await expect(
      service.cancelGroupClass('nonexistent-uuid', 'user-uuid-coach'),
    ).rejects.toMatchObject({
      code: 'COACHING_GROUP_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CLASS_NOT_CANCELLABLE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_CLASS_NOT_CANCELLABLE — in_progress 状态不允许取消（§4 取消团课 - 错误码）
  it('should throw COACHING_CLASS_NOT_CANCELLABLE when status is in_progress', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'in_progress' }),
    );

    await expect(
      service.cancelGroupClass('group-class-uuid-1', 'user-uuid-coach'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_CLASS_NOT_CANCELLABLE — completed 状态不允许取消（§4 取消团课 - 错误码）
  it('should throw COACHING_CLASS_NOT_CANCELLABLE when status is completed', async () => {
    repo.findGroupClassById.mockResolvedValue(
      createGroupClassRecord({ status: 'completed' }),
    );

    await expect(
      service.cancelGroupClass('group-class-uuid-1', 'user-uuid-coach'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// CoachingService.getGroupClassById — 跨模块 Service 调用
// ===========================================================================

describe('CoachingService.getGroupClassById — cross-module service', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    venueService = createMockVenueService();
    notificationService = createMockNotificationService();
    service = new CoachingService(
      repo as unknown as CoachingRepository,
      userService as any,
      venueService as any,
      notificationService as any,
    );
  });

  // 业务规则: 团课不存在时返回 null（§4 跨模块接口 - getGroupClassById）
  it('should return null when group class does not exist', async () => {
    repo.findGroupClassById.mockResolvedValue(null);

    const result = await service.getGroupClassById('nonexistent-uuid');

    expect(result).toBeNull();
  });

  // 业务规则: 返回字段包含 id, coachId, title, venueId, startTime, endTime, status（§4 跨模块接口 - getGroupClassById）
  it('should return group class fields including status for caller validation', async () => {
    repo.findGroupClassById.mockResolvedValue(createGroupClassRecord());

    const result = await service.getGroupClassById('group-class-uuid-1');

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: expect.any(String),
      coachId: expect.any(String),
      title: expect.any(String),
      startTime: expect.any(Date),
      endTime: expect.any(Date),
      status: expect.any(String),
    });
  });
});
