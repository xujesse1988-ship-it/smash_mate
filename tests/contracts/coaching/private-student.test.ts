/**
 * 契约测试: coaching 模块 — 固定私教学员管理与课程接口
 * 覆盖接口:
 *   - POST /api/private-students (CoachingService.addPrivateStudent)
 *   - GET /api/private-students (CoachingService.getPrivateStudents)
 *   - GET /api/private-students/:id (CoachingService.getPrivateStudentDetail)
 *   - DELETE /api/private-students/:id (CoachingService.removePrivateStudent)
 *   - POST /api/private-students/:id/lessons (CoachingService.createPrivateLessonV2)
 *   - GET /api/private-students/:id/lessons (CoachingService.getPrivateLessonsV2)
 *   - GET /api/private-students/:id/lessons/:lessonId (CoachingService.getPrivateLessonV2Detail)
 *   - PUT /api/private-students/:id/lessons/:lessonId (CoachingService.updatePrivateLessonV2)
 *   - POST /api/private-students/:id/lessons/:lessonId/cancel (CoachingService.cancelPrivateLessonV2)
 *   - PUT /api/private-students/:id/lessons/:lessonId/training-content (CoachingService.updatePrivateLessonV2TrainingContent)
 *
 * 来源文档: docs/module-design/coaching-v2.md §4.2 固定私教学员（GC）
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COACH_USER_ID = 'user-uuid-coach';
const STUDENT_USER_ID = 'user-uuid-student';
const PRIVATE_STUDENT_ID = 'private-student-uuid-1';
const LESSON_ID = 'private-lesson-v2-uuid-1';
const VENUE_ID = 'venue-uuid-1';

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
    // -- existing v1 methods --
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

    // -- v2: PrivateStudent (GC) --
    findPrivateStudentById: vi.fn().mockResolvedValue(null),
    findPrivateStudentByCoachAndStudent: vi.fn().mockResolvedValue(null),
    createPrivateStudent: vi.fn().mockResolvedValue(createPrivateStudentRecord()),
    reactivatePrivateStudent: vi.fn().mockResolvedValue(createPrivateStudentRecord()),
    deactivatePrivateStudent: vi.fn().mockResolvedValue(
      createPrivateStudentRecord({ isActive: false }),
    ),
    findPrivateStudentsByCoach: vi.fn().mockResolvedValue([]),

    // -- v2: PrivateLessonV2 --
    createPrivateLessonV2: vi.fn().mockResolvedValue(createLessonRecord()),
    findPrivateLessonV2ById: vi.fn().mockResolvedValue(null),
    findPrivateLessonsV2ByStudent: vi.fn().mockResolvedValue([]),
    updatePrivateLessonV2: vi.fn().mockResolvedValue(createLessonRecord()),
    cancelPrivateLessonV2: vi.fn().mockResolvedValue(
      createLessonRecord({ status: 'cancelled' }),
    ),
    updatePrivateLessonV2TrainingContent: vi.fn().mockResolvedValue(createLessonRecord()),

    // -- v2: status transitions --
    updateClassLessonsStarted: vi.fn().mockResolvedValue(0),
    updateClassLessonsCompleted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsV2Started: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsV2Completed: vi.fn().mockResolvedValue(0),

    // -- v2: Lesson notes (stub, tested in separate file) --
    createLessonNote: vi.fn().mockResolvedValue(undefined),
    findLessonNotes: vi.fn().mockResolvedValue([]),

    // -- v2: Student notes (stub) --
    createStudentNote: vi.fn().mockResolvedValue(undefined),
    findStudentNotes: vi.fn().mockResolvedValue([]),

    // -- v2: Student tags (stub) --
    setStudentTags: vi.fn().mockResolvedValue(undefined),
    findStudentTags: vi.fn().mockResolvedValue([]),

    // -- v2: StudentClass (GB) stubs --
    createStudentClass: vi.fn().mockResolvedValue(undefined),
    findStudentClassById: vi.fn().mockResolvedValue(null),
    findStudentClassesByCoach: vi.fn().mockResolvedValue([]),
    updateStudentClass: vi.fn().mockResolvedValue(undefined),
    deleteStudentClass: vi.fn().mockResolvedValue(undefined),
    addStudentClassMember: vi.fn().mockResolvedValue(undefined),
    removeStudentClassMember: vi.fn().mockResolvedValue(undefined),
    findStudentClassMembers: vi.fn().mockResolvedValue([]),
    findStudentClassMember: vi.fn().mockResolvedValue(null),
    createClassLesson: vi.fn().mockResolvedValue(undefined),
    findClassLessonById: vi.fn().mockResolvedValue(null),
    findClassLessonsByClass: vi.fn().mockResolvedValue([]),
    updateClassLesson: vi.fn().mockResolvedValue(undefined),
    cancelClassLesson: vi.fn().mockResolvedValue(undefined),
    updateClassLessonTrainingContent: vi.fn().mockResolvedValue(undefined),
    getClassLessonParticipantIds: vi.fn().mockResolvedValue([]),

    // -- v2: Student view stubs --
    findStudentClassesByStudent: vi.fn().mockResolvedValue([]),
    findPrivateCoachesByStudent: vi.fn().mockResolvedValue([]),
    findLessonsByStudent: vi.fn().mockResolvedValue([]),

    // -- v2: Internal service call stubs --
    findClassLessonByIdRaw: vi.fn().mockResolvedValue(null),
    findPrivateLessonV2ByIdRaw: vi.fn().mockResolvedValue(null),
  };
}

/**
 * Build a mock UserService with cross-module methods.
 */
