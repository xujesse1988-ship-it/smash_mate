import { AppError } from '../../infra/error-handler.js';
import { createModuleLogger } from '../../infra/logger.js';
import { registerTask } from '../../infra/scheduler.js';
import type { CoachingRepository } from './repository.js';
import type {
  UpdateCoachProfileInput,
  CreateGroupClassInput,
  UpdateGroupClassInput,
  CreateAvailabilityInput,
  ScheduleLessonForStudentInput,
  UpdatePrivateLessonInput,
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
  AddCoachStudentInput,
  SearchStudentByPhoneInput,
  SetCoachStudentTagsInput,
  CoachStudentFilters,
  CoachStudentItem,
} from './types.js';

const logger = createModuleLogger('coaching');

const VALID_SPECIALTIES: CoachSpecialty[] = [
  'singles',
  'doubles',
  'footwork',
  'fitness',
  'tactics',
];

/**
 * Shared guard used by all cancel/退课 paths. Once a course is in_progress or
 * completed, cancellation is no longer permitted per design doc §6.
 */
function assertCancellable(status: string, errorCode: string = 'COACHING_ALREADY_STARTED'): void {
  if (status === 'in_progress' || status === 'completed') {
    throw new AppError(409, errorCode, '课程已开始，不可退课/取消');
  }
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.slice(-4);
}

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
      phone?: string;
    }>
  >;
  getUserByPhone?(phone: string): Promise<{
    id: string;
    nickname: string;
    avatarUrl: string | null;
    phone?: string;
  } | null>;
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

    if (specialty && !VALID_SPECIALTIES.includes(specialty)) {
      throw new AppError(400, 'COACHING_INVALID_SPECIALTY', '擅长方向值不在枚举范围内');
    }

    const result = await this.repository.findCoachList({ page, pageSize, specialty });

    const userIds = result.items.map((item: { userId: string }) => item.userId);
    const users = userIds.length > 0 ? await this.userService.getUsersByIds(userIds) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

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
    const user = await this.userService.getUserById(coachId);
    if (!user || !user.isCoach) {
      throw new AppError(404, 'COACHING_NOT_A_COACH', '用户不存在或不是教练角色');
    }

    const profile = await this.repository.findCoachProfile(coachId);

    // Unbooked open slots: studentId=null AND status='scheduled' AND startTime > now
    let rawSlots: Array<{
      id: string;
      startTime: Date;
      endTime: Date;
      venueIds: string[];
      feeDescription: string | null;
    }> = [];
    try {
      rawSlots = await this.repository.findAvailability(coachId);
    } catch {
      rawSlots = [];
    }

    const studentCount = await this.calculateStudentCount(coachId);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rawGroupClasses = await this.repository.findGroupClassesByCoach(coachId, thirtyDaysAgo);

    const gcVenueIds = rawGroupClasses.map((gc) => gc.venueId).filter(Boolean) as string[];
    const slotVenueIds = rawSlots.flatMap((s) => s.venueIds || []);
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
          ? { id: venue.id, name: venue.name, address: venue.address }
          : null,
        maxParticipants: gc.maxParticipants,
        currentParticipants: gc.currentParticipants,
        feeDescription: gc.feeDescription,
        status: gc.status,
      };
    });

    const privateLessonSlots = rawSlots.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      venues: (s.venueIds || [])
        .map((vid) => venueMap.get(vid))
        .filter(Boolean)
        .map((v) => ({ id: v!.id, name: v!.name, address: v!.address })),
      feeDescription: s.feeDescription,
      isBooked: false,
    }));

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
    const user = await this.userService.getUserById(userId);
    if (!user || !user.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
    }

    if (input.bio !== undefined && input.bio.length > 500) {
      throw new AppError(400, 'COACHING_INVALID_BIO', '简介超过 500 字符');
    }

    if (input.specialties !== undefined) {
      for (const s of input.specialties) {
        if (!VALID_SPECIALTIES.includes(s)) {
          throw new AppError(400, 'COACHING_INVALID_SPECIALTY', '擅长方向值不在枚举范围内');
        }
      }
      input = { ...input, specialties: [...new Set(input.specialties)] };
    }

    let profile = await this.repository.findCoachProfile(userId);
    if (!profile) {
      profile = await this.repository.createCoachProfile(userId);
    }

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
    const user = await this.userService.getUserById(userId);
    if (!user || !user.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
    }

    if (!input.title || input.title.length > 50) {
      throw new AppError(400, 'COACHING_INVALID_TITLE', '课程名称为空或超过 50 字符');
    }
    if (!input.venueId) {
      throw new AppError(400, 'COACHING_INVALID_VENUE', '球馆 ID 缺失或格式不合法');
    }

    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    if (startTime <= new Date()) {
      throw new AppError(400, 'COACHING_INVALID_TIME', '开始时间必须晚于当前时间');
    }
    if (endTime <= startTime) {
      throw new AppError(400, 'COACHING_INVALID_TIME', '结束时间必须晚于开始时间');
    }
    if (
      !Number.isInteger(input.maxParticipants) ||
      input.maxParticipants < 2 ||
      input.maxParticipants > 30
    ) {
      throw new AppError(400, 'COACHING_INVALID_PARTICIPANTS', '限定人数必须在 2-30 范围内');
    }
    if (input.feeDescription !== undefined && input.feeDescription.length > 200) {
      throw new AppError(400, 'COACHING_INVALID_FEE_DESCRIPTION', '费用说明超过 200 字符');
    }

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

    const coach = await this.userService.getUserById(groupClass.coachId);
    let venue = null;
    if (groupClass.venueId) {
      venue = await this.venueService.getVenueById(groupClass.venueId);
    }

    const enrollmentUserIds = groupClass.enrollments.map((e: { userId: string }) => e.userId);
    const enrollmentUsers =
      enrollmentUserIds.length > 0 ? await this.userService.getUsersByIds(enrollmentUserIds) : [];
    const userMap = new Map(enrollmentUsers.map((u) => [u.id, u]));

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
        ? { id: coach.id, nickname: coach.nickname, avatarUrl: coach.avatarUrl }
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
  // PUT /api/group-classes/:id
  // =========================================================================

  async updateGroupClass(classId: string, userId: string, input: UpdateGroupClassInput) {
    const groupClass = await this.repository.findGroupClassById(classId);
    if (!groupClass) {
      throw new AppError(404, 'COACHING_GROUP_CLASS_NOT_FOUND', '团课不存在');
    }
    if (groupClass.coachId !== userId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该团课的教练，无权修改');
    }
    if (!['open', 'full'].includes(groupClass.status)) {
      throw new AppError(409, 'COACHING_CLASS_NOT_MODIFIABLE', '团课状态不允许修改');
    }

    if (input.title !== undefined) {
      if (!input.title || input.title.length > 50) {
        throw new AppError(400, 'COACHING_INVALID_TITLE', '课程名称为空或超过 50 字符');
      }
    }

    if (input.venueId !== undefined) {
      if (!input.venueId) {
        throw new AppError(400, 'COACHING_INVALID_VENUE', '球馆 ID 格式不合法');
      }
      const venue = await this.venueService.getVenueById(input.venueId);
      if (!venue) {
        throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
      }
    }

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

    if (input.feeDescription !== undefined && input.feeDescription.length > 200) {
      throw new AppError(400, 'COACHING_INVALID_FEE_DESCRIPTION', '费用说明超过 200 字符');
    }

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.venueId !== undefined) updateData.venueId = input.venueId;
    if (input.startTime !== undefined) updateData.startTime = newStartTime;
    if (input.endTime !== undefined) updateData.endTime = newEndTime;
    if (input.maxParticipants !== undefined) updateData.maxParticipants = input.maxParticipants;
    if (input.feeDescription !== undefined) updateData.feeDescription = input.feeDescription;

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

    let venue = null;
    const venueId = updated.venueId;
    if (venueId) {
      venue = await this.venueService.getVenueById(venueId);
    }

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
  // POST /api/group-classes/:id/cancel
  // =========================================================================

  async cancelGroupClass(classId: string, userId: string) {
    const groupClass = await this.repository.findGroupClassById(classId);
    if (!groupClass) {
      throw new AppError(404, 'COACHING_GROUP_CLASS_NOT_FOUND', '团课不存在');
    }
    if (groupClass.coachId !== userId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该团课的教练，无权取消');
    }
    if (groupClass.status === 'cancelled') {
      return { id: groupClass.id, status: 'cancelled' };
    }
    // Unified cancel gating: no cancel after class started or completed
    assertCancellable(groupClass.status, 'COACHING_CLASS_NOT_CANCELLABLE');
    if (!['open', 'full'].includes(groupClass.status)) {
      throw new AppError(409, 'COACHING_CLASS_NOT_CANCELLABLE', '团课状态不允许取消');
    }

    const updated = await this.repository.updateGroupClass(classId, { status: 'cancelled' });

    logger.info({ groupClassId: classId, coachId: userId.slice(0, 8) }, '团课取消');

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
  // POST /api/group-classes/:id/enroll
  // =========================================================================

  async enrollGroupClass(classId: string, userId: string) {
    const groupClass = await this.repository.findGroupClassById(classId);
    if (!groupClass) {
      throw new AppError(404, 'COACHING_GROUP_CLASS_NOT_FOUND', '团课不存在');
    }
    if (groupClass.status === 'full') {
      throw new AppError(409, 'COACHING_CLASS_FULL', '团课已满员');
    }
    if (!['open'].includes(groupClass.status)) {
      throw new AppError(409, 'COACHING_CLASS_NOT_ENROLLABLE', '团课状态不允许报名');
    }
    if (groupClass.coachId === userId) {
      throw new AppError(403, 'COACHING_CANNOT_ENROLL_OWN_CLASS', '教练不可报名自己发布的团课');
    }
    const alreadyEnrolled = groupClass.enrollments.some(
      (e: { userId: string }) => e.userId === userId,
    );
    if (alreadyEnrolled) {
      throw new AppError(409, 'COACHING_ALREADY_ENROLLED', '学员已报名该团课');
    }

    const result = await this.repository.enrollGroupClass(classId, userId);

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
  // POST /api/group-classes/:id/cancel-enrollment
  // =========================================================================

  async cancelEnrollment(classId: string, userId: string) {
    const groupClass = await this.repository.findGroupClassById(classId);
    if (!groupClass) {
      throw new AppError(404, 'COACHING_GROUP_CLASS_NOT_FOUND', '团课不存在');
    }
    // Unified: cannot cancel enrollment once class has started
    assertCancellable(groupClass.status, 'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT');
    if (!['open', 'full'].includes(groupClass.status)) {
      throw new AppError(
        409,
        'COACHING_CLASS_NOT_CANCELLABLE_ENROLLMENT',
        '团课状态不允许取消报名',
      );
    }

    const isEnrolled = groupClass.enrollments.some((e: { userId: string }) => e.userId === userId);
    if (!isEnrolled) {
      throw new AppError(409, 'COACHING_NOT_ENROLLED', '学员未报名该团课');
    }

    const result = await this.repository.cancelEnrollment(classId, userId);

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
  // POST /api/private-lessons/availability — Create open slots
  // =========================================================================

  async createAvailability(userId: string, input: CreateAvailabilityInput) {
    const user = await this.userService.getUserById(userId);
    if (!user || !user.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
    }

    if (!input.slots || !Array.isArray(input.slots) || input.slots.length === 0) {
      throw new AppError(400, 'COACHING_INVALID_SLOTS', '时间段列表不能为空');
    }

    for (const slot of input.slots) {
      const startTime = new Date(slot.startTime);
      const endTime = new Date(slot.endTime);
      if (startTime <= new Date()) {
        throw new AppError(400, 'COACHING_INVALID_SLOT_TIME', '时间段开始时间必须晚于当前时间');
      }
      if (endTime <= startTime) {
        throw new AppError(400, 'COACHING_INVALID_SLOT_TIME', '时间段结束时间必须晚于开始时间');
      }
      const durationMs = endTime.getTime() - startTime.getTime();
      if (durationMs < 60 * 60 * 1000) {
        throw new AppError(400, 'COACHING_SLOT_TOO_SHORT', '时间段时长不足 1 小时');
      }
      if (slot.feeDescription !== undefined && slot.feeDescription.length > 200) {
        throw new AppError(400, 'COACHING_INVALID_FEE_DESCRIPTION', '费用说明超过 200 字符');
      }
      if (slot.venueIds && slot.venueIds.length > 0) {
        for (const venueId of slot.venueIds) {
          const venue = await this.venueService.getVenueById(venueId);
          if (!venue) {
            throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
          }
        }
      }
    }

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

    const slotsData = input.slots.map((slot) => ({
      coachId: userId,
      startTime: new Date(slot.startTime),
      endTime: new Date(slot.endTime),
      venueIds: slot.venueIds ?? [],
      feeDescription: slot.feeDescription ?? null,
    }));

    const created = await this.repository.createPrivateLessonSlots(slotsData);

    logger.info(
      { coachId: userId.substring(0, 8), slotCount: input.slots.length },
      '教练设置私教空闲时间',
    );

    return { slots: created };
  }

  // =========================================================================
  // GET /api/coaches/:id/availability
  // =========================================================================

  async getCoachAvailability(coachId: string, options?: { startDate?: string; endDate?: string }) {
    const user = await this.userService.getUserById(coachId);
    if (!user || !user.isCoach) {
      throw new AppError(404, 'COACHING_NOT_A_COACH', '用户不存在或不是教练角色');
    }

    const from = options?.startDate ? new Date(options.startDate) : new Date();
    const to = options?.endDate
      ? new Date(options.endDate)
      : (() => {
          const d = new Date(from);
          d.setDate(d.getDate() + 14);
          return d;
        })();

    const rawSlots = await this.repository.findAvailability(coachId, { from, to });

    const allVenueIds = new Set<string>();
    for (const slot of rawSlots) {
      for (const vid of slot.venueIds ?? []) {
        allVenueIds.add(vid);
      }
    }

    const venueMap = new Map<string, { id: string; name: string; address: string }>();
    for (const venueId of allVenueIds) {
      const venue = await this.venueService.getVenueById(venueId);
      if (venue) {
        venueMap.set(venueId, { id: venue.id, name: venue.name, address: venue.address });
      }
    }

    const slots = rawSlots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      venues: (slot.venueIds ?? []).map((vid) => venueMap.get(vid)).filter(Boolean),
      feeDescription: slot.feeDescription,
      isBooked: false,
    }));

    return { slots };
  }

  // =========================================================================
  // POST /api/private-lessons/:id/book — Book open slot (unified)
  // =========================================================================

  async bookLesson(lessonId: string, userId: string, venueId?: string) {
    const lesson = await this.repository.findPrivateLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, 'COACHING_SLOT_NOT_FOUND', '时间段不存在');
    }
    if (lesson.studentId !== null) {
      throw new AppError(409, 'COACHING_SLOT_ALREADY_BOOKED', '时间段已被预约');
    }
    if (lesson.status !== 'scheduled') {
      throw new AppError(409, 'COACHING_SLOT_ALREADY_BOOKED', '时间段已不可预约');
    }
    if (lesson.startTime <= new Date()) {
      throw new AppError(409, 'COACHING_SLOT_EXPIRED', '时间段已过期');
    }
    if (lesson.coachId === userId) {
      throw new AppError(403, 'COACHING_CANNOT_BOOK_OWN_LESSON', '教练不可预约自己的私教课');
    }

    if (lesson.venueIds && lesson.venueIds.length > 0) {
      if (!venueId) {
        throw new AppError(400, 'COACHING_VENUE_REQUIRED', '时间段设置了可选球馆，请选择球馆');
      }
      if (!lesson.venueIds.includes(venueId)) {
        throw new AppError(400, 'COACHING_INVALID_VENUE_CHOICE', '选择的球馆不在可选列表中');
      }
    } else if (venueId) {
      const venue = await this.venueService.getVenueById(venueId);
      if (!venue) {
        throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
      }
    }

    const updated = await this.repository.bookPrivateLesson(lessonId, userId, venueId ?? null);
    if (!updated) {
      // Raced with another booker or scheduler.
      throw new AppError(409, 'COACHING_SLOT_ALREADY_BOOKED', '时间段已被预约');
    }

    try {
      const student = await this.userService.getUserById(userId);
      const studentNickname = student?.nickname ?? '未知用户';
      const startDate = new Date(updated.startTime);
      const dateStr = `${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}`;
      const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      const endDate = new Date(updated.endTime);
      const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      await this.notificationService.create({
        userId: updated.coachId,
        type: 'PRIVATE_LESSON_BOOKED',
        title: '新私教预约',
        content: `${studentNickname} 预约了你的私教课（${dateStr} ${startTimeStr}-${endTimeStr}）`,
        targetType: 'private-lesson',
        targetId: updated.id,
      });
    } catch (err) {
      logger.error(
        { error: (err as Error).message, privateLessonId: updated.id },
        '私教预约通知发送失败',
      );
    }

    logger.info(
      {
        privateLessonId: updated.id,
        studentId: userId.substring(0, 8),
        coachId: updated.coachId.substring(0, 8),
        operation: 'book',
      },
      '学员预约私教课',
    );

    let venue: { id: string; name: string; address: string } | null = null;
    if (updated.venueId) {
      const v = await this.venueService.getVenueById(updated.venueId);
      if (v) venue = { id: v.id, name: v.name, address: v.address };
    }

    return {
      id: updated.id,
      coachId: updated.coachId,
      studentId: updated.studentId,
      venueId: updated.venueId,
      venue,
      startTime: updated.startTime,
      endTime: updated.endTime,
      source: updated.source,
      status: updated.status,
      createdAt: updated.createdAt,
    };
  }

  // =========================================================================
  // POST /api/private-lessons/:id/cancel — Unified cancel
  // =========================================================================

  async cancelPrivateLesson(lessonId: string, userId: string) {
    const lesson = await this.repository.findPrivateLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_NOT_FOUND', '私教课不存在');
    }
    if (lesson.coachId !== userId && lesson.studentId !== userId) {
      throw new AppError(403, 'COACHING_NOT_LESSON_PARTICIPANT', '当前用户不是该私教课的参与者');
    }
    if (lesson.status === 'cancelled') {
      return { id: lesson.id, status: 'cancelled' };
    }
    assertCancellable(lesson.status, 'COACHING_LESSON_NOT_CANCELLABLE');
    if (lesson.status !== 'scheduled') {
      throw new AppError(409, 'COACHING_LESSON_NOT_CANCELLABLE', '私教课状态不允许取消');
    }

    await this.repository.cancelPrivateLesson(lessonId);

    try {
      const startDate = new Date(lesson.startTime);
      const dateStr = `${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}`;
      const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      const endDate = new Date(lesson.endTime);
      const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      if (userId === lesson.studentId) {
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
      } else if (lesson.studentId) {
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
        studentId: lesson.studentId?.substring(0, 8) ?? null,
        coachId: lesson.coachId.substring(0, 8),
        operation: 'cancel',
      },
      '私教课取消',
    );

    return { id: lesson.id, status: 'cancelled' };
  }

  // =========================================================================
  // GET /api/private-lessons/:id — Unified lesson detail
  // =========================================================================

  async getPrivateLessonDetail(lessonId: string, requesterId: string) {
    const lesson = await this.repository.findPrivateLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_NOT_FOUND', '私教课不存在');
    }
    if (lesson.coachId !== requesterId && lesson.studentId !== requesterId) {
      throw new AppError(403, 'COACHING_NOT_LESSON_PARTICIPANT', '当前用户不是该私教课的参与者');
    }
    let venue = null;
    if (lesson.venueId) {
      const v = await this.venueService.getVenueById(lesson.venueId);
      if (v) venue = { id: v.id, name: v.name, address: v.address };
    }
    return {
      id: lesson.id,
      coachId: lesson.coachId,
      studentId: lesson.studentId,
      venueId: lesson.venueId,
      venueIds: lesson.venueIds,
      venue,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      feeDescription: lesson.feeDescription,
      trainingContent: lesson.trainingContent,
      source: lesson.source,
      status: lesson.status,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }

  // =========================================================================
  // PUT /api/private-lessons/:id — Update (coach only)
  // =========================================================================

  async updatePrivateLesson(
    lessonId: string,
    coachId: string,
    input: UpdatePrivateLessonInput,
  ) {
    const lesson = await this.repository.findPrivateLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_NOT_FOUND', '私教课不存在');
    }
    if (lesson.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教课的教练，无权修改');
    }
    if (lesson.status !== 'scheduled') {
      throw new AppError(409, 'COACHING_LESSON_NOT_EDITABLE', '课程状态不允许编辑');
    }

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
    if (input.trainingContent !== undefined && input.trainingContent.length > 2000) {
      throw new AppError(400, 'COACHING_INVALID_TRAINING_CONTENT', '训练内容超过 2000 字符');
    }
    if (input.feeDescription !== undefined && input.feeDescription.length > 200) {
      throw new AppError(400, 'COACHING_INVALID_FEE_DESCRIPTION', '费用说明超过 200 字符');
    }
    if (input.venueId !== undefined) {
      const venue = await this.venueService.getVenueById(input.venueId);
      if (!venue) {
        throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
      }
    }

    const updateData: {
      venueId?: string | null;
      startTime?: Date;
      endTime?: Date;
      feeDescription?: string | null;
      trainingContent?: string | null;
    } = {};
    if (input.venueId !== undefined) updateData.venueId = input.venueId;
    if (input.startTime !== undefined) updateData.startTime = newStartTime;
    if (input.endTime !== undefined) updateData.endTime = newEndTime;
    if (input.feeDescription !== undefined) updateData.feeDescription = input.feeDescription;
    if (input.trainingContent !== undefined) updateData.trainingContent = input.trainingContent;

    const updated = await this.repository.updatePrivateLesson(lessonId, updateData);

    if (lesson.studentId) {
      try {
        await this.notificationService.create({
          userId: lesson.studentId,
          type: 'PRIVATE_LESSON_UPDATED',
          title: '私教课程已更新',
          content: '教练更新了你的私教课程信息',
          targetType: 'private-lesson',
          targetId: lessonId,
        });
      } catch (err) {
        logger.error(
          { error: (err as Error).message, lessonId },
          '私教课程更新通知发送失败',
        );
      }
    }

    return updated;
  }

  async updatePrivateLessonTrainingContent(
    lessonId: string,
    coachId: string,
    content: string,
  ) {
    const lesson = await this.repository.findPrivateLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_NOT_FOUND', '私教课不存在');
    }
    if (lesson.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教课的教练，无权修改');
    }
    if (lesson.status === 'cancelled') {
      throw new AppError(409, 'COACHING_LESSON_CANCELLED', '已取消的课程不可操作');
    }
    if (content.length > 2000) {
      throw new AppError(400, 'COACHING_INVALID_TRAINING_CONTENT', '训练内容超过 2000 字符');
    }
    return this.repository.updatePrivateLessonTrainingContent(lessonId, content);
  }

  // =========================================================================
  // GET /api/users/:id/enrollments
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

    const coachIds = new Set<string>();
    for (const item of result.items) {
      if (item.type === 'group-class' && item.groupClass) coachIds.add(item.groupClass.coachId);
      if (item.type === 'private-lesson' && item.privateLesson)
        coachIds.add(item.privateLesson.coachId);
      if (item.type === 'class-lesson' && item.classLesson)
        coachIds.add(item.classLesson.coachId);
    }

    const coachUsers =
      coachIds.size > 0 ? await this.userService.getUsersByIds([...coachIds]) : [];
    const coachMap = new Map(coachUsers.map((u) => [u.id, u]));

    const enrichedItems = result.items.map((item) => {
      if (item.type === 'group-class' && item.groupClass) {
        const coach = coachMap.get(item.groupClass.coachId);
        return {
          ...item,
          groupClass: { ...item.groupClass, coachNickname: coach?.nickname ?? '' },
        };
      }
      if (item.type === 'private-lesson' && item.privateLesson) {
        const coach = coachMap.get(item.privateLesson.coachId);
        return {
          ...item,
          privateLesson: { ...item.privateLesson, coachNickname: coach?.nickname ?? '' },
        };
      }
      if (item.type === 'class-lesson' && item.classLesson) {
        const coach = coachMap.get(item.classLesson.coachId);
        return {
          ...item,
          classLesson: { ...item.classLesson, coachNickname: coach?.nickname ?? '' },
        };
      }
      return item;
    });

    return {
      items: enrichedItems,
      total: result.total,
      page,
      pageSize,
    };
  }

  // =========================================================================
  // GET /api/coaches/:id/private-lessons
  // =========================================================================

  async getCoachPrivateLessons(coachId: string, query: PrivateLessonListQuery) {
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

    const studentIds = result.items
      .map((item: { studentId: string | null }) => item.studentId)
      .filter((s): s is string => s !== null);
    const uniqueStudentIds = [...new Set(studentIds)];
    const students =
      uniqueStudentIds.length > 0 ? await this.userService.getUsersByIds(uniqueStudentIds) : [];
    const studentMap = new Map(students.map((u) => [u.id, u]));

    const enrichedItems = await Promise.all(
      result.items.map(
        async (item: {
          id: string;
          coachId: string;
          studentId: string | null;
          venueId: string | null;
          startTime: Date;
          endTime: Date;
          status: string;
          createdAt: Date;
        }) => {
          const student = item.studentId ? studentMap.get(item.studentId) : undefined;
          let venue = null;
          if (item.venueId) {
            venue = await this.venueService.getVenueById(item.venueId);
          }
          return {
            id: item.id,
            slot: { startTime: item.startTime, endTime: item.endTime },
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
  // Scheduler: course status auto-transitions + CoachStudent auto-recording
  // =========================================================================

  async processStatusTransitions(): Promise<void> {
    const now = new Date();

    try {
      // Mark expired open slots first (no CoachStudent side-effect).
      const expiredSlots = await this.repository.markSlotsExpired(now);

      // Transition scheduled → in_progress for booked/scheduled private lessons.
      // Populate CoachStudent for each newly-started lesson.
      const newlyInProgress = await this.repository.markPrivateLessonsInProgress(now);
      for (const lesson of newlyInProgress) {
        if (!lesson.studentId) continue;
        try {
          await this.repository.createCoachStudent({
            coachId: lesson.coachId,
            studentId: lesson.studentId,
            source: 'private-lesson',
          });
        } catch (err) {
          logger.error(
            { error: (err as Error).message, lessonId: lesson.id },
            'CoachStudent 入库（private-lesson）失败',
          );
        }
      }

      const plCompleted = await this.repository.markPrivateLessonsCompleted(now);

      // Group classes: when a class starts, record all enrolled students.
      const newlyStartedGroupClasses = await this.repository.updateGroupClassesStarted(now);
      if (newlyStartedGroupClasses.length > 0) {
        try {
          const enrollments = await this.repository.findEnrollmentsByGroupClassIds(
            newlyStartedGroupClasses.map((g) => g.id),
          );
          // Group userIds by coachId so we can batch-insert per coach.
          const coachIdByClass = new Map<string, string>();
          for (const g of newlyStartedGroupClasses) coachIdByClass.set(g.id, g.coachId);
          const perCoachStudents = new Map<string, Set<string>>();
          for (const e of enrollments) {
            const coachId = coachIdByClass.get(e.groupClassId);
            if (!coachId) continue;
            if (!perCoachStudents.has(coachId)) perCoachStudents.set(coachId, new Set());
            perCoachStudents.get(coachId)!.add(e.userId);
          }
          for (const [coachId, studentIdSet] of perCoachStudents) {
            await this.recordCoachStudentsFromCourse(
              coachId,
              [...studentIdSet],
              'group-class',
            );
          }
        } catch (err) {
          logger.error(
            { error: (err as Error).message },
            'CoachStudent 入库（group-class）失败',
          );
        }
      }
      const gcCompleted = await this.repository.updateGroupClassesCompleted(now);

      // Class lessons: when a class-lesson starts, record its class members.
      // Primary write happens via addStudentToClass at membership time;
      // the scheduler does an idempotent sweep here as a safety net
      // (createMany + skipDuplicates preserves original source).
      const startedClassLessons = await this.repository.findScheduledClassLessonsToStart(now);
      const clStarted = await this.repository.updateClassLessonsStarted(now);
      if (startedClassLessons.length > 0) {
        try {
          for (const lesson of startedClassLessons) {
            const memberIds = await this.repository.getStudentClassMemberIds(
              lesson.studentClassId,
            );
            if (memberIds.length > 0) {
              await this.recordCoachStudentsFromCourse(
                lesson.coachId,
                memberIds,
                'class-lesson',
              );
            }
          }
        } catch (err) {
          logger.error(
            { error: (err as Error).message },
            'CoachStudent 入库（class-lesson）失败',
          );
        }
      }
      const clCompleted = await this.repository.updateClassLessonsCompleted(now);

      logger.info(
        {
          module: 'coaching-status',
          expiredSlots,
          plInProgress: newlyInProgress.length,
          plCompleted,
          gcStarted: newlyStartedGroupClasses.length,
          gcCompleted,
          clStarted,
          clCompleted,
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

  /** Daily cleanup: delete expired slots older than 30 days. */
  async cleanupExpiredSlots(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
      const count = await this.repository.deleteExpiredSlots(cutoff);
      if (count > 0) {
        logger.info({ module: 'coaching-cleanup', count }, '清理过期 slot');
      }
    } catch (err) {
      logger.error(
        { module: 'coaching-cleanup', error: (err as Error).message },
        '过期 slot 清理失败',
      );
    }
  }

  registerScheduledTasks(): void {
    registerTask('coaching-status-transition', '* * * * *', async () => {
      await this.processStatusTransitions();
    });
    // Daily at 03:00
    registerTask('coaching-expired-slot-cleanup', '0 3 * * *', async () => {
      await this.cleanupExpiredSlots();
    });
  }

  // =========================================================================
  // Coach Application (GA)
  // =========================================================================

  async submitCoachApplication(userId: string, input: CreateCoachApplicationInput) {
    const { certificateUrls, description } = input;

    if (
      !certificateUrls ||
      !Array.isArray(certificateUrls) ||
      certificateUrls.length === 0 ||
      certificateUrls.length > 5
    ) {
      throw new AppError(400, 'COACHING_INVALID_CERTIFICATES', '证书图片数量必须在 1-5 张之间');
    }

    for (const url of certificateUrls) {
      if (
        !url.startsWith('http://') &&
        !url.startsWith('https://') &&
        !url.startsWith('/api/uploads/')
      ) {
        throw new AppError(400, 'COACHING_INVALID_CERTIFICATE_URL', '证书图片 URL 格式不合法');
      }
    }

    const validExtensions = ['.jpg', '.jpeg', '.png'];
    for (const url of certificateUrls) {
      const lowerUrl = url.toLowerCase();
      if (!validExtensions.some((ext) => lowerUrl.endsWith(ext))) {
        throw new AppError(
          400,
          'COACHING_INVALID_CERTIFICATE_FORMAT',
          '证书图片格式仅支持 JPG/PNG',
        );
      }
    }

    if (description !== undefined && description !== null && description.length > 200) {
      throw new AppError(400, 'COACHING_INVALID_DESCRIPTION', '简要说明不能超过 200 字符');
    }

    const user = await this.userService.getUserById(userId);
    if (user && user.isCoach) {
      throw new AppError(409, 'COACHING_ALREADY_COACH', '用户已是教练，无需重复申请');
    }

    const latestApplication = await this.repository.findLatestApplicationByUser(userId);
    if (latestApplication && latestApplication.status === 'pending') {
      throw new AppError(409, 'COACHING_APPLICATION_PENDING', '已有审核中的申请，请勿重复提交');
    }

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

  async getMyApplicationStatus(userId: string) {
    return this.repository.findLatestApplicationByUser(userId);
  }

  async reviewCoachApplication(
    applicationId: string,
    adminId: string,
    input: ReviewCoachApplicationInput,
  ) {
    const application = await this.repository.findCoachApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, 'COACHING_APPLICATION_NOT_FOUND', '教练申请不存在');
    }
    if (application.status !== 'pending') {
      throw new AppError(409, 'COACHING_APPLICATION_ALREADY_REVIEWED', '该申请已审核过');
    }
    if (input.status !== 'approved' && input.status !== 'rejected') {
      throw new AppError(
        400,
        'COACHING_INVALID_REVIEW_STATUS',
        '审核状态必须为 approved 或 rejected',
      );
    }
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
      const updatedApplication = await this.repository.updateCoachApplication(
        applicationId,
        {
          status: 'approved',
          reviewedBy: adminId,
          reviewedAt: now,
        },
        { setUserIsCoach: { userId: application.userId, isCoach: true } },
      );

      const existingProfile = await this.repository.findCoachProfile(application.userId);
      if (!existingProfile) {
        await this.repository.createCoachProfile(application.userId);
      }

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
      const updatedApplication = await this.repository.updateCoachApplication(applicationId, {
        status: 'rejected',
        rejectReason: input.rejectReason,
        reviewedBy: adminId,
        reviewedAt: now,
      });

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

  async getApplicationList(query: CoachApplicationListQuery) {
    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;

    const result = await this.repository.findCoachApplications({
      status: query.status,
      page,
      pageSize,
    });

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

    return { items, total: result.total, page, pageSize };
  }

  async getApplicationById(applicationId: string) {
    const application = await this.repository.findCoachApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, 'COACHING_APPLICATION_NOT_FOUND', '教练申请不存在');
    }

    const user = await this.userService.getUserById(application.userId);

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
  // Student Class (GB) — unchanged methods kept intact
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

  async deleteStudentClass(coachId: string, classId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');
    await this.repository.deleteStudentClass(classId);
    logger.info({ classId, coachId: coachId.slice(0, 8) }, '学员班删除');
    return { success: true };
  }

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

    // Auto-record to unified CoachStudent library.
    try {
      await this.repository.createCoachStudent({
        coachId,
        studentId: input.studentId,
        source: 'class-lesson',
      });
    } catch (err) {
      logger.error(
        { error: (err as Error).message, studentId: input.studentId.slice(0, 8) },
        'CoachStudent 入库（class-lesson/add-member）失败',
      );
    }

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

    const venueIds = [...new Set(items
      .map((l: { venueId: string | null }) => l.venueId)
      .filter((id): id is string => id !== null))];
    const venues = await Promise.all(
      venueIds.map((id) => this.venueService.getVenueById(id)),
    );
    const venueMap = new Map(
      venues.filter(Boolean).map((v) => [v!.id, { id: v!.id, name: v!.name, address: v!.address }]),
    );

    return {
      items: items.map(
        (l: {
          id: string;
          venueId: string | null;
          startTime: Date;
          endTime: Date;
          trainingContent: string | null;
          status: string;
          createdAt: Date;
        }) => ({
          id: l.id,
          venue: l.venueId ? (venueMap.get(l.venueId) ?? null) : null,
          startTime: l.startTime,
          endTime: l.endTime,
          trainingContent: l.trainingContent,
          status: l.status,
          createdAt: l.createdAt,
        }),
      ),
    };
  }

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

  async cancelClassLesson(coachId: string, classId: string, lessonId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');

    const lesson = await this.repository.findClassLessonById(lessonId);
    if (!lesson || lesson.studentClassId !== classId)
      throw new AppError(404, 'COACHING_CLASS_LESSON_NOT_FOUND', '课程不存在或不属于该学员班');
    if (lesson.status === 'cancelled') return { id: lesson.id, status: 'cancelled' };
    assertCancellable(lesson.status, 'COACHING_LESSON_NOT_CANCELLABLE');
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
  // Class-lesson notes/student-notes/student-tags (scoped to class context)
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
    await this.repository.setStudentTags(coachId, studentId, input.tags);
    return { tags: input.tags };
  }

  async getStudentTags(coachId: string, classId: string, studentId: string) {
    const studentClass = await this.repository.findStudentClassById(classId);
    if (!studentClass) throw new AppError(404, 'COACHING_STUDENT_CLASS_NOT_FOUND', '学员班不存在');
    if (studentClass.coachId !== coachId)
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该学员班的教练');
    const member = await this.repository.findStudentClassMember(classId, studentId);
    if (!member) throw new AppError(404, 'COACHING_STUDENT_NOT_IN_CLASS', '学员不在该班级中');
    const tags = await this.repository.findStudentTags({ coachId, studentId });
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
  // Unified CoachStudent (GC) methods
  // =========================================================================

  /** Manual add; idempotent. Student user must exist. source='manual'. */
  async addCoachStudent(coachId: string, input: AddCoachStudentInput) {
    const coach = await this.userService.getUserById(coachId);
    if (!coach || !coach.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
    }
    const student = await this.userService.getUserById(input.studentId);
    if (!student) {
      throw new AppError(404, 'USER_NOT_FOUND', '学员不存在');
    }

    const created = await this.repository.createCoachStudent({
      coachId,
      studentId: input.studentId,
      source: 'manual',
    });

    logger.info(
      { coachId: coachId.slice(0, 8), studentId: input.studentId.slice(0, 8), source: 'manual' },
      '教练手动添加学员',
    );

    return created;
  }

  /** Look up a student by phone number. Must be registered. */
  async searchStudentByPhone(coachId: string, input: SearchStudentByPhoneInput) {
    const coach = await this.userService.getUserById(coachId);
    if (!coach || !coach.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
    }

    if (!input.phone || input.phone.length < 5) {
      throw new AppError(400, 'COACHING_INVALID_PHONE', '手机号格式不合法');
    }

    // We intentionally require the user service to expose getUserByPhone.
    if (!this.userService.getUserByPhone) {
      throw new AppError(
        500,
        'COACHING_UNSUPPORTED_LOOKUP',
        '当前环境暂不支持按手机号查找学员',
      );
    }
    const user = await this.userService.getUserByPhone(input.phone);
    if (!user) {
      throw new AppError(404, 'COACH_STUDENT_NOT_REGISTERED', '该手机号未注册');
    }
    return {
      userId: user.id,
      nickname: user.nickname,
      phoneLast4: maskPhone(user.phone ?? input.phone),
    };
  }

  /** Called by scheduler / class-membership flows to batch-record students. */
  async recordCoachStudentsFromCourse(
    coachId: string,
    studentIds: string[],
    source: string,
  ): Promise<void> {
    if (studentIds.length === 0) return;
    try {
      await this.repository.recordCoachStudents(coachId, studentIds, source);
    } catch (err) {
      logger.error(
        { error: (err as Error).message, coachId: coachId.slice(0, 8), source },
        'CoachStudent 批量入库失败',
      );
    }
  }

  /**
   * Aggregated "my students" listing. Handles derived tag filtering and
   * includes class membership.
   */
  async getCoachStudents(coachId: string, filters: CoachStudentFilters = {}) {
    const coach = await this.userService.getUserById(coachId);
    if (!coach || !coach.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const { items: rawItems, total } = await this.repository.findCoachStudents(coachId, {
      search: filters.search,
      page,
      pageSize,
    });

    const studentIds = rawItems.map((r) => r.studentId);
    const [classesByStudent, gcStudents, plStudents] = await Promise.all([
      this.repository.findStudentClassesForStudents(coachId, studentIds),
      this.repository.findStudentIdsWhoTookGroupClass(coachId, studentIds),
      this.repository.findStudentIdsWhoTookPrivateLesson(coachId, studentIds),
    ]);

    const customTagsByStudent = new Map<string, string[]>();
    for (const sid of studentIds) {
      const tagRows = await this.repository.findCoachStudentTagsList(coachId, sid);
      customTagsByStudent.set(
        sid,
        tagRows.map((t) => t.tag),
      );
    }

    const buildItem = (r: {
      studentId: string;
      source: string;
      firstMetAt: Date;
      student: { id: string; nickname: string; avatarUrl: string | null; phone: string | null };
    }): CoachStudentItem => {
      const derived: string[] = [];
      if (gcStudents.has(r.studentId)) derived.push('团课学员');
      if (plStudents.has(r.studentId)) derived.push('私教学员');
      const classes = classesByStudent.get(r.studentId) ?? [];
      for (const cls of classes) {
        derived.push(`学员班: ${cls.name}`);
      }
      const custom = customTagsByStudent.get(r.studentId) ?? [];
      const tags = [...derived, ...custom.filter((t) => !derived.includes(t))];
      return {
        studentId: r.studentId,
        nickname: r.student.nickname,
        avatarUrl: r.student.avatarUrl,
        phoneLast4: maskPhone(r.student.phone),
        firstMetAt: r.firstMetAt,
        source: r.source,
        tags,
        studentClasses: classes,
      };
    };

    let items = rawItems.map(buildItem);
    // Derived tag filter applied in-memory (page-local).
    if (filters.tag) {
      items = items.filter((i) => i.tags.includes(filters.tag as string));
    }

    return { items, total, page, pageSize };
  }

  async getCoachStudentDetail(coachId: string, studentId: string) {
    const cs = await this.repository.findCoachStudentDetail(coachId, studentId);
    if (!cs) {
      throw new AppError(404, 'COACHING_COACH_STUDENT_NOT_FOUND', '学员记录不存在');
    }
    const student = await this.userService.getUserById(studentId);
    if (!student) {
      throw new AppError(404, 'USER_NOT_FOUND', '学员不存在');
    }
    const [classesMap, gcSet, plSet, customTags] = await Promise.all([
      this.repository.findStudentClassesForStudents(coachId, [studentId]),
      this.repository.findStudentIdsWhoTookGroupClass(coachId, [studentId]),
      this.repository.findStudentIdsWhoTookPrivateLesson(coachId, [studentId]),
      this.repository.findCoachStudentTagsList(coachId, studentId),
    ]);
    const classes = classesMap.get(studentId) ?? [];

    const derived: string[] = [];
    if (gcSet.has(studentId)) derived.push('团课学员');
    if (plSet.has(studentId)) derived.push('私教学员');
    for (const cls of classes) derived.push(`学员班: ${cls.name}`);

    const customNames = customTags.map((t) => t.tag);
    const tags = [...derived, ...customNames.filter((t) => !derived.includes(t))];

    return {
      studentId,
      nickname: student.nickname,
      avatarUrl: student.avatarUrl,
      phoneLast4: maskPhone(student.phone ?? null),
      firstMetAt: cs.firstMetAt,
      source: cs.source,
      tags,
      studentClasses: classes,
    };
  }

  async setCoachStudentTags(
    coachId: string,
    studentId: string,
    input: SetCoachStudentTagsInput,
  ) {
    const cs = await this.repository.findCoachStudentByCoachAndStudent(coachId, studentId);
    if (!cs) {
      throw new AppError(404, 'COACHING_COACH_STUDENT_NOT_FOUND', '学员记录不存在');
    }
    if (input.tags.length > 10) {
      throw new AppError(400, 'COACHING_INVALID_TAGS', '标签数量不能超过 10 个');
    }
    for (const tag of input.tags) {
      if (!tag || tag.length === 0 || tag.length > 20) {
        throw new AppError(400, 'COACHING_INVALID_TAGS', '单个标签为空或超过 20 字符');
      }
    }
    const tags = await this.repository.setCoachStudentTags(coachId, studentId, input.tags);
    return { tags };
  }

  async updateCoachStudentSource(coachId: string, studentId: string, source: string) {
    const validSources = ['manual', 'group-class', 'private-lesson', 'class-lesson', 'other'];
    if (!validSources.includes(source)) {
      throw new AppError(400, 'COACHING_INVALID_SOURCE', '无效的来源类型');
    }
    const cs = await this.repository.findCoachStudentByCoachAndStudent(coachId, studentId);
    if (!cs) {
      throw new AppError(404, 'COACHING_COACH_STUDENT_NOT_FOUND', '学员记录不存在');
    }
    await this.repository.updateCoachStudentSource(coachId, studentId, source);
    return { source };
  }

  async getCoachStudentTags(coachId: string, studentId: string) {
    const cs = await this.repository.findCoachStudentByCoachAndStudent(coachId, studentId);
    if (!cs) {
      throw new AppError(404, 'COACHING_COACH_STUDENT_NOT_FOUND', '学员记录不存在');
    }
    const rows = await this.repository.findCoachStudentTagsList(coachId, studentId);
    return { tags: rows.map((r) => r.tag) };
  }

  // =========================================================================
  // Schedule lesson for a known student (unified private lesson)
  // =========================================================================

  async scheduleLessonForStudent(
    coachId: string,
    studentId: string,
    input: ScheduleLessonForStudentInput,
  ) {
    const coach = await this.userService.getUserById(coachId);
    if (!coach || !coach.isCoach) {
      throw new AppError(
        403,
        'COACHING_COACH_ROLE_REQUIRED',
        '当前用户不是教练角色，无权执行此操作',
      );
    }
    const cs = await this.repository.findCoachStudentByCoachAndStudent(coachId, studentId);
    if (!cs) {
      throw new AppError(
        404,
        'COACHING_COACH_STUDENT_NOT_FOUND',
        '学员不在当前教练的学员库中',
      );
    }

    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    if (startTime <= new Date()) {
      throw new AppError(400, 'COACHING_INVALID_TIME', '开始时间必须晚于当前时间');
    }
    if (endTime <= startTime) {
      throw new AppError(400, 'COACHING_INVALID_TIME', '结束时间必须晚于开始时间');
    }
    if (input.trainingContent !== undefined && input.trainingContent.length > 2000) {
      throw new AppError(400, 'COACHING_INVALID_TRAINING_CONTENT', '训练内容超过 2000 字符');
    }
    if (input.feeDescription !== undefined && input.feeDescription.length > 200) {
      throw new AppError(400, 'COACHING_INVALID_FEE_DESCRIPTION', '费用说明超过 200 字符');
    }
    if (input.venueId) {
      const venue = await this.venueService.getVenueById(input.venueId);
      if (!venue) throw new AppError(404, 'COACHING_VENUE_NOT_FOUND', '球馆不存在');
    }

    const lesson = await this.repository.createPrivateLesson({
      coachId,
      studentId,
      venueId: input.venueId,
      startTime,
      endTime,
      feeDescription: input.feeDescription ?? null,
      trainingContent: input.trainingContent ?? null,
      source: 'scheduled',
    });

    try {
      await this.notificationService.create({
        userId: studentId,
        type: 'PRIVATE_LESSON_SCHEDULED',
        title: '新私教课程',
        content: '教练为你安排了新的私教课程',
        targetType: 'private-lesson',
        targetId: lesson.id,
      });
    } catch (err) {
      logger.error(
        { error: (err as Error).message, lessonId: lesson.id },
        '私教课程（scheduled）通知发送失败',
      );
    }

    logger.info(
      { coachId: coachId.slice(0, 8), studentId: studentId.slice(0, 8), lessonId: lesson.id },
      '教练为学员排课',
    );

    return lesson;
  }

  async getPrivateLessonsByCoachStudent(
    coachId: string,
    studentId: string,
    options?: { status?: string; page?: number; pageSize?: number },
  ) {
    const cs = await this.repository.findCoachStudentByCoachAndStudent(coachId, studentId);
    if (!cs) {
      throw new AppError(404, 'COACHING_COACH_STUDENT_NOT_FOUND', '学员不在当前教练的学员库中');
    }
    const { items, total } = await this.repository.findPrivateLessonsByStudent(
      coachId,
      studentId,
      options,
    );
    return { items, total, page: options?.page ?? 1, pageSize: options?.pageSize ?? 20 };
  }

  // =========================================================================
  // Private lesson notes — unified (classLesson context unchanged; private-lesson
  // notes now attach directly to PrivateLesson)
  // =========================================================================

  async addPrivateLessonNote(
    lessonId: string,
    coachId: string,
    input: CreateLessonNoteInput,
  ) {
    const lesson = await this.repository.findPrivateLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_NOT_FOUND', '私教课不存在');
    }
    if (lesson.coachId !== coachId) {
      throw new AppError(403, 'COACHING_NOT_COACH_OWNER', '非该私教课的教练，无权操作');
    }
    if (lesson.status === 'cancelled') {
      throw new AppError(409, 'COACHING_LESSON_CANCELLED', '已取消的课程不可添加笔记');
    }
    if (!input.content || input.content.length === 0 || input.content.length > 500) {
      throw new AppError(400, 'COACHING_INVALID_NOTE_CONTENT', '笔记内容为空或超过 500 字符');
    }
    return this.repository.createLessonNote({
      privateLessonId: lessonId,
      coachId,
      content: input.content,
    });
  }

  async getPrivateLessonNotes(lessonId: string, requesterId: string) {
    const lesson = await this.repository.findPrivateLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, 'COACHING_PRIVATE_LESSON_NOT_FOUND', '私教课不存在');
    }
    if (lesson.coachId !== requesterId && lesson.studentId !== requesterId) {
      throw new AppError(403, 'COACHING_NOT_LESSON_PARTICIPANT', '无权查看该课程笔记');
    }
    const notes = await this.repository.findLessonNotes({ privateLessonId: lessonId });
    return { items: notes };
  }
}
