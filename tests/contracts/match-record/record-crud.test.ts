/**
 * 契约测试: match-record 模块 — 战绩录入与删除接口
 * 覆盖接口:
 *   - POST /api/match-records (MatchRecordService.createMatchRecord)
 *   - DELETE /api/match-records/:id (MatchRecordService.deleteMatchRecord)
 *
 * 来源文档: docs/module-design/match-record.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - MatchRecordRepository: 全部 mock（隔离数据库依赖）
 * - ActivityService: mock getActivityById / getParticipantIds（跨模块依赖）
 * - CoachingService: mock getGroupClassById / getPrivateLessonById / getParticipantIds（跨模块依赖）
 * - UserService: mock getUsersByIds（跨模块依赖）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchRecordService } from '@server/modules/match-record/service.js';
import { MatchRecordRepository } from '@server/modules/match-record/repository.js';
import type { CreateMatchRecordInput } from '@server/modules/match-record/types.js';

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
const MATCH_RECORD_ID = 'match-record-uuid-0001';
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
    create: vi.fn().mockResolvedValue(createMatchRecordRecord()),
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
 * Build a mock ActivityService with cross-module methods.
 */
function createMockActivityService() {
  return {
    getActivityById: vi.fn().mockResolvedValue({
      id: ACTIVITY_ID,
      status: 'completed',
    }),
    getParticipantIds: vi.fn().mockResolvedValue([
      RECORDER_ID,
      USER_A_ID,
      USER_B_ID,
      USER_C_ID,
      USER_D_ID,
    ]),
  };
}

/**
 * Build a mock CoachingService with cross-module methods.
 */
