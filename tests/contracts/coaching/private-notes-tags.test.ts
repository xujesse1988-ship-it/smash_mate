/**
 * 契约测试: coaching 模块 — 固定私教课程笔记、学员笔记、标签、战绩集成
 * 覆盖接口:
 *   - POST /api/private-students/:id/lessons/:lessonId/notes (CoachingService.addPrivateLessonNote)
 *   - GET /api/private-students/:id/lessons/:lessonId/notes (CoachingService.getPrivateLessonNotes)
 *   - POST /api/private-students/:id/notes (CoachingService.addPrivateStudentNote)
 *   - GET /api/private-students/:id/notes (CoachingService.getPrivateStudentNotes)
 *   - PUT /api/private-students/:id/tags (CoachingService.setPrivateStudentTags)
 *   - GET /api/private-students/:id/tags (CoachingService.getPrivateStudentTags)
 *   - 战绩录入集成: sourceType='private_lesson_v2' 的课程状态校验
 *
 * 来源文档: docs/module-design/coaching-v2.md §4.2 固定私教学员（GC）+ §4.3 战绩录入集成
 *
 * Mock 策略:
 * - CoachingRepository: 全部 mock（隔离数据库依赖）
 * - UserService: mock getUserById / getUsersByIds（跨模块依赖）
 * - VenueService: mock getVenueById（跨模块依赖）
 * - NotificationService: mock create / createBatch（跨模块依赖）
 * - MatchRecordService 部分: mock 相关跨模块调用（战绩集成测试）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoachingService } from '@server/modules/coaching/service.js';
import { CoachingRepository } from '@server/modules/coaching/repository.js';
import { MatchRecordService } from '@server/modules/match-record/service.js';
import { MatchRecordRepository } from '@server/modules/match-record/repository.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COACH_USER_ID = 'user-uuid-coach';
const STUDENT_USER_ID = 'user-uuid-student';
const OTHER_USER_ID = 'user-uuid-other';
const PRIVATE_STUDENT_ID = 'private-student-uuid-1';
const LESSON_ID = 'private-lesson-v2-uuid-1';
const NOTE_ID = 'lesson-note-uuid-1';
const STUDENT_NOTE_ID = 'student-note-uuid-1';
const VENUE_ID = 'venue-uuid-1';
const MATCH_RECORD_ID = 'match-record-uuid-1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock CoachingRepository with all methods stubbed.
 */
function createMockCoachingRepository(): {
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
    createPrivateStudent: vi.fn().mockResolvedValue(undefined),
    reactivatePrivateStudent: vi.fn().mockResolvedValue(undefined),
    deactivatePrivateStudent: vi.fn().mockResolvedValue(undefined),
    findPrivateStudentsByCoach: vi.fn().mockResolvedValue([]),

    // -- v2: PrivateLessonV2 --
    createPrivateLessonV2: vi.fn().mockResolvedValue(undefined),
    findPrivateLessonV2ById: vi.fn().mockResolvedValue(null),
    findPrivateLessonsV2ByStudent: vi.fn().mockResolvedValue([]),
    updatePrivateLessonV2: vi.fn().mockResolvedValue(undefined),
    cancelPrivateLessonV2: vi.fn().mockResolvedValue(undefined),
    updatePrivateLessonV2TrainingContent: vi.fn().mockResolvedValue(undefined),

    // -- v2: status transitions --
    updateClassLessonsStarted: vi.fn().mockResolvedValue(0),
    updateClassLessonsCompleted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsV2Started: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsV2Completed: vi.fn().mockResolvedValue(0),

    // -- v2: Lesson notes --
    createLessonNote: vi.fn().mockResolvedValue(createLessonNoteRecord()),
    findLessonNotes: vi.fn().mockResolvedValue([]),

    // -- v2: Student notes --
    createStudentNote: vi.fn().mockResolvedValue(createStudentNoteRecord()),
    findStudentNotes: vi.fn().mockResolvedValue([]),

    // -- v2: Student tags --
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
 * Build a mock UserService.
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
 * Build a mock VenueService.
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
 * Build a mock NotificationService.
 */
function createMockNotificationService() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    createBatch: vi.fn().mockResolvedValue(undefined),
  };
}

