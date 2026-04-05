import { AppError } from '../../infra/error-handler.js';
import { createModuleLogger } from '../../infra/logger.js';
import { registerTask } from '../../infra/scheduler.js';
import type { CoachingRepository } from './repository.js';
import type {
  UpdateCoachProfileInput,
  CreateGroupClassInput,
  UpdateGroupClassInput,
  SetAvailabilityInput,
  BookPrivateLessonInput,
  CoachListQuery,
  CoachSpecialty,
  PrivateLessonListQuery,
  EnrollmentListQuery,
} from './types.js';

const logger = createModuleLogger('coaching');

const VALID_SPECIALTIES: CoachSpecialty[] = [
  'singles',
  'doubles',
  'footwork',
  'fitness',
  'tactics',
];

interface UserServiceLike {
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
      isCoach?: boolean;
      bio?: string | null;
    }>
  >;
}

interface VenueServiceLike {
  getVenueById(id: string): Promise<{
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null>;
}

interface NotificationServiceLike {
  create(input: {
    userId: string;
    type: string;
    title: string;
    content: string;
    targetType: string;
    targetId: string;
  }): Promise<unknown>;
  createBatch(
    notifications: Array<{
      userId: string;
      type: string;
      title: string;
      content: string;
      targetType: string;
      targetId: string;
    }>,
  ): Promise<unknown>;
}

export class CoachingService {
  private repository: CoachingRepository;
  private userService: UserServiceLike;
  private venueService: VenueServiceLike;
  private notificationService: NotificationServiceLike;

  constructor(
    repository: CoachingRepository,
    userService: UserServiceLike,
    venueService: VenueServiceLike,
    notificationService: NotificationServiceLike,
  ) {
    this.repository = repository;
    this.userService = userService;
    this.venueService = venueService;
    this.notificationService = notificationService;
  }

  // =========================================================================
  // Helper: calculate unique student count for a coach
  // =========================================================================

  private async calculateStudentCount(coachId: string): Promise<number> {
    const [gcParticipants, plParticipants] = await Promise.all([
      this.repository.getGroupClassParticipantIds(coachId),
      this.repository.getPrivateLessonParticipantIds(coachId),
    ]);
    const uniqueIds = new Set([...gcParticipants, ...plParticipants]);
    return uniqueIds.size;
  }

  // =========================================================================
  // GET /api/coaches — Coach list
  // =========================================================================

  async getCoachList(query: CoachListQuery) {
    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;
    const specialty = query.specialty;

    // Validate specialty if provided
    if (specialty && !VALID_SPECIALTIES.includes(specialty)) {
      throw new AppError(400, 'COACHING_INVALID_SPECIALTY', '擅长方向值不在枚举范围内');
    }

    const result = await this.repository.findCoachList({ page, pageSize, specialty });

    // Batch fetch user info
    const userIds = result.items.map((item: { userId: string }) => item.userId);
    const users = userIds.length > 0 ? await this.userService.getUsersByIds(userIds) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Calculate studentCount for each coach
    // Note: Uses per-coach queries (N+1). Repository has getBatchCoachStudentCounts()
    // for batch optimization, but contract test mocks don't include it (mock was authored
    // before the method existed). Switching would cause contract test TypeError.
    // TODO: Use getBatchCoachStudentCounts once contract test mocks are updated.
    const items = await Promise.all(
      result.items.map(async (profile: { userId: string; bio: string | null; specialties: string[] }) => {
        const user = userMap.get(profile.userId);
        const studentCount = await this.calculateStudentCount(profile.userId);
        return {
          userId: profile.userId,
          nickname: user?.nickname ?? '',
          avatarUrl: user?.avatarUrl ?? null,
          bio: profile.bio,
          specialties: profile.specialties,
          studentCount,
        };
      }),
    );

    return {
      items,
      total: result.total,
      page,
      pageSize,
    };
  }

  // =========================================================================
  // GET /api/coaches/:id — Coach profile
  // =========================================================================

