/**
 * 契约测试: match-record 模块 — 战绩列表与统计接口
 * 覆盖接口:
 *   - GET /api/activities/:id/match-records (MatchRecordService.getSourceMatchRecords)
 *   - GET /api/group-classes/:id/match-records (MatchRecordService.getSourceMatchRecords)
 *   - GET /api/private-lessons/:id/match-records (MatchRecordService.getSourceMatchRecords)
 *   - GET /api/users/:id/match-records (MatchRecordService.getUserMatchRecords)
 *   - GET /api/users/:id/match-stats (MatchRecordService.getUserMatchStats)
 *
 * 来源文档: docs/module-design/match-record.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - MatchRecordRepository: 全部 mock（隔离数据库依赖）
 * - UserService: mock getUsersByIds（跨模块依赖）
 * - ActivityService / CoachingService: 本文件涉及的列表/统计接口不依赖这两个服务
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchRecordService } from '@server/modules/match-record/service.js';
import { MatchRecordRepository } from '@server/modules/match-record/repository.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_A_ID = 'user-uuid-aaa-0001';
const USER_B_ID = 'user-uuid-bbb-0002';
const USER_C_ID = 'user-uuid-ccc-0003';
const USER_D_ID = 'user-uuid-ddd-0004';
const RECORDER_ID = 'user-uuid-recorder';
const ACTIVITY_ID = 'activity-uuid-0001';
const GROUP_CLASS_ID = 'group-class-uuid-0001';
const PRIVATE_LESSON_ID = 'private-lesson-uuid-0001';
const MATCH_RECORD_ID_1 = 'match-record-uuid-0001';
const MATCH_RECORD_ID_2 = 'match-record-uuid-0002';
const MATCH_RECORD_ID_3 = 'match-record-uuid-0003';
const GUEST_PLAYER_ID = 'guest-player-uuid-0001';

// ---------------------------------------------------------------------------
// Helpers — Mock factories
// ---------------------------------------------------------------------------

/**
 * Build a mock MatchRecordRepository with all methods stubbed.
 */
function createMockRepository(): {
  [K in keyof MatchRecordRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    deleteById: vi.fn().mockResolvedValue(undefined),
    findBySource: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getUserMatchStats: vi.fn().mockResolvedValue({
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    }),
    createGuestPlayer: vi.fn().mockResolvedValue({
      id: GUEST_PLAYER_ID,
      nickname: '临时球友A',
      createdAt: new Date('2026-04-05T10:00:00.000Z'),
    }),
  };
}

/**
 * Build a mock ActivityService (unused by list/stats but required by constructor).
 */
