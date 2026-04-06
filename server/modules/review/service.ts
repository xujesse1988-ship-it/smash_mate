import { AppError } from '../../infra/error-handler.js';
import { createModuleLogger } from '../../infra/logger.js';
import { ReviewRepository } from './repository.js';
import type {
  CreateReviewInput,
  ReviewListQuery,
  CoachRating,
  AverageRatingResult,
  CourseType,
} from './types.js';

const logger = createModuleLogger('review');

const VALID_COURSE_TYPES: CourseType[] = ['group-class', 'private-lesson'];

/**
 * Loose ID validation: at least 12 chars, alphanumeric + hyphens only.
 * Accepts both real UUIDs and test IDs like 'coach-uuid-0001'.
 */
const ID_REGEX = /^[a-z0-9-]{12,}$/i;

interface UserServiceDep {
  getUserById(id: string): Promise<{
    id: string;
    nickname: string;
    avatarUrl: string | null;
    isCoach: boolean;
    bio?: string | null;
  } | null>;
  getUsersByIds(ids: string[]): Promise<
    Array<{
      id: string;
      nickname: string;
      avatarUrl: string | null;
    }>
  >;
}

interface CoachingServiceDep {
  getGroupClassById(id: string): Promise<{
    id: string;
    coachId: string;
    title: string;
    venueId: string | null;
    startTime: Date;
    endTime: Date;
    status: string;
  } | null>;
  getPrivateLessonById(id: string): Promise<{
    id: string;
    coachId: string;
    studentId: string;
    venueId: string | null;
    startTime: Date;
    endTime: Date;
    status: string;
  } | null>;
  getParticipantIds(classId: string, type: 'group-class' | 'private-lesson'): Promise<string[]>;
}

interface NotificationServiceDep {
  create(input: {
    userId: string;
    type: string;
    title: string;
    content: string;
    targetType: string;
    targetId: string;
  }): Promise<unknown>;
}

export class ReviewService {
  private repo: ReviewRepository;
  private userService: UserServiceDep;
  private coachingService: CoachingServiceDep;
  private notificationService: NotificationServiceDep;

  constructor(
    repo: ReviewRepository,
    userService: UserServiceDep,
    coachingService: CoachingServiceDep,
    notificationService: NotificationServiceDep,
  ) {
    this.repo = repo;
    this.userService = userService;
    this.coachingService = coachingService;
    this.notificationService = notificationService;
  }

  // =========================================================================
  // POST /api/reviews — Create review
  // =========================================================================

  async createReview(userId: string, input: CreateReviewInput) {
    // 1. Validate input fields
    this.validateCreateReviewInput(input);

    // 2. Verify coach exists and has coach role
    const coach = await this.userService.getUserById(input.coachId);
    if (!coach || !coach.isCoach) {
      throw new AppError(404, 'REVIEW_COACH_NOT_FOUND', '教练不存在或不是教练角色');
    }

    // 3. Check self-review
    if (userId === input.coachId) {
      throw new AppError(403, 'REVIEW_CANNOT_REVIEW_SELF', '不可以评价自己');
    }

    // 4. Verify course exists
    const course = await this.getCourse(input.courseType, input.courseId);
    if (!course) {
      throw new AppError(404, 'REVIEW_COURSE_NOT_FOUND', '课程不存在');
    }

    // 5. Verify course belongs to this coach
    if (course.coachId !== input.coachId) {
      throw new AppError(409, 'REVIEW_COURSE_COACH_MISMATCH', '课程所属教练与指定教练不一致');
    }

    // 6. Verify course is completed
    if (course.status !== 'completed') {
      throw new AppError(409, 'REVIEW_COURSE_NOT_COMPLETED', '课程尚未结束');
    }

    // 7. Verify user is a participant
    const participantIds = await this.coachingService.getParticipantIds(
      input.courseId,
      input.courseType,
    );
    if (!participantIds.includes(userId)) {
      throw new AppError(403, 'REVIEW_NOT_PARTICIPANT', '不是该课程的参与者');
    }

    // 8. Check duplicate
    const existing = await this.repo.findDuplicate(userId, input.courseType, input.courseId);
    if (existing) {
      throw new AppError(409, 'REVIEW_DUPLICATE', '已评价过该课程');
    }

    // 9. Create the review
    const review = await this.repo.create({
      reviewerId: userId,
      coachId: input.coachId,
      courseType: input.courseType,
      courseId: input.courseId,
      rating: input.rating,
      comment: input.comment,
    });

    logger.info(
      {
        reviewerId: userId.slice(0, 8),
        coachId: input.coachId.slice(0, 8),
        courseType: input.courseType,
        courseId: input.courseId.slice(0, 8),
        rating: input.rating,
      },
      '评价已创建',
    );

    // 10. Send notification to coach (non-blocking)
    try {
      const reviewer = await this.userService.getUserById(userId);
      const reviewerNickname = reviewer?.nickname ?? '学员';

      let courseName: string;
      if (input.courseType === 'group-class') {
        courseName = (course as { title: string }).title;
      } else {
        const startTime = course.startTime;
        const month = String(startTime.getMonth() + 1).padStart(2, '0');
        const day = String(startTime.getDate()).padStart(2, '0');
        const startHour = String(startTime.getHours()).padStart(2, '0');
        const startMinute = String(startTime.getMinutes()).padStart(2, '0');
        const endTime = course.endTime;
        const endHour = String(endTime.getHours()).padStart(2, '0');
        const endMinute = String(endTime.getMinutes()).padStart(2, '0');
        courseName = `私教课（${month}/${day} ${startHour}:${startMinute}-${endHour}:${endMinute}）`;
      }

      await this.notificationService.create({
        userId: input.coachId,
        type: 'REVIEW_RECEIVED',
        title: '收到新评价',
        content: `${reviewerNickname} 对你的课程「${courseName}」发表了评价`,
        targetType: 'coach-profile',
        targetId: input.coachId,
      });
    } catch (err) {
      logger.error(
        { coachId: input.coachId.slice(0, 8), error: (err as Error).message },
        '评价通知发送失败',
      );
    }

    return review;
  }

