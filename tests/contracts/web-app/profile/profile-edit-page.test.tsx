/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: web-app/profile — ProfileEditPage 页面渲染
 * 覆盖页面: ProfileEditPage (/profile/edit)
 *
 * 来源文档:
 *   - docs/module-design/web-app-profile.md §2 ProfileEditPage 页面
 *   - docs/module-design/web-app-profile.md §3 Feature 私有组件
 *   - docs/module-design/web-app-profile.md §6.1 个人资料编辑 -- 前端校验规则
 *   - docs/module-design/web-app-profile.md §6.5 资料编辑的未保存变更检测
 *
 * Mock 策略:
 *   - Mock hooks（useCurrentUser, useUpdateProfile）的返回值
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
  error: unknown;
} = {
  data: null,
  isLoading: false,
  error: null,
};

vi.mock('@web/shared/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUserData,
}));

// Mock useUpdateProfile hook
const mockUpdateProfileMutate = vi.fn();
let mockUpdateProfileState = {
  mutate: mockUpdateProfileMutate,
  isPending: false,
};

vi.mock('@web/features/profile/hooks/useUpdateProfile', () => ({
  useUpdateProfile: () => mockUpdateProfileState,
}));

// Mock authStore
vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-token',
      userId: 'current-user-id',
      isLoggedIn: true,
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { ProfileEditPage } from '@web/features/profile/pages/ProfileEditPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<ProfileEditPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserData = {
      data: {
        id: 'current-user-id',
        phone: '138****1234',
        nickname: '球友A',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: '热爱羽毛球',
        isCoach: false,
        createdAt: '2026-04-01T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    };
    mockUpdateProfileState = {
      mutate: mockUpdateProfileMutate,
      isPending: false,
    };
  });

  // =========================================================================
  // 基本渲染 — 表单回填
  // =========================================================================

  // 来源: web-app-profile.md §2 — ProfileEditPage — 交互流程 — 回填表单
  it('should render form with current user nickname pre-filled', () => {
    renderPage();

    const nicknameInput = screen.getByDisplayValue('球友A');
    expect(nicknameInput).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — ProfileEditPage — 交互流程 — 回填表单
  it('should render form with current avatar URL pre-filled', () => {
    renderPage();

    const avatarInput = screen.getByDisplayValue('https://example.com/avatar.jpg');
    expect(avatarInput).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — ProfileEditPage — 交互流程 — 回填表单
  it('should render form with current bio pre-filled', () => {
    renderPage();

    const bioInput = screen.getByDisplayValue('热爱羽毛球');
    expect(bioInput).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — ProfileEditPage — 组件结构 — PhoneDisplay
  it('should render phone number in desensitized format (read-only)', () => {
    renderPage();

    expect(screen.getByText(/138\*{4}1234/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — ProfileEditPage — 组件结构 — TopBar
  it('should render save button', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument();
  });

  // =========================================================================
  // 表单校验
  // =========================================================================

  // 来源: web-app-profile.md §6.1 — 前端校验规则 — nickname 必填，长度 2-20
  it('should show error when nickname is too short (less than 2 characters)', async () => {
    const user = userEvent.setup();
    renderPage();

    const nicknameInput = screen.getByDisplayValue('球友A');
    await user.clear(nicknameInput);
    await user.type(nicknameInput, 'x');
    await user.click(screen.getByRole('button', { name: /保存/i }));

    expect(screen.getByText(/昵称长度需在 2-20 个字符之间/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §6.1 — 前端校验规则 — nickname 不可为纯空白字符
  it('should show error when nickname is only whitespace', async () => {
    const user = userEvent.setup();
    renderPage();

    const nicknameInput = screen.getByDisplayValue('球友A');
    await user.clear(nicknameInput);
    await user.type(nicknameInput, '   ');
    await user.click(screen.getByRole('button', { name: /保存/i }));

    expect(screen.getByText(/昵称长度需在 2-20 个字符之间/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §6.1 — 前端校验规则 — avatarUrl 非空时必须以 http(s):// 开头
  it('should show error when avatar URL is invalid', async () => {
    const user = userEvent.setup();
    renderPage();

    const avatarInput = screen.getByDisplayValue('https://example.com/avatar.jpg');
    await user.clear(avatarInput);
    await user.type(avatarInput, 'not-a-url');
    await user.click(screen.getByRole('button', { name: /保存/i }));

    expect(screen.getByText(/请输入合法的头像链接/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §6.1 — 前端校验规则 — bio 最长 200 个字符
  it('should show error when bio exceeds 200 characters', async () => {
    const user = userEvent.setup();
    renderPage();

    const bioInput = screen.getByDisplayValue('热爱羽毛球');
    await user.clear(bioInput);
    await user.type(bioInput, 'x'.repeat(201));
    await user.click(screen.getByRole('button', { name: /保存/i }));

    expect(screen.getByText(/简介不能超过 200 个字符/)).toBeInTheDocument();
  });

  // =========================================================================
  // 保存交互
  // =========================================================================

  // 来源: web-app-profile.md §2 — ProfileEditPage — 交互流程 — 保存
  it('should call updateProfile mutation when save button is clicked with valid data', async () => {
    const user = userEvent.setup();
    renderPage();

    const nicknameInput = screen.getByDisplayValue('球友A');
    await user.clear(nicknameInput);
    await user.type(nicknameInput, '新昵称');
    await user.click(screen.getByRole('button', { name: /保存/i }));

    expect(mockUpdateProfileMutate).toHaveBeenCalled();
  });

  // 来源: web-app-profile.md §2 — ProfileEditPage — 页面状态 — submitting
  it('should disable save button when submission is pending', () => {
    mockUpdateProfileState = {
      mutate: mockUpdateProfileMutate,
      isPending: true,
    };
    renderPage();

    expect(screen.getByRole('button', { name: /保存/i })).toBeDisabled();
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // =========================================================================
  // 未保存变更检测
  // =========================================================================

  // 来源: web-app-profile.md §6.5 — 资料编辑的未保存变更检测 — 编辑后返回弹出确认弹窗
  it('should show confirm dialog when navigating back with unsaved changes', async () => {
    const user = userEvent.setup();
    renderPage();

    // 修改昵称，产生未保存的变更
    const nicknameInput = screen.getByDisplayValue('球友A');
    await user.clear(nicknameInput);
    await user.type(nicknameInput, '新昵称');

    // 点击返回按钮
    const backButton = screen.getByRole('button', { name: /返回|back/i }) || screen.getByLabelText(/返回/);
    await user.click(backButton);

    // 应弹出确认弹窗
    expect(screen.getByText(/未保存/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §6.5 — 资料编辑的未保存变更检测 — 确认离开
  it('should navigate away when user confirms leaving with unsaved changes', async () => {
    const user = userEvent.setup();
    renderPage();

    // 修改昵称
    const nicknameInput = screen.getByDisplayValue('球友A');
    await user.clear(nicknameInput);
    await user.type(nicknameInput, '新昵称');

    // 点击返回
    const backButton = screen.getByRole('button', { name: /返回|back/i }) || screen.getByLabelText(/返回/);
    await user.click(backButton);

    // 确认离开
    const confirmButton = screen.getByRole('button', { name: /确认|确定/i });
    await user.click(confirmButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  // 来源: web-app-profile.md §6.5 — 资料编辑的未保存变更检测 — 取消留下
  it('should stay on page when user cancels leaving with unsaved changes', async () => {
    const user = userEvent.setup();
    renderPage();

    // 修改昵称
    const nicknameInput = screen.getByDisplayValue('球友A');
    await user.clear(nicknameInput);
    await user.type(nicknameInput, '新昵称');

    // 点击返回
    const backButton = screen.getByRole('button', { name: /返回|back/i }) || screen.getByLabelText(/返回/);
    await user.click(backButton);

    // 取消
    const cancelButton = screen.getByRole('button', { name: /取消/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/未保存/)).not.toBeInTheDocument();
    });
    // 页面不应导航
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-profile.md §2 — ProfileEditPage — 调用的后端接口 — GET /api/users/me 错误
  it('should show error when current user fails to load', () => {
    mockCurrentUserData = {
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
    };
    renderPage();

    // 表单不应渲染
    expect(screen.queryByDisplayValue('球友A')).not.toBeInTheDocument();
  });
});