function createMockCoachingService() {
  return {
    getGroupClassById: vi.fn().mockResolvedValue({
      id: GROUP_CLASS_ID,
      status: 'completed',
    }),
    getPrivateLessonById: vi.fn().mockResolvedValue({
      id: PRIVATE_LESSON_ID,
      status: 'completed',
    }),
    getParticipantIds: vi.fn().mockResolvedValue([
      RECORDER_ID,
      USER_A_ID,
      USER_B_ID,
      USER_C_ID,
      USER_D_ID,
    ]),
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

/** Standard MatchRecord as returned by repository */
function createMatchRecordRecord(
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
  return {
    id: MATCH_RECORD_ID,
    sourceType: 'activity',
    sourceId: ACTIVITY_ID,
    matchType: 'singles',
    recordedBy: RECORDER_ID,
    createdAt: new Date('2026-04-05T18:30:00.000Z'),
    updatedAt: new Date('2026-04-05T18:30:00.000Z'),
    players: [
      {
        id: 'player-uuid-1',
        matchRecordId: MATCH_RECORD_ID,
        side: 'A',
        userId: USER_A_ID,
        guestId: null,
      },
      {
        id: 'player-uuid-2',
        matchRecordId: MATCH_RECORD_ID,
        side: 'B',
        userId: USER_B_ID,
        guestId: null,
      },
    ],
    games: [
      {
        id: 'game-uuid-1',
        matchRecordId: MATCH_RECORD_ID,
        gameNumber: 1,
        scoreA: 21,
        scoreB: 18,
      },
      {
        id: 'game-uuid-2',
        matchRecordId: MATCH_RECORD_ID,
        gameNumber: 2,
        scoreA: 21,
        scoreB: 15,
      },
    ],
    ...overrides,
  };
}

/** Standard create input for singles (activity source) */
function createSinglesInput(
  overrides?: Partial<CreateMatchRecordInput>,
): CreateMatchRecordInput {
  return {
    sourceType: 'activity',
    sourceId: ACTIVITY_ID,
    matchType: 'singles',
    players: {
      sideA: [{ userId: USER_A_ID }],
      sideB: [{ userId: USER_B_ID }],
    },
    games: [
      { scoreA: 21, scoreB: 18 },
      { scoreA: 21, scoreB: 15 },
    ],
    ...overrides,
  } as CreateMatchRecordInput;
}

/** Standard create input for doubles (group-class source) */
function createDoublesInput(
  overrides?: Partial<CreateMatchRecordInput>,
): CreateMatchRecordInput {
  return {
    sourceType: 'group-class',
    sourceId: GROUP_CLASS_ID,
    matchType: 'doubles',
    players: {
      sideA: [{ userId: USER_A_ID }, { userId: USER_B_ID }],
      sideB: [{ userId: USER_C_ID }, { userId: USER_D_ID }],
    },
    games: [
      { scoreA: 21, scoreB: 19 },
      { scoreA: 18, scoreB: 21 },
      { scoreA: 21, scoreB: 17 },
    ],
    ...overrides,
  } as CreateMatchRecordInput;
}

// ===========================================================================
// 录入战绩 — POST /api/match-records
// ===========================================================================

describe('MatchRecordService.createMatchRecord', () => {
  let service: MatchRecordService;
  let repo: ReturnType<typeof createMockRepository>;
  let activityService: ReturnType<typeof createMockActivityService>;
  let coachingService: ReturnType<typeof createMockCoachingService>;
  let userService: ReturnType<typeof createMockUserService>;

  beforeEach(() => {
    repo = createMockRepository();
    activityService = createMockActivityService();
    coachingService = createMockCoachingService();
    userService = createMockUserService();
    service = new MatchRecordService(
      repo as unknown as MatchRecordRepository,
      activityService as any,
      coachingService as any,
      userService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 单打模式 sideA 和 sideB 各 1 名选手，活动来源（§4 录入战绩 + §6.1 胜负判定）
  it('should create a singles match record with activity source', async () => {
    const input = createSinglesInput();
    const result = await service.createMatchRecord(RECORDER_ID, input);

    expect(result).toBeDefined();
    expect(result.sourceType).toBe('activity');
    expect(result.sourceId).toBe(ACTIVITY_ID);
    expect(result.matchType).toBe('singles');
    expect(result.recordedBy).toBe(RECORDER_ID);
    expect(result.players.sideA).toHaveLength(1);
    expect(result.players.sideB).toHaveLength(1);
    expect(result.games).toHaveLength(2);
    // A 方赢 2 局，B 方赢 0 局 → A_WIN
    expect(result.result).toBe('A_WIN');
    expect(result.createdAt).toBeDefined();

    // 应包含录入者信息
    expect(result.recorder).toBeDefined();
    expect(result.recorder.id).toBe(RECORDER_ID);
  });

  // 业务规则: 双打模式 sideA 和 sideB 各 2 名选手，团课来源（§4 录入战绩）
  it('should create a doubles match record with group-class source', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        sourceType: 'group-class',
        sourceId: GROUP_CLASS_ID,
        matchType: 'doubles',
        players: [
          { id: 'p1', matchRecordId: MATCH_RECORD_ID, side: 'A', userId: USER_A_ID, guestId: null },
          { id: 'p2', matchRecordId: MATCH_RECORD_ID, side: 'A', userId: USER_B_ID, guestId: null },
          { id: 'p3', matchRecordId: MATCH_RECORD_ID, side: 'B', userId: USER_C_ID, guestId: null },
          { id: 'p4', matchRecordId: MATCH_RECORD_ID, side: 'B', userId: USER_D_ID, guestId: null },
        ],
        games: [
          { id: 'g1', matchRecordId: MATCH_RECORD_ID, gameNumber: 1, scoreA: 21, scoreB: 19 },
          { id: 'g2', matchRecordId: MATCH_RECORD_ID, gameNumber: 2, scoreA: 18, scoreB: 21 },
          { id: 'g3', matchRecordId: MATCH_RECORD_ID, gameNumber: 3, scoreA: 21, scoreB: 17 },
        ],
      }),
    );

    const input = createDoublesInput();
    const result = await service.createMatchRecord(RECORDER_ID, input);

    expect(result).toBeDefined();
    expect(result.sourceType).toBe('group-class');
    expect(result.matchType).toBe('doubles');
    expect(result.players.sideA).toHaveLength(2);
    expect(result.players.sideB).toHaveLength(2);
    expect(result.games).toHaveLength(3);
    // A 赢 2 局，B 赢 1 局 → A_WIN
    expect(result.result).toBe('A_WIN');
  });

  // 业务规则: 私教课来源录入（§4 录入战绩 — sourceType 为 'private-lesson'）
  it('should create a match record with private-lesson source', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        sourceType: 'private-lesson',
        sourceId: PRIVATE_LESSON_ID,
      }),
    );

    const input = createSinglesInput({
      sourceType: 'private-lesson',
      sourceId: PRIVATE_LESSON_ID,
    });
    const result = await service.createMatchRecord(RECORDER_ID, input);

    expect(result).toBeDefined();
    expect(result.sourceType).toBe('private-lesson');
    expect(result.sourceId).toBe(PRIVATE_LESSON_ID);
  });

  // 业务规则: 录入者验证 — 调用 ActivityService.getParticipantIds 校验（§6.4 步骤 5）
  it('should call ActivityService.getParticipantIds to verify recorder is participant', async () => {
    const input = createSinglesInput();
    await service.createMatchRecord(RECORDER_ID, input);

    expect(activityService.getActivityById).toHaveBeenCalledWith(ACTIVITY_ID);
    expect(activityService.getParticipantIds).toHaveBeenCalledWith(ACTIVITY_ID);
  });

  // 业务规则: 团课来源验证 — 调用 CoachingService 的方法（§6.4 步骤 1, 4）
  it('should call CoachingService for group-class source verification', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        sourceType: 'group-class',
        sourceId: GROUP_CLASS_ID,
      }),
    );

    const input = createDoublesInput();
    await service.createMatchRecord(RECORDER_ID, input);

    expect(coachingService.getGroupClassById).toHaveBeenCalledWith(GROUP_CLASS_ID);
    expect(coachingService.getParticipantIds).toHaveBeenCalledWith(
      GROUP_CLASS_ID,
      'group-class',
    );
  });

  // 业务规则: 私教课来源验证 — 调用 CoachingService 的方法（§6.4 步骤 1, 4）
  it('should call CoachingService for private-lesson source verification', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        sourceType: 'private-lesson',
        sourceId: PRIVATE_LESSON_ID,
      }),
    );

    const input = createSinglesInput({
      sourceType: 'private-lesson',
      sourceId: PRIVATE_LESSON_ID,
    });
    await service.createMatchRecord(RECORDER_ID, input);

    expect(coachingService.getPrivateLessonById).toHaveBeenCalledWith(PRIVATE_LESSON_ID);
    expect(coachingService.getParticipantIds).toHaveBeenCalledWith(
      PRIVATE_LESSON_ID,
      'private-lesson',
    );
  });

  // 业务规则: 非平台用户（guestName）在录入时自动创建 GuestPlayer 记录（§6.5）
  it('should create GuestPlayer for non-platform users', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        players: [
          { id: 'p1', matchRecordId: MATCH_RECORD_ID, side: 'A', userId: USER_A_ID, guestId: null },
          { id: 'p2', matchRecordId: MATCH_RECORD_ID, side: 'B', userId: null, guestId: GUEST_PLAYER_ID },
        ],
      }),
    );

    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [{ guestName: '临时球友A' }],
      },
    } as any);

    const result = await service.createMatchRecord(RECORDER_ID, input);

    expect(result).toBeDefined();
    expect(repo.createGuestPlayer).toHaveBeenCalledWith('临时球友A');
    // B 方选手应包含 guestId
    expect(result.players.sideB[0].guestId).toBeDefined();
  });

  // 业务规则: 胜负判定 — B 方赢得多数局为 B_WIN（§6.1）
  it('should determine B_WIN when side B wins majority of games', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        games: [
          { id: 'g1', matchRecordId: MATCH_RECORD_ID, gameNumber: 1, scoreA: 15, scoreB: 21 },
          { id: 'g2', matchRecordId: MATCH_RECORD_ID, gameNumber: 2, scoreA: 21, scoreB: 18 },
          { id: 'g3', matchRecordId: MATCH_RECORD_ID, gameNumber: 3, scoreA: 18, scoreB: 21 },
        ],
      }),
    );

    const input = createSinglesInput({
      games: [
        { scoreA: 15, scoreB: 21 },
        { scoreA: 21, scoreB: 18 },
        { scoreA: 18, scoreB: 21 },
      ],
    });
    const result = await service.createMatchRecord(RECORDER_ID, input);

    // B 赢 2 局，A 赢 1 局 → B_WIN
    expect(result.result).toBe('B_WIN');
  });

  // 业务规则: 胜负判定 — 双方胜局数相同为 DRAW（§6.1）
  it('should determine DRAW when both sides win equal number of games', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        games: [
          { id: 'g1', matchRecordId: MATCH_RECORD_ID, gameNumber: 1, scoreA: 21, scoreB: 18 },
          { id: 'g2', matchRecordId: MATCH_RECORD_ID, gameNumber: 2, scoreA: 18, scoreB: 21 },
        ],
      }),
    );

    const input = createSinglesInput({
      games: [
        { scoreA: 21, scoreB: 18 },
        { scoreA: 18, scoreB: 21 },
      ],
    });
    const result = await service.createMatchRecord(RECORDER_ID, input);

    // A 赢 1 局，B 赢 1 局 → DRAW
    expect(result.result).toBe('DRAW');
  });

  // 业务规则: 胜负判定 — 单局平局不计入任何一方胜局数（§6.1）
  it('should handle tied games when determining result', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        games: [
          { id: 'g1', matchRecordId: MATCH_RECORD_ID, gameNumber: 1, scoreA: 21, scoreB: 18 },
          { id: 'g2', matchRecordId: MATCH_RECORD_ID, gameNumber: 2, scoreA: 20, scoreB: 20 },
          { id: 'g3', matchRecordId: MATCH_RECORD_ID, gameNumber: 3, scoreA: 18, scoreB: 21 },
        ],
      }),
    );

    const input = createSinglesInput({
      games: [
        { scoreA: 21, scoreB: 18 },
        { scoreA: 20, scoreB: 20 },
        { scoreA: 18, scoreB: 21 },
      ],
    });
    const result = await service.createMatchRecord(RECORDER_ID, input);

    // A 赢 1 局，B 赢 1 局，1 局平 → DRAW
    expect(result.result).toBe('DRAW');
  });

  // 业务规则: 仅 1 局也能正常录入（§4 录入战绩 — games 至少有 1 局）
  it('should create match record with single game', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        games: [
          { id: 'g1', matchRecordId: MATCH_RECORD_ID, gameNumber: 1, scoreA: 21, scoreB: 15 },
        ],
      }),
    );

    const input = createSinglesInput({
      games: [{ scoreA: 21, scoreB: 15 }],
    });
    const result = await service.createMatchRecord(RECORDER_ID, input);

    expect(result.games).toHaveLength(1);
    expect(result.result).toBe('A_WIN');
  });

  // 业务规则: 响应包含录入者信息 recorder（§4 录入战绩 Response 201）
  it('should include recorder info in response', async () => {
    const result = await service.createMatchRecord(RECORDER_ID, createSinglesInput());

    expect(result.recorder).toBeDefined();
    expect(result.recorder.id).toBe(RECORDER_ID);
    expect(result.recorder.nickname).toBeDefined();
  });

  // 业务规则: 响应中平台用户包含 nickname 和 avatarUrl（§4 录入战绩 Response 201）
  it('should include user info (nickname, avatarUrl) for platform players', async () => {
    const result = await service.createMatchRecord(RECORDER_ID, createSinglesInput());

    expect(result.players.sideA[0].userId).toBeDefined();
    expect(result.players.sideA[0].nickname).toBeDefined();
    expect(result.players.sideB[0].userId).toBeDefined();
    expect(result.players.sideB[0].nickname).toBeDefined();

    // 应调用 UserService.getUsersByIds 批量获取用户信息
    expect(userService.getUsersByIds).toHaveBeenCalled();
  });

  // 业务规则: 响应中临时用户包含 guestId 和 nickname（§4 录入战绩 Response 201）
  it('should include guestId and nickname for guest players in response', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        players: [
          { id: 'p1', matchRecordId: MATCH_RECORD_ID, side: 'A', userId: USER_A_ID, guestId: null },
          { id: 'p2', matchRecordId: MATCH_RECORD_ID, side: 'B', userId: null, guestId: GUEST_PLAYER_ID },
        ],
      }),
    );

    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [{ guestName: '临时球友A' }],
      },
    } as any);

    const result = await service.createMatchRecord(RECORDER_ID, input);

    expect(result.players.sideB[0].guestId).toBe(GUEST_PLAYER_ID);
    expect(result.players.sideB[0].nickname).toBe('临时球友A');
  });

  // 业务规则: 每局 gameNumber 自动从 1 开始编号（§4 录入战绩 Response 201）
  it('should auto-assign gameNumber starting from 1', async () => {
    const result = await service.createMatchRecord(RECORDER_ID, createSinglesInput());

    expect(result.games[0].gameNumber).toBe(1);
    expect(result.games[1].gameNumber).toBe(2);
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  // 错误码: MATCH_RECORD_INVALID_SOURCE_TYPE — sourceType 不在枚举范围内（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_SOURCE_TYPE for invalid sourceType', async () => {
    const input = createSinglesInput({
      sourceType: 'invalid-type' as any,
    });

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_SOURCE_TYPE',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_MATCH_TYPE — matchType 不在枚举范围内（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_MATCH_TYPE for invalid matchType', async () => {
    const input = createSinglesInput({
      matchType: 'triples' as any,
    });

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_MATCH_TYPE',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_PLAYERS — 单打模式 sideA 超过 1 人（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_PLAYERS when singles has more than 1 player per side', async () => {
    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }, { userId: USER_C_ID }],
        sideB: [{ userId: USER_B_ID }],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_PLAYERS',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_PLAYERS — 单打模式 sideB 为空（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_PLAYERS when singles side has 0 players', async () => {
    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_PLAYERS',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_PLAYERS — 双打模式每方不是 2 人（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_PLAYERS when doubles has wrong player count', async () => {
    const input = createDoublesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [{ userId: USER_C_ID }, { userId: USER_D_ID }],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_PLAYERS',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_PLAYER — userId 和 guestName 同时提供（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_PLAYER when both userId and guestName provided', async () => {
    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID, guestName: '张三' }],
        sideB: [{ userId: USER_B_ID }],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_PLAYER',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_PLAYER — userId 和 guestName 同时为空（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_PLAYER when neither userId nor guestName provided', async () => {
    const input = createSinglesInput({
      players: {
        sideA: [{}],
        sideB: [{ userId: USER_B_ID }],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_PLAYER',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_GUEST_NAME — guestName 为空字符串（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_GUEST_NAME when guestName is empty', async () => {
    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [{ guestName: '' }],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_GUEST_NAME',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_GUEST_NAME — guestName 超过 20 字符（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_GUEST_NAME when guestName exceeds 20 chars', async () => {
    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [{ guestName: '这是一个超级超级超级超级超级超级超级超级长的名字' }],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_GUEST_NAME',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_GAMES — games 为空数组（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_GAMES when games is empty', async () => {
    const input = createSinglesInput({ games: [] });

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_GAMES',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_SCORE — scoreA 超出范围（> 30）（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_SCORE when scoreA exceeds 30', async () => {
    const input = createSinglesInput({
      games: [{ scoreA: 31, scoreB: 18 }],
    });

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_SCORE',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_SCORE — scoreB 为负数（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_SCORE when scoreB is negative', async () => {
    const input = createSinglesInput({
      games: [{ scoreA: 21, scoreB: -1 }],
    });

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_SCORE',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_SCORE — scoreA 和 scoreB 同时为 0（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_SCORE when both scores are 0', async () => {
    const input = createSinglesInput({
      games: [{ scoreA: 0, scoreB: 0 }],
    });

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_SCORE',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_SCORE — 多局中某局比分无效（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_INVALID_SCORE when any game has invalid score', async () => {
    const input = createSinglesInput({
      games: [
        { scoreA: 21, scoreB: 18 },
        { scoreA: 0, scoreB: 0 },
      ],
    });

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_SCORE',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_DUPLICATE_PLAYER — 同一 userId 出现在两侧（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_DUPLICATE_PLAYER when same userId on both sides', async () => {
    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [{ userId: USER_A_ID }],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_DUPLICATE_PLAYER',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_DUPLICATE_PLAYER — 双打中同一 userId 重复（§4 录入战绩错误码）
  it('should throw MATCH_RECORD_DUPLICATE_PLAYER when userId repeated in doubles', async () => {
    const input = createDoublesInput({
      players: {
        sideA: [{ userId: USER_A_ID }, { userId: USER_B_ID }],
        sideB: [{ userId: USER_A_ID }, { userId: USER_D_ID }],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_DUPLICATE_PLAYER',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_SOURCE_NOT_FOUND — 活动不存在（§6.4 步骤 2）
  it('should throw MATCH_RECORD_SOURCE_NOT_FOUND when activity does not exist', async () => {
    activityService.getActivityById.mockResolvedValue(null);

    const input = createSinglesInput();

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_SOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 错误码: MATCH_RECORD_SOURCE_NOT_FOUND — 团课不存在（§6.4 步骤 2）
  it('should throw MATCH_RECORD_SOURCE_NOT_FOUND when group class does not exist', async () => {
    coachingService.getGroupClassById.mockResolvedValue(null);

    const input = createDoublesInput();

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_SOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 错误码: MATCH_RECORD_SOURCE_NOT_FOUND — 私教课不存在（§6.4 步骤 2）
  it('should throw MATCH_RECORD_SOURCE_NOT_FOUND when private lesson does not exist', async () => {
    coachingService.getPrivateLessonById.mockResolvedValue(null);

    const input = createSinglesInput({
      sourceType: 'private-lesson',
      sourceId: PRIVATE_LESSON_ID,
    });

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_SOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 错误码: MATCH_RECORD_SOURCE_NOT_COMPLETED — 活动状态不是 completed（§6.4 步骤 3）
  it('should throw MATCH_RECORD_SOURCE_NOT_COMPLETED when activity is not completed', async () => {
    activityService.getActivityById.mockResolvedValue({
      id: ACTIVITY_ID,
      status: 'open',
    });

    const input = createSinglesInput();

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_SOURCE_NOT_COMPLETED',
      statusCode: 409,
    });
  });

  // 错误码: MATCH_RECORD_SOURCE_NOT_COMPLETED — 团课状态不是 completed（§6.4 步骤 3）
  it('should throw MATCH_RECORD_SOURCE_NOT_COMPLETED when group class is not completed', async () => {
    coachingService.getGroupClassById.mockResolvedValue({
      id: GROUP_CLASS_ID,
      status: 'in-progress',
    });

    const input = createDoublesInput();

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_SOURCE_NOT_COMPLETED',
      statusCode: 409,
    });
  });

  // 错误码: MATCH_RECORD_SOURCE_NOT_COMPLETED — 私教课状态不是 completed（§6.4 步骤 3）
  it('should throw MATCH_RECORD_SOURCE_NOT_COMPLETED when private lesson is not completed', async () => {
    coachingService.getPrivateLessonById.mockResolvedValue({
      id: PRIVATE_LESSON_ID,
      status: 'confirmed',
    });

    const input = createSinglesInput({
      sourceType: 'private-lesson',
      sourceId: PRIVATE_LESSON_ID,
    });

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_SOURCE_NOT_COMPLETED',
      statusCode: 409,
    });
  });

  // 错误码: MATCH_RECORD_NOT_PARTICIPANT — 录入者不是活动参与者（§6.4 步骤 5）
  it('should throw MATCH_RECORD_NOT_PARTICIPANT when recorder is not participant', async () => {
    activityService.getParticipantIds.mockResolvedValue([
      USER_A_ID,
      USER_B_ID,
    ]);

    const input = createSinglesInput();

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_NOT_PARTICIPANT',
      statusCode: 403,
    });
  });

  // 错误码: MATCH_RECORD_NOT_PARTICIPANT — 录入者不是团课参与者（§6.4 步骤 5）
  it('should throw MATCH_RECORD_NOT_PARTICIPANT when recorder is not group class participant', async () => {
    coachingService.getParticipantIds.mockResolvedValue([
      USER_A_ID,
      USER_B_ID,
      USER_C_ID,
      USER_D_ID,
    ]);

    const input = createDoublesInput();

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_NOT_PARTICIPANT',
      statusCode: 403,
    });
  });

  // 错误码: MATCH_RECORD_PLAYER_NOT_PARTICIPANT — 指定的平台用户选手不是参与者（§6.4 步骤 6）
  it('should throw MATCH_RECORD_PLAYER_NOT_PARTICIPANT when player userId is not a participant', async () => {
    const NON_PARTICIPANT_ID = 'user-uuid-not-participant';
    activityService.getParticipantIds.mockResolvedValue([
      RECORDER_ID,
      USER_A_ID,
    ]);

    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [{ userId: NON_PARTICIPANT_ID }],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_PLAYER_NOT_PARTICIPANT',
      statusCode: 403,
    });
  });

  // 业务规则: guestName 选手不需要参与者校验（§6.4 — 仅 userId 类型的选手需校验）
  it('should not check participant for guest players', async () => {
    activityService.getParticipantIds.mockResolvedValue([
      RECORDER_ID,
      USER_A_ID,
    ]);

    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        players: [
          { id: 'p1', matchRecordId: MATCH_RECORD_ID, side: 'A', userId: USER_A_ID, guestId: null },
          { id: 'p2', matchRecordId: MATCH_RECORD_ID, side: 'B', userId: null, guestId: GUEST_PLAYER_ID },
        ],
      }),
    );

    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [{ guestName: '临时球友A' }],
      },
    } as any);

    // 不应抛出 MATCH_RECORD_PLAYER_NOT_PARTICIPANT
    const result = await service.createMatchRecord(RECORDER_ID, input);
    expect(result).toBeDefined();
  });

  // 边界: 合法 score 边界值 — scoreA = 0, scoreB = 1（§4 录入战绩 — 0-30 且不可同时为 0）
  it('should accept valid score at boundary (0 vs non-zero)', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        games: [
          { id: 'g1', matchRecordId: MATCH_RECORD_ID, gameNumber: 1, scoreA: 0, scoreB: 1 },
        ],
      }),
    );

    const input = createSinglesInput({
      games: [{ scoreA: 0, scoreB: 1 }],
    });

    const result = await service.createMatchRecord(RECORDER_ID, input);
    expect(result).toBeDefined();
    expect(result.games[0].scoreA).toBe(0);
    expect(result.games[0].scoreB).toBe(1);
  });

  // 边界: 合法 score 边界值 — scoreA = 30, scoreB = 30（§4 录入战绩 — 允许单局平局）
  it('should accept valid score at upper boundary (30 vs 30)', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        games: [
          { id: 'g1', matchRecordId: MATCH_RECORD_ID, gameNumber: 1, scoreA: 30, scoreB: 30 },
        ],
      }),
    );

    const input = createSinglesInput({
      games: [{ scoreA: 30, scoreB: 30 }],
    });

    const result = await service.createMatchRecord(RECORDER_ID, input);
    expect(result).toBeDefined();
  });

  // 业务规则: 每次录入创建新 GuestPlayer，不做去重（§6.5 注意事项）
  it('should create new GuestPlayer each time, no deduplication', async () => {
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        matchType: 'doubles',
        players: [
          { id: 'p1', matchRecordId: MATCH_RECORD_ID, side: 'A', userId: USER_A_ID, guestId: null },
          { id: 'p2', matchRecordId: MATCH_RECORD_ID, side: 'A', userId: null, guestId: 'guest-1' },
          { id: 'p3', matchRecordId: MATCH_RECORD_ID, side: 'B', userId: null, guestId: 'guest-2' },
          { id: 'p4', matchRecordId: MATCH_RECORD_ID, side: 'B', userId: null, guestId: 'guest-3' },
        ],
      }),
    );

    const input = createDoublesInput({
      players: {
        sideA: [{ userId: USER_A_ID }, { guestName: '临时球友A' }],
        sideB: [{ guestName: '临时球友A' }, { guestName: '临时球友B' }],
      },
    } as any);

    await service.createMatchRecord(RECORDER_ID, input);

    // 3 个 guestName → 3 次 createGuestPlayer 调用（同名也各自创建）
    expect(repo.createGuestPlayer).toHaveBeenCalledTimes(3);
  });

  // 边界: guestName 恰好 20 个字符（合法）
  it('should accept guestName with exactly 20 characters', async () => {
    const name20 = '一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾';
    repo.create.mockResolvedValue(
      createMatchRecordRecord({
        players: [
          { id: 'p1', matchRecordId: MATCH_RECORD_ID, side: 'A', userId: USER_A_ID, guestId: null },
          { id: 'p2', matchRecordId: MATCH_RECORD_ID, side: 'B', userId: null, guestId: GUEST_PLAYER_ID },
        ],
      }),
    );

    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [{ guestName: name20 }],
      },
    } as any);

    const result = await service.createMatchRecord(RECORDER_ID, input);
    expect(result).toBeDefined();
  });

  // 边界: guestName 恰好 21 个字符（不合法，§4 录入战绩错误码 MATCH_RECORD_INVALID_GUEST_NAME）
  it('should throw MATCH_RECORD_INVALID_GUEST_NAME when guestName has 21 chars', async () => {
    const name21 = '一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾壱';
    const input = createSinglesInput({
      players: {
        sideA: [{ userId: USER_A_ID }],
        sideB: [{ guestName: name21 }],
      },
    } as any);

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_GUEST_NAME',
      statusCode: 400,
    });
  });

  // 错误码: MATCH_RECORD_INVALID_SCORE — scoreA 非整数（§4 录入战绩 — 0-30 之间的整数）
  it('should throw MATCH_RECORD_INVALID_SCORE when score is not integer', async () => {
    const input = createSinglesInput({
      games: [{ scoreA: 21.5, scoreB: 18 }],
    });

    await expect(
      service.createMatchRecord(RECORDER_ID, input),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_INVALID_SCORE',
      statusCode: 400,
    });
  });
});