function createMockActivityService() {
  return {
    getActivityById: vi.fn().mockResolvedValue(null),
    getParticipantIds: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Build a mock CoachingService (unused by list/stats but required by constructor).
 */
function createMockCoachingService() {
  return {
    getGroupClassById: vi.fn().mockResolvedValue(null),
    getPrivateLessonById: vi.fn().mockResolvedValue(null),
    getParticipantIds: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Build a mock UserService with cross-module methods.
 */
function createMockUserService() {
  return {
    getUsersByIds: vi.fn().mockResolvedValue([
      {
        id: USER_A_ID,
        nickname: '张三',
        avatarUrl: 'https://example.com/a.jpg',
      },
      {
        id: USER_B_ID,
        nickname: '李四',
        avatarUrl: null,
      },
      {
        id: USER_C_ID,
        nickname: '王五',
        avatarUrl: 'https://example.com/c.jpg',
      },
      {
        id: USER_D_ID,
        nickname: '赵六',
        avatarUrl: null,
      },
      {
        id: RECORDER_ID,
        nickname: '录入者',
        avatarUrl: 'https://example.com/recorder.jpg',
      },
    ]),
  };
}

// ---------------------------------------------------------------------------
// Helpers — Data factories
// ---------------------------------------------------------------------------

/** Build a standard match record as returned by repository (singles, activity source, A_WIN) */
function createMatchRecordRow(
  overrides?: Partial<{
    id: string;
    sourceType: string;
    sourceId: string;
    matchType: string;
    recordedBy: string;
    createdAt: Date;
    updatedAt: Date;
    players: Array<{
      id: string;
      matchRecordId: string;
      side: string;
      userId: string | null;
      guestId: string | null;
    }>;
    games: Array<{
      id: string;
      matchRecordId: string;
      gameNumber: number;
      scoreA: number;
      scoreB: number;
    }>;
  }>,
) {
  const id = overrides?.id ?? MATCH_RECORD_ID_1;
  return {
    id,
    sourceType: 'activity',
    sourceId: ACTIVITY_ID,
    matchType: 'singles',
    recordedBy: RECORDER_ID,
    createdAt: new Date('2026-04-05T18:30:00.000Z'),
    updatedAt: new Date('2026-04-05T18:30:00.000Z'),
    players: [
      {
        id: 'player-uuid-1',
        matchRecordId: id,
        side: 'A',
        userId: USER_A_ID,
        guestId: null,
      },
      {
        id: 'player-uuid-2',
        matchRecordId: id,
        side: 'B',
        userId: USER_B_ID,
        guestId: null,
      },
    ],
    games: [
      {
        id: 'game-uuid-1',
        matchRecordId: id,
        gameNumber: 1,
        scoreA: 21,
        scoreB: 18,
      },
      {
        id: 'game-uuid-2',
        matchRecordId: id,
        gameNumber: 2,
        scoreA: 21,
        scoreB: 15,
      },
    ],
    ...overrides,
  };
}

// ===========================================================================
// 活动的战绩列表 — GET /api/activities/:id/match-records
// ===========================================================================

describe('MatchRecordService.getSourceMatchRecords (activity)', () => {
  let service: MatchRecordService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    service = new MatchRecordService(
      repo as unknown as MatchRecordRepository,
      createMockActivityService() as any,
      createMockCoachingService() as any,
      userService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 返回 sourceType='activity' 且 sourceId=:id 的所有战绩（§4 活动的战绩列表）
  it('should return match records for the given activity', async () => {
    const records = [
      createMatchRecordRow({ id: MATCH_RECORD_ID_1 }),
      createMatchRecordRow({ id: MATCH_RECORD_ID_2, createdAt: new Date('2026-04-05T17:00:00.000Z') }),
    ];
    repo.findBySource.mockResolvedValue(records);

    const result = await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    expect(result.items).toHaveLength(2);
    expect(repo.findBySource).toHaveBeenCalledWith('activity', ACTIVITY_ID, expect.any(Object));
  });

  // 业务规则: 每条记录包含选手信息（§4 活动的战绩列表 — 平台用户含 nickname、avatarUrl）
  it('should include player info with nickname and avatarUrl for platform users', async () => {
    repo.findBySource.mockResolvedValue([createMatchRecordRow()]);

    const result = await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    expect(result.items).toHaveLength(1);
    const record = result.items[0];
    expect(record.players.sideA[0].userId).toBe(USER_A_ID);
    expect(record.players.sideA[0].nickname).toBeDefined();
    expect(record.players.sideB[0].userId).toBe(USER_B_ID);
    expect(record.players.sideB[0].nickname).toBeDefined();

    // 应调用 UserService.getUsersByIds 批量获取
    expect(userService.getUsersByIds).toHaveBeenCalled();
  });

  // 业务规则: 临时用户包含 guestId 和 nickname（§4 活动的战绩列表 Response）
  it('should include guestId and nickname for guest players', async () => {
    repo.findBySource.mockResolvedValue([
      createMatchRecordRow({
        players: [
          { id: 'p1', matchRecordId: MATCH_RECORD_ID_1, side: 'A', userId: USER_A_ID, guestId: null },
          { id: 'p2', matchRecordId: MATCH_RECORD_ID_1, side: 'B', userId: null, guestId: GUEST_PLAYER_ID },
        ],
      }),
    ]);

    const result = await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    expect(result.items[0].players.sideB[0].guestId).toBe(GUEST_PLAYER_ID);
    expect(result.items[0].players.sideB[0].nickname).toBeDefined();
  });

  // 业务规则: 每条记录包含每局比分（§4 活动的战绩列表 Response）
  it('should include games with gameNumber and scores', async () => {
    repo.findBySource.mockResolvedValue([createMatchRecordRow()]);

    const result = await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    const record = result.items[0];
    expect(record.games).toHaveLength(2);
    expect(record.games[0]).toMatchObject({
      gameNumber: 1,
      scoreA: 21,
      scoreB: 18,
    });
    expect(record.games[1]).toMatchObject({
      gameNumber: 2,
      scoreA: 21,
      scoreB: 15,
    });
  });

  // 业务规则: 每条记录包含 result 字段（胜负判定结果）（§4 活动的战绩列表 Response）
  it('should include result field determined by game outcomes', async () => {
    repo.findBySource.mockResolvedValue([createMatchRecordRow()]);

    const result = await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    // A 赢 2 局，B 赢 0 局 → A_WIN
    expect(result.items[0].result).toBe('A_WIN');
  });

  // 业务规则: 每条记录包含 recorder 信息（§4 活动的战绩列表 Response）
  it('should include recorder info with id, nickname, avatarUrl', async () => {
    repo.findBySource.mockResolvedValue([createMatchRecordRow()]);

    const result = await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    const record = result.items[0];
    expect(record.recorder).toBeDefined();
    expect(record.recorder.id).toBe(RECORDER_ID);
    expect(record.recorder.nickname).toBeDefined();
  });

  // 业务规则: 不校验活动是否存在，不存在时返回空列表（§4 活动的战绩列表）
  it('should return empty items when activity does not exist', async () => {
    repo.findBySource.mockResolvedValue([]);

    const result = await service.getSourceMatchRecords('activity', 'nonexistent-id', {});

    expect(result.items).toEqual([]);
  });

  // 业务规则: 一期不做分页，返回全部记录（§4 活动的战绩列表）
  it('should return all records without pagination', async () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      createMatchRecordRow({
        id: `match-record-uuid-${i + 1}`,
        createdAt: new Date(`2026-04-05T${18 - i}:00:00.000Z`),
      }),
    );
    repo.findBySource.mockResolvedValue(records);

    const result = await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    expect(result.items).toHaveLength(5);
  });

  // 业务规则: 按 createdAt 倒序排列（§4 活动的战绩列表）
  it('should call repository with proper source parameters for ordering', async () => {
    repo.findBySource.mockResolvedValue([]);

    await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    // Service 应传递 sourceType 和 sourceId 给 repository（排序由 repository 层处理）
    expect(repo.findBySource).toHaveBeenCalledWith('activity', ACTIVITY_ID, expect.any(Object));
  });

  // 业务规则: result 为 B_WIN 的记录正确判定（§6.1 胜负判定）
  it('should determine B_WIN result correctly', async () => {
    repo.findBySource.mockResolvedValue([
      createMatchRecordRow({
        games: [
          { id: 'g1', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 1, scoreA: 15, scoreB: 21 },
          { id: 'g2', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 2, scoreA: 18, scoreB: 21 },
        ],
      }),
    ]);

    const result = await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    expect(result.items[0].result).toBe('B_WIN');
  });

  // 业务规则: result 为 DRAW 的记录正确判定（§6.1 胜负判定 — 双方胜局数相同）
  it('should determine DRAW result correctly', async () => {
    repo.findBySource.mockResolvedValue([
      createMatchRecordRow({
        games: [
          { id: 'g1', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 1, scoreA: 21, scoreB: 18 },
          { id: 'g2', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 2, scoreA: 18, scoreB: 21 },
        ],
      }),
    ]);

    const result = await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    expect(result.items[0].result).toBe('DRAW');
  });

  // 业务规则: 包含 sourceType、sourceId、matchType、recordedBy 等字段（§4 活动的战绩列表 Response）
  it('should include all required fields in each record', async () => {
    repo.findBySource.mockResolvedValue([createMatchRecordRow()]);

    const result = await service.getSourceMatchRecords('activity', ACTIVITY_ID, {});

    const record = result.items[0];
    expect(record.id).toBeDefined();
    expect(record.sourceType).toBe('activity');
    expect(record.sourceId).toBe(ACTIVITY_ID);
    expect(record.matchType).toBe('singles');
    expect(record.recordedBy).toBe(RECORDER_ID);
    expect(record.createdAt).toBeDefined();
  });
});

// ===========================================================================
// 团课的战绩列表 — GET /api/group-classes/:id/match-records
// ===========================================================================

describe('MatchRecordService.getSourceMatchRecords (group-class)', () => {
  let service: MatchRecordService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    service = new MatchRecordService(
      repo as unknown as MatchRecordRepository,
      createMockActivityService() as any,
      createMockCoachingService() as any,
      userService as any,
    );
  });

  // 业务规则: 返回 sourceType='group-class' 且 sourceId=:id 的所有战绩（§4 团课的战绩列表）
  it('should return match records for the given group class', async () => {
    const records = [
      createMatchRecordRow({
        id: MATCH_RECORD_ID_1,
        sourceType: 'group-class',
        sourceId: GROUP_CLASS_ID,
        matchType: 'doubles',
        players: [
          { id: 'p1', matchRecordId: MATCH_RECORD_ID_1, side: 'A', userId: USER_A_ID, guestId: null },
          { id: 'p2', matchRecordId: MATCH_RECORD_ID_1, side: 'A', userId: USER_B_ID, guestId: null },
          { id: 'p3', matchRecordId: MATCH_RECORD_ID_1, side: 'B', userId: USER_C_ID, guestId: null },
          { id: 'p4', matchRecordId: MATCH_RECORD_ID_1, side: 'B', userId: USER_D_ID, guestId: null },
        ],
      }),
    ];
    repo.findBySource.mockResolvedValue(records);

    const result = await service.getSourceMatchRecords('group-class', GROUP_CLASS_ID, {});

    expect(result.items).toHaveLength(1);
    expect(repo.findBySource).toHaveBeenCalledWith('group-class', GROUP_CLASS_ID, expect.any(Object));
  });

  // 业务规则: 双打记录每方包含 2 名选手（§4 团课的战绩列表 Response）
  it('should include 2 players per side for doubles', async () => {
    repo.findBySource.mockResolvedValue([
      createMatchRecordRow({
        sourceType: 'group-class',
        sourceId: GROUP_CLASS_ID,
        matchType: 'doubles',
        players: [
          { id: 'p1', matchRecordId: MATCH_RECORD_ID_1, side: 'A', userId: USER_A_ID, guestId: null },
          { id: 'p2', matchRecordId: MATCH_RECORD_ID_1, side: 'A', userId: USER_B_ID, guestId: null },
          { id: 'p3', matchRecordId: MATCH_RECORD_ID_1, side: 'B', userId: USER_C_ID, guestId: null },
          { id: 'p4', matchRecordId: MATCH_RECORD_ID_1, side: 'B', userId: USER_D_ID, guestId: null },
        ],
      }),
    ]);

    const result = await service.getSourceMatchRecords('group-class', GROUP_CLASS_ID, {});

    expect(result.items[0].players.sideA).toHaveLength(2);
    expect(result.items[0].players.sideB).toHaveLength(2);
  });

  // 业务规则: 不校验团课是否存在，不存在时返回空列表（§4 团课的战绩列表）
  it('should return empty items when group class does not exist', async () => {
    repo.findBySource.mockResolvedValue([]);

    const result = await service.getSourceMatchRecords('group-class', 'nonexistent-id', {});

    expect(result.items).toEqual([]);
  });

  // 业务规则: 一期不做分页，返回全部记录（§4 团课的战绩列表）
  it('should return all records without pagination', async () => {
    const records = Array.from({ length: 3 }, (_, i) =>
      createMatchRecordRow({
        id: `match-record-uuid-${i + 1}`,
        sourceType: 'group-class',
        sourceId: GROUP_CLASS_ID,
      }),
    );
    repo.findBySource.mockResolvedValue(records);

    const result = await service.getSourceMatchRecords('group-class', GROUP_CLASS_ID, {});

    expect(result.items).toHaveLength(3);
  });

  // 业务规则: 混合平台用户和临时用户的双打记录（§4 团课的战绩列表 Response 示例）
  it('should handle mixed platform and guest players in doubles', async () => {
    repo.findBySource.mockResolvedValue([
      createMatchRecordRow({
        sourceType: 'group-class',
        sourceId: GROUP_CLASS_ID,
        matchType: 'doubles',
        players: [
          { id: 'p1', matchRecordId: MATCH_RECORD_ID_1, side: 'A', userId: USER_A_ID, guestId: null },
          { id: 'p2', matchRecordId: MATCH_RECORD_ID_1, side: 'A', userId: USER_B_ID, guestId: null },
          { id: 'p3', matchRecordId: MATCH_RECORD_ID_1, side: 'B', userId: USER_C_ID, guestId: null },
          { id: 'p4', matchRecordId: MATCH_RECORD_ID_1, side: 'B', userId: null, guestId: GUEST_PLAYER_ID },
        ],
      }),
    ]);

    const result = await service.getSourceMatchRecords('group-class', GROUP_CLASS_ID, {});

    const record = result.items[0];
    // B 方第 2 个选手是临时用户
    expect(record.players.sideB[1].guestId).toBe(GUEST_PLAYER_ID);
    expect(record.players.sideB[1].nickname).toBeDefined();
    // A 方是平台用户
    expect(record.players.sideA[0].userId).toBe(USER_A_ID);
    expect(record.players.sideA[0].nickname).toBeDefined();
  });
});

// ===========================================================================
// 私教课的战绩列表 — GET /api/private-lessons/:id/match-records
// ===========================================================================

describe('MatchRecordService.getSourceMatchRecords (private-lesson)', () => {
  let service: MatchRecordService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    service = new MatchRecordService(
      repo as unknown as MatchRecordRepository,
      createMockActivityService() as any,
      createMockCoachingService() as any,
      userService as any,
    );
  });

  // 业务规则: 返回 sourceType='private-lesson' 且 sourceId=:id 的所有战绩（§4 私教课的战绩列表）
  it('should return match records for the given private lesson', async () => {
    repo.findBySource.mockResolvedValue([
      createMatchRecordRow({
        sourceType: 'private-lesson',
        sourceId: PRIVATE_LESSON_ID,
      }),
    ]);

    const result = await service.getSourceMatchRecords('private-lesson', PRIVATE_LESSON_ID, {});

    expect(result.items).toHaveLength(1);
    expect(repo.findBySource).toHaveBeenCalledWith('private-lesson', PRIVATE_LESSON_ID, expect.any(Object));
  });

  // 业务规则: 不校验私教课是否存在，不存在时返回空列表（§4 私教课的战绩列表）
  it('should return empty items when private lesson does not exist', async () => {
    repo.findBySource.mockResolvedValue([]);

    const result = await service.getSourceMatchRecords('private-lesson', 'nonexistent-id', {});

    expect(result.items).toEqual([]);
  });

  // 业务规则: 一期不做分页，返回全部记录（§4 私教课的战绩列表）
  it('should return all records without pagination', async () => {
    const records = Array.from({ length: 4 }, (_, i) =>
      createMatchRecordRow({
        id: `match-record-uuid-${i + 1}`,
        sourceType: 'private-lesson',
        sourceId: PRIVATE_LESSON_ID,
      }),
    );
    repo.findBySource.mockResolvedValue(records);

    const result = await service.getSourceMatchRecords('private-lesson', PRIVATE_LESSON_ID, {});

    expect(result.items).toHaveLength(4);
  });

  // 业务规则: 私教课来源的记录应正确标记 sourceType（§4 私教课的战绩列表 Response）
  it('should have correct sourceType in response', async () => {
    repo.findBySource.mockResolvedValue([
      createMatchRecordRow({
        sourceType: 'private-lesson',
        sourceId: PRIVATE_LESSON_ID,
      }),
    ]);

    const result = await service.getSourceMatchRecords('private-lesson', PRIVATE_LESSON_ID, {});

    expect(result.items[0].sourceType).toBe('private-lesson');
    expect(result.items[0].sourceId).toBe(PRIVATE_LESSON_ID);
  });
});

