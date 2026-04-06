/**
 * 契约测试: web-app/auth — API 调用层
 * 覆盖接口: POST /api/auth/send-code, POST /api/auth/login
 *
 * 来源文档:
 *   - docs/module-design/user.md §4 接口契约（发送验证码、登录/注册）
 *   - docs/module-design/web-app-auth.md §5 消费的后端接口汇总
 *
 * Mock 策略:
 *   - MSW (Mock Service Worker) 拦截 HTTP 请求
 *   - 验证请求 URL、HTTP 方法、请求体格式
 *   - 验证成功响应和错误响应的解析
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { sendCode, login } from '@web/features/auth/api/auth-api';

// ---------------------------------------------------------------------------
// MSW Server Setup
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// POST /api/auth/send-code
// ---------------------------------------------------------------------------

describe('sendCode API', () => {
  // 来源: user.md §4 — 发送验证码 — Request Body
  it('should send POST request to /api/auth/send-code with phone in body', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/auth/send-code', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          data: { message: '验证码已发送' },
        });
      }),
    );

    await sendCode('13800001234');

    expect(capturedBody).toEqual({ phone: '13800001234' });
  });

  // 来源: user.md §4 — 发送验证码 — Response 200
  it('should return message from successful response', async () => {
    server.use(
      http.post('/api/auth/send-code', () => {
        return HttpResponse.json({
          data: { message: '验证码已发送' },
        });
      }),
    );

    const result = await sendCode('13800001234');

    expect(result).toEqual({ message: '验证码已发送' });
  });

  // 来源: user.md §4 — 发送验证码 — 错误码 AUTH_INVALID_PHONE
  it('should throw error with code AUTH_INVALID_PHONE for invalid phone', async () => {
    server.use(
      http.post('/api/auth/send-code', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_INVALID_PHONE', message: '手机号格式不合法' },
          },
          { status: 400 },
        );
      }),
    );

    await expect(sendCode('123')).rejects.toMatchObject({
      code: 'AUTH_INVALID_PHONE',
    });
  });

  // 来源: user.md §4 — 发送验证码 — 错误码 AUTH_CODE_RATE_LIMITED
  it('should throw error with code AUTH_CODE_RATE_LIMITED when rate limited', async () => {
    server.use(
      http.post('/api/auth/send-code', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'AUTH_CODE_RATE_LIMITED',
              message: '60 秒内重复发送',
            },
          },
          { status: 429 },
        );
      }),
    );

    await expect(sendCode('13800001234')).rejects.toMatchObject({
      code: 'AUTH_CODE_RATE_LIMITED',
    });
  });

  // 来源: user.md §4 — 发送验证码 — 错误码 AUTH_PHONE_LOCKED
  it('should throw error with code AUTH_PHONE_LOCKED when phone is locked', async () => {
    server.use(
      http.post('/api/auth/send-code', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'AUTH_PHONE_LOCKED',
              message: '该手机号已被锁定',
            },
          },
          { status: 429 },
        );
      }),
    );

    await expect(sendCode('13800001234')).rejects.toMatchObject({
      code: 'AUTH_PHONE_LOCKED',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('login API', () => {
  // 来源: user.md §4 — 登录/注册 — Request Body（登录场景，不传 isCoach）
  it('should send POST request to /api/auth/login with phone and code', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          data: {
            token: 'jwt-token-string',
            user: {
              id: 'uuid-1',
              phone: '138****1234',
              nickname: '球友12345',
              avatarUrl: null,
              bio: null,
              isCoach: false,
              createdAt: '2026-04-01T10:00:00.000Z',
            },
            isNewUser: false,
          },
        });
      }),
    );

    await login('13800001234', '123456');

    expect(capturedBody).toEqual({
      phone: '13800001234',
      code: '123456',
    });
  });

  // 来源: user.md §4 — 登录/注册 — Request Body（注册场景，传 isCoach）
  it('should include isCoach in request body when provided', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          data: {
            token: 'jwt-token-string',
            user: {
              id: 'uuid-1',
              phone: '138****1234',
              nickname: '球友38291',
              avatarUrl: null,
              bio: null,
              isCoach: true,
              createdAt: '2026-04-01T10:00:00.000Z',
            },
            isNewUser: true,
          },
        });
      }),
    );

    await login('13800001234', '123456', true);

    expect(capturedBody).toEqual({
      phone: '13800001234',
      code: '123456',
      isCoach: true,
    });
  });

  // 来源: user.md §4 — 登录/注册 — Request Body（isCoach=false 不传或传 false）
  it('should not include isCoach when it is undefined', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          data: {
            token: 'jwt-token-string',
            user: {
              id: 'uuid-1',
              phone: '138****1234',
              nickname: '球友12345',
              avatarUrl: null,
              bio: null,
              isCoach: false,
              createdAt: '2026-04-01T10:00:00.000Z',
            },
            isNewUser: false,
          },
        });
      }),
    );

    await login('13800001234', '123456');

    // When isCoach is not provided, it should not be in the request body
    // (or be undefined, which JSON.stringify omits)
    expect(capturedBody).not.toHaveProperty('isCoach');
  });

  // 来源: user.md §4 — 登录/注册 — Response 200（已有用户登录）
  it('should return token, user, and isNewUser=false for existing user login', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          data: {
            token: 'jwt-token-existing',
            user: {
              id: 'uuid-existing',
              phone: '138****1234',
              nickname: '老球友',
              avatarUrl: 'https://example.com/avatar.jpg',
              bio: '喜欢打球',
              isCoach: false,
              createdAt: '2026-03-01T10:00:00.000Z',
            },
            isNewUser: false,
          },
        });
      }),
    );

    const result = await login('13800001234', '123456');

    expect(result).toEqual({
      token: 'jwt-token-existing',
      user: {
        id: 'uuid-existing',
        phone: '138****1234',
        nickname: '老球友',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: '喜欢打球',
        isCoach: false,
        createdAt: '2026-03-01T10:00:00.000Z',
      },
      isNewUser: false,
    });
  });

  // 来源: user.md §4 — 登录/注册 — Response 200（新用户注册）
  it('should return isNewUser=true for new user registration', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          data: {
            token: 'jwt-token-new',
            user: {
              id: 'uuid-new',
              phone: '139****5678',
              nickname: '球友38291',
              avatarUrl: null,
              bio: null,
              isCoach: false,
              createdAt: '2026-04-01T10:00:00.000Z',
            },
            isNewUser: true,
          },
        });
      }),
    );

    const result = await login('13900005678', '654321');

    expect(result.isNewUser).toBe(true);
    expect(result.user.id).toBe('uuid-new');
    expect(result.token).toBe('jwt-token-new');
  });

  // 来源: user.md §4 — 登录/注册 — Response 200（phone 已脱敏）
  it('should receive desensitized phone in response', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          data: {
            token: 'jwt-token-string',
            user: {
              id: 'uuid-1',
              phone: '138****1234',
              nickname: '球友12345',
              avatarUrl: null,
              bio: null,
              isCoach: false,
              createdAt: '2026-04-01T10:00:00.000Z',
            },
            isNewUser: false,
          },
        });
      }),
    );

    const result = await login('13800001234', '123456');

    // 来源: user.md §6.4 — 手机号脱敏规则: 前 3 位 + **** + 后 4 位
    expect(result.user.phone).toMatch(/^\d{3}\*{4}\d{4}$/);
  });

  // 来源: user.md §4 — 登录/注册 — 错误码 AUTH_INVALID_PHONE
  it('should throw error with code AUTH_INVALID_PHONE for invalid phone', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_INVALID_PHONE', message: '手机号格式不合法' },
          },
          { status: 400 },
        );
      }),
    );

    await expect(login('123', '123456')).rejects.toMatchObject({
      code: 'AUTH_INVALID_PHONE',
    });
  });

  // 来源: user.md §4 — 登录/注册 — 错误码 AUTH_INVALID_CODE
  it('should throw error with code AUTH_INVALID_CODE for invalid code format', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'AUTH_INVALID_CODE',
              message: '验证码格式不合法',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(login('13800001234', 'abc')).rejects.toMatchObject({
      code: 'AUTH_INVALID_CODE',
    });
  });

  // 来源: user.md §4 — 登录/注册 — 错误码 AUTH_CODE_WRONG
  it('should throw error with code AUTH_CODE_WRONG for wrong code', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_CODE_WRONG', message: '验证码错误' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(login('13800001234', '000000')).rejects.toMatchObject({
      code: 'AUTH_CODE_WRONG',
    });
  });

  // 来源: user.md §4 — 登录/注册 — 错误码 AUTH_CODE_EXPIRED
  it('should throw error with code AUTH_CODE_EXPIRED for expired code', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_CODE_EXPIRED', message: '验证码已过期' },
          },
          { status: 401 },
        );
      }),
    );

    await expect(login('13800001234', '123456')).rejects.toMatchObject({
      code: 'AUTH_CODE_EXPIRED',
    });
  });

  // 来源: user.md §4 — 登录/注册 — 错误码 AUTH_PHONE_LOCKED
  it('should throw error with code AUTH_PHONE_LOCKED when phone is locked', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'AUTH_PHONE_LOCKED',
              message: '该手机号已被锁定',
            },
          },
          { status: 429 },
        );
      }),
    );

    await expect(login('13800001234', '123456')).rejects.toMatchObject({
      code: 'AUTH_PHONE_LOCKED',
    });
  });
});
