import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function resetTestDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Notification",
      "Review",
      "MatchGame",
      "MatchPlayer",
      "MatchRecord",
      "GuestPlayer",
      "PrivateLesson",
      "PrivateLessonSlot",
      "GroupClassEnrollment",
      "GroupClass",
      "CoachProfile",
      "ActivityParticipant",
      "Activity",
      "Venue",
      "City",
      "VerificationCode",
      "PhoneLock",
      "User"
    RESTART IDENTITY CASCADE;
  `);
}
