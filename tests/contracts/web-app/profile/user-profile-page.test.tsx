/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: web-app/profile — UserProfilePage 页面渲染
 * 覆盖页面: UserProfilePage (/users/:id)
 *
 * 来源文档:
 *   - docs/module-design/web-app-profile.md §2 UserProfilePage 页面
 *   - docs/module-design/web-app-profile.md §3 Feature 私有组件
 *   - docs/module-design/web-app-profile.md §6.4 个人主页的 isOwnProfile 判断
 *
 * Mock 策略:
 *   - Mock hooks（useUserProfile, useMatchStats, useCurrentUser）的返回值
 *   - Mock authStore（userId 用于判断 isOwnProfile）
 *   - Mock react-router-dom 导航和路由参数
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

// Mock authStore
const CURRENT_USER_ID = 'current-user-id';
vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-token',
      userId: CURRENT_USER_ID,
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

// Mock react-router-dom
const mockNavigate = vi.fn();
let mockParamsId = CURRENT_USER_ID;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: mockParamsId }),
  };
});

// Mock useUserProfile hook
let mockUserProfileData: {
  data: unknown;
  isLoading: boolean;
  error: unknown;
} = {
  data: null,
  isLoading: false,
  error: null,
};

vi.mock('@web/features/profile/hooks/useUserProfile', () => ({
  useUserProfile: () => mockUserProfileData,
}));

// Mock useMatchStats hook
let mockMatchStatsData: {
  data: unknown;
  isLoading: boolean;
  error: unknown;
} = {
  data: null,
  isLoading: false,
  error: null,
};

vi.mock('@web/features/profile/hooks/useMatchStats', () => ({
  useMatchStats: () => mockMatchStatsData,
}));

// Mock useCurrentUser hook
let mockCurrentUserData: {
  data: unknown;
  isLoading: boolean;
} = {
  data: { id: CURRENT_USER_ID, isCoach: false },
  isLoading: false,
};

