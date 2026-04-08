/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: admin/auth — AdminLoginPage 页面渲染
 * 覆盖页面: AdminLoginPage (/login)
 *
 * 来源文档:
 *   - docs/module-design/admin.md §8.1 AdminLoginPage 页面
 *   - docs/module-design/admin.md §9 Feature 私有组件（auth）
 *   - docs/module-design/admin.md §10 Feature 私有 Hooks（auth）
 *   - docs/module-design/admin.md §12.1 前端表单校验规则
 *   - docs/module-design/admin.md §12.3 验证码倒计时逻辑
 *
 * Mock 策略:
 *   - Mock hooks（useSendCode, useAdminLogin）的返回值
 *   - Mock react-router-dom 导航
 *   - Mock adminAuthStore
 *   - 不关心数据获取链路，只验证页面渲染正确性和交互响应
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock Modules
// ---------------------------------------------------------------------------

// Mock adminAuthStore
vi.mock('@admin/stores/auth-store', () => ({
  useAdminAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: null,
      userId: null,
      isLoggedIn: false,
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useSendCode hook
const mockSendCodeMutate = vi.fn();
let mockSendCodeState = {
  mutate: mockSendCodeMutate,
  isPending: false,
  countdown: 0,
};

vi.mock('@admin/features/auth/hooks/useSendCode', () => ({
  useSendCode: () => mockSendCodeState,
}));

// Mock useAdminLogin hook
const mockLoginMutate = vi.fn();
let mockLoginState = {
  mutate: mockLoginMutate,
  isPending: false,
};

vi.mock('@admin/features/auth/hooks/useAdminLogin', () => ({
  useAdminLogin: () => mockLoginState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { AdminLoginPage } from '@admin/features/auth/pages/AdminLoginPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<AdminLoginPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendCodeState = {
      mutate: mockSendCodeMutate,
      isPending: false,
      countdown: 0,
    };
    mockLoginState = {
      mutate: mockLoginMutate,
      isPending: false,
    };
  });

  // =========================================================================
  // 基本渲染 — 登录页面
  // =========================================================================

  // 来源: admin.md §8.1 — AdminLoginPage — 组件结构 — AppLogo
  it('should render app logo and title "羽约管理后台"', () => {
    renderPage();

    expect(screen.getByText(/羽约管理后台/)).toBeInTheDocument();
  });

  // 来源: admin.md §8.1 — AdminLoginPage — 组件结构 — PhoneInput
  it('should render phone number input field', () => {
    renderPage();

    // 手机号输入框
    expect(screen.getByPlaceholderText(/手机号/)).toBeInTheDocument();
  });

  // 来源: admin.md §8.1 — AdminLoginPage — 组件结构 — CodeInput
  it('should render verification code input field', () => {
    renderPage();

    // 验证码输入框
    expect(screen.getByPlaceholderText(/验证码/)).toBeInTheDocument();
  });

  // 来源: admin.md §8.1 — AdminLoginPage — 组件结构 — CodeInput — "获取验证码"按钮
  it('should render "获取验证码" button', () => {
    renderPage();

    expect(screen.getByText('获取验证码')).toBeInTheDocument();
  });

  // 来源: admin.md §8.1 — AdminLoginPage — 组件结构 — SubmitButton
  it('should render "登录" button', () => {
    renderPage();

    expect(screen.getByText('登录')).toBeInTheDocument();
  });

  // =========================================================================
  // 获取验证码交互
  // =========================================================================

  // 来源: admin.md §8.1 — 交互流程 — 获取验证码 — 调用 useSendCode
  it('should call sendCode when "获取验证码" button is clicked with valid phone', async () => {
    const user = userEvent.setup();
    renderPage();

    const phoneInput = screen.getByPlaceholderText(/手机号/);
    await user.type(phoneInput, '13800138000');

    const sendButton = screen.getByText('获取验证码');
    await user.click(sendButton);

    expect(mockSendCodeMutate).toHaveBeenCalled();
  });

  // 来源: admin.md §12.3 — 验证码倒计时逻辑 — 发送成功后按钮变为"重新获取(60s)"
  it('should show countdown text when countdown is active', () => {
    mockSendCodeState = {
      mutate: mockSendCodeMutate,
      isPending: false,
      countdown: 45,
    };
    renderPage();

    expect(screen.getByText(/重新获取.*45.*s/)).toBeInTheDocument();
  });

  // 来源: admin.md §12.3 — 验证码倒计时逻辑 — 倒计时期间按钮不可点击
  it('should disable send code button during countdown', () => {
    mockSendCodeState = {
      mutate: mockSendCodeMutate,
      isPending: false,
      countdown: 30,
    };
    renderPage();

    const sendButton = screen.getByText(/重新获取/);
    const buttonEl = sendButton.closest('button');
    expect(buttonEl).toBeDisabled();
  });

  // 来源: admin.md §8.1 — 页面状态 — sendingCode — 发送验证码按钮 loading 状态
  it('should disable send code button when sending code is in progress', () => {
    mockSendCodeState = {
      mutate: mockSendCodeMutate,
      isPending: true,
      countdown: 0,
    };
    renderPage();

    const sendButton = screen.getByText('获取验证码').closest('button');
    expect(sendButton).toBeDisabled();
  });

  // =========================================================================
  // 登录交互
  // =========================================================================

  // 来源: admin.md §8.1 — 交互流程 — 登录 — 调用 useAdminLogin
  it('should call login when "登录" button is clicked with valid phone and code', async () => {
    const user = userEvent.setup();
    renderPage();

    const phoneInput = screen.getByPlaceholderText(/手机号/);
    await user.type(phoneInput, '13800138000');

    const codeInput = screen.getByPlaceholderText(/验证码/);
    await user.type(codeInput, '123456');

    const loginButton = screen.getByText('登录');
    await user.click(loginButton);

    expect(mockLoginMutate).toHaveBeenCalled();
  });

  // 来源: admin.md §8.1 — 页面状态 — submitting — 登录按钮 loading 状态
  it('should disable login button when login is in progress', () => {
    mockLoginState = {
      mutate: mockLoginMutate,
      isPending: true,
    };
    renderPage();

    const loginButton = screen.getByText('登录').closest('button');
    expect(loginButton).toBeDisabled();
  });

  // =========================================================================
  // 表单校验
  // =========================================================================

  // 来源: admin.md §12.1 — 前端表单校验规则 — phone — "请输入正确的手机号"
  it('should show phone error when phone format is invalid on login click', async () => {
    const user = userEvent.setup();
    renderPage();

    const phoneInput = screen.getByPlaceholderText(/手机号/);
    await user.type(phoneInput, '123');

    const codeInput = screen.getByPlaceholderText(/验证码/);
    await user.type(codeInput, '123456');

    const loginButton = screen.getByText('登录');
    await user.click(loginButton);

    // 应不调用登录接口，而是显示手机号格式错误
    expect(mockLoginMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/请输入正确的手机号/)).toBeInTheDocument();
  });

  // 来源: admin.md §12.1 — 前端表单校验规则 — code — "请输入 6 位数字验证码"
  it('should show code error when code format is invalid on login click', async () => {
    const user = userEvent.setup();
    renderPage();

    const phoneInput = screen.getByPlaceholderText(/手机号/);
    await user.type(phoneInput, '13800138000');

    const codeInput = screen.getByPlaceholderText(/验证码/);
    await user.type(codeInput, '12');

    const loginButton = screen.getByText('登录');
    await user.click(loginButton);

    // 应不调用登录接口
    expect(mockLoginMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/请输入.*6.*位.*数字.*验证码/)).toBeInTheDocument();
  });

  // 来源: admin.md §12.1 — 前端表单校验规则 — phone — 获取验证码时也校验手机号格式
  it('should show phone error when phone format is invalid on send code click', async () => {
    const user = userEvent.setup();
    renderPage();

    const phoneInput = screen.getByPlaceholderText(/手机号/);
    await user.type(phoneInput, '999');

    const sendButton = screen.getByText('获取验证码');
    await user.click(sendButton);

    // 应不调用发送验证码接口
    expect(mockSendCodeMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/请输入正确的手机号/)).toBeInTheDocument();
  });
});
