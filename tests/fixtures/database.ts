import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function resetTestDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "OperationLog",
      "Notification",
      "Review",
      "MatchGame",
      "MatchPlayer",
      "MatchRecord",
      "GuestPlayer",
      "LessonNote",
      "StudentNote",
      "StudentTag",
      "ClassLesson",
      "StudentClassMember",
      "StudentClass",
      "CoachStudent",
      "CoachApplication",
      "PrivateLesson",
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
