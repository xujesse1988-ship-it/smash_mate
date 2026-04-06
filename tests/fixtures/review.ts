import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a review in the database for testing.
 * Requires valid reviewerId and coachId (create users first).
 * Returns the created review record.
 */
export async function createTestReview(
  overrides: Partial<{
    reviewerId: string;
    coachId: string;
    courseType: string;
    courseId: string;
    rating: number;
    comment: string | null;
  }> & { reviewerId: string; coachId: string; courseId: string },
) {
  const defaults = {
    courseType: 'group-class',
    rating: 5,
    comment: null as string | null,
  };

  return prisma.review.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Clean up all review-related test data.
 * Call this in afterEach/afterAll to ensure test isolation.
 * Must be called BEFORE cleaning up users (due to FK constraints).
 */
export async function cleanupReviewTestData() {
  await prisma.review.deleteMany();
}

/**
 * Get the test Prisma client instance (for direct queries in assertions).
 */
export function getTestPrisma() {
  return prisma;
}
