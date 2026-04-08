/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: web-app/profile — CoachProfileEditPage 页面渲染
 * 覆盖页面: CoachProfileEditPage (/profile/coach-edit)
 *
 * 来源文档:
 *   - docs/module-design/web-app-profile.md §2 CoachProfileEditPage 页面
 *   - docs/module-design/web-app-profile.md §3 Feature 私有组件
 *   - docs/module-design/web-app-profile.md §6.2 教练资料编辑 -- 前端校验规则
 *
 * Mock 策略:
 *   - Mock hooks（useCurrentUser, useCoachProfile, useUpdateCoachProfile）的返回值
 *   - Mock react-router-dom 导航
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

// Mock useCoachProfile hook
let mockCoachProfileData: {
  data: unknown;
  isLoading: boolean;
  error: unknown;
} = {
  data: null,
  isLoading: false,
  error: null,
};

vi.mock('@web/features/profile/hooks/useCoachProfile', () => ({
  useCoachProfile: () => mockCoachProfileData,
}));

// Mock useUpdateCoachProfile hook
const mockUpdateCoachProfileMutate = vi.fn();
let mockUpdateCoachProfileState = {
  mutate: mockUpdateCoachProfileMutate,
  isPending: false,
};

vi.mock('@web/features/profile/hooks/useUpdateCoachProfile', () => ({
  useUpdateCoachProfile: () => mockUpdateCoachProfileState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { CoachProfileEditPage } from '@web/features/profile/pages/CoachProfileEditPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<CoachProfileEditPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CoachProfileEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserData = {
      data: {
        id: 'current-user-id',
        isCoach: true,
        nickname: '教练A',
      },
      isLoading: false,
    };
    mockCoachProfileData = {
      data: {
        bio: '10年教学经验',
        specialties: ['singles', 'footwork'],
      },
      isLoading: false,
      error: null,
    };
    mockUpdateCoachProfileState = {
      mutate: mockUpdateCoachProfileMutate,
      isPending: false,
    };
  });

  // =========================================================================
  // CoachGuard — 非教练用户
  // =========================================================================

  // 来源: web-app-profile.md §2 — CoachProfileEditPage — 交互流程 — CoachGuard
  it('should show prompt to enable coach mode for non-coach users', () => {
    mockCurrentUserData = {
      data: {
        id: 'current-user-id',
        isCoach: false,
        nickname: '普通用户',
      },
      isLoading: false,
    };
    renderPage();

    expect(screen.getByText(/请先在设置中开启教练模式/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — CoachProfileEditPage — 交互流程 — CoachGuard — 跳转按钮
  it('should provide link to settings page for non-coach users', () => {
    mockCurrentUserData = {
      data: {
        id: 'current-user-id',
        isCoach: false,
        nickname: '普通用户',
      },
      isLoading: false,
    };
    renderPage();

    const settingsLink = screen.getByRole('button', { name: /设置/ });
    expect(settingsLink).toBeInTheDocument();
  });

  // =========================================================================
  // 基本渲染 — 教练资料表单
  // =========================================================================

  // 来源: web-app-profile.md §2 — CoachProfileEditPage — 交互流程 — 回填 bio
  it('should render form with current coach bio pre-filled', () => {
    renderPage();

    const bioInput = screen.getByDisplayValue('10年教学经验');
    expect(bioInput).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — CoachProfileEditPage — 组件结构 — SpecialtySelector
  it('should render specialty selector with pre-selected specialties', () => {
    renderPage();

    // 已选择的标签应处于选中状态
    expect(screen.getByText(/单打/)).toBeInTheDocument();
    expect(screen.getByText(/步法/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — CoachProfileEditPage — 组件结构 — SpecialtySelector
  it('should render all 5 predefined specialty tags', () => {
    renderPage();

    expect(screen.getByText(/单打/)).toBeInTheDocument();
    expect(screen.getByText(/双打/)).toBeInTheDocument();
    expect(screen.getByText(/步法/)).toBeInTheDocument();
    expect(screen.getByText(/体能/)).toBeInTheDocument();
    expect(screen.getByText(/战术/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — CoachProfileEditPage — 组件结构 — TopBar
  it('should render save button', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument();
  });

  // =========================================================================
  // 首次编辑场景（COACHING_NOT_A_COACH 错误处理）
  // =========================================================================

  // 来源: web-app-profile.md §2 — CoachProfileEditPage — 调用的后端接口 — COACHING_NOT_A_COACH
  it('should initialize form with empty values when coach profile does not exist yet', () => {
    mockCoachProfileData = {
      data: null,
      isLoading: false,
      error: null,
    };
    renderPage();

    // 表单应可用，bio 为空
    expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument();
  });

  // =========================================================================
  // 表单校验
  // =========================================================================

  // 来源: web-app-profile.md §6.2 — 前端校验规则 — bio 最长 500 个字符
  it('should show error when coach bio exceeds 500 characters', async () => {
    const user = userEvent.setup();
    renderPage();

    const bioInput = screen.getByDisplayValue('10年教学经验');
    await user.clear(bioInput);
    await user.type(bioInput, 'x'.repeat(501));
    await user.click(screen.getByRole('button', { name: /保存/i }));

    expect(screen.getByText(/简介不能超过 500 个字符/)).toBeInTheDocument();
  });

  // =========================================================================
  // 保存交互
  // =========================================================================

  // 来源: web-app-profile.md §2 — CoachProfileEditPage — 交互流程 — 保存
  it('should call updateCoachProfile mutation when save button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /保存/i }));

    expect(mockUpdateCoachProfileMutate).toHaveBeenCalled();
  });

  // 来源: web-app-profile.md §2 — CoachProfileEditPage — 页面状态 — submitting
  it('should disable save button when submission is pending', () => {
    mockUpdateCoachProfileState = {
      mutate: mockUpdateCoachProfileMutate,
      isPending: true,
    };
    renderPage();

    expect(screen.getByRole('button', { name: /保存/i })).toBeDisabled();
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-profile.md §2 — CoachProfileEditPage — 页面状态 — isLoading
  it('should show loading state when coach profile is loading', () => {
    mockCoachProfileData = {
      data: null,
      isLoading: true,
      error: null,
    };
    renderPage();

    // 表单不应渲染，加载中
    expect(screen.queryByDisplayValue('10年教学经验')).not.toBeInTheDocument();
  });
});
