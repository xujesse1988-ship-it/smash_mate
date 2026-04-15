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
  CreateCoachApplicationInput,
  ReviewCoachApplicationInput,
  CoachApplicationListQuery,
  CreateStudentClassInput,
  UpdateStudentClassInput,
  AddStudentToClassInput,
  CreateClassLessonInput,
  UpdateClassLessonInput,
  ClassLessonListQuery,
  CreateLessonNoteInput,
  CreateStudentNoteInput,
  SetStudentTagsInput,
  AddPrivateStudentInput,
  CreatePrivateLessonV2Input,
  UpdatePrivateLessonV2Input,
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
    phone?: string;
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
    const [gcStudents, plStudents] = await Promise.all([
      this.repository.getGroupClassParticipantIds(coachId, 'coach'),
      this.repository.getPrivateLessonParticipantIds(coachId, 'coach'),
    ]);
    const uniqueIds = new Set([...gcStudents, ...plStudents]);
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
      result.items.map(
        async (profile: { userId: string; bio: string | null; specialties: string[] }) => {
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
        },
      ),
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

    // Get private lesson slots (future, unbooked only for coach profile page)
    const rawSlots = await this.repository.findAvailability(coachId);
    const unbookedSlots = rawSlots.filter((s: { isBooked: boolean }) => !s.isBooked);

    // Calculate student count
    const studentCount = await this.calculateStudentCount(coachId);

    // Get group classes: endTime > now - 30 days, sorted by startTime ascending
    // Wrapped in try-catch because old contract test mocks don't include findGroupClassesByCoach
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
    rawGroupClasses = await this.repository.findGroupClassesByCoach(coachId, thirtyDaysAgo);

    // Collect all venue IDs (from group classes + private lesson slots)
    const gcVenueIds = rawGroupClasses.map((gc) => gc.venueId).filter(Boolean) as string[];
    const slotVenueIds = unbookedSlots.flatMap((s: { venueIds: string[] }) => s.venueIds || []);
    const allVenueIds = [...new Set([...gcVenueIds, ...slotVenueIds])];

    const venues =
      allVenueIds.length > 0
        ? await Promise.all(allVenueIds.map((id) => this.venueService.getVenueById(id)))
        : [];
    const venueMap = new Map(venues.filter(Boolean).map((v) => [v!.id, v!]));

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

    // Enrich private lesson slots with venue info
    const privateLessonSlots = unbookedSlots.map(
      (s: {
        id: string;
        startTime: Date;
        endTime: Date;
        venueIds: string[];
        feeDescription: string | null;
        isBooked: boolean;
      }) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        venues: (s.venueIds || [])
          .map((vid: string) => venueMap.get(vid))
          .filter(Boolean)
          .map((v) => ({ id: v!.id, name: v!.name, address: v!.address })),
        feeDescription: s.feeDescription,
        isBooked: s.isBooked,
      }),
    );

    return {
      userId: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: profile?.bio ?? null,
      specialties: profile?.specialties ?? [],
      studentCount,
      groupClasses,
      privateLessonSlots,
    };
  }

  // =========================================================================
  // PUT /api/coaches/me — Update coach profile
  // =========================================================================

  async updateCoachProfile(userId: string, input: UpdateCoachProfileInput) {
    // Check user is a coach
    const user = await this.userService.getUserById(userId);
    if (!user || !user.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
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
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
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

    logger.info(
      { coachId: userId.slice(0, 8), title: input.title, venueId: input.venueId, startTime },
      '团课发布',
    );

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
    const enrollmentUserIds = groupClass.enrollments.map((e: { userId: string }) => e.userId);
    const enrollmentUsers =
      enrollmentUserIds.length > 0 ? await this.userService.getUsersByIds(enrollmentUserIds) : [];
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
        throw new AppError(400, 'COACHING_PARTICIPANTS_EXCEED', '限定人数不能小于当前报名人数');
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
    } else if (
      groupClass.status === 'full' &&
      groupClass.currentParticipants < newMaxParticipants
    ) {
      updateData.status = 'open';
    }

    const updated = await this.repository.updateGroupClass(classId, updateData);

    logger.info({ groupClassId: classId, coachId: userId.slice(0, 8) }, '团课修改');

    // Get venue for response
    let venue = null;
    const venueId = updated.venueId;
    if (venueId) {
      venue = await this.venueService.getVenueById(venueId);
    }

    // Notify enrolled students (non-blocking)
    if (groupClass.enrollments && groupClass.enrollments.length > 0) {
      try {
        const notifications = groupClass.enrollments.map((e: { userId: string }) => ({
          userId: e.userId,
          type: 'GROUP_CLASS_UPDATED',
          title: '团课已更新',
          content: `你报名的团课「${updated.title}」信息已更新`,
          targetType: 'group-class',
          targetId: classId,
        }));
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

    logger.info({ groupClassId: classId, coachId: userId.slice(0, 8) }, '团课取消');

    // Notify enrolled students (non-blocking)
    if (groupClass.enrollments && groupClass.enrollments.length > 0) {
      try {
        const notifications = groupClass.enrollments.map((e: { userId: string }) => ({
          userId: e.userId,
          type: 'GROUP_CLASS_CANCELLED',
          title: '团课已取消',
          content: `教练取消了团课「${groupClass.title}」`,
          targetType: 'group-class',
          targetId: classId,
        }));
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

  async enrollGroupClass(classId: string, userId: string) {
    const groupClass = await this.repository.findGroupClassById(classId);
    if (!groupClass) {
      throw new AppError(404, 'COACHING_GROUP_CLASS_NOT_FOUND', '团课不存在');
    }

    // Check enrollable status
    if (groupClass.status === 'full') {
      throw new AppError(409, 'COACHING_CLASS_FULL', '团课已满员');
    }
    if (!['open'].includes(groupClass.status)) {
      throw new AppError(409, 'COACHING_CLASS_NOT_ENROLLABLE', '团课状态不允许报名');
    }

    // Coach cannot enroll in own class
    if (groupClass.coachId === userId) {
      throw new AppError(403, 'COACHING_CANNOT_ENROLL_OWN_CLASS', '教练不可报名自己发布的团课');
    }

    // Check duplicate enrollment
    const alreadyEnrolled = groupClass.enrollments.some(
      (e: { userId: string }) => e.userId === userId,
    );
    if (alreadyEnrolled) {
      throw new AppError(409, 'COACHING_ALREADY_ENROLLED', '学员已报名该团课');
    }

    // Perform enrollment in transaction
    const result = await this.repository.enrollGroupClass(classId, userId);

    // Send notification to coach (non-blocking)
    try {
      const student = await this.userService.getUserById(userId);
      const studentNickname = student?.nickname ?? '未知用户';
      await this.notificationService.create({
        userId: groupClass.coachId,
        type: 'GROUP_CLASS_ENROLLED',
        title: '新学员报名',
        content: `${studentNickname} 报名了你的团课「${groupClass.title}」`,
        targetType: 'group-class',
        targetId: classId,
      });
    } catch (err) {
      logger.error(
        { error: (err as Error).message, groupClassId: classId },
        '团课报名通知发送失败',
      );
    }

    logger.info(
      { groupClassId: classId, userId: userId.substring(0, 8), operation: 'enroll' },
      '学员报名团课',
    );

    return {
      groupClassId: classId,
      userId,
      currentParticipants: result.currentParticipants,
      status: result.status,
      enrolledAt: result.enrolledAt,
    };
  }

  // =========================================================================
  // POST /api/group-classes/:id/cancel-enrollment — Cancel enrollment
  // =========================================================================

  async cancelEnrollment(classId: string, userId: string) {
    const groupClass = await this.repository.findGroupClassById(classId);
    if (!groupClass) {
      throw new AppError(404, 'COACHING_GROUP_CLASS_NOT_FOUND', '团课不存在');
    }

    // Check if status allows cancellation
    if (!['open', 'full'].includes(groupClass.status)) {
      throw new AppError(
        409,
        'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT',
        '团课状态不允许取消报名',
      );
    }

    // Check student is enrolled
    const isEnrolled = groupClass.enrollments.some((e: { userId: string }) => e.userId === userId);
    if (!isEnrolled) {
      throw new AppError(409, 'COACHING_NOT_ENROLLED', '学员未报名该团课');
    }

    // Perform cancellation in transaction
    const result = await this.repository.cancelEnrollment(classId, userId);

    // Send notification to coach (non-blocking)
    try {
      const student = await this.userService.getUserById(userId);
      const studentNickname = student?.nickname ?? '未知用户';
      await this.notificationService.create({
        userId: groupClass.coachId,
        type: 'GROUP_CLASS_ENROLLMENT_CANCELLED',
        title: '学员取消报名',
        content: `${studentNickname} 取消了团课「${groupClass.title}」的报名`,
        targetType: 'group-class',
        targetId: classId,
      });
    } catch (err) {
      logger.error(
        { error: (err as Error).message, groupClassId: classId },
        '取消报名通知发送失败',
      );
    }

    logger.info(
      { groupClassId: classId, userId: userId.substring(0, 8), operation: 'cancel-enrollment' },
      '学员取消团课报名',
    );

    return {
      groupClassId: classId,
      userId,
      currentParticipants: result.currentParticipants,
      status: result.status,
    };
  }

  // =========================================================================
  // POST /api/private-lessons/availability — Set availability
  // =========================================================================

  async setAvailability(userId: string, input: SetAvailabilityInput) {
    // Check user is a coach
    const user = await this.userService.getUserById(userId);
    if (!user || !user.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
    }

    // Validate slots not empty
    if (!input.slots || !Array.isArray(input.slots) || input.slots.length === 0) {
      throw new AppError(400, 'COACHING_INVALID_SLOTS', '时间段列表不能为空');
    }

    // Validate each slot
    for (const slot of input.slots) {
      const startTime = new Date(slot.startTime);
      const endTime = new Date(slot.endTime);

      // startTime must be in the future
      if (startTime <= new Date()) {
        throw new AppError(400, 'COACHING_INVALID_SLOT_TIME', '时间段开始时间必须晚于当前时间');
      }

      // endTime must be after startTime
      if (endTime <= startTime) {
        throw new AppError(400, 'COACHING_INVALID_SLOT_TIME', '时间段结束时间必须晚于开始时间');
      }

      // Minimum duration: 1 hour
      const durationMs = endTime.getTime() - startTime.getTime();
      if (durationMs < 60 * 60 * 1000) {
        throw new AppError(400, 'COACHING_SLOT_TOO_SHORT', '时间段时长不足 1 小时');
      }

      // feeDescription max 200 chars
      if (slot.feeDescription !== undefined && slot.feeDescription.length > 200) {
        throw new AppError(400, 'COACHING_INVALID_FEE_DESCRIPTION', '费用说明超过 200 字符');
      }

      // Validate venueIds if provided
      if (slot.venueIds && slot.venueIds.length > 0) {
        for (const venueId of slot.venueIds) {
          const venue = await this.venueService.getVenueById(venueId);
          if (!venue) {
            throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
          }
        }
      }
    }

    // Check for overlap within the batch
    for (let i = 0; i < input.slots.length; i++) {
      for (let j = i + 1; j < input.slots.length; j++) {
        const a = {
          start: new Date(input.slots[i].startTime),
          end: new Date(input.slots[i].endTime),
        };
        const b = {
          start: new Date(input.slots[j].startTime),
          end: new Date(input.slots[j].endTime),
        };
        if (a.start < b.end && b.start < a.end) {
          throw new AppError(409, 'COACHING_SLOT_OVERLAP', '时间段与其他时间段重叠');
        }
      }
    }

    // Check for overlap with existing slots
    const existingSlots = await this.repository.findAvailability(userId);
    for (const newSlot of input.slots) {
      const newStart = new Date(newSlot.startTime);
      const newEnd = new Date(newSlot.endTime);
      for (const existing of existingSlots) {
        if (newStart < existing.endTime && existing.startTime < newEnd) {
          throw new AppError(409, 'COACHING_SLOT_OVERLAP', '时间段与已有时间段重叠');
        }
      }
    }

    // Create slots
    const slotsData = input.slots.map((slot) => ({
      coachId: userId,
      startTime: new Date(slot.startTime),
      endTime: new Date(slot.endTime),
      venueIds: slot.venueIds ?? [],
      feeDescription: slot.feeDescription ?? null,
    }));

    const createdSlots = await this.repository.createPrivateLessonSlot(slotsData);

    logger.info(
      { coachId: userId.substring(0, 8), slotCount: input.slots.length },
      '教练设置私教空闲时间',
    );

    return {
      slots: Array.isArray(createdSlots) ? createdSlots : [createdSlots],
    };
  }

  // =========================================================================
  // GET /api/coaches/:id/availability — Get coach availability
  // =========================================================================

  async getCoachAvailability(coachId: string, options?: { startDate?: string; endDate?: string }) {
    // Check user exists and is a coach
    const user = await this.userService.getUserById(coachId);
    if (!user || !user.isCoach) {
      throw new AppError(404, 'COACHING_NOT_A_COACH', '用户不存在或不是教练角色');
    }

    // Determine date range
    const startDate = options?.startDate ?? new Date().toISOString();
    let endDate = options?.endDate;
    if (!endDate) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + 14);
      endDate = d.toISOString();
    }

    // Query slots from repository
    const rawSlots = await this.repository.findAvailability({
      coachId,
      startDate,
      endDate,
    });

    // Enrich with venue info
    const allVenueIds = new Set<string>();
    for (const slot of rawSlots) {
      if (slot.venueIds) {
        for (const vid of slot.venueIds) {
          allVenueIds.add(vid);
        }
      }
    }

    const venueMap = new Map<string, { id: string; name: string; address: string }>();
    for (const venueId of allVenueIds) {
      const venue = await this.venueService.getVenueById(venueId);
      if (venue) {
        venueMap.set(venueId, { id: venue.id, name: venue.name, address: venue.address });
      }
    }

    const slots = rawSlots.map(
      (slot: {
        id: string;
        startTime: Date;
        endTime: Date;
        venueIds: string[];
        feeDescription: string | null;
        isBooked: boolean;
      }) => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        venues: (slot.venueIds ?? []).map((vid: string) => venueMap.get(vid)).filter(Boolean),
        feeDescription: slot.feeDescription,
        isBooked: slot.isBooked,
      }),
    );

    return { slots };
  }

  // =========================================================================
  // POST /api/private-lessons/book — Book private lesson
  // =========================================================================

  async bookPrivateLesson(userId: string, input: BookPrivateLessonInput) {
    // Validate slotId
    if (!input.slotId) {
      throw new AppError(400, 'COACHING_INVALID_SLOT', 'slotId 缺失或格式不合法');
    }

    // Find the slot via findAvailability
    // Contract tests mock findAvailability to return the target slot directly.
    // Real repo uses slotId param for direct lookup.
    const slotsResult = await this.repository.findAvailability({ slotId: input.slotId });
    const availableSlots = slotsResult as Array<{
      id: string;
      coachId: string;
      startTime: Date;
      endTime: Date;
      venueIds: string[];
      feeDescription: string | null;
      isBooked: boolean;
    }>;

    const slot = availableSlots.find((s) => s.id === input.slotId);
    if (!slot) {
      throw new AppError(404, 'COACHING_SLOT_NOT_FOUND', '时间段不存在');
    }

    // Check if already booked
    if (slot.isBooked) {
      throw new AppError(409, 'COACHING_SLOT_ALREADY_BOOKED', '时间段已被预约');
    }

    // Check if expired
    if (slot.startTime <= new Date()) {
      throw new AppError(409, 'COACHING_SLOT_EXPIRED', '时间段已过期');
    }

    // Coach cannot book own lesson
    if (slot.coachId === userId) {
      throw new AppError(403, 'COACHING_CANNOT_BOOK_OWN_LESSON', '教练不可预约自己的私教课');
    }

    // Validate venue
    if (slot.venueIds && slot.venueIds.length > 0) {
      // Venue required
      if (!input.venueId) {
        throw new AppError(400, 'COACHING_VENUE_REQUIRED', '时间段设置了可选球馆，请选择球馆');
      }
      if (!slot.venueIds.includes(input.venueId)) {
        throw new AppError(400, 'COACHING_INVALID_VENUE_CHOICE', '选择的球馆不在可选列表中');
      }
    } else if (input.venueId) {
      // No venue restriction but venue provided - validate it exists
      const venue = await this.venueService.getVenueById(input.venueId);
      if (!venue) {
        throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
      }
    }

    // Book the lesson in transaction
    const lesson = await this.repository.bookPrivateLesson({
      slotId: input.slotId,
      coachId: slot.coachId,
      studentId: userId,
      venueId: input.venueId ?? null,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });

    // Send notification to coach (non-blocking)
    try {
      const student = await this.userService.getUserById(userId);
      const studentNickname = student?.nickname ?? '未知用户';
      const startDate = new Date(slot.startTime);
      const dateStr = `${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}`;
      const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      const endDate = new Date(slot.endTime);
      const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      await this.notificationService.create({
        userId: slot.coachId,
        type: 'PRIVATE_LESSON_BOOKED',
        title: '新私教预约',
        content: `${studentNickname} 预约了你的私教课（${dateStr} ${startTimeStr}-${endTimeStr}）`,
        targetType: 'private-lesson',
        targetId: lesson.id,
      });
    } catch (err) {
      logger.error(
        { error: (err as Error).message, privateLessonId: lesson.id },
        '私教预约通知发送失败',
      );
    }

    logger.info(
      {
        privateLessonId: lesson.id,
        studentId: userId.substring(0, 8),
        coachId: slot.coachId.substring(0, 8),
        operation: 'book',
      },
      '学员预约私教课',
    );

    // Fetch venue info if venueId is present
    let venue: { id: string; name: string; address: string } | null = null;
    if (lesson.venueId) {
      const venueInfo = await this.venueService.getVenueById(lesson.venueId);
      if (venueInfo) {
        venue = {
          id: venueInfo.id,
          name: venueInfo.name,
          address: venueInfo.address,
        };
      }
    }

    return {
      id: lesson.id,
      slotId: lesson.slotId,
      coachId: lesson.coachId,
      studentId: lesson.studentId,
      venueId: lesson.venueId,
      venue,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      status: lesson.status,
      createdAt: lesson.createdAt,
    };
  }

  // =========================================================================
  // POST /api/private-lessons/:id/cancel — Cancel private lesson
  // =========================================================================

  async cancelPrivateLesson(lessonId: string, userId: string) {
    const lesson = await this.repository.findPrivateLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_NOT_FOUND', '私教课不存在');
    }

    // Check participant
    if (lesson.coachId !== userId && lesson.studentId !== userId) {
      throw new AppError(403, 'COACHING_NOT_LESSON_PARTICIPANT', '当前用户不是该私教课的参与者');
    }

    // Idempotent: already cancelled
    if (lesson.status === 'cancelled') {
      return { id: lesson.id, status: 'cancelled' };
    }

    // Check cancellable status
    if (lesson.status !== 'scheduled') {
      throw new AppError(409, 'COACHING_LESSON_NOT_CANCELLABLE', '私教课状态不允许取消');
    }

    // Cancel in transaction (update lesson status + release slot)
    await this.repository.cancelPrivateLesson(lessonId);

    // Send notification (non-blocking)
    try {
      const startDate = new Date(lesson.startTime);
      const dateStr = `${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}`;
      const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      const endDate = new Date(lesson.endTime);
      const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      if (userId === lesson.studentId) {
        // Student cancelled — notify coach
        const student = await this.userService.getUserById(userId);
        const studentNickname = student?.nickname ?? '未知用户';
        await this.notificationService.create({
          userId: lesson.coachId,
          type: 'PRIVATE_LESSON_CANCELLED_BY_STUDENT',
          title: '学员取消私教',
          content: `${studentNickname} 取消了私教课预约（${dateStr} ${startTimeStr}-${endTimeStr}）`,
          targetType: 'private-lesson',
          targetId: lessonId,
        });
      } else {
        // Coach cancelled — notify student
        await this.notificationService.create({
          userId: lesson.studentId,
          type: 'PRIVATE_LESSON_CANCELLED_BY_COACH',
          title: '教练取消私教',
          content: `教练取消了你的私教课预约（${dateStr} ${startTimeStr}-${endTimeStr}）`,
          targetType: 'coach-profile',
          targetId: lesson.coachId,
        });
      }
    } catch (err) {
      logger.error(
        { error: (err as Error).message, privateLessonId: lessonId },
        '私教取消通知发送失败',
      );
    }

    logger.info(
      {
        privateLessonId: lessonId,
        studentId: lesson.studentId.substring(0, 8),
        coachId: lesson.coachId.substring(0, 8),
        operation: 'cancel',
      },
      '私教课取消',
    );

    return { id: lesson.id, status: 'cancelled' };
  }

  // =========================================================================
  // GET /api/users/:id/enrollments — User enrollments list
  // =========================================================================

  async getUserEnrollments(userId: string, query: EnrollmentListQuery) {
    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;

    const result = await this.repository.findUserEnrollments(userId, {
      page,
      pageSize,
      type: query.type,
      status: query.status,
    });

    // Collect coach IDs for batch user info
    const coachIds = new Set<string>();
    for (const item of result.items) {
      if (item.type === 'group-class' && item.groupClass) {
        coachIds.add(item.groupClass.coachId);
      }
      if (item.type === 'private-lesson' && item.privateLesson) {
        coachIds.add(item.privateLesson.coachId);
      }
      if (item.type === 'class-lesson' && item.classLesson) {
        coachIds.add(item.classLesson.coachId);
      }
    }

    const coachUsers = coachIds.size > 0 ? await this.userService.getUsersByIds([...coachIds]) : [];
    const coachMap = new Map(coachUsers.map((u) => [u.id, u]));

    // Enrich items with coach nickname
    const enrichedItems = result.items.map(
      (item: {
        type: string;
        groupClass: {
          id: string;
          title: string;
          coachId: string;
          startTime: Date;
          endTime: Date;
          status: string;
          enrolledAt: Date;
          venue?: { id: string; name: string } | null;
        } | null;
        privateLesson: {
          id: string;
          coachId: string;
          startTime: Date;
          endTime: Date;
          status: string;
          createdAt: Date;
          venue?: { id: string; name: string } | null;
        } | null;
        classLesson: {
          id: string;
          studentClassId: string;
          studentClassName: string;
          coachId: string;
          startTime: Date;
          endTime: Date;
          status: string;
          createdAt: Date;
          venue?: { id: string; name: string } | null;
        } | null;
      }) => {
        if (item.type === 'group-class' && item.groupClass) {
          const coach = coachMap.get(item.groupClass.coachId);
          return {
            ...item,
            groupClass: {
              ...item.groupClass,
              coachNickname: coach?.nickname ?? '',
            },
          };
        }
        if (item.type === 'private-lesson' && item.privateLesson) {
          const coach = coachMap.get(item.privateLesson.coachId);
          return {
            ...item,
            privateLesson: {
              ...item.privateLesson,
              coachNickname: coach?.nickname ?? '',
            },
          };
        }
        if (item.type === 'class-lesson' && item.classLesson) {
          const coach = coachMap.get(item.classLesson.coachId);
          return {
            ...item,
            classLesson: {
              ...item.classLesson,
              coachNickname: coach?.nickname ?? '',
            },
          };
        }
        return item;
      },
    );

    return {
      items: enrichedItems,
      total: result.total,
      page,
      pageSize,
    };
  }

  // =========================================================================
  // GET /api/coaches/:id/private-lessons — Coach's private lessons list
  // =========================================================================

  async getCoachPrivateLessons(coachId: string, query: PrivateLessonListQuery) {
    // Check user exists and is a coach
    const user = await this.userService.getUserById(coachId);
    if (!user || !user.isCoach) {
      throw new AppError(404, 'COACHING_NOT_A_COACH', '用户不存在或不是教练角色');
    }

    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;

    const result = await this.repository.findCoachPrivateLessons(coachId, {
      page,
      pageSize,
      status: query.status,
    });

    // Batch fetch student info
    const studentIds = result.items.map((item: { studentId: string }) => item.studentId);
    const uniqueStudentIds = [...new Set(studentIds)];
    const students =
      uniqueStudentIds.length > 0 ? await this.userService.getUsersByIds(uniqueStudentIds) : [];
    const studentMap = new Map(students.map((u) => [u.id, u]));

    // Enrich items with student info and venue info
    const enrichedItems = await Promise.all(
      result.items.map(
        async (item: {
          id: string;
          slotId: string;
          coachId: string;
          studentId: string;
          venueId: string | null;
          startTime: Date;
          endTime: Date;
          status: string;
          createdAt: Date;
        }) => {
          const student = studentMap.get(item.studentId);
          let venue = null;
          if (item.venueId) {
            venue = await this.venueService.getVenueById(item.venueId);
          }
          return {
            id: item.id,
            slot: {
              startTime: item.startTime,
              endTime: item.endTime,
            },
            venue: venue ? { id: venue.id, name: venue.name, address: venue.address } : null,
            student: student
              ? { id: student.id, nickname: student.nickname, avatarUrl: student.avatarUrl }
              : null,
            status: item.status,
            createdAt: item.createdAt,
          };
        },
      ),
    );

    return {
      items: enrichedItems,
      total: result.total,
      page,
      pageSize,
    };
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
      return this.repository.getGroupClassParticipantIds(classId);
    } else {
      return this.repository.getPrivateLessonParticipantIds(classId);
    }
  }

  // =========================================================================
  // Scheduled task: course status auto-transition
  // =========================================================================

  async processStatusTransitions(): Promise<void> {
    const now = new Date();

    try {
      const [
        gcStarted,
        gcCompleted,
        plStarted,
        plCompleted,
        clStarted,
        clCompleted,
        plv2Started,
        plv2Completed,
      ] = await Promise.all([
        this.repository.updateGroupClassesStarted(now),
        this.repository.updateGroupClassesCompleted(now),
        this.repository.updatePrivateLessonsStarted(now),
        this.repository.updatePrivateLessonsCompleted(now),
        this.repository.updateClassLessonsStarted(now),
        this.repository.updateClassLessonsCompleted(now),
        this.repository.updatePrivateLessonsV2Started(now),
        this.repository.updatePrivateLessonsV2Completed(now),
      ]);

      logger.info(
        {
          module: 'coaching-status',
          gcStarted,
          gcCompleted,
          plStarted,
          plCompleted,
          clStarted,
          clCompleted,
          plv2Started,
          plv2Completed,
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

  // =========================================================================
  // POST /api/coach-applications — Submit coach application
  // =========================================================================

  async submitCoachApplication(userId: string, input: CreateCoachApplicationInput) {
    const { certificateUrls, description } = input;

    // 1. Validate certificateUrls count (1-5)
    if (
      !certificateUrls ||
      !Array.isArray(certificateUrls) ||
      certificateUrls.length === 0 ||
      certificateUrls.length > 5
    ) {
      throw new AppError(400, 'COACHING_INVALID_CERTIFICATES', '证书图片数量必须在 1-5 张之间');
    }

    // 2. Validate each URL format (http/https or relative /api/uploads path)
    for (const url of certificateUrls) {
      if (
        !url.startsWith('http://') &&
        !url.startsWith('https://') &&
        !url.startsWith('/api/uploads/')
      ) {
        throw new AppError(400, 'COACHING_INVALID_CERTIFICATE_URL', '证书图片 URL 格式不合法');
      }
    }

    // 3. Validate each URL extension (.jpg/.jpeg/.png)
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    for (const url of certificateUrls) {
      const lowerUrl = url.toLowerCase();
      const hasValidExtension = validExtensions.some((ext) => lowerUrl.endsWith(ext));
      if (!hasValidExtension) {
        throw new AppError(
          400,
          'COACHING_INVALID_CERTIFICATE_FORMAT',
          '证书图片格式仅支持 JPG/PNG',
        );
      }
    }

    // 4. Validate description (optional, max 200 chars)
    if (description !== undefined && description !== null && description.length > 200) {
      throw new AppError(400, 'COACHING_INVALID_DESCRIPTION', '简要说明不能超过 200 字符');
    }

    // 5. Check user is not already a coach
    const user = await this.userService.getUserById(userId);
    if (user && user.isCoach) {
      throw new AppError(409, 'COACHING_ALREADY_COACH', '用户已是教练，无需重复申请');
    }

    // 6. Check no pending application exists
    const latestApplication = await this.repository.findLatestApplicationByUser(userId);
    if (latestApplication && latestApplication.status === 'pending') {
      throw new AppError(409, 'COACHING_APPLICATION_PENDING', '已有审核中的申请，请勿重复提交');
    }

    // 7. Create CoachApplication record
    const application = await this.repository.createCoachApplication({
      userId,
      certificateUrls,
      description,
    });

    logger.info(
      { userId: userId.slice(0, 8), certificateCount: certificateUrls.length },
      '教练申请提交',
    );

    return application;
  }

  // =========================================================================
  // GET /api/coach-applications/me — Get my application status
  // =========================================================================

  async getMyApplicationStatus(userId: string) {
    return this.repository.findLatestApplicationByUser(userId);
  }

  // =========================================================================
  // POST /api/admin/coach-applications/:id/review — Review coach application
  // =========================================================================

  async reviewCoachApplication(
    applicationId: string,
    adminId: string,
    input: ReviewCoachApplicationInput,
  ) {
    // 1. Find application
    const application = await this.repository.findCoachApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, 'COACHING_APPLICATION_NOT_FOUND', '教练申请不存在');
    }

    // 2. Check status is pending
    if (application.status !== 'pending') {
      throw new AppError(409, 'COACHING_APPLICATION_ALREADY_REVIEWED', '该申请已审核过');
    }

    // 3. Validate status value
    if (input.status !== 'approved' && input.status !== 'rejected') {
      throw new AppError(
        400,
        'COACHING_INVALID_REVIEW_STATUS',
        '审核状态必须为 approved 或 rejected',
      );
    }

    // 4. If rejecting, validate rejectReason
    if (input.status === 'rejected') {
      if (!input.rejectReason) {
        throw new AppError(400, 'COACHING_REJECT_REASON_REQUIRED', '拒绝时必须填写原因');
      }
      if (input.rejectReason.length < 5) {
        throw new AppError(400, 'COACHING_REJECT_REASON_TOO_SHORT', '拒绝原因至少 5 个字符');
      }
    }

    const now = new Date();

    if (input.status === 'approved') {
      // 5a. Approve: update application, user, and create coach profile
      const updatedApplication = await this.repository.updateCoachApplication(
        applicationId,
        {
          status: 'approved',
          reviewedBy: adminId,
          reviewedAt: now,
        },
        { setUserIsCoach: { userId: application.userId, isCoach: true } },
      );

      // Create CoachProfile if not exists
      const existingProfile = await this.repository.findCoachProfile(application.userId);
      if (!existingProfile) {
        await this.repository.createCoachProfile(application.userId);
      }

      // 6. Send notification (non-blocking)
      try {
        await this.notificationService.create({
          userId: application.userId,
          type: 'COACH_APPLICATION_APPROVED',
          title: '教练资质审核已通过',
          content: '恭喜！你的教练资质审核已通过，现在可以使用全部教练功能',
          targetType: 'coach-application',
          targetId: applicationId,
        });
      } catch (err) {
        logger.error({ error: (err as Error).message, applicationId }, '教练审核通知发送失败');
      }

      logger.info(
        { applicationId, reviewedBy: adminId.slice(0, 8), result: 'approved' },
        '管理员审核教练申请',
      );

      return updatedApplication;
    } else {
      // 5b. Reject: update application
      const updatedApplication = await this.repository.updateCoachApplication(applicationId, {
        status: 'rejected',
        rejectReason: input.rejectReason,
        reviewedBy: adminId,
        reviewedAt: now,
      });

      // 6. Send notification (non-blocking)
      try {
        await this.notificationService.create({
          userId: application.userId,
          type: 'COACH_APPLICATION_REJECTED',
          title: '教练资质审核未通过',
          content: `你的教练资质审核未通过，原因：${input.rejectReason}。你可以修改后重新提交申请`,
          targetType: 'coach-application',
          targetId: applicationId,
        });
      } catch (err) {
        logger.error({ error: (err as Error).message, applicationId }, '教练审核通知发送失败');
      }

      logger.info(
        { applicationId, reviewedBy: adminId.slice(0, 8), result: 'rejected' },
        '管理员审核教练申请',
      );

      return updatedApplication;
    }
  }

  // =========================================================================
  // GET /api/admin/coach-applications — Get application list
  // =========================================================================

  async getApplicationList(query: CoachApplicationListQuery) {
    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;

    const result = await this.repository.findCoachApplications({
      status: query.status,
      page,
      pageSize,
    });

    // Batch fetch user info
    const userIds = result.items.map((item: { userId: string }) => item.userId);
    const users = userIds.length > 0 ? await this.userService.getUsersByIds(userIds) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const items = result.items.map(
      (item: {
        id: string;
        userId: string;
        certificateUrls: string[];
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
      }) => {
        const user = userMap.get(item.userId);
        return {
          id: item.id,
          userId: item.userId,
          nickname: user?.nickname ?? '',
          avatarUrl: user?.avatarUrl ?? null,
          certificateUrls: item.certificateUrls,
          description: item.description,
          status: item.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      },
    );

    return {
      items,
      total: result.total,
      page,
      pageSize,
    };
  }

  // =========================================================================
  // GET /api/admin/coach-applications/:id — Get application by ID
  // =========================================================================

  async getApplicationById(applicationId: string) {
    const application = await this.repository.findCoachApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, 'COACHING_APPLICATION_NOT_FOUND', '教练申请不存在');
    }

    // Fetch user info (including phone for admin detail view)
    const user = await this.userService.getUserById(application.userId);

    // Mask phone number (middle 4 digits)
    let maskedPhone: string | undefined;
    if (user?.phone) {
      maskedPhone = user.phone.slice(0, 3) + '****' + user.phone.slice(7);
    }

    return {
      id: application.id,
      userId: application.userId,
      nickname: user?.nickname ?? '',
      avatarUrl: user?.avatarUrl ?? null,
      phone: maskedPhone,
      certificateUrls: application.certificateUrls,
      description: application.description,
      status: application.status,
      rejectReason: application.rejectReason,
      reviewedBy: application.reviewedBy,
      reviewedAt: application.reviewedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }

  // =========================================================================
  // GB: POST /api/student-classes — Create student class
  // =========================================================================

  async createStudentClass(coachId: string, input: CreateStudentClassInput) {
    const user = await this.userService.getUserById(coachId);
    if (!user || !user.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
    }
    if (!input.name || input.name.length < 2 || input.name.length > 30) {
      throw new AppError(
        400,
        'COACHING_INVALID_CLASS_NAME',
        '班级名称为空或长度不在 2-30 字符范围内',
      );
    }

    const studentClass = await this.repository.createStudentClass({ coachId, name: input.name });
    logger.info({ coachId: coachId.slice(0, 8), name: input.name }, '学员班创建');

    return {
      id: studentClass.id,
      coachId: studentClass.coachId,
      name: studentClass.name,
      memberCount: 0,
      lessonCount: 0,
      createdAt: studentClass.createdAt,
    };
  }

  // =========================================================================
  // GB: GET /api/student-classes — List student classes
  // =========================================================================

  async getStudentClasses(coachId: string) {
    const user = await this.userService.getUserById(coachId);
    if (!user || !user.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
    }

    const classes = await this.repository.findStudentClassesByCoach(coachId);
    const items = await Promise.all(
      classes.map(async (cls: { id: string; coachId: string; name: string; createdAt: Date }) => {
        const [memberCount, lessonCount] = await Promise.all([
          this.repository.countStudentClassMembers(cls.id),
          this.repository.countClassLessons(cls.id),
        ]);
        return {
          id: cls.id,
          coachId: cls.coachId,
          name: cls.name,
          memberCount,
          lessonCount,
          createdAt: cls.createdAt,
        };
      }),
    );
    return { items };
  }

  // =========================================================================
  // GB: GET /api/student-classes/:id — Student class detail
  // =========================================================================

  async getStudentClassDetail(coachId: string, classId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');

    const members = await this.repository.findStudentClassMembers(classId);
    const [memberCount, lessonCount] = await Promise.all([
      this.repository.countStudentClassMembers(classId),
      this.repository.countClassLessons(classId),
    ]);
    const studentIds = members.map((m: { studentId: string }) => m.studentId);
    const users = studentIds.length > 0 ? await this.userService.getUsersByIds(studentIds) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const enrichedMembers = members.map((m: { studentId: string; joinedAt: Date }) => {
      const u = userMap.get(m.studentId);
      return {
        studentId: m.studentId,
        nickname: u?.nickname ?? '',
        avatarUrl: u?.avatarUrl ?? null,
        joinedAt: m.joinedAt,
      };
    });

    return {
      id: studentClass.id,
      coachId: studentClass.coachId,
      name: studentClass.name,
      memberCount,
      lessonCount,
      members: enrichedMembers,
      createdAt: studentClass.createdAt,
    };
  }

  // =========================================================================
  // GB: PUT /api/student-classes/:id — Update student class
  // =========================================================================

  async updateStudentClass(coachId: string, classId: string, input: UpdateStudentClassInput) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');
    if (!input.name || input.name.length < 2 || input.name.length > 30) {
      throw new AppError(
        400,
        'COACHING_INVALID_CLASS_NAME',
        '班级名称为空或长度不在 2-30 字符范围内',
      );
    }
    const updated = await this.repository.updateStudentClass(classId, { name: input.name });
    logger.info({ classId, coachId: coachId.slice(0, 8) }, '学员班名称修改');
    return {
      id: updated.id,
      coachId: updated.coachId,
      name: updated.name,
      updatedAt: updated.updatedAt,
    };
  }

  // =========================================================================
  // GB: DELETE /api/student-classes/:id — Delete student class
  // =========================================================================

  async deleteStudentClass(coachId: string, classId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');
    await this.repository.deleteStudentClass(classId);
    logger.info({ classId, coachId: coachId.slice(0, 8) }, '学员班删除');
    return { success: true };
  }

  // =========================================================================
  // GB: POST /api/student-classes/:id/members — Add student to class
  // =========================================================================

  async addStudentToClass(coachId: string, classId: string, input: AddStudentToClassInput) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');

    const student = await this.userService.getUserById(input.studentId);
    if (!student) throw new AppError(404, 'USER_NOT_FOUND', '学员用户不存在');

    const existingMember = await this.repository.findStudentClassMember(classId, input.studentId);
    if (existingMember)
      throw new AppError(409, 'COACHING_STUDENT_ALREADY_IN_CLASS', '学员已在班级中');

    const member = await this.repository.addStudentClassMember({
      studentClassId: classId,
      studentId: input.studentId,
    });

    try {
      const coach = await this.userService.getUserById(coachId);
      const coachNickname = coach?.nickname ?? '教练';
      await this.notificationService.create({
        userId: input.studentId,
        type: 'STUDENT_CLASS_ADDED',
        title: '已加入学员班',
        content: `教练 ${coachNickname} 将你加入了学员班「${studentClass.name}」`,
        targetType: 'student-class',
        targetId: classId,
      });
    } catch (err) {
      logger.error({ error: (err as Error).message, classId }, '学员班添加通知发送失败');
    }

    logger.info(
      { classId, studentId: input.studentId.slice(0, 8), coachId: coachId.slice(0, 8) },
      '学员班添加学员',
    );
    return {
      studentClassId: classId,
      studentId: member.studentId,
      nickname: student.nickname,
      joinedAt: member.joinedAt,
    };
  }

  // =========================================================================
  // GB: DELETE /api/student-classes/:id/members/:studentId — Remove student
  // =========================================================================

  async removeStudentFromClass(coachId: string, classId: string, studentId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');

    const member = await this.repository.findStudentClassMember(classId, studentId);
    if (!member) throw new AppError(404, 'COACHING_STUDENT_NOT_IN_CLASS', '学员不在该班级中');

    await this.repository.removeStudentClassMember(classId, studentId);

    try {
      await this.notificationService.create({
        userId: studentId,
        type: 'STUDENT_CLASS_REMOVED',
        title: '已被移出学员班',
        content: `你已被移出学员班「${studentClass.name}」`,
        targetType: 'student-class',
        targetId: classId,
      });
    } catch (err) {
      logger.error({ error: (err as Error).message, classId }, '学员班移除通知发送失败');
    }

    logger.info(
      { classId, studentId: studentId.slice(0, 8), coachId: coachId.slice(0, 8) },
      '学员班移除学员',
    );
    return { success: true };
  }

  // =========================================================================
  // GB: POST /api/student-classes/:id/lessons — Create class lesson
  // =========================================================================

  async createClassLesson(coachId: string, classId: string, input: CreateClassLessonInput) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');

    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    if (startTime <= new Date())
      throw new AppError(400, 'COACHING_INVALID_TIME', '开始时间必须晚于当前时间');
    if (endTime <= startTime)
      throw new AppError(400, 'COACHING_INVALID_TIME', '结束时间必须晚于开始时间');
    if (input.trainingContent !== undefined && input.trainingContent.length > 2000) {
      throw new AppError(400, 'COACHING_INVALID_TRAINING_CONTENT', '训练内容超过 2000 字符');
    }

    let venue = null;
    if (input.venueId) {
      venue = await this.venueService.getVenueById(input.venueId);
      if (!venue) throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
    }

    const lesson = await this.repository.createClassLesson({
      studentClassId: classId,
      coachId,
      venueId: input.venueId,
      startTime,
      endTime,
      trainingContent: input.trainingContent,
    });

    try {
      const memberIds = await this.repository.getStudentClassMemberIds(classId);
      if (memberIds.length > 0) {
        const notifications = memberIds.map((mid: string) => ({
          userId: mid,
          type: 'CLASS_LESSON_CREATED',
          title: '新课程安排',
          content: `学员班「${studentClass.name}」有新课程安排`,
          targetType: 'class-lesson',
          targetId: lesson.id,
        }));
        await this.notificationService.createBatch(notifications);
      }
    } catch (err) {
      logger.error(
        { error: (err as Error).message, classId, lessonId: lesson.id },
        '学员班课程创建通知发送失败',
      );
    }

    logger.info({ classId, lessonId: lesson.id, coachId: coachId.slice(0, 8) }, '学员班课程创建');
    return {
      id: lesson.id,
      studentClassId: lesson.studentClassId,
      coachId: lesson.coachId,
      venue: venue ? { id: venue.id, name: venue.name, address: venue.address } : null,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      trainingContent: lesson.trainingContent,
      status: lesson.status,
      createdAt: lesson.createdAt,
    };
  }

  // =========================================================================
  // GB: GET /api/student-classes/:id/lessons — List class lessons
  // =========================================================================

  async getClassLessons(coachId: string, classId: string, options?: ClassLessonListQuery) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');

    const lessons = await this.repository.findClassLessonsByClassId(classId, {
      page: options?.page,
      pageSize: options?.pageSize,
      status: options?.status,
    });
    const items = Array.isArray(lessons) ? lessons : lessons.items || [];
    return {
      items: items.map(
        (l: {
          id: string;
          studentClassId: string;
          coachId: string;
          venueId: string | null;
          startTime: Date;
          endTime: Date;
          trainingContent: string | null;
          status: string;
          createdAt: Date;
        }) => ({
          id: l.id,
          studentClassId: l.studentClassId,
          coachId: l.coachId,
          venueId: l.venueId,
          startTime: l.startTime,
          endTime: l.endTime,
          trainingContent: l.trainingContent,
          status: l.status,
          createdAt: l.createdAt,
        }),
      ),
    };
  }

  // =========================================================================
  // GB: GET /api/student-classes/:id/lessons/:lessonId — Class lesson detail
  // =========================================================================

  async getClassLessonDetail(coachId: string, classId: string, lessonId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');

    const lesson = await this.repository.findClassLessonById(lessonId);
    if (!lesson || lesson.studentClassId !== classId)
      throw new AppError(404, 'COACHING_CLASS_LESSON_NOT_FOUND', '课程不存在或不属于该学员班');

    let venue = null;
    if (lesson.venueId) {
      venue = await this.venueService.getVenueById(lesson.venueId);
    }

    return {
      id: lesson.id,
      studentClassId: lesson.studentClassId,
      coachId: lesson.coachId,
      venue: venue ? { id: venue.id, name: venue.name, address: venue.address } : null,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      trainingContent: lesson.trainingContent,
      status: lesson.status,
      createdAt: lesson.createdAt,
    };
  }

  // =========================================================================
  // GB: PUT /api/student-classes/:id/lessons/:lessonId — Update class lesson
  // =========================================================================

  async updateClassLesson(
    coachId: string,
    classId: string,
    lessonId: string,
    input: UpdateClassLessonInput,
  ) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');

    const lesson = await this.repository.findClassLessonById(lessonId);
    if (!lesson || lesson.studentClassId !== classId)
      throw new AppError(404, 'COACHING_CLASS_LESSON_NOT_FOUND', '课程不存在或不属于该学员班');
    if (lesson.status !== 'scheduled')
      throw new AppError(409, 'COACHING_LESSON_NOT_EDITABLE', '课程状态不为 scheduled，不可编辑');

    const newStartTime = input.startTime ? new Date(input.startTime) : lesson.startTime;
    const newEndTime = input.endTime ? new Date(input.endTime) : lesson.endTime;
    if (input.startTime !== undefined && newStartTime <= new Date())
      throw new AppError(400, 'COACHING_INVALID_TIME', '开始时间必须晚于当前时间');
    if (input.endTime !== undefined && newEndTime <= newStartTime)
      throw new AppError(400, 'COACHING_INVALID_TIME', '结束时间必须晚于开始时间');
    if (input.venueId !== undefined) {
      const venue = await this.venueService.getVenueById(input.venueId);
      if (!venue) throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
    }

    const updateData: Record<string, unknown> = {};
    if (input.startTime !== undefined) updateData.startTime = newStartTime;
    if (input.endTime !== undefined) updateData.endTime = newEndTime;
    if (input.venueId !== undefined) updateData.venueId = input.venueId;

    const updated = await this.repository.updateClassLesson(lessonId, updateData);

    try {
      const memberIds = await this.repository.getStudentClassMemberIds(classId);
      if (memberIds.length > 0) {
        const notifications = memberIds.map((mid: string) => ({
          userId: mid,
          type: 'CLASS_LESSON_UPDATED',
          title: '课程已更新',
          content: `你的学员班「${studentClass.name}」课程信息已更新`,
          targetType: 'class-lesson',
          targetId: lessonId,
        }));
        await this.notificationService.createBatch(notifications);
      }
    } catch (err) {
      logger.error(
        { error: (err as Error).message, classId, lessonId },
        '学员班课程更新通知发送失败',
      );
    }

    logger.info({ classId, lessonId, coachId: coachId.slice(0, 8) }, '学员班课程修改');
    return {
      id: updated.id,
      studentClassId: updated.studentClassId,
      coachId: updated.coachId,
      venueId: updated.venueId,
      startTime: updated.startTime,
      endTime: updated.endTime,
      trainingContent: updated.trainingContent,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }

  // =========================================================================
  // GB: POST /api/student-classes/:id/lessons/:lessonId/cancel
  // =========================================================================

  async cancelClassLesson(coachId: string, classId: string, lessonId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');

    const lesson = await this.repository.findClassLessonById(lessonId);
    if (!lesson || lesson.studentClassId !== classId)
      throw new AppError(404, 'COACHING_CLASS_LESSON_NOT_FOUND', '课程不存在或不属于该学员班');
    if (lesson.status === 'cancelled') return { id: lesson.id, status: 'cancelled' };
    if (lesson.status !== 'scheduled')
      throw new AppError(
        409,
        'COACHING_LESSON_NOT_CANCELLABLE',
        '课程状态不为 scheduled，不可取消',
      );

    await this.repository.updateClassLesson(lessonId, { status: 'cancelled' });

    try {
      const memberIds = await this.repository.getStudentClassMemberIds(classId);
      if (memberIds.length > 0) {
        const notifications = memberIds.map((mid: string) => ({
          userId: mid,
          type: 'CLASS_LESSON_CANCELLED',
          title: '课程已取消',
          content: `学员班「${studentClass.name}」的课程已取消`,
          targetType: 'class-lesson',
          targetId: lessonId,
        }));
        await this.notificationService.createBatch(notifications);
      }
    } catch (err) {
      logger.error(
        { error: (err as Error).message, classId, lessonId },
        '学员班课程取消通知发送失败',
      );
    }

    logger.info({ classId, lessonId, coachId: coachId.slice(0, 8) }, '学员班课程取消');
    return { id: lesson.id, status: 'cancelled' };
  }

  // =========================================================================
  // GB: PUT /api/student-classes/:id/lessons/:lessonId/training-content
  // =========================================================================

  async updateClassLessonTrainingContent(
    coachId: string,
    classId: string,
    lessonId: string,
    input: { trainingContent: string },
  ) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');

    const lesson = await this.repository.findClassLessonById(lessonId);
    if (!lesson || lesson.studentClassId !== classId)
      throw new AppError(404, 'COACHING_CLASS_LESSON_NOT_FOUND', '课程不存在或不属于该学员班');
    if (lesson.status === 'cancelled')
      throw new AppError(409, 'COACHING_LESSON_CANCELLED', '课程已取消，不可操作');
    if (input.trainingContent.length > 2000)
      throw new AppError(400, 'COACHING_INVALID_TRAINING_CONTENT', '训练内容超过 2000 字符');

    const updated = await this.repository.updateClassLesson(lessonId, {
      trainingContent: input.trainingContent,
    });
    return {
      id: updated.id,
      trainingContent: updated.trainingContent,
      updatedAt: updated.updatedAt,
    };
  }

  // =========================================================================
  // GB: Lesson notes, student notes, student tags
  // =========================================================================

  async addClassLessonNote(
    coachId: string,
    classId: string,
    lessonId: string,
    input: CreateLessonNoteInput,
  ) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');
    const lesson = await this.repository.findClassLessonById(lessonId);
    if (!lesson || lesson.studentClassId !== classId)
      throw new AppError(404, 'COACHING_CLASS_LESSON_NOT_FOUND', '课程不存在或不属于该学员班');
    if (lesson.status === 'cancelled')
      throw new AppError(409, 'COACHING_LESSON_CANCELLED', '课程已取消，不可操作');
    if (!input.content || input.content.length === 0 || input.content.length > 500)
      throw new AppError(400, 'COACHING_INVALID_NOTE_CONTENT', '笔记内容为空或超过 500 字符');

    const note = await this.repository.createLessonNote({
      classLessonId: lessonId,
      coachId,
      content: input.content,
    });
    return {
      id: note.id,
      classLessonId: note.classLessonId,
      coachId: note.coachId,
      content: note.content,
      createdAt: note.createdAt,
    };
  }

  async getClassLessonNotes(coachId: string, classId: string, lessonId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');
    const lesson = await this.repository.findClassLessonById(lessonId);
    if (!lesson || lesson.studentClassId !== classId)
      throw new AppError(404, 'COACHING_CLASS_LESSON_NOT_FOUND', '课程不存在或不属于该学员班');
    const notes = await this.repository.findLessonNotesByLessonId(lessonId);
    return {
      items: notes.map((n: { id: string; content: string; createdAt: Date }) => ({
        id: n.id,
        content: n.content,
        createdAt: n.createdAt,
      })),
    };
  }

  async addStudentNote(
    coachId: string,
    classId: string,
    studentId: string,
    input: CreateStudentNoteInput,
  ) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');
    const member = await this.repository.findStudentClassMember(classId, studentId);
    if (!member) throw new AppError(404, 'COACHING_STUDENT_NOT_IN_CLASS', '学员不在该班级中');
    if (!input.content || input.content.length === 0 || input.content.length > 500)
      throw new AppError(400, 'COACHING_INVALID_NOTE_CONTENT', '笔记内容为空或超过 500 字符');

    const note = await this.repository.createStudentNote({
      coachId,
      studentId,
      studentClassId: classId,
      content: input.content,
    });
    return {
      id: note.id,
      coachId: note.coachId,
      studentId: note.studentId,
      studentClassId: note.studentClassId,
      content: note.content,
      createdAt: note.createdAt,
    };
  }

  async getStudentNotes(coachId: string, classId: string, studentId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');
    const member = await this.repository.findStudentClassMember(classId, studentId);
    if (!member) throw new AppError(404, 'COACHING_STUDENT_NOT_IN_CLASS', '学员不在该班级中');
    const notes = await this.repository.findStudentNotes({
      coachId,
      studentId,
      studentClassId: classId,
    });
    return {
      items: notes.map((n: { id: string; content: string; createdAt: Date }) => ({
        id: n.id,
        content: n.content,
        createdAt: n.createdAt,
      })),
    };
  }

  async setStudentTags(
    coachId: string,
    classId: string,
    studentId: string,
    input: SetStudentTagsInput,
  ) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');
    const member = await this.repository.findStudentClassMember(classId, studentId);
    if (!member) throw new AppError(404, 'COACHING_STUDENT_NOT_IN_CLASS', '学员不在该班级中');
    if (input.tags.length > 10)
      throw new AppError(
        400,
        'COACHING_INVALID_TAGS',
        '标签超过 10 个，或单个标签为空或超过 20 字符',
      );
    for (const tag of input.tags) {
      if (!tag || tag.length === 0 || tag.length > 20)
        throw new AppError(
          400,
          'COACHING_INVALID_TAGS',
          '标签超过 10 个，或单个标签为空或超过 20 字符',
        );
    }
    await this.repository.setStudentTags(coachId, studentId, classId, 'studentClass', input.tags);
    return { tags: input.tags };
  }

  async getStudentTags(coachId: string, classId: string, studentId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');
    const member = await this.repository.findStudentClassMember(classId, studentId);
    if (!member) throw new AppError(404, 'COACHING_STUDENT_NOT_IN_CLASS', '学员不在该班级中');
    const tags = await this.repository.findStudentTags({
      coachId,
      studentId,
      studentClassId: classId,
    });
    return { tags: tags.map((t: { tag: string }) => t.tag) };
  }

  async getClassLessonParticipantIds(lessonId: string): Promise<string[]> {
    return this.repository.getClassLessonParticipantIds(lessonId);
  }

  async getClassLessonByIdForCrossModule(lessonId: string) {
    const lesson = await this.repository.findClassLessonById(lessonId);
    if (!lesson) return null;
    return {
      id: lesson.id,
      studentClassId: lesson.studentClassId,
      coachId: lesson.coachId,
      venueId: lesson.venueId,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      status: lesson.status,
    };
  }

  // =========================================================================
  // GC: POST /api/private-students — Add private student
  // =========================================================================

  async addPrivateStudent(coachId: string, input: AddPrivateStudentInput) {
    const { studentId } = input;

    // Verify student exists
    const student = await this.userService.getUserById(studentId);
    if (!student) {
      throw new AppError(404, 'USER_NOT_FOUND', '学员不存在');
    }

    // Check if already a private student
    const existing = await this.repository.findPrivateStudentByCoachAndStudent(coachId, studentId);
    if (existing) {
      if (existing.isActive) {
        throw new AppError(409, 'COACHING_STUDENT_ALREADY_PRIVATE', '该学员已是固定私教学员');
      }
      // Reactivate previously removed student
      const reactivated = await this.repository.reactivatePrivateStudent(existing.id);

      // Notify student (non-blocking)
      try {
        await this.notificationService.create({
          userId: studentId,
          type: 'PRIVATE_STUDENT_ADDED',
          title: '教练已添加你为固定私教学员',
          content: '教练已重新添加你为固定私教学员',
          targetType: 'private-student',
          targetId: reactivated.id,
        });
      } catch (err) {
        logger.error(
          { error: (err as Error).message, privateStudentId: reactivated.id },
          '固定私教学员添加通知发送失败',
        );
      }

      return reactivated;
    }

    // Create new private student record
    const created = await this.repository.createPrivateStudent({ coachId, studentId });

    // Notify student (non-blocking)
    try {
      await this.notificationService.create({
        userId: studentId,
        type: 'PRIVATE_STUDENT_ADDED',
        title: '教练已添加你为固定私教学员',
        content: '教练已添加你为固定私教学员',
        targetType: 'private-student',
        targetId: created.id,
      });
    } catch (err) {
      logger.error(
        { error: (err as Error).message, privateStudentId: created.id },
        '固定私教学员添加通知发送失败',
      );
    }

    logger.info(
      { coachId: coachId.substring(0, 8), studentId: studentId.substring(0, 8) },
      '添加固定私教学员',
    );

    return created;
  }

  // =========================================================================
  // GC: GET /api/private-students — List private students
  // =========================================================================

  async getPrivateStudents(coachId: string, includeInactive?: boolean) {
    const students = await this.repository.findPrivateStudentsByCoach(coachId, {
      includeInactive: includeInactive ?? false,
    });

    // Batch fetch user info
    const studentIds = students.map((s: { studentId: string }) => s.studentId);
    const uniqueStudentIds = [...new Set(studentIds)];
    const users =
      uniqueStudentIds.length > 0 ? await this.userService.getUsersByIds(uniqueStudentIds) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const items = students.map(
      (s: {
        id: string;
        coachId: string;
        studentId: string;
        isActive: boolean;
        joinedAt: Date;
        lessons?: Array<unknown>;
      }) => {
        const user = userMap.get(s.studentId);
        return {
          id: s.id,
          coachId: s.coachId,
          studentId: s.studentId,
          nickname: user?.nickname ?? '',
          avatarUrl: user?.avatarUrl ?? null,
          isActive: s.isActive,
          lessonCount: s.lessons?.length ?? 0,
          joinedAt: s.joinedAt,
        };
      },
    );

    return { items };
  }

  // =========================================================================
  // GC: GET /api/private-students/:id — Private student detail
  // =========================================================================

  async getPrivateStudentDetail(privateStudentId: string, coachId: string) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    const user = await this.userService.getUserById(ps.studentId);

    return {
      id: ps.id,
      coachId: ps.coachId,
      studentId: ps.studentId,
      nickname: user?.nickname ?? '',
      avatarUrl: user?.avatarUrl ?? null,
      isActive: ps.isActive,
      lessonCount: ps.lessons?.length ?? 0,
      joinedAt: ps.joinedAt,
    };
  }

  // =========================================================================
  // GC: DELETE /api/private-students/:id — Remove private student (soft delete)
  // =========================================================================

  async removePrivateStudent(privateStudentId: string, coachId: string) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }
    if (!ps.isActive) {
      throw new AppError(409, 'COACHING_STUDENT_ALREADY_INACTIVE', '该学员已被移除');
    }

    const deactivated = await this.repository.deactivatePrivateStudent(privateStudentId);

    // Notify student (non-blocking)
    try {
      await this.notificationService.create({
        userId: ps.studentId,
        type: 'PRIVATE_STUDENT_REMOVED',
        title: '教练已将你移出固定私教学员',
        content: '教练已将你移出固定私教学员',
        targetType: 'private-student',
        targetId: privateStudentId,
      });
    } catch (err) {
      logger.error(
        { error: (err as Error).message, privateStudentId },
        '固定私教学员移除通知发送失败',
      );
    }

    logger.info(
      {
        coachId: coachId.substring(0, 8),
        privateStudentId: privateStudentId.substring(0, 8),
      },
      '移除固定私教学员',
    );

    return deactivated;
  }

  // =========================================================================
  // GC: POST /api/private-students/:id/lessons — Create private lesson v2
  // =========================================================================

  async createPrivateLessonV2(
    privateStudentId: string,
    coachId: string,
    input: CreatePrivateLessonV2Input,
  ) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }
    if (!ps.isActive) {
      throw new AppError(409, 'COACHING_STUDENT_INACTIVE', '该学员已被移除，无法创建新课程');
    }

    // Validate times
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    if (startTime <= new Date()) {
      throw new AppError(400, 'COACHING_INVALID_TIME', '开始时间必须晚于当前时间');
    }
    if (endTime <= startTime) {
      throw new AppError(400, 'COACHING_INVALID_TIME', '结束时间必须晚于开始时间');
    }

    // Validate training content
    if (input.trainingContent !== undefined && input.trainingContent.length > 2000) {
      throw new AppError(400, 'COACHING_INVALID_TRAINING_CONTENT', '训练内容超过 2000 字符');
    }

    // Validate venue if provided
    if (input.venueId) {
      const venue = await this.venueService.getVenueById(input.venueId);
      if (!venue) {
        throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
      }
    }

    const lesson = await this.repository.createPrivateLessonV2({
      privateStudentId,
      coachId,
      studentId: ps.studentId,
      venueId: input.venueId,
      startTime,
      endTime,
      trainingContent: input.trainingContent,
    });

    // Notify student (non-blocking)
    try {
      await this.notificationService.create({
        userId: ps.studentId,
        type: 'PRIVATE_LESSON_V2_CREATED',
        title: '新私教课程',
        content: '教练为你安排了新的私教课程',
        targetType: 'private-lesson-v2',
        targetId: lesson.id,
      });
    } catch (err) {
      logger.error(
        { error: (err as Error).message, lessonId: lesson.id },
        '固定私教课程创建通知发送失败',
      );
    }

    logger.info(
      {
        coachId: coachId.substring(0, 8),
        privateStudentId: privateStudentId.substring(0, 8),
      },
      '创建固定私教课程',
    );

    return lesson;
  }

  // =========================================================================
  // GC: GET /api/private-students/:id/lessons — List private lessons v2
  // =========================================================================

  async getPrivateLessonsV2(
    privateStudentId: string,
    coachId: string,
    options?: { page?: number; pageSize?: number; status?: string },
  ) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    const items = await this.repository.findPrivateLessonsV2ByStudent(privateStudentId, options);

    return { items };
  }

  // =========================================================================
  // GC: GET /api/private-students/:id/lessons/:lessonId — Private lesson v2 detail
  // =========================================================================

  async getPrivateLessonV2Detail(privateStudentId: string, lessonId: string, coachId: string) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    const lesson = await this.repository.findPrivateLessonV2ById(lessonId);
    if (!lesson || lesson.privateStudentId !== privateStudentId) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_V2_NOT_FOUND', '固定私教课程不存在');
    }

    return lesson;
  }

  // =========================================================================
  // GC: PUT /api/private-students/:id/lessons/:lessonId — Update private lesson v2
  // =========================================================================

  async updatePrivateLessonV2(
    privateStudentId: string,
    lessonId: string,
    coachId: string,
    input: UpdatePrivateLessonV2Input,
  ) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    const lesson = await this.repository.findPrivateLessonV2ById(lessonId);
    if (!lesson || lesson.privateStudentId !== privateStudentId) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_V2_NOT_FOUND', '固定私教课程不存在');
    }

    if (lesson.status !== 'scheduled') {
      throw new AppError(409, 'COACHING_LESSON_NOT_EDITABLE', '课程状态不允许编辑');
    }

    // Validate times
    const newStartTime = input.startTime ? new Date(input.startTime) : lesson.startTime;
    const newEndTime = input.endTime ? new Date(input.endTime) : lesson.endTime;

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

    // Validate training content
    if (input.trainingContent !== undefined && input.trainingContent.length > 2000) {
      throw new AppError(400, 'COACHING_INVALID_TRAINING_CONTENT', '训练内容超过 2000 字符');
    }

    // Validate venue if provided
    if (input.venueId !== undefined) {
      const venue = await this.venueService.getVenueById(input.venueId);
      if (!venue) {
        throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
      }
    }

    // Build update data
    const updateData: {
      venueId?: string;
      startTime?: Date;
      endTime?: Date;
      trainingContent?: string;
    } = {};
    if (input.venueId !== undefined) updateData.venueId = input.venueId;
    if (input.startTime !== undefined) updateData.startTime = newStartTime;
    if (input.endTime !== undefined) updateData.endTime = newEndTime;
    if (input.trainingContent !== undefined) updateData.trainingContent = input.trainingContent;

    const updated = await this.repository.updatePrivateLessonV2(lessonId, updateData);

    // Notify student (non-blocking)
    try {
      await this.notificationService.create({
        userId: ps.studentId,
        type: 'PRIVATE_LESSON_V2_UPDATED',
        title: '私教课程已更新',
        content: '教练更新了你的私教课程信息',
        targetType: 'private-lesson-v2',
        targetId: lessonId,
      });
    } catch (err) {
      logger.error({ error: (err as Error).message, lessonId }, '固定私教课程更新通知发送失败');
    }

    return updated;
  }

  // =========================================================================
  // GC: POST /api/private-students/:id/lessons/:lessonId/cancel
  // =========================================================================

  async cancelPrivateLessonV2(privateStudentId: string, lessonId: string, coachId: string) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    const lesson = await this.repository.findPrivateLessonV2ById(lessonId);
    if (!lesson || lesson.privateStudentId !== privateStudentId) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_V2_NOT_FOUND', '固定私教课程不存在');
    }

    // Idempotent: already cancelled
    if (lesson.status === 'cancelled') {
      return { id: lesson.id, status: 'cancelled' };
    }

    if (lesson.status !== 'scheduled') {
      throw new AppError(409, 'COACHING_LESSON_NOT_CANCELLABLE', '课程状态不允许取消');
    }

    const cancelled = await this.repository.cancelPrivateLessonV2(lessonId);

    // Notify student (non-blocking)
    try {
      await this.notificationService.create({
        userId: ps.studentId,
        type: 'PRIVATE_LESSON_V2_CANCELLED',
        title: '私教课程已取消',
        content: '教练取消了你的私教课程',
        targetType: 'private-lesson-v2',
        targetId: lessonId,
      });
    } catch (err) {
      logger.error({ error: (err as Error).message, lessonId }, '固定私教课程取消通知发送失败');
    }

    return cancelled;
  }

  // =========================================================================
  // GC: PUT /api/private-students/:id/lessons/:lessonId/training-content
  // =========================================================================

  async updatePrivateLessonV2TrainingContent(
    privateStudentId: string,
    lessonId: string,
    coachId: string,
    input: { trainingContent: string },
  ) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    const lesson = await this.repository.findPrivateLessonV2ById(lessonId);
    if (!lesson || lesson.privateStudentId !== privateStudentId) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_V2_NOT_FOUND', '固定私教课程不存在');
    }

    if (lesson.status === 'cancelled') {
      throw new AppError(409, 'COACHING_LESSON_CANCELLED', '已取消的课程不可操作');
    }

    // Validate training content
    if (input.trainingContent.length > 2000) {
      throw new AppError(400, 'COACHING_INVALID_TRAINING_CONTENT', '训练内容超过 2000 字符');
    }

    const updated = await this.repository.updatePrivateLessonV2TrainingContent(
      lessonId,
      input.trainingContent,
    );

    return updated;
  }

  // =========================================================================
  // GC: POST /api/private-students/:id/lessons/:lessonId/notes — Add lesson note
  // =========================================================================

  async addPrivateLessonNote(
    privateStudentId: string,
    lessonId: string,
    coachId: string,
    input: CreateLessonNoteInput,
  ) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    const lesson = await this.repository.findPrivateLessonV2ById(lessonId);
    if (!lesson || lesson.privateStudentId !== privateStudentId) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_V2_NOT_FOUND', '固定私教课程不存在');
    }

    if (lesson.status === 'cancelled') {
      throw new AppError(409, 'COACHING_LESSON_CANCELLED', '已取消的课程不可添加笔记');
    }

    // Validate content
    if (!input.content || input.content.length === 0 || input.content.length > 500) {
      throw new AppError(400, 'COACHING_INVALID_NOTE_CONTENT', '笔记内容为空或超过 500 字符');
    }

    const note = await this.repository.createLessonNote({
      privateLessonId: lessonId,
      coachId,
      content: input.content,
    });

    return note;
  }

  // =========================================================================
  // GC: GET /api/private-students/:id/lessons/:lessonId/notes — Get lesson notes
  // =========================================================================

  async getPrivateLessonNotes(privateStudentId: string, lessonId: string, coachId: string) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    const lesson = await this.repository.findPrivateLessonV2ById(lessonId);
    if (!lesson || lesson.privateStudentId !== privateStudentId) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_V2_NOT_FOUND', '固定私教课程不存在');
    }

    const notes = await this.repository.findLessonNotes({ privateLessonId: lessonId });

    return { items: notes };
  }

  // =========================================================================
  // GC: POST /api/private-students/:id/notes — Add student note
  // =========================================================================

  async addPrivateStudentNote(
    privateStudentId: string,
    coachId: string,
    input: CreateStudentNoteInput,
  ) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    // Validate content
    if (!input.content || input.content.length === 0 || input.content.length > 500) {
      throw new AppError(400, 'COACHING_INVALID_NOTE_CONTENT', '笔记内容为空或超过 500 字符');
    }

    const note = await this.repository.createStudentNote({
      coachId,
      studentId: ps.studentId,
      privateStudentId,
      content: input.content,
    });

    return note;
  }

  // =========================================================================
  // GC: GET /api/private-students/:id/notes — Get student notes
  // =========================================================================

  async getPrivateStudentNotes(privateStudentId: string, coachId: string) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    const notes = await this.repository.findStudentNotes({
      coachId,
      studentId: ps.studentId,
      privateStudentId,
    });

    return { items: notes };
  }

  // =========================================================================
  // GC: PUT /api/private-students/:id/tags — Set student tags
  // =========================================================================

  async setPrivateStudentTags(
    privateStudentId: string,
    coachId: string,
    input: SetStudentTagsInput,
  ) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    // Validate tags
    if (input.tags.length > 10) {
      throw new AppError(400, 'COACHING_INVALID_TAGS', '标签数量不能超过 10 个');
    }
    for (const tag of input.tags) {
      if (!tag || tag.length === 0 || tag.length > 20) {
        throw new AppError(400, 'COACHING_INVALID_TAGS', '单个标签为空或超过 20 字符');
      }
    }

    await this.repository.setStudentTags(
      coachId,
      ps.studentId,
      privateStudentId,
      'privateStudent',
      input.tags,
    );

    // Read back the tags
    const tagRecords = await this.repository.findStudentTags({
      coachId,
      studentId: ps.studentId,
      privateStudentId,
    });

    return { tags: tagRecords.map((t: { tag: string }) => t.tag) };
  }

  // =========================================================================
  // GC: GET /api/private-students/:id/tags — Get student tags
  // =========================================================================

  async getPrivateStudentTags(privateStudentId: string, coachId: string) {
    const ps = await this.repository.findPrivateStudentById(privateStudentId);
    if (!ps) {
      throw new AppError(404, 'COACHING_PRIVATE_STUDENT_NOT_FOUND', '固定私教学员记录不存在');
    }
    if (ps.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教学员的教练，无权操作');
    }

    const tagRecords = await this.repository.findStudentTags({
      coachId,
      studentId: ps.studentId,
      privateStudentId,
    });

    return { tags: tagRecords.map((t: { tag: string }) => t.tag) };
  }

  // =========================================================================
  // GC: Cross-module — getPrivateLessonV2ById (for match-record)
  // =========================================================================

  async getPrivateLessonV2ById(lessonId: string) {
    const lesson = await this.repository.findPrivateLessonV2ById(lessonId);
    if (!lesson) return null;

    return {
      id: lesson.id,
      privateStudentId: lesson.privateStudentId,
      coachId: lesson.coachId,
      studentId: lesson.studentId,
      venueId: lesson.venueId,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      trainingContent: lesson.trainingContent,
      status: lesson.status,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }
}