function createMockUserService() {
  return {
    getUserById: vi.fn().mockResolvedValue({
      id: COACH_USER_ID,
      nickname: '教练张',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: null,
      isCoach: true,
    }),
    getUsersByIds: vi.fn().mockResolvedValue([
      {
        id: STUDENT_USER_ID,
        nickname: '学员小王',
        avatarUrl: 'https://example.com/student-avatar.jpg',
        bio: null,
        isCoach: false,
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
      id: VENUE_ID,
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

/** Standard PrivateStudent record as returned by repository */
function createPrivateStudentRecord(
  overrides?: Partial<{
    id: string;
    coachId: string;
    studentId: string;
    isActive: boolean;
    joinedAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: PRIVATE_STUDENT_ID,
    coachId: COACH_USER_ID,
    studentId: STUDENT_USER_ID,
    isActive: true,
    joinedAt: new Date('2026-04-13T10:00:00.000Z'),
    updatedAt: new Date('2026-04-13T10:00:00.000Z'),
    ...overrides,
  };
}

/** Standard PrivateLessonV2 record as returned by repository */
function createLessonRecord(
  overrides?: Partial<{
    id: string;
    privateStudentId: string;
    coachId: string;
    studentId: string;
    venueId: string | null;
    startTime: Date;
    endTime: Date;
    trainingContent: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: LESSON_ID,
    privateStudentId: PRIVATE_STUDENT_ID,
    coachId: COACH_USER_ID,
    studentId: STUDENT_USER_ID,
    venueId: VENUE_ID,
    startTime: new Date('2026-04-15T14:00:00.000Z'),
    endTime: new Date('2026-04-15T16:00:00.000Z'),
    trainingContent: '反手技术训练',
    status: 'scheduled',
    createdAt: new Date('2026-04-13T10:00:00.000Z'),
    updatedAt: new Date('2026-04-13T10:00:00.000Z'),
    ...overrides,
  };
}

/** Future time helpers for valid input */
function futureDate(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

// ===========================================================================
// POST /api/private-students — CoachingService.addPrivateStudent
// ===========================================================================

describe.skip('POST /api/private-students — CoachingService.addPrivateStudent', () => {
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

  // 业务规则: 教练可添加已注册用户为固定私教学员（§4.2 添加固定私教学员 - 业务规则）
  it('should add a registered user as private student', async () => {
    userService.getUserById.mockResolvedValue({
      id: STUDENT_USER_ID,
      nickname: '学员小王',
      avatarUrl: 'https://example.com/student-avatar.jpg',
      bio: null,
      isCoach: false,
    });
    repo.findPrivateStudentByCoachAndStudent.mockResolvedValue(null);
    repo.createPrivateStudent.mockResolvedValue(createPrivateStudentRecord());

    const result = await service.addPrivateStudent(COACH_USER_ID, { studentId: STUDENT_USER_ID });

    expect(result).toBeDefined();
    expect(result.id).toBe(PRIVATE_STUDENT_ID);
    expect(result.coachId).toBe(COACH_USER_ID);
    expect(result.studentId).toBe(STUDENT_USER_ID);
    expect(result.isActive).toBe(true);
    expect(result).toHaveProperty('joinedAt');
  });

  // 业务规则: 添加后通知学员（§4.2 添加固定私教学员 - 业务规则 / PRD GC 规则 5）
  it('should notify the student after successfully adding as private student', async () => {
    userService.getUserById
      .mockResolvedValueOnce({
        id: COACH_USER_ID,
        nickname: '教练张',
        avatarUrl: null,
        bio: null,
        isCoach: true,
      })
      .mockResolvedValueOnce({
        id: STUDENT_USER_ID,
        nickname: '学员小王',
        avatarUrl: null,
        bio: null,
        isCoach: false,
      });
    repo.findPrivateStudentByCoachAndStudent.mockResolvedValue(null);
    repo.createPrivateStudent.mockResolvedValue(createPrivateStudentRecord());

    await service.addPrivateStudent(COACH_USER_ID, { studentId: STUDENT_USER_ID });

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: STUDENT_USER_ID,
        type: expect.any(String),
      }),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4.2 添加固定私教学员 - 业务规则）
  it('should not fail when notification creation fails during add', async () => {
    userService.getUserById.mockResolvedValue({
      id: STUDENT_USER_ID,
      nickname: '学员小王',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });
    repo.findPrivateStudentByCoachAndStudent.mockResolvedValue(null);
    repo.createPrivateStudent.mockResolvedValue(createPrivateStudentRecord());
    notificationService.create.mockRejectedValue(new Error('Notification error'));

    const result = await service.addPrivateStudent(COACH_USER_ID, {
      studentId: STUDENT_USER_ID,
    });

    expect(result).toBeDefined();
  });

  // 业务规则: 若学员之前被移除过，重新添加时恢复 isActive（§4.2 添加固定私教学员 - 业务规则）
  it('should reactivate a previously removed student', async () => {
    userService.getUserById.mockResolvedValue({
      id: STUDENT_USER_ID,
      nickname: '学员小王',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });
    repo.findPrivateStudentByCoachAndStudent.mockResolvedValue(
      createPrivateStudentRecord({ isActive: false }),
    );
    repo.reactivatePrivateStudent.mockResolvedValue(
      createPrivateStudentRecord({ isActive: true }),
    );

    const result = await service.addPrivateStudent(COACH_USER_ID, {
      studentId: STUDENT_USER_ID,
    });

    expect(result).toBeDefined();
    expect(result.isActive).toBe(true);
    expect(repo.reactivatePrivateStudent).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 异常流程: USER_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: USER_NOT_FOUND — 学员不存在（§4.2 添加固定私教学员 - 错误码）
  it('should throw USER_NOT_FOUND when student does not exist', async () => {
    userService.getUserById.mockResolvedValue(null);

    await expect(
      service.addPrivateStudent(COACH_USER_ID, { studentId: 'nonexistent-user' }),
    ).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_ALREADY_PRIVATE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_STUDENT_ALREADY_PRIVATE — 学员已是活跃固定私教学员（§4.2 添加固定私教学员 - 错误码）
  it('should throw COACHING_STUDENT_ALREADY_PRIVATE when student is already active private student', async () => {
    userService.getUserById.mockResolvedValue({
      id: STUDENT_USER_ID,
      nickname: '学员小王',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });
    repo.findPrivateStudentByCoachAndStudent.mockResolvedValue(
      createPrivateStudentRecord({ isActive: true }),
    );

    await expect(
      service.addPrivateStudent(COACH_USER_ID, { studentId: STUDENT_USER_ID }),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_ALREADY_PRIVATE',
      statusCode: 409,
    });
  });
});

// ===========================================================================
// GET /api/private-students — CoachingService.getPrivateStudents
// ===========================================================================

describe.skip('GET /api/private-students — CoachingService.getPrivateStudents', () => {
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

  // 业务规则: 返回当前教练的固定私教学员列表，含 lessonCount（§4.2 获取固定私教学员列表 - 业务规则）
  it('should return private students with lesson count', async () => {
    repo.findPrivateStudentsByCoach.mockResolvedValue([
      createPrivateStudentRecord(),
    ]);
    userService.getUsersByIds.mockResolvedValue([
      {
        id: STUDENT_USER_ID,
        nickname: '学员小王',
        avatarUrl: 'https://example.com/student-avatar.jpg',
        isCoach: false,
      },
    ]);

    const result = await service.getPrivateStudents(COACH_USER_ID);

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toHaveProperty('studentId', STUDENT_USER_ID);
    expect(result.items[0]).toHaveProperty('nickname');
    expect(result.items[0]).toHaveProperty('isActive', true);
    expect(result.items[0]).toHaveProperty('lessonCount');
  });

  // 业务规则: 默认仅返回 isActive = true 的学员（§4.2 获取固定私教学员列表 - 业务规则）
  it('should pass includeInactive=false by default', async () => {
    repo.findPrivateStudentsByCoach.mockResolvedValue([]);

    await service.getPrivateStudents(COACH_USER_ID);

    expect(repo.findPrivateStudentsByCoach).toHaveBeenCalledWith(
      COACH_USER_ID,
      expect.objectContaining({ includeInactive: false }),
    );
  });

  // 业务规则: 返回空列表（无学员时）
  it('should return empty list when no private students exist', async () => {
    repo.findPrivateStudentsByCoach.mockResolvedValue([]);

    const result = await service.getPrivateStudents(COACH_USER_ID);

    expect(result.items).toHaveLength(0);
  });
});

// ===========================================================================
// GET /api/private-students/:id — CoachingService.getPrivateStudentDetail
// ===========================================================================

describe.skip('GET /api/private-students/:id — CoachingService.getPrivateStudentDetail', () => {
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

  // 业务规则: 返回学员详情，含学员信息（§4.2 获取固定私教学员详情 - 业务规则）
  it('should return student detail with user info', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    userService.getUserById.mockResolvedValue({
      id: STUDENT_USER_ID,
      nickname: '学员小王',
      avatarUrl: 'https://example.com/student-avatar.jpg',
      bio: null,
      isCoach: false,
    });

    const result = await service.getPrivateStudentDetail(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(result).toBeDefined();
    expect(result.id).toBe(PRIVATE_STUDENT_ID);
    expect(result.studentId).toBe(STUDENT_USER_ID);
    expect(result).toHaveProperty('nickname');
    expect(result).toHaveProperty('isActive');
    expect(result).toHaveProperty('lessonCount');
  });

  // 业务规则: 可查看已移除学员的详情（§4.2 获取固定私教学员详情 - 业务规则 / PRD GC 规则 15）
  it('should allow viewing detail of inactive (removed) student', async () => {
    repo.findPrivateStudentById.mockResolvedValue(
      createPrivateStudentRecord({ isActive: false }),
    );
    userService.getUserById.mockResolvedValue({
      id: STUDENT_USER_ID,
      nickname: '学员小王',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    const result = await service.getPrivateStudentDetail(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(result).toBeDefined();
    expect(result.isActive).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_PRIVATE_STUDENT_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_STUDENT_NOT_FOUND — 记录不存在（§4.2 获取固定私教学员详情 - 错误码）
  it('should throw COACHING_PRIVATE_STUDENT_NOT_FOUND when record does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(null);

    await expect(
      service.getPrivateStudentDetail('nonexistent-uuid', COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER — 非该私教学员的教练（§4.2 获取固定私教学员详情 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.getPrivateStudentDetail(PRIVATE_STUDENT_ID, 'other-coach-id'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// DELETE /api/private-students/:id — CoachingService.removePrivateStudent
// ===========================================================================

describe.skip('DELETE /api/private-students/:id — CoachingService.removePrivateStudent', () => {
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

  // 业务规则: 软删除，设 isActive=false，数据保留（§4.2 移除固定私教学员 - 业务规则 / PRD GC 规则 15）
  it('should set isActive=false when removing a private student (soft delete)', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.deactivatePrivateStudent.mockResolvedValue(
      createPrivateStudentRecord({ isActive: false }),
    );

    const result = await service.removePrivateStudent(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(result).toBeDefined();
    expect(result.id).toBe(PRIVATE_STUDENT_ID);
    expect(result.isActive).toBe(false);
    expect(repo.deactivatePrivateStudent).toHaveBeenCalledWith(PRIVATE_STUDENT_ID);
  });

  // 业务规则: 移除后通知学员（§4.2 移除固定私教学员 - 业务规则 / PRD GC 规则 6）
  it('should notify the student after removal', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.deactivatePrivateStudent.mockResolvedValue(
      createPrivateStudentRecord({ isActive: false }),
    );

    await service.removePrivateStudent(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: STUDENT_USER_ID,
        type: expect.any(String),
      }),
    );
  });

  // 业务规则: 通知创建失败不阻塞主流程（§4.2 移除固定私教学员 - 业务规则）
  it('should not fail when notification creation fails during removal', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.deactivatePrivateStudent.mockResolvedValue(
      createPrivateStudentRecord({ isActive: false }),
    );
    notificationService.create.mockRejectedValue(new Error('Notification error'));

    const result = await service.removePrivateStudent(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_PRIVATE_STUDENT_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_STUDENT_NOT_FOUND — 记录不存在（§4.2 移除固定私教学员 - 错误码）
  it('should throw COACHING_PRIVATE_STUDENT_NOT_FOUND when record does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(null);

    await expect(
      service.removePrivateStudent('nonexistent-uuid', COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_ALREADY_INACTIVE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_STUDENT_ALREADY_INACTIVE — 学员已被移除（§4.2 移除固定私教学员 - 错误码）
  it('should throw COACHING_STUDENT_ALREADY_INACTIVE when student is already removed', async () => {
    repo.findPrivateStudentById.mockResolvedValue(
      createPrivateStudentRecord({ isActive: false }),
    );

    await expect(
      service.removePrivateStudent(PRIVATE_STUDENT_ID, COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_ALREADY_INACTIVE',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER — 非该私教学员的教练（§4.2 移除固定私教学员 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.removePrivateStudent(PRIVATE_STUDENT_ID, 'other-coach-id'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// POST /api/private-students/:id/lessons — CoachingService.createPrivateLessonV2
// ===========================================================================

describe.skip('POST /api/private-students/:id/lessons — CoachingService.createPrivateLessonV2', () => {
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

  // 业务规则: 创建课程，初始状态 scheduled（§4.2 创建固定私教课程 - 业务规则）
  it('should create a lesson with status scheduled', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.createPrivateLessonV2.mockResolvedValue(createLessonRecord());

    const result = await service.createPrivateLessonV2(PRIVATE_STUDENT_ID, COACH_USER_ID, {
      startTime: futureDate(24),
      endTime: futureDate(26),
      venueId: VENUE_ID,
    });

    expect(result).toBeDefined();
    expect(result.id).toBe(LESSON_ID);
    expect(result.privateStudentId).toBe(PRIVATE_STUDENT_ID);
    expect(result.status).toBe('scheduled');
    expect(result).toHaveProperty('startTime');
    expect(result).toHaveProperty('endTime');
  });

  // 业务规则: 支持可选 trainingContent（§4.2 创建固定私教课程 - 业务规则 / PRD GC 规则 10）
  it('should create lesson with optional trainingContent', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.createPrivateLessonV2.mockResolvedValue(
      createLessonRecord({ trainingContent: '反手技术训练' }),
    );

    const result = await service.createPrivateLessonV2(PRIVATE_STUDENT_ID, COACH_USER_ID, {
      startTime: futureDate(24),
      endTime: futureDate(26),
      venueId: VENUE_ID,
      trainingContent: '反手技术训练',
    });

    expect(result).toBeDefined();
    expect(result.trainingContent).toBe('反手技术训练');
  });

  // 业务规则: 创建成功后通知学员（§4.2 创建固定私教课程 - 业务规则 / PRD GC 规则 9）
  it('should notify the student after creating a lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.createPrivateLessonV2.mockResolvedValue(createLessonRecord());

    await service.createPrivateLessonV2(PRIVATE_STUDENT_ID, COACH_USER_ID, {
      startTime: futureDate(24),
      endTime: futureDate(26),
      venueId: VENUE_ID,
    });

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: STUDENT_USER_ID,
      }),
    );
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_INACTIVE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_STUDENT_INACTIVE — 学员已被移除，不能创建新课程（§4.2 创建固定私教课程 - 错误码 / PRD GC 规则 15）
  it('should throw COACHING_STUDENT_INACTIVE when student isActive=false', async () => {
    repo.findPrivateStudentById.mockResolvedValue(
      createPrivateStudentRecord({ isActive: false }),
    );

    await expect(
      service.createPrivateLessonV2(PRIVATE_STUDENT_ID, COACH_USER_ID, {
        startTime: futureDate(24),
        endTime: futureDate(26),
        venueId: VENUE_ID,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_INACTIVE',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TIME — startTime in the past
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TIME — 开始时间不晚于当前时间（§4.2 创建固定私教课程 - 错误码）
  it('should throw COACHING_INVALID_TIME when startTime is in the past', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.createPrivateLessonV2(PRIVATE_STUDENT_ID, COACH_USER_ID, {
        startTime: new Date('2020-01-01T10:00:00.000Z').toISOString(),
        endTime: futureDate(26),
        venueId: VENUE_ID,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TIME — endTime before startTime
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TIME — 结束时间不晚于开始时间（§4.2 创建固定私教课程 - 错误码）
  it('should throw COACHING_INVALID_TIME when endTime is before startTime', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    const start = futureDate(26);
    const end = futureDate(24);

    await expect(
      service.createPrivateLessonV2(PRIVATE_STUDENT_ID, COACH_USER_ID, {
        startTime: start,
        endTime: end,
        venueId: VENUE_ID,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TRAINING_CONTENT
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TRAINING_CONTENT — 训练内容超过 2000 字符（§4.2 创建固定私教课程 - 错误码）
  it('should throw COACHING_INVALID_TRAINING_CONTENT when content exceeds 2000 chars', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.createPrivateLessonV2(PRIVATE_STUDENT_ID, COACH_USER_ID, {
        startTime: futureDate(24),
        endTime: futureDate(26),
        venueId: VENUE_ID,
        trainingContent: 'x'.repeat(2001),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TRAINING_CONTENT',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_PRIVATE_STUDENT_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_STUDENT_NOT_FOUND — 私教学员不存在（§4.2 创建固定私教课程 - 错误码）
  it('should throw COACHING_PRIVATE_STUDENT_NOT_FOUND when student record does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(null);

    await expect(
      service.createPrivateLessonV2('nonexistent-uuid', COACH_USER_ID, {
        startTime: futureDate(24),
        endTime: futureDate(26),
        venueId: VENUE_ID,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER — 非该私教学员的教练（§4.2 创建固定私教课程 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.createPrivateLessonV2(PRIVATE_STUDENT_ID, 'other-coach-id', {
        startTime: futureDate(24),
        endTime: futureDate(26),
        venueId: VENUE_ID,
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_VENUE_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_VENUE_NOT_FOUND — 球馆不存在（§4.2 创建固定私教课程 - 错误码）
  it('should throw COACHING_VENUE_NOT_FOUND when venue does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    venueService.getVenueById.mockResolvedValue(null);

    await expect(
      service.createPrivateLessonV2(PRIVATE_STUDENT_ID, COACH_USER_ID, {
        startTime: futureDate(24),
        endTime: futureDate(26),
        venueId: 'nonexistent-venue',
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_VENUE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// GET /api/private-students/:id/lessons — CoachingService.getPrivateLessonsV2
// ===========================================================================

describe.skip('GET /api/private-students/:id/lessons — CoachingService.getPrivateLessonsV2', () => {
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

  // 业务规则: 返回课程列表，按 startTime 降序（§4.2 获取固定私教课程列表 - 业务规则）
  it('should return lessons sorted by startTime descending', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonsV2ByStudent.mockResolvedValue([
      createLessonRecord({ id: 'lesson-1', startTime: new Date('2026-04-16T14:00:00.000Z') }),
      createLessonRecord({ id: 'lesson-2', startTime: new Date('2026-04-15T14:00:00.000Z') }),
    ]);

    const result = await service.getPrivateLessonsV2(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(2);
  });

  // 业务规则: 已移除学员的课程历史仍可查看（§4.2 获取固定私教课程列表 - 业务规则 / PRD GC 规则 15）
  it('should allow viewing lessons of inactive student', async () => {
    repo.findPrivateStudentById.mockResolvedValue(
      createPrivateStudentRecord({ isActive: false }),
    );
    repo.findPrivateLessonsV2ByStudent.mockResolvedValue([createLessonRecord()]);

    const result = await service.getPrivateLessonsV2(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_STUDENT_NOT_FOUND（§4.2 获取固定私教课程列表 - 错误码）
  it('should throw COACHING_PRIVATE_STUDENT_NOT_FOUND when student record does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(null);

    await expect(
      service.getPrivateLessonsV2('nonexistent-uuid', COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 错误码: COACHING_NOT_COACH_OWNER（§4.2 获取固定私教课程列表 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.getPrivateLessonsV2(PRIVATE_STUDENT_ID, 'other-coach-id'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/private-students/:id/lessons/:lessonId — CoachingService.getPrivateLessonV2Detail
// ===========================================================================

describe.skip('GET /api/private-students/:id/lessons/:lessonId — CoachingService.getPrivateLessonV2Detail', () => {
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

  // 业务规则: 返回课程详情（§4.2 获取固定私教课程详情）
  it('should return lesson detail', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(createLessonRecord());

    const result = await service.getPrivateLessonV2Detail(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(LESSON_ID);
    expect(result.privateStudentId).toBe(PRIVATE_STUDENT_ID);
    expect(result).toHaveProperty('startTime');
    expect(result).toHaveProperty('endTime');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('trainingContent');
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_LESSON_V2_NOT_FOUND — 课程不存在或不属于该私教学员（§4.2 获取固定私教课程详情 - 错误码）
  it('should throw COACHING_PRIVATE_LESSON_V2_NOT_FOUND when lesson does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(null);

    await expect(
      service.getPrivateLessonV2Detail(PRIVATE_STUDENT_ID, 'nonexistent-uuid', COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_LESSON_V2_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 错误码: COACHING_PRIVATE_LESSON_V2_NOT_FOUND — 课程不属于该私教学员（§4.2 获取固定私教课程详情 - 错误码）
  it('should throw COACHING_PRIVATE_LESSON_V2_NOT_FOUND when lesson belongs to different student', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ privateStudentId: 'other-student-uuid' }),
    );

    await expect(
      service.getPrivateLessonV2Detail(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_LESSON_V2_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// PUT /api/private-students/:id/lessons/:lessonId — CoachingService.updatePrivateLessonV2
// ===========================================================================

describe.skip('PUT /api/private-students/:id/lessons/:lessonId — CoachingService.updatePrivateLessonV2', () => {
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

  // 业务规则: 只有 scheduled 状态的课程可编辑（§4.2 编辑固定私教课程 - 业务规则 / PRD GC 规则 8）
  it('should update lesson when status is scheduled', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'scheduled' }),
    );
    const newStart = futureDate(48);
    const newEnd = futureDate(50);
    repo.updatePrivateLessonV2.mockResolvedValue(
      createLessonRecord({
        startTime: new Date(newStart),
        endTime: new Date(newEnd),
      }),
    );

    const result = await service.updatePrivateLessonV2(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
      { startTime: newStart, endTime: newEnd },
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(LESSON_ID);
    expect(repo.updatePrivateLessonV2).toHaveBeenCalled();
  });

  // 业务规则: 编辑成功后通知学员（§4.2 编辑固定私教课程 - 业务规则）
  it('should notify the student after updating lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({
        status: 'scheduled',
        startTime: new Date(Date.now() + 48 * 3600_000),
        endTime: new Date(Date.now() + 50 * 3600_000),
      }),
    );
    repo.updatePrivateLessonV2.mockResolvedValue(createLessonRecord());

    await service.updatePrivateLessonV2(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
      { startTime: futureDate(48) },
    );

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: STUDENT_USER_ID,
      }),
    );
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_LESSON_NOT_EDITABLE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_LESSON_NOT_EDITABLE — in_progress 状态不可编辑（§4.2 编辑固定私教课程 - 错误码）
  it('should throw COACHING_LESSON_NOT_EDITABLE when status is in_progress', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'in_progress' }),
    );

    await expect(
      service.updatePrivateLessonV2(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID, {
        startTime: futureDate(48),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_EDITABLE',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_LESSON_NOT_EDITABLE — completed 状态不可编辑（§4.2 编辑固定私教课程 - 错误码）
  it('should throw COACHING_LESSON_NOT_EDITABLE when status is completed', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'completed' }),
    );

    await expect(
      service.updatePrivateLessonV2(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID, {
        startTime: futureDate(48),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_EDITABLE',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_LESSON_NOT_EDITABLE — cancelled 状态不可编辑（§4.2 编辑固定私教课程 - 错误码）
  it('should throw COACHING_LESSON_NOT_EDITABLE when status is cancelled', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'cancelled' }),
    );

    await expect(
      service.updatePrivateLessonV2(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID, {
        startTime: futureDate(48),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_EDITABLE',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TIME
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TIME — 修改 startTime 后新时间在过去（§4.2 编辑固定私教课程 - 错误码）
  it('should throw COACHING_INVALID_TIME when new startTime is in the past', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'scheduled' }),
    );

    await expect(
      service.updatePrivateLessonV2(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID, {
        startTime: new Date('2020-01-01T10:00:00.000Z').toISOString(),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_VENUE_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_VENUE_NOT_FOUND — 修改 venueId 时球馆不存在（§4.2 编辑固定私教课程 - 错误码）
  it('should throw COACHING_VENUE_NOT_FOUND when new venue does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'scheduled' }),
    );
    venueService.getVenueById.mockResolvedValue(null);

    await expect(
      service.updatePrivateLessonV2(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID, {
        venueId: 'nonexistent-venue',
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_VENUE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// POST /api/private-students/:id/lessons/:lessonId/cancel — CoachingService.cancelPrivateLessonV2
// ===========================================================================

describe.skip('POST /api/private-students/:id/lessons/:lessonId/cancel — CoachingService.cancelPrivateLessonV2', () => {
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

  // 业务规则: 只有 scheduled 状态的课程可取消（§4.2 取消固定私教课程 - 业务规则 / PRD GC 规则 8）
  it('should cancel a scheduled lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'scheduled' }),
    );
    repo.cancelPrivateLessonV2.mockResolvedValue(
      createLessonRecord({ status: 'cancelled' }),
    );

    const result = await service.cancelPrivateLessonV2(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(LESSON_ID);
    expect(result.status).toBe('cancelled');
  });

  // 业务规则: 取消后通知学员（§4.2 取消固定私教课程 - 业务规则）
  it('should notify the student after cancelling a lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'scheduled' }),
    );
    repo.cancelPrivateLessonV2.mockResolvedValue(
      createLessonRecord({ status: 'cancelled' }),
    );

    await service.cancelPrivateLessonV2(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID);

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: STUDENT_USER_ID,
      }),
    );
  });

  // 业务规则: 已取消的课程重复取消为幂等（§4.2 取消固定私教课程 - 业务规则）
  it('should be idempotent for already cancelled lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'cancelled' }),
    );

    const result = await service.cancelPrivateLessonV2(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
    );

    expect(result).toBeDefined();
    expect(result.status).toBe('cancelled');
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_LESSON_NOT_CANCELLABLE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_LESSON_NOT_CANCELLABLE — in_progress 状态不可取消（§4.2 取消固定私教课程 - 错误码）
  it('should throw COACHING_LESSON_NOT_CANCELLABLE when status is in_progress', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'in_progress' }),
    );

    await expect(
      service.cancelPrivateLessonV2(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  // 错误码: COACHING_LESSON_NOT_CANCELLABLE — completed 状态不可取消（§4.2 取消固定私教课程 - 错误码）
  it('should throw COACHING_LESSON_NOT_CANCELLABLE when status is completed', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'completed' }),
    );

    await expect(
      service.cancelPrivateLessonV2(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER — 非该私教学员的教练（§4.2 取消固定私教课程 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.cancelPrivateLessonV2(PRIVATE_STUDENT_ID, LESSON_ID, 'other-coach-id'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// PUT /api/private-students/:id/lessons/:lessonId/training-content — CoachingService.updatePrivateLessonV2TrainingContent
// ===========================================================================

describe.skip('PUT /api/private-students/:id/lessons/:lessonId/training-content — CoachingService.updatePrivateLessonV2TrainingContent', () => {
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

  // 业务规则: 非 cancelled 状态均可修改训练内容（§4.2 更新训练内容 - 业务规则 / PRD GC 规则 10）
  it('should update training content for scheduled lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'scheduled' }),
    );
    repo.updatePrivateLessonV2TrainingContent.mockResolvedValue(
      createLessonRecord({ trainingContent: '反手技术训练 + 实战对打' }),
    );

    const result = await service.updatePrivateLessonV2TrainingContent(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
      { trainingContent: '反手技术训练 + 实战对打' },
    );

    expect(result).toBeDefined();
    expect(result.trainingContent).toBe('反手技术训练 + 实战对打');
  });

  // 业务规则: in_progress 状态也可修改训练内容
  it('should update training content for in_progress lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'in_progress' }),
    );
    repo.updatePrivateLessonV2TrainingContent.mockResolvedValue(
      createLessonRecord({ trainingContent: '新内容' }),
    );

    const result = await service.updatePrivateLessonV2TrainingContent(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
      { trainingContent: '新内容' },
    );

    expect(result).toBeDefined();
  });

  // 业务规则: completed 状态也可修改训练内容
  it('should update training content for completed lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'completed' }),
    );
    repo.updatePrivateLessonV2TrainingContent.mockResolvedValue(
      createLessonRecord({ trainingContent: '新内容' }),
    );

    const result = await service.updatePrivateLessonV2TrainingContent(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
      { trainingContent: '新内容' },
    );

    expect(result).toBeDefined();
  });

  // 业务规则: 可传空字符串清空训练内容（§4.2 更新训练内容 - 业务规则）
  it('should allow clearing training content with empty string', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'scheduled' }),
    );
    repo.updatePrivateLessonV2TrainingContent.mockResolvedValue(
      createLessonRecord({ trainingContent: '' }),
    );

    const result = await service.updatePrivateLessonV2TrainingContent(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
      { trainingContent: '' },
    );

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_LESSON_CANCELLED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_LESSON_CANCELLED — 已取消的课程不可操作（§4.2 更新训练内容 - 错误码）
  it('should throw COACHING_LESSON_CANCELLED when lesson is cancelled', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'cancelled' }),
    );

    await expect(
      service.updatePrivateLessonV2TrainingContent(
        PRIVATE_STUDENT_ID,
        LESSON_ID,
        COACH_USER_ID,
        { trainingContent: '新内容' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_CANCELLED',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TRAINING_CONTENT
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TRAINING_CONTENT — 训练内容超过 2000 字符（§4.2 更新训练内容 - 错误码）
  it('should throw COACHING_INVALID_TRAINING_CONTENT when content exceeds 2000 chars', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'scheduled' }),
    );

    await expect(
      service.updatePrivateLessonV2TrainingContent(
        PRIVATE_STUDENT_ID,
        LESSON_ID,
        COACH_USER_ID,
        { trainingContent: 'x'.repeat(2001) },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TRAINING_CONTENT',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER — 非该私教学员的教练（§4.2 更新训练内容 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.updatePrivateLessonV2TrainingContent(
        PRIVATE_STUDENT_ID,
        LESSON_ID,
        'other-coach-id',
        { trainingContent: '新内容' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});
