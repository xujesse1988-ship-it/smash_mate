/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: web-app/auth — LoginPage 页面渲染
 * 覆盖页面: LoginPage (/login)
 *
 * 来源文档:
 *   - docs/module-design/web-app-auth.md §2 LoginPage 页面
 *   - docs/module-design/web-app-auth.md §3 Feature 私有组件
 *   - docs/module-design/web-app-auth.md §6 关键业务逻辑
 *
 * Mock 策略:
 *   - Mock hooks（useSendCode, useLogin, useRedirectUrl）的返回值
 *   - 不关心数据获取链路，只验证页面渲染正确性和交互响应
 *   - Mock authStore（登录状态判断）
 *   - Mock react-router-dom 导航
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock Modules
// ---------------------------------------------------------------------------

// Mock authStore
const mockSetAuth = vi.fn();
const mockClearAuth = vi.fn();
let mockIsLoggedIn = false;

vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: mockIsLoggedIn ? 'test-token' : null,
      userId: mockIsLoggedIn ? 'test-user-id' : null,
      isLoggedIn: mockIsLoggedIn,
      setAuth: mockSetAuth,
      clearAuth: mockClearAuth,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock useSendCode hook
const mockSendCode = vi.fn();
let mockSendCodeState = {
  mutate: mockSendCode,
  isPending: false,
  countdown: 0,
};

vi.mock('@web/features/auth/hooks/useSendCode', () => ({
  useSendCode: () => mockSendCodeState,
}));

// Mock useLogin hook
const mockLogin = vi.fn();
let mockLoginState = {
  mutate: mockLogin,
  isPending: false,
};

vi.mock('@web/features/auth/hooks/useLogin', () => ({
  useLogin: () => mockLoginState,
}));

// Mock useRedirectUrl hook
let mockRedirectUrl = '/activities';

