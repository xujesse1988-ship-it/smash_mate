import { PrismaClient } from '@prisma/client';

/**
 * E2E seed script: populates the test database with the minimum data
 * needed for E2E tests to run (cities, venues, and an admin user).
 *
 * Regular users are NOT pre-created here -- E2E tests register
 * their own users through the UI.
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx tests/e2e/seed-e2e.ts
 */

const E2E_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://smashmate:smashmate_test@localhost:5433/smashmate_test?schema=public';

const prisma = new PrismaClient({
  datasources: { db: { url: E2E_DATABASE_URL } },
});

async function seed() {
  // 1. Create city: Beijing
  const beijing = await prisma.city.upsert({
    where: { name: '北京' },
    update: {},
    create: { name: '北京' },
  });

  // 2. Create venues (at least 3)
  const venues = [
    {
      name: '朝阳羽毛球馆',
      address: '北京市朝阳区工体北路8号',
      latitude: 39.9334,
      longitude: 116.4551,
      cityId: beijing.id,
      mapPoiId: 'e2e-venue-chaoyang-001',
    },
    {
      name: '海淀体育中心羽毛球馆',
      address: '北京市海淀区颐和园路12号',
      latitude: 39.9888,
      longitude: 116.3061,
      cityId: beijing.id,
      mapPoiId: 'e2e-venue-haidian-002',
    },
    {
      name: '丰台羽毛球馆',
      address: '北京市丰台区丰台体育中心',
      latitude: 39.8585,
      longitude: 116.2869,
      cityId: beijing.id,
      mapPoiId: 'e2e-venue-fengtai-003',
    },
  ];

  for (const venue of venues) {
    await prisma.venue.upsert({
      where: { mapPoiId: venue.mapPoiId },
      update: {
        name: venue.name,
        address: venue.address,
        latitude: venue.latitude,
        longitude: venue.longitude,
        cityId: venue.cityId,
      },
      create: venue,
    });
  }

  // 3. Create admin user (phone must match ADMIN_PHONES env var)
  const adminPhone = '13900000000';
  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {},
    create: {
      phone: adminPhone,
      nickname: '管理员',
      isCoach: false,
    },
  });

  console.log(`E2E seed completed: 1 city, ${venues.length} venues, 1 admin user`);
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('E2E seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
