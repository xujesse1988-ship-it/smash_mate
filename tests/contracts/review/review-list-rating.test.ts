/**
 * 契约测试: review 模块 — 教练评价列表、教练评分查询、批量评分查询接口
 * 覆盖接口:
 *   - GET /api/coaches/:id/reviews (ReviewService.getCoachReviews)
 *   - GET /api/coaches/:id/rating (ReviewService.getCoachRating)
 *   - POST /api/coaches/ratings (ReviewService.getCoachesRatings)
 *   - ReviewService.getCoachAverageRating (内部接口)
 *
 * 来源文档: docs/module-design/review.md §4 接口契约「教练评价列表」「教练评分查询」「批量教练评分查询」 + §6.2 教练平均评分计算
 *
 * Mock 策略:
 * - ReviewRepository: 全部 mock（隔离数据库依赖）
 * - UserService: mock getUsersByIds（评价列表中批量获取评价者信息）
 * - CoachingService: mock（不使用，但构造时需要）
 * - NotificationService: mock（不使用，但构造时需要）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewService } from '@server/modules/review/service.js';
import { ReviewRepository } from '@server/modules/review/repository.js';
import type { CourseType } from '@server/modules/review/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COACH_ID = 'coach-uuid-0001';
const COACH_ID_2 = 'coach-uuid-0002';
const COACH_ID_3 = 'coach-uuid-0003';
const REVIEWER_A_ID = 'reviewer-uuid-aaa';
const REVIEWER_B_ID = 'reviewer-uuid-bbb';
const REVIEWER_DELETED_ID = 'reviewer-uuid-deleted';
const GROUP_CLASS_ID = 'group-class-uuid-0001';
const PRIVATE_LESSON_ID = 'private-lesson-uuid-0001';

// ---------------------------------------------------------------------------
// Helpers — Mock factories
// ---------------------------------------------------------------------------

function createMockRepository(): {
  [K in keyof ReviewRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockResolvedValue(null),
    findByCoach: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findDuplicate: vi.fn().mockResolvedValue(null),
    getCoachAverageRating: vi.fn().mockResolvedValue({ averageRating: null, totalCount: 0 }),
    getCoachesAverageRatings: vi.fn().mockResolvedValue([]),
  };
}

function createMockUserService() {
  return {
    getUserById: vi.fn().mockResolvedValue(null),
    getUsersByIds: vi.fn().mockResolvedValue([]),
  };
}

function createMockCoachingService() {
  return {
    getGroupClassById: vi.fn().mockResolvedValue(null),
    getPrivateLessonById: vi.fn().mockResolvedValue(null),
    getParticipantIds: vi.fn().mockResolvedValue([]),
  };
}

function createMockNotificationService() {
  return {
    create: vi.fn().mockResolvedValue(null),
  };
}

// ---------------------------------------------------------------------------
// Helpers — Data factories
// ---------------------------------------------------------------------------

/** Create a review record as returned by repository.findByCoach items */
function createReviewItem(overrides?: Partial<{
  id: string;
  reviewerId: string;
  coachId: string;
  courseType: CourseType;
  courseId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}>) {
  return {
    id: 'review-uuid-0001',
    reviewerId: REVIEWER_A_ID,
    coachId: COACH_ID,
    courseType: 'group-class' as CourseType,
    courseId: GROUP_CLASS_ID,
    rating: 5,
    comment: '教练讲解很细致，推荐！',
    createdAt: new Date('2026-04-02T10:00:00.000Z'),
    ...overrides,
  };
}

/** Build ReviewService with all mocked dependencies */
function buildService(overrides?: {
  repo?: ReturnType<typeof createMockRepository>;
  userService?: ReturnType<typeof createMockUserService>;
}) {
  const repo = overrides?.repo ?? createMockRepository();
  const userService = overrides?.userService ?? createMockUserService();
  const coachingService = createMockCoachingService();
  const notificationService = createMockNotificationService();

  const service = new ReviewService(
    repo as unknown as ReviewRepository,
    userService,
    coachingService,
    notificationService,
  );

  return { service, repo, userService };
}

