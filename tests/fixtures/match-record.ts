import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a guest player in the database for testing.
 * Returns the created guest player record.
 */
export async function createTestGuestPlayer(
  overrides: Partial<{
    nickname: string;
  }> = {},
) {
  const defaults = {
    nickname: `临时球友${String(Math.floor(1000 + Math.random() * 9000))}`,
  };

  return prisma.guestPlayer.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Create a match record in the database for testing.
 * Requires a valid recordedBy userId (create user first).
 * Does NOT auto-create players or games — use createTestMatchPlayer / createTestMatchGame.
 * Returns the created match record.
 */
export async function createTestMatchRecord(
  overrides: Partial<{
    sourceType: string;
    sourceId: string;
    matchType: string;
    recordedBy: string;
  }> & { recordedBy: string; sourceId: string },
) {
  const defaults = {
    sourceType: 'activity',
    matchType: 'singles',
  };

  return prisma.matchRecord.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Create a match player in the database for testing.
 * Requires a valid matchRecordId and either userId or guestId.
 * Returns the created match player record.
 */
export async function createTestMatchPlayer(overrides: {
  matchRecordId: string;
  side: string;
  userId?: string | null;
  guestId?: string | null;
}) {
  return prisma.matchPlayer.create({
    data: {
      matchRecordId: overrides.matchRecordId,
      side: overrides.side,
      userId: overrides.userId ?? null,
      guestId: overrides.guestId ?? null,
    },
  });
}

/**
 * Create a match game in the database for testing.
 * Requires a valid matchRecordId.
 * Returns the created match game record.
 */
export async function createTestMatchGame(overrides: {
  matchRecordId: string;
  gameNumber: number;
  scoreA: number;
  scoreB: number;
}) {
  return prisma.matchGame.create({
    data: {
      matchRecordId: overrides.matchRecordId,
      gameNumber: overrides.gameNumber,
      scoreA: overrides.scoreA,
      scoreB: overrides.scoreB,
    },
  });
}

/**
 * Create a complete match record (with players and games) in one call.
 * Returns the created match record with included players and games.
 */
export async function createTestFullMatchRecord(params: {
  recordedBy: string;
  sourceType?: string;
  sourceId: string;
  matchType?: string;
  players: Array<{
    side: string;
    userId?: string | null;
    guestId?: string | null;
  }>;
  games: Array<{
    gameNumber: number;
    scoreA: number;
    scoreB: number;
  }>;
}) {
  return prisma.matchRecord.create({
    data: {
      sourceType: params.sourceType ?? 'activity',
      sourceId: params.sourceId,
      matchType: params.matchType ?? 'singles',
      recordedBy: params.recordedBy,
      players: {
        create: params.players.map((p) => ({
          side: p.side,
          userId: p.userId ?? null,
          guestId: p.guestId ?? null,
        })),
      },
      games: {
        create: params.games.map((g) => ({
          gameNumber: g.gameNumber,
          scoreA: g.scoreA,
          scoreB: g.scoreB,
        })),
      },
    },
    include: {
      players: {
        include: { guest: true },
      },
      games: {
        orderBy: { gameNumber: 'asc' },
      },
    },
  });
}

/**
 * Clean up all match-record-related test data.
 * Call this in afterEach/afterAll to ensure test isolation.
 * Must be called BEFORE cleaning up users (due to FK constraints).
 */
export async function cleanupMatchRecordTestData() {
  await prisma.matchGame.deleteMany();
  await prisma.matchPlayer.deleteMany();
  await prisma.matchRecord.deleteMany();
  await prisma.guestPlayer.deleteMany();
}

/**
 * Get the test Prisma client instance (for direct queries in assertions).
 */
export function getTestPrisma() {
  return prisma;
}
