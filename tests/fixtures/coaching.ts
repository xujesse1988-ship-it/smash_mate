import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a coach profile in the database for testing.
 * Requires a valid userId (create a user with isCoach=true first).
 * Returns the created coach profile record.
 */
export async function createTestCoachProfile(
  overrides: Partial<{
    userId: string;
    bio: string | null;
    specialties: string[];
  }> & { userId: string },
) {
  const defaults = {
    bio: null as string | null,
    specialties: [] as string[],
  };

  return prisma.coachProfile.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Create a group class in the database for testing.
 * Requires a valid coachId (create a user with isCoach=true first).
 * Returns the created group class record.
 */
export async function createTestGroupClass(
  overrides: Partial<{
    coachId: string;
    venueId: string | null;
    title: string;
    startTime: Date;
    endTime: Date;
    maxParticipants: number;
    feeDescription: string | null;
    status: string;
  }> & { coachId: string },
) {
  const defaults = {
    venueId: null as string | null,
    title: '测试团课',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000), // tomorrow + 2h
    maxParticipants: 10,
    feeDescription: null as string | null,
    status: 'open',
  };

  return prisma.groupClass.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Add an enrollment to a group class.
 * Returns the created enrollment record.
 */
export async function addTestEnrollment(groupClassId: string, userId: string) {
  return prisma.groupClassEnrollment.create({
    data: {
      groupClassId,
      userId,
    },
  });
}

/**
 * Get enrollment count for a group class.
 */
export async function getEnrollmentCount(groupClassId: string): Promise<number> {
  return prisma.groupClassEnrollment.count({
    where: { groupClassId },
  });
}

/**
 * Create a private lesson (unified schema) playing the role of an "open slot".
 * In the unified model, a slot is just a PrivateLesson with studentId=null, source=null.
 * This helper keeps the old export name so legacy tests still compile; sub-task 2
 * will migrate call sites to use the new API directly.
 */
export async function createTestPrivateLessonSlot(
  overrides: Partial<{
    coachId: string;
    startTime: Date;
    endTime: Date;
    venueIds: string[];
    feeDescription: string | null;
    isBooked: boolean;
  }> & { coachId: string },
) {
  const defaults = {
    startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
    venueIds: [] as string[],
    feeDescription: null as string | null,
  };

  const merged = { ...defaults, ...overrides };
  const lesson = await prisma.privateLesson.create({
    data: {
      coachId: merged.coachId,
      startTime: merged.startTime,
      endTime: merged.endTime,
      venueIds: merged.venueIds,
      feeDescription: merged.feeDescription,
      studentId: null,
      source: null,
      status: 'scheduled',
    },
  });
  // Emulate the old shape so legacy assertions on `isBooked` do not crash at compile time
  return { ...lesson, isBooked: overrides.isBooked ?? false };
}

/**
 * Create a private lesson in the database for testing.
 * In the unified schema slotId has been removed; this helper keeps the old
 * parameter for backward compatibility but ignores it.
 */
export async function createTestPrivateLesson(
  overrides: Partial<{
    slotId: string;
    coachId: string;
    studentId: string;
    venueId: string | null;
    startTime: Date;
    endTime: Date;
    status: string;
  }> & { slotId?: string; coachId: string; studentId: string },
) {
  const defaults = {
    venueId: null as string | null,
    startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
    status: 'scheduled',
  };
  const { slotId: _slotId, ...rest } = { ...defaults, ...overrides };
  void _slotId;

  return prisma.privateLesson.create({
    data: {
      coachId: rest.coachId,
      studentId: rest.studentId,
      venueId: rest.venueId ?? null,
      startTime: rest.startTime,
      endTime: rest.endTime,
      status: rest.status,
      source: 'booked',
    },
  });
}

/**
 * Clean up all coaching-related test data.
 * Call this in afterEach/afterAll to ensure test isolation.
 */
export async function cleanupCoachingTestData() {
  await prisma.groupClassEnrollment.deleteMany();
  await prisma.privateLesson.deleteMany();
  await prisma.groupClass.deleteMany();
  await prisma.coachProfile.deleteMany();
}

/**
 * Get the test Prisma client instance (for direct queries in assertions).
 */
export function getTestPrisma() {
  return prisma;
}