/** Standard PrivateStudent record */
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

/** Standard PrivateLessonV2 record */
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
    status: 'in_progress',
    createdAt: new Date('2026-04-13T10:00:00.000Z'),
    updatedAt: new Date('2026-04-13T10:00:00.000Z'),
    ...overrides,
  };
}

/** Standard LessonNote record */
function createLessonNoteRecord(
  overrides?: Partial<{
    id: string;
    privateLessonId: string;
    classLessonId: string | null;
    coachId: string;
    content: string;
    createdAt: Date;
  }>,
) {
  return {
    id: NOTE_ID,
    privateLessonId: LESSON_ID,
    classLessonId: null,
    coachId: COACH_USER_ID,
    content: '今天反手有明显进步，网前注意力还需提高',
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
    privateStudentId: string | null;
    studentClassId: string | null;
    content: string;
    createdAt: Date;
  }>,
) {
  return {
    id: STUDENT_NOTE_ID,
    coachId: COACH_USER_ID,
    studentId: STUDENT_USER_ID,
    privateStudentId: PRIVATE_STUDENT_ID,
    studentClassId: null,
    content: '整体技术水平中上，需要重点加强体能',
    createdAt: new Date('2026-04-15T16:30:00.000Z'),
    ...overrides,
  };
}

// ===========================================================================
// POST /api/private-students/:id/lessons/:lessonId/notes — CoachingService.addPrivateLessonNote
// ===========================================================================