// ===========================================================================
// GET /api/coaches/:id/reviews — 教练评价列表
// ===========================================================================

describe('GET /api/coaches/:id/reviews — 教练评价列表', () => {
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;
  let service: ReviewService;

  beforeEach(() => {
    const deps = buildService();
    service = deps.service;
    repo = deps.repo;
    userService = deps.userService;
  });

  // =========================================================================
  // 正常流程
  // =========================================================================

  // 业务规则: §4「教练评价列表」— 返回评价列表，包含评价者信息
  it('应返回教练评价列表，包含评价者 nickname 和 avatarUrl', async () => {
    repo.findByCoach.mockResolvedValue({
      items: [
        createReviewItem({ reviewerId: REVIEWER_A_ID }),
        createReviewItem({
          id: 'review-uuid-0002',
          reviewerId: REVIEWER_B_ID,
          courseType: 'private-lesson',
          courseId: PRIVATE_LESSON_ID,
          rating: 4,
          comment: '不错',
          createdAt: new Date('2026-04-01T08:00:00.000Z'),
        }),
      ],
      total: 2,
    });
    userService.getUsersByIds.mockResolvedValue([
      { id: REVIEWER_A_ID, nickname: '张三', avatarUrl: 'https://example.com/a.jpg' },
      { id: REVIEWER_B_ID, nickname: '李四', avatarUrl: null },
    ]);

    const result = await service.getCoachReviews(COACH_ID, {});

    expect(result).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          reviewer: { id: REVIEWER_A_ID, nickname: '张三', avatarUrl: 'https://example.com/a.jpg' },
          courseType: 'group-class',
          rating: 5,
        }),
        expect.objectContaining({
          reviewer: { id: REVIEWER_B_ID, nickname: '李四', avatarUrl: null },
          courseType: 'private-lesson',
          rating: 4,
        }),
      ]),
      total: 2,
      page: 1,
      pageSize: 20,
    });
  });

  // 业务规则: §4「教练评价列表」— 默认分页参数
  it('应使用默认分页参数 page=1, pageSize=20', async () => {
    await service.getCoachReviews(COACH_ID, {});

    expect(repo.findByCoach).toHaveBeenCalledWith(
      COACH_ID,
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  // 业务规则: §4「教练评价列表」— 支持自定义分页
  it('应支持自定义分页参数', async () => {
    await service.getCoachReviews(COACH_ID, { page: 2, pageSize: 10 });

    expect(repo.findByCoach).toHaveBeenCalledWith(
      COACH_ID,
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
  });

  // 业务规则: §4「教练评价列表」— pageSize 最大 100
  it('pageSize 超过 100 时应限制为 100', async () => {
    await service.getCoachReviews(COACH_ID, { pageSize: 200 });

    expect(repo.findByCoach).toHaveBeenCalledWith(
      COACH_ID,
      expect.objectContaining({ pageSize: 100 }),
    );
  });

  // 业务规则: §4「教练评价列表」— 当 coachId 不存在时返回空列表
  it('教练不存在时应返回空列表', async () => {
    repo.findByCoach.mockResolvedValue({ items: [], total: 0 });

    const result = await service.getCoachReviews('non-existent-coach-uuid', {});

    expect(result).toMatchObject({
      items: [],
      total: 0,
    });
  });

  // 业务规则: §4「教练评价列表」— 评价者已注销时使用默认占位信息
  it('评价者用户已被删除时 reviewer 应返回占位信息', async () => {
    repo.findByCoach.mockResolvedValue({
      items: [
        createReviewItem({ reviewerId: REVIEWER_DELETED_ID }),
      ],
      total: 1,
    });
    // getUsersByIds 不返回已删除用户
    userService.getUsersByIds.mockResolvedValue([]);

    const result = await service.getCoachReviews(COACH_ID, {});

    expect(result.items[0].reviewer).toEqual({
      id: REVIEWER_DELETED_ID,
      nickname: '已注销用户',
      avatarUrl: null,
    });
  });

  // 业务规则: §4「教练评价列表」— 部分评价者已注销的混合场景
  it('部分评价者已注销时应正确混合返回', async () => {
    repo.findByCoach.mockResolvedValue({
      items: [
        createReviewItem({ id: 'r1', reviewerId: REVIEWER_A_ID }),
        createReviewItem({ id: 'r2', reviewerId: REVIEWER_DELETED_ID }),
      ],
      total: 2,
    });
    userService.getUsersByIds.mockResolvedValue([
      { id: REVIEWER_A_ID, nickname: '张三', avatarUrl: 'https://example.com/a.jpg' },
    ]);

    const result = await service.getCoachReviews(COACH_ID, {});

    const reviewerA = result.items.find(
      (item: { reviewer: { id: string } }) => item.reviewer.id === REVIEWER_A_ID,
    );
    const reviewerDeleted = result.items.find(
      (item: { reviewer: { id: string } }) => item.reviewer.id === REVIEWER_DELETED_ID,
    );

    expect(reviewerA?.reviewer.nickname).toBe('张三');
    expect(reviewerDeleted?.reviewer).toEqual({
      id: REVIEWER_DELETED_ID,
      nickname: '已注销用户',
      avatarUrl: null,
    });
  });

  // 业务规则: §4「教练评价列表」— 通过 getUsersByIds 批量获取评价者信息
  it('应批量获取评价者信息', async () => {
    repo.findByCoach.mockResolvedValue({
      items: [
        createReviewItem({ reviewerId: REVIEWER_A_ID }),
        createReviewItem({ id: 'r2', reviewerId: REVIEWER_B_ID }),
      ],
      total: 2,
    });
    userService.getUsersByIds.mockResolvedValue([
      { id: REVIEWER_A_ID, nickname: '张三', avatarUrl: null },
      { id: REVIEWER_B_ID, nickname: '李四', avatarUrl: null },
    ]);

    await service.getCoachReviews(COACH_ID, {});

    expect(userService.getUsersByIds).toHaveBeenCalledWith(
      expect.arrayContaining([REVIEWER_A_ID, REVIEWER_B_ID]),
    );
  });

  // 业务规则: 无评价时不需要调用 getUsersByIds
  it('无评价时应返回空列表且不调用 getUsersByIds', async () => {
    repo.findByCoach.mockResolvedValue({ items: [], total: 0 });

    const result = await service.getCoachReviews(COACH_ID, {});

    expect(result.items).toEqual([]);
    expect(userService.getUsersByIds).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// GET /api/coaches/:id/rating — 教练评分查询
// ===========================================================================

describe('GET /api/coaches/:id/rating — 教练评分查询', () => {
  let repo: ReturnType<typeof createMockRepository>;
  let service: ReviewService;

  beforeEach(() => {
    const deps = buildService();
    service = deps.service;
    repo = deps.repo;
  });

  // =========================================================================
  // 正常流程
  // =========================================================================

  // 业务规则: §4「教练评分查询」— 返回教练的平均评分和评价总数
  it('应返回教练的平均评分和评价总数', async () => {
    repo.getCoachAverageRating.mockResolvedValue({
      averageRating: 4.5,
      totalCount: 15,
    });

    const result = await service.getCoachRating(COACH_ID);

    expect(result).toEqual({
      coachId: COACH_ID,
      averageRating: 4.5,
      totalCount: 15,
    });
  });

  // 业务规则: §6.2 — 无评价时 averageRating 为 null，totalCount 为 0
  it('无评价时应返回 averageRating=null, totalCount=0', async () => {
    repo.getCoachAverageRating.mockResolvedValue({
      averageRating: null,
      totalCount: 0,
    });

    const result = await service.getCoachRating(COACH_ID);

    expect(result).toEqual({
      coachId: COACH_ID,
      averageRating: null,
      totalCount: 0,
    });
  });

  // 业务规则: §4「教练评分查询」— 教练不存在时返回空结果（不暴露用户是否存在）
  it('教练不存在时应返回 averageRating=null, totalCount=0', async () => {
    repo.getCoachAverageRating.mockResolvedValue({
      averageRating: null,
      totalCount: 0,
    });

    const result = await service.getCoachRating('non-existent-coach-uuid');

    expect(result).toEqual({
      coachId: 'non-existent-coach-uuid',
      averageRating: null,
      totalCount: 0,
    });
  });

  // 业务规则: §6.2 — 平均评分保留一位小数（四舍五入）
  it('平均评分应保留一位小数', async () => {
    repo.getCoachAverageRating.mockResolvedValue({
      averageRating: 4.3,
      totalCount: 10,
    });

    const result = await service.getCoachRating(COACH_ID);

    expect(result.averageRating).toBe(4.3);
  });

  // 业务规则: §4「教练评分查询」— 内部调用 getCoachAverageRating
  it('应调用 repository.getCoachAverageRating', async () => {
    await service.getCoachRating(COACH_ID);

    expect(repo.getCoachAverageRating).toHaveBeenCalledWith(COACH_ID);
  });
});

// ===========================================================================
// ReviewService.getCoachAverageRating — 内部接口
// ===========================================================================

describe('ReviewService.getCoachAverageRating — 内部接口', () => {
  let repo: ReturnType<typeof createMockRepository>;
  let service: ReviewService;

  beforeEach(() => {
    const deps = buildService();
    service = deps.service;
    repo = deps.repo;
  });

  // 业务规则: §4 内部接口 — 返回平均评分和评价总数
  it('应返回教练的平均评分和评价总数', async () => {
    repo.getCoachAverageRating.mockResolvedValue({
      averageRating: 4.2,
      totalCount: 8,
    });

    const result = await service.getCoachAverageRating(COACH_ID);

    expect(result).toEqual({
      averageRating: 4.2,
      totalCount: 8,
    });
  });

  // 业务规则: §4 内部接口 — 无评价时返回 null + 0
  it('无评价时 averageRating 为 null，totalCount 为 0', async () => {
    repo.getCoachAverageRating.mockResolvedValue({
      averageRating: null,
      totalCount: 0,
    });

    const result = await service.getCoachAverageRating(COACH_ID);

    expect(result).toEqual({
      averageRating: null,
      totalCount: 0,
    });
  });

  // 业务规则: §4 内部接口 — 教练不存在时不抛错，返回空结果
  it('教练不存在时应返回空结果，不抛错', async () => {
    repo.getCoachAverageRating.mockResolvedValue({
      averageRating: null,
      totalCount: 0,
    });

    const result = await service.getCoachAverageRating('non-existent-uuid');

    expect(result).toEqual({
      averageRating: null,
      totalCount: 0,
    });
  });
});

// ===========================================================================
// POST /api/coaches/ratings — 批量教练评分查询
// ===========================================================================

describe('POST /api/coaches/ratings — 批量教练评分查询', () => {
  let repo: ReturnType<typeof createMockRepository>;
  let service: ReviewService;

  beforeEach(() => {
    const deps = buildService();
    service = deps.service;
    repo = deps.repo;
  });

  // =========================================================================
  // 正常流程
  // =========================================================================

  // 业务规则: §4「批量教练评分查询」— 返回多个教练的评分数据
  it('应返回多个教练的评分数据', async () => {
    repo.getCoachesAverageRatings.mockResolvedValue([
      { coachId: COACH_ID, averageRating: 4.5, totalCount: 15 },
      { coachId: COACH_ID_2, averageRating: 3.8, totalCount: 5 },
    ]);

    const result = await service.getCoachesRatings([COACH_ID, COACH_ID_2]);

    expect(result).toEqual([
      { coachId: COACH_ID, averageRating: 4.5, totalCount: 15 },
      { coachId: COACH_ID_2, averageRating: 3.8, totalCount: 5 },
    ]);
  });

  // 业务规则: §4「批量教练评分查询」— 不存在的 coachId 也返回对应结果
  it('不存在的 coachId 应返回 averageRating=null, totalCount=0', async () => {
    repo.getCoachesAverageRatings.mockResolvedValue([
      { coachId: COACH_ID, averageRating: 4.5, totalCount: 15 },
    ]);

    const result = await service.getCoachesRatings([COACH_ID, COACH_ID_2]);

    // 即使 repo 只返回了有评价的教练，service 层应补全不存在的
    expect(result).toEqual(
      expect.arrayContaining([
        { coachId: COACH_ID, averageRating: 4.5, totalCount: 15 },
        { coachId: COACH_ID_2, averageRating: null, totalCount: 0 },
      ]),
    );
  });

  // 业务规则: §4「批量教练评分查询」— 返回顺序与输入 coachIds 顺序一致
  it('返回顺序应与输入 coachIds 顺序一致', async () => {
    repo.getCoachesAverageRatings.mockResolvedValue([
      { coachId: COACH_ID_2, averageRating: 3.8, totalCount: 5 },
      { coachId: COACH_ID, averageRating: 4.5, totalCount: 15 },
    ]);

    const result = await service.getCoachesRatings([COACH_ID, COACH_ID_2, COACH_ID_3]);

    expect(result[0].coachId).toBe(COACH_ID);
    expect(result[1].coachId).toBe(COACH_ID_2);
    expect(result[2].coachId).toBe(COACH_ID_3);
  });

  // 业务规则: §4「批量教练评分查询」— coachIds 为空数组时返回空 ratings 数组
  it('coachIds 为空数组时应返回空数组', async () => {
    const result = await service.getCoachesRatings([]);

    expect(result).toEqual([]);
  });

  // 业务规则: §4「批量教练评分查询」— 全部教练都无评价
  it('全部教练都无评价时应返回全部 null', async () => {
    repo.getCoachesAverageRatings.mockResolvedValue([]);

    const result = await service.getCoachesRatings([COACH_ID, COACH_ID_2]);

    expect(result).toEqual([
      { coachId: COACH_ID, averageRating: null, totalCount: 0 },
      { coachId: COACH_ID_2, averageRating: null, totalCount: 0 },
    ]);
  });

  // =========================================================================
  // 错误码
  // =========================================================================

  // 错误码: REVIEW_INVALID_COACH_IDS — coachIds 缺失
  it('coachIds 缺失时应返回 REVIEW_INVALID_COACH_IDS (400)', async () => {
    await expect(
      service.getCoachesRatings(undefined as unknown as string[]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_COACH_IDS',
    });
  });

  // 错误码: REVIEW_INVALID_COACH_IDS — coachIds 非数组
  it('coachIds 非数组时应返回 REVIEW_INVALID_COACH_IDS (400)', async () => {
    await expect(
      service.getCoachesRatings('not-an-array' as unknown as string[]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_COACH_IDS',
    });
  });

  // 错误码: REVIEW_INVALID_COACH_IDS — coachIds 超过 100 个
  it('coachIds 超过 100 个时应返回 REVIEW_INVALID_COACH_IDS (400)', async () => {
    const manyIds = Array.from({ length: 101 }, (_, i) => `coach-uuid-${i.toString().padStart(4, '0')}`);

    await expect(service.getCoachesRatings(manyIds)).rejects.toMatchObject({
      statusCode: 400,
      code: 'REVIEW_INVALID_COACH_IDS',
    });
  });

  // 业务规则: coachIds 恰好 100 个应允许通过
  it('coachIds 恰好 100 个时应正常处理', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `coach-uuid-${i.toString().padStart(4, '0')}`);
    repo.getCoachesAverageRatings.mockResolvedValue([]);

    const result = await service.getCoachesRatings(ids);

    expect(result).toHaveLength(100);
  });

  // 业务规则: §4「批量教练评分查询」— 使用 repository 批量查询方法
  it('应调用 repository.getCoachesAverageRatings 进行批量查询', async () => {
    repo.getCoachesAverageRatings.mockResolvedValue([]);

    await service.getCoachesRatings([COACH_ID, COACH_ID_2]);

    expect(repo.getCoachesAverageRatings).toHaveBeenCalledWith([COACH_ID, COACH_ID_2]);
  });

  // 业务规则: 单个教练 ID 也应走批量路径
  it('单个 coachId 也应正常返回结果', async () => {
    repo.getCoachesAverageRatings.mockResolvedValue([
      { coachId: COACH_ID, averageRating: 4.0, totalCount: 3 },
    ]);

    const result = await service.getCoachesRatings([COACH_ID]);

    expect(result).toEqual([
      { coachId: COACH_ID, averageRating: 4.0, totalCount: 3 },
    ]);
  });
});
