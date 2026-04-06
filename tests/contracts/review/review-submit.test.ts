/**
 * 契约测试: review 模块 — 提交评价接口
 * 覆盖接口:
 *   - POST /api/reviews (ReviewService.createReview)
 *
 * 来源文档: docs/module-design/review.md §4 接口契约「提交评价」 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - ReviewRepository: 全部 mock（隔离数据库依赖）
 * - UserService: mock getUserById（校验教练角色 + 获取学员昵称）
 * - CoachingService: mock getGroupClassById / getPrivateLessonById / getParticipantIds（跨模块依赖）
 * - NotificationService: mock create（评价通知）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewService } from '@server/modules/review/service.js';
import { ReviewRepository } from '@server/modules/review/repository.js';
import type { CreateReviewInput, CourseType } from '@server/modules/review/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REVIEWER_ID = 'reviewer-uuid-0001';
const COACH_ID = 'coach-uuid-0001';
const GROUP_CLASS_ID = 'group-class-uuid-0001';
const PRIVATE_LESSON_ID = 'private-lesson-uuid-0001';
const REVIEW_ID = 'review-uuid-0001';

// ---------------------------------------------------------------------------
// Helpers — Mock factories
// ---------------------------------------------------------------------------

/**
 * Build a mock ReviewRepository with all methods stubbed.
 */