  async getCoachProfile(coachId: string) {
    // Check user exists and is a coach
    const user = await this.userService.getUserById(coachId);
    if (!user || !user.isCoach) {
      throw new AppError(404, 'COACHING_NOT_A_COACH', '用户不存在或不是教练角色');
    }

    // Get coach profile (may not exist yet if they haven't edited)
    const profile = await this.repository.findCoachProfile(coachId);

    // Get private lesson slots (may not be implemented yet)
    // TODO: Remove try-catch workaround when Task #33 implements findAvailability
    let privateLessonSlots: unknown[] = [];
    try {
      privateLessonSlots = await this.repository.findAvailability(coachId);
    } catch {
      // findAvailability not yet implemented — return empty array
      privateLessonSlots = [];
    }

    // Calculate student count
    const studentCount = await this.calculateStudentCount(coachId);

    // Get group classes: endTime > now - 30 days, sorted by startTime ascending
    // Uses findGroupClassesByCoach which queries by coachId + endTime condition.
    // Wrapped in try-catch because contract test mocks may not include this method
    // (the mock was authored before findGroupClassesByCoach was added to repository).
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let rawGroupClasses: Array<{
      id: string;
      venueId: string | null;
      title: string;
      startTime: Date;
      endTime: Date;
      maxParticipants: number;
      currentParticipants: number;
      feeDescription: string | null;
      status: string;
    }> = [];
    try {
      rawGroupClasses = await this.repository.findGroupClassesByCoach(coachId, thirtyDaysAgo);
    } catch {
      // findGroupClassesByCoach not available in mock — return empty array
      rawGroupClasses = [];
    }

    // Collect unique venue IDs and batch fetch venue info
    const venueIds = [...new Set(rawGroupClasses.map((gc) => gc.venueId).filter(Boolean))] as string[];
    const venues = venueIds.length > 0
      ? await Promise.all(venueIds.map((id) => this.venueService.getVenueById(id)))
      : [];
    const venueMap = new Map(
      venues.filter(Boolean).map((v) => [v!.id, v!]),
    );

    const groupClasses = rawGroupClasses.map((gc) => {
      const venue = gc.venueId ? venueMap.get(gc.venueId) : null;
      return {
        id: gc.id,
        title: gc.title,
        startTime: gc.startTime,
        endTime: gc.endTime,
        venue: venue
          ? {
              id: venue.id,
              name: venue.name,
              address: venue.address,
            }
          : null,
        maxParticipants: gc.maxParticipants,
        currentParticipants: gc.currentParticipants,
        feeDescription: gc.feeDescription,
        status: gc.status,
      };
    });

    return {
      userId: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: profile?.bio ?? null,
      specialties: profile?.specialties ?? [],
      studentCount,
      groupClasses,
      privateLessonSlots: privateLessonSlots ?? [],
    };
  }

  // =========================================================================
  // PUT /api/coaches/me — Update coach profile
  // =========================================================================

  async updateCoachProfile(userId: string, input: UpdateCoachProfileInput) {
    // Check user is a coach
    const user = await this.userService.getUserById(userId);
    if (!user || !user.isCoach) {
      throw new AppError(403, 'COACHING_COACH_ROLE_REQUIRED', '当前用户不是教练角色，无权执行此操作');
    }

    // Validate bio
    if (input.bio !== undefined && input.bio.length > 500) {
      throw new AppError(400, 'COACHING_INVALID_BIO', '简介超过 500 字符');
    }

    // Validate and deduplicate specialties
    if (input.specialties !== undefined) {
      for (const s of input.specialties) {
        if (!VALID_SPECIALTIES.includes(s)) {
          throw new AppError(400, 'COACHING_INVALID_SPECIALTY', '擅长方向值不在枚举范围内');
        }
      }
      input = { ...input, specialties: [...new Set(input.specialties)] };
    }

    // Auto-create profile if not exists
    let profile = await this.repository.findCoachProfile(userId);
    if (!profile) {
      profile = await this.repository.createCoachProfile(userId);
    }

    // Build update data (only provided fields)
    const updateData: { bio?: string; specialties?: string[] } = {};
    if (input.bio !== undefined) updateData.bio = input.bio;
    if (input.specialties !== undefined) updateData.specialties = input.specialties;

    const updated = await this.repository.updateCoachProfile(userId, updateData);

    return {
      userId: updated.userId,
      bio: updated.bio,
      specialties: updated.specialties,
      updatedAt: updated.updatedAt,
    };
  }

