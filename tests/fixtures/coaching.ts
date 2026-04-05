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
 * Clean up all coaching-related test data.
 * Call this in afterEach/afterAll to ensure test isolation.
 */
export async function cleanupCoachingTestData() {
  await prisma.groupClassEnrollment.deleteMany();
  await prisma.privateLesson.deleteMany();
  await prisma.privateLessonSlot.deleteMany();
  await prisma.groupClass.deleteMany();
  await prisma.coachProfile.deleteMany();
}

/**
 * Get the test Prisma client instance (for direct queries in assertions).
 */
export function getTestPrisma() {
  return prisma;
}
