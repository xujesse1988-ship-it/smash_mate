/**
 * 契约测试: web-app/coaching — MyEnrollmentListPage 页面渲染
 * 覆盖页面: MyEnrollmentListPage (/my-enrollments)
 *
 * 来源文档:
 *   - docs/module-design/web-app-coaching.md §2 — MyEnrollmentListPage 页面
 *   - docs/module-design/web-app-coaching.md §3 — Feature 私有组件
 *
 * Mock 策略:
 *   - Mock hooks（useMyEnrollments）的返回值
 *   - Mock react-router-dom 导航
 *   - Mock authStore 获取当前用户 ID
 *   - 不关心数据获取链路，只验证页面渲染正确性和交互响应
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock Modules
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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

// Mock useMyEnrollments hook
const mockFetchNextPage = vi.fn();
let mockEnrollmentsState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
  hasNextPage: false,
  fetchNextPage: mockFetchNextPage,
  isFetchingNextPage: false,
};

vi.mock('@web/features/coaching/hooks/useMyEnrollments', () => ({
  useMyEnrollments: () => mockEnrollmentsState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { MyEnrollmentListPage } from '@web/features/coaching/pages/MyEnrollmentListPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockGroupClassEnrollment = {
  type: 'group-class',
  groupClass: {
    id: 'gc-uuid-1',
    title: '初级单打提升班',
    coachId: 'coach-uuid-1',
    coachNickname: '教练张',
    venue: { id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆' },
    startTime: '2026-04-10T14:00:00.000Z',
    endTime: '2026-04-10T16:00:00.000Z',
    status: 'open',
    enrolledAt: '2026-04-03T09:00:00.000Z',
  },
  privateLesson: null,
};

const mockPrivateLessonEnrollment = {
  type: 'private-lesson',
  groupClass: null,
  privateLesson: {
    id: 'pl-uuid-1',
    coachId: 'coach-uuid-1',
    coachNickname: '教练张',
    venue: { id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆' },
    startTime: '2026-04-11T10:00:00.000Z',
    endTime: '2026-04-11T12:00:00.000Z',
    status: 'scheduled',
    createdAt: '2026-04-03T10:00:00.000Z',
  },
};

const mockCompletedEnrollment = {
  type: 'group-class',
  groupClass: {
    id: 'gc-uuid-2',
    title: '高级战术课',
    coachId: 'coach-uuid-2',
    coachNickname: '教练李',
    venue: { id: 'venue-uuid-2', name: '海淀体育馆' },
    startTime: '2026-03-15T14:00:00.000Z',
    endTime: '2026-03-15T16:00:00.000Z',
    status: 'completed',
    enrolledAt: '2026-03-10T09:00:00.000Z',
  },
  privateLesson: null,
};

const mockCancelledEnrollment = {
  type: 'private-lesson',
  groupClass: null,
  privateLesson: {
    id: 'pl-uuid-2',
    coachId: 'coach-uuid-2',
    coachNickname: '教练李',
    venue: null,
    startTime: '2026-03-20T10:00:00.000Z',
    endTime: '2026-03-20T12:00:00.000Z',
    status: 'cancelled',
    createdAt: '2026-03-15T10:00:00.000Z',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<MyEnrollmentListPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MyEnrollmentListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnrollmentsState = {
      data: null,
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 页面状态 — isLoading
  it('should show loading spinner when data is loading', () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      isLoading: true,
    };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 空状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 组件结构 — EmptyState
  it('should show empty state when no enrollments', () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      data: { pages: [{ items: [], total: 0 }] },
    };
    renderPage();

    expect(screen.getByText(/暂无/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 筛选栏
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 组件结构 — EnrollmentFilterBar
  it('should render type filter options', () => {
    renderPage();

    expect(screen.getByText(/全部/i)).toBeInTheDocument();
    expect(screen.getByText(/团课/i)).toBeInTheDocument();
    expect(screen.getByText(/私教/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 交互流程 — 状态筛选
  it('should render status filter options', () => {
    renderPage();

    expect(screen.getByText(/待开课/i)).toBeInTheDocument();
    expect(screen.getByText(/进行中/i)).toBeInTheDocument();
    expect(screen.getByText(/已结束/i)).toBeInTheDocument();
    expect(screen.getByText(/已取消/i)).toBeInTheDocument();
  });

  it('should render back button in page header', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /返回/i })).toBeInTheDocument();
  });

  // =========================================================================
  // 团课报名卡片渲染
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 组件结构 — EnrollmentCard (团课)
  it('should render group class enrollment card', () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      data: { pages: [{ items: [mockGroupClassEnrollment], total: 1 }] },
    };
    renderPage();

    expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
    expect(screen.getByText(/教练张/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 组件结构 — EnrollmentCard (状态标签)
  it('should show status tag on enrollment card', () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      data: { pages: [{ items: [mockCompletedEnrollment], total: 1 }] },
    };
    renderPage();

    // "已结束" appears in both filter button and card status tag, use within() on card
    const card = screen.getByTestId('enrollment-card-gc-uuid-2');
    expect(within(card).getByText(/已结束/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 私教报名卡片渲染
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 组件结构 — EnrollmentCard (私教)
  it('should render private lesson enrollment card', () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      data: { pages: [{ items: [mockPrivateLessonEnrollment], total: 1 }] },
    };
    renderPage();

    expect(screen.getByText(/教练张/)).toBeInTheDocument();
    expect(screen.getByText(/朝阳体育中心羽毛球馆/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 组件结构 — EnrollmentCard (cancelled)
  it('should render cancelled enrollment with status tag', () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      data: { pages: [{ items: [mockCancelledEnrollment], total: 1 }] },
    };
    renderPage();

    // "已取消" appears in both filter button and card status tag, use within() on card
    const card = screen.getByTestId('enrollment-card-pl-uuid-2');
    expect(within(card).getByText(/已取消/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 混合列表渲染
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 组件结构 — EnrollmentCardList
  it('should render mixed enrollment types', () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      data: {
        pages: [{ items: [mockGroupClassEnrollment, mockPrivateLessonEnrollment], total: 2 }],
      },
    };
    renderPage();

    expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
    // Both cards should have coach nickname
    const coachNames = screen.getAllByText(/教练张/);
    expect(coachNames.length).toBeGreaterThanOrEqual(2);
  });

  // =========================================================================
  // 导航交互
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 交互流程 — 查看课程详情 (团课)
  it('should navigate to group class detail when group class card is clicked', async () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      data: { pages: [{ items: [mockGroupClassEnrollment], total: 1 }] },
    };
    renderPage();

    const card =
      screen.getByText('初级单打提升班').closest('[data-testid]') ||
      screen.getByText('初级单打提升班').closest('div');
    if (card) {
      await userEvent.click(card);
    }

    expect(mockNavigate).toHaveBeenCalledWith('/group-classes/gc-uuid-1');
  });

  it('should navigate back when clicking page header back button', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /返回/i }));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 交互流程 — 查看课程详情 (私教)
  it('should navigate to coach profile when private lesson card is clicked', async () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      data: { pages: [{ items: [mockPrivateLessonEnrollment], total: 1 }] },
    };
    renderPage();

    // Click on the private lesson card
    const coachName = screen.getByText(/教练张/);
    const card = coachName.closest('[data-testid]') || coachName.closest('div');
    if (card) {
      await userEvent.click(card);
    }

    expect(mockNavigate).toHaveBeenCalledWith('/private-lessons/pl-uuid-1');
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — 调用的后端接口 — 错误处理
  it('should show error state when loading fails', () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      error: new Error('加载失败'),
    };
    renderPage();

    expect(screen.getByText(/错误|失败|重试/i)).toBeInTheDocument();
  });

  // =========================================================================
  // Null venue 处理
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyEnrollmentListPage — venue 可能为 null
  it('should handle null venue in enrollment card gracefully', () => {
    mockEnrollmentsState = {
      ...mockEnrollmentsState,
      data: { pages: [{ items: [mockCancelledEnrollment], total: 1 }] },
    };
    renderPage();

    // Should not crash — the cancelled enrollment has venue: null
    expect(screen.getByText(/教练李/)).toBeInTheDocument();
  });
});