describe.skip('POST /api/private-students/:id/lessons/:lessonId/notes — CoachingService.addPrivateLessonNote', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockCoachingRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockCoachingRepository();
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

  // 业务规则: 课程非 cancelled 状态时可添加笔记，追加模式（§4.2 添加课程笔记 - 业务规则 / PRD GC 规则 11）
  it('should append a note to a non-cancelled lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'in_progress' }),
    );
    repo.createLessonNote.mockResolvedValue(createLessonNoteRecord());

    const result = await service.addPrivateLessonNote(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
      { content: '今天反手有明显进步，网前注意力还需提高' },
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(NOTE_ID);
    expect(result.privateLessonId).toBe(LESSON_ID);
    expect(result.content).toBe('今天反手有明显进步，网前注意力还需提高');
    expect(result).toHaveProperty('createdAt');
  });

  // 业务规则: scheduled 状态也可添加笔记
  it('should allow adding note to scheduled lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'scheduled' }),
    );
    repo.createLessonNote.mockResolvedValue(createLessonNoteRecord());

    const result = await service.addPrivateLessonNote(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
      { content: '课前备注' },
    );

    expect(result).toBeDefined();
  });

  // 业务规则: completed 状态也可添加笔记
  it('should allow adding note to completed lesson', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'completed' }),
    );
    repo.createLessonNote.mockResolvedValue(createLessonNoteRecord());

    const result = await service.addPrivateLessonNote(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
      { content: '课后总结' },
    );

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_NOTE_CONTENT — empty content
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_NOTE_CONTENT — 笔记内容为空（§4.2 添加课程笔记 - 错误码）
  it('should throw COACHING_INVALID_NOTE_CONTENT when content is empty', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'in_progress' }),
    );

    await expect(
      service.addPrivateLessonNote(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID, {
        content: '',
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_NOTE_CONTENT',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_NOTE_CONTENT — content > 500 chars
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_NOTE_CONTENT — 笔记内容超过 500 字符（§4.2 添加课程笔记 - 错误码）
  it('should throw COACHING_INVALID_NOTE_CONTENT when content exceeds 500 chars', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'in_progress' }),
    );

    await expect(
      service.addPrivateLessonNote(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID, {
        content: 'x'.repeat(501),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_NOTE_CONTENT',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_LESSON_CANCELLED
  // -----------------------------------------------------------------------

  // 错误码: COACHING_LESSON_CANCELLED — 已取消的课程不可添加笔记（§4.2 添加课程笔记 - 错误码）
  it('should throw COACHING_LESSON_CANCELLED when lesson is cancelled', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'cancelled' }),
    );

    await expect(
      service.addPrivateLessonNote(PRIVATE_STUDENT_ID, LESSON_ID, COACH_USER_ID, {
        content: '笔记内容',
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_LESSON_CANCELLED',
      statusCode: 409,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER — 非该私教学员的教练（§4.2 添加课程笔记 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.addPrivateLessonNote(PRIVATE_STUDENT_ID, LESSON_ID, 'other-coach-id', {
        content: '笔记内容',
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/private-students/:id/lessons/:lessonId/notes — CoachingService.getPrivateLessonNotes
// ===========================================================================

describe.skip('GET /api/private-students/:id/lessons/:lessonId/notes — CoachingService.getPrivateLessonNotes', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockCoachingRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockCoachingRepository();
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

  // 业务规则: 按创建时间倒序展示（§4.2 获取课程笔记列表 - 业务规则）
  it('should return lesson notes in reverse chronological order', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(createLessonRecord());
    repo.findLessonNotes.mockResolvedValue([
      createLessonNoteRecord({
        id: 'note-2',
        content: '第二条笔记',
        createdAt: new Date('2026-04-15T17:00:00.000Z'),
      }),
      createLessonNoteRecord({
        id: 'note-1',
        content: '第一条笔记',
        createdAt: new Date('2026-04-15T16:30:00.000Z'),
      }),
    ]);

    const result = await service.getPrivateLessonNotes(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
    );

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('note-2');
    expect(result.items[1].id).toBe('note-1');
  });

  // 业务规则: 空列表
  it('should return empty list when no notes exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(createLessonRecord());
    repo.findLessonNotes.mockResolvedValue([]);

    const result = await service.getPrivateLessonNotes(
      PRIVATE_STUDENT_ID,
      LESSON_ID,
      COACH_USER_ID,
    );

    expect(result.items).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_STUDENT_NOT_FOUND（§4.2 获取课程笔记列表 - 错误码）
  it('should throw COACHING_PRIVATE_STUDENT_NOT_FOUND when student does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(null);

    await expect(
      service.getPrivateLessonNotes('nonexistent-uuid', LESSON_ID, COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 错误码: COACHING_PRIVATE_LESSON_V2_NOT_FOUND（§4.2 获取课程笔记列表 - 错误码）
  it('should throw COACHING_PRIVATE_LESSON_V2_NOT_FOUND when lesson does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findPrivateLessonV2ById.mockResolvedValue(null);

    await expect(
      service.getPrivateLessonNotes(PRIVATE_STUDENT_ID, 'nonexistent-uuid', COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_LESSON_V2_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// POST /api/private-students/:id/notes — CoachingService.addPrivateStudentNote
// ===========================================================================

describe.skip('POST /api/private-students/:id/notes — CoachingService.addPrivateStudentNote', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockCoachingRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockCoachingRepository();
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

  // 业务规则: 追加模式，新增学员笔记（§4.2 添加学员笔记 - 业务规则 / PRD GC-9）
  it('should add a student note', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.createStudentNote.mockResolvedValue(createStudentNoteRecord());

    const result = await service.addPrivateStudentNote(
      PRIVATE_STUDENT_ID,
      COACH_USER_ID,
      { content: '整体技术水平中上，需要重点加强体能' },
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(STUDENT_NOTE_ID);
    expect(result.coachId).toBe(COACH_USER_ID);
    expect(result.studentId).toBe(STUDENT_USER_ID);
    expect(result.privateStudentId).toBe(PRIVATE_STUDENT_ID);
    expect(result.content).toBe('整体技术水平中上，需要重点加强体能');
    expect(result).toHaveProperty('createdAt');
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_NOTE_CONTENT — empty
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_NOTE_CONTENT — 笔记为空（§4.2 添加学员笔记 - 错误码）
  it('should throw COACHING_INVALID_NOTE_CONTENT when content is empty', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.addPrivateStudentNote(PRIVATE_STUDENT_ID, COACH_USER_ID, { content: '' }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_NOTE_CONTENT',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_NOTE_CONTENT — > 500 chars
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_NOTE_CONTENT — 笔记超过 500 字符（§4.2 添加学员笔记 - 错误码）
  it('should throw COACHING_INVALID_NOTE_CONTENT when content exceeds 500 chars', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.addPrivateStudentNote(PRIVATE_STUDENT_ID, COACH_USER_ID, {
        content: 'x'.repeat(501),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_NOTE_CONTENT',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_PRIVATE_STUDENT_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_STUDENT_NOT_FOUND（§4.2 添加学员笔记 - 错误码）
  it('should throw COACHING_PRIVATE_STUDENT_NOT_FOUND when student does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(null);

    await expect(
      service.addPrivateStudentNote('nonexistent-uuid', COACH_USER_ID, {
        content: '笔记内容',
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER（§4.2 添加学员笔记 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.addPrivateStudentNote(PRIVATE_STUDENT_ID, 'other-coach-id', {
        content: '笔记内容',
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/private-students/:id/notes — CoachingService.getPrivateStudentNotes
// ===========================================================================

describe.skip('GET /api/private-students/:id/notes — CoachingService.getPrivateStudentNotes', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockCoachingRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockCoachingRepository();
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

  // 业务规则: 按创建时间倒序展示（§4.2 获取学员笔记列表 - 业务规则 / PRD GC 规则 14）
  it('should return student notes in reverse chronological order', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findStudentNotes.mockResolvedValue([
      createStudentNoteRecord({
        id: 'note-2',
        content: '第二条笔记',
        createdAt: new Date('2026-04-16T10:00:00.000Z'),
      }),
      createStudentNoteRecord({
        id: 'note-1',
        content: '第一条笔记',
        createdAt: new Date('2026-04-15T16:30:00.000Z'),
      }),
    ]);

    const result = await service.getPrivateStudentNotes(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('note-2');
  });

  // 业务规则: 空列表
  it('should return empty list when no student notes exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findStudentNotes.mockResolvedValue([]);

    const result = await service.getPrivateStudentNotes(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(result.items).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_STUDENT_NOT_FOUND（§4.2 获取学员笔记列表 - 错误码）
  it('should throw COACHING_PRIVATE_STUDENT_NOT_FOUND when student does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(null);

    await expect(
      service.getPrivateStudentNotes('nonexistent-uuid', COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 错误码: COACHING_NOT_COACH_OWNER（§4.2 获取学员笔记列表 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.getPrivateStudentNotes(PRIVATE_STUDENT_ID, 'other-coach-id'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// PUT /api/private-students/:id/tags — CoachingService.setPrivateStudentTags
// ===========================================================================

describe.skip('PUT /api/private-students/:id/tags — CoachingService.setPrivateStudentTags', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockCoachingRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockCoachingRepository();
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

  // 业务规则: 全量替换标签（§4.2 设置学员标签 - 业务规则 / PRD GC-10）
  it('should set tags array for a private student', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.setStudentTags.mockResolvedValue(undefined);
    repo.findStudentTags.mockResolvedValue([
      { tag: '右手' },
      { tag: '防守型' },
      { tag: '体能好' },
    ]);

    const result = await service.setPrivateStudentTags(
      PRIVATE_STUDENT_ID,
      COACH_USER_ID,
      { tags: ['右手', '防守型', '体能好'] },
    );

    expect(result).toBeDefined();
    expect(result.tags).toEqual(['右手', '防守型', '体能好']);
    expect(repo.setStudentTags).toHaveBeenCalled();
  });

  // 业务规则: 传空数组清空标签
  it('should allow clearing tags with empty array', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.setStudentTags.mockResolvedValue(undefined);
    repo.findStudentTags.mockResolvedValue([]);

    const result = await service.setPrivateStudentTags(
      PRIVATE_STUDENT_ID,
      COACH_USER_ID,
      { tags: [] },
    );

    expect(result).toBeDefined();
    expect(result.tags).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TAGS — > 10 tags
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TAGS — 超过 10 个标签（§4.2 设置学员标签 - 错误码 / PRD GC 规则 14）
  it('should throw COACHING_INVALID_TAGS when more than 10 tags', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.setPrivateStudentTags(PRIVATE_STUDENT_ID, COACH_USER_ID, {
        tags: Array.from({ length: 11 }, (_, i) => `标签${i}`),
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TAGS',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_INVALID_TAGS — single tag > 20 chars
  // -----------------------------------------------------------------------

  // 错误码: COACHING_INVALID_TAGS — 单个标签超过 20 字符（§4.2 设置学员标签 - 错误码）
  it('should throw COACHING_INVALID_TAGS when a single tag exceeds 20 chars', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.setPrivateStudentTags(PRIVATE_STUDENT_ID, COACH_USER_ID, {
        tags: ['x'.repeat(21)],
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TAGS',
      statusCode: 400,
    });
  });

  // 错误码: COACHING_INVALID_TAGS — 单个标签为空字符串（§4.2 设置学员标签 - 错误码）
  it('should throw COACHING_INVALID_TAGS when a tag is empty string', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.setPrivateStudentTags(PRIVATE_STUDENT_ID, COACH_USER_ID, {
        tags: ['正常标签', ''],
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_INVALID_TAGS',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_PRIVATE_STUDENT_NOT_FOUND
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_STUDENT_NOT_FOUND（§4.2 设置学员标签 - 错误码）
  it('should throw COACHING_PRIVATE_STUDENT_NOT_FOUND when student does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(null);

    await expect(
      service.setPrivateStudentTags('nonexistent-uuid', COACH_USER_ID, {
        tags: ['标签'],
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: COACHING_NOT_COACH_OWNER
  // -----------------------------------------------------------------------

  // 错误码: COACHING_NOT_COACH_OWNER（§4.2 设置学员标签 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.setPrivateStudentTags(PRIVATE_STUDENT_ID, 'other-coach-id', {
        tags: ['标签'],
      }),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/private-students/:id/tags — CoachingService.getPrivateStudentTags
// ===========================================================================

describe.skip('GET /api/private-students/:id/tags — CoachingService.getPrivateStudentTags', () => {
  let service: CoachingService;
  let repo: ReturnType<typeof createMockCoachingRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let venueService: ReturnType<typeof createMockVenueService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    repo = createMockCoachingRepository();
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

  // 业务规则: 返回学员标签列表（§4.2 获取学员标签 - 业务规则 / PRD GC 规则 14）
  it('should return tags for a private student', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findStudentTags.mockResolvedValue([
      { tag: '右手' },
      { tag: '防守型' },
    ]);

    const result = await service.getPrivateStudentTags(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(result).toBeDefined();
    expect(result.tags).toEqual(['右手', '防守型']);
  });

  // 业务规则: 无标签时返回空数组
  it('should return empty tags array when no tags exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());
    repo.findStudentTags.mockResolvedValue([]);

    const result = await service.getPrivateStudentTags(PRIVATE_STUDENT_ID, COACH_USER_ID);

    expect(result.tags).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  // 错误码: COACHING_PRIVATE_STUDENT_NOT_FOUND（§4.2 获取学员标签 - 错误码）
  it('should throw COACHING_PRIVATE_STUDENT_NOT_FOUND when student does not exist', async () => {
    repo.findPrivateStudentById.mockResolvedValue(null);

    await expect(
      service.getPrivateStudentTags('nonexistent-uuid', COACH_USER_ID),
    ).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 错误码: COACHING_NOT_COACH_OWNER（§4.2 获取学员标签 - 错误码）
  it('should throw COACHING_NOT_COACH_OWNER when user is not the coach', async () => {
    repo.findPrivateStudentById.mockResolvedValue(createPrivateStudentRecord());

    await expect(
      service.getPrivateStudentTags(PRIVATE_STUDENT_ID, 'other-coach-id'),
    ).rejects.toMatchObject({
      code: 'COACHING_NOT_COACH_OWNER',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// 战绩录入集成: sourceType='private_lesson_v2' — MatchRecordService + CoachingService
// ===========================================================================

describe.skip('Match Record Integration — sourceType=private_lesson_v2', () => {
  let matchRecordService: MatchRecordService;
  let matchRecordRepo: ReturnType<typeof createMockMatchRecordRepository>;
  let mockCoachingService: ReturnType<typeof createMockCoachingServiceForMatchRecord>;
  let mockActivityService: ReturnType<typeof createMockActivityService>;
  let mockUserService: ReturnType<typeof createMockUserService>;

  function createMockMatchRecordRepository(): {
    [K in keyof MatchRecordRepository]: ReturnType<typeof vi.fn>;
  } {
    return {
      create: vi.fn().mockResolvedValue(createMatchRecordResult()),
      findById: vi.fn().mockResolvedValue(null),
      deleteById: vi.fn().mockResolvedValue(undefined),
      findBySource: vi.fn().mockResolvedValue([]),
      findByUser: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getUserMatchStats: vi.fn().mockResolvedValue({
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      }),
      createGuestPlayer: vi.fn().mockResolvedValue({
        id: 'guest-player-uuid-1',
        nickname: '临时球友A',
        createdAt: new Date(),
      }),
    };
  }

  function createMockActivityService() {
    return {
      getActivityById: vi.fn().mockResolvedValue(null),
      getParticipantIds: vi.fn().mockResolvedValue([]),
    };
  }

  function createMockCoachingServiceForMatchRecord() {
    return {
      getGroupClassById: vi.fn().mockResolvedValue(null),
      getPrivateLessonById: vi.fn().mockResolvedValue(null),
      getParticipantIds: vi.fn().mockResolvedValue([]),
      getPrivateLessonV2ById: vi.fn().mockResolvedValue(null),
      getClassLessonById: vi.fn().mockResolvedValue(null),
      getClassLessonParticipantIds: vi.fn().mockResolvedValue([]),
    };
  }

  function createMatchRecordResult() {
    return {
      id: MATCH_RECORD_ID,
      sourceType: 'private_lesson_v2',
      sourceId: LESSON_ID,
      matchType: 'singles',
      result: 'A_WIN',
      recordedBy: COACH_USER_ID,
      createdAt: new Date('2026-04-15T16:00:00.000Z'),
      updatedAt: new Date('2026-04-15T16:00:00.000Z'),
      players: [],
      games: [],
    };
  }

  function validMatchRecordInput() {
    return {
      sourceType: 'private_lesson_v2' as const,
      sourceId: LESSON_ID,
      matchType: 'singles' as const,
      players: {
        sideA: [{ userId: STUDENT_USER_ID }],
        sideB: [{ userId: OTHER_USER_ID }],
      },
      games: [{ scoreA: 21, scoreB: 15 }],
    };
  }

  beforeEach(() => {
    matchRecordRepo = createMockMatchRecordRepository();
    mockCoachingService = createMockCoachingServiceForMatchRecord();
    mockActivityService = createMockActivityService();
    mockUserService = createMockUserService();
    matchRecordService = new MatchRecordService(
      matchRecordRepo as unknown as MatchRecordRepository,
      mockActivityService as any,
      mockCoachingService as any,
      mockUserService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程: 战绩可关联 private_lesson_v2
  // -----------------------------------------------------------------------

  // 业务规则: 战绩可关联 sourceType='private_lesson_v2'，课程 in_progress 时可录入（§4.3 战绩录入集成）
  it('should allow creating match record when private lesson is in_progress', async () => {
    mockCoachingService.getPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'in_progress' }),
    );
    mockUserService.getUsersByIds.mockResolvedValue([
      { id: STUDENT_USER_ID, nickname: '学员小王', avatarUrl: null },
      { id: OTHER_USER_ID, nickname: '对手小李', avatarUrl: null },
    ]);
    matchRecordRepo.create.mockResolvedValue(createMatchRecordResult());

    const result = await matchRecordService.createMatchRecord(
      COACH_USER_ID,
      validMatchRecordInput(),
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(MATCH_RECORD_ID);
  });

  // 业务规则: 课程 completed 时也可录入战绩（§4.3 战绩录入集成）
  it('should allow creating match record when private lesson is completed', async () => {
    mockCoachingService.getPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'completed' }),
    );
    mockUserService.getUsersByIds.mockResolvedValue([
      { id: STUDENT_USER_ID, nickname: '学员小王', avatarUrl: null },
      { id: OTHER_USER_ID, nickname: '对手小李', avatarUrl: null },
    ]);
    matchRecordRepo.create.mockResolvedValue(createMatchRecordResult());

    const result = await matchRecordService.createMatchRecord(
      COACH_USER_ID,
      validMatchRecordInput(),
    );

    expect(result).toBeDefined();
  });

  // 业务规则: 对手可以是任意平台用户，不限于私教学员（§4.3 战绩录入集成 / PRD GC 规则 12）
  it('should allow any platform user as match opponent (not restricted to the private student)', async () => {
    mockCoachingService.getPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'completed' }),
    );
    const randomUserId = 'user-uuid-random-player';
    mockUserService.getUsersByIds.mockResolvedValue([
      { id: STUDENT_USER_ID, nickname: '学员小王', avatarUrl: null },
      { id: randomUserId, nickname: '路人甲', avatarUrl: null },
    ]);
    matchRecordRepo.create.mockResolvedValue(createMatchRecordResult());

    const input = {
      ...validMatchRecordInput(),
      players: {
        sideA: [{ userId: STUDENT_USER_ID }],
        sideB: [{ userId: randomUserId }],
      },
    };

    const result = await matchRecordService.createMatchRecord(COACH_USER_ID, input);

    expect(result).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 异常流程: MATCH_RECORD_LESSON_NOT_STARTED
  // -----------------------------------------------------------------------

  // 错误码: MATCH_RECORD_LESSON_NOT_STARTED — 课程状态为 scheduled 不可录入战绩（§4.3 战绩录入集成）
  it('should throw MATCH_RECORD_LESSON_NOT_STARTED when lesson is scheduled', async () => {
    mockCoachingService.getPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'scheduled' }),
    );

    await expect(
      matchRecordService.createMatchRecord(COACH_USER_ID, validMatchRecordInput()),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_LESSON_NOT_STARTED',
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程: MATCH_RECORD_LESSON_CANCELLED
  // -----------------------------------------------------------------------

  // 错误码: MATCH_RECORD_LESSON_CANCELLED — 课程状态为 cancelled 不可录入战绩（§4.3 战绩录入集成）
  it('should throw MATCH_RECORD_LESSON_CANCELLED when lesson is cancelled', async () => {
    mockCoachingService.getPrivateLessonV2ById.mockResolvedValue(
      createLessonRecord({ status: 'cancelled' }),
    );

    await expect(
      matchRecordService.createMatchRecord(COACH_USER_ID, validMatchRecordInput()),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_LESSON_CANCELLED',
    });
  });
});
