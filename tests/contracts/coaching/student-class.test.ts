/**
 * 契约测试: coaching 模块 — 学员班 CRUD 与学员管理接口
 * 覆盖接口:
 *   - POST /api/student-classes (CoachingService.createStudentClass)
 *   - GET /api/student-classes (CoachingService.getStudentClasses)
 *   - GET /api/student-classes/:id (CoachingService.getStudentClassDetail)
 *   - PUT /api/student-classes/:id (CoachingService.updateStudentClass)
 *   - DELETE /api/student-classes/:id (CoachingService.deleteStudentClass)
 *   - POST /api/student-classes/:id/members (CoachingService.addStudentToClass)
 *   - DELETE /api/student-classes/:id/members/:studentId (CoachingService.removeStudentFromClass)
 *   - GET /api/users/search (UserService.searchUsers)
 *
 * 来源文档: docs/module-design/coaching-v2.md §4.1 学员班（GB）
 *
 * Mock 策略:
 * - CoachingRepository: 全部 mock（隔离数据库依赖）
 * - UserService: mock getUserById / getUsersByIds / searchUsers（跨模块依赖）
 * - VenueService: mock getVenueById（跨模块依赖）
 * - NotificationService: mock create / createBatch（跨模块依赖）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoachingService } from '@server/modules/coaching/service.js';
import { CoachingRepository } from '@server/modules/coaching/repository.js';
import { UserService } from '@server/modules/user/service.js';
import { UserRepository } from '@server/modules/user/repository.js';

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
    // Existing v1 methods
    findCoachProfile: vi.fn().mockResolvedValue(null),
    createCoachProfile: vi.fn().mockResolvedValue(undefined),
    updateCoachProfile: vi.fn().mockResolvedValue(undefined),
    findCoachList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    createGroupClass: vi.fn().mockResolvedValue(undefined),
    findGroupClassById: vi.fn().mockResolvedValue(null),
    updateGroupClass: vi.fn().mockResolvedValue(undefined),
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
    // v2 学员班相关方法
    createStudentClass: vi.fn().mockResolvedValue(createStudentClassRecord()),
    findStudentClassById: vi.fn().mockResolvedValue(null),
    findStudentClassesByCoach: vi.fn().mockResolvedValue([]),
    updateStudentClass: vi.fn().mockResolvedValue(createStudentClassRecord()),
    deleteStudentClass: vi.fn().mockResolvedValue(undefined),
    addStudentClassMember: vi.fn().mockResolvedValue(createMemberRecord()),
    removeStudentClassMember: vi.fn().mockResolvedValue(undefined),
    findStudentClassMember: vi.fn().mockResolvedValue(null),
    findStudentClassMembers: vi.fn().mockResolvedValue([]),
    countStudentClassMembers: vi.fn().mockResolvedValue(0),
    countClassLessons: vi.fn().mockResolvedValue(0),
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
    searchUsers: vi.fn().mockResolvedValue([]),
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

/** Standard StudentClass record as returned by repository */
function createStudentClassRecord(
  overrides?: Partial<{
    id: string;
    coachId: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: 'student-class-uuid-1',
    coachId: 'user-uuid-coach',
    name: '周三进阶班',
    createdAt: new Date('2026-04-13T10:00:00.000Z'),
    updatedAt: new Date('2026-04-13T10:00:00.000Z'),
    ...overrides,
  };
}

/** Standard StudentClassMember record */
function createMemberRecord(
  overrides?: Partial<{
    id: string;
    studentClassId: string;
    studentId: string;
    joinedAt: Date;
  }>,
) {
  return {
    id: 'member-uuid-1',
    studentClassId: 'student-class-uuid-1',
    studentId: 'user-uuid-student',
    joinedAt: new Date('2026-04-13T10:00:00.000Z'),
    ...overrides,
  };
}

/** Build a mock UserRepository for UserService tests */
function createMockUserRepository(): {
  [K in keyof UserRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    findByPhone: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    findByIds: vi.fn().mockResolvedValue([]),
    saveVerificationCode: vi.fn().mockResolvedValue(undefined),
    findVerificationCode: vi.fn().mockResolvedValue(null),
    markCodeUsed: vi.fn().mockResolvedValue(undefined),
    acquirePhoneLock: vi.fn().mockResolvedValue(true),
    releasePhoneLock: vi.fn().mockResolvedValue(undefined),
    searchUsers: vi.fn().mockResolvedValue([]),
  };
}