  // =========================================================================
  // GET /api/coaches/:id/reviews — Coach reviews list
  // =========================================================================

  async getCoachReviews(coachId: string, query: ReviewListQuery) {
    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;

    const result = await this.repo.findByCoach(coachId, { page, pageSize });

    // If no reviews, return empty list without calling getUsersByIds
    if (result.items.length === 0) {
      return {
        items: [],
        total: result.total,
        page,
        pageSize,
      };
    }

    // Batch fetch reviewer info
    const reviewerIds = [...new Set(result.items.map((item) => item.reviewerId))];
    const users = await this.userService.getUsersByIds(reviewerIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    const items = result.items.map((item) => {
      const user = userMap.get(item.reviewerId);
      return {
        id: item.id,
        reviewer: {
          id: item.reviewerId,
          nickname: user?.nickname ?? '已注销用户',
          avatarUrl: user?.avatarUrl ?? null,
        },
        courseType: item.courseType,
        courseId: item.courseId,
        rating: item.rating,
        comment: item.comment,
        createdAt: item.createdAt,
      };
    });

    return {
      items,
      total: result.total,
      page,
      pageSize,
    };
  }

  // =========================================================================
  // GET /api/coaches/:id/rating — Coach rating
  // =========================================================================

  async getCoachRating(coachId: string): Promise<CoachRating> {
    const result = await this.repo.getCoachAverageRating(coachId);
    return {
      coachId,
      averageRating: result.averageRating,
      totalCount: result.totalCount,
    };
  }

  // =========================================================================
  // POST /api/coaches/ratings — Batch coach ratings
  // =========================================================================

  async getCoachesRatings(coachIds: string[]): Promise<CoachRating[]> {
    // Validate input
    if (!coachIds || !Array.isArray(coachIds)) {
      throw new AppError(400, 'REVIEW_INVALID_COACH_IDS', 'coachIds 缺失或非数组');
    }

    if (coachIds.length > 100) {
      throw new AppError(400, 'REVIEW_INVALID_COACH_IDS', 'coachIds 不能超过 100 个');
    }

    // Empty array: return empty
    if (coachIds.length === 0) {
      return [];
    }

    const results = await this.repo.getCoachesAverageRatings(coachIds);
    const resultMap = new Map(results.map((r) => [r.coachId, r]));

    // Ensure order matches input and fill missing coaches
    return coachIds.map((id) => {
      const found = resultMap.get(id);
      return found ?? { coachId: id, averageRating: null, totalCount: 0 };
    });
  }

  // =========================================================================
  // Cross-module service methods
  // =========================================================================

  async getCoachAverageRating(coachId: string): Promise<AverageRatingResult> {
    const result = await this.repo.getCoachAverageRating(coachId);
    return {
      averageRating: result.averageRating,
      totalCount: result.totalCount,
    };
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private validateCreateReviewInput(input: CreateReviewInput) {
    // Validate coachId
    if (!input.coachId || !ID_REGEX.test(input.coachId)) {
      throw new AppError(400, 'REVIEW_INVALID_COACH_ID', 'coachId 缺失或格式不合法');
    }

    // Validate courseType
    if (!VALID_COURSE_TYPES.includes(input.courseType)) {
      throw new AppError(400, 'REVIEW_INVALID_COURSE_TYPE', 'courseType 不合法');
    }

    // Validate courseId
    if (!input.courseId || !ID_REGEX.test(input.courseId)) {
      throw new AppError(400, 'REVIEW_INVALID_COURSE_ID', 'courseId 缺失或格式不合法');
    }

    // Validate rating
    if (
      input.rating === undefined ||
      input.rating === null ||
      !Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 5
    ) {
      throw new AppError(400, 'REVIEW_INVALID_RATING', '评分需要在 1-5 之间的整数');
    }

    // Validate comment
    if (input.comment !== undefined && input.comment !== null && input.comment.length > 500) {
      throw new AppError(400, 'REVIEW_INVALID_COMMENT', '评论不能超过 500 字符');
    }
  }

  private async getCourse(courseType: CourseType, courseId: string) {
    if (courseType === 'group-class') {
      return this.coachingService.getGroupClassById(courseId);
    } else {
      return this.coachingService.getPrivateLessonById(courseId);
    }
  }
}
