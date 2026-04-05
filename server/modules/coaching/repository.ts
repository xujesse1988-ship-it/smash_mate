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
      await tx.groupClassEnrollment.create({
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

  async createPrivateLessonSlot(_data: unknown) {
    throw new Error('Not implemented');
  }

  async findAvailability(_coachId: string) {
    throw new Error('Not implemented');
  }

  async bookPrivateLesson(_data: unknown) {
    throw new Error('Not implemented');
  }

  async cancelPrivateLesson(_id: string) {
    throw new Error('Not implemented');
  }

  async findPrivateLessonById(id: string) {
    return prisma.privateLesson.findUnique({
      where: { id },
    });
  }

  async findUserEnrollments(_userId: string, _query: unknown) {
    throw new Error('Not implemented');
  }

  async findCoachPrivateLessons(_coachId: string, _query: unknown) {
    throw new Error('Not implemented');
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

  // Note: These methods query by coachId (all group classes/private lessons for this coach),
  // used by calculateStudentCount for single-coach scenarios.
  async getGroupClassParticipantIds(coachId: string): Promise<string[]> {
    const enrollments = await prisma.groupClassEnrollment.findMany({
      where: {
        groupClass: {
          coachId,
        },
      },
      select: { userId: true },
    });
    return [...new Set(enrollments.map((e) => e.userId))];
  }

  async getPrivateLessonParticipantIds(coachId: string): Promise<string[]> {
    // Design doc §6.8: exclude cancelled private lessons from studentCount
    const lessons = await prisma.privateLesson.findMany({
      where: { coachId, status: { not: 'cancelled' } },
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
