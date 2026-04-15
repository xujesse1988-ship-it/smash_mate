import { prisma } from '../../infra/database.js';

export interface FindCoachListParams {
  page: number;
  pageSize: number;
  specialty?: string;
}

export interface CreateGroupClassData {
  coachId: string;
  venueId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  maxParticipants: number;
  feeDescription?: string;
}

export interface UpdateGroupClassData {
  title?: string;
  venueId?: string;
  startTime?: Date;
  endTime?: Date;
  maxParticipants?: number;
  feeDescription?: string;
  status?: string;
}

export class CoachingRepository {
  async findCoachProfile(userId: string) {
    return prisma.coachProfile.findUnique({
      where: { userId },
    });
  }

  async createCoachProfile(userId: string) {
    return prisma.coachProfile.create({
      data: {
        userId,
        bio: null,
        specialties: [],
      },
    });
  }

  async updateCoachProfile(userId: string, data: { bio?: string; specialties?: string[] }) {
    return prisma.coachProfile.update({
      where: { userId },
      data,
    });
  }

  async findCoachList(query: FindCoachListParams) {
    const { page, pageSize, specialty } = query;
    const skip = (page - 1) * pageSize;

    // Design doc §4: "仅返回 isCoach = true 的用户对应的教练资料"
    const where: Record<string, unknown> = {
      user: { isCoach: true },
    };
    if (specialty) {
      where.specialties = { has: specialty };
    }

    const [items, total] = await Promise.all([
      prisma.coachProfile.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coachProfile.count({ where }),
    ]);

    return { items, total };
  }

  async createGroupClass(data: CreateGroupClassData) {
    const groupClass = await prisma.groupClass.create({
      data: {
        coachId: data.coachId,
        venueId: data.venueId,
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        maxParticipants: data.maxParticipants,
        feeDescription: data.feeDescription ?? null,
        status: 'open',
      },
      include: {
        enrollments: true,
      },
    });

    return {
      ...groupClass,
      currentParticipants: groupClass.enrollments.length,
    };
  }

  async findGroupClassById(id: string) {
    const groupClass = await prisma.groupClass.findUnique({
      where: { id },
      include: {
        enrollments: {
          orderBy: { enrolledAt: 'asc' },
        },
      },
    });

    if (!groupClass) return null;

    return {
      ...groupClass,
      currentParticipants: groupClass.enrollments.length,
    };
  }

  async updateGroupClass(id: string, data: UpdateGroupClassData) {
    const groupClass = await prisma.groupClass.update({
      where: { id },
      data,
      include: {
        enrollments: true,
      },
    });

    return {
      ...groupClass,
      currentParticipants: groupClass.enrollments.length,
    };
  }

