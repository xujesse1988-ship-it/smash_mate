/**
 * 契约测试: web-app/match-record — API 调用层
 * 覆盖接口:
 *   - POST   /api/match-records                  (录入战绩)
 *   - DELETE /api/match-records/:id              (删除战绩)
 *   - GET    /api/activities/:id/match-records   (活动战绩列表)
 *   - GET    /api/group-classes/:id/match-records(团课战绩列表)
 *   - GET    /api/private-lessons/:id/match-records(私教课战绩列表)
 *   - GET    /api/users/:id/match-records        (个人战绩历史)
 *   - GET    /api/users/:id/match-stats          (个人战绩汇总)
 *
 * 来源文档:
 *   - docs/module-design/match-record.md §4 接口契约
 *   - docs/module-design/web-app-match-record.md §5 消费的后端接口汇总
 *   - docs/module-design/web-app-match-record.md §6.2 请求体构建
 *
 * Mock 策略:
 *   - MSW (Mock Service Worker) 拦截 HTTP 请求
 *   - 验证请求 URL、HTTP 方法、请求体/查询参数格式
 *   - 验证成功响应和错误响应的解析
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  createMatchRecord,
  deleteMatchRecord,
  getSourceMatchRecords,
  getUserMatchRecords,
  getUserMatchStats,
} from '@web/features/match-record/api/match-record-api';

// ---------------------------------------------------------------------------
// MSW Server Setup
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// 来源: match-record.md §4 — 录入战绩 — Response 201
const mockMatchRecordResponse = {
  id: 'match-uuid-1',
  sourceType: 'activity',
  sourceId: 'activity-uuid-1',
  matchType: 'singles',
  recordedBy: 'user-uuid-1',
  recorder: {
    id: 'user-uuid-1',
    nickname: '王五',
    avatarUrl: 'https://example.com/avatar.jpg',
  },
  players: {
    sideA: [
      { userId: 'user-uuid-2', nickname: '张三', avatarUrl: 'https://example.com/a1.jpg' },
    ],
    sideB: [
      { guestId: 'guest-uuid-1', nickname: '临时球友A' },
    ],
  },
  games: [
    { gameNumber: 1, scoreA: 21, scoreB: 18 },
    { gameNumber: 2, scoreA: 21, scoreB: 15 },
  ],
  result: 'A_WIN',
  createdAt: '2026-04-05T18:30:00.000Z',
};

// 来源: match-record.md §4 — 个人战绩历史 — Response 200
const mockUserMatchRecord = {
  ...mockMatchRecordResponse,
  userResult: 'WIN',
};

// 来源: match-record.md §4 — 个人战绩汇总 — Response 200
const mockMatchStats = {
  totalMatches: 42,
  wins: 25,
  losses: 15,
  draws: 2,
  winRate: 62.5,
};

// ---------------------------------------------------------------------------
// POST /api/match-records — 录入战绩
// ---------------------------------------------------------------------------

describe('createMatchRecord API', () => {
  // 来源: match-record.md §4 — 录入战绩 — Request (POST 方法、URL)
  it('should send POST request to /api/match-records', async () => {
    let capturedMethod = '';
    let capturedUrl = '';

    server.use(
      http.post('/api/match-records', ({ request }) => {
        capturedMethod = request.method;
        capturedUrl = request.url;
        return HttpResponse.json(
          { data: mockMatchRecordResponse },
          { status: 201 },
        );
      }),
    );

    await createMatchRecord({
      sourceType: 'activity',
      sourceId: 'activity-uuid-1',
      matchType: 'singles',
      players: {
        sideA: [{ userId: 'user-uuid-2' }],
        sideB: [{ guestName: '临时球友A' }],
      },
      games: [
        { scoreA: 21, scoreB: 18 },
        { scoreA: 21, scoreB: 15 },
      ],
    });

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toContain('/api/match-records');
  });

  // 来源: match-record.md §4 — 录入战绩 — Request Body
  // 来源: web-app-match-record.md §6.2 — 请求体构建（players 结构为 { sideA, sideB }）
  it('should send correct request body with players as { sideA, sideB } structure', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/match-records', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { data: mockMatchRecordResponse },
          { status: 201 },
        );
      }),
    );

    await createMatchRecord({
      sourceType: 'activity',
      sourceId: 'activity-uuid-1',
      matchType: 'singles',
      players: {
        sideA: [{ userId: 'user-uuid-2' }],
        sideB: [{ guestName: '临时球友A' }],
      },
      games: [
        { scoreA: 21, scoreB: 18 },
        { scoreA: 21, scoreB: 15 },
      ],
    });

    expect(capturedBody).toEqual({
      sourceType: 'activity',
      sourceId: 'activity-uuid-1',
      matchType: 'singles',
      players: {
        sideA: [{ userId: 'user-uuid-2' }],
        sideB: [{ guestName: '临时球友A' }],
      },
      games: [
        { scoreA: 21, scoreB: 18 },
        { scoreA: 21, scoreB: 15 },
      ],
    });
  });

  // 来源: match-record.md §4 — 录入战绩 — Request Body — 双打模式
  it('should send doubles match with 2 players per side', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/match-records', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { data: { ...mockMatchRecordResponse, matchType: 'doubles' } },
          { status: 201 },
        );
      }),
    );

    await createMatchRecord({
      sourceType: 'group-class',
      sourceId: 'gc-uuid-1',
      matchType: 'doubles',
      players: {
        sideA: [
          { userId: 'user-uuid-1' },
          { userId: 'user-uuid-2' },
        ],
        sideB: [
          { userId: 'user-uuid-3' },
          { guestName: '临时球友B' },
        ],
      },
      games: [
        { scoreA: 21, scoreB: 19 },
      ],
    });

    const body = capturedBody as {
      players: {
        sideA: Array<{ userId?: string; guestName?: string }>;
        sideB: Array<{ userId?: string; guestName?: string }>;
      };
    };
    expect(body.players.sideA).toHaveLength(2);
    expect(body.players.sideB).toHaveLength(2);
    expect(body.matchType).toBe('doubles');
  });

  // 来源: match-record.md §4 — 录入战绩 — Response 201
  it('should parse successful response and return match record data', async () => {
    server.use(
      http.post('/api/match-records', () => {
        return HttpResponse.json(
          { data: mockMatchRecordResponse },
          { status: 201 },
        );
      }),
    );

    const result = await createMatchRecord({
      sourceType: 'activity',
      sourceId: 'activity-uuid-1',
      matchType: 'singles',
      players: {
        sideA: [{ userId: 'user-uuid-2' }],
        sideB: [{ guestName: '临时球友A' }],
      },
      games: [{ scoreA: 21, scoreB: 18 }],
    });

    expect(result).toMatchObject({
      id: 'match-uuid-1',
      sourceType: 'activity',
      sourceId: 'activity-uuid-1',
      matchType: 'singles',
      recordedBy: 'user-uuid-1',
      result: 'A_WIN',
    });
    expect(result.recorder).toEqual({
      id: 'user-uuid-1',
      nickname: '王五',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
    expect(result.players.sideA).toHaveLength(1);
    expect(result.players.sideB).toHaveLength(1);
    expect(result.games).toHaveLength(2);
  });

  // 来源: match-record.md §4 — 录入战绩 — 错误码 — MATCH_RECORD_SOURCE_NOT_FOUND
  it('should throw error with code when source not found', async () => {
    server.use(
      http.post('/api/match-records', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'MATCH_RECORD_SOURCE_NOT_FOUND',
              message: '来源活动/课程不存在',
            },
          },
          { status: 404 },
        );
      }),
    );

    await expect(
      createMatchRecord({
        sourceType: 'activity',
        sourceId: 'nonexistent-id',
        matchType: 'singles',
        players: {
          sideA: [{ userId: 'user-uuid-2' }],
          sideB: [{ guestName: '临时球友A' }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      }),
    ).rejects.toMatchObject({ code: 'MATCH_RECORD_SOURCE_NOT_FOUND' });
  });

  // 来源: match-record.md §4 — 录入战绩 — 错误码 — MATCH_RECORD_SOURCE_NOT_COMPLETED
  it('should throw error with code when source not completed', async () => {
    server.use(
      http.post('/api/match-records', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'MATCH_RECORD_SOURCE_NOT_COMPLETED',
              message: '活动/课程尚未结束',
            },
          },
          { status: 409 },
        );
      }),
    );

    await expect(
      createMatchRecord({
        sourceType: 'activity',
        sourceId: 'active-id',
        matchType: 'singles',
        players: {
          sideA: [{ userId: 'user-uuid-2' }],
          sideB: [{ guestName: '临时球友A' }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      }),
    ).rejects.toMatchObject({ code: 'MATCH_RECORD_SOURCE_NOT_COMPLETED' });
  });

  // 来源: match-record.md §4 — 录入战绩 — 错误码 — MATCH_RECORD_NOT_PARTICIPANT
  it('should throw error with code when user is not a participant', async () => {
    server.use(
      http.post('/api/match-records', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'MATCH_RECORD_NOT_PARTICIPANT',
              message: '录入者不是该活动/课程的参与者',
            },
          },
          { status: 403 },
        );
      }),
    );

    await expect(
      createMatchRecord({
        sourceType: 'activity',
        sourceId: 'activity-uuid-1',
        matchType: 'singles',
        players: {
          sideA: [{ userId: 'user-uuid-2' }],
          sideB: [{ guestName: '临时球友A' }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      }),
    ).rejects.toMatchObject({ code: 'MATCH_RECORD_NOT_PARTICIPANT' });
  });

  // 来源: match-record.md §4 — 录入战绩 — 错误码 — MATCH_RECORD_INVALID_PLAYERS
  it('should throw error with code when player count is invalid', async () => {
    server.use(
      http.post('/api/match-records', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'MATCH_RECORD_INVALID_PLAYERS',
              message: '选手数量不符合比赛类型要求',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      createMatchRecord({
        sourceType: 'activity',
        sourceId: 'activity-uuid-1',
        matchType: 'singles',
        players: {
          sideA: [{ userId: 'user-uuid-2' }, { userId: 'user-uuid-3' }],
          sideB: [{ guestName: '临时球友A' }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      }),
    ).rejects.toMatchObject({ code: 'MATCH_RECORD_INVALID_PLAYERS' });
  });

  // 来源: match-record.md §4 — 录入战绩 — 错误码 — MATCH_RECORD_DUPLICATE_PLAYER
  it('should throw error with code when same player on both sides', async () => {
    server.use(
      http.post('/api/match-records', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'MATCH_RECORD_DUPLICATE_PLAYER',
              message: '同一选手出现在两侧',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      createMatchRecord({
        sourceType: 'activity',
        sourceId: 'activity-uuid-1',
        matchType: 'singles',
        players: {
          sideA: [{ userId: 'user-uuid-2' }],
          sideB: [{ userId: 'user-uuid-2' }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      }),
    ).rejects.toMatchObject({ code: 'MATCH_RECORD_DUPLICATE_PLAYER' });
  });

  // 来源: match-record.md §4 — 录入战绩 — 错误码 — MATCH_RECORD_INVALID_SCORE
  it('should throw error with code when score is invalid', async () => {
    server.use(
      http.post('/api/match-records', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'MATCH_RECORD_INVALID_SCORE',
              message: '单局比分不在0-30范围内',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      createMatchRecord({
        sourceType: 'activity',
        sourceId: 'activity-uuid-1',
        matchType: 'singles',
        players: {
          sideA: [{ userId: 'user-uuid-2' }],
          sideB: [{ guestName: '临时球友A' }],
        },
        games: [{ scoreA: 0, scoreB: 0 }],
      }),
    ).rejects.toMatchObject({ code: 'MATCH_RECORD_INVALID_SCORE' });
  });

  // 来源: match-record.md §4 — 录入战绩 — Request — 认证要求
  it('should include Authorization header in request', async () => {
    let capturedAuthHeader = '';

    // Set up a mock token in localStorage
    localStorage.setItem('token', 'test-jwt-token');

    server.use(
      http.post('/api/match-records', ({ request }) => {
        capturedAuthHeader = request.headers.get('Authorization') || '';
        return HttpResponse.json(
          { data: mockMatchRecordResponse },
          { status: 201 },
        );
      }),
    );

    await createMatchRecord({
      sourceType: 'activity',
      sourceId: 'activity-uuid-1',
      matchType: 'singles',
      players: {
        sideA: [{ userId: 'user-uuid-2' }],
        sideB: [{ guestName: '临时球友A' }],
      },
      games: [{ scoreA: 21, scoreB: 18 }],
    });

    expect(capturedAuthHeader).toBe('Bearer test-jwt-token');

    localStorage.removeItem('token');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/match-records/:id — 删除战绩
// ---------------------------------------------------------------------------

describe('deleteMatchRecord API', () => {
  // 来源: match-record.md §4 — 删除战绩 — Request (DELETE 方法、URL)
  it('should send DELETE request to /api/match-records/:id', async () => {
    let capturedMethod = '';
    let capturedUrl = '';

    server.use(
      http.delete('/api/match-records/:id', ({ request }) => {
        capturedMethod = request.method;
        capturedUrl = request.url;
        return HttpResponse.json({ data: { id: 'match-uuid-1' } });
      }),
    );

    await deleteMatchRecord('match-uuid-1');

    expect(capturedMethod).toBe('DELETE');
    expect(capturedUrl).toContain('/api/match-records/match-uuid-1');
  });

  // 来源: match-record.md §4 — 删除战绩 — 错误码 — MATCH_RECORD_NOT_FOUND
  it('should throw error with code when match record not found', async () => {
    server.use(
      http.delete('/api/match-records/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'MATCH_RECORD_NOT_FOUND',
              message: '战绩记录不存在',
            },
          },
          { status: 404 },
        );
      }),
    );

    await expect(
      deleteMatchRecord('nonexistent-id'),
    ).rejects.toMatchObject({ code: 'MATCH_RECORD_NOT_FOUND' });
  });

  // 来源: match-record.md §4 — 删除战绩 — 错误码 — MATCH_RECORD_NOT_RECORDER
  it('should throw error with code when user is not the recorder', async () => {
    server.use(
      http.delete('/api/match-records/:id', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'MATCH_RECORD_NOT_RECORDER',
              message: '当前用户不是该战绩的录入者',
            },
          },
          { status: 403 },
        );
      }),
    );

    await expect(
      deleteMatchRecord('match-uuid-1'),
    ).rejects.toMatchObject({ code: 'MATCH_RECORD_NOT_RECORDER' });
  });
});

// ---------------------------------------------------------------------------
// GET /api/{source-pluralized}/:id/match-records — 来源战绩列表
// ---------------------------------------------------------------------------

describe('getSourceMatchRecords API', () => {
  // 来源: match-record.md §4 — 活动的战绩列表 — Request (GET, /api/activities/:id/match-records)
  it('should send GET request to /api/activities/:id/match-records for activity source', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities/:id/match-records', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [mockMatchRecordResponse] },
        });
      }),
    );

    await getSourceMatchRecords('activity', 'activity-uuid-1', {});

    expect(capturedUrl).toContain('/api/activities/activity-uuid-1/match-records');
  });

  // 来源: match-record.md §4 — 团课的战绩列表 — Request (GET, /api/group-classes/:id/match-records)
  it('should send GET request to /api/group-classes/:id/match-records for group-class source', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/group-classes/:id/match-records', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [mockMatchRecordResponse] },
        });
      }),
    );

    await getSourceMatchRecords('group-class', 'gc-uuid-1', {});

    expect(capturedUrl).toContain('/api/group-classes/gc-uuid-1/match-records');
  });

  // 来源: match-record.md §4 — 私教课的战绩列表 — Request (GET, /api/private-lessons/:id/match-records)
  it('should send GET request to /api/private-lessons/:id/match-records for private-lesson source', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/private-lessons/:id/match-records', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [] },
        });
      }),
    );

    await getSourceMatchRecords('private-lesson', 'pl-uuid-1', {});

    expect(capturedUrl).toContain('/api/private-lessons/pl-uuid-1/match-records');
  });

  // 来源: match-record.md §4 — 活动的战绩列表 — Response 200
  it('should parse response items with match record details', async () => {
    server.use(
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({
          data: { items: [mockMatchRecordResponse] },
        });
      }),
    );

    const result = await getSourceMatchRecords('activity', 'activity-uuid-1', {});

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'match-uuid-1',
      matchType: 'singles',
      result: 'A_WIN',
    });
    expect(result.items[0].players.sideA).toHaveLength(1);
    expect(result.items[0].players.sideB).toHaveLength(1);
    expect(result.items[0].games).toHaveLength(2);
  });

  // 来源: match-record.md §4 — 活动的战绩列表 — 业务规则 — 不存在时返回空列表
  it('should return empty items when source has no match records', async () => {
    server.use(
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({
          data: { items: [] },
        });
      }),
    );

    const result = await getSourceMatchRecords('activity', 'nonexistent-id', {});

    expect(result.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/:id/match-records — 个人战绩历史
// ---------------------------------------------------------------------------

describe('getUserMatchRecords API', () => {
  // 来源: match-record.md §4 — 个人战绩历史 — Request (GET, URL)
  it('should send GET request to /api/users/:id/match-records', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/match-records', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getUserMatchRecords('user-uuid-1', {});

    expect(capturedUrl).toContain('/api/users/user-uuid-1/match-records');
  });

  // 来源: match-record.md §4 — 个人战绩历史 — Query Parameters — page, pageSize
  it('should include page and pageSize query parameters', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/match-records', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 2, pageSize: 10 },
        });
      }),
    );

    await getUserMatchRecords('user-uuid-1', { page: 2, pageSize: 10 });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('10');
  });

  // 来源: match-record.md §4 — 个人战绩历史 — Query Parameters — sourceType 筛选
  it('should include sourceType query parameter when provided', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/match-records', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    await getUserMatchRecords('user-uuid-1', {
      page: 1,
      pageSize: 20,
      sourceType: 'activity',
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('sourceType')).toBe('activity');
  });

  // 来源: match-record.md §4 — 个人战绩历史 — Response 200
  it('should parse paginated response with match records including userResult', async () => {
    server.use(
      http.get('/api/users/:id/match-records', () => {
        return HttpResponse.json({
          data: {
            items: [mockUserMatchRecord],
            total: 42,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const result = await getUserMatchRecords('user-uuid-1', { page: 1, pageSize: 20 });

    expect(result.total).toBe(42);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'match-uuid-1',
      matchType: 'singles',
      result: 'A_WIN',
      userResult: 'WIN',
    });
  });

  // 来源: match-record.md §4 — 个人战绩历史 — Response 200 — 空结果
  it('should return empty items when user has no match records', async () => {
    server.use(
      http.get('/api/users/:id/match-records', () => {
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    const result = await getUserMatchRecords('user-uuid-1', {});

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/:id/match-stats — 个人战绩汇总
// ---------------------------------------------------------------------------

describe('getUserMatchStats API', () => {
  // 来源: match-record.md §4 — 个人战绩汇总 — Request (GET, URL)
  it('should send GET request to /api/users/:id/match-stats', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/match-stats', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: mockMatchStats });
      }),
    );

    await getUserMatchStats('user-uuid-1');

    expect(capturedUrl).toContain('/api/users/user-uuid-1/match-stats');
  });

  // 来源: match-record.md §4 — 个人战绩汇总 — Response 200
  it('should parse match stats response with all fields', async () => {
    server.use(
      http.get('/api/users/:id/match-stats', () => {
        return HttpResponse.json({ data: mockMatchStats });
      }),
    );

    const result = await getUserMatchStats('user-uuid-1');

    expect(result).toEqual({
      totalMatches: 42,
      wins: 25,
      losses: 15,
      draws: 2,
      winRate: 62.5,
    });
  });

  // 来源: match-record.md §4 — 个人战绩汇总 — 业务规则 — 无战绩时返回全 0
  it('should return all-zero stats when user has no match records', async () => {
    server.use(
      http.get('/api/users/:id/match-stats', () => {
        return HttpResponse.json({
          data: {
            totalMatches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
          },
        });
      }),
    );

    const result = await getUserMatchStats('user-uuid-1');

    expect(result).toEqual({
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
    });
  });

  // 来源: match-record.md §4 — 个人战绩汇总 — Request — 认证要求
  it('should include Authorization header', async () => {
    let capturedAuthHeader = '';
    localStorage.setItem('token', 'test-jwt-token');

    server.use(
      http.get('/api/users/:id/match-stats', ({ request }) => {
        capturedAuthHeader = request.headers.get('Authorization') || '';
        return HttpResponse.json({ data: mockMatchStats });
      }),
    );

    await getUserMatchStats('user-uuid-1');

    expect(capturedAuthHeader).toBe('Bearer test-jwt-token');
    localStorage.removeItem('token');
  });
});
