/**
 * 契约测试: web-app/coaching — CoachListPage 页面渲染
 * 覆盖页面: CoachListPage (/coaches)
 *
 * 来源文档:
 *   - docs/module-design/web-app-coaching.md §2 — CoachListPage 页面
 *   - docs/module-design/web-app-coaching.md §3 — Feature 私有组件
 *   - docs/module-design/web-app-coaching.md §6.1 — 教练列表评分聚合逻辑
 *
 * Mock 策略:
 *   - Mock hooks（useCoachList, useCoachRatings）的返回值
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
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock authStore
vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-token',
      userId: 'current-user-id',
      isLoggedIn: true,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

// Mock useCoachList hook
const mockFetchNextPage = vi.fn();
let mockCoachListState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
  hasNextPage: false,
  fetchNextPage: mockFetchNextPage,
  isFetchingNextPage: false,
};

vi.mock('@web/features/coaching/hooks/useCoachList', () => ({
  useCoachList: () => mockCoachListState,
}));

// Mock useCoachRatings hook
let mockCoachRatingsState = {
  mergedCoaches: [] as unknown[],
  isRatingsLoading: false,
};

vi.mock('@web/features/coaching/hooks/useCoachRatings', () => ({
  useCoachRatings: () => mockCoachRatingsState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { CoachListPage } from '@web/features/coaching/pages/CoachListPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCoach = {
  userId: 'coach-uuid-1',
  nickname: '教练张',
  avatarUrl: 'https://example.com/avatar.jpg',
  bio: '10年教学经验',
  specialties: ['singles', 'footwork'],
  studentCount: 42,
  averageRating: 4.5,
  totalCount: 15,
};

const mockCoachNoRating = {
  userId: 'coach-uuid-2',
  nickname: '教练李',
  avatarUrl: null,
  bio: null,
  specialties: ['doubles'],
  studentCount: 10,
  averageRating: null,
  totalCount: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<CoachListPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CoachListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCoachListState = {
      data: null,
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    mockCoachRatingsState = {
      mergedCoaches: [],
      isRatingsLoading: false,
    };
  });

  // =========================================================================
  // 基本渲染
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachListPage — 组件结构 — SpecialtyFilter
  it('should render specialty filter bar', () => {
    renderPage();

    // 擅长方向筛选栏应可见
    expect(screen.getByText(/全部/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachListPage — 页面状态 — isLoading
  it('should show loading spinner when data is loading', () => {
    mockCoachListState = {
      ...mockCoachListState,
      isLoading: true,
    };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 空状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachListPage — 组件结构 — EmptyState
  it('should show empty state when no coaches found', () => {
    mockCoachRatingsState = {
      mergedCoaches: [],
      isRatingsLoading: false,
    };
    mockCoachListState = {
      ...mockCoachListState,
      data: { pages: [{ items: [], total: 0 }] },
    };
    renderPage();

    // 空状态提示应可见
    expect(screen.getByText(/暂无/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 教练卡片列表渲染
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachListPage — 组件结构 — CoachCard
  it('should render coach cards with nickname and specialties', () => {
    mockCoachRatingsState = {
      mergedCoaches: [mockCoach],
      isRatingsLoading: false,
    };
    renderPage();

    expect(screen.getByText('教练张')).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §6.1 — 教练列表评分聚合逻辑 — 评分展示
  it('should render coach rating when available', () => {
    mockCoachRatingsState = {
      mergedCoaches: [mockCoach],
      isRatingsLoading: false,
    };
    renderPage();

    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §6.1 — 教练列表评分聚合逻辑 — 无评价降级
  it('should show "暂无评价" when coach has no rating', () => {
    mockCoachRatingsState = {
      mergedCoaches: [mockCoachNoRating],
      isRatingsLoading: false,
    };
    renderPage();

    expect(screen.getByText(/暂无评价/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — CoachListPage — 组件结构 — CoachCard (学员数)
  it('should render student count on coach card', () => {
    mockCoachRatingsState = {
      mergedCoaches: [mockCoach],
      isRatingsLoading: false,
    };
    renderPage();

    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  // =========================================================================
  // 交互：点击教练卡片导航
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachListPage — 交互流程 — 查看教练
  it('should navigate to coach profile page when card is clicked', async () => {
    mockCoachRatingsState = {
      mergedCoaches: [mockCoach],
      isRatingsLoading: false,
    };
    renderPage();

    const coachCard = screen.getByText('教练张').closest('[data-testid]') ||
      screen.getByText('教练张').closest('div');
    if (coachCard) {
      await userEvent.click(coachCard);
    }

    expect(mockNavigate).toHaveBeenCalledWith('/coaches/coach-uuid-1');
  });

  // =========================================================================
  // 交互：擅长方向筛选
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachListPage — 交互流程 — 筛选操作
  it('should render specialty filter tags (singles, doubles, footwork, fitness, tactics)', () => {
    renderPage();

    // 各筛选标签应可见
    expect(screen.getByText(/单打/i)).toBeInTheDocument();
    expect(screen.getByText(/双打/i)).toBeInTheDocument();
    expect(screen.getByText(/步法/i)).toBeInTheDocument();
    expect(screen.getByText(/体能/i)).toBeInTheDocument();
    expect(screen.getByText(/战术/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachListPage — 调用的后端接口 — GET /api/coaches 错误处理
  it('should show error state when loading fails', () => {
    mockCoachListState = {
      ...mockCoachListState,
      error: new Error('加载失败'),
    };
    renderPage();

    expect(screen.getByText(/错误|失败|重试/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 多教练列表渲染
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachListPage — 组件结构 — CoachCardList
  it('should render multiple coach cards', () => {
    mockCoachRatingsState = {
      mergedCoaches: [mockCoach, mockCoachNoRating],
      isRatingsLoading: false,
    };
    renderPage();

    expect(screen.getByText('教练张')).toBeInTheDocument();
    expect(screen.getByText('教练李')).toBeInTheDocument();
  });
});
