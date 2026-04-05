import { AppError } from '../../infra/error-handler.js';
import { createModuleLogger } from '../../infra/logger.js';
import { MatchRecordRepository } from './repository.js';
import type {
  CreateMatchRecordInput,
  MatchRecordListQuery,
  UserMatchRecordQuery,
  SourceType,
  MatchResult,
  UserResult,
} from './types.js';

const logger = createModuleLogger('match-record');

const VALID_SOURCE_TYPES: SourceType[] = ['activity', 'group-class', 'private-lesson'];
const VALID_MATCH_TYPES = ['singles', 'doubles'];

interface ActivityServiceDep {
  getActivityById(id: string): Promise<{
    id: string;
    status: string;
  } | null>;
  getParticipantIds(activityId: string): Promise<string[]>;
}

interface CoachingServiceDep {
  getGroupClassById(id: string): Promise<{
    id: string;
    status: string;
  } | null>;
  getPrivateLessonById(id: string): Promise<{
    id: string;
    status: string;
  } | null>;
  getParticipantIds(classId: string, type: 'group-class' | 'private-lesson'): Promise<string[]>;
}

interface UserServiceDep {
  getUsersByIds(ids: string[]): Promise<
    Array<{
      id: string;
      nickname: string;
      avatarUrl: string | null;
    }>
  >;
}

/**
 * Determine the match result from game scores.
 * §6.1: Count won games per side; majority wins; equal => DRAW.
 */
export function determineMatchResult(
  games: Array<{ scoreA: number; scoreB: number }>,
): MatchResult {
  let winsA = 0;
  let winsB = 0;

  for (const game of games) {
    if (game.scoreA > game.scoreB) winsA++;
    else if (game.scoreB > game.scoreA) winsB++;
    // tied game: not counted
  }

  if (winsA > winsB) return 'A_WIN';
  if (winsB > winsA) return 'B_WIN';
  return 'DRAW';
}

/**
 * Determine a specific user's result in a match.
 * §6.2: Based on matchResult and which side the user is on.
 */
export function determineUserResult(matchResult: MatchResult, userSide: 'A' | 'B'): UserResult {
  if (matchResult === 'DRAW') return 'DRAW';
  if (matchResult === 'A_WIN') return userSide === 'A' ? 'WIN' : 'LOSE';
  // B_WIN
  return userSide === 'B' ? 'WIN' : 'LOSE';
}

export class MatchRecordService {
  private repo: MatchRecordRepository;
  private activityService: ActivityServiceDep;
  private coachingService: CoachingServiceDep;
  private userService: UserServiceDep;

  constructor(
    repo: MatchRecordRepository,
    activityService: ActivityServiceDep,
    coachingService: CoachingServiceDep,
    userService: UserServiceDep,
  ) {
    this.repo = repo;
    this.activityService = activityService;
    this.coachingService = coachingService;
    this.userService = userService;
  }

  // =========================================================================
  // POST /api/match-records — Create match record
  // =========================================================================