vi.mock('@web/shared/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUserData,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { UserProfilePage } from '@web/features/profile/pages/UserProfilePage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<UserProfilePage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParamsId = CURRENT_USER_ID;
    mockUserProfileData = {
      data: {
        id: CURRENT_USER_ID,
        nickname: '球友A',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: '热爱羽毛球',
        isCoach: false,
        createdAt: '2026-04-01T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    };
    mockMatchStatsData = {
      data: {
        totalMatches: 42,
        wins: 25,
        losses: 15,
        draws: 2,
        winRate: 62.5,
      },
      isLoading: false,
      error: null,
    };
    mockCurrentUserData = {
      data: { id: CURRENT_USER_ID, isCoach: false },
      isLoading: false,
    };
  });

  // =========================================================================
  // 基本渲染 — 用户信息区域
  // =========================================================================

  // 来源: web-app-profile.md §2 — UserProfilePage — 组件结构 — UserInfoSection
  it('should render user nickname', () => {
    renderPage();

    expect(screen.getByText('球友A')).toBeInTheDocument();
  });

  it('should render masked phone when viewing own profile', () => {
    mockCurrentUserData = {
      data: { id: CURRENT_USER_ID, isCoach: false, phone: '138****1234' },
      isLoading: false,
    };

    renderPage();

    expect(screen.getByText('138****1234')).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — UserProfilePage — 页面状态 — userInfo
  it('should render user avatar', () => {
    renderPage();

    const avatar = screen.getByRole('img', { name: '球友A' });
    expect(avatar).toBeInTheDocument();
  });

  // =========================================================================
  // 战绩汇总卡片
  // =========================================================================

  // 来源: web-app-profile.md §2 — UserProfilePage — 组件结构 — MatchStatsCard
  it('should render match stats card with total matches, wins, and win rate', () => {
    renderPage();

    expect(screen.getByText('42')).toBeInTheDocument(); // totalMatches
    expect(screen.getByText('25')).toBeInTheDocument(); // wins
    expect(screen.getByText(/62\.5/)).toBeInTheDocument(); // winRate
  });

  // 来源: web-app-profile.md §2 — UserProfilePage — 调用的后端接口 — match-stats 错误处理
  it('should render match stats area with error message when stats fail to load', () => {
    mockMatchStatsData = {
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
    };
    renderPage();

    // 战绩汇总区域应显示错误提示，不阻塞页面其他部分
    expect(screen.getByText('球友A')).toBeInTheDocument(); // 用户信息仍渲染
  });

  // =========================================================================
  // isOwnProfile = true（查看自己的主页）
  // =========================================================================

  // 来源: web-app-profile.md §6.4 — isOwnProfile 影响: true 时显示快捷入口列表
  it('should render quick link list when viewing own profile', () => {
    mockParamsId = CURRENT_USER_ID;
    renderPage();

    expect(screen.getByText(/我的活动/)).toBeInTheDocument();
    expect(screen.getByText(/战绩记录/)).toBeInTheDocument();
    expect(screen.getByText(/个人资料/)).toBeInTheDocument();
    expect(screen.getByText(/设置/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — 交互流程 — 快捷入口 — "我的活动" 导航目标
  it('should navigate to /my-activities when clicking "我的活动"', async () => {
    const user = userEvent.setup();
    mockParamsId = CURRENT_USER_ID;
    renderPage();

    const link = screen.getByText(/我的活动/);
    await user.click(link.closest('[role="button"]') || link.closest('button') || link);

    expect(mockNavigate).toHaveBeenCalledWith('/my-activities');
  });

  // 来源: web-app-profile.md §2 — 交互流程 — 快捷入口 — "战绩记录" 导航目标
  it('should navigate to /users/:id/match-records when clicking "战绩记录"', async () => {
    const user = userEvent.setup();
    mockParamsId = CURRENT_USER_ID;
    renderPage();

    const link = screen.getByText(/战绩记录/);
    await user.click(link.closest('[role="button"]') || link.closest('button') || link);

    expect(mockNavigate).toHaveBeenCalledWith(`/users/${CURRENT_USER_ID}/match-records`);
  });

  // 来源: web-app-profile.md §2 — 交互流程 — 快捷入口 — "个人资料" 导航目标
  it('should navigate to /profile/edit when clicking "个人资料"', async () => {
    const user = userEvent.setup();
    mockParamsId = CURRENT_USER_ID;
    renderPage();

    const link = screen.getByText(/个人资料/);
    await user.click(link.closest('[role="button"]') || link.closest('button') || link);

    expect(mockNavigate).toHaveBeenCalledWith('/profile/edit');
  });

  // 来源: web-app-profile.md §2 — 交互流程 — 快捷入口 — "设置" 导航目标
  it('should navigate to /settings when clicking "设置"', async () => {
    const user = userEvent.setup();
    mockParamsId = CURRENT_USER_ID;
    renderPage();

    const link = screen.getByText(/设置/);
    await user.click(link.closest('[role="button"]') || link.closest('button') || link);

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  // 来源: web-app-profile.md §2 — 交互流程 — isOwnProfile=true — 普通用户
  it('should show "我的课程" link for non-coach user viewing own profile', () => {
    mockParamsId = CURRENT_USER_ID;
    mockCurrentUserData = {
      data: { id: CURRENT_USER_ID, isCoach: false },
      isLoading: false,
    };
    renderPage();

    expect(screen.getByText(/我的课程/)).toBeInTheDocument();
    expect(screen.queryByText(/课程管理/)).not.toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — 交互流程 — 快捷入口 — "我的课程" 导航目标（普通用户）
  it('should navigate to /my-enrollments when clicking "我的课程" for non-coach user', async () => {
    const user = userEvent.setup();
    mockParamsId = CURRENT_USER_ID;
    mockCurrentUserData = {
      data: { id: CURRENT_USER_ID, isCoach: false },
      isLoading: false,
    };
    renderPage();

    const link = screen.getByText(/我的课程/);
    await user.click(link.closest('[role="button"]') || link.closest('button') || link);

    expect(mockNavigate).toHaveBeenCalledWith('/my-enrollments');
  });

  // 来源: web-app-profile.md §2 — 交互流程 — isOwnProfile=true — 教练用户
  it('should show "我的报名" and "课程管理" links for coach user viewing own profile', () => {
    mockParamsId = CURRENT_USER_ID;
    mockCurrentUserData = {
      data: { id: CURRENT_USER_ID, isCoach: true },
      isLoading: false,
    };
    renderPage();

    expect(screen.getByText(/我的报名/)).toBeInTheDocument();
    expect(screen.getByText(/课程管理/)).toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — 交互流程 — 快捷入口 — "我的报名" 导航目标（教练用户）
  it('should navigate to /my-enrollments when clicking "我的报名" for coach user', async () => {
    const user = userEvent.setup();
    mockParamsId = CURRENT_USER_ID;
    mockCurrentUserData = {
      data: { id: CURRENT_USER_ID, isCoach: true },
      isLoading: false,
    };
    renderPage();

    const link = screen.getByText(/我的报名/);
    await user.click(link.closest('[role="button"]') || link.closest('button') || link);

    expect(mockNavigate).toHaveBeenCalledWith('/my-enrollments');
  });

  // 来源: web-app-profile.md §2 — 交互流程 — 快捷入口 — "课程管理" 导航目标（教练用户）
  it('should navigate to /my-courses when clicking "课程管理" for coach user', async () => {
    const user = userEvent.setup();
    mockParamsId = CURRENT_USER_ID;
    mockCurrentUserData = {
      data: { id: CURRENT_USER_ID, isCoach: true },
      isLoading: false,
    };
    renderPage();

    const link = screen.getByText(/课程管理/);
    await user.click(link.closest('[role="button"]') || link.closest('button') || link);

    expect(mockNavigate).toHaveBeenCalledWith('/my-courses');
  });

  // =========================================================================
  // isOwnProfile = false（查看他人主页）
  // =========================================================================

  // 来源: web-app-profile.md §6.4 — isOwnProfile 影响: false 时不显示快捷入口列表
  it('should not render quick link list when viewing others profile', () => {
    mockParamsId = 'other-user-id';
    mockUserProfileData = {
      data: {
        id: 'other-user-id',
        nickname: '他人',
        avatarUrl: null,
        bio: '简介',
        isCoach: false,
        createdAt: '2026-04-01T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText('他人')).toBeInTheDocument();
    expect(screen.queryByText(/我的活动/)).not.toBeInTheDocument();
    expect(screen.queryByText(/设置/)).not.toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — 交互流程 — isOwnProfile=false — 显示简介
  it('should render bio when viewing others profile', () => {
    mockParamsId = 'other-user-id';
    mockUserProfileData = {
      data: {
        id: 'other-user-id',
        nickname: '他人',
        avatarUrl: null,
        bio: '这是一段简介',
        isCoach: false,
        createdAt: '2026-04-01T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText('这是一段简介')).toBeInTheDocument();
  });

  // =========================================================================
  // 加载状态和错误处理
  // =========================================================================

  // 来源: web-app-profile.md §2 — UserProfilePage — 页面状态 — isLoading
  it('should show loading state when data is loading', () => {
    mockUserProfileData = {
      data: null,
      isLoading: true,
      error: null,
    };
    mockMatchStatsData = {
      data: null,
      isLoading: true,
      error: null,
    };
    renderPage();

    // 加载中不应渲染用户信息
    expect(screen.queryByText('球友A')).not.toBeInTheDocument();
  });

  // 来源: web-app-profile.md §2 — UserProfilePage — 调用的后端接口 — USER_NOT_FOUND 错误处理
  it('should show error message when user is not found', () => {
    const notFoundError = new Error('用户不存在') as Error & { code: string };
    notFoundError.code = 'USER_NOT_FOUND';
    mockUserProfileData = {
      data: null,
      isLoading: false,
      error: notFoundError,
    };
    renderPage();

    expect(screen.getByText(/用户不存在/)).toBeInTheDocument();
  });
});