// ===========================================================================
// 删除战绩 — DELETE /api/match-records/:id
// ===========================================================================

describe('MatchRecordService.deleteMatchRecord', () => {
  let service: MatchRecordService;
  let repo: ReturnType<typeof createMockRepository>;
  let activityService: ReturnType<typeof createMockActivityService>;
  let coachingService: ReturnType<typeof createMockCoachingService>;
  let userService: ReturnType<typeof createMockUserService>;

  beforeEach(() => {
    repo = createMockRepository();
    activityService = createMockActivityService();
    coachingService = createMockCoachingService();
    userService = createMockUserService();
    service = new MatchRecordService(
      repo as unknown as MatchRecordRepository,
      activityService as any,
      coachingService as any,
      userService as any,
    );
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  // 业务规则: 录入者可删除自己录入的战绩（§4 删除战绩 — recordedBy === 当前用户 ID）
  it('should delete match record when requested by recorder', async () => {
    repo.findById.mockResolvedValue(
      createMatchRecordRecord({ recordedBy: RECORDER_ID }),
    );

    const result = await service.deleteMatchRecord(MATCH_RECORD_ID, RECORDER_ID);

    expect(result).toBeDefined();
    expect(result.id).toBe(MATCH_RECORD_ID);
    expect(repo.deleteById).toHaveBeenCalledWith(MATCH_RECORD_ID);
  });

  // 业务规则: 删除时级联删除关联的 MatchPlayer 和 MatchGame（§4 删除战绩 — ON DELETE CASCADE）
  it('should call deleteById to cascade delete players and games', async () => {
    repo.findById.mockResolvedValue(
      createMatchRecordRecord({ recordedBy: RECORDER_ID }),
    );

    await service.deleteMatchRecord(MATCH_RECORD_ID, RECORDER_ID);

    expect(repo.deleteById).toHaveBeenCalledWith(MATCH_RECORD_ID);
    // 级联删除由数据库层保证，Service 只需调用 deleteById
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  // 错误码: MATCH_RECORD_NOT_FOUND — 战绩记录不存在（§4 删除战绩错误码）
  it('should throw MATCH_RECORD_NOT_FOUND when record does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      service.deleteMatchRecord('nonexistent-id', RECORDER_ID),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_NOT_FOUND',
      statusCode: 404,
    });
  });

  // 错误码: MATCH_RECORD_NOT_RECORDER — 非录入者不可删除（§4 删除战绩错误码）
  it('should throw MATCH_RECORD_NOT_RECORDER when user is not the recorder', async () => {
    repo.findById.mockResolvedValue(
      createMatchRecordRecord({ recordedBy: RECORDER_ID }),
    );

    const OTHER_USER_ID = 'user-uuid-other';

    await expect(
      service.deleteMatchRecord(MATCH_RECORD_ID, OTHER_USER_ID),
    ).rejects.toMatchObject({
      code: 'MATCH_RECORD_NOT_RECORDER',
      statusCode: 403,
    });
  });

  // 业务规则: 删除后返回被删除记录的 id（§4 删除战绩 Response 200）
  it('should return deleted record id', async () => {
    repo.findById.mockResolvedValue(
      createMatchRecordRecord({ recordedBy: RECORDER_ID }),
    );

    const result = await service.deleteMatchRecord(MATCH_RECORD_ID, RECORDER_ID);

    expect(result).toEqual({ id: MATCH_RECORD_ID });
  });
});