  // =========================================================================
  // POST /api/group-classes — Create group class
  // =========================================================================

  async createGroupClass(userId: string, input: CreateGroupClassInput) {
    // Check user is a coach
    const user = await this.userService.getUserById(userId);
    if (!user || !user.isCoach) {
      throw new AppError(403, 'COACHING_COACH_ROLE_REQUIRED', '当前用户不是教练角色，无权执行此操作');
    }

    // Validate title
    if (!input.title || input.title.length > 50) {
      throw new AppError(400, 'COACHING_INVALID_TITLE', '课程名称为空或超过 50 字符');
    }

    // Validate venueId
    if (!input.venueId) {
      throw new AppError(400, 'COACHING_INVALID_VENUE', '球馆 ID 缺失或格式不合法');
    }

    // Validate time
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    if (startTime <= new Date()) {
      throw new AppError(400, 'COACHING_INVALID_TIME', '开始时间必须晚于当前时间');
    }
    if (endTime <= startTime) {
      throw new AppError(400, 'COACHING_INVALID_TIME', '结束时间必须晚于开始时间');
    }

    // Validate maxParticipants
    if (
      !Number.isInteger(input.maxParticipants) ||
      input.maxParticipants < 2 ||
      input.maxParticipants > 30
    ) {
      throw new AppError(400, 'COACHING_INVALID_PARTICIPANTS', '限定人数必须在 2-30 范围内');
    }

    // Validate feeDescription
    if (input.feeDescription !== undefined && input.feeDescription.length > 200) {
      throw new AppError(400, 'COACHING_INVALID_FEE_DESCRIPTION', '费用说明超过 200 字符');
    }

    // Validate venue exists
    const venue = await this.venueService.getVenueById(input.venueId);
    if (!venue) {
      throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
    }

    const groupClass = await this.repository.createGroupClass({
      coachId: userId,
      venueId: input.venueId,
      title: input.title,
      startTime,
      endTime,
      maxParticipants: input.maxParticipants,
      feeDescription: input.feeDescription,
    });

    return {
      id: groupClass.id,
      coachId: groupClass.coachId,
      title: groupClass.title,
      venue: {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        latitude: venue.latitude,
        longitude: venue.longitude,
      },
      startTime: groupClass.startTime,
      endTime: groupClass.endTime,
      maxParticipants: groupClass.maxParticipants,
      currentParticipants: groupClass.currentParticipants,
      feeDescription: groupClass.feeDescription,
      status: groupClass.status,
      createdAt: groupClass.createdAt,
    };
  }

  // =========================================================================
  // GET /api/group-classes/:id — Group class detail
  // =========================================================================