// ===========================================================================
// POST /api/student-classes — CoachingService.createStudentClass
// ===========================================================================

describe('POST /api/student-classes — CoachingService.createStudentClass', () => {
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

  // 业务规则: 仅审核通过的教练（isCoach = true）可创建（PRD GB-1）
  // 业务规则: 创建成功返回班级信息，含 memberCount=0, lessonCount=0
  it('should create a student class with valid name', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const result = await service.createStudentClass('user-uuid-coach', { name: '周三进阶班' });

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: expect.any(String),
      coachId: 'user-uuid-coach',
      name: '周三进阶班',
      memberCount: 0,
      lessonCount: 0,
    });
    expect(result.createdAt).toBeDefined();
  });

  // 边界: 名称恰好 2 个字符应通过
  it('should accept name with exactly 2 characters', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.createStudentClass.mockResolvedValue(
      createStudentClassRecord({ name: '初级' }),
    );

    const result = await service.createStudentClass('user-uuid-coach', { name: '初级' });

    expect(result).toBeDefined();
  });

  // 边界: 名称恰好 30 个字符应通过
  it('should accept name with exactly 30 characters', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    const name30 = 'a'.repeat(30);
    repo.createStudentClass.mockResolvedValue(
      createStudentClassRecord({ name: name30 }),
    );

    const result = await service.createStudentClass('user-uuid-coach', { name: name30 });

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_CLASS_NAME
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_CLASS_NAME — 名称为空（§4.1 POST /api/student-classes - 错误码）
  it('should throw COACHING_INVALID_CLASS_NAME when name is empty', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    await expect(
      service.createStudentClass('user-uuid-coach', { name: '' }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_CLASS_NAME',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_CLASS_NAME — 名称只有 1 个字符（PRD GB 规则 3）
  it('should throw COACHING_INVALID_CLASS_NAME when name is too short (1 char)', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    await expect(
      service.createStudentClass('user-uuid-coach', { name: 'A' }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_CLASS_NAME',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_CLASS_NAME — 名称超过 30 个字符（PRD GB 规则 3）
  it('should throw COACHING_INVALID_CLASS_NAME when name exceeds 30 characters', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });

    const longName = 'a'.repeat(31);
    await expect(
      service.createStudentClass('user-uuid-coach', { name: longName }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_CLASS_NAME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_COACH_ROLE_REQUIRED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_COACH_ROLE_REQUIRED — 当前用户不是教练角色（§4.1 - 错误码）
  it('should throw COACHING_COACH_ROLE_REQUIRED when user is not a coach', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-normal',
      nickname: '普通用户',
      avatarUrl: null,
      isCoach: false,
    });

    await expect(
      service.createStudentClass('user-uuid-normal', { name: '周三进阶班' }),
    ).rejects.toMatchObject({
      code: 'COACHING_COACH_ROLE_REQUIRED',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/student-classes — CoachingService.getStudentClasses
// ===========================================================================

describe('GET /api/student-classes — CoachingService.getStudentClasses', () => {
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

  // 业务规则: 仅返回当前教练创建的学员班（coachId = 当前用户 ID）
  // 业务规则: memberCount / lessonCount 实时计算
  // 业务规则: 按创建时间倒序排列
  it('should return array of student classes with member and lesson counts', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findStudentClassesByCoach.mockResolvedValue([
      createStudentClassRecord(),
      createStudentClassRecord({ id: 'student-class-uuid-2', name: '周五初级班' }),
    ]);
    repo.countStudentClassMembers.mockResolvedValue(5);
    repo.countClassLessons.mockResolvedValue(12);

    const result = await service.getStudentClasses('user-uuid-coach');

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      coachId: 'user-uuid-coach',
      name: expect.any(String),
      memberCount: expect.any(Number),
      lessonCount: expect.any(Number),
      createdAt: expect.any(Date),
    });
  });

  // 业务规则: 无学员班时返回空列表
  it('should return empty list when coach has no student classes', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-coach',
      nickname: '教练张',
      avatarUrl: null,
      isCoach: true,
    });
    repo.findStudentClassesByCoach.mockResolvedValue([]);

    const result = await service.getStudentClasses('user-uuid-coach');

    expect(result.items).toHaveLength(0);
  });
});

// ===========================================================================
// GET /api/student-classes/:id — CoachingService.getStudentClassDetail
// ===========================================================================

describe('GET /api/student-classes/:id — CoachingService.getStudentClassDetail', () => {
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

  // 业务规则: 返回班级详情，含 members 列表（带 nickname、avatarUrl）和计数
  // 业务规则: members 按加入时间升序排列
  // 业务规则: 学员信息通过 UserService.getUsersByIds() 批量获取
  it('should return student class detail with members', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMembers.mockResolvedValue([
      createMemberRecord({ studentId: 'user-uuid-student-1' }),
      createMemberRecord({ studentId: 'user-uuid-student-2' }),
    ]);
    repo.countStudentClassMembers.mockResolvedValue(2);
    repo.countClassLessons.mockResolvedValue(5);
    userService.getUsersByIds.mockResolvedValue([
      { id: 'user-uuid-student-1', nickname: '学员小王', avatarUrl: 'https://example.com/a1.jpg' },
      { id: 'user-uuid-student-2', nickname: '学员小李', avatarUrl: null },
    ]);

    const result = await service.getStudentClassDetail('user-uuid-coach', 'student-class-uuid-1');

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: 'student-class-uuid-1',
      coachId: 'user-uuid-coach',
      name: '周三进阶班',
      memberCount: 2,
      lessonCount: 5,
    });
    expect(result.members).toHaveLength(2);
    expect(result.members[0]).toMatchObject({
      studentId: expect.any(String),
      nickname: expect.any(String),
      joinedAt: expect.any(Date),
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_STUDENT_CLASS_NOT_FOUND — 学员班不存在（§4.1 - 错误码）
  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.getStudentClassDetail('user-uuid-coach', 'nonexistent-uuid'),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER — 非该学员班的教练（§4.1 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the class coach', async () => {
    repo.findStudentClassById.mockResolvedValue(
      createStudentClassRecord({ coachId: 'user-uuid-other-coach' }),
    );

    await expect(
      service.getStudentClassDetail('user-uuid-coach', 'student-class-uuid-1'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// PUT /api/student-classes/:id — CoachingService.updateStudentClass
// ===========================================================================

describe('PUT /api/student-classes/:id — CoachingService.updateStudentClass', () => {
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

  // 业务规则: 仅学员班创建教练可编辑（PRD GB-2）
  // 业务规则: 名称长度 2-30 字符（PRD GB 规则 3）
  it('should update student class name', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.updateStudentClass.mockResolvedValue(
      createStudentClassRecord({ name: '周五高级班' }),
    );

    const result = await service.updateStudentClass(
      'user-uuid-coach',
      'student-class-uuid-1',
      { name: '周五高级班' },
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: 'student-class-uuid-1',
      coachId: 'user-uuid-coach',
      name: '周五高级班',
      updatedAt: expect.any(Date),
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_CLASS_NAME
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_CLASS_NAME — 名称为空或过短（§4.1 - 错误码）
  it('should throw COACHING_INVALID_CLASS_NAME when name is invalid', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());

    await expect(
      service.updateStudentClass('user-uuid-coach', 'student-class-uuid-1', { name: 'A' }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_CLASS_NAME',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_CLASS_NAME — 名称超过 30 字符
  it('should throw COACHING_INVALID_CLASS_NAME when name exceeds 30 characters', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());

    const longName = 'a'.repeat(31);
    await expect(
      service.updateStudentClass('user-uuid-coach', 'student-class-uuid-1', { name: longName }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_CLASS_NAME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.updateStudentClass('user-uuid-coach', 'nonexistent-uuid', { name: '新名称' }),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  it('should throw COACHING_NOT_COACH_OWNER when user is not the class coach', async () => {
    repo.findStudentClassById.mockResolvedValue(
      createStudentClassRecord({ coachId: 'user-uuid-other-coach' }),
    );

    await expect(
      service.updateStudentClass('user-uuid-coach', 'student-class-uuid-1', { name: '新名称' }),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// DELETE /api/student-classes/:id — CoachingService.deleteStudentClass
// ===========================================================================

describe('DELETE /api/student-classes/:id — CoachingService.deleteStudentClass', () => {
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

  // 业务规则: 仅学员班创建教练可删除（PRD GB-3）
  // 业务规则: 级联删除 StudentClassMember、ClassLesson、LessonNote、StudentNote、StudentTag（PRD GB 规则 30）
  // 业务规则: 已录入的战绩（MatchRecord）不删除（多态关联，无物理外键）
  it('should delete student class and return success', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());

    const result = await service.deleteStudentClass('user-uuid-coach', 'student-class-uuid-1');

    expect(result).toMatchObject({ success: true });
    expect(repo.deleteStudentClass).toHaveBeenCalledWith('student-class-uuid-1');
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.deleteStudentClass('user-uuid-coach', 'nonexistent-uuid'),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  it('should throw COACHING_NOT_COACH_OWNER when user is not the class coach', async () => {
    repo.findStudentClassById.mockResolvedValue(
      createStudentClassRecord({ coachId: 'user-uuid-other-coach' }),
    );

    await expect(
      service.deleteStudentClass('user-uuid-coach', 'student-class-uuid-1'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// POST /api/student-classes/:id/members — CoachingService.addStudentToClass
// ===========================================================================

describe('POST /api/student-classes/:id/members — CoachingService.addStudentToClass', () => {
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

  // 业务规则: 仅学员班的创建教练可添加学员（PRD GB-4）
  // 业务规则: 调用 UserService.getUserById() 校验学员存在（PRD GB 规则 6）
  // 业务规则: 添加后通知学员（PRD GB 规则 8）
  it('should add a registered user as a student to the class', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(null); // not already a member
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-student',
      nickname: '学员小王',
      avatarUrl: 'https://example.com/student.jpg',
      isCoach: false,
    });
    repo.addStudentClassMember.mockResolvedValue(createMemberRecord());

    const result = await service.addStudentToClass(
      'user-uuid-coach',
      'student-class-uuid-1',
      { studentId: 'user-uuid-student' },
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      studentClassId: 'student-class-uuid-1',
      studentId: 'user-uuid-student',
      nickname: expect.any(String),
      joinedAt: expect.any(Date),
    });
    // 通知学员
    expect(notificationService.create).toHaveBeenCalled();
  });

  // 业务规则: 通知创建失败不阻塞主流程（try-catch + error 日志）
  it('should not fail when notification creation fails', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(null);
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-student',
      nickname: '学员小王',
      avatarUrl: null,
      isCoach: false,
    });
    repo.addStudentClassMember.mockResolvedValue(createMemberRecord());
    notificationService.create.mockRejectedValue(new Error('Notification failed'));

    const result = await service.addStudentToClass(
      'user-uuid-coach',
      'student-class-uuid-1',
      { studentId: 'user-uuid-student' },
    );

    // Should still succeed
    expect(result).toBeDefined();
    expect(result.studentId).toBe('user-uuid-student');
  });

  // -----------------------------------------------------------------------
  // 异常流程: USER_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: USER_NOT_FOUND — 学员用户不存在（§4.1 - 错误码）
  it('should throw USER_NOT_FOUND when student user does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    userService.getUserById.mockResolvedValue(null);

    await expect(
      service.addStudentToClass(
        'user-uuid-coach',
        'student-class-uuid-1',
        { studentId: 'nonexistent-user' },
      ),
    ).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_ALREADY_IN_CLASS
  // -----------------------------------------------------------------------

  // 错误码: COACHING_STUDENT_ALREADY_IN_CLASS — 学员已在班级中（§4.1 - 错误码）
  it('should throw COACHING_STUDENT_ALREADY_IN_CLASS when student is already a member', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    userService.getUserById.mockResolvedValue({
      id: 'user-uuid-student',
      nickname: '学员小王',
      avatarUrl: null,
      isCoach: false,
    });
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    await expect(
      service.addStudentToClass(
        'user-uuid-coach',
        'student-class-uuid-1',
        { studentId: 'user-uuid-student' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_ALREADY_IN_CLASS',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.addStudentToClass(
        'user-uuid-coach',
        'nonexistent-uuid',
        { studentId: 'user-uuid-student' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  it('should throw COACHING_NOT_COACH_OWNER when user is not the class coach', async () => {
    repo.findStudentClassById.mockResolvedValue(
      createStudentClassRecord({ coachId: 'user-uuid-other-coach' }),
    );

    await expect(
      service.addStudentToClass(
        'user-uuid-coach',
        'student-class-uuid-1',
        { studentId: 'user-uuid-student' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// DELETE /api/student-classes/:id/members/:studentId — CoachingService.removeStudentFromClass
// ===========================================================================

describe('DELETE /api/student-classes/:id/members/:studentId — CoachingService.removeStudentFromClass', () => {
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

  // 业务规则: 仅学员班创建教练可移除学员（PRD GB-5）
  // 业务规则: 移除后通知学员（PRD GB 规则 9）
  it('should remove student from class and return success', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    const result = await service.removeStudentFromClass(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
    );

    expect(result).toMatchObject({ success: true });
    expect(repo.removeStudentClassMember).toHaveBeenCalled();
    expect(notificationService.create).toHaveBeenCalled();
  });

  // 业务规则: 通知创建失败不阻塞主流程
  it('should not fail when notification creation fails on remove', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());
    notificationService.create.mockRejectedValue(new Error('Notification failed'));

    const result = await service.removeStudentFromClass(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
    );

    expect(result).toMatchObject({ success: true });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_NOT_IN_CLASS
  // -----------------------------------------------------------------------

  // 错误码: COACHING_STUDENT_NOT_IN_CLASS — 学员不在该班级中（§4.1 - 错误码）
  it('should throw COACHING_STUDENT_NOT_IN_CLASS when student is not a member', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(null);

    await expect(
      service.removeStudentFromClass(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_NOT_IN_CLASS',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.removeStudentFromClass(
        'user-uuid-coach',
        'nonexistent-uuid',
        'user-uuid-student',
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  it('should throw COACHING_NOT_COACH_OWNER when user is not the class coach', async () => {
    repo.findStudentClassById.mockResolvedValue(
      createStudentClassRecord({ coachId: 'user-uuid-other-coach' }),
    );

    await expect(
      service.removeStudentFromClass(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/users/search — UserService.searchUsers
// ===========================================================================

describe('GET /api/users/search — UserService.searchUsers', () => {
  let userServiceInstance: UserService;
  let userRepo: ReturnType<typeof createMockUserRepository>;

  beforeEach(() => {
    userRepo = createMockUserRepository();
    userServiceInstance = new UserService(userRepo as unknown as UserRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 昵称模糊匹配（LIKE '%keyword%'）（PRD GB 规则 4）
  it('should search users by nickname (fuzzy match)', async () => {
    userRepo.searchUsers.mockResolvedValue([
      {
        id: 'user-uuid-student',
        nickname: '学员小王',
        avatarUrl: 'https://example.com/a.jpg',
        phone: '13812345678',
      },
    ]);

    const result = await userServiceInstance.searchUsers('小王');

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'user-uuid-student',
      nickname: '学员小王',
      phoneLast4: '5678',
    });
    // 不返回完整手机号（PRD GB 规则 5）
    expect(result.items[0]).not.toHaveProperty('phone');
  });

  // 业务规则: 手机号精确匹配完整号码或后 4 位（PRD GB 规则 4）
  it('should search users by phone (last 4 digits)', async () => {
    userRepo.searchUsers.mockResolvedValue([
      {
        id: 'user-uuid-student',
        nickname: '学员小王',
        avatarUrl: 'https://example.com/a.jpg',
        phone: '13812345678',
      },
    ]);

    const result = await userServiceInstance.searchUsers('5678');

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      nickname: expect.any(String),
      phoneLast4: '5678',
    });
  });

  // 业务规则: 搜索无结果时返回空数组
  it('should return empty results when no users match', async () => {
    userRepo.searchUsers.mockResolvedValue([]);

    const result = await userServiceInstance.searchUsers('不存在的用户');

    expect(result.items).toHaveLength(0);
  });

  // 业务规则: 最多返回 20 条结果
  it('should return at most 20 results', async () => {
    const manyUsers = Array.from({ length: 25 }, (_, i) => ({
      id: `user-uuid-${i}`,
      nickname: `学员${i}`,
      avatarUrl: null,
      phone: `1381234${String(i).padStart(4, '0')}`,
    }));
    userRepo.searchUsers.mockResolvedValue(manyUsers);

    const result = await userServiceInstance.searchUsers('学员');

    expect(result.items.length).toBeLessThanOrEqual(20);
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_SEARCH_QUERY
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_SEARCH_QUERY — 搜索关键词为空（§4.1 - 错误码）
  it('should throw COACHING_INVALID_SEARCH_QUERY when query is empty', async () => {
    await expect(
      userServiceInstance.searchUsers(''),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_SEARCH_QUERY',
      statusCode: 400,
    });
  });
});
