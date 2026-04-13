/**
 * 契约测试: coaching 模块 — 学员班课程接口
 * 覆盖接口:
 *   - POST /api/student-classes/:id/lessons (CoachingService.createClassLesson)
 *   - GET /api/student-classes/:id/lessons (CoachingService.getClassLessons)
 *   - GET /api/student-classes/:id/lessons/:lessonId (CoachingService.getClassLessonDetail)
 *   - PUT /api/student-classes/:id/lessons/:lessonId (CoachingService.updateClassLesson)
 *   - POST /api/student-classes/:id/lessons/:lessonId/cancel (CoachingService.cancelClassLesson)
 *   - PUT /api/student-classes/:id/lessons/:lessonId/training-content (CoachingService.updateClassLessonTrainingContent)
 *
 * 来源文档: docs/module-design/coaching-v2.md §4.1 学员班（GB）— 课程相关接口
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock CoachingRepository with all methods stubbed.
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
    createStudentClass: vi.fn().mockResolvedValue(undefined),
    findStudentClassById: vi.fn().mockResolvedValue(null),
    findStudentClassesByCoach: vi.fn().mockResolvedValue([]),
    updateStudentClass: vi.fn().mockResolvedValue(undefined),
    deleteStudentClass: vi.fn().mockResolvedValue(undefined),
    addStudentClassMember: vi.fn().mockResolvedValue(undefined),
    removeStudentClassMember: vi.fn().mockResolvedValue(undefined),
    findStudentClassMember: vi.fn().mockResolvedValue(null),
    findStudentClassMembers: vi.fn().mockResolvedValue([]),
    countStudentClassMembers: vi.fn().mockResolvedValue(0),
    countClassLessons: vi.fn().mockResolvedValue(0),
    // v2 课程相关方法
    createClassLesson: vi.fn().mockResolvedValue(createClassLessonRecord()),
    findClassLessonById: vi.fn().mockResolvedValue(null),
    findClassLessonsByClassId: vi.fn().mockResolvedValue([]),
    updateClassLesson: vi.fn().mockResolvedValue(createClassLessonRecord()),
    getStudentClassMemberIds: vi.fn().mockResolvedValue([]),
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

/** Standard StudentClass record */
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

