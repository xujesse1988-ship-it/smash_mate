import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/database.js';

type PrismaTransactionClient = Prisma.TransactionClient;

export interface CreateMatchRecordData {
  sourceType: string;
  sourceId: string;
  matchType: string;
  recordedBy: string;
  players: Array<{
    side: string;
    userId: string | null;
    guestId: string | null;
  }>;
  games: Array<{
    gameNumber: number;
    scoreA: number;
    scoreB: number;
  }>;
}

const matchRecordInclude = {
  players: {
    include: {
      guest: true,
    },
  },
  games: {
    orderBy: { gameNumber: 'asc' as const },
  },
};

export class MatchRecordRepository {
  private db: PrismaTransactionClient;

  constructor(db?: PrismaTransactionClient) {
    this.db = db ?? prisma;
  }

  /**
   * Execute a callback with a transactional version of this repository.
   * All repo operations within the callback share the same DB transaction.
   */
  async transaction<T>(fn: (txRepo: MatchRecordRepository) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      const txRepo = new MatchRecordRepository(tx);
      return fn(txRepo);
    });
  }

  async create(data: CreateMatchRecordData) {
    const record = await this.db.matchRecord.create({
      data: {
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        matchType: data.matchType,
        recordedBy: data.recordedBy,
        players: {
          create: data.players.map((p) => ({
            side: p.side,
            userId: p.userId,
            guestId: p.guestId,
          })),
        },
        games: {
          create: data.games.map((g) => ({
            gameNumber: g.gameNumber,
            scoreA: g.scoreA,
            scoreB: g.scoreB,
          })),
        },
      },
      include: matchRecordInclude,
    });

    return record;
  }

  async findById(id: string) {
    return prisma.matchRecord.findUnique({
      where: { id },
      include: matchRecordInclude,
    });
  }

  async deleteById(id: string) {
    await prisma.matchRecord.delete({
      where: { id },
    });
  }

  async findBySource(sourceType: string, sourceId: string, _query: Record<string, unknown>) {
    return prisma.matchRecord.findMany({
      where: {
        sourceType,
        sourceId,
      },
      include: matchRecordInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(
    userId: string,
    query: {
      page: number;
      pageSize: number;
      sourceType?: string;
    },
  ) {
    const where: Record<string, unknown> = {
      players: {
        some: {
          userId,
        },
      },
    };

    if (query.sourceType) {
      where.sourceType = query.sourceType;
    }

    const [items, total] = await Promise.all([
      prisma.matchRecord.findMany({
        where,
        include: matchRecordInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.matchRecord.count({ where }),
    ]);

    return { items, total };
  }

  async getUserMatchStats(userId: string) {
    // Use SQL aggregation to compute stats in the database layer (§6.3, §7 performance constraint).
    // The query:
    // 1. JOINs MatchPlayer with MatchGame to get per-match game-level wins for each side
    // 2. Determines match result (A_WIN / B_WIN / DRAW) by comparing side wins
    // 3. Maps match result + user side to user result (WIN / LOSE / DRAW)
    // 4. Aggregates counts of wins, losses, draws
    const result = await prisma.$queryRaw<
      Array<{ wins: bigint; losses: bigint; draws: bigint }>
    >`
      WITH match_results AS (
        SELECT
          mp.side,
          mp."matchRecordId",
          SUM(CASE WHEN mg."scoreA" > mg."scoreB" THEN 1 ELSE 0 END) AS wins_a,
          SUM(CASE WHEN mg."scoreB" > mg."scoreA" THEN 1 ELSE 0 END) AS wins_b
        FROM "MatchPlayer" mp
        JOIN "MatchGame" mg ON mg."matchRecordId" = mp."matchRecordId"
        WHERE mp."userId" = ${userId}
        GROUP BY mp."matchRecordId", mp.side
      ),
      user_results AS (
        SELECT
          CASE
            WHEN wins_a > wins_b AND side = 'A' THEN 'WIN'
            WHEN wins_b > wins_a AND side = 'B' THEN 'WIN'
            WHEN wins_a = wins_b THEN 'DRAW'
            ELSE 'LOSE'
          END AS user_result
        FROM match_results
      )
      SELECT
        COALESCE(SUM(CASE WHEN user_result = 'WIN' THEN 1 ELSE 0 END), 0) AS wins,
        COALESCE(SUM(CASE WHEN user_result = 'LOSE' THEN 1 ELSE 0 END), 0) AS losses,
        COALESCE(SUM(CASE WHEN user_result = 'DRAW' THEN 1 ELSE 0 END), 0) AS draws
      FROM user_results
    `;

    const row = result[0] ?? { wins: BigInt(0), losses: BigInt(0), draws: BigInt(0) };
    const wins = Number(row.wins);
    const losses = Number(row.losses);
    const draws = Number(row.draws);

    return {
      totalMatches: wins + losses + draws,
      wins,
      losses,
      draws,
    };
  }

  async createGuestPlayer(nickname: string) {
    return this.db.guestPlayer.create({
      data: { nickname },
    });
  }
}