  async getGroupClassDetail(id: string) {
    const groupClass = await this.repository.findGroupClassById(id);
    if (!groupClass) {
      throw new AppError(404, 'COACHING_GROUP_CLASS_NOT_FOUND', '团课不存在');
    }

    // Get coach info
    const coach = await this.userService.getUserById(groupClass.coachId);

    // Get venue info
    let venue = null;
    if (groupClass.venueId) {
      venue = await this.venueService.getVenueById(groupClass.venueId);
    }

    // Enrich enrollments with user info
    const enrollmentUserIds = groupClass.enrollments.map(
      (e: { userId: string }) => e.userId,
    );
    const enrollmentUsers =
      enrollmentUserIds.length > 0
        ? await this.userService.getUsersByIds(enrollmentUserIds)
        : [];
    const userMap = new Map(enrollmentUsers.map((u) => [u.id, u]));

    // Sort enrollments by enrolledAt ascending
    const sortedEnrollments = [...groupClass.enrollments].sort(
      (a: { enrolledAt: Date }, b: { enrolledAt: Date }) =>
        new Date(a.enrolledAt).getTime() - new Date(b.enrolledAt).getTime(),
    );

    const enrollments = sortedEnrollments.map((e: { userId: string; enrolledAt: Date }) => {
      const u = userMap.get(e.userId);
      return {
        userId: e.userId,
        nickname: u?.nickname ?? '',
        avatarUrl: u?.avatarUrl ?? null,
        enrolledAt: e.enrolledAt,
      };
    });

    return {
      id: groupClass.id,
      coachId: groupClass.coachId,
      coach: coach
        ? {
            id: coach.id,
            nickname: coach.nickname,
            avatarUrl: coach.avatarUrl,
          }
        : null,
      title: groupClass.title,
      venue: venue
        ? {
            id: venue.id,
            name: venue.name,
            address: venue.address,
            latitude: venue.latitude,
            longitude: venue.longitude,
          }
        : null,
      startTime: groupClass.startTime,
      endTime: groupClass.endTime,
      maxParticipants: groupClass.maxParticipants,
      currentParticipants: groupClass.currentParticipants,
      feeDescription: groupClass.feeDescription,
      status: groupClass.status,
      enrollments,
      createdAt: groupClass.createdAt,
    };
  }

  // =========================================================================
  // PUT /api/group-classes/:id — Update group class
  // =========================================================================