// ===========================================================================
// 个人战绩历史 — GET /api/users/:id/match-records
// ===========================================================================

describe('MatchRecordService.getUserMatchRecords', () => {
  let service: MatchRecordService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    service = new MatchRecordService(
      repo as unknown as MatchRecordRepository,
      createMockActivityService() as any,
      createMockCoachingService() as any,
      userService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 返回 MatchPlayer.userId=:id 的所有关联战绩（§4 个人战绩历史）
  it('should return match records where the user is a player', async () => {
    repo.findByUser.mockResolvedValue({
      items: [
        createMatchRecordRow({ id: MATCH_RECORD_ID_1 }),
        createMatchRecordRow({ id: MATCH_RECORD_ID_2, createdAt: new Date('2026-04-04T10:00:00.000Z') }),
      ],
      total: 2,
    });

    const result = await service.getUserMatchRecords(USER_A_ID, {});

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(repo.findByUser).toHaveBeenCalledWith(USER_A_ID, expect.any(Object));
  });

  // 业务规则: 每条记录包含 userResult 字段（§4 个人战绩历史 — 'WIN'/'LOSE'/'DRAW'）
  it('should include userResult field for each record', async () => {
    // USER_A is on side A, A wins both games → userResult = WIN
    repo.findByUser.mockResolvedValue({
      items: [createMatchRecordRow()],
      total: 1,
    });

    const result = await service.getUserMatchRecords(USER_A_ID, {});

    // A 赢 2 局，B 赢 0 局 → A_WIN; USER_A on side A → WIN
    expect(result.items[0].userResult).toBe('WIN');
  });

  // 业务规则: 用户在 B 方且 A 方获胜时 userResult='LOSE'（§6.2 个人战绩结果判定）
  it('should set userResult to LOSE when user is on losing side', async () => {
    // USER_B is on side B, A wins → LOSE
    repo.findByUser.mockResolvedValue({
      items: [createMatchRecordRow()],
      total: 1,
    });

    const result = await service.getUserMatchRecords(USER_B_ID, {});

    // A_WIN, USER_B on side B → LOSE
    expect(result.items[0].userResult).toBe('LOSE');
  });

  // 业务规则: 用户在 A 方且 B 方获胜时 userResult='LOSE'（§6.2）
  it('should set userResult to LOSE when user is on side A and B wins', async () => {
    repo.findByUser.mockResolvedValue({
      items: [
        createMatchRecordRow({
          games: [
            { id: 'g1', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 1, scoreA: 15, scoreB: 21 },
            { id: 'g2', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 2, scoreA: 18, scoreB: 21 },
          ],
        }),
      ],
      total: 1,
    });

    const result = await service.getUserMatchRecords(USER_A_ID, {});

    // B_WIN, USER_A on side A → LOSE
    expect(result.items[0].userResult).toBe('LOSE');
  });

  // 业务规则: 用户在 B 方且 B 方获胜时 userResult='WIN'（§6.2）
  it('should set userResult to WIN when user is on side B and B wins', async () => {
    repo.findByUser.mockResolvedValue({
      items: [
        createMatchRecordRow({
          games: [
            { id: 'g1', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 1, scoreA: 15, scoreB: 21 },
            { id: 'g2', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 2, scoreA: 18, scoreB: 21 },
          ],
        }),
      ],
      total: 1,
    });

    const result = await service.getUserMatchRecords(USER_B_ID, {});

    // B_WIN, USER_B on side B → WIN
    expect(result.items[0].userResult).toBe('WIN');
  });

  // 业务规则: 平局时 userResult='DRAW'（§6.2 — matchResult=DRAW）
  it('should set userResult to DRAW when match is a draw', async () => {
    repo.findByUser.mockResolvedValue({
      items: [
        createMatchRecordRow({
          games: [
            { id: 'g1', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 1, scoreA: 21, scoreB: 18 },
            { id: 'g2', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 2, scoreA: 18, scoreB: 21 },
          ],
        }),
      ],
      total: 1,
    });

    const result = await service.getUserMatchRecords(USER_A_ID, {});

    // A 赢 1 局，B 赢 1 局 → DRAW; 任何一方都是 DRAW
    expect(result.items[0].userResult).toBe('DRAW');
  });

  // 业务规则: 支持 sourceType 筛选（§4 个人战绩历史 — 当提供 sourceType 时只返回该来源类型的战绩）
  it('should pass sourceType filter to repository when provided', async () => {
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    await service.getUserMatchRecords(USER_A_ID, { sourceType: 'activity' } as any);

    expect(repo.findByUser).toHaveBeenCalledWith(
      USER_A_ID,
      expect.objectContaining({ sourceType: 'activity' }),
    );
  });

  // 业务规则: 未提供 sourceType 时返回所有来源类型的战绩（§4 个人战绩历史）
  it('should return all source types when sourceType is not provided', async () => {
    repo.findByUser.mockResolvedValue({
      items: [
        createMatchRecordRow({ sourceType: 'activity' }),
        createMatchRecordRow({ id: MATCH_RECORD_ID_2, sourceType: 'group-class', sourceId: GROUP_CLASS_ID }),
        createMatchRecordRow({ id: MATCH_RECORD_ID_3, sourceType: 'private-lesson', sourceId: PRIVATE_LESSON_ID }),
      ],
      total: 3,
    });

    const result = await service.getUserMatchRecords(USER_A_ID, {});

    expect(result.items).toHaveLength(3);
  });

  // 业务规则: 支持分页 — page 从 1 开始，pageSize 默认 20（§4 个人战绩历史）
  it('should support pagination with page and pageSize', async () => {
    repo.findByUser.mockResolvedValue({
      items: [createMatchRecordRow()],
      total: 42,
    });

    const result = await service.getUserMatchRecords(USER_A_ID, { page: 2, pageSize: 10 });

    expect(repo.findByUser).toHaveBeenCalledWith(
      USER_A_ID,
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
    expect(result.total).toBe(42);
    expect(result.page).toBeDefined();
    expect(result.pageSize).toBeDefined();
  });

  // 业务规则: 默认分页参数 — page=1, pageSize=20（§4 个人战绩历史）
  it('should use default pagination when not provided', async () => {
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    const result = await service.getUserMatchRecords(USER_A_ID, {});

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  // 业务规则: pageSize 最大 100（§4 个人战绩历史 — 最大 100）
  it('should cap pageSize at 100', async () => {
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    const result = await service.getUserMatchRecords(USER_A_ID, { pageSize: 200 });

    expect(result.pageSize).toBeLessThanOrEqual(100);
  });

  // 业务规则: 任何已登录用户均可查看其他用户的战绩历史（§4 个人战绩历史 — 公开数据）
  it('should allow any authenticated user to view another user match records', async () => {
    repo.findByUser.mockResolvedValue({
      items: [createMatchRecordRow()],
      total: 1,
    });

    // USER_C 查看 USER_A 的战绩 — 不应抛出错误
    const result = await service.getUserMatchRecords(USER_A_ID, {});

    expect(result.items).toHaveLength(1);
  });

  // 业务规则: 返回结果包含分页信息 total、page、pageSize（§4 个人战绩历史 Response）
  it('should include pagination info in response', async () => {
    repo.findByUser.mockResolvedValue({
      items: [createMatchRecordRow()],
      total: 42,
    });

    const result = await service.getUserMatchRecords(USER_A_ID, { page: 1, pageSize: 20 });

    expect(result.total).toBe(42);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  // 业务规则: 包含完整的战绩信息（recorder、players、games、result、userResult）（§4 Response）
  it('should include complete record info with all required fields', async () => {
    repo.findByUser.mockResolvedValue({
      items: [createMatchRecordRow()],
      total: 1,
    });

    const result = await service.getUserMatchRecords(USER_A_ID, {});

    const record = result.items[0];
    expect(record.id).toBeDefined();
    expect(record.sourceType).toBeDefined();
    expect(record.sourceId).toBeDefined();
    expect(record.matchType).toBeDefined();
    expect(record.recordedBy).toBeDefined();
    expect(record.recorder).toBeDefined();
    expect(record.players).toBeDefined();
    expect(record.players.sideA).toBeDefined();
    expect(record.players.sideB).toBeDefined();
    expect(record.games).toBeDefined();
    expect(record.result).toBeDefined();
    expect(record.userResult).toBeDefined();
    expect(record.createdAt).toBeDefined();
  });

  // 业务规则: 用户无战绩时返回空列表（不返回 404）（类似 §4 个人战绩汇总 — 无数据不返回 404）
  it('should return empty items when user has no match records', async () => {
    repo.findByUser.mockResolvedValue({ items: [], total: 0 });

    const result = await service.getUserMatchRecords(USER_A_ID, {});

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  // 业务规则: 双打中用户在 A 方的 userResult 判定（§6.2 + §6.1）
  it('should determine userResult correctly for doubles match', async () => {
    repo.findByUser.mockResolvedValue({
      items: [
        createMatchRecordRow({
          matchType: 'doubles',
          players: [
            { id: 'p1', matchRecordId: MATCH_RECORD_ID_1, side: 'A', userId: USER_A_ID, guestId: null },
            { id: 'p2', matchRecordId: MATCH_RECORD_ID_1, side: 'A', userId: USER_B_ID, guestId: null },
            { id: 'p3', matchRecordId: MATCH_RECORD_ID_1, side: 'B', userId: USER_C_ID, guestId: null },
            { id: 'p4', matchRecordId: MATCH_RECORD_ID_1, side: 'B', userId: USER_D_ID, guestId: null },
          ],
          games: [
            { id: 'g1', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 1, scoreA: 21, scoreB: 18 },
            { id: 'g2', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 2, scoreA: 21, scoreB: 15 },
          ],
        }),
      ],
      total: 1,
    });

    const result = await service.getUserMatchRecords(USER_A_ID, {});

    // A_WIN, USER_A on side A → WIN
    expect(result.items[0].userResult).toBe('WIN');
  });

  // 业务规则: 含单局平局的场景下 userResult 判定（§6.1 + §6.2）
  it('should handle tied games in userResult determination', async () => {
    repo.findByUser.mockResolvedValue({
      items: [
        createMatchRecordRow({
          games: [
            { id: 'g1', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 1, scoreA: 21, scoreB: 18 },
            { id: 'g2', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 2, scoreA: 20, scoreB: 20 },
            { id: 'g3', matchRecordId: MATCH_RECORD_ID_1, gameNumber: 3, scoreA: 15, scoreB: 21 },
          ],
        }),
      ],
      total: 1,
    });

    const result = await service.getUserMatchRecords(USER_A_ID, {});

    // A 赢 1 局，B 赢 1 局，1 局平 → DRAW; USER_A on side A → DRAW
    expect(result.items[0].userResult).toBe('DRAW');
  });
});

// ===========================================================================
// 个人战绩汇总 — GET /api/users/:id/match-stats
// ===========================================================================

describe('MatchRecordService.getUserMatchStats', () => {
  let service: MatchRecordService;
  let repo: ReturnType<typeof createMockRepository>;
  let userService: ReturnType<typeof createMockUserService>;

  beforeEach(() => {
    repo = createMockRepository();
    userService = createMockUserService();
    service = new MatchRecordService(
      repo as unknown as MatchRecordRepository,
      createMockActivityService() as any,
      createMockCoachingService() as any,
      userService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 返回用户的战绩汇总（§4 个人战绩汇总 — totalMatches, wins, losses, draws, winRate）
  it('should return match stats for the given user', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 42,
      wins: 25,
      losses: 15,
      draws: 2,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    expect(result.totalMatches).toBe(42);
    expect(result.wins).toBe(25);
    expect(result.losses).toBe(15);
    expect(result.draws).toBe(2);
    expect(repo.getUserMatchStats).toHaveBeenCalledWith(USER_A_ID);
  });

  // 业务规则: winRate = wins / (wins + losses) * 100，保留一位小数（§4 个人战绩汇总）
  it('should calculate winRate as wins/(wins+losses)*100 with 1 decimal place', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 42,
      wins: 25,
      losses: 15,
      draws: 2,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    // 25 / (25 + 15) * 100 = 62.5
    expect(result.winRate).toBe(62.5);
  });

  // 业务规则: winRate 保留一位小数（§6.3 — round(wins / (wins + losses) * 100, 1)）
  it('should round winRate to 1 decimal place', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 10,
      wins: 3,
      losses: 7,
      draws: 0,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    // 3 / (3 + 7) * 100 = 30.0
    expect(result.winRate).toBe(30.0);
  });

  // 业务规则: wins + losses = 0 时 winRate 为 0（§4 个人战绩汇总）
  it('should return winRate 0 when wins + losses = 0', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 2,
      wins: 0,
      losses: 0,
      draws: 2,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    expect(result.winRate).toBe(0);
  });

  // 业务规则: totalMatches = wins + losses + draws（§4 个人战绩汇总 — §6.3）
  it('should have totalMatches equal to wins + losses + draws', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 10,
      wins: 6,
      losses: 3,
      draws: 1,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    expect(result.totalMatches).toBe(result.wins + result.losses + result.draws);
  });

  // 业务规则: 用户无战绩时返回全 0 的汇总数据，不返回 404（§4 个人战绩汇总）
  it('should return all-zero stats when user has no match records', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    expect(result.totalMatches).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.draws).toBe(0);
    expect(result.winRate).toBe(0);
  });

  // 业务规则: 任何已登录用户均可查看其他用户的战绩汇总（§4 个人战绩汇总 — 公开数据）
  it('should allow any authenticated user to view another user stats', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 5,
      wins: 3,
      losses: 2,
      draws: 0,
    });

    // 不应因查看他人数据而抛出错误
    const result = await service.getUserMatchStats(USER_B_ID);

    expect(result.totalMatches).toBe(5);
  });

  // 业务规则: 仅统计平台用户的数据，临时用户不生成汇总（§4 个人战绩汇总 — 通过 MatchPlayer.userId 查询）
  it('should query stats by userId (only platform users)', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    });

    await service.getUserMatchStats(USER_A_ID);

    // 确保传入的是 userId，repository 层只按 userId 查询
    expect(repo.getUserMatchStats).toHaveBeenCalledWith(USER_A_ID);
  });

  // 业务规则: winRate 为 100 时（全胜）（§6.3 — 边界测试）
  it('should return winRate 100 when all matches are wins', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 5,
      wins: 5,
      losses: 0,
      draws: 0,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    // 5 / (5 + 0) * 100 = 100
    expect(result.winRate).toBe(100);
  });

  // 业务规则: winRate 为 0 时（全败，无平局）（§6.3 — 边界测试）
  it('should return winRate 0 when all matches are losses', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 5,
      wins: 0,
      losses: 5,
      draws: 0,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    // 0 / (0 + 5) * 100 = 0
    expect(result.winRate).toBe(0);
  });

  // 业务规则: winRate 含小数的精确四舍五入（§6.3 — round 保留一位小数）
  it('should round winRate correctly for fractional results', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 3,
      wins: 1,
      losses: 2,
      draws: 0,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    // 1 / (1 + 2) * 100 = 33.333... → 33.3
    expect(result.winRate).toBe(33.3);
  });

  // 业务规则: 含平局时 winRate 分母不包含 draws（§6.3 — wins/(wins+losses)*100）
  it('should not include draws in winRate denominator', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 10,
      wins: 4,
      losses: 3,
      draws: 3,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    // 4 / (4 + 3) * 100 = 57.142... → 57.1
    expect(result.winRate).toBe(57.1);
  });

  // 业务规则: 只有平局时 winRate 为 0（§6.3 — wins + losses = 0）
  it('should return winRate 0 when only draws exist', async () => {
    repo.getUserMatchStats.mockResolvedValue({
      totalMatches: 3,
      wins: 0,
      losses: 0,
      draws: 3,
    });

    const result = await service.getUserMatchStats(USER_A_ID);

    expect(result.winRate).toBe(0);
    expect(result.totalMatches).toBe(3);
  });
});
