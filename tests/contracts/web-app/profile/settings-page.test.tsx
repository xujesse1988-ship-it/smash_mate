/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: web-app/profile — SettingsPage 页面渲染
 * 覆盖页面: SettingsPage (/settings)
 *
 * 来源文档:
 *   - docs/module-design/web-app-profile.md §2 SettingsPage 页面
 *   - docs/module-design/web-app-profile.md §3 Feature 私有组件
 *   - docs/module-design/coach-verification.md §6.6 入口变更
 *   - docs/module-design/web-app-profile.md §6.6 设置页中不可用功能的处理
 *
 * Mock 策略:
 *   - Mock hooks（useCurrentUser）的返回值
 *   - Mock authStore（clearAuth 用于退出登录）
 *   - Mock react-router-dom 导航
 *   - 不关心数据获取链路，只验证页面渲染正确性和交互响应
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
const mockClearAuth = vi.fn();
vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-token',
      userId: 'current-user-id',
      isLoggedIn: true,
      setAuth: vi.fn(),
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
  };
});

// Mock useCurrentUser hook
let mockCurrentUserData: {
  data: unknown;
  isLoading: boolean;
} = {
  data: null,
  isLoading: false,
};

vi.mock('@web/shared/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUserData,
}));


// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { SettingsPage } from '@web/features/profile/pages/SettingsPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<SettingsPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserData = {
      data: {
        id: 'current-user-id',
        isCoach: false,
        nickname: '球友A',
      },
      isLoading: false,
    };
  });

  // =========================================================================
  // 基本渲染
  // =========================================================================

  // 来源: web-app-profile.md §2 — SettingsPage — 组件结构 — TopBar
  it('should render settings page title', () => {
    renderPage();

    expect(screen.getByText(/设置/)).toBeInTheDocument();
  });

  // 来源: coach-verification.md §6.6 — 入口变更 — 设置页"申请成为教练"
  it('should render coach application entry', () => {
    renderPage();

    expect(screen.getByText(/申请成为教练/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — SettingsPage — 组件结构 — SettingsLinkItem — 修改手机号
  it('should render change phone number entry', () => {
    renderPage();

    expect(screen.getByText(/修改手机号/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — SettingsPage — 组件结构 — SettingsLinkItem — 关于我们
  it('should render about us entry', () => {
    renderPage();

    expect(screen.getByText(/关于我们/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — SettingsPage — 组件结构 — LogoutButton
  it('should render logout button', () => {
    renderPage();

    expect(screen.getByText(/退出登录/)).toBeInTheDocument();
  });

  // =========================================================================
  // 关于我们
  // =========================================================================

  // 来源: web-app-profile.md §6.6 — 关于我们 — 点击后显示应用信息
  it('should show app info when clicking "关于我们"', async () => {
    const user = userEvent.setup();
    renderPage();

    const aboutEntry = screen.getByText(/关于我们/);
    await user.click(aboutEntry.closest('[role="button"]') || aboutEntry.closest('button') || aboutEntry);

    // 应显示应用名称"羽约"和版本信息
    expect(screen.getByText(/羽约/)).toBeInTheDocument();
  });

  // =========================================================================
  // 教练申请入口 — 非教练用户
  // =========================================================================

  // 来源: coach-verification.md §6.6 — 入口变更 — 非教练显示"申请成为教练"
  it('should show "申请成为教练" for non-coach user', () => {
    mockCurrentUserData = {
      data: { id: 'current-user-id', isCoach: false },
      isLoading: false,
    };
    renderPage();

    expect(screen.getByText('申请成为教练')).toBeInTheDocument();
  });

  // 来源: coach-verification.md §6.6 — 入口变更 — 点击跳转到 /coach-apply
  it('should navigate to /coach-apply when clicking coach entry', async () => {
    const user = userEvent.setup();
    mockCurrentUserData = {
      data: { id: 'current-user-id', isCoach: false },
      isLoading: false,
    };
    renderPage();

    const entry = screen.getByText('申请成为教练');
    await user.click(entry.closest('[role="button"]') || entry);

    expect(mockNavigate).toHaveBeenCalledWith('/coach-apply');
  });

  // =========================================================================
  // 教练申请入口 — 教练用户
  // =========================================================================

  // 来源: coach-verification.md §6.6 — 入口变更 — 教练显示"教练资质（已认证）"
  it('should show "教练资质（已认证）" for coach user', () => {
    mockCurrentUserData = {
      data: { id: 'current-user-id', isCoach: true },
      isLoading: false,
    };
    renderPage();

    expect(screen.getByText('教练资质（已认证）')).toBeInTheDocument();
  });

  // =========================================================================
  // 修改手机号（一期不可用）
  // =========================================================================

  // 来源: web-app-profile.md §6.6 — 修改手机号 — 一期不可用，灰色不可点击
  it('should show change phone number as disabled', () => {
    renderPage();

    const phoneEntry = screen.getByText(/修改手机号/);
    // 该入口应显示为禁用状态
    const parentEl = phoneEntry.closest('[role="button"]') || phoneEntry.closest('button') || phoneEntry.parentElement;
    expect(parentEl).toHaveAttribute('aria-disabled', 'true');
  });

  // =========================================================================
  // 退出登录
  // =========================================================================

  // 来源: web-app-profile.md §2 — SettingsPage — 交互流程 — 退出登录 — 确认弹窗
  it('should show logout confirmation dialog when logout button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText(/退出登录/));

    expect(screen.getByText(/确定退出登录/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — SettingsPage — 交互流程 — 退出登录 — 确认后清除认证
  it('should call clearAuth and navigate to login when logout is confirmed', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText(/退出登录/));
    const confirmButton = screen.getByRole('button', { name: /确认|确定/i });
    await user.click(confirmButton);

    expect(mockClearAuth).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  // 来源: web-app-profile.md §2 — SettingsPage — 交互流程 — 退出登录 — 取消关闭弹窗
  it('should close logout dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText(/退出登录/));
    expect(screen.getByText(/确定退出登录/)).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /取消/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/确定退出登录/)).not.toBeInTheDocument();
    });
  });

});
