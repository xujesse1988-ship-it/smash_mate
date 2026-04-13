/**
 * 契约测试: coaching 模块 — 课程笔记、学员笔记、学员标签接口
 * 覆盖接口:
 *   - POST /api/student-classes/:id/lessons/:lessonId/notes (CoachingService.addClassLessonNote)
 *   - GET /api/student-classes/:id/lessons/:lessonId/notes (CoachingService.getClassLessonNotes)
 *   - POST /api/student-classes/:id/members/:studentId/notes (CoachingService.addStudentNote)
 *   - GET /api/student-classes/:id/members/:studentId/notes (CoachingService.getStudentNotes)
 *   - PUT /api/student-classes/:id/members/:studentId/tags (CoachingService.setStudentTags)
 *   - GET /api/student-classes/:id/members/:studentId/tags (CoachingService.getStudentTags)
 *
 * 来源文档: docs/module-design/coaching-v2.md §4.1 学员班（GB）— 笔记/标签相关接口
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
    createClassLesson: vi.fn().mockResolvedValue(undefined),
    findClassLessonById: vi.fn().mockResolvedValue(null),
    findClassLessonsByClassId: vi.fn().mockResolvedValue([]),
    updateClassLesson: vi.fn().mockResolvedValue(undefined),
    getStudentClassMemberIds: vi.fn().mockResolvedValue([]),
    // v2 笔记/标签相关方法
    createLessonNote: vi.fn().mockResolvedValue(createLessonNoteRecord()),
    findLessonNotesByLessonId: vi.fn().mockResolvedValue([]),
    createStudentNote: vi.fn().mockResolvedValue(createStudentNoteRecord()),
    findStudentNotes: vi.fn().mockResolvedValue([]),
    setStudentTags: vi.fn().mockResolvedValue(undefined),
    findStudentTags: vi.fn().mockResolvedValue([]),
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
    getUsersByIds: vi.fn().mockResolvedValue([]),
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

/** Standard ClassLesson record */
function createClassLessonRecord(
  overrides?: Partial<{
    id: string;
    studentClassId: string;
    coachId: string;
    status: string;
  }>,
) {
  return {
    id: 'class-lesson-uuid-1',
    studentClassId: 'student-class-uuid-1',
    coachId: 'user-uuid-coach',
    venueId: 'venue-uuid-1',
    startTime: new Date('2026-04-15T14:00:00.000Z'),
    endTime: new Date('2026-04-15T16:00:00.000Z'),
    trainingContent: null,
    status: 'scheduled',
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

/** Standard LessonNote record */
function createLessonNoteRecord(
  overrides?: Partial<{
    id: string;
    classLessonId: string;
    coachId: string;
    content: string;
    createdAt: Date;
  }>,
) {
  return {
    id: 'lesson-note-uuid-1',
    classLessonId: 'class-lesson-uuid-1',
    coachId: 'user-uuid-coach',
    content: '今天步法训练效果不错，下次加强网前',
    createdAt: new Date('2026-04-15T16:30:00.000Z'),
    ...overrides,
  };
}

/** Standard StudentNote record */
function createStudentNoteRecord(
  overrides?: Partial<{
    id: string;
    coachId: string;
    studentId: string;
    studentClassId: string;
    content: string;
    createdAt: Date;
  }>,
) {
  return {
    id: 'student-note-uuid-1',
    coachId: 'user-uuid-coach',
    studentId: 'user-uuid-student',
    studentClassId: 'student-class-uuid-1',
    content: '步法需要加强，建议多练跳绳',
    createdAt: new Date('2026-04-15T16:30:00.000Z'),
    ...overrides,
  };
}

// ===========================================================================
// POST /api/student-classes/:id/lessons/:lessonId/notes — CoachingService.addClassLessonNote
// ===========================================================================

describe('POST /api/student-classes/:id/lessons/:lessonId/notes — CoachingService.addClassLessonNote', () => {
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

  // 业务规则: 仅学员班创建教练可添加课程笔记（PRD GB-10）
  // 业务规则: 追加模式，每次新增一条（PRD GB 规则 20）
  it('should add a note to a class lesson (append mode)', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );

    const result = await service.addClassLessonNote(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { content: '今天步法训练效果不错，下次加强网前' },
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: expect.any(String),
      classLessonId: 'class-lesson-uuid-1',
      coachId: 'user-uuid-coach',
      content: '今天步法训练效果不错，下次加强网前',
      createdAt: expect.any(Date),
    });
    expect(repo.createLessonNote).toHaveBeenCalled();
  });

  // 业务规则: 课程状态不为 cancelled 时可添加笔记（PRD GB 规则 20）
  it('should allow adding note when lesson is in_progress', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'in_progress' }),
    );

    const result = await service.addClassLessonNote(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { content: '进行中的笔记' },
    );

    expect(result).toBeDefined();
  });

  it('should allow adding note when lesson is completed', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'completed' }),
    );

    const result = await service.addClassLessonNote(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { content: '课后总结笔记' },
    );

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_NOTE_CONTENT
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_NOTE_CONTENT — 笔记内容为空（§4.1 - 错误码）
  it('should throw COACHING_INVALID_NOTE_CONTENT when content is empty', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );

    await expect(
      service.addClassLessonNote(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { content: '' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_NOTE_CONTENT',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_NOTE_CONTENT — 笔记内容超过 500 字符（PRD GB 规则 21）
  it('should throw COACHING_INVALID_NOTE_CONTENT when content exceeds 500 chars', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );

    const longContent = 'a'.repeat(501);
    await expect(
      service.addClassLessonNote(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { content: longContent },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_NOTE_CONTENT',
      statusCode: 400,
    });
  });

  // 边界: 恰好 500 字符应通过
  it('should accept note with exactly 500 characters', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'scheduled' }),
    );
    const content500 = 'a'.repeat(500);
    repo.createLessonNote.mockResolvedValue(
      createLessonNoteRecord({ content: content500 }),
    );

    const result = await service.addClassLessonNote(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
      { content: content500 },
    );

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_LESSON_CANCELLED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_LESSON_CANCELLED — 课程已取消（§4.1 - 错误码）
  it('should throw COACHING_LESSON_CANCELLED when lesson is cancelled', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(
      createClassLessonRecord({ status: 'cancelled' }),
    );

    await expect(
      service.addClassLessonNote(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { content: '尝试添加笔记' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_CANCELLED',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_CLASS_LESSON_NOT_FOUND / COACHING_STUDENT_CLASS_NOT_FOUND / COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  it('should throw COACHING_CLASS_LESSON_NOT_FOUND when lesson does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(null);

    await expect(
      service.addClassLessonNote(
        'user-uuid-coach',
        'student-class-uuid-1',
        'nonexistent-uuid',
        { content: '笔记内容' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_LESSON_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.addClassLessonNote(
        'user-uuid-coach',
        'nonexistent-uuid',
        'class-lesson-uuid-1',
        { content: '笔记内容' },
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
      service.addClassLessonNote(
        'user-uuid-coach',
        'student-class-uuid-1',
        'class-lesson-uuid-1',
        { content: '笔记内容' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/student-classes/:id/lessons/:lessonId/notes — CoachingService.getClassLessonNotes
// ===========================================================================

describe('GET /api/student-classes/:id/lessons/:lessonId/notes — CoachingService.getClassLessonNotes', () => {
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

  // 业务规则: 仅教练可查看（笔记仅教练可见）（PRD GB 规则 22, 29）
  // 业务规则: 按创建时间倒序展示（PRD GB 规则 22）
  it('should return lesson notes in reverse chronological order', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(createClassLessonRecord());
    const note1 = createLessonNoteRecord({
      id: 'note-1',
      createdAt: new Date('2026-04-15T16:00:00.000Z'),
    });
    const note2 = createLessonNoteRecord({
      id: 'note-2',
      createdAt: new Date('2026-04-15T16:30:00.000Z'),
    });
    repo.findLessonNotesByLessonId.mockResolvedValue([note2, note1]);

    const result = await service.getClassLessonNotes(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
    );

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      content: expect.any(String),
      createdAt: expect.any(Date),
    });
    // First item should be the most recent
    expect(result.items[0].createdAt.getTime()).toBeGreaterThan(
      result.items[1].createdAt.getTime(),
    );
  });

  it('should return empty list when no notes exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(createClassLessonRecord());
    repo.findLessonNotesByLessonId.mockResolvedValue([]);

    const result = await service.getClassLessonNotes(
      'user-uuid-coach',
      'student-class-uuid-1',
      'class-lesson-uuid-1',
    );

    expect(result.items).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw COACHING_CLASS_LESSON_NOT_FOUND when lesson does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findClassLessonById.mockResolvedValue(null);

    await expect(
      service.getClassLessonNotes('user-uuid-coach', 'student-class-uuid-1', 'nonexistent-uuid'),
    ).rejects.toMatchObject({
      code: 'COACHING_CLASS_LESSON_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.getClassLessonNotes('user-uuid-coach', 'nonexistent-uuid', 'class-lesson-uuid-1'),
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
      service.getClassLessonNotes('user-uuid-coach', 'student-class-uuid-1', 'class-lesson-uuid-1'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// POST /api/student-classes/:id/members/:studentId/notes — CoachingService.addStudentNote
// ===========================================================================

describe('POST /api/student-classes/:id/members/:studentId/notes — CoachingService.addStudentNote', () => {
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

  // 业务规则: 仅学员班创建教练可添加学员笔记（PRD GB-12）
  // 业务规则: 学员必须在该学员班中
  // 业务规则: 追加模式（PRD GB 规则 25）
  // 业务规则: 仅教练可见（PRD GB 规则 29）
  it('should add a student note', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    const result = await service.addStudentNote(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
      { content: '步法需要加强，建议多练跳绳' },
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      id: expect.any(String),
      coachId: 'user-uuid-coach',
      studentId: 'user-uuid-student',
      studentClassId: 'student-class-uuid-1',
      content: '步法需要加强，建议多练跳绳',
      createdAt: expect.any(Date),
    });
    expect(repo.createStudentNote).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_NOTE_CONTENT
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_NOTE_CONTENT — 笔记内容为空
  it('should throw COACHING_INVALID_NOTE_CONTENT when content is empty', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    await expect(
      service.addStudentNote(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
        { content: '' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_NOTE_CONTENT',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_NOTE_CONTENT — 笔记内容超过 500 字符
  it('should throw COACHING_INVALID_NOTE_CONTENT when content exceeds 500 chars', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    const longContent = 'a'.repeat(501);
    await expect(
      service.addStudentNote(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
        { content: longContent },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_NOTE_CONTENT',
      statusCode: 400,
    });
  });

  // 边界: 恰好 500 字符应通过
  it('should accept note with exactly 500 characters', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());
    const content500 = 'a'.repeat(500);
    repo.createStudentNote.mockResolvedValue(
      createStudentNoteRecord({ content: content500 }),
    );

    const result = await service.addStudentNote(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
      { content: content500 },
    );

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_NOT_IN_CLASS
  // -----------------------------------------------------------------------

  // 错误码: COACHING_STUDENT_NOT_IN_CLASS — 学员不在该班级中
  it('should throw COACHING_STUDENT_NOT_IN_CLASS when student is not a member', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(null);

    await expect(
      service.addStudentNote(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
        { content: '笔记内容' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_NOT_IN_CLASS',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_CLASS_NOT_FOUND / COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.addStudentNote(
        'user-uuid-coach',
        'nonexistent-uuid',
        'user-uuid-student',
        { content: '笔记内容' },
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
      service.addStudentNote(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
        { content: '笔记内容' },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/student-classes/:id/members/:studentId/notes — CoachingService.getStudentNotes
// ===========================================================================

describe('GET /api/student-classes/:id/members/:studentId/notes — CoachingService.getStudentNotes', () => {
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

  // 业务规则: 仅教练可查看（PRD GB 规则 29）
  // 业务规则: 按创建时间倒序展示
  it('should return student notes in reverse chronological order', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());
    const note1 = createStudentNoteRecord({
      id: 'note-1',
      createdAt: new Date('2026-04-15T14:00:00.000Z'),
    });
    const note2 = createStudentNoteRecord({
      id: 'note-2',
      createdAt: new Date('2026-04-15T16:00:00.000Z'),
    });
    repo.findStudentNotes.mockResolvedValue([note2, note1]);

    const result = await service.getStudentNotes(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
    );

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      content: expect.any(String),
      createdAt: expect.any(Date),
    });
  });

  it('should return empty list when no student notes exist', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());
    repo.findStudentNotes.mockResolvedValue([]);

    const result = await service.getStudentNotes(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
    );

    expect(result.items).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_NOT_IN_CLASS when student is not a member', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(null);

    await expect(
      service.getStudentNotes('user-uuid-coach', 'student-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_NOT_IN_CLASS',
      statusCode: 404,
    });
  });

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.getStudentNotes('user-uuid-coach', 'nonexistent-uuid', 'user-uuid-student'),
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
      service.getStudentNotes('user-uuid-coach', 'student-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// PUT /api/student-classes/:id/members/:studentId/tags — CoachingService.setStudentTags
// ===========================================================================

describe('PUT /api/student-classes/:id/members/:studentId/tags — CoachingService.setStudentTags', () => {
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

  // 业务规则: 仅学员班创建教练可设置学员标签（PRD GB-13）
  // 业务规则: 全量替换该学员在该学员班中的标签（PRD GB 规则 26）
  // 业务规则: 仅教练可见（PRD GB 规则 29）
  it('should set tags for a student in the class', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    const result = await service.setStudentTags(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
      { tags: ['左手', '进攻型', '需加强步法'] },
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      tags: ['左手', '进攻型', '需加强步法'],
    });
    expect(repo.setStudentTags).toHaveBeenCalled();
  });

  // 业务规则: 可以设置空数组清除所有标签
  it('should allow setting empty tags array', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    const result = await service.setStudentTags(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
      { tags: [] },
    );

    expect(result).toBeDefined();
    expect(result.tags).toHaveLength(0);
  });

  // 边界: 恰好 10 个标签应通过
  it('should accept exactly 10 tags', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    const tags10 = Array.from({ length: 10 }, (_, i) => `标签${i + 1}`);
    const result = await service.setStudentTags(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
      { tags: tags10 },
    );

    expect(result).toBeDefined();
  });

  // 边界: 单个标签恰好 20 字符应通过
  it('should accept tag with exactly 20 characters', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    const tag20 = 'a'.repeat(20);
    const result = await service.setStudentTags(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
      { tags: [tag20] },
    );

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TAGS
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TAGS — 标签超过 10 个（PRD GB 规则 28）
  it('should throw COACHING_INVALID_TAGS when more than 10 tags', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    const tags11 = Array.from({ length: 11 }, (_, i) => `标签${i + 1}`);
    await expect(
      service.setStudentTags(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
        { tags: tags11 },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TAGS',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_TAGS — 单个标签超过 20 字符（PRD GB 规则 27）
  it('should throw COACHING_INVALID_TAGS when a single tag exceeds 20 characters', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    const longTag = 'a'.repeat(21);
    await expect(
      service.setStudentTags(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
        { tags: [longTag] },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TAGS',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_TAGS — 单个标签为空字符串（PRD GB 规则 27）
  it('should throw COACHING_INVALID_TAGS when a tag is empty string', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());

    await expect(
      service.setStudentTags(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
        { tags: ['有效标签', ''] },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TAGS',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_NOT_IN_CLASS
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_NOT_IN_CLASS when student is not a member', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(null);

    await expect(
      service.setStudentTags(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
        { tags: ['标签'] },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_NOT_IN_CLASS',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_STUDENT_CLASS_NOT_FOUND / COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.setStudentTags(
        'user-uuid-coach',
        'nonexistent-uuid',
        'user-uuid-student',
        { tags: ['标签'] },
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
      service.setStudentTags(
        'user-uuid-coach',
        'student-class-uuid-1',
        'user-uuid-student',
        { tags: ['标签'] },
      ),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/student-classes/:id/members/:studentId/tags — CoachingService.getStudentTags
// ===========================================================================

describe('GET /api/student-classes/:id/members/:studentId/tags — CoachingService.getStudentTags', () => {
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

  // 业务规则: 仅教练可查看（PRD GB 规则 29）
  it('should return student tags', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());
    repo.findStudentTags.mockResolvedValue([
      { id: 'tag-1', tag: '左手' },
      { id: 'tag-2', tag: '进攻型' },
      { id: 'tag-3', tag: '需加强步法' },
    ]);

    const result = await service.getStudentTags(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      tags: expect.arrayContaining(['左手', '进攻型', '需加强步法']),
    });
  });

  it('should return empty tags when student has no tags', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(createMemberRecord());
    repo.findStudentTags.mockResolvedValue([]);

    const result = await service.getStudentTags(
      'user-uuid-coach',
      'student-class-uuid-1',
      'user-uuid-student',
    );

    expect(result.tags).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw COACHING_STUDENT_NOT_IN_CLASS when student is not a member', async () => {
    repo.findStudentClassById.mockResolvedValue(createStudentClassRecord());
    repo.findStudentClassMember.mockResolvedValue(null);

    await expect(
      service.getStudentTags('user-uuid-coach', 'student-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_STUDENT_NOT_IN_CLASS',
      statusCode: 404,
    });
  });

  it('should throw COACHING_STUDENT_CLASS_NOT_FOUND when class does not exist', async () => {
    repo.findStudentClassById.mockResolvedValue(null);

    await expect(
      service.getStudentTags('user-uuid-coach', 'nonexistent-uuid', 'user-uuid-student'),
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
      service.getStudentTags('user-uuid-coach', 'student-class-uuid-1', 'user-uuid-student'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});