  async createMatchRecord(userId: string, input: CreateMatchRecordInput) {
    // 1. Validate sourceType
    if (!VALID_SOURCE_TYPES.includes(input.sourceType)) {
      throw new AppError(400, 'MATCH_RECORD_INVALID_SOURCE_TYPE', '来源类型不合法');
    }

    // 2. Validate matchType
    if (!VALID_MATCH_TYPES.includes(input.matchType)) {
      throw new AppError(400, 'MATCH_RECORD_INVALID_MATCH_TYPE', '比赛类型不合法');
    }

    const { sideA, sideB } = input.players;

    // 3. Validate player count
    const expectedCount = input.matchType === 'singles' ? 1 : 2;
    if (!sideA || !sideB || sideA.length !== expectedCount || sideB.length !== expectedCount) {
      throw new AppError(
        400,
        'MATCH_RECORD_INVALID_PLAYERS',
        `${input.matchType === 'singles' ? '单打' : '双打'}模式每方需要 ${expectedCount} 名选手`,
      );
    }

    // 4. Validate each player
    const allPlayers = [...sideA, ...sideB];
    for (const player of allPlayers) {
      const hasUserId = player.userId !== undefined && player.userId !== null;
      const hasGuestName = player.guestName !== undefined && player.guestName !== null;

      if (hasUserId && hasGuestName) {
        throw new AppError(
          400,
          'MATCH_RECORD_INVALID_PLAYER',
          '选手的 userId 和 guestName 不可同时提供',
        );
      }
      if (!hasUserId && !hasGuestName) {
        throw new AppError(400, 'MATCH_RECORD_INVALID_PLAYER', '选手必须提供 userId 或 guestName');
      }

      if (hasGuestName) {
        if (player.guestName!.trim().length === 0) {
          throw new AppError(400, 'MATCH_RECORD_INVALID_GUEST_NAME', 'guestName 不可为空');
        }
        if (player.guestName!.length > 20) {
          throw new AppError(400, 'MATCH_RECORD_INVALID_GUEST_NAME', 'guestName 不能超过 20 字符');
        }
      }
    }

    // 5. Validate games
    if (!input.games || !Array.isArray(input.games) || input.games.length === 0) {
      throw new AppError(400, 'MATCH_RECORD_INVALID_GAMES', '至少需要一局比分');
    }

    // 6. Validate scores
    for (const game of input.games) {
      if (
        !Number.isInteger(game.scoreA) ||
        !Number.isInteger(game.scoreB) ||
        game.scoreA < 0 ||
        game.scoreA > 30 ||
        game.scoreB < 0 ||
        game.scoreB > 30 ||
        (game.scoreA === 0 && game.scoreB === 0)
      ) {
        throw new AppError(400, 'MATCH_RECORD_INVALID_SCORE', '比分不合法');
      }
    }

    // 7. Check duplicate players (same userId on both sides)
    const userIds = allPlayers.filter((p) => p.userId).map((p) => p.userId!);
    const uniqueUserIds = new Set(userIds);
    if (uniqueUserIds.size !== userIds.length) {
      throw new AppError(400, 'MATCH_RECORD_DUPLICATE_PLAYER', '同一选手不可出现在两侧');
    }

    // 8. Verify source exists and is completed (§6.4 steps 1-3)
    await this.verifySource(input.sourceType, input.sourceId);

    // 9. Get participant IDs (§6.4 step 4)
    const participantIds = await this.getSourceParticipantIds(input.sourceType, input.sourceId);

    // 10. Verify recorder is participant (§6.4 step 5)
    if (!participantIds.includes(userId)) {
      throw new AppError(403, 'MATCH_RECORD_NOT_PARTICIPANT', '录入者不是该活动/课程的参与者');
    }

    // 11. Verify all userId players are participants (§6.4 step 6)
    for (const player of allPlayers) {
      if (player.userId && !participantIds.includes(player.userId)) {
        throw new AppError(
          403,
          'MATCH_RECORD_PLAYER_NOT_PARTICIPANT',
          '指定的平台用户选手不是该活动/课程的参与者',
        );
      }
    }

    // 12. Create GuestPlayers for guestName entries (§6.5)
    const guestNicknameMap = new Map<string, string>();
    const playerDataA = await this.resolvePlayerData('A', sideA, guestNicknameMap);
    const playerDataB = await this.resolvePlayerData('B', sideB, guestNicknameMap);
    const playerData = [...playerDataA, ...playerDataB];

    // 13. Build game data with auto-assigned gameNumbers
    const gameData = input.games.map((g, index) => ({
      gameNumber: index + 1,
      scoreA: g.scoreA,
      scoreB: g.scoreB,
    }));

    // 14. Create match record
    const record = await this.repo.create({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      matchType: input.matchType,
      recordedBy: userId,
      players: playerData,
      games: gameData,
    });

    logger.info(
      {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        matchType: input.matchType,
        recordedBy: userId.slice(0, 8),
      },
      '战绩已录入',
    );

    // 15. Format response with user info
    return this.formatMatchRecordResponse(record, guestNicknameMap);
  }

  // =========================================================================
  // DELETE /api/match-records/:id — Delete match record
  // =========================================================================

  async deleteMatchRecord(recordId: string, userId: string) {
    const record = await this.repo.findById(recordId);
    if (!record) {
      throw new AppError(404, 'MATCH_RECORD_NOT_FOUND', '战绩记录不存在');
    }

    if (record.recordedBy !== userId) {
      throw new AppError(403, 'MATCH_RECORD_NOT_RECORDER', '非录入者不可删除');
    }

    await this.repo.deleteById(recordId);

    logger.info({ matchRecordId: recordId, recordedBy: userId.slice(0, 8) }, '战绩已删除');

    return { id: recordId };
  }

