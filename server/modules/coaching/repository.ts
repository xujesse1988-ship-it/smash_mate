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

  async createPrivateLessonSlot(
    data:
      | Array<{
          coachId: string;
          startTime: Date;
          endTime: Date;
          venueIds: string[];
          feeDescription: string | null;
        }>
      | {
          coachId: string;
          startTime: Date;
          endTime: Date;
          venueIds: string[];
          feeDescription: string | null;
        },
  ) {
    const slotsData = Array.isArray(data) ? data : [data];

    // Use $transaction to ensure atomic batch creation —
    // if any insert fails, all are rolled back (design doc §4 requirement)
    const created = await prisma.$transaction(
      slotsData.map((slot) =>
        prisma.privateLessonSlot.create({
          data: {
            coachId: slot.coachId,
            startTime: slot.startTime,
            endTime: slot.endTime,
            venueIds: slot.venueIds,
            feeDescription: slot.feeDescription,
            isBooked: false,
          },
        }),
      ),
    );

    return created;
  }

  async findAvailability(
    coachIdOrQuery?:
      | string
      | { coachId?: string; startDate?: string; endDate?: string; slotId?: string },
  ) {
    let coachId: string | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;
    let slotId: string | undefined;

    if (typeof coachIdOrQuery === 'string') {
      coachId = coachIdOrQuery;
    } else if (coachIdOrQuery) {
      coachId = coachIdOrQuery.coachId;
      startDate = coachIdOrQuery.startDate;
      endDate = coachIdOrQuery.endDate;
      slotId = coachIdOrQuery.slotId;
    }

    // If looking up a specific slot by ID
    if (slotId) {
      const slot = await prisma.privateLessonSlot.findUnique({ where: { id: slotId } });
      return slot ? [slot] : [];
    }

    const where: Record<string, unknown> = {};
    if (coachId) {
      where.coachId = coachId;
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      const timeFilter: Record<string, Date> = {};
      if (startDate) timeFilter.gte = new Date(startDate);
      if (endDate) timeFilter.lte = new Date(endDate);
      where.startTime = timeFilter;
    }

    // Only return future slots (startTime > now) when querying availability
    const now = new Date();
    if (where.startTime) {
      const existing = where.startTime as Record<string, Date>;
      if (!existing.gte || existing.gte < now) {
        existing.gt = now;
        delete existing.gte;
      }
    } else {
      where.startTime = { gt: now };
    }

    return prisma.privateLessonSlot.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });
  }

  async bookPrivateLesson(data: {
    slotId: string;
    coachId: string;
    studentId: string;
    venueId: string | null;
    startTime: Date;
    endTime: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      // Lock the slot
      await tx.privateLessonSlot.update({
        where: { id: data.slotId },
        data: { isBooked: true },
      });

      // Create the private lesson
      const lesson = await tx.privateLesson.create({
        data: {
          slotId: data.slotId,
          coachId: data.coachId,
          studentId: data.studentId,
          venueId: data.venueId,
          startTime: data.startTime,
          endTime: data.endTime,
          status: 'scheduled',
        },
      });

      return lesson;
    });
  }

  async cancelPrivateLesson(id: string) {
    return prisma.$transaction(async (tx) => {
      // Update lesson status
      const lesson = await tx.privateLesson.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      // Release the slot
      await tx.privateLessonSlot.update({
        where: { id: lesson.slotId },
        data: { isBooked: false },
      });

      return lesson;
    });
  }

  async findPrivateLessonById(id: string) {
    return prisma.privateLesson.findUnique({
      where: { id },
    });
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

      return [lesson.coachId, lesson.studentId];
    }

    // type === 'coach' — return all unique students
    // Design doc §6.8: exclude cancelled private lessons from studentCount
    const lessons = await prisma.privateLesson.findMany({
      where: { coachId: id, status: { not: 'cancelled' } },
      select: { studentId: true },
    });
    return [...new Set(lessons.map((l) => l.studentId))];
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
      coachStudentSets.get(l.coachId)?.add(l.studentId);
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
    const result = await prisma.privateLesson.updateMany({
      where: {
        status: 'scheduled',
        startTime: { lte: now },
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

  // ===== Coaching v2: Private Student (GC) =====

  async addPrivateStudent(data: { coachId: string; studentId: string }) {
    return prisma.privateStudent.create({
      data: {
        coachId: data.coachId,
        studentId: data.studentId,
        isActive: true,
      },
    });
  }

  async findPrivateStudentById(id: string) {
    return prisma.privateStudent.findUnique({
      where: { id },
      include: {
        lessons: {
          where: { status: { not: 'cancelled' } },
          orderBy: { startTime: 'desc' },
        },
      },
    });
  }

  async findPrivateStudentByCoachAndStudent(coachId: string, studentId: string) {
    return prisma.privateStudent.findUnique({
      where: {
        coachId_studentId: {
          coachId,
          studentId,
        },
      },
    });
  }

  async findPrivateStudentsByCoachId(coachId: string, includeInactive?: boolean) {
    const where: Record<string, unknown> = { coachId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return prisma.privateStudent.findMany({
      where,
      include: {
        lessons: {
          where: { status: { not: 'cancelled' } },
          select: { id: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async updatePrivateStudentActive(id: string, isActive: boolean) {
    return prisma.privateStudent.update({
      where: { id },
      data: { isActive },
    });
  }

  // ===== Coaching v2: Private Lesson V2 (GC) =====

  async createPrivateLessonV2(data: {
    privateStudentId: string;
    coachId: string;
    studentId: string;
    venueId?: string;
    startTime: Date;
    endTime: Date;
    trainingContent?: string;
  }) {
    return prisma.privateLessonV2.create({
      data: {
        privateStudentId: data.privateStudentId,
        coachId: data.coachId,
        studentId: data.studentId,
        venueId: data.venueId ?? null,
        startTime: data.startTime,
        endTime: data.endTime,
        trainingContent: data.trainingContent ?? null,
        status: 'scheduled',
      },
    });
  }

  async findPrivateLessonV2ById(id: string) {
    return prisma.privateLessonV2.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findPrivateLessonsV2ByPrivateStudentId(
    privateStudentId: string,
    options?: { page?: number; pageSize?: number; status?: string },
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { privateStudentId };
    if (options?.status) {
      where.status = options.status;
    }

    const [items, total] = await Promise.all([
      prisma.privateLessonV2.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { startTime: 'desc' },
      }),
      prisma.privateLessonV2.count({ where }),
    ]);

    return { items, total };
  }

  async updatePrivateLessonV2(
    id: string,
    data: {
      venueId?: string;
      startTime?: Date;
      endTime?: Date;
      trainingContent?: string;
    },
  ) {
    return prisma.privateLessonV2.update({
      where: { id },
      data,
    });
  }

  async updatePrivateLessonV2Status(id: string, status: string) {
    return prisma.privateLessonV2.update({
      where: { id },
      data: { status },
    });
  }

  async updatePrivateLessonV2TrainingContent(id: string, content: string) {
    return prisma.privateLessonV2.update({
      where: { id },
      data: { trainingContent: content },
    });
  }

  async findScheduledPrivateLessonsV2ToStart(now: Date) {
    return prisma.privateLessonV2.findMany({
      where: {
        status: 'scheduled',
        startTime: { lte: now },
      },
    });
  }

  async findInProgressPrivateLessonsV2ToEnd(now: Date) {
    return prisma.privateLessonV2.findMany({
      where: {
        status: 'in_progress',
        endTime: { lte: now },
      },
    });
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
    privateStudentId?: string;
    content: string;
  }) {
    return prisma.studentNote.create({
      data: {
        coachId: data.coachId,
        studentId: data.studentId,
        studentClassId: data.studentClassId ?? null,
        privateStudentId: data.privateStudentId ?? null,
        content: data.content,
      },
    });
  }

  async findStudentNotes(query: {
    coachId: string;
    studentId: string;
    studentClassId?: string;
    privateStudentId?: string;
  }) {
    const where: Record<string, unknown> = {
      coachId: query.coachId,
      studentId: query.studentId,
    };
    if (query.studentClassId) {
      where.studentClassId = query.studentClassId;
    }
    if (query.privateStudentId) {
      where.privateStudentId = query.privateStudentId;
    }

    return prisma.studentNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async setStudentTags(
    coachId: string,
    studentId: string,
    contextId: string | null,
    contextType: 'studentClass' | 'privateStudent',
    tags: string[],
  ) {
    const contextField = contextType === 'studentClass' ? 'studentClassId' : 'privateStudentId';

    // Delete existing tags for this context
    const deleteWhere: Record<string, unknown> = {
      coachId,
      studentId,
      [contextField]: contextId,
    };

    await prisma.studentTag.deleteMany({ where: deleteWhere });

    // Create new tags
    if (tags.length === 0) return [];

    const createData = tags.map((tag) => ({
      coachId,
      studentId,
      [contextField]: contextId,
      tag,
    }));

    await prisma.studentTag.createMany({ data: createData });

    // Return the created tags
    return prisma.studentTag.findMany({
      where: deleteWhere,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findStudentTags(query: {
    coachId: string;
    studentId: string;
    studentClassId?: string;
    privateStudentId?: string;
  }) {
    const where: Record<string, unknown> = {
      coachId: query.coachId,
      studentId: query.studentId,
    };
    if (query.studentClassId) {
      where.studentClassId = query.studentClassId;
    }
    if (query.privateStudentId) {
      where.privateStudentId = query.privateStudentId;
    }

    return prisma.studentTag.findMany({
      where,
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

  // ===== Coaching v2: GC repository aliases (contract-test-compatible names) =====

  async createPrivateStudent(data: { coachId: string; studentId: string }) {
    return this.addPrivateStudent(data);
  }

  async reactivatePrivateStudent(id: string) {
    return this.updatePrivateStudentActive(id, true);
  }

  async deactivatePrivateStudent(id: string) {
    return this.updatePrivateStudentActive(id, false);
  }

  async findPrivateStudentsByCoach(coachId: string, options?: { includeInactive?: boolean }) {
    return this.findPrivateStudentsByCoachId(coachId, options?.includeInactive);
  }

  async findPrivateLessonsV2ByStudent(
    privateStudentId: string,
    options?: { page?: number; pageSize?: number; status?: string },
  ) {
    const result = await this.findPrivateLessonsV2ByPrivateStudentId(privateStudentId, options);
    return result.items;
  }

  async cancelPrivateLessonV2(id: string) {
    return this.updatePrivateLessonV2Status(id, 'cancelled');
  }

  // ===== Coaching v2: Batch status transitions (contract-test-compatible names) =====

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

  async updatePrivateLessonsV2Started(now: Date): Promise<number> {
    const lessons = await this.findScheduledPrivateLessonsV2ToStart(now);
    for (const l of lessons) {
      await this.updatePrivateLessonV2Status(l.id, 'in_progress');
    }
    return lessons.length;
  }

  async updatePrivateLessonsV2Completed(now: Date): Promise<number> {
    const lessons = await this.findInProgressPrivateLessonsV2ToEnd(now);
    for (const l of lessons) {
      await this.updatePrivateLessonV2Status(l.id, 'completed');
    }
    return lessons.length;
  }

  // ===== Coaching v2: Raw finders (for cross-module service calls) =====

  async findClassLessonByIdRaw(id: string) {
    return prisma.classLesson.findUnique({
      where: { id },
    });
  }

  async findPrivateLessonV2ByIdRaw(id: string) {
    return prisma.privateLessonV2.findUnique({
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

  // ===== Coaching v2: Additional GB/GC aliases for contract tests =====

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

  async findPrivateCoachesByStudent(studentId: string) {
    return prisma.privateStudent.findMany({
      where: { studentId, isActive: true },
    });
  }

  async findLessonsByStudent(studentId: string) {
    const [classLessons, privateLessons] = await Promise.all([
      prisma.classLesson.findMany({
        where: {
          studentClass: {
            members: { some: { studentId } },
          },
        },
        orderBy: { startTime: 'desc' },
      }),
      prisma.privateLessonV2.findMany({
        where: { studentId },
        orderBy: { startTime: 'desc' },
      }),
    ]);
    return { classLessons, privateLessons };
  }
}
