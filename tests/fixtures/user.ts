import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a user in the database for testing.
 * Returns the created user record.
 */
export async function createTestUser(
  overrides: Partial<{
    phone: string;
    nickname: string;
    avatarUrl: string | null;
    bio: string | null;
    isCoach: boolean;
  }> = {},
) {
  const defaults = {
    phone: `138${String(Math.floor(10000000 + Math.random() * 90000000))}`,
    nickname: `球友${String(Math.floor(10000 + Math.random() * 90000))}`,
    avatarUrl: null,
    bio: null,
    isCoach: false,
  };

  return prisma.user.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Create a verification code in the database for testing.
 * Returns the created verification code record.
 */
export async function createTestVerificationCode(
  overrides: Partial<{
    phone: string;
    code: string;
    expiresAt: Date;
    used: boolean;
  }> = {},
) {
  const defaults = {
    phone: '13800001234',
    code: String(Math.floor(100000 + Math.random() * 900000)),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    used: false,
  };

  return prisma.verificationCode.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Create a phone lock record in the database for testing.
 * Returns the created phone lock record.
 */
export async function createTestPhoneLock(
  overrides: Partial<{
    phone: string;
    failCount: number;
    lockedUntil: Date | null;
  }> = {},
) {
  const defaults = {
    phone: '13800001234',
    failCount: 0,
    lockedUntil: null,
  };

  return prisma.phoneLock.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Clean up all user-related test data.
 * Call this in afterEach/afterAll to ensure test isolation.
 */
export async function cleanupUserTestData() {
  await prisma.verificationCode.deleteMany();
  await prisma.phoneLock.deleteMany();
  // Delete users that have no foreign key references from other modules
  // For safety, we delete all users (integration tests should not have cross-module data)
  await prisma.user.deleteMany();
}

/**
 * Get the test Prisma client instance (for direct queries in assertions).
 */
export function getTestPrisma() {
  return prisma;
}
