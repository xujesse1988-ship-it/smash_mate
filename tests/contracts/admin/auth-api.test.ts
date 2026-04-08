/**
 * 契约测试: admin/auth — API 调用层
 * 覆盖接口:
 *   - POST /api/auth/send-code（发送验证码）
 *   - POST /api/auth/login（管理员登录）
 *
 * 来源文档:
 *   - docs/module-design/admin.md §8.1 AdminLoginPage — 调用的后端接口
 *   - docs/module-design/admin.md §11 消费的后端接口汇总
 *   - docs/module-design/user.md §4 — 发送验证码、登录/注册
 *
 * Mock 策略:
 *   - MSW (Mock Service Worker) 拦截 HTTP 请求
 *   - 验证请求 URL、HTTP 方法、请求参数格式
 *   - 验证成功响应和错误响应的解析
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { sendCode, login } from '@admin/features/auth/api/auth-api';

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
  // 来源: user.md §4 — 发送验证码 — Request（URL + Method）
  it('should send POST request to /api/auth/send-code', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.post('/api/auth/send-code', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        return HttpResponse.json({
          data: { message: '验证码已发送' },
        });
      }),
    );

    await sendCode('13800138000');

    expect(capturedUrl).toBe('/api/auth/send-code');
    expect(capturedMethod).toBe('POST');
  });

  // 来源: user.md §4 — 发送验证码 — Request Body（phone）
  it('should send phone in request body', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/auth/send-code', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: { message: '验证码已发送' },
        });
      }),
    );

    await sendCode('13800138000');

    expect(capturedBody).toEqual({ phone: '13800138000' });
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

    const result = await sendCode('13800138000');

    expect(result).toEqual({ message: '验证码已发送' });
  });

  // 来源: user.md §4 — 发送验证码 — 错误码 AUTH_INVALID_PHONE
  it('should throw error with code AUTH_INVALID_PHONE when phone format is invalid', async () => {
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
            error: { code: 'AUTH_CODE_RATE_LIMITED', message: '60 秒内重复发送' },
          },
          { status: 429 },
        );
      }),
    );

    await expect(sendCode('13800138000')).rejects.toMatchObject({
      code: 'AUTH_CODE_RATE_LIMITED',
    });
  });

  // 来源: user.md §4 — 发送验证码 — 错误码 AUTH_PHONE_LOCKED
  it('should throw error with code AUTH_PHONE_LOCKED when phone is locked', async () => {
    server.use(
      http.post('/api/auth/send-code', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_PHONE_LOCKED', message: '该手机号已被锁定' },
          },
          { status: 429 },
        );
      }),
    );

    await expect(sendCode('13800138000')).rejects.toMatchObject({
      code: 'AUTH_PHONE_LOCKED',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('login API', () => {
  // 来源: user.md §4 — 登录/注册 — Request（URL + Method）
  it('should send POST request to /api/auth/login', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    server.use(
      http.post('/api/auth/login', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        capturedMethod = request.method;
        return HttpResponse.json({
          data: {
            token: 'jwt-token-string',
            user: {
              id: 'uuid-1',
              phone: '138****0000',
              nickname: '球友12345',
              isCoach: false,
            },
            isNewUser: false,
          },
        });
      }),
    );

    await login('13800138000', '123456');

    expect(capturedUrl).toBe('/api/auth/login');
    expect(capturedMethod).toBe('POST');
  });

  // 来源: user.md §4 — 登录/注册 — Request Body（phone, code）
  // 来源: admin.md §8.1 — 登录 — 不传 isCoach
  it('should send phone and code in request body without isCoach', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            token: 'jwt-token-string',
            user: {
              id: 'uuid-1',
              phone: '138****0000',
              nickname: '球友12345',
              isCoach: false,
            },
            isNewUser: false,
          },
        });
      }),
    );

    await login('13800138000', '123456');

    expect(capturedBody).toEqual({ phone: '13800138000', code: '123456' });
    expect(capturedBody).not.toHaveProperty('isCoach');
  });

  // 来源: user.md §4 — 登录/注册 — Response 200
  it('should return token and user from successful response', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          data: {
            token: 'jwt-token-string',
            user: {
              id: 'uuid-1',
              phone: '138****0000',
              nickname: '球友12345',
              isCoach: false,
            },
            isNewUser: false,
          },
        });
      }),
    );

    const result = await login('13800138000', '123456');

    expect(result).toMatchObject({
      token: 'jwt-token-string',
      user: {
        id: 'uuid-1',
        phone: '138****0000',
        nickname: '球友12345',
        isCoach: false,
      },
    });
  });

  // 来源: user.md §4 — 登录/注册 — 错误码 AUTH_INVALID_PHONE
  it('should throw error with code AUTH_INVALID_PHONE when phone format is invalid', async () => {
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
  it('should throw error with code AUTH_INVALID_CODE when code format is invalid', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_INVALID_CODE', message: '验证码格式不合法' },
          },
          { status: 400 },
        );
      }),
    );

    await expect(login('13800138000', '12')).rejects.toMatchObject({
      code: 'AUTH_INVALID_CODE',
    });
  });

  // 来源: user.md §4 — 登录/注册 — 错误码 AUTH_CODE_WRONG
  it('should throw error with code AUTH_CODE_WRONG when verification code is wrong', async () => {
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

    await expect(login('13800138000', '999999')).rejects.toMatchObject({
      code: 'AUTH_CODE_WRONG',
    });
  });

  // 来源: user.md §4 — 登录/注册 — 错误码 AUTH_CODE_EXPIRED
  it('should throw error with code AUTH_CODE_EXPIRED when verification code is expired', async () => {
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

    await expect(login('13800138000', '123456')).rejects.toMatchObject({
      code: 'AUTH_CODE_EXPIRED',
    });
  });

  // 来源: user.md §4 — 登录/注册 — 错误码 AUTH_PHONE_LOCKED
  it('should throw error with code AUTH_PHONE_LOCKED when phone is locked', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_PHONE_LOCKED', message: '该手机号已被锁定' },
          },
          { status: 429 },
        );
      }),
    );

    await expect(login('13800138000', '123456')).rejects.toMatchObject({
      code: 'AUTH_PHONE_LOCKED',
    });
  });
});
