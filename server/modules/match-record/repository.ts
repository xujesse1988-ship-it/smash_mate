import { prisma } from '../../infra/database.js';

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
  async create(data: CreateMatchRecordData) {
    const record = await prisma.matchRecord.create({
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
    // Get all match records for this user with their games and the user's side
    const matchPlayers = await prisma.matchPlayer.findMany({
      where: { userId },
      select: {
        side: true,
        matchRecord: {
          select: {
            games: {
              select: {
                scoreA: true,
                scoreB: true,
              },
            },
          },
        },
      },
    });

    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const mp of matchPlayers) {
      const games = mp.matchRecord.games;
      let winsA = 0;
      let winsB = 0;

      for (const game of games) {
        if (game.scoreA > game.scoreB) winsA++;
        else if (game.scoreB > game.scoreA) winsB++;
      }

      let matchResult: 'A_WIN' | 'B_WIN' | 'DRAW';
      if (winsA > winsB) matchResult = 'A_WIN';
      else if (winsB > winsA) matchResult = 'B_WIN';
      else matchResult = 'DRAW';

      if (matchResult === 'DRAW') {
        draws++;
      } else if (
        (matchResult === 'A_WIN' && mp.side === 'A') ||
        (matchResult === 'B_WIN' && mp.side === 'B')
      ) {
        wins++;
      } else {
        losses++;
      }
    }

    return {
      totalMatches: wins + losses + draws,
      wins,
      losses,
      draws,
    };
  }

  async createGuestPlayer(nickname: string) {
    return prisma.guestPlayer.create({
      data: { nickname },
    });
  }
}
