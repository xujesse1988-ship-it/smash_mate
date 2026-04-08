/**
 * 契约测试: web-app/profile — API 调用层
 * 覆盖接口:
 *   - GET /api/users/:id（用户公开信息）
 *   - GET /api/users/:id/match-stats（战绩汇总）
 *   - GET /api/users/me（当前用户信息）
 *   - PUT /api/users/me（更新个人资料）
 *   - PUT /api/users/me/coach-role（开启教练角色）
 *
 * 来源文档:
 *   - docs/module-design/user.md §4 接口契约（获取用户公开信息、获取当前用户、更新个人资料、开启教练角色）
 *   - docs/module-design/match-record.md §4 接口契约（个人战绩汇总）
 *   - docs/module-design/web-app-profile.md §5 消费的后端接口汇总
 *
 * Mock 策略:
 *   - MSW (Mock Service Worker) 拦截 HTTP 请求
 *   - 验证请求 URL、HTTP 方法、请求体格式
 *   - 验证成功响应和错误响应的解析
 *
 * 注: 教练资料相关的 GET /api/coaches/:id 和 PUT /api/coaches/me 已在
 *     coaching-api.test.ts 中覆盖，此处不重复测试。
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  getUserPublicInfo,
  getMatchStats,
  getCurrentUser,
  updateProfile,
  enableCoachRole,
} from '@web/features/profile/api/profile-api';

// ---------------------------------------------------------------------------
// MSW Server Setup
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// GET /api/users/:id
// ---------------------------------------------------------------------------

describe('getUserPublicInfo API', () => {
  // 来源: user.md §4 — 获取用户公开信息 — Request（Path Params）
  it('should send GET request to /api/users/:id', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            nickname: '球友A',
            avatarUrl: 'https://example.com/avatar.jpg',
            bio: '热爱羽毛球',
            isCoach: false,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    await getUserPublicInfo('user-uuid-1');

    expect(capturedUrl).toBe('/api/users/user-uuid-1');
  });

  // 来源: user.md §4 — 获取用户公开信息 — Response 200
  it('should return user public info from successful response', async () => {
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            nickname: '球友A',
            avatarUrl: 'https://example.com/avatar.jpg',
            bio: '热爱羽毛球',
            isCoach: false,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    const result = await getUserPublicInfo('user-uuid-1');

    expect(result).toEqual({
      id: 'user-uuid-1',
      nickname: '球友A',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: '热爱羽毛球',
      isCoach: false,
      createdAt: '2026-04-01T10:00:00.000Z',
    });
  });

  // 来源: user.md §4 — 获取用户公开信息 — 业务规则：公开信息不包含 phone 字段
  it('should not include phone field in response', async () => {
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            nickname: '球友A',
            avatarUrl: null,
            bio: null,
            isCoach: false,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    const result = await getUserPublicInfo('user-uuid-1');

    expect(result).not.toHaveProperty('phone');
  });

  // 来源: user.md §4 — 获取用户公开信息 — 错误码 USER_NOT_FOUND
  it('should throw error with code USER_NOT_FOUND when user does not exist', async () => {
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json(
          {
            error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
          },
          { status: 404 },
        );
      }),
    );

    await expect(getUserPublicInfo('nonexistent-id')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/:id/match-stats
// ---------------------------------------------------------------------------

describe('getMatchStats API', () => {
  // 来源: match-record.md §4 — 个人战绩汇总 — Request（Path Params）
  it('should send GET request to /api/users/:id/match-stats', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/match-stats', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        return HttpResponse.json({
          data: {
            totalMatches: 42,
            wins: 25,
            losses: 15,
            draws: 2,
            winRate: 62.5,
          },
        });
      }),
    );

    await getMatchStats('user-uuid-1');

    expect(capturedUrl).toBe('/api/users/user-uuid-1/match-stats');
  });

  // 来源: match-record.md §4 — 个人战绩汇总 — Response 200
  it('should return match stats from successful response', async () => {
    server.use(
      http.get('/api/users/:id/match-stats', () => {
        return HttpResponse.json({
          data: {
            totalMatches: 42,
            wins: 25,
            losses: 15,
            draws: 2,
            winRate: 62.5,
          },
        });
      }),
    );

    const result = await getMatchStats('user-uuid-1');

    expect(result).toEqual({
      totalMatches: 42,
      wins: 25,
      losses: 15,
      draws: 2,
      winRate: 62.5,
    });
  });

  // 来源: match-record.md §4 — 个人战绩汇总 — 业务规则：无战绩时返回全 0
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

    const result = await getMatchStats('user-uuid-new');

    expect(result.totalMatches).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.draws).toBe(0);
    expect(result.winRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/me
// ---------------------------------------------------------------------------

describe('getCurrentUser API', () => {
  // 来源: user.md §4 — 获取当前用户信息 — Request
  it('should send GET request to /api/users/me', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.get('/api/users/me', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            phone: '138****1234',
            nickname: '球友A',
            avatarUrl: 'https://example.com/avatar.jpg',
            bio: '热爱羽毛球',
            isCoach: false,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    await getCurrentUser();

    expect(capturedUrl).toBe('/api/users/me');
    expect(capturedMethod).toBe('GET');
  });

  // 来源: user.md §4 — 获取当前用户信息 — Response 200
  it('should return current user info from successful response', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            phone: '138****1234',
            nickname: '球友A',
            avatarUrl: 'https://example.com/avatar.jpg',
            bio: '热爱羽毛球',
            isCoach: false,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    const result = await getCurrentUser();

    expect(result).toEqual({
      id: 'user-uuid-1',
      phone: '138****1234',
      nickname: '球友A',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: '热爱羽毛球',
      isCoach: false,
      createdAt: '2026-04-01T10:00:00.000Z',
    });
  });

  // 来源: user.md §4 — 获取当前用户信息 — 业务规则：phone 字段做脱敏处理
  it('should receive desensitized phone in response', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            phone: '138****1234',
            nickname: '球友A',
            avatarUrl: null,
            bio: null,
            isCoach: false,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    const result = await getCurrentUser();

    expect(result.phone).toMatch(/^\d{3}\*{4}\d{4}$/);
  });

  // 来源: user.md §4 — 获取当前用户信息 — 错误码 USER_NOT_FOUND
  it('should throw error with code USER_NOT_FOUND when user does not exist', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json(
          {
            error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
          },
          { status: 404 },
        );
      }),
    );

    await expect(getCurrentUser()).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// PUT /api/users/me
// ---------------------------------------------------------------------------

describe('updateProfile API', () => {
  // 来源: user.md §4 — 更新个人资料 — Request Body
  it('should send PUT request to /api/users/me with profile data', async () => {
    let capturedBody: unknown = null;
    let capturedMethod = '';

    server.use(
      http.put('/api/users/me', async ({ request }) => {
        capturedBody = await request.json();
        capturedMethod = request.method;
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            phone: '138****1234',
            nickname: '新昵称',
            avatarUrl: 'https://example.com/new-avatar.jpg',
            bio: '新简介',
            isCoach: false,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    await updateProfile({
      nickname: '新昵称',
      avatarUrl: 'https://example.com/new-avatar.jpg',
      bio: '新简介',
    });

    expect(capturedMethod).toBe('PUT');
    expect(capturedBody).toEqual({
      nickname: '新昵称',
      avatarUrl: 'https://example.com/new-avatar.jpg',
      bio: '新简介',
    });
  });

  // 来源: web-app-profile.md §2 — ProfileEditPage 交互流程 — 仅发送有变更的字段
  it('should only send changed fields in request body', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.put('/api/users/me', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            phone: '138****1234',
            nickname: '新昵称',
            avatarUrl: null,
            bio: null,
            isCoach: false,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    await updateProfile({ nickname: '新昵称' });

    expect(capturedBody).toEqual({ nickname: '新昵称' });
    expect(capturedBody).not.toHaveProperty('avatarUrl');
    expect(capturedBody).not.toHaveProperty('bio');
  });

  // 来源: user.md §4 — 更新个人资料 — Response 200
  it('should return updated user info from successful response', async () => {
    server.use(
      http.put('/api/users/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            phone: '138****1234',
            nickname: '新昵称',
            avatarUrl: 'https://example.com/new-avatar.jpg',
            bio: '新简介',
            isCoach: false,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    const result = await updateProfile({ nickname: '新昵称' });

    expect(result).toEqual({
      id: 'user-uuid-1',
      phone: '138****1234',
      nickname: '新昵称',
      avatarUrl: 'https://example.com/new-avatar.jpg',
      bio: '新简介',
      isCoach: false,
      createdAt: '2026-04-01T10:00:00.000Z',
    });
  });

  // 来源: user.md §4 — 更新个人资料 — 错误码 USER_INVALID_NICKNAME
  it('should throw error with code USER_INVALID_NICKNAME for invalid nickname', async () => {
    server.use(
      http.put('/api/users/me', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'USER_INVALID_NICKNAME',
              message: '昵称为空或长度不在 2-20 之间',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateProfile({ nickname: 'x' }),
    ).rejects.toMatchObject({
      code: 'USER_INVALID_NICKNAME',
    });
  });

  // 来源: user.md §4 — 更新个人资料 — 错误码 USER_INVALID_BIO
  it('should throw error with code USER_INVALID_BIO for bio exceeding limit', async () => {
    server.use(
      http.put('/api/users/me', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'USER_INVALID_BIO',
              message: '简介超过 200 字符',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateProfile({ bio: 'x'.repeat(201) }),
    ).rejects.toMatchObject({
      code: 'USER_INVALID_BIO',
    });
  });

  // 来源: user.md §4 — 更新个人资料 — 错误码 USER_INVALID_AVATAR_URL
  it('should throw error with code USER_INVALID_AVATAR_URL for invalid avatar URL', async () => {
    server.use(
      http.put('/api/users/me', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'USER_INVALID_AVATAR_URL',
              message: '头像 URL 格式不合法',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(
      updateProfile({ avatarUrl: 'not-a-url' }),
    ).rejects.toMatchObject({
      code: 'USER_INVALID_AVATAR_URL',
    });
  });
});

// ---------------------------------------------------------------------------
// PUT /api/users/me/coach-role
// ---------------------------------------------------------------------------

describe('enableCoachRole API', () => {
  // 来源: user.md §4 — 开启教练角色 — Request Body
  it('should send PUT request to /api/users/me/coach-role with isCoach: true', async () => {
    let capturedUrl = '';
    let capturedBody: unknown = null;
    let capturedMethod = '';

    server.use(
      http.put('/api/users/me/coach-role', async ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedBody = await request.json();
        capturedMethod = request.method;
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            phone: '138****1234',
            nickname: '球友A',
            avatarUrl: null,
            bio: null,
            isCoach: true,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    await enableCoachRole();

    expect(capturedUrl).toBe('/api/users/me/coach-role');
    expect(capturedMethod).toBe('PUT');
    expect(capturedBody).toEqual({ isCoach: true });
  });

  // 来源: user.md §4 — 开启教练角色 — Response 200
  it('should return updated user info with isCoach=true', async () => {
    server.use(
      http.put('/api/users/me/coach-role', () => {
        return HttpResponse.json({
          data: {
            id: 'user-uuid-1',
            phone: '138****1234',
            nickname: '球友A',
            avatarUrl: null,
            bio: null,
            isCoach: true,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        });
      }),
    );

    const result = await enableCoachRole();

    expect(result.isCoach).toBe(true);
  });

  // 来源: user.md §4 — 开启教练角色 — 错误码 USER_INVALID_COACH_ROLE
  it('should throw error with code USER_INVALID_COACH_ROLE for invalid request', async () => {
    server.use(
      http.put('/api/users/me/coach-role', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'USER_INVALID_COACH_ROLE',
              message: 'isCoach 字段缺失或非布尔值',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(enableCoachRole()).rejects.toMatchObject({
      code: 'USER_INVALID_COACH_ROLE',
    });
  });

  // 来源: user.md §4 — 开启教练角色 — 错误码 USER_COACH_ROLE_CLOSE_NOT_SUPPORTED
  it('should throw error with code USER_COACH_ROLE_CLOSE_NOT_SUPPORTED', async () => {
    server.use(
      http.put('/api/users/me/coach-role', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'USER_COACH_ROLE_CLOSE_NOT_SUPPORTED',
              message: '一期不支持关闭教练角色',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(enableCoachRole()).rejects.toMatchObject({
      code: 'USER_COACH_ROLE_CLOSE_NOT_SUPPORTED',
    });
  });
});
