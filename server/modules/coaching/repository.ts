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

    const created = await Promise.all(
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
            venue: l.venue
              ? { id: l.venue.id, name: l.venue.name }
              : null,
          },
        });
      }
    }

    // Sort by startTime descending
    items.sort((a, b) => {
      const aTime = a.groupClass?.startTime ?? a.privateLesson?.startTime ?? new Date(0);
      const bTime = b.groupClass?.startTime ?? b.privateLesson?.startTime ?? new Date(0);
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
   * Get participant user IDs for group classes.
   * When called with a coachId: returns all unique student userIds enrolled in this coach's classes
   *   (used by calculateStudentCount).
   * When called with a groupClassId: returns the coach + all enrolled student userIds
   *   (used by getParticipantIds cross-module method).
   * Prisma will try both interpretations via OR query.
   */
  async getGroupClassParticipantIds(id: string): Promise<string[]> {
    // First try as a groupClassId (exact match on GroupClass.id)
    const groupClass = await prisma.groupClass.findUnique({
      where: { id },
      select: { coachId: true, enrollments: { select: { userId: true } } },
    });

    if (groupClass) {
      // id is a groupClassId — return coach + enrolled students
      const studentIds = groupClass.enrollments.map((e) => e.userId);
      return [...new Set([groupClass.coachId, ...studentIds])];
    }

    // Otherwise treat as coachId — return all unique students across coach's classes
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
   * Get participant user IDs for private lessons.
   * When called with a coachId: returns all unique studentIds of this coach's non-cancelled lessons
   *   (used by calculateStudentCount).
   * When called with a privateLessonId: returns [coachId, studentId]
   *   (used by getParticipantIds cross-module method).
   */
  async getPrivateLessonParticipantIds(id: string): Promise<string[]> {
    // First try as a privateLessonId (exact match on PrivateLesson.id)
    const lesson = await prisma.privateLesson.findUnique({
      where: { id },
      select: { coachId: true, studentId: true },
    });

    if (lesson) {
      return [lesson.coachId, lesson.studentId];
    }

    // Otherwise treat as coachId — return all unique students
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
}
