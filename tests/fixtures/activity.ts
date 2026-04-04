import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create an activity in the database for testing.
 * Requires a valid creatorId and venueId (create user and venue first).
 * Automatically adds the creator as the first participant.
 * Returns the created activity record.
 */
export async function createTestActivity(
  overrides: Partial<{
    creatorId: string;
    venueId: string | null;
    title: string | null;
    startTime: Date;
    endTime: Date;
    maxParticipants: number;
    status: string;
  }> & { creatorId: string; venueId: string },
) {
  const defaults = {
    title: null as string | null,
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000), // tomorrow + 2h
    maxParticipants: 8,
    status: 'open',
  };

  const data = { ...defaults, ...overrides };

  const activity = await prisma.activity.create({
    data: {
      creatorId: data.creatorId,
      venueId: data.venueId,
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      maxParticipants: data.maxParticipants,
      status: data.status,
    },
  });

  // Creator auto-joins as first participant
  await prisma.activityParticipant.create({
    data: {
      activityId: activity.id,
      userId: data.creatorId,
    },
  });

  return activity;
}

/**
 * Add a participant to an activity.
 * Returns the created participant record.
 */
export async function addTestParticipant(activityId: string, userId: string) {
  return prisma.activityParticipant.create({
    data: {
      activityId,
      userId,
    },
  });
}

/**
 * Get participant count for an activity.
 */
export async function getParticipantCount(activityId: string): Promise<number> {
  return prisma.activityParticipant.count({
    where: { activityId },
  });
}

/**
 * Clean up all activity-related test data.
 * Call this in afterEach/afterAll to ensure test isolation.
 */
export async function cleanupActivityTestData() {
  await prisma.activityParticipant.deleteMany();
  await prisma.activity.deleteMany();
}

/**
 * Get the test Prisma client instance (for direct queries in assertions).
 */
export function getTestPrisma() {
  return prisma;
}