vi.mock('@web/features/auth/hooks/useRedirectUrl', () => ({
  useRedirectUrl: () => mockRedirectUrl,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { LoginPage } from '@web/features/auth/pages/LoginPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLoginPage() {
  return render(<LoginPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoggedIn = false;
    mockSendCodeState = {
      mutate: mockSendCode,
      isPending: false,
      countdown: 0,
    };
    mockLoginState = {
      mutate: mockLogin,
      isPending: false,
    };
    mockRedirectUrl = '/activities';
  });

  // =========================================================================
  // 基本渲染
  // =========================================================================

  // 来源: web-app-auth.md §2 — 组件结构 — AppLogo
  it('should render the app logo and name', () => {
    renderLoginPage();

    expect(screen.getByText('羽约')).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §2 — 页面状态 — activeTab
  it('should render login and register tabs with login tab active by default', () => {
    renderLoginPage();

    expect(screen.getByRole('tab', { name: /登录/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /注册/i })).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §2 — 组件结构 — LoginForm — PhoneInput
  it('should render phone input field', () => {
    renderLoginPage();

    expect(screen.getByPlaceholderText(/手机号/i)).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §2 — 组件结构 — LoginForm — CodeInput
  it('should render verification code input field', () => {
    renderLoginPage();

    expect(screen.getByPlaceholderText(/验证码/i)).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §3 — CodeInput — "获取验证码"按钮
  it('should render send code button', () => {
    renderLoginPage();

    expect(screen.getByRole('button', { name: /获取验证码/i })).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §2 — 组件结构 — LoginForm — SubmitButton
  it('should render login submit button in login tab', () => {
    renderLoginPage();

    expect(screen.getByRole('button', { name: /^登录$/i })).toBeInTheDocument();
  });

  // =========================================================================
  // Tab 切换
  // =========================================================================

  // 来源: web-app-auth.md §2 — 交互流程 — Tab 切换
  it('should switch to register tab when clicked', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('tab', { name: /注册/i }));

    // 注册 Tab 应显示"注册"提交按钮
    expect(screen.getByRole('button', { name: /^注册$/i })).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §2 — 组件结构 — RegisterForm — CoachCheckbox
  it('should show coach checkbox only in register tab', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    // 登录 Tab 不应显示教练复选框
    expect(screen.queryByRole('checkbox', { name: /教练/i })).not.toBeInTheDocument();

    // 切换到注册 Tab
    await user.click(screen.getByRole('tab', { name: /注册/i }));

    // 注册 Tab 应显示"我是教练"复选框
    expect(screen.getByRole('checkbox', { name: /教练/i })).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §6.6 — 手机号和验证码跨 Tab 共享
  it('should preserve phone and code inputs when switching tabs', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    // 在登录 Tab 输入手机号和验证码
    const phoneInput = screen.getByPlaceholderText(/手机号/i);
    const codeInput = screen.getByPlaceholderText(/验证码/i);

    await user.type(phoneInput, '13800001234');
    await user.type(codeInput, '123456');

    // 切换到注册 Tab
    await user.click(screen.getByRole('tab', { name: /注册/i }));

    // 手机号和验证码应保留
    expect(screen.getByPlaceholderText(/手机号/i)).toHaveValue('13800001234');
    expect(screen.getByPlaceholderText(/验证码/i)).toHaveValue('123456');
  });

  // =========================================================================
  // 发送验证码
  // =========================================================================

  // 来源: web-app-auth.md §2 — 交互流程 — 获取验证码
  it('should call sendCode when send code button is clicked', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.click(screen.getByRole('button', { name: /获取验证码/i }));

    expect(mockSendCode).toHaveBeenCalled();
  });

  // 来源: web-app-auth.md §6.1 — 前端表单校验规则 — phone 必填
  it('should show error when sending code with empty phone', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: /获取验证码/i }));

    expect(screen.getByText(/请输入正确的手机号/i)).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §6.1 — 前端表单校验规则 — phone 格式
  it('should show error when sending code with invalid phone format', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/i), '123');
    await user.click(screen.getByRole('button', { name: /获取验证码/i }));

    expect(screen.getByText(/请输入正确的手机号/i)).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §6.2 — 验证码倒计时逻辑 — 倒计时中按钮不可点击
  it('should disable send code button during countdown', () => {
    mockSendCodeState = {
      ...mockSendCodeState,
      countdown: 45,
    };
    renderLoginPage();

    const sendButton = screen.getByRole('button', { name: /重新获取/i });
    expect(sendButton).toBeDisabled();
    expect(sendButton).toHaveTextContent(/45/);
  });

  // 来源: web-app-auth.md §6.2 — 验证码倒计时逻辑 — 倒计时结束按钮恢复
  it('should enable send code button when countdown reaches 0', () => {
    mockSendCodeState = {
      ...mockSendCodeState,
      countdown: 0,
    };
    renderLoginPage();

    const sendButton = screen.getByRole('button', { name: /获取验证码/i });
    expect(sendButton).not.toBeDisabled();
  });

  // 来源: web-app-auth.md §2 — 页面状态 — sendingCode
  it('should show loading state on send code button when sending', () => {
    mockSendCodeState = {
      ...mockSendCodeState,
      isPending: true,
    };
    renderLoginPage();

    const sendButton = screen.getByRole('button', { name: /获取验证码/i });
    expect(sendButton).toBeDisabled();
  });

  // =========================================================================
  // 登录提交
  // =========================================================================

  // 来源: web-app-auth.md §2 — 交互流程 — 登录（登录 Tab）
  it('should call login mutation when login button is clicked with valid inputs', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.type(screen.getByPlaceholderText(/验证码/i), '123456');
    await user.click(screen.getByRole('button', { name: /^登录$/i }));

    expect(mockLogin).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '13800001234', code: '123456' }),
    );
  });

  // 来源: web-app-auth.md §6.1 — 前端表单校验规则 — code 格式
  it('should show error when submitting login with invalid code format', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.type(screen.getByPlaceholderText(/验证码/i), '12');
    await user.click(screen.getByRole('button', { name: /^登录$/i }));

    expect(screen.getByText(/请输入 6 位数字验证码/i)).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §6.1 — 前端表单校验规则 — phone + code 均校验
  it('should show phone error when submitting login with empty phone', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/验证码/i), '123456');
    await user.click(screen.getByRole('button', { name: /^登录$/i }));

    expect(screen.getByText(/请输入正确的手机号/i)).toBeInTheDocument();
  });

  // 来源: web-app-auth.md §2 — 页面状态 — submitting
  it('should show loading state on submit button when logging in', () => {
    mockLoginState = {
      ...mockLoginState,
      isPending: true,
    };
    renderLoginPage();

    const submitButton = screen.getByRole('button', { name: /^登录$/i });
    expect(submitButton).toBeDisabled();
  });

  // =========================================================================
  // 注册提交
  // =========================================================================

  // 来源: web-app-auth.md §2 — 交互流程 — 注册（注册 Tab）
  it('should call login mutation with isCoach when registering with coach checked', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('tab', { name: /注册/i }));
    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.type(screen.getByPlaceholderText(/验证码/i), '123456');
    await user.click(screen.getByRole('checkbox', { name: /教练/i }));
    await user.click(screen.getByRole('button', { name: /^注册$/i }));

    expect(mockLogin).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '13800001234', code: '123456', isCoach: true }),
    );
  });

  // 来源: web-app-auth.md §2 — 交互流程 — 注册（注册 Tab，不勾选教练）
  it('should call login mutation without isCoach when registering without coach checked', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('tab', { name: /注册/i }));
    await user.type(screen.getByPlaceholderText(/手机号/i), '13800001234');
    await user.type(screen.getByPlaceholderText(/验证码/i), '123456');
    await user.click(screen.getByRole('button', { name: /^注册$/i }));

    expect(mockLogin).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '13800001234', code: '123456' }),
    );
    expect(mockLogin).not.toHaveBeenCalledWith(
      expect.objectContaining({ isCoach: true }),
    );
  });

  // =========================================================================
  // 登录态重定向
  // =========================================================================

  // 来源: web-app-auth.md §6.4 — 路由保护与重定向 — 已登录用户访问 /login
  it('should redirect to target page when user is already logged in', () => {
    mockIsLoggedIn = true;
    renderLoginPage();

    expect(mockNavigate).toHaveBeenCalledWith('/activities', { replace: true });
  });

  // 来源: web-app-auth.md §6.4 — 路由保护与重定向 — 有 redirect 参数
  it('should redirect to custom redirect URL when user is already logged in', () => {
    mockIsLoggedIn = true;
    mockRedirectUrl = '/coaches/123';
    renderLoginPage();

    expect(mockNavigate).toHaveBeenCalledWith('/coaches/123', { replace: true });
  });

  // =========================================================================
  // 错误提示
  // =========================================================================

  // 来源: web-app-auth.md §2 — 交互流程 — Tab 切换 — 清空错误提示
  it('should clear error messages when switching tabs', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    // 触发校验错误
    await user.click(screen.getByRole('button', { name: /^登录$/i }));
    expect(screen.getByText(/请输入正确的手机号/i)).toBeInTheDocument();

    // 切换 Tab 应清除错误
    await user.click(screen.getByRole('tab', { name: /注册/i }));

    expect(screen.queryByText(/请输入正确的手机号/i)).not.toBeInTheDocument();
  });
});