function createMockRepository(): {
  [K in keyof ReviewRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockResolvedValue(createReviewRecord()),
    findByCoach: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findDuplicate: vi.fn().mockResolvedValue(null),
    getCoachAverageRating: vi.fn().mockResolvedValue({ averageRating: null, totalCount: 0 }),
    getCoachesAverageRatings: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Build a mock UserService with cross-module methods.
 */
function createMockUserService() {
  return {
    getUserById: vi.fn().mockResolvedValue({
      id: COACH_ID,
      nickname: '教练A',
      avatarUrl: 'https://example.com/coach.jpg',
      bio: '专业教练',
      isCoach: true,
    }),
    getUsersByIds: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Build a mock CoachingService with cross-module methods.
 */
function createMockCoachingService() {
  return {
    getGroupClassById: vi.fn().mockResolvedValue({
      id: GROUP_CLASS_ID,
      coachId: COACH_ID,
      title: '初级羽毛球团课',
      venueId: 'venue-uuid-0001',
      startTime: new Date('2026-04-01T09:00:00.000Z'),
      endTime: new Date('2026-04-01T11:00:00.000Z'),
      status: 'completed',
    }),
    getPrivateLessonById: vi.fn().mockResolvedValue({
      id: PRIVATE_LESSON_ID,
      coachId: COACH_ID,
      studentId: REVIEWER_ID,
      venueId: 'venue-uuid-0001',
      startTime: new Date('2026-04-02T14:00:00.000Z'),
      endTime: new Date('2026-04-02T15:00:00.000Z'),
      status: 'completed',
    }),
    getParticipantIds: vi.fn().mockResolvedValue([REVIEWER_ID]),
  };
}

/**
 * Build a mock NotificationService with create method.
 */
function createMockNotificationService() {
  return {
    create: vi.fn().mockResolvedValue({
      id: 'notification-uuid-0001',
      userId: COACH_ID,
      type: 'REVIEW_RECEIVED',
      title: '收到新评价',
      content: '学员A 对你的课程「初级羽毛球团课」发表了评价',
      targetType: 'coach-profile',
      targetId: COACH_ID,
      isRead: false,
      createdAt: new Date(),
    }),
  };
}

// ---------------------------------------------------------------------------
// Helpers — Data factories
// ---------------------------------------------------------------------------

/** Standard Review record as returned by repository */
function createReviewRecord(
  overrides?: Partial<{
    id: string;
    reviewerId: string;
    coachId: string;
    courseType: CourseType;
    courseId: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
  }>,
) {
  return {
    id: REVIEW_ID,
    reviewerId: REVIEWER_ID,
    coachId: COACH_ID,
    courseType: 'group-class' as CourseType,
    courseId: GROUP_CLASS_ID,
    rating: 5,
    comment: '教练讲解很细致，推荐！',
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    ...overrides,
  };
}

/** Standard input for creating a review */
function createValidInput(overrides?: Partial<CreateReviewInput>): CreateReviewInput {
  return {
    coachId: COACH_ID,
    courseType: 'group-class',
    courseId: GROUP_CLASS_ID,
    rating: 5,
    comment: '教练讲解很细致，推荐！',
    ...overrides,
  };
}

/** Build ReviewService with all mocked dependencies */
function buildService(overrides?: {
  repo?: ReturnType<typeof createMockRepository>;
  userService?: ReturnType<typeof createMockUserService>;
  coachingService?: ReturnType<typeof createMockCoachingService>;
  notificationService?: ReturnType<typeof createMockNotificationService>;
}) {
  const repo = overrides?.repo ?? createMockRepository();
  const userService = overrides?.userService ?? createMockUserService();
  const coachingService = overrides?.coachingService ?? createMockCoachingService();
  const notificationService = overrides?.notificationService ?? createMockNotificationService();

  // ReviewService 构造函数接收依赖注入
  const service = new ReviewService(
    repo as unknown as ReviewRepository,
    userService,
    coachingService,
    notificationService,
  );

  return { service, repo, userService, coachingService, notificationService };
}

// ===========================================================================
// Test Suite
// ===========================================================================

describe('POST /api/reviews — 提交评价', () => {
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let coachingService: ReturnType<typeof createMockCoachingService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;
  let service: ReviewService;

  beforeEach(() => {
    const deps = buildService();
    service = deps.service;
    repo = deps.repo;
    userService = deps.userService;
    coachingService = deps.coachingService;
    notificationService = deps.notificationService;
  });

  // =========================================================================
  // 正常流程
  // =========================================================================

  // 业务规则: §4「提交评价」— 团课评价正常创建
  it('应成功提交团课评价并返回评价数据', async () => {
    const input = createValidInput();
    const result = await service.createReview(REVIEWER_ID, input);

    expect(result).toMatchObject({
      id: expect.any(String),
      reviewerId: REVIEWER_ID,
      coachId: COACH_ID,
      courseType: 'group-class',
      courseId: GROUP_CLASS_ID,
      rating: 5,
      comment: '教练讲解很细致，推荐！',
      createdAt: expect.any(Date),
    });
  });

  // 业务规则: §4「提交评价」— 私教课评价正常创建
  it('应成功提交私教课评价', async () => {
    const input = createValidInput({
      courseType: 'private-lesson',
      courseId: PRIVATE_LESSON_ID,
    });
    repo.create.mockResolvedValue(
      createReviewRecord({
        courseType: 'private-lesson',
        courseId: PRIVATE_LESSON_ID,
      }),
    );

    const result = await service.createReview(REVIEWER_ID, input);

    expect(result).toMatchObject({
      courseType: 'private-lesson',
      courseId: PRIVATE_LESSON_ID,
    });
    expect(coachingService.getPrivateLessonById).toHaveBeenCalledWith(PRIVATE_LESSON_ID);
  });

  // 业务规则: §4「提交评价」— comment 为可选字段
  it('应允许 comment 为空', async () => {
    const input = createValidInput({ comment: undefined });
    repo.create.mockResolvedValue(createReviewRecord({ comment: null }));

    const result = await service.createReview(REVIEWER_ID, input);

    expect(result.comment).toBeNull();
  });

  // 业务规则: §4「提交评价」— 评价的 rating 边界值 1
  it('应接受 rating = 1', async () => {
    const input = createValidInput({ rating: 1 });
    repo.create.mockResolvedValue(createReviewRecord({ rating: 1 }));

    const result = await service.createReview(REVIEWER_ID, input);

    expect(result.rating).toBe(1);
  });

  // 业务规则: §4「提交评价」— 评价的 rating 边界值 5
  it('应接受 rating = 5', async () => {
    const input = createValidInput({ rating: 5 });

    const result = await service.createReview(REVIEWER_ID, input);

    expect(result.rating).toBe(5);
  });

  // =========================================================================
  // 通知相关
  // =========================================================================

  // 业务规则: §6.1 步骤 10 — 评价创建后通知教练
  it('应在评价创建后发送通知给教练', async () => {
    // getUserById 被调用两次：一次校验教练角色，一次获取学员昵称（通知文案）
    userService.getUserById.mockResolvedValueOnce({
      id: COACH_ID,
      nickname: '教练A',
      avatarUrl: null,
      bio: null,
      isCoach: true,
    });
    userService.getUserById.mockResolvedValueOnce({
      id: REVIEWER_ID,
      nickname: '学员小明',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await service.createReview(REVIEWER_ID, createValidInput());

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: COACH_ID,
        type: 'REVIEW_RECEIVED',
        title: '收到新评价',
        targetType: 'coach-profile',
        targetId: COACH_ID,
      }),
    );
  });

  // 业务规则: §6.3 — 团课通知文案使用团课 title
  it('团课评价通知 content 应包含团课 title', async () => {
    userService.getUserById.mockResolvedValueOnce({
      id: COACH_ID,
      nickname: '教练A',
      avatarUrl: null,
      bio: null,
      isCoach: true,
    });
    userService.getUserById.mockResolvedValueOnce({
      id: REVIEWER_ID,
      nickname: '学员小明',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await service.createReview(REVIEWER_ID, createValidInput());

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('初级羽毛球团课'),
      }),
    );
  });

  // 业务规则: §6.3 — 私教课通知文案使用"私教课（日期 时间段）"格式
  it('私教课评价通知 content 应包含私教课日期时间信息', async () => {
    const input = createValidInput({
      courseType: 'private-lesson',
      courseId: PRIVATE_LESSON_ID,
    });
    repo.create.mockResolvedValue(
      createReviewRecord({
        courseType: 'private-lesson',
        courseId: PRIVATE_LESSON_ID,
      }),
    );
    userService.getUserById.mockResolvedValueOnce({
      id: COACH_ID,
      nickname: '教练A',
      avatarUrl: null,
      bio: null,
      isCoach: true,
    });
    userService.getUserById.mockResolvedValueOnce({
      id: REVIEWER_ID,
      nickname: '学员小明',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await service.createReview(REVIEWER_ID, input);

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('私教课'),
      }),
    );
  });

  // 业务规则: §4「提交评价」— 通知创建失败不阻塞主流程
  it('通知创建失败时不应阻塞评价创建', async () => {
    notificationService.create.mockRejectedValue(new Error('通知服务不可用'));

    const result = await service.createReview(REVIEWER_ID, createValidInput());

    // 评价仍应成功返回
    expect(result).toMatchObject({
      id: expect.any(String),
      reviewerId: REVIEWER_ID,
    });
  });

  // =========================================================================
  // 校验: coachId
  // =========================================================================

  // 错误码: REVIEW_INVALID_COACH_ID — coachId 缺失
  it('coachId 缺失时应返回 REVIEW_INVALID_COACH_ID (400)', async () => {
    const input = createValidInput({ coachId: '' });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_COACH_ID',
    });
  });

  // 错误码: REVIEW_INVALID_COACH_ID — coachId 格式不合法
  it('coachId 格式不合法时应返回 REVIEW_INVALID_COACH_ID (400)', async () => {
    const input = createValidInput({ coachId: 'not-a-uuid' });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_COACH_ID',
    });
  });

  // =========================================================================
  // 校验: courseType
  // =========================================================================

  // 错误码: REVIEW_INVALID_COURSE_TYPE — courseType 不在枚举范围内
  it('courseType 不合法时应返回 REVIEW_INVALID_COURSE_TYPE (400)', async () => {
    const input = createValidInput({ courseType: 'invalid-type' as CourseType });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_COURSE_TYPE',
    });
  });

  // =========================================================================
  // 校验: courseId
  // =========================================================================

  // 错误码: REVIEW_INVALID_COURSE_ID — courseId 缺失
  it('courseId 缺失时应返回 REVIEW_INVALID_COURSE_ID (400)', async () => {
    const input = createValidInput({ courseId: '' });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_COURSE_ID',
    });
  });

  // 错误码: REVIEW_INVALID_COURSE_ID — courseId 格式不合法
  it('courseId 格式不合法时应返回 REVIEW_INVALID_COURSE_ID (400)', async () => {
    const input = createValidInput({ courseId: 'not-a-uuid' });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_COURSE_ID',
    });
  });

  // =========================================================================
  // 校验: rating
  // =========================================================================

  // 错误码: REVIEW_INVALID_RATING — rating 小于 1
  it('rating 小于 1 时应返回 REVIEW_INVALID_RATING (400)', async () => {
    const input = createValidInput({ rating: 0 });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_RATING',
    });
  });

  // 错误码: REVIEW_INVALID_RATING — rating 大于 5
  it('rating 大于 5 时应返回 REVIEW_INVALID_RATING (400)', async () => {
    const input = createValidInput({ rating: 6 });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_RATING',
    });
  });

  // 错误码: REVIEW_INVALID_RATING — rating 非整数
  it('rating 非整数时应返回 REVIEW_INVALID_RATING (400)', async () => {
    const input = createValidInput({ rating: 3.5 });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_RATING',
    });
  });

  // 错误码: REVIEW_INVALID_RATING — rating 为负数
  it('rating 为负数时应返回 REVIEW_INVALID_RATING (400)', async () => {
    const input = createValidInput({ rating: -1 });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_RATING',
    });
  });

  // =========================================================================
  // 校验: comment
  // =========================================================================

  // 错误码: REVIEW_INVALID_COMMENT — comment 超过 500 字符
  it('comment 超过 500 字符时应返回 REVIEW_INVALID_COMMENT (400)', async () => {
    const input = createValidInput({ comment: 'x'.repeat(501) });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_COMMENT',
    });
  });

  // 业务规则: comment 恰好 500 字符应通过
  it('comment 恰好 500 字符时应允许通过', async () => {
    const input = createValidInput({ comment: 'x'.repeat(500) });
    repo.create.mockResolvedValue(createReviewRecord({ comment: 'x'.repeat(500) }));

    const result = await service.createReview(REVIEWER_ID, input);

    expect(result.comment).toHaveLength(500);
  });

  // =========================================================================
  // 校验: 教练存在且为教练角色
  // =========================================================================

  // 错误码: REVIEW_COACH_NOT_FOUND — coachId 对应的用户不存在
  it('教练用户不存在时应返回 REVIEW_COACH_NOT_FOUND (404)', async () => {
    userService.getUserById.mockResolvedValue(null);

    await expect(service.createReview(REVIEWER_ID, createValidInput())).rejects.toMatchObject({
      statusCode: 404,
      code: 'REVIEW_COACH_NOT_FOUND',
    });
  });

  // 错误码: REVIEW_COACH_NOT_FOUND — coachId 对应的用户不是教练
  it('用户非教练角色时应返回 REVIEW_COACH_NOT_FOUND (404)', async () => {
    userService.getUserById.mockResolvedValue({
      id: COACH_ID,
      nickname: '普通用户',
      avatarUrl: null,
      bio: null,
      isCoach: false,
    });

    await expect(service.createReview(REVIEWER_ID, createValidInput())).rejects.toMatchObject({
      statusCode: 404,
      code: 'REVIEW_COACH_NOT_FOUND',
    });
  });

  // =========================================================================
  // 校验: 学员不可评价自己
  // =========================================================================

  // 错误码: REVIEW_CANNOT_REVIEW_SELF — reviewerId === coachId
  it('学员尝试评价自己时应返回 REVIEW_CANNOT_REVIEW_SELF (403)', async () => {
    userService.getUserById.mockResolvedValue({
      id: COACH_ID,
      nickname: '教练A',
      avatarUrl: null,
      bio: null,
      isCoach: true,
    });

    await expect(
      service.createReview(COACH_ID, createValidInput({ coachId: COACH_ID })),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'REVIEW_CANNOT_REVIEW_SELF',
    });
  });

  // =========================================================================
  // 校验: 课程存在
  // =========================================================================

  // 错误码: REVIEW_COURSE_NOT_FOUND — 团课不存在
  it('团课不存在时应返回 REVIEW_COURSE_NOT_FOUND (404)', async () => {
    coachingService.getGroupClassById.mockResolvedValue(null);

    await expect(service.createReview(REVIEWER_ID, createValidInput())).rejects.toMatchObject({
      statusCode: 404,
      code: 'REVIEW_COURSE_NOT_FOUND',
    });
  });

  // 错误码: REVIEW_COURSE_NOT_FOUND — 私教课不存在
  it('私教课不存在时应返回 REVIEW_COURSE_NOT_FOUND (404)', async () => {
    coachingService.getPrivateLessonById.mockResolvedValue(null);

    const input = createValidInput({
      courseType: 'private-lesson',
      courseId: PRIVATE_LESSON_ID,
    });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 404,
      code: 'REVIEW_COURSE_NOT_FOUND',
    });
  });

  // =========================================================================
  // 校验: 课程所属教练一致
  // =========================================================================

  // 错误码: REVIEW_COURSE_COACH_MISMATCH — 课程的 coachId 与请求中的 coachId 不一致
  it('课程所属教练不一致时应返回 REVIEW_COURSE_COACH_MISMATCH (409)', async () => {
    coachingService.getGroupClassById.mockResolvedValue({
      id: GROUP_CLASS_ID,
      coachId: 'other-coach-uuid',
      title: '其他教练的课',
      venueId: 'venue-uuid-0001',
      startTime: new Date('2026-04-01T09:00:00.000Z'),
      endTime: new Date('2026-04-01T11:00:00.000Z'),
      status: 'completed',
    });

    await expect(service.createReview(REVIEWER_ID, createValidInput())).rejects.toMatchObject({
      statusCode: 409,
      code: 'REVIEW_COURSE_COACH_MISMATCH',
    });
  });

  // =========================================================================
  // 校验: 课程状态为 completed
  // =========================================================================

  // 错误码: REVIEW_COURSE_NOT_COMPLETED — 团课状态非 completed
  it('团课未结束时应返回 REVIEW_COURSE_NOT_COMPLETED (409)', async () => {
    coachingService.getGroupClassById.mockResolvedValue({
      id: GROUP_CLASS_ID,
      coachId: COACH_ID,
      title: '初级羽毛球团课',
      venueId: 'venue-uuid-0001',
      startTime: new Date('2026-04-01T09:00:00.000Z'),
      endTime: new Date('2026-04-01T11:00:00.000Z'),
      status: 'enrolling',
    });

    await expect(service.createReview(REVIEWER_ID, createValidInput())).rejects.toMatchObject({
      statusCode: 409,
      code: 'REVIEW_COURSE_NOT_COMPLETED',
    });
  });

  // 错误码: REVIEW_COURSE_NOT_COMPLETED — 私教课状态非 completed (in-progress)
  it('私教课进行中时应返回 REVIEW_COURSE_NOT_COMPLETED (409)', async () => {
    coachingService.getPrivateLessonById.mockResolvedValue({
      id: PRIVATE_LESSON_ID,
      coachId: COACH_ID,
      studentId: REVIEWER_ID,
      venueId: 'venue-uuid-0001',
      startTime: new Date('2026-04-02T14:00:00.000Z'),
      endTime: new Date('2026-04-02T15:00:00.000Z'),
      status: 'in-progress',
    });

    const input = createValidInput({
      courseType: 'private-lesson',
      courseId: PRIVATE_LESSON_ID,
    });

    await expect(service.createReview(REVIEWER_ID, input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'REVIEW_COURSE_NOT_COMPLETED',
    });
  });

  // =========================================================================
  // 校验: 学员是课程参与者
  // =========================================================================

  // 错误码: REVIEW_NOT_PARTICIPANT — 当前用户不是课程参与者
  it('用户非课程参与者时应返回 REVIEW_NOT_PARTICIPANT (403)', async () => {
    coachingService.getParticipantIds.mockResolvedValue(['other-user-uuid']);

    await expect(service.createReview(REVIEWER_ID, createValidInput())).rejects.toMatchObject({
      statusCode: 403,
      code: 'REVIEW_NOT_PARTICIPANT',
    });
  });

  // 业务规则: §6.1 步骤 7 — getParticipantIds 返回空数组时也应拒绝
  it('课程无参与者时应返回 REVIEW_NOT_PARTICIPANT (403)', async () => {
    coachingService.getParticipantIds.mockResolvedValue([]);

    await expect(service.createReview(REVIEWER_ID, createValidInput())).rejects.toMatchObject({
      statusCode: 403,
      code: 'REVIEW_NOT_PARTICIPANT',
    });
  });

  // =========================================================================
  // 校验: 重复评价
  // =========================================================================

  // 错误码: REVIEW_DUPLICATE — 同一学员对同一课程已评价
  it('重复评价时应返回 REVIEW_DUPLICATE (409)', async () => {
    repo.findDuplicate.mockResolvedValue(createReviewRecord());

    await expect(service.createReview(REVIEWER_ID, createValidInput())).rejects.toMatchObject({
      statusCode: 409,
      code: 'REVIEW_DUPLICATE',
    });
  });

  // =========================================================================
  // 校验流程顺序验证
  // =========================================================================

  // 业务规则: §6.1 — 校验教练角色在校验课程之前
  it('教练不存在时不应调用 CoachingService', async () => {
    userService.getUserById.mockResolvedValue(null);

    await expect(service.createReview(REVIEWER_ID, createValidInput())).rejects.toMatchObject({
      code: 'REVIEW_COACH_NOT_FOUND',
    });

    expect(coachingService.getGroupClassById).not.toHaveBeenCalled();
    expect(coachingService.getPrivateLessonById).not.toHaveBeenCalled();
    expect(coachingService.getParticipantIds).not.toHaveBeenCalled();
  });

  // 业务规则: §6.1 — 自评校验在课程校验之前
  it('自评时不应调用 CoachingService', async () => {
    userService.getUserById.mockResolvedValue({
      id: REVIEWER_ID,
      nickname: '教练也是自己',
      avatarUrl: null,
      bio: null,
      isCoach: true,
    });

    await expect(
      service.createReview(REVIEWER_ID, createValidInput({ coachId: REVIEWER_ID })),
    ).rejects.toMatchObject({
      code: 'REVIEW_CANNOT_REVIEW_SELF',
    });

    expect(coachingService.getGroupClassById).not.toHaveBeenCalled();
  });

  // 业务规则: §6.1 — getParticipantIds 使用正确的 courseType 参数
  it('应使用 courseType 参数调用 getParticipantIds', async () => {
    await service.createReview(REVIEWER_ID, createValidInput());

    expect(coachingService.getParticipantIds).toHaveBeenCalledWith(
      GROUP_CLASS_ID,
      'group-class',
    );
  });

  // 业务规则: §6.1 — 私教课 getParticipantIds 使用 private-lesson 类型
  it('私教课应使用 private-lesson 类型调用 getParticipantIds', async () => {
    const input = createValidInput({
      courseType: 'private-lesson',
      courseId: PRIVATE_LESSON_ID,
    });
    repo.create.mockResolvedValue(
      createReviewRecord({ courseType: 'private-lesson', courseId: PRIVATE_LESSON_ID }),
    );

    await service.createReview(REVIEWER_ID, input);

    expect(coachingService.getParticipantIds).toHaveBeenCalledWith(
      PRIVATE_LESSON_ID,
      'private-lesson',
    );
  });

  // 业务规则: §4「提交评价」— 当前用户（从 JWT 解析 userId）为评价者
  it('reviewerId 应为传入的 userId', async () => {
    await service.createReview(REVIEWER_ID, createValidInput());

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewerId: REVIEWER_ID,
      }),
    );
  });

  // 业务规则: §6.1 步骤 8 — findDuplicate 使用正确参数
  it('应使用 (reviewerId, courseType, courseId) 检查重复评价', async () => {
    await service.createReview(REVIEWER_ID, createValidInput());

    expect(repo.findDuplicate).toHaveBeenCalledWith(
      REVIEWER_ID,
      'group-class',
      GROUP_CLASS_ID,
    );
  });
});
