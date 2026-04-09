/**
 * 契约测试: web-app/activity — MyActivityListPage 页面渲染
 * 覆盖页面: MyActivityListPage (/my-activities)
 *
 * 来源文档:
 *   - docs/module-design/web-app-activity.md §2 — MyActivityListPage 页面
 *   - docs/module-design/web-app-activity.md §3 — Feature 私有组件
 *   - docs/module-design/web-app-activity.md §6 — 关键业务逻辑
 *
 * Mock 策略:
 *   - Mock hooks（useMyActivities）的返回值
 *   - Mock authStore（当前用户 ID）
 *   - Mock react-router-dom 导航和 URL 查询参数
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

const mockNavigate = vi.fn();
const mockUseMyActivities = vi.fn();

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

// Mock useMyActivities hook
const mockFetchNextPage = vi.fn();
let mockMyActivitiesState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
  hasNextPage: false,
  fetchNextPage: mockFetchNextPage,
  isFetchingNextPage: false,
};

vi.mock('@web/features/activity/hooks/useMyActivities', () => ({
  useMyActivities: (params: unknown) => {
    mockUseMyActivities(params);
    return mockMyActivitiesState;
  },
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { MyActivityListPage } from '@web/features/activity/pages/MyActivityListPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockActivity = {
  id: 'activity-uuid-1',
  creatorId: 'current-user-id',
  venue: {
    id: 'venue-uuid-1',
    name: '朝阳体育中心羽毛球馆',
    address: '北京市朝阳区...',
    latitude: 39.9215,
    longitude: 116.4435,
  },
  title: '我发起的活动',
  startTime: '2026-04-05T14:00:00.000Z',
  endTime: '2026-04-05T16:00:00.000Z',
  maxParticipants: 8,
  currentParticipants: 3,
  status: 'open',
  createdAt: '2026-04-02T10:00:00.000Z',
};

const mockActivity2 = {
  ...mockActivity,
  id: 'activity-uuid-2',
  creatorId: 'other-user-id',
  title: '我参加的活动',
  status: 'completed',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<MyActivityListPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MyActivityListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMyActivitiesState = {
      data: null,
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
  });

  // =========================================================================
  // 基本渲染
  // =========================================================================

  it('should not render role filter tabs', () => {
    renderPage();

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/我发起的/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/我参加的/i)).not.toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — MyActivityListPage — 组件结构 — StatusFilter
  it('should render status filter dropdown', () => {
    renderPage();

    expect(screen.getByText(/状态/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 加载与空状态
  // =========================================================================

  // 来源: web-app-activity.md §2 — MyActivityListPage — 页面状态 — isLoading
  it('should show loading spinner when data is loading', () => {
    mockMyActivitiesState = {
      ...mockMyActivitiesState,
      isLoading: true,
    };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — MyActivityListPage — 组件结构 — EmptyState
  it('should show empty state when no activities', () => {
    mockMyActivitiesState = {
      ...mockMyActivitiesState,
      data: {
        pages: [{ items: [], total: 0, page: 1, pageSize: 20 }],
      },
    };
    renderPage();

    expect(screen.getByText(/暂无/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 活动列表渲染
  // =========================================================================

  // 来源: web-app-activity.md §2 — MyActivityListPage — 组件结构 — ActivityCardList
  it('should render activity cards', () => {
    mockMyActivitiesState = {
      ...mockMyActivitiesState,
      data: {
        pages: [
          {
            items: [mockActivity, mockActivity2],
            total: 2,
            page: 1,
            pageSize: 20,
          },
        ],
      },
    };
    renderPage();

    expect(screen.getByText('我发起的活动')).toBeInTheDocument();
    expect(screen.getByText('我参加的活动')).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — MyActivityListPage — ActivityCard 复用
  it('should render activity card with status tag', () => {
    mockMyActivitiesState = {
      ...mockMyActivitiesState,
      data: {
        pages: [
          {
            items: [mockActivity2],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        ],
      },
    };
    renderPage();

    expect(screen.getByText(/已结束/i)).toBeInTheDocument();
  });

  it('should request all activities without role filter', () => {
    renderPage();

    expect(mockUseMyActivities).toHaveBeenCalledWith({
      userId: 'current-user-id',
      status: null,
    });
  });

  // =========================================================================
  // 导航交互
  // =========================================================================

  // 来源: web-app-activity.md §2 — MyActivityListPage — 交互流程 — 查看详情
  it('should navigate to activity detail page when card is clicked', async () => {
    const user = userEvent.setup();
    mockMyActivitiesState = {
      ...mockMyActivitiesState,
      data: {
        pages: [
          {
            items: [mockActivity],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        ],
      },
    };
    renderPage();

    await user.click(screen.getByText('我发起的活动'));

    expect(mockNavigate).toHaveBeenCalledWith('/activities/activity-uuid-1');
  });

  // 来源: web-app-activity.md §2 — MyActivityListPage — 交互流程 — 返回
  it('should navigate back when back button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    const backButton = screen.getByRole('button', { name: /返回/i });
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: web-app-activity.md §2 — MyActivityListPage — 错误处理 — PageError
  it('should show error state when loading fails', () => {
    mockMyActivitiesState = {
      ...mockMyActivitiesState,
      error: new Error('加载失败'),
    };
    renderPage();

    expect(screen.getByText(/错误|失败/i)).toBeInTheDocument();
  });
});
