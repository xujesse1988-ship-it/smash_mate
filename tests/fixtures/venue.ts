import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a city in the database for testing.
 * Returns the created city record.
 */
export async function createTestCity(
  overrides: Partial<{
    name: string;
  }> = {},
) {
  const defaults = {
    name: `测试城市${String(Math.floor(1000 + Math.random() * 9000))}`,
  };

  return prisma.city.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Create a venue in the database for testing.
 * Requires a valid cityId (create a city first).
 * Returns the created venue record.
 */
export async function createTestVenue(
  overrides: Partial<{
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    cityId: string;
    mapPoiId: string;
  }> = {},
) {
  if (!overrides.cityId) {
    throw new Error('createTestVenue requires cityId');
  }

  const defaults = {
    name: `测试羽毛球馆${String(Math.floor(1000 + Math.random() * 9000))}`,
    address: `测试地址${String(Math.floor(1000 + Math.random() * 9000))}`,
    latitude: 39.9 + Math.random() * 0.1,
    longitude: 116.4 + Math.random() * 0.1,
    mapPoiId: `poi-${String(Math.floor(100000 + Math.random() * 900000))}`,
  };

  return prisma.venue.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Clean up all venue-related test data.
 * Call this in afterEach/afterAll to ensure test isolation.
 */
export async function cleanupVenueTestData() {
  await prisma.venue.deleteMany();
  await prisma.city.deleteMany();
}

/**
 * Get the test Prisma client instance (for direct queries in assertions).
 */
export function getTestPrisma() {
  return prisma;
}