/** Standard ClassLesson record as returned by repository */
function createClassLessonRecord(
  overrides?: Partial<{
    id: string;
    studentClassId: string;
    coachId: string;
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
    id: 'class-lesson-uuid-1',
    studentClassId: 'student-class-uuid-1',
    coachId: 'user-uuid-coach',
    venueId: 'venue-uuid-1',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
    trainingContent: null,
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

/** Past time helper */
function pastDate(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

// ===========================================================================
// POST /api/student-classes/:id/lessons — CoachingService.createClassLesson
// ===========================================================================

describe('POST /api/student-classes/:id/lessons — CoachingService.createClassLesson', () => {
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

  // 业务规则: 仅学员班的创建教练可创建课程（PRD GB-6）
  // 业务规则: 课程初始状态为 scheduled
  // 业务规则: 返回包含 venue 信息的响应
  it('should create a class lesson with valid input', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());

    const input = {
      startTime: futureDate(24),
      endTime: futureDate(26),
      venueId: 'venue-uuid-1',
    };
    const result = await service.createClassLesson(
      'user-uuid-coach',
      'student-class-uuid-1',
      input,
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: expect.any(String),
      studentClassId: 'student-class-uuid-1',
      coachId: 'user-uuid-coach',
      status: 'scheduled',
      createdAt: expect.any(Date),
    });
    expect(result.venue).toBeDefined();
    expect(result.venue).toMatchObject({
      id: 'venue-uuid-1',
      name: expect.any(String),
    });
  });

  // 业务规则: trainingContent 选填，最多 2000 字符（PRD GB 规则 19）
  it('should create lesson with optional trainingContent', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.createClassLesson.mockResolvedValue(
      createClassLessonRecord({ trainingContent: '步法训练 + 高远球' }),
    );

    const input = {
      startTime: futureDate(24),
      endTime: futureDate(26),
      venueId: 'venue-uuid-1',
      trainingContent: '步法训练 + 高远球',
    };
    const result = await service.createClassLesson(
      'user-uuid-coach',
      'student-class-uuid-1',
      input,
    );

    expect(result).toBeDefined();
  });

  // 业务规则: 创建成功后通知学员班内所有学员（PRD GB 规则 13）
  it('should notify all class members after creating lesson', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.getStudentClassMemberIds.mockResolvedValue(['student-1', 'student-2']);

    const input = {
      startTime: futureDate(24),
      endTime: futureDate(26),
      venueId: 'venue-uuid-1',
    };
    await service.createClassLesson('user-uuid-coach', 'student-class-uuid-1', input);

    expect(notificationService.createBatch).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TIME
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TIME — 开始时间不晚于当前时间（§4.1 - 错误码）
  it('should throw COACHING_INVALID_TIME when startTime is in the past', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());

    const input = {
      startTime: pastDate(1),
      endTime: futureDate(2),
      venueId: 'venue-uuid-1',
    };
    await expect(
      service.createClassLesson('user-uuid-coach', 'student-class-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_TIME — 结束时间不晚于开始时间（§4.1 - 错误码）
  it('should throw COACHING_INVALID_TIME when endTime is before startTime', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());

    const start = futureDate(26);
    const end = futureDate(24);
    const input = {
      startTime: start,
      endTime: end,
      venueId: 'venue-uuid-1',
    };
    await expect(
      service.createClassLesson('user-uuid-coach', 'student-class-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TRAINING_CONTENT
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TRAINING_CONTENT — 训练内容超过 2000 字符（§4.1 - 错误码）
  it('should throw COACHING_INVALID_TRAINING_CONTENT when content exceeds 2000 chars', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());

    const input = {
      startTime: futureDate(24),
      endTime: futureDate(26),
      venueId: 'venue-uuid-1',
      trainingContent: 'a'.repeat(2001),
    };
    await expect(
      service.createClassLesson('user-uuid-coach', 'student-class-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TRAINING_CONTENT',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_VENUE_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_VENUE_NOT_FOUND — 球馆不存在（§4.1 - 错误码）
  it('should throw COACHING_VENUE_NOT_FOUND when venue does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    venueService.getVenueById.mockResolvedValue(null);

    const input = {
      startTime: futureDate(24),
      endTime: futureDate(26),
      venueId: 'nonexistent-venue',
    };
    await expect(
      service.createClassLesson('user-uuid-coach', 'student-class-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'COACHING_VENUE_NOT_FOUND',
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

    const input = {
      startTime: futureDate(24),
      endTime: futureDate(26),
      venueId: 'venue-uuid-1',
    };
    await expect(
      service.createClassLesson('user-uuid-coach', 'student-class-uuid-1', input),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_CLASS_NOT_FOUND
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    const input = {
      startTime: futureDate(24),
      endTime: futureDate(26),
      venueId: 'venue-uuid-1',
    };
    await expect(
      service.createClassLesson('user-uuid-coach', 'nonexistent-uuid', input),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// GET /api/student-classes/:id/lessons — CoachingService.getClassLessons
// ===========================================================================

describe('GET /api/student-classes/:id/lessons — CoachingService.getClassLessons', () => {
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

  // 业务规则: 仅学员班创建教练可查看课程列表
  // 业务规则: 按 startTime 降序排列（最近的排前面）
  it('should return lessons sorted by startTime descending', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    const lesson1 = createClassLessonRecord({
      id: 'lesson-1',
      startTime: new Date('2026-04-15T14:00:00.000Z'),
    });
    const lesson2 = createClassLessonRecord({
      id: 'lesson-2',
      startTime: new Date('2026-04-16T14:00:00.000Z'),
    });
    repo.findClassLessonsByClassId.mockResolvedValue([lesson2, lesson1]);

    const result = await service.getClassLessons('user-uuid-coach', 'student-class-uuid-1');

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      startTime: expect.any(Date),
      endTime: expect.any(Date),
      status: expect.any(String),
    });
  });

  // 业务规则: 支持按 status 筛选
  it('should filter lessons by status when provided', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonsByClassId.mockResolvedValue([
      createClassLessonRecord({ status: 'completed' }),
    ]);

    const result = await service.getClassLessons(
      'user-uuid-coach',
      'student-class-uuid-1',
      { status: 'completed' },
    );

    expect(result.items).toHaveLength(1);
    expect(repo.findClassLessonsByClassId).toHaveBeenCalledWith(
      'student-class-uuid-1',
      expect.objectContaining({ status: 'completed' }),
    );
  });

  // 业务规则: 返回空列表
  it('should return empty list when no lessons exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonsByClassId.mockResolvedValue([]);

    const result = await service.getClassLessons('user-uuid-coach', 'student-class-uuid-1');

    expect(result.items).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.getClassLessons('user-uuid-coach', 'nonexistent-uuid'),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw COACHING_NOT_COACH_OWNER when user is not the class coach', async () => {
    repo.findStudentClassById.mockResolvedValue(
      createStudentClassRecord({ coachId: 'user-uuid-other-coach' }),
    );

    await expect(
      service.getClassLessons('user-uuid-coach', 'student-class-uuid-1'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/student-classes/:id/lessons/:lessonId — CoachingService.getClassLessonDetail
// ===========================================================================

describe('GET /api/student-classes/:id/lessons/:lessonId — CoachingService.getClassLessonDetail', () => {
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

  // 业务规则: 仅学员班创建教练可查看课程详情
  // 业务规则: 课程必须属于指定的学员班
  it('should return lesson detail with training content', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ trainingContent: '步法训练 + 高远球' }),
    );

    const result = await service.getClassLessonDetail(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: 'class-lesson-uuid-1',
      studentClassId: 'student-class-uuid-1',
      coachId: 'user-uuid-coach',
      trainingContent: '步法训练 + 高远球',
      status: expect.any(String),
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CLASS_LESSON_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_CLASS_LESSON_NOT_FOUND — 课程不存在或不属于该学员班（§4.1 - 错误码）
  it('should throw COACHING_CLASS_LESSON_NOT_FOUND when lesson does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(null);

    await expect(
      service.getClassLessonDetail('user-uuid-coach', 'student-class-uuid-1', 'nonexistent-uuid'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_LESSON_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 错误码: COACHING_CLASS_LESSON_NOT_FOUND — 课程不属于指定学员班
  it('should throw COACHING_CLASS_LESSON_NOT_FOUND when lesson belongs to another class', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ studentClassId: 'student-class-uuid-other' }),
    );

    await expect(
      service.getClassLessonDetail('user-uuid-coach', 'student-class-uuid-1', 'class-lesson-uuid-1'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_LESSON_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.getClassLessonDetail('user-uuid-coach', 'nonexistent-uuid', 'class-lesson-uuid-1'),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw COACHING_NOT_COACH_OWNER when user is not the class coach', async () => {
    repo.findStudentClassById.mockResolvedValue(
      createStudentClassRecord({ coachId: 'user-uuid-other-coach' }),
    );

    await expect(
      service.getClassLessonDetail('user-uuid-coach', 'student-class-uuid-1', 'class-lesson-uuid-1'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// PUT /api/student-classes/:id/lessons/:lessonId — CoachingService.updateClassLesson
// ===========================================================================

describe('PUT /api/student-classes/:id/lessons/:lessonId — CoachingService.updateClassLesson', () => {
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

  // 业务规则: 只有 status = scheduled 的课程可以编辑（PRD GB 规则 16, 18）
  // 业务规则: 只更新请求体中包含的字段
  it('should update lesson fields when status is scheduled', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );
    const newStartTime = futureDate(48);
    const newEndTime = futureDate(50);
    repo.updateClassLesson.mockResolvedValue(
      createClassLessonRecord({
        startTime: new Date(newStartTime),
        endTime: new Date(newEndTime),
      }),
    );
    repo.getStudentClassMemberIds.mockResolvedValue(['student-1']);

    const result = await service.updateClassLesson(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { startTime: newStartTime, endTime: newEndTime },
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: 'class-lesson-uuid-1',
      status: 'scheduled',
      updatedAt: expect.any(Date),
    });
  });

  // 业务规则: 若修改 venueId，调用 VenueService.getVenueById() 验证球馆存在
  it('should validate venue when venueId is updated', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );
    repo.updateClassLesson.mockResolvedValue(
      createClassLessonRecord({ venueId: 'venue-uuid-2' }),
    );
    repo.getStudentClassMemberIds.mockResolvedValue([]);

    await service.updateClassLesson(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { venueId: 'venue-uuid-2' },
    );

    expect(venueService.getVenueById).toHaveBeenCalledWith('venue-uuid-2');
  });

  // 业务规则: 编辑成功后通知学员班内所有学员（PRD GB 规则 16）
  it('should notify class members after updating lesson', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );
    repo.updateClassLesson.mockResolvedValue(createClassLessonRecord());
    repo.getStudentClassMemberIds.mockResolvedValue(['student-1', 'student-2']);

    await service.updateClassLesson(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { startTime: futureDate(48) },
    );

    expect(notificationService.createBatch).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_LESSON_NOT_EDITABLE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_LESSON_NOT_EDITABLE — 课程状态不为 scheduled（§4.1 - 错误码）
  it('should throw COACHING_LESSON_NOT_EDITABLE when lesson is in_progress', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'in_progress' }),
    );

    await expect(
      service.updateClassLesson(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { startTime: futureDate(48) },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_EDITABLE',
      statusCode: 409,
    });
  });

  it('should throw COACHING_LESSON_NOT_EDITABLE when lesson is completed', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'completed' }),
    );

    await expect(
      service.updateClassLesson(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { startTime: futureDate(48) },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_EDITABLE',
      statusCode: 409,
    });
  });

  it('should throw COACHING_LESSON_NOT_EDITABLE when lesson is cancelled', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'cancelled' }),
    );

    await expect(
      service.updateClassLesson(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { startTime: futureDate(48) },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_EDITABLE',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TIME
  // -----------------------------------------------------------------------

  it('should throw COACHING_INVALID_TIME when new startTime is in the past', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );

    await expect(
      service.updateClassLesson(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { startTime: pastDate(1) },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TIME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_VENUE_NOT_FOUND
  // -----------------------------------------------------------------------

  it('should throw COACHING_VENUE_NOT_FOUND when new venue does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );
    venueService.getVenueById.mockResolvedValue(null);

    await expect(
      service.updateClassLesson(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { venueId: 'nonexistent-venue' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_VENUE_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CLASS_LESSON_NOT_FOUND
  // -----------------------------------------------------------------------

  it('should throw COACHING_CLASS_LESSON_NOT_FOUND when lesson does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(null);

    await expect(
      service.updateClassLesson(
        'user-uuid-coach',
        'student-class-uuid-1',
        'nonexistent-uuid',
        { startTime: futureDate(48) },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_LESSON_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.updateClassLesson(
        'user-uuid-coach',
        'nonexistent-uuid',
        'class-lesson-uuid-1',
        { startTime: futureDate(48) },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// POST /api/student-classes/:id/lessons/:lessonId/cancel — CoachingService.cancelClassLesson
// ===========================================================================

describe('POST /api/student-classes/:id/lessons/:lessonId/cancel — CoachingService.cancelClassLesson', () => {
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

  // 业务规则: 只有 status = scheduled 的课程可以取消（PRD GB 规则 17, 18）
  // 业务规则: 取消后课程状态变为 cancelled，不可恢复
  it('should cancel a scheduled lesson', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );
    repo.updateClassLesson.mockResolvedValue(
      createClassLessonRecord({ status: 'cancelled' }),
    );
    repo.getStudentClassMemberIds.mockResolvedValue(['student-1']);

    const result = await service.cancelClassLesson(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: 'class-lesson-uuid-1',
      status: 'cancelled',
    });
  });

  // 业务规则: 取消成功后通知学员班内所有学员（PRD GB 规则 17）
  it('should notify class members after cancelling lesson', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );
    repo.updateClassLesson.mockResolvedValue(
      createClassLessonRecord({ status: 'cancelled' }),
    );
    repo.getStudentClassMemberIds.mockResolvedValue(['student-1', 'student-2']);

    await service.cancelClassLesson(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
    );

    expect(notificationService.createBatch).toHaveBeenCalled();
  });

  // 业务规则: 已取消的课程不可重复取消（幂等：返回当前状态，不报错）
  it('should return current status when lesson is already cancelled (idempotent)', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'cancelled' }),
    );

    const result = await service.cancelClassLesson(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
    );

    expect(result).toMatchObject({
      id: 'class-lesson-uuid-1',
      status: 'cancelled',
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_LESSON_NOT_CANCELLABLE
  // -----------------------------------------------------------------------

  // 错误码: COACHING_LESSON_NOT_CANCELLABLE — 课程状态不为 scheduled（§4.1 - 错误码）
  it('should throw COACHING_LESSON_NOT_CANCELLABLE when lesson is in_progress', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'in_progress' }),
    );

    await expect(
      service.cancelClassLesson('user-uuid-coach', 'student-class-uuid-1', 'class-lesson-uuid-1'),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  it('should throw COACHING_LESSON_NOT_CANCELLABLE when lesson is completed', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'completed' }),
    );

    await expect(
      service.cancelClassLesson('user-uuid-coach', 'student-class-uuid-1', 'class-lesson-uuid-1'),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_NOT_CANCELLABLE',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CLASS_LESSON_NOT_FOUND
  // -----------------------------------------------------------------------

  it('should throw COACHING_CLASS_LESSON_NOT_FOUND when lesson does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(null);

    await expect(
      service.cancelClassLesson('user-uuid-coach', 'student-class-uuid-1', 'nonexistent-uuid'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_LESSON_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.cancelClassLesson('user-uuid-coach', 'nonexistent-uuid', 'class-lesson-uuid-1'),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// PUT /api/student-classes/:id/lessons/:lessonId/training-content — CoachingService.updateClassLessonTrainingContent
// ===========================================================================

describe('PUT /api/student-classes/:id/lessons/:lessonId/training-content — CoachingService.updateClassLessonTrainingContent', () => {
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

  // 业务规则: 课程状态不为 cancelled 时均可修改训练内容（PRD GB 规则 19）
  it('should update training content when lesson is scheduled', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );
    repo.updateClassLesson.mockResolvedValue(
      createClassLessonRecord({ trainingContent: '步法训练 + 高远球 + 网前搓球' }),
    );

    const result = await service.updateClassLessonTrainingContent(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { trainingContent: '步法训练 + 高远球 + 网前搓球' },
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: 'class-lesson-uuid-1',
      trainingContent: '步法训练 + 高远球 + 网前搓球',
      updatedAt: expect.any(Date),
    });
  });

  it('should update training content when lesson is in_progress', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'in_progress' }),
    );
    repo.updateClassLesson.mockResolvedValue(
      createClassLessonRecord({ trainingContent: '更新内容', status: 'in_progress' }),
    );

    const result = await service.updateClassLessonTrainingContent(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { trainingContent: '更新内容' },
    );

    expect(result).toBeDefined();
  });

  it('should update training content when lesson is completed', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'completed' }),
    );
    repo.updateClassLesson.mockResolvedValue(
      createClassLessonRecord({ trainingContent: '回顾内容', status: 'completed' }),
    );

    const result = await service.updateClassLessonTrainingContent(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { trainingContent: '回顾内容' },
    );

    expect(result).toBeDefined();
  });

  // 业务规则: 可传空字符串清空训练内容
  it('should allow clearing training content with empty string', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );
    repo.updateClassLesson.mockResolvedValue(
      createClassLessonRecord({ trainingContent: '' }),
    );

    const result = await service.updateClassLessonTrainingContent(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { trainingContent: '' },
    );

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TRAINING_CONTENT
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TRAINING_CONTENT — 训练内容超过 2000 字符（§4.1 - 错误码）
  it('should throw COACHING_INVALID_TRAINING_CONTENT when content exceeds 2000 chars', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );

    const longContent = 'a'.repeat(2001);
    await expect(
      service.updateClassLessonTrainingContent(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { trainingContent: longContent },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TRAINING_CONTENT',
      statusCode: 400,
    });
  });

  // 边界: 恰好 2000 字符应通过
  it('should accept training content with exactly 2000 characters', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );
    const content2000 = 'a'.repeat(2000);
    repo.updateClassLesson.mockResolvedValue(
      createClassLessonRecord({ trainingContent: content2000 }),
    );

    const result = await service.updateClassLessonTrainingContent(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { trainingContent: content2000 },
    );

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_LESSON_CANCELLED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_LESSON_CANCELLED — 课程已取消，不可操作（§4.1 - 错误码）
  it('should throw COACHING_LESSON_CANCELLED when lesson is cancelled', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'cancelled' }),
    );

    await expect(
      service.updateClassLessonTrainingContent(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { trainingContent: '新内容' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_CANCELLED',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CLASS_LESSON_NOT_FOUND
  // -----------------------------------------------------------------------

  it('should throw COACHING_CLASS_LESSON_NOT_FOUND when lesson does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(null);

    await expect(
      service.updateClassLessonTrainingContent(
        'user-uuid-coach',
        'student-class-uuid-1',
        'nonexistent-uuid',
        { trainingContent: '新内容' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_LESSON_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.updateClassLessonTrainingContent(
        'user-uuid-coach',
        'nonexistent-uuid',
        'class-lesson-uuid-1',
        { trainingContent: '新内容' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_CLASS_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw COACHING_NOT_COACH_OWNER when user is not the class coach', async () => {
    repo.findStudentClassById.mockResolvedValue(
      createStudentClassRecord({ coachId: 'user-uuid-other-coach' }),
    );

    await expect(
      service.updateClassLessonTrainingContent(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { trainingContent: '新内容' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});
