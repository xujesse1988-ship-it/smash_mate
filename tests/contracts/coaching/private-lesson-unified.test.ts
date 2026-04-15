/**
 * 契约测试: coaching 模块 — 统一 PrivateLesson 接口
 *
 * 覆盖接口（设计文档 docs/redesign/coach-student-unified.md §4.3）:
 *   - POST /api/coaches/:id/availability       (CoachingService.createAvailability)
 *   - GET  /api/coaches/:id/availability       (CoachingService.getCoachAvailability)
 *   - POST /api/private-lessons/:id/book       (CoachingService.bookLesson)
 *   - GET  /api/private-lessons/:id            (CoachingService.getPrivateLessonDetail)
 *   - PUT  /api/private-lessons/:id            (CoachingService.updatePrivateLesson)
 *   - POST /api/private-lessons/:id/cancel     (CoachingService.cancelPrivateLesson)
 *   - PUT  /api/private-lessons/:id/training-content
 *                                              (CoachingService.updatePrivateLessonTrainingContent)
 *   - POST /api/private-lessons/:id/notes      (CoachingService.addPrivateLessonNote)
 *   - GET  /api/private-lessons/:id/notes      (CoachingService.getPrivateLessonNotes)
 *
 * Mock 策略: CoachingRepository / UserService / VenueService / NotificationService
 * 全部 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoachingService } from '@server/modules/coaching/service.js';
import { CoachingRepository } from '@server/modules/coaching/repository.js';

const COACH_ID = 'coach-uuid-1';
const STUDENT_ID = 'student-uuid-1';
const OTHER_ID = 'other-uuid-1';
const LESSON_ID = 'pl-uuid-1';
const VENUE_ID = 'venue-uuid-1';

function futureIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
function futureDate(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function createMockRepository() {
  return {
    findCoachProfile: vi.fn().mockResolvedValue(null),
    createCoachProfile: vi.fn().mockResolvedValue(undefined),
    updateCoachProfile: vi.fn().mockResolvedValue(undefined),
    findCoachList: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findCoachPrivateLessons: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findGroupClassesByCoach: vi.fn().mockResolvedValue([]),
    getBatchCoachStudentCounts: vi.fn().mockResolvedValue(new Map()),
    createGroupClass: vi.fn().mockResolvedValue(undefined),
    findGroupClassById: vi.fn().mockResolvedValue(null),
    updateGroupClass: vi.fn().mockResolvedValue(undefined),
    enrollGroupClass: vi.fn().mockResolvedValue(undefined),
    cancelEnrollment: vi.fn().mockResolvedValue(undefined),
    createPrivateLesson: vi.fn().mockResolvedValue(undefined),
    createPrivateLessonSlots: vi.fn().mockResolvedValue([]),
    findAvailability: vi.fn().mockResolvedValue([]),
    bookPrivateLesson: vi.fn().mockResolvedValue(undefined),
    cancelPrivateLesson: vi.fn().mockResolvedValue(undefined),
    findPrivateLessonById: vi.fn().mockResolvedValue(null),
    updatePrivateLesson: vi.fn().mockResolvedValue(undefined),
    updatePrivateLessonTrainingContent: vi.fn().mockResolvedValue(undefined),
    findPrivateLessonsByStudent: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findUserEnrollments: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getGroupClassParticipantIds: vi.fn().mockResolvedValue([]),
    getPrivateLessonParticipantIds: vi.fn().mockResolvedValue([]),
    markSlotsExpired: vi.fn().mockResolvedValue(0),
    markPrivateLessonsInProgress: vi.fn().mockResolvedValue([]),
    markPrivateLessonsCompleted: vi.fn().mockResolvedValue(0),
    deleteExpiredSlots: vi.fn().mockResolvedValue(0),
    updateGroupClassesStarted: vi.fn().mockResolvedValue([]),
    findEnrollmentsByGroupClassIds: vi.fn().mockResolvedValue([]),
    updateGroupClassesCompleted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsStarted: vi.fn().mockResolvedValue(0),
    updatePrivateLessonsCompleted: vi.fn().mockResolvedValue(0),
    findScheduledClassLessonsToStart: vi.fn().mockResolvedValue([]),
    findInProgressClassLessonsToEnd: vi.fn().mockResolvedValue([]),
    updateClassLessonsStarted: vi.fn().mockResolvedValue(0),
    updateClassLessonsCompleted: vi.fn().mockResolvedValue(0),
    createCoachApplication: vi.fn().mockResolvedValue(undefined),
    findLatestApplicationByUser: vi.fn().mockResolvedValue(null),
    findCoachApplicationById: vi.fn().mockResolvedValue(null),
    findCoachApplications: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    updateCoachApplication: vi.fn().mockResolvedValue(undefined),
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
    createClassLesson: vi.fn().mockResolvedValue(undefined),
    findClassLessonById: vi.fn().mockResolvedValue(null),
    findClassLessonsByClassId: vi.fn().mockResolvedValue([]),
    updateClassLesson: vi.fn().mockResolvedValue(undefined),
    getStudentClassMemberIds: vi.fn().mockResolvedValue([]),
    createCoachStudent: vi.fn().mockResolvedValue(undefined),
    recordCoachStudents: vi.fn().mockResolvedValue(0),
    findCoachStudentByCoachAndStudent: vi.fn().mockResolvedValue(null),
    findCoachStudentDetail: vi.fn().mockResolvedValue(null),
    findCoachStudents: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findCoachStudentTagsList: vi.fn().mockResolvedValue([]),
    findAllCoachCustomTags: vi.fn().mockResolvedValue([]),
    setCoachStudentTags: vi.fn().mockResolvedValue([]),
    findStudentIdsWithTag: vi.fn().mockResolvedValue([]),
    findStudentClassesForStudents: vi.fn().mockResolvedValue(new Map()),
    findStudentIdsWhoTookGroupClass: vi.fn().mockResolvedValue(new Set()),
    findStudentIdsWhoTookPrivateLesson: vi.fn().mockResolvedValue(new Set()),
    createLessonNote: vi.fn().mockResolvedValue(undefined),
    findLessonNotes: vi.fn().mockResolvedValue([]),
  };
}

function createMockUserService() {
  return {
    getUserById: vi.fn().mockResolvedValue({
      id: COACH_ID,
      nickname: '教练张',
      avatarUrl: null,
      bio: null,
      isCoach: true,
      phone: '13800001234',
    }),
    getUsersByIds: vi.fn().mockResolvedValue([]),
    getUserByPhone: vi.fn().mockResolvedValue(null),
  };
}

function createMockVenueService() {
  return {
    getVenueById: vi.fn().mockResolvedValue({
      id: VENUE_ID,
      name: '朝阳体育中心',
      address: '北京市朝阳区',
      latitude: 39.9,
      longitude: 116.4,
    }),
  };
}

function createMockNotificationService() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    createBatch: vi.fn().mockResolvedValue(undefined),
  };
}

function buildService() {
  const repo = createMockRepository();
  const userService = createMockUserService();
  const venueService = createMockVenueService();
  const notificationService = createMockNotificationService();
  const service = new CoachingService(
    repo as unknown as CoachingRepository,
    userService,
    venueService,
    notificationService,
  );
  return { service, repo, userService, venueService, notificationService };
}

function lessonRecord(
  overrides: Partial<{
    id: string;
    coachId: string;
    studentId: string | null;
    venueId: string | null;
    venueIds: string[];
    startTime: Date;
    endTime: Date;
    feeDescription: string | null;
    trainingContent: string | null;
    source: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: LESSON_ID,
    coachId: COACH_ID,
    studentId: null as string | null,
    venueId: null as string | null,
    venueIds: [] as string[],
    startTime: futureDate(48),
    endTime: futureDate(50),
    feeDescription: null as string | null,
    trainingContent: null as string | null,
    source: null as string | null,
    status: 'scheduled',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    ...overrides,
  };
}

// ===========================================================================
// POST /api/coaches/:id/availability — createAvailability
// ===========================================================================

describe('POST /api/coaches/:id/availability — CoachingService.createAvailability', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('creates a single open slot (studentId=null, source=null)', async () => {
    ctx.repo.createPrivateLessonSlots.mockResolvedValue([lessonRecord({ id: 'slot-1' })]);

    const result = await ctx.service.createAvailability(COACH_ID, {
      slots: [
        {
          startTime: futureIso(48),
          endTime: futureIso(50),
          venueIds: [VENUE_ID],
          feeDescription: '200元/小时',
        },
      ],
    });

    expect(result.slots).toHaveLength(1);
    expect(ctx.repo.createPrivateLessonSlots).toHaveBeenCalledWith([
      expect.objectContaining({
        coachId: COACH_ID,
        venueIds: [VENUE_ID],
        feeDescription: '200元/小时',
      }),
    ]);
  });

  it('creates multiple slots in batch', async () => {
    ctx.repo.createPrivateLessonSlots.mockResolvedValue([
      lessonRecord({ id: 'slot-1' }),
      lessonRecord({ id: 'slot-2' }),
    ]);

    const result = await ctx.service.createAvailability(COACH_ID, {
      slots: [
        { startTime: futureIso(48), endTime: futureIso(50) },
        { startTime: futureIso(72), endTime: futureIso(74) },
      ],
    });

    expect(result.slots).toHaveLength(2);
  });

  it('rejects if caller is not a coach (403)', async () => {
    ctx.userService.getUserById.mockResolvedValue({
      id: COACH_ID,
      nickname: '普通用户',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await expect(
      ctx.service.createAvailability(COACH_ID, {
        slots: [{ startTime: futureIso(48), endTime: futureIso(50) }],
      }),
    ).rejects.toMatchObject({ code: 'COACHING_COACH_ROLE_REQUIRED', statusCode: 403 });
  });

  it('rejects empty slot list', async () => {
    await expect(ctx.service.createAvailability(COACH_ID, { slots: [] })).rejects.toMatchObject({
      code: 'COACHING_INVALID_SLOTS',
      statusCode: 400,
    });
  });

  it('rejects overlapping slots within the same batch', async () => {
    await expect(
      ctx.service.createAvailability(COACH_ID, {
        slots: [
          { startTime: futureIso(48), endTime: futureIso(50) },
          { startTime: futureIso(49), endTime: futureIso(51) },
        ],
      }),
    ).rejects.toMatchObject({ code: 'COACHING_SLOT_OVERLAP', statusCode: 409 });
  });
});

// ===========================================================================
// GET /api/coaches/:id/availability — getCoachAvailability (public)
// ===========================================================================

describe('GET /api/coaches/:id/availability — CoachingService.getCoachAvailability', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('returns open slots from the unified PrivateLesson table', async () => {
    ctx.repo.findAvailability.mockResolvedValue([
      {
        id: 'slot-1',
        startTime: futureDate(48),
        endTime: futureDate(50),
        venueIds: [VENUE_ID],
        feeDescription: '200元/小时',
      },
    ]);

    const result = await ctx.service.getCoachAvailability(COACH_ID);

    expect(result.slots).toHaveLength(1);
    expect(result.slots[0]).toMatchObject({ id: 'slot-1', isBooked: false });
  });

  it('rejects when target user is not a coach (404)', async () => {
    ctx.userService.getUserById.mockResolvedValue({
      id: COACH_ID,
      nickname: '普通用户',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await expect(ctx.service.getCoachAvailability(COACH_ID)).rejects.toMatchObject({
      code: 'COACHING_NOT_A_COACH',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// POST /api/private-lessons/:id/book — bookLesson
// ===========================================================================

describe('POST /api/private-lessons/:id/book — CoachingService.bookLesson', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('books an open slot atomically (status scheduled, source becomes booked)', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: null, source: null, status: 'scheduled' }),
    );
    ctx.repo.bookPrivateLesson.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked' }),
    );

    const result = await ctx.service.bookLesson(LESSON_ID, STUDENT_ID);

    expect(result.studentId).toBe(STUDENT_ID);
    expect(result.source).toBe('booked');
    expect(ctx.repo.bookPrivateLesson).toHaveBeenCalledWith(LESSON_ID, STUDENT_ID, null);
  });

  it('rejects when slot is already booked (409 COACHING_SLOT_ALREADY_BOOKED)', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: 'someone-else', source: 'booked' }),
    );

    await expect(ctx.service.bookLesson(LESSON_ID, STUDENT_ID)).rejects.toMatchObject({
      code: 'COACHING_SLOT_ALREADY_BOOKED',
      statusCode: 409,
    });
  });

  it('rejects when slot has expired (startTime <= now)', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({
        studentId: null,
        source: null,
        startTime: new Date(Date.now() - 60 * 60 * 1000),
      }),
    );

    await expect(ctx.service.bookLesson(LESSON_ID, STUDENT_ID)).rejects.toMatchObject({
      code: 'COACHING_SLOT_EXPIRED',
      statusCode: 409,
    });
  });

  it('rejects when slot status is not scheduled (e.g. expired/cancelled)', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: null, source: null, status: 'expired' }),
    );

    await expect(ctx.service.bookLesson(LESSON_ID, STUDENT_ID)).rejects.toMatchObject({
      code: 'COACHING_SLOT_ALREADY_BOOKED',
      statusCode: 409,
    });
  });

  it('rejects when coach tries to book own slot (403)', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: null, source: null }),
    );

    await expect(ctx.service.bookLesson(LESSON_ID, COACH_ID)).rejects.toMatchObject({
      code: 'COACHING_CANNOT_BOOK_OWN_LESSON',
      statusCode: 403,
    });
  });
});

// ===========================================================================
// GET /api/private-lessons/:id — getPrivateLessonDetail
// ===========================================================================

describe('GET /api/private-lessons/:id — CoachingService.getPrivateLessonDetail', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('coach can view their own lesson', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked' }),
    );

    const result = await ctx.service.getPrivateLessonDetail(LESSON_ID, COACH_ID);
    expect(result.id).toBe(LESSON_ID);
  });

  it('student can view lessons they participate in', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked' }),
    );

    const result = await ctx.service.getPrivateLessonDetail(LESSON_ID, STUDENT_ID);
    expect(result.id).toBe(LESSON_ID);
  });

  it('third party gets 403 COACHING_NOT_LESSON_PARTICIPANT', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked' }),
    );

    await expect(ctx.service.getPrivateLessonDetail(LESSON_ID, OTHER_ID)).rejects.toMatchObject({
      code: 'COACHING_NOT_LESSON_PARTICIPANT',
      statusCode: 403,
    });
  });

  it('returns 404 COACHING_PRIVATE_LESSON_NOT_FOUND when missing', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(null);

    await expect(ctx.service.getPrivateLessonDetail(LESSON_ID, COACH_ID)).rejects.toMatchObject({
      code: 'COACHING_PRIVATE_LESSON_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// PUT /api/private-lessons/:id — updatePrivateLesson (coach only)
// ===========================================================================

describe('PUT /api/private-lessons/:id — CoachingService.updatePrivateLesson', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('coach can update venue / time / feeDescription on a scheduled lesson', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'scheduled' }),
    );
    ctx.repo.updatePrivateLesson.mockResolvedValue(
      lessonRecord({
        studentId: STUDENT_ID,
        source: 'booked',
        venueId: VENUE_ID,
        feeDescription: '300元/小时',
      }),
    );

    const result = await ctx.service.updatePrivateLesson(LESSON_ID, COACH_ID, {
      venueId: VENUE_ID,
      feeDescription: '300元/小时',
    });

    expect(result).toBeDefined();
    expect(ctx.repo.updatePrivateLesson).toHaveBeenCalled();
  });

  it('non-owner coach (or third party) gets 403 COACHING_NOT_COACH_OWNER', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked' }),
    );

    await expect(
      ctx.service.updatePrivateLesson(LESSON_ID, OTHER_ID, { feeDescription: 'x' }),
    ).rejects.toMatchObject({ code: 'COACHING_NOT_COACH_OWNER', statusCode: 403 });
  });

  it('rejects when lesson is no longer scheduled (in_progress / completed / cancelled)', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'in_progress' }),
    );

    await expect(
      ctx.service.updatePrivateLesson(LESSON_ID, COACH_ID, { feeDescription: 'x' }),
    ).rejects.toMatchObject({ code: 'COACHING_LESSON_NOT_EDITABLE', statusCode: 409 });
  });
});

// ===========================================================================
// POST /api/private-lessons/:id/cancel — cancelPrivateLesson
// ===========================================================================

describe('POST /api/private-lessons/:id/cancel — CoachingService.cancelPrivateLesson', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('coach can cancel a scheduled lesson', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'scheduled' }),
    );

    const result = await ctx.service.cancelPrivateLesson(LESSON_ID, COACH_ID);
    expect(result.status).toBe('cancelled');
    expect(ctx.repo.cancelPrivateLesson).toHaveBeenCalledWith(LESSON_ID);
  });

  it('student can cancel a scheduled lesson', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'scheduled' }),
    );

    const result = await ctx.service.cancelPrivateLesson(LESSON_ID, STUDENT_ID);
    expect(result.status).toBe('cancelled');
  });

  it('returns 403 COACHING_NOT_LESSON_PARTICIPANT for third party', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'scheduled' }),
    );

    await expect(ctx.service.cancelPrivateLesson(LESSON_ID, OTHER_ID)).rejects.toMatchObject({
      code: 'COACHING_NOT_LESSON_PARTICIPANT',
      statusCode: 403,
    });
  });

  it('idempotent: already cancelled returns silently', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'cancelled' }),
    );

    const result = await ctx.service.cancelPrivateLesson(LESSON_ID, COACH_ID);
    expect(result.status).toBe('cancelled');
    expect(ctx.repo.cancelPrivateLesson).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// PUT /api/private-lessons/:id/training-content
// ===========================================================================

describe('PUT /api/private-lessons/:id/training-content — updatePrivateLessonTrainingContent', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('coach updates training content on an active lesson', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'in_progress' }),
    );
    ctx.repo.updatePrivateLessonTrainingContent.mockResolvedValue(
      lessonRecord({
        studentId: STUDENT_ID,
        source: 'booked',
        status: 'in_progress',
        trainingContent: '正手击球训练',
      }),
    );

    await ctx.service.updatePrivateLessonTrainingContent(LESSON_ID, COACH_ID, '正手击球训练');

    expect(ctx.repo.updatePrivateLessonTrainingContent).toHaveBeenCalledWith(
      LESSON_ID,
      '正手击球训练',
    );
  });

  it('rejects when caller is not the lesson coach (403)', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'in_progress' }),
    );

    await expect(
      ctx.service.updatePrivateLessonTrainingContent(LESSON_ID, OTHER_ID, '内容'),
    ).rejects.toMatchObject({ code: 'COACHING_NOT_COACH_OWNER', statusCode: 403 });
  });

  it('rejects when lesson is cancelled', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'cancelled' }),
    );

    await expect(
      ctx.service.updatePrivateLessonTrainingContent(LESSON_ID, COACH_ID, '内容'),
    ).rejects.toMatchObject({ code: 'COACHING_LESSON_CANCELLED', statusCode: 409 });
  });
});

// ===========================================================================
// POST/GET /api/private-lessons/:id/notes
// ===========================================================================

describe('POST /api/private-lessons/:id/notes — addPrivateLessonNote', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('coach can add a note', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'completed' }),
    );
    ctx.repo.createLessonNote.mockResolvedValue({
      id: 'note-1',
      privateLessonId: LESSON_ID,
      coachId: COACH_ID,
      content: '今天表现不错',
      createdAt: new Date(),
    });

    const result = await ctx.service.addPrivateLessonNote(LESSON_ID, COACH_ID, {
      content: '今天表现不错',
    });
    expect(result.id).toBe('note-1');
  });

  it('non-coach gets 403 COACHING_NOT_COACH_OWNER', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'completed' }),
    );

    await expect(
      ctx.service.addPrivateLessonNote(LESSON_ID, STUDENT_ID, { content: 'x' }),
    ).rejects.toMatchObject({ code: 'COACHING_NOT_COACH_OWNER', statusCode: 403 });
  });
});

describe('GET /api/private-lessons/:id/notes — getPrivateLessonNotes', () => {
  let ctx: ReturnType<typeof buildService>;
  beforeEach(() => {
    ctx = buildService();
  });

  it('coach and student can read notes; third party gets 403', async () => {
    ctx.repo.findPrivateLessonById.mockResolvedValue(
      lessonRecord({ studentId: STUDENT_ID, source: 'booked', status: 'completed' }),
    );
    ctx.repo.findLessonNotes.mockResolvedValue([
      {
        id: 'note-1',
        privateLessonId: LESSON_ID,
        coachId: COACH_ID,
        content: 'x',
        createdAt: new Date(),
      },
    ]);

    const coachView = await ctx.service.getPrivateLessonNotes(LESSON_ID, COACH_ID);
    expect(coachView.items).toHaveLength(1);

    const studentView = await ctx.service.getPrivateLessonNotes(LESSON_ID, STUDENT_ID);
    expect(studentView.items).toHaveLength(1);

    await expect(ctx.service.getPrivateLessonNotes(LESSON_ID, OTHER_ID)).rejects.toMatchObject({
      code: 'COACHING_NOT_LESSON_PARTICIPANT',
      statusCode: 403,
    });
  });
});