  // =========================================================================
  // GET /api/activities/:id/match-records etc. — Source match records list
  // =========================================================================

  async getSourceMatchRecords(sourceType: string, sourceId: string, query: MatchRecordListQuery) {
    const records = await this.repo.findBySource(sourceType, sourceId, query);

    const formattedRecords = await this.formatMatchRecordsWithUserInfo(records);

    return { items: formattedRecords };
  }

  // =========================================================================
  // GET /api/users/:id/match-records — User match records
  // =========================================================================

  async getUserMatchRecords(userId: string, query: UserMatchRecordQuery) {
    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;

    const result = await this.repo.findByUser(userId, {
      page,
      pageSize,
      sourceType: query.sourceType,
    });

    const formattedRecords = await this.formatMatchRecordsWithUserInfo(result.items, userId);

    return {
      items: formattedRecords,
      total: result.total,
      page,
      pageSize,
    };
  }

  // =========================================================================
  // GET /api/users/:id/match-stats — User match stats
  // =========================================================================

  async getUserMatchStats(userId: string) {
    const stats = await this.repo.getUserMatchStats(userId);

    const { wins, losses } = stats;
    const denominator = wins + losses;
    const winRate = denominator > 0 ? Math.round((wins / denominator) * 1000) / 10 : 0;

    return {
      ...stats,
      winRate,
    };
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private async verifySource(sourceType: SourceType, sourceId: string) {
    let source: { id: string; status: string } | null = null;

    if (sourceType === 'activity') {
      source = await this.activityService.getActivityById(sourceId);
    } else if (sourceType === 'group-class') {
      source = await this.coachingService.getGroupClassById(sourceId);
    } else if (sourceType === 'private-lesson') {
      source = await this.coachingService.getPrivateLessonById(sourceId);
    }

    if (!source) {
      throw new AppError(404, 'MATCH_RECORD_SOURCE_NOT_FOUND', '来源活动/课程不存在');
    }

    if (source.status !== 'completed') {
      throw new AppError(409, 'MATCH_RECORD_SOURCE_NOT_COMPLETED', '来源活动/课程尚未结束');
    }
  }

  private async getSourceParticipantIds(
    sourceType: SourceType,
    sourceId: string,
  ): Promise<string[]> {
    if (sourceType === 'activity') {
      return this.activityService.getParticipantIds(sourceId);
    } else if (sourceType === 'group-class') {
      return this.coachingService.getParticipantIds(sourceId, 'group-class');
    } else {
      return this.coachingService.getParticipantIds(sourceId, 'private-lesson');
    }
  }

  private async resolvePlayerData(
    side: 'A' | 'B',
    players: Array<{ userId?: string; guestName?: string }>,
    guestNicknameMap: Map<string, string>,
  ) {
    const resolved: Array<{
      side: string;
      userId: string | null;
      guestId: string | null;
    }> = [];

    for (const player of players) {
      if (player.userId) {
        resolved.push({
          side,
          userId: player.userId,
          guestId: null,
        });
      } else if (player.guestName) {
        const guest = await this.repo.createGuestPlayer(player.guestName);
        guestNicknameMap.set(guest.id, guest.nickname);
        resolved.push({
          side,
          userId: null,
          guestId: guest.id,
        });
      }
    }

    return resolved;
  }

  private async formatMatchRecordResponse(
    record: {
      id: string;
      sourceType: string;
      sourceId: string;
      matchType: string;
      recordedBy: string;
      createdAt: Date;
      players: Array<{
        id: string;
        matchRecordId: string;
        side: string;
        userId: string | null;
        guestId: string | null;
        guest?: { id: string; nickname: string; createdAt: Date } | null;
      }>;
      games: Array<{
        id: string;
        matchRecordId: string;
        gameNumber: number;
        scoreA: number;
        scoreB: number;
      }>;
    },
    guestNicknameMap?: Map<string, string>,
  ) {
    // Get all user IDs (players + recorder)
    const userIds = record.players.filter((p) => p.userId).map((p) => p.userId!);
    if (!userIds.includes(record.recordedBy)) {
      userIds.push(record.recordedBy);
    }

    const users = await this.userService.getUsersByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    const result = determineMatchResult(record.games);

    const recorder = userMap.get(record.recordedBy);

    return {
      id: record.id,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      matchType: record.matchType,
      recordedBy: record.recordedBy,
      recorder: {
        id: record.recordedBy,
        nickname: recorder?.nickname ?? '未知用户',
        avatarUrl: recorder?.avatarUrl ?? null,
      },
      players: this.formatPlayers(record.players, userMap, guestNicknameMap),
      games: record.games.map((g) => ({
        gameNumber: g.gameNumber,
        scoreA: g.scoreA,
        scoreB: g.scoreB,
      })),
      result,
      createdAt: record.createdAt,
    };
  }

  private async formatMatchRecordsWithUserInfo(
    records: Array<{
      id: string;
      sourceType: string;
      sourceId: string;
      matchType: string;
      recordedBy: string;
      createdAt: Date;
      players: Array<{
        id: string;
        matchRecordId: string;
        side: string;
        userId: string | null;
        guestId: string | null;
        guest?: { id: string; nickname: string; createdAt: Date } | null;
      }>;
      games: Array<{
        id: string;
        matchRecordId: string;
        gameNumber: number;
        scoreA: number;
        scoreB: number;
      }>;
    }>,
    targetUserId?: string,
  ) {
    if (records.length === 0) return [];

    // Collect all user IDs
    const allUserIds = new Set<string>();
    for (const record of records) {
      allUserIds.add(record.recordedBy);
      for (const player of record.players) {
        if (player.userId) allUserIds.add(player.userId);
      }
    }

    const users = await this.userService.getUsersByIds([...allUserIds]);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return records.map((record) => {
      const result = determineMatchResult(record.games);
      const recorder = userMap.get(record.recordedBy);

      const formatted: Record<string, unknown> = {
        id: record.id,
        sourceType: record.sourceType,
        sourceId: record.sourceId,
        matchType: record.matchType,
        recordedBy: record.recordedBy,
        recorder: {
          id: record.recordedBy,
          nickname: recorder?.nickname ?? '未知用户',
          avatarUrl: recorder?.avatarUrl ?? null,
        },
        players: this.formatPlayers(record.players, userMap),
        games: record.games.map((g) => ({
          gameNumber: g.gameNumber,
          scoreA: g.scoreA,
          scoreB: g.scoreB,
        })),
        result,
        createdAt: record.createdAt,
      };

      // Add userResult for user match history
      if (targetUserId) {
        const userPlayer = record.players.find((p) => p.userId === targetUserId);
        if (userPlayer) {
          formatted.userResult = determineUserResult(result, userPlayer.side as 'A' | 'B');
        }
      }

      return formatted;
    });
  }

  private formatPlayers(
    players: Array<{
      side: string;
      userId: string | null;
      guestId: string | null;
      guest?: { id: string; nickname: string; createdAt: Date } | null;
    }>,
    userMap: Map<string, { id: string; nickname: string; avatarUrl: string | null }>,
    guestNicknameMap?: Map<string, string>,
  ) {
    const sideA = players
      .filter((p) => p.side === 'A')
      .map((p) => this.formatPlayer(p, userMap, guestNicknameMap));
    const sideB = players
      .filter((p) => p.side === 'B')
      .map((p) => this.formatPlayer(p, userMap, guestNicknameMap));

    return { sideA, sideB };
  }

  private formatPlayer(
    player: {
      userId: string | null;
      guestId: string | null;
      guest?: { id: string; nickname: string; createdAt: Date } | null;
    },
    userMap: Map<string, { id: string; nickname: string; avatarUrl: string | null }>,
    guestNicknameMap?: Map<string, string>,
  ) {
    if (player.userId) {
      const user = userMap.get(player.userId);
      return {
        userId: player.userId,
        nickname: user?.nickname ?? '未知用户',
        avatarUrl: user?.avatarUrl ?? null,
      };
    }

    // Use guestNicknameMap (from createMatchRecord flow) or guest relation (from DB query)
    const guestNickname =
      (player.guestId && guestNicknameMap?.get(player.guestId)) ||
      player.guest?.nickname ||
      '临时用户';

    return {
      guestId: player.guestId,
      nickname: guestNickname,
    };
  }
}