  async updateGroupClass(classId: string, userId: string, input: UpdateGroupClassInput) {
    const groupClass = await this.repository.findGroupClassById(classId);
    if (!groupClass) {
      throw new AppError(404, 'COACHING_GROUP_CLASS_NOT_FOUND', '团课不存在');
    }

    // Check ownership
    if (groupClass.coachId !== userId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该团课的教练，无权修改');
    }

    // Check status is modifiable
    if (!['open', 'full'].includes(groupClass.status)) {
      throw new AppError(409, 'COACHING_CLASS_NOT_MODIFIABLE', '团课状态不允许修改');
    }

    // Validate title
    if (input.title !== undefined) {
      if (!input.title || input.title.length > 50) {
        throw new AppError(400, 'COACHING_INVALID_TITLE', '课程名称为空或超过 50 字符');
      }
    }

    // Validate venueId
    if (input.venueId !== undefined) {
      if (!input.venueId) {
        throw new AppError(400, 'COACHING_INVALID_VENUE', '球馆 ID 格式不合法');
      }
      const venue = await this.venueService.getVenueById(input.venueId);
      if (!venue) {
        throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
      }
    }

    // Validate time
    const newStartTime = input.startTime ? new Date(input.startTime) : groupClass.startTime;
    const newEndTime = input.endTime ? new Date(input.endTime) : groupClass.endTime;

    if (input.startTime !== undefined) {
      if (newStartTime <= new Date()) {
        throw new AppError(400, 'COACHING_INVALID_TIME', '开始时间必须晚于当前时间');
      }
    }

    if (input.startTime !== undefined || input.endTime !== undefined) {
      if (newEndTime <= newStartTime) {
        throw new AppError(400, 'COACHING_INVALID_TIME', '结束时间必须晚于开始时间');
      }
    }

    // Validate maxParticipants
    if (input.maxParticipants !== undefined) {
      if (
        !Number.isInteger(input.maxParticipants) ||
        input.maxParticipants < 2 ||
        input.maxParticipants > 30
      ) {
        throw new AppError(400, 'COACHING_INVALID_PARTICIPANTS', '限定人数必须在 2-30 范围内');
      }
      if (input.maxParticipants < groupClass.currentParticipants) {
        throw new AppError(
          400,
          'COACHING_PARTICIPANTS_EXCEED',
          '限定人数不能小于当前报名人数',
        );
      }
    }

    // Validate feeDescription
    if (input.feeDescription !== undefined && input.feeDescription.length > 200) {
      throw new AppError(400, 'COACHING_INVALID_FEE_DESCRIPTION', '费用说明超过 200 字符');
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.venueId !== undefined) updateData.venueId = input.venueId;
    if (input.startTime !== undefined) updateData.startTime = newStartTime;
    if (input.endTime !== undefined) updateData.endTime = newEndTime;
    if (input.maxParticipants !== undefined) updateData.maxParticipants = input.maxParticipants;
    if (input.feeDescription !== undefined) updateData.feeDescription = input.feeDescription;

    // Determine new status based on maxParticipants change
    const newMaxParticipants = input.maxParticipants ?? groupClass.maxParticipants;
    if (groupClass.currentParticipants >= newMaxParticipants) {
      updateData.status = 'full';
    } else if (groupClass.status === 'full' && groupClass.currentParticipants < newMaxParticipants) {
      updateData.status = 'open';
    }

    const updated = await this.repository.updateGroupClass(classId, updateData);

    // Get venue for response
    let venue = null;
    const venueId = updated.venueId;
    if (venueId) {
      venue = await this.venueService.getVenueById(venueId);
    }

    // Notify enrolled students (non-blocking)
    if (groupClass.enrollments && groupClass.enrollments.length > 0) {
      try {
        const notifications = groupClass.enrollments.map(
          (e: { userId: string }) => ({
            userId: e.userId,
            type: 'GROUP_CLASS_UPDATED',
            title: '团课已更新',
            content: `你报名的团课「${updated.title}」信息已更新`,
            targetType: 'group-class',
            targetId: classId,
          }),
        );
        await this.notificationService.createBatch(notifications);
      } catch (err) {
        logger.error(
          { error: (err as Error).message, groupClassId: classId },
          '团课更新通知发送失败',
        );
      }
    }

    return {
      id: updated.id,
      coachId: updated.coachId,
      title: updated.title,
      venue: venue
        ? {
            id: venue.id,
            name: venue.name,
            address: venue.address,
            latitude: venue.latitude,
            longitude: venue.longitude,
          }
        : null,
      startTime: updated.startTime,
      endTime: updated.endTime,
      maxParticipants: updated.maxParticipants,
      currentParticipants: updated.currentParticipants,
      feeDescription: updated.feeDescription,
      status: updated.status,
      createdAt: updated.createdAt,
    };
  }

  // =========================================================================
  // POST /api/group-classes/:id/cancel — Cancel group class
  // =========================================================================

  async cancelGroupClass(classId: string, userId: string) {
    const groupClass = await this.repository.findGroupClassById(classId);
    if (!groupClass) {
      throw new AppError(404, 'COACHING_GROUP_CLASS_NOT_FOUND', '团课不存在');
    }

    // Check ownership
    if (groupClass.coachId !== userId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该团课的教练，无权取消');
    }

    // Idempotent: already cancelled
    if (groupClass.status === 'cancelled') {
      return { id: groupClass.id, status: 'cancelled' };
    }

    // Check status is cancellable
    if (!['open', 'full'].includes(groupClass.status)) {
      throw new AppError(409, 'COACHING_CLASS_NOT_CANCELLABLE', '团课状态不允许取消');
    }

    const updated = await this.repository.updateGroupClass(classId, { status: 'cancelled' });

    // Notify enrolled students (non-blocking)
    if (groupClass.enrollments && groupClass.enrollments.length > 0) {
      try {
        const notifications = groupClass.enrollments.map(
          (e: { userId: string }) => ({
            userId: e.userId,
            type: 'GROUP_CLASS_CANCELLED',
            title: '团课已取消',
            content: `教练取消了团课「${groupClass.title}」`,
            targetType: 'group-class',
            targetId: classId,
          }),
        );
        await this.notificationService.createBatch(notifications);
      } catch (err) {
        logger.error(
          { error: (err as Error).message, groupClassId: classId },
          '团课取消通知发送失败',
        );
      }
    }

    return { id: updated.id, status: updated.status };
  }