  async enrollGroupClass(classId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const enrollment = await tx.groupClassEnrollment.create({
        data: {
          groupClassId: classId,
          userId,
        },
      });

      const count = await tx.groupClassEnrollment.count({
        where: { groupClassId: classId },
      });

      const groupClass = await tx.groupClass.findUniqueOrThrow({
        where: { id: classId },
      });

      if (count >= groupClass.maxParticipants) {
        await tx.groupClass.update({
          where: { id: classId },
          data: { status: 'full' },
        });
      }

      return {
        currentParticipants: count,
        status: count >= groupClass.maxParticipants ? 'full' : groupClass.status,
        enrolledAt: enrollment.enrolledAt,
      };
    });
  }

  async cancelEnrollment(classId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.groupClassEnrollment.delete({
        where: {
          groupClassId_userId: {
            groupClassId: classId,
            userId,
          },
        },
      });

      const count = await tx.groupClassEnrollment.count({
        where: { groupClassId: classId },
      });

      const groupClass = await tx.groupClass.findUniqueOrThrow({
        where: { id: classId },
      });

      if (groupClass.status === 'full' && count < groupClass.maxParticipants) {
        await tx.groupClass.update({
          where: { id: classId },
          data: { status: 'open' },
        });
      }

      return {
        currentParticipants: count,
        status:
          groupClass.status === 'full' && count < groupClass.maxParticipants
            ? 'open'
            : groupClass.status,
      };
    });
  }

  // ===== Unified PrivateLesson (slot + booked + scheduled) =====

  /**
   * Create a single private lesson. Supports two modes:
   *   - slot mode: studentId=null, source=null (open availability)
   *   - direct schedule: studentId!=null, source='scheduled'
   */
  async createPrivateLesson(data: {
    coachId: string;
    studentId?: string | null;
    venueId?: string | null;
    venueIds?: string[];
    startTime: Date;
    endTime: Date;
    feeDescription?: string | null;
    trainingContent?: string | null;
    source?: string | null;
  }) {
    return prisma.privateLesson.create({
      data: {
        coachId: data.coachId,
        studentId: data.studentId ?? null,
        venueId: data.venueId ?? null,
        venueIds: data.venueIds ?? [],
        startTime: data.startTime,
        endTime: data.endTime,
        feeDescription: data.feeDescription ?? null,
        trainingContent: data.trainingContent ?? null,
        source: data.source ?? null,
        status: 'scheduled',
      },
    });
  }

  /**
   * Batch create open slots (studentId=null, source=null).
   */
  async createPrivateLessonSlots(
    slots: Array<{
      coachId: string;
      startTime: Date;
      endTime: Date;
      venueIds: string[];
      feeDescription: string | null;
    }>,
  ) {
    const created: Awaited<ReturnType<typeof prisma.privateLesson.create>>[] = [];
    for (const s of slots) {
      const row = await prisma.privateLesson.create({
        data: {
          coachId: s.coachId,
          studentId: null,
          venueIds: s.venueIds,
          startTime: s.startTime,
          endTime: s.endTime,
          feeDescription: s.feeDescription,
          source: null,
          status: 'scheduled',
        },
      });
      created.push(row);
    }
    return created;
  }

  /**
   * Find open availability slots for a coach (studentId=null, status='scheduled').
   * Optional time range filter.
   */
  async findAvailability(
    coachId: string,
    options?: { from?: Date; to?: Date },
  ) {
    const where: Record<string, unknown> = {
      coachId,
      studentId: null,
      status: 'scheduled',
    };
    if (options?.from || options?.to) {
      const range: Record<string, Date> = {};
      if (options.from) range.gte = options.from;
      if (options.to) range.lte = options.to;
      where.startTime = range;
    } else {
      where.startTime = { gt: new Date() };
    }
    return prisma.privateLesson.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Student books an open slot. Atomic: uses updateMany with guards on studentId=null
   * and status='scheduled' to enforce optimistic concurrency.
   *
   * Returns the lesson on success; returns null if the slot was no longer available.
   */
  async bookPrivateLesson(
    lessonId: string,
    studentId: string,
    venueId: string | null,
  ) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.privateLesson.updateMany({
        where: {
          id: lessonId,
          studentId: null,
          status: 'scheduled',
        },
        data: {
          studentId,
          venueId: venueId ?? undefined,
          source: 'booked',
        },
      });
      if (result.count === 0) {
        return null;
      }
      return tx.privateLesson.findUnique({ where: { id: lessonId } });
    });
  }

  /**
   * Mark a private lesson as cancelled. Business checks (who may cancel, status
   * gating) are enforced in the service layer.
   */
  async cancelPrivateLesson(id: string) {
    return prisma.privateLesson.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  async findPrivateLessonById(id: string) {
    return prisma.privateLesson.findUnique({
      where: { id },
    });
  }

  async updatePrivateLesson(
    id: string,
    data: {
      venueId?: string | null;
      venueIds?: string[];
      startTime?: Date;
      endTime?: Date;
      feeDescription?: string | null;
      trainingContent?: string | null;
      status?: string;
    },
  ) {
    return prisma.privateLesson.update({
      where: { id },
      data,
    });
  }

  async updatePrivateLessonTrainingContent(id: string, content: string) {
    return prisma.privateLesson.update({
      where: { id },
      data: { trainingContent: content },
    });
  }

  async findPrivateLessonsByStudent(
    coachId: string,
    studentId: string,
    options?: { status?: string; page?: number; pageSize?: number },
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const where: Record<string, unknown> = { coachId, studentId };
    if (options?.status) {
      where.status = options.status;
    }
    const [items, total] = await Promise.all([
      prisma.privateLesson.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { startTime: 'desc' },
      }),
      prisma.privateLesson.count({ where }),
    ]);
    return { items, total };
  }

  /** Scheduler: mark unbooked slots whose startTime has passed as expired. */
  async markSlotsExpired(now: Date): Promise<number> {
    const result = await prisma.privateLesson.updateMany({
      where: {
        studentId: null,
        status: 'scheduled',
        startTime: { lte: now },
      },
      data: { status: 'expired' },
    });
    return result.count;
  }

  /**
   * Scheduler: transition booked/scheduled lessons to in_progress.
   * Returns the lessons that were updated, so the caller can populate CoachStudent.
   */
  async markPrivateLessonsInProgress(now: Date) {
    const toStart = await prisma.privateLesson.findMany({
      where: {
        status: 'scheduled',
        startTime: { lte: now },
        studentId: { not: null },
      },
    });
    if (toStart.length === 0) return [] as typeof toStart;
    await prisma.privateLesson.updateMany({
      where: { id: { in: toStart.map((l) => l.id) } },
      data: { status: 'in_progress' },
    });
    return toStart;
  }

  /** Scheduler: transition in_progress → completed when endTime passed. */
  async markPrivateLessonsCompleted(now: Date): Promise<number> {
    const result = await prisma.privateLesson.updateMany({
      where: {
        status: 'in_progress',
        endTime: { lte: now },
      },
      data: { status: 'completed' },
    });
    return result.count;
  }

  /** Daily cleanup: physically delete expired slots older than the cutoff. */
  async deleteExpiredSlots(beforeDate: Date): Promise<number> {
    const result = await prisma.privateLesson.deleteMany({
      where: {
        status: 'expired',
        startTime: { lt: beforeDate },
      },
    });
    return result.count;
  }

  // TODO: 当前实现将团课报名、私教预约和学员班排课全量加载到内存后合并排序、切片分页。
  // 因为需要跨多张表按 startTime 统一排序，无法直接在 DB 层面完成分页。
  // 一期数据量小可接受，二期应优化为 DB 层分页（如分别限制查询量或使用 raw SQL union）。
  async findUserEnrollments(
    userId: string,
    query: { page: number; pageSize: number; type?: string; status?: string },
  ) {
    const { page, pageSize, type, status } = query;
    const skip = (page - 1) * pageSize;

    const items: Array<{
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
    }> = [];
    let total = 0;

    // Collect group class enrollments (if not filtered to private-lesson only)
    if (!type || type === 'group-class') {
      const gcWhere: Record<string, unknown> = { userId };
      if (status) {
        gcWhere.groupClass = { status };
      }

      const gcEnrollments = await prisma.groupClassEnrollment.findMany({
        where: gcWhere,
        include: {
          groupClass: {
            include: {
              venue: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { groupClass: { startTime: 'desc' } },
      });

      for (const e of gcEnrollments) {
        items.push({
          type: 'group-class',
          groupClass: {
            id: e.groupClass.id,
            title: e.groupClass.title,
            coachId: e.groupClass.coachId,
            startTime: e.groupClass.startTime,
            endTime: e.groupClass.endTime,
            status: e.groupClass.status,
            enrolledAt: e.enrolledAt,
            venue: e.groupClass.venue
              ? { id: e.groupClass.venue.id, name: e.groupClass.venue.name }
              : null,
          },
          privateLesson: null,
          classLesson: null,
        });
      }
    }

    // Collect private lessons (if not filtered to group-class only)
    if (!type || type === 'private-lesson') {
      const plWhere: Record<string, unknown> = { studentId: userId };
      if (status) {
        plWhere.status = status;
      }

      const plLessons = await prisma.privateLesson.findMany({
        where: plWhere,
        include: {
          venue: { select: { id: true, name: true } },
        },
        orderBy: { startTime: 'desc' },
      });

      for (const l of plLessons) {
        items.push({
          type: 'private-lesson',
          groupClass: null,
          privateLesson: {
            id: l.id,
            coachId: l.coachId,
            startTime: l.startTime,
            endTime: l.endTime,
            status: l.status,
            createdAt: l.createdAt,
            venue: l.venue ? { id: l.venue.id, name: l.venue.name } : null,
          },
          classLesson: null,
        });
      }
    }

    // Collect student class lessons (排课 of classes the user is a member of)
    if (!type || type === 'class-lesson') {
      const memberships = await prisma.studentClassMember.findMany({
        where: { studentId: userId },
        select: { studentClassId: true },
      });
      const classIds = memberships.map((m) => m.studentClassId);

      if (classIds.length > 0) {
        const clWhere: Record<string, unknown> = { studentClassId: { in: classIds } };
        if (status) {
          clWhere.status = status;
        }

        const clLessons = await prisma.classLesson.findMany({
          where: clWhere,
          include: {
            studentClass: { select: { id: true, name: true } },
            venue: { select: { id: true, name: true } },
          },
          orderBy: { startTime: 'desc' },
        });

        for (const l of clLessons) {
          items.push({
            type: 'class-lesson',
            groupClass: null,
            privateLesson: null,
            classLesson: {
              id: l.id,
              studentClassId: l.studentClassId,
              studentClassName: l.studentClass.name,
              coachId: l.coachId,
              startTime: l.startTime,
              endTime: l.endTime,
              status: l.status,
              createdAt: l.createdAt,
              venue: l.venue ? { id: l.venue.id, name: l.venue.name } : null,
            },
          });
        }
      }
    }

    // Sort by startTime descending
    items.sort((a, b) => {
      const aTime =
        a.groupClass?.startTime ??
        a.privateLesson?.startTime ??
        a.classLesson?.startTime ??
        new Date(0);
      const bTime =
        b.groupClass?.startTime ??
        b.privateLesson?.startTime ??
        b.classLesson?.startTime ??
        new Date(0);
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    total = items.length;

    // Paginate
    const paginatedItems = items.slice(skip, skip + pageSize);

    return { items: paginatedItems, total };
  }

  async findCoachPrivateLessons(
    coachId: string,
    query: { page: number; pageSize: number; status?: string },
  ) {
    const { page, pageSize, status } = query;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { coachId };
    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      prisma.privateLesson.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { startTime: 'desc' },
      }),
      prisma.privateLesson.count({ where }),
    ]);

    return { items, total };
  }

  async findGroupClassesByCoach(coachId: string, endTimeAfter: Date) {
    const groupClasses = await prisma.groupClass.findMany({
      where: {
        coachId,
        endTime: { gt: endTimeAfter },
      },
      include: {
        enrollments: true,
      },
      orderBy: { startTime: 'asc' },
    });

    return groupClasses.map((gc) => ({
      ...gc,
      currentParticipants: gc.enrollments.length,
    }));
  }

  /**
   * Get participant user IDs for a group class or a coach's students.
   * @param id - groupClassId or coachId, distinguished by the `type` parameter
   * @param type - 'class' to query by groupClassId (returns coach + enrolled students),
   *               'coach' to query by coachId (returns all unique students across coach's classes)
   */
  async getGroupClassParticipantIds(
    id: string,
    type: 'class' | 'coach' = 'class',
  ): Promise<string[]> {
    if (type === 'class') {
      const groupClass = await prisma.groupClass.findUnique({
        where: { id },
        select: { coachId: true, enrollments: { select: { userId: true } } },
      });

      if (!groupClass) {
        return [];
      }

      const studentIds = groupClass.enrollments.map((e) => e.userId);
      return [...new Set([groupClass.coachId, ...studentIds])];
    }

    // type === 'coach' — return all unique students across coach's classes
    const enrollments = await prisma.groupClassEnrollment.findMany({
      where: {
        groupClass: {
          coachId: id,
        },
      },
      select: { userId: true },
    });
    return [...new Set(enrollments.map((e) => e.userId))];
  }

  /**
   * Get participant user IDs for a private lesson or a coach's students.
   * @param id - privateLessonId or coachId, distinguished by the `type` parameter
   * @param type - 'lesson' to query by privateLessonId (returns [coachId, studentId]),
   *               'coach' to query by coachId (returns all unique students, excluding cancelled)
   */
  async getPrivateLessonParticipantIds(
    id: string,
    type: 'lesson' | 'coach' = 'lesson',
  ): Promise<string[]> {
    if (type === 'lesson') {
      const lesson = await prisma.privateLesson.findUnique({
        where: { id },
        select: { coachId: true, studentId: true },
      });

      if (!lesson) {
        return [];
      }

      if (!lesson.studentId) {
        return [lesson.coachId];
      }
      return [lesson.coachId, lesson.studentId];
    }

    // type === 'coach' — return all unique students
    // Design doc §6.8: exclude cancelled private lessons from studentCount
    const lessons = await prisma.privateLesson.findMany({
      where: { coachId: id, status: { not: 'cancelled' }, studentId: { not: null } },
      select: { studentId: true },
    });
    return [...new Set(lessons.map((l) => l.studentId).filter((s): s is string => s !== null))];
  }

  async getBatchCoachStudentCounts(coachIds: string[]): Promise<Map<string, number>> {
    if (coachIds.length === 0) return new Map();

    // Batch query: all group class enrollments for these coaches
    const gcEnrollments = await prisma.groupClassEnrollment.findMany({
      where: {
        groupClass: {
          coachId: { in: coachIds },
        },
      },
      select: {
        userId: true,
        groupClass: { select: { coachId: true } },
      },
    });

    // Batch query: all private lesson students for these coaches
    // Design doc §6.8: exclude cancelled private lessons from studentCount
    const plLessons = await prisma.privateLesson.findMany({
      where: {
        coachId: { in: coachIds },
        status: { not: 'cancelled' },
        studentId: { not: null },
      },
      select: {
        studentId: true,
        coachId: true,
      },
    });

    // Build per-coach unique student sets
    const coachStudentSets = new Map<string, Set<string>>();
    for (const coachId of coachIds) {
      coachStudentSets.set(coachId, new Set());
    }

    for (const e of gcEnrollments) {
      coachStudentSets.get(e.groupClass.coachId)?.add(e.userId);
    }

    for (const l of plLessons) {
      if (l.studentId) {
        coachStudentSets.get(l.coachId)?.add(l.studentId);
      }
    }

    const result = new Map<string, number>();
    for (const [coachId, studentSet] of coachStudentSets) {
      result.set(coachId, studentSet.size);
    }
    return result;
  }

  async updateGroupClassesStarted(now: Date): Promise<number> {
    const result = await prisma.groupClass.updateMany({
      where: {
        status: { in: ['open', 'full'] },
        startTime: { lte: now },
      },
      data: { status: 'in_progress' },
    });
    return result.count;
  }

  async updateGroupClassesCompleted(now: Date): Promise<number> {
    const result = await prisma.groupClass.updateMany({
      where: {
        status: 'in_progress',
        endTime: { lte: now },
      },
      data: { status: 'completed' },
    });
    return result.count;
  }

  async updatePrivateLessonsStarted(now: Date): Promise<number> {
    // Only transition lessons that have a student booked (studentId != null).
    // Open slots (studentId=null) should be marked as 'expired' instead — that
    // logic lands in sub-task 2's scheduler rewrite (design doc §5).
    const result = await prisma.privateLesson.updateMany({
      where: {
        status: 'scheduled',
        startTime: { lte: now },
        studentId: { not: null },
      },
      data: { status: 'in_progress' },
    });
    return result.count;
  }

  async updatePrivateLessonsCompleted(now: Date): Promise<number> {
    const result = await prisma.privateLesson.updateMany({
      where: {
        status: 'in_progress',
        endTime: { lte: now },
      },
      data: { status: 'completed' },
    });
    return result.count;
  }

  // ===== Coaching v2: Coach Application (GA) =====

  async createCoachApplication(data: {
    userId: string;
    certificateUrls: string[];
    description?: string;
  }) {
    return prisma.coachApplication.create({
      data: {
        userId: data.userId,
        certificateUrls: data.certificateUrls,
        description: data.description ?? null,
        status: 'pending',
      },
    });
  }

  async findLatestApplicationByUserId(userId: string) {
    return prisma.coachApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Alias used by service layer (matches contract test mock name) */
  async findLatestApplicationByUser(userId: string) {
    return this.findLatestApplicationByUserId(userId);
  }

  async findApplicationById(id: string) {
    return prisma.coachApplication.findUnique({
      where: { id },
    });
  }

  /** Alias used by service layer (matches contract test mock name) */
  async findCoachApplicationById(id: string) {
    return this.findApplicationById(id);
  }

  async findApplications(query: { status?: string; page: number; pageSize: number }) {
    const { status, page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      prisma.coachApplication.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coachApplication.count({ where }),
    ]);

    return { items, total };
  }

  /** Alias used by service layer (matches contract test mock name) */
  async findCoachApplications(query: { status?: string; page: number; pageSize: number }) {
    return this.findApplications(query);
  }

  async updateApplicationStatus(
    id: string,
    data: {
      status: string;
      rejectReason?: string;
      reviewedBy?: string;
      reviewedAt?: Date;
    },
  ) {
    return prisma.coachApplication.update({
      where: { id },
      data,
    });
  }

  /**
   * Update coach application and optionally set User.isCoach in a transaction.
   * Used by service layer (matches contract test mock name).
   * When approving, also sets User.isCoach = true atomically.
   */
  async updateCoachApplication(
    id: string,
    data: {
      status: string;
      rejectReason?: string;
      reviewedBy?: string;
      reviewedAt?: Date;
    },
    options?: { setUserIsCoach?: { userId: string; isCoach: boolean } },
  ) {
    if (options?.setUserIsCoach) {
      // Use transaction to ensure atomicity
      const [updatedApplication] = await prisma.$transaction([
        prisma.coachApplication.update({
          where: { id },
          data,
        }),
        prisma.user.update({
          where: { id: options.setUserIsCoach.userId },
          data: { isCoach: options.setUserIsCoach.isCoach },
        }),
      ]);
      return updatedApplication;
    }
    return this.updateApplicationStatus(id, data);
  }

  // ===== Coaching v2: Student Class (GB) =====

  async createStudentClass(data: { coachId: string; name: string }) {
    return prisma.studentClass.create({
      data: {
        coachId: data.coachId,
        name: data.name,
      },
    });
  }

  async findStudentClassById(id: string) {
    return prisma.studentClass.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { joinedAt: 'asc' },
        },
        lessons: {
          orderBy: { startTime: 'desc' },
        },
      },
    });
  }

  async findStudentClassesByCoachId(coachId: string) {
    return prisma.studentClass.findMany({
      where: { coachId },
      include: {
        members: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStudentClass(id: string, data: { name?: string }) {
    return prisma.studentClass.update({
      where: { id },
      data,
    });
  }

  async deleteStudentClass(id: string) {
    return prisma.studentClass.delete({
      where: { id },
    });
  }

  async addStudentToClass(data: { studentClassId: string; studentId: string }) {
    return prisma.studentClassMember.create({
      data: {
        studentClassId: data.studentClassId,
        studentId: data.studentId,
      },
    });
  }

  async removeStudentFromClass(studentClassId: string, studentId: string) {
    return prisma.studentClassMember.delete({
      where: {
        studentClassId_studentId: {
          studentClassId,
          studentId,
        },
      },
    });
  }

  async findClassMembers(studentClassId: string) {
    return prisma.studentClassMember.findMany({
      where: { studentClassId },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async isStudentInClass(studentClassId: string, studentId: string): Promise<boolean> {
    const member = await prisma.studentClassMember.findUnique({
      where: {
        studentClassId_studentId: {
          studentClassId,
          studentId,
        },
      },
    });
    return member !== null;
  }

  // ===== Coaching v2: Class Lesson (GB) =====

  async createClassLesson(data: {
    studentClassId: string;
    coachId: string;
    venueId?: string;
    startTime: Date;
    endTime: Date;
    trainingContent?: string;
  }) {
    return prisma.classLesson.create({
      data: {
        studentClassId: data.studentClassId,
        coachId: data.coachId,
        venueId: data.venueId ?? null,
        startTime: data.startTime,
        endTime: data.endTime,
        trainingContent: data.trainingContent ?? null,
        status: 'scheduled',
      },
    });
  }

  async findClassLessonById(id: string) {
    return prisma.classLesson.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findClassLessonsByClassId(
    classId: string,
    options?: { page?: number; pageSize?: number; status?: string },
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { studentClassId: classId };
    if (options?.status) {
      where.status = options.status;
    }

    const [items, total] = await Promise.all([
      prisma.classLesson.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { startTime: 'desc' },
      }),
      prisma.classLesson.count({ where }),
    ]);

    return { items, total };
  }

  async updateClassLesson(
    id: string,
    data: {
      venueId?: string;
      startTime?: Date;
      endTime?: Date;
      trainingContent?: string;
      status?: string;
    },
  ) {
    return prisma.classLesson.update({
      where: { id },
      data,
    });
  }

  async updateClassLessonStatus(id: string, status: string) {
    return prisma.classLesson.update({
      where: { id },
      data: { status },
    });
  }

  async updateClassLessonTrainingContent(id: string, content: string) {
    return prisma.classLesson.update({
      where: { id },
      data: { trainingContent: content },
    });
  }

  async findScheduledClassLessonsToStart(now: Date) {
    return prisma.classLesson.findMany({
      where: {
        status: 'scheduled',
        startTime: { lte: now },
      },
    });
  }

  async findInProgressClassLessonsToEnd(now: Date) {
    return prisma.classLesson.findMany({
      where: {
        status: 'in_progress',
        endTime: { lte: now },
      },
    });
  }

  // ===== Coaching v2: CoachStudent (unified student library) =====

  /**
   * Create a CoachStudent row. If an entry already exists for (coachId, studentId)
   * it is left untouched (create-if-not-exists). `source` is only written on first
   * insert per design doc decision 4.
   */
  async createCoachStudent(data: { coachId: string; studentId: string; source: string }) {
    const existing = await prisma.coachStudent.findUnique({
      where: { coachId_studentId: { coachId: data.coachId, studentId: data.studentId } },
    });
    if (existing) return existing;
    return prisma.coachStudent.create({
      data: {
        coachId: data.coachId,
        studentId: data.studentId,
        source: data.source,
      },
    });
  }

  /** Batch insert; skipDuplicates ensures idempotency and preserves first source. */
  async recordCoachStudents(
    coachId: string,
    studentIds: string[],
    source: string,
  ): Promise<number> {
    if (studentIds.length === 0) return 0;
    const unique = [...new Set(studentIds)];
    const result = await prisma.coachStudent.createMany({
      data: unique.map((studentId) => ({ coachId, studentId, source })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async findCoachStudentByCoachAndStudent(coachId: string, studentId: string) {
    return prisma.coachStudent.findUnique({
      where: { coachId_studentId: { coachId, studentId } },
    });
  }

  async findCoachStudentDetail(coachId: string, studentId: string) {
    return prisma.coachStudent.findUnique({
      where: { coachId_studentId: { coachId, studentId } },
    });
  }

  /**
   * List the coach's CoachStudent rows with basic pagination / search.
   *
   * Note: full tag filtering is applied at the service layer because
   * derived tags (e.g. '团课学员', '私教学员', '学员班: <name>') require
   * cross-table aggregation. This method only applies nickname search
   * against the related User, and returns the student user relation.
   */
  async findCoachStudents(
    coachId: string,
    filters?: { search?: string; page?: number; pageSize?: number },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { coachId };
    if (filters?.search) {
      where.student = {
        OR: [
          { nickname: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      prisma.coachStudent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { firstMetAt: 'desc' },
        include: {
          student: {
            select: { id: true, nickname: true, avatarUrl: true, phone: true },
          },
        },
      }),
      prisma.coachStudent.count({ where }),
    ]);

    return { items, total };
  }

  async findCoachStudentTagsList(coachId: string, studentId: string) {
    return prisma.studentTag.findMany({
      where: { coachId, studentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Return distinct tag strings ever used by this coach (for filter UI). */
  async findAllCoachCustomTags(coachId: string): Promise<string[]> {
    const rows = await prisma.studentTag.findMany({
      where: { coachId },
      select: { tag: true },
      distinct: ['tag'],
    });
    return rows.map((r) => r.tag);
  }

  async setCoachStudentTags(
    coachId: string,
    studentId: string,
    tags: string[],
  ): Promise<string[]> {
    await prisma.$transaction(async (tx) => {
      await tx.studentTag.deleteMany({ where: { coachId, studentId } });
      if (tags.length > 0) {
        await tx.studentTag.createMany({
          data: tags.map((tag) => ({ coachId, studentId, tag })),
          skipDuplicates: true,
        });
      }
    });
    const rows = await prisma.studentTag.findMany({
      where: { coachId, studentId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => r.tag);
  }

  /** Tag lookups for derived aggregations used by the service. */
  async findStudentIdsWithTag(coachId: string, tag: string): Promise<string[]> {
    const rows = await prisma.studentTag.findMany({
      where: { coachId, tag },
      select: { studentId: true },
    });
    return rows.map((r) => r.studentId);
  }

  /**
   * Given a list of studentIds, return a map studentId -> { classes that belong to this coach }.
   * Used by service layer to enrich CoachStudent items with studentClasses.
   */
  async findStudentClassesForStudents(
    coachId: string,
    studentIds: string[],
  ): Promise<Map<string, Array<{ id: string; name: string }>>> {
    if (studentIds.length === 0) return new Map();
    const memberships = await prisma.studentClassMember.findMany({
      where: {
        studentId: { in: studentIds },
        studentClass: { coachId },
      },
      select: {
        studentId: true,
        studentClass: { select: { id: true, name: true } },
      },
    });
    const map = new Map<string, Array<{ id: string; name: string }>>();
    for (const m of memberships) {
      const arr = map.get(m.studentId) ?? [];
      arr.push({ id: m.studentClass.id, name: m.studentClass.name });
      map.set(m.studentId, arr);
    }
    return map;
  }

  /** Which of these students have at least one group-class enrollment that has started or completed? */
  async findStudentIdsWhoTookGroupClass(
    coachId: string,
    studentIds: string[],
  ): Promise<Set<string>> {
    if (studentIds.length === 0) return new Set();
    const rows = await prisma.groupClassEnrollment.findMany({
      where: {
        userId: { in: studentIds },
        groupClass: { coachId, status: { in: ['in_progress', 'completed'] } },
      },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId));
  }

  /** Which of these students have at least one private lesson in_progress or completed with this coach? */
  async findStudentIdsWhoTookPrivateLesson(
    coachId: string,
    studentIds: string[],
  ): Promise<Set<string>> {
    if (studentIds.length === 0) return new Set();
    const rows = await prisma.privateLesson.findMany({
      where: {
        coachId,
        studentId: { in: studentIds },
        status: { in: ['in_progress', 'completed'] },
      },
      select: { studentId: true },
    });
    return new Set(rows.map((r) => r.studentId).filter((s): s is string => s !== null));
  }

  // ===== Coaching v2: Notes & Tags (shared) =====

  async createLessonNote(data: {
    classLessonId?: string;
    privateLessonId?: string;
    coachId: string;
    content: string;
  }) {
    return prisma.lessonNote.create({
      data: {
        classLessonId: data.classLessonId ?? null,
        privateLessonId: data.privateLessonId ?? null,
        coachId: data.coachId,
        content: data.content,
      },
    });
  }

  async findLessonNotes(query: { classLessonId?: string; privateLessonId?: string }) {
    const where: Record<string, unknown> = {};
    if (query.classLessonId) {
      where.classLessonId = query.classLessonId;
    }
    if (query.privateLessonId) {
      where.privateLessonId = query.privateLessonId;
    }

    return prisma.lessonNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStudentNote(data: {
    coachId: string;
    studentId: string;
    studentClassId?: string;
    content: string;
  }) {
    return prisma.studentNote.create({
      data: {
        coachId: data.coachId,
        studentId: data.studentId,
        studentClassId: data.studentClassId ?? null,
        content: data.content,
      },
    });
  }

  async findStudentNotes(query: {
    coachId: string;
    studentId: string;
    studentClassId?: string;
  }) {
    const where: Record<string, unknown> = {
      coachId: query.coachId,
      studentId: query.studentId,
    };
    if (query.studentClassId) {
      where.studentClassId = query.studentClassId;
    }

    return prisma.studentNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Overwrite the coach-student tag set with the given list.
   * Returns the resulting tag rows, sorted by createdAt asc.
   */
  async setStudentTags(
    coachId: string,
    studentId: string,
    tags: string[],
  ): Promise<Array<{ id: string; coachId: string; studentId: string; tag: string; createdAt: Date }>> {
    const deleteWhere = { coachId, studentId };
    await prisma.studentTag.deleteMany({ where: deleteWhere });

    if (tags.length > 0) {
      const createData = tags.map((tag) => ({ coachId, studentId, tag }));
      await prisma.studentTag.createMany({ data: createData, skipDuplicates: true });
    }

    return prisma.studentTag.findMany({
      where: deleteWhere,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findStudentTags(query: { coachId: string; studentId: string }) {
    return prisma.studentTag.findMany({
      where: {
        coachId: query.coachId,
        studentId: query.studentId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ===== Coaching v2: Alias methods (match contract test mock names) =====

  /** Alias for findStudentClassesByCoachId (matches contract test mock name) */
  async findStudentClassesByCoach(coachId: string) {
    return this.findStudentClassesByCoachId(coachId);
  }

  /** Alias for addStudentToClass (matches contract test mock name) */
  async addStudentClassMember(data: { studentClassId: string; studentId: string }) {
    return this.addStudentToClass(data);
  }

  /** Alias for removeStudentFromClass (matches contract test mock name) */
  async removeStudentClassMember(studentClassId: string, studentId: string) {
    return this.removeStudentFromClass(studentClassId, studentId);
  }

  /** Find a specific student class member (matches contract test mock name) */
  async findStudentClassMember(studentClassId: string, studentId: string) {
    return prisma.studentClassMember.findUnique({
      where: {
        studentClassId_studentId: {
          studentClassId,
          studentId,
        },
      },
    });
  }

  /** Alias for findClassMembers (matches contract test mock name) */
  async findStudentClassMembers(studentClassId: string) {
    return this.findClassMembers(studentClassId);
  }

  /** Count members in a student class */
  async countStudentClassMembers(studentClassId: string): Promise<number> {
    return prisma.studentClassMember.count({
      where: { studentClassId },
    });
  }

  /** Count non-cancelled lessons in a student class */
  async countClassLessons(studentClassId: string): Promise<number> {
    return prisma.classLesson.count({
      where: {
        studentClassId,
        status: { not: 'cancelled' },
      },
    });
  }

  /** Get student IDs in a student class */
  async getStudentClassMemberIds(studentClassId: string): Promise<string[]> {
    const members = await prisma.studentClassMember.findMany({
      where: { studentClassId },
      select: { studentId: true },
    });
    return members.map((m) => m.studentId);
  }

  /** Find lesson notes by class lesson ID */
  async findLessonNotesByLessonId(classLessonId: string) {
    return prisma.lessonNote.findMany({
      where: { classLessonId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ===== Coaching v2: Batch status transitions =====

  async updateClassLessonsStarted(now: Date): Promise<number> {
    const lessons = await this.findScheduledClassLessonsToStart(now);
    for (const l of lessons) {
      await this.updateClassLessonStatus(l.id, 'in_progress');
    }
    return lessons.length;
  }

  async updateClassLessonsCompleted(now: Date): Promise<number> {
    const lessons = await this.findInProgressClassLessonsToEnd(now);
    for (const l of lessons) {
      await this.updateClassLessonStatus(l.id, 'completed');
    }
    return lessons.length;
  }

  // ===== Coaching v2: Raw finders (for cross-module service calls) =====

  async findClassLessonByIdRaw(id: string) {
    return prisma.classLesson.findUnique({
      where: { id },
    });
  }

  // ===== Coaching v2: Cross-module (for match-record) =====

  async getClassLessonParticipantIds(lessonId: string): Promise<string[]> {
    const lesson = await prisma.classLesson.findUnique({
      where: { id: lessonId },
      select: {
        coachId: true,
        studentClass: {
          select: {
            members: {
              select: { studentId: true },
            },
          },
        },
      },
    });

    if (!lesson) return [];

    const studentIds = lesson.studentClass.members.map((m) => m.studentId);
    return [...new Set([lesson.coachId, ...studentIds])];
  }

  // ===== Coaching v2: Additional GB aliases for contract tests =====

  async findClassLessonsByClass(
    classId: string,
    options?: { page?: number; pageSize?: number; status?: string },
  ) {
    return this.findClassLessonsByClassId(classId, options);
  }

  async cancelClassLesson(id: string) {
    return this.updateClassLessonStatus(id, 'cancelled');
  }

  async findStudentClassesByStudent(studentId: string) {
    const memberships = await prisma.studentClassMember.findMany({
      where: { studentId },
      include: { studentClass: true },
    });
    return memberships.map((m) => m.studentClass);
  }
}
