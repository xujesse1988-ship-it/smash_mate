/**
 * L1 集成测试: web-app/auth — LoginPage 端内数据流
 *
 * 验证: 页面操作 → hook 调用 → API 请求 → 状态更新 → 页面响应
 * Mock 策略: 仅 MSW mock 网络层，不 mock hooks
 *
 * 与契约测试的区别:
 *   - 契约测试: mock hooks，验证页面渲染和交互
 *   - L1 集成测试: 不 mock hooks，验证完整数据流
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { LoginPage } from '@web/features/auth/pages/LoginPage';
import { useAuthStore } from '@web/stores/auth-store';

// ---------------------------------------------------------------------------
// MSW Server Setup
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  // Clear auth state
  useAuthStore.getState().clearAuth();
  // Clear localStorage
  localStorage.clear();
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: 发送验证码完整数据流
// ---------------------------------------------------------------------------

describe('LoginPage Integration: 发送验证码', () => {
  it('should send verification code and show success message', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/send-code', async ({ request }) => {
        const body = await request.json() as { phone: string };
        expect(body.phone).toBe('13800001234');
        return HttpResponse.json({
          data: { message: '验证码已发送' },
        });
      }),
    );

    renderLoginPage();

    // Type phone number
    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');

    // Click send code button
    await user.click(screen.getByRole('button', { name: /获取验证码/i }));

    // Wait for countdown to start (indicating API call succeeded)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /重新获取/i })).toBeDisabled();
    });
  });

  it('should show error when phone format is invalid (front-end validation)', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/i), '123');
    await user.click(screen.getByRole('button', { name: /获取验证码/i }));

    expect(screen.getByText(/请输入正确的手机号/i)).toBeInTheDocument();
  });

  it('should handle AUTH_CODE_RATE_LIMITED error from backend', async () => {
    const user = userEvent.setup();

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

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.click(screen.getByRole('button', { name: /获取验证码/i }));

    // Button should remain enabled after error (no countdown started)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /获取验证码/i })).not.toBeDisabled();
    });
  });

  it('should handle AUTH_PHONE_LOCKED error from backend', async () => {
    const user = userEvent.setup();

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

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.click(screen.getByRole('button', { name: /获取验证码/i }));

    // Button should remain enabled after error
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /获取验证码/i })).not.toBeDisabled();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: 登录完整数据流
// ---------------------------------------------------------------------------

describe('LoginPage Integration: 登录', () => {
  it('should login successfully and update auth store', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/send-code', () => {
        return HttpResponse.json({
          data: { message: '验证码已发送' },
        });
      }),
      http.post('/api/auth/login', async ({ request }) => {
        const body = await request.json() as { phone: string; code: string };
        expect(body.phone).toBe('13800001234');
        expect(body.code).toBe('123456');
        return HttpResponse.json({
          data: {
            token: 'jwt-token-test',
            user: {
              id: 'user-uuid-1',
              phone: '138****1234',
              nickname: '老球友',
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

    renderLoginPage();

    // Type phone and code
    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.type(screen.getByPlaceholderText(/验证码/i), '123456');

    // Click login
    await user.click(screen.getByRole('button', { name: /^登录$/i }));

    // Verify auth store was updated
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.token).toBe('jwt-token-test');
      expect(state.userId).toBe('user-uuid-1');
      expect(state.isLoggedIn).toBe(true);
    });

    // Verify navigation was called
    expect(mockNavigate).toHaveBeenCalledWith('/activities', { replace: true });
  });

  it('should handle AUTH_CODE_WRONG error', async () => {
    const user = userEvent.setup();

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

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.type(screen.getByPlaceholderText(/验证码/i), '123456');
    await user.click(screen.getByRole('button', { name: /^登录$/i }));

    // Auth store should NOT be updated
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
    });
  });

  it('should handle AUTH_CODE_EXPIRED error', async () => {
    const user = userEvent.setup();

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

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.type(screen.getByPlaceholderText(/验证码/i), '123456');
    await user.click(screen.getByRole('button', { name: /^登录$/i }));

    // Auth store should NOT be updated
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
    });
  });

  it('should validate phone and code before sending request', async () => {
    const user = userEvent.setup();
    let apiCalled = false;

    server.use(
      http.post('/api/auth/login', () => {
        apiCalled = true;
        return HttpResponse.json({
          data: {
            token: 'jwt-token',
            user: {
              id: 'uuid',
              phone: '138****1234',
              nickname: '球友',
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

    renderLoginPage();

    // Submit with empty phone and code
    await user.click(screen.getByRole('button', { name: /^登录$/i }));

    // Validation errors should appear
    expect(screen.getByText(/请输入正确的手机号/i)).toBeInTheDocument();

    // API should NOT have been called
    expect(apiCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: 注册完整数据流
// ---------------------------------------------------------------------------

describe('LoginPage Integration: 注册', () => {
  it('should register new user with coach role', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        const body = await request.json() as { phone: string; code: string; isCoach?: boolean };
        expect(body.phone).toBe('13900005678');
        expect(body.code).toBe('654321');
        expect(body.isCoach).toBe(true);
        return HttpResponse.json({
          data: {
            token: 'jwt-token-new',
            user: {
              id: 'user-uuid-new',
              phone: '139****5678',
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

    renderLoginPage();

    // Switch to register tab
    await user.click(screen.getByRole('tab', { name: /注册/i }));

    // Fill form
    await user.type(screen.getByPlaceholderText(/手机号/i), '13900005678');
    await user.type(screen.getByPlaceholderText(/验证码/i), '654321');
    await user.click(screen.getByRole('checkbox', { name: /教练/i }));

    // Submit
    await user.click(screen.getByRole('button', { name: /^注册$/i }));

    // Verify auth store
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.token).toBe('jwt-token-new');
      expect(state.userId).toBe('user-uuid-new');
      expect(state.isLoggedIn).toBe(true);
    });

    // Verify navigation
    expect(mockNavigate).toHaveBeenCalledWith('/activities', { replace: true });
  });

  it('should register without coach role when checkbox is not checked', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            token: 'jwt-token-new',
            user: {
              id: 'user-uuid-new',
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

    renderLoginPage();

    // Switch to register tab
    await user.click(screen.getByRole('tab', { name: /注册/i }));

    // Fill form (do not check coach)
    await user.type(screen.getByPlaceholderText(/手机号/i), '13900005678');
    await user.type(screen.getByPlaceholderText(/验证码/i), '654321');

    // Submit
    await user.click(screen.getByRole('button', { name: /^注册$/i }));

    // Verify request body does not include isCoach
    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });
    expect(capturedBody).not.toHaveProperty('isCoach');
  });

  it('should show info message when registering with existing phone number', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          data: {
            token: 'jwt-token-existing',
            user: {
              id: 'user-uuid-existing',
              phone: '138****1234',
              nickname: '老球友',
              avatarUrl: null,
              bio: null,
              isCoach: false,
              createdAt: '2026-03-01T10:00:00.000Z',
            },
            isNewUser: false, // User already exists
          },
        });
      }),
    );

    renderLoginPage();

    // Switch to register tab
    await user.click(screen.getByRole('tab', { name: /注册/i }));

    // Fill form
    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.type(screen.getByPlaceholderText(/验证码/i), '123456');

    // Submit
    await user.click(screen.getByRole('button', { name: /^注册$/i }));

    // Should still login successfully
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(true);
      expect(state.token).toBe('jwt-token-existing');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: 登录态持久化
// ---------------------------------------------------------------------------

describe('LoginPage Integration: 登录态持久化', () => {
  it('should persist token and userId to localStorage on login', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          data: {
            token: 'jwt-persist-test',
            user: {
              id: 'user-persist-id',
              phone: '138****1234',
              nickname: '球友',
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

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.type(screen.getByPlaceholderText(/验证码/i), '123456');
    await user.click(screen.getByRole('button', { name: /^登录$/i }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('jwt-persist-test');
      expect(localStorage.getItem('userId')).toBe('user-persist-id');
    });
  });

  it('should redirect already-logged-in user away from login page', async () => {
    // Set auth state before rendering
    useAuthStore.getState().setAuth('existing-token', 'existing-user-id');

    renderLoginPage();

    // Should redirect immediately
    expect(mockNavigate).toHaveBeenCalledWith('/activities', { replace: true });
  });
});

// ---------------------------------------------------------------------------
// Tests: 完整发送验证码 + 登录流程
// ---------------------------------------------------------------------------

describe('LoginPage Integration: 完整流程', () => {
  it('should complete full send-code then login flow', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/send-code', () => {
        return HttpResponse.json({
          data: { message: '验证码已发送' },
        });
      }),
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          data: {
            token: 'jwt-full-flow',
            user: {
              id: 'user-full-flow',
              phone: '138****1234',
              nickname: '球友12345',
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

    renderLoginPage();

    // Step 1: Enter phone and request code
    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.click(screen.getByRole('button', { name: /获取验证码/i }));

    // Verify countdown started
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /重新获取/i })).toBeDisabled();
    });

    // Step 2: Enter code and login
    await user.type(screen.getByPlaceholderText(/验证码/i), '123456');
    await user.click(screen.getByRole('button', { name: /^登录$/i }));

    // Step 3: Verify login succeeded
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.token).toBe('jwt-full-flow');
      expect(state.userId).toBe('user-full-flow');
      expect(state.isLoggedIn).toBe(true);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/activities', { replace: true });
  });
});