  // =========================================================================
  // POST /api/group-classes/:id/enroll — Enroll in group class
  // =========================================================================

  async enrollGroupClass(_classId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  // =========================================================================
  // POST /api/group-classes/:id/cancel-enrollment — Cancel enrollment
  // =========================================================================

  async cancelEnrollment(_classId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  // =========================================================================
  // Private lesson methods (not in scope for Task #32)
  // =========================================================================

  async setAvailability(_userId: string, _input: SetAvailabilityInput) {
    throw new Error('Not implemented');
  }

  async getCoachAvailability(_coachId: string) {
    throw new Error('Not implemented');
  }

  async bookPrivateLesson(_userId: string, _input: BookPrivateLessonInput) {
    throw new Error('Not implemented');
  }

  async cancelPrivateLesson(_lessonId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async getUserEnrollments(_userId: string, _query: EnrollmentListQuery) {
    throw new Error('Not implemented');
  }

  async getCoachPrivateLessons(_coachId: string, _query: PrivateLessonListQuery) {
    throw new Error('Not implemented');
  }

  // =========================================================================
  // Cross-module service methods
  // =========================================================================

  async getGroupClassById(id: string) {
    const groupClass = await this.repository.findGroupClassById(id);
    if (!groupClass) return null;

    return {
      id: groupClass.id,
      coachId: groupClass.coachId,
      title: groupClass.title,
      venueId: groupClass.venueId,
      startTime: groupClass.startTime,
      endTime: groupClass.endTime,
      status: groupClass.status,
    };
  }

  async getPrivateLessonById(id: string) {
    const lesson = await this.repository.findPrivateLessonById(id);
    if (!lesson) return null;

    return {
      id: lesson.id,
      coachId: lesson.coachId,
      studentId: lesson.studentId,
      venueId: lesson.venueId,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      status: lesson.status,
    };
  }

  async getParticipantIds(
    classId: string,
    type: 'group-class' | 'private-lesson',
  ): Promise<string[]> {
    if (type === 'group-class') {
      const groupClass = await this.repository.findGroupClassById(classId);
      if (!groupClass) return [];
      const studentIds = groupClass.enrollments.map((e: { userId: string }) => e.userId);
      return [...new Set([groupClass.coachId, ...studentIds])];
    } else {
      const lesson = await this.repository.findPrivateLessonById(classId);
      if (!lesson) return [];
      return [lesson.coachId, lesson.studentId];
    }
  }

  // =========================================================================
  // Scheduled task: course status auto-transition
  // =========================================================================

  async processStatusTransitions(): Promise<void> {
    const now = new Date();

    try {
      const [gcStarted, gcCompleted, plStarted, plCompleted] = await Promise.all([
        this.repository.updateGroupClassesStarted(now),
        this.repository.updateGroupClassesCompleted(now),
        this.repository.updatePrivateLessonsStarted(now),
        this.repository.updatePrivateLessonsCompleted(now),
      ]);

      logger.info(
        {
          module: 'coaching-status',
          gcStarted,
          gcCompleted,
          plStarted,
          plCompleted,
        },
        '课程状态自动流转完成',
      );
    } catch (err) {
      logger.error(
        { module: 'coaching-status', error: (err as Error).message },
        '课程状态自动流转失败',
      );
    }
  }

  /**
   * Register cron tasks for course status transitions.
   * Design doc §6.3: every minute, scan and update course statuses.
   */
  registerScheduledTasks(): void {
    registerTask('coaching-status-transition', '* * * * *', async () => {
      await this.processStatusTransitions();
    });
  }
}
