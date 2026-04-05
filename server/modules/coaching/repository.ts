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

    const where: Record<string, unknown> = {};
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
    const lessons = await prisma.privateLesson.findMany({
      where: { coachId },
      select: { studentId: true },
    });
    return [...new Set(lessons.map((l) => l.studentId))];
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
