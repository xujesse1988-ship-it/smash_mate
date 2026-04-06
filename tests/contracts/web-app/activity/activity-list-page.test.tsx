/**
 * 契约测试: web-app/activity — ActivityListPage 页面渲染
 * 覆盖页面: ActivityListPage (/activities)
 *
 * 来源文档:
 *   - docs/module-design/web-app-activity.md §2 — ActivityListPage 页面
 *   - docs/module-design/web-app-activity.md §3 — Feature 私有组件
 *   - docs/module-design/web-app-activity.md §6 — 关键业务逻辑
 *
 * Mock 策略:
 *   - Mock hooks（useActivities）的返回值
 *   - Mock useGeolocation（定位状态）
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

// Mock useActivities hook
const mockFetchNextPage = vi.fn();
let mockActivitiesState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
  hasNextPage: false,
  fetchNextPage: mockFetchNextPage,
  isFetchingNextPage: false,
};

vi.mock('@web/features/activity/hooks/useActivities', () => ({
  useActivities: () => mockActivitiesState,
}));

// Mock useGeolocation hook
let mockGeolocationState = {
  latitude: null as number | null,
  longitude: null as number | null,
  permission: 'prompt' as 'granted' | 'denied' | 'prompt',
  loading: false,
  requestLocation: vi.fn(),
};

vi.mock('@web/shared/hooks/useGeolocation', () => ({
  useGeolocation: () => mockGeolocationState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { ActivityListPage } from '@web/features/activity/pages/ActivityListPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockActivity = {
  id: 'activity-uuid-1',
  creatorId: 'user-uuid-1',
  venue: {
    id: 'venue-uuid-1',
    name: '朝阳体育中心羽毛球馆',
    address: '北京市朝阳区...',
    latitude: 39.9215,
    longitude: 116.4435,
  },
  title: '周末约球',
  startTime: '2026-04-05T14:00:00.000Z',
  endTime: '2026-04-05T16:00:00.000Z',
  maxParticipants: 8,
  currentParticipants: 3,
  status: 'open',
  distance: 1.2,
  createdAt: '2026-04-02T10:00:00.000Z',
};

const mockActivityNoTitle = {
  ...mockActivity,
  id: 'activity-uuid-2',
  title: null,
};

const mockActivityNullVenue = {
  ...mockActivity,
  id: 'activity-uuid-3',
  title: null,
  venue: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<ActivityListPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivitiesState = {
      data: null,
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    mockGeolocationState = {
      latitude: null,
      longitude: null,
      permission: 'prompt',
      loading: false,
      requestLocation: vi.fn(),
    };
  });

  // =========================================================================
  // 基本渲染
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityListPage — 组件结构 — FilterBar
  it('should render filter bar with filter buttons', () => {
    renderPage();

    // 筛选栏应可见（时间筛选、空余筛选）
    expect(screen.getByText(/时间/i)).toBeInTheDocument();
    expect(screen.getByText(/有空位/i)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — ActivityListPage — 组件结构 — SortSelector
  it('should render sort selector with time as default', () => {
    renderPage();

    expect(screen.getByText(/按时间/i)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — ActivityListPage — 组件结构 — CreateActivityFAB
  it('should render floating action button for creating activity', () => {
    renderPage();

    // 悬浮"+"按钮应可见
    const fab = screen.getByRole('button', { name: /发起/i });
    expect(fab).toBeInTheDocument();
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityListPage — 页面状态 — isLoading
  it('should show loading spinner when data is loading', () => {
    mockActivitiesState = {
      ...mockActivitiesState,
      isLoading: true,
    };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 空状态
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityListPage — 组件结构 — EmptyState
  it('should show empty state when no activities', () => {
    mockActivitiesState = {
      ...mockActivitiesState,
      data: {
        pages: [{ items: [], total: 0, page: 1, pageSize: 20 }],
      },
    };
    renderPage();

    // 空状态提示应可见
    expect(screen.getByText(/暂无/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityListPage — 错误处理 — PageError
  it('should show error state when loading fails', () => {
    mockActivitiesState = {
      ...mockActivitiesState,
      error: new Error('加载失败'),
    };
    renderPage();

    expect(screen.getByText(/错误|失败/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 活动列表渲染
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityListPage — 组件结构 — ActivityCard
  it('should render activity cards with venue name and time', () => {
    mockActivitiesState = {
      ...mockActivitiesState,
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

    // 活动标题应可见
    expect(screen.getByText('周末约球')).toBeInTheDocument();
    // 球馆名称应可见
    expect(screen.getByText(/朝阳体育中心/)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.5 — 活动卡片展示标题逻辑 — title 为空用球馆名称
  it('should display venue name as card title when activity title is null', () => {
    mockActivitiesState = {
      ...mockActivitiesState,
      data: {
        pages: [
          {
            items: [mockActivityNoTitle],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        ],
      },
    };
    renderPage();

    // 球馆名称应作为标题展示
    expect(screen.getByText(/朝阳体育中心/)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.5 — 活动卡片展示标题逻辑 — venue 为 null
  it('should display fallback title when venue is null', () => {
    mockActivitiesState = {
      ...mockActivitiesState,
      data: {
        pages: [
          {
            items: [mockActivityNullVenue],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        ],
      },
    };
    renderPage();

    // 应显示"已删除的球馆"
    expect(screen.getByText(/已删除的球馆/)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — ActivityListPage — ActivityCard — 人数展示
  it('should render participant count in activity card', () => {
    mockActivitiesState = {
      ...mockActivitiesState,
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

    // 人数展示 3/8
    expect(screen.getByText(/3.*\/.*8/)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.3 — 活动卡片距离展示
  it('should display distance when available', () => {
    mockActivitiesState = {
      ...mockActivitiesState,
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

    // 距离应可见
    expect(screen.getByText(/1\.2.*km/i)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — ActivityListPage — ActivityCard — 状态标签
  it('should render status tag on activity card', () => {
    mockActivitiesState = {
      ...mockActivitiesState,
      data: {
        pages: [
          {
            items: [{ ...mockActivity, status: 'full' }],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        ],
      },
    };
    renderPage();

    expect(screen.getByText(/已满员/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 导航交互
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityListPage — 交互流程 — 发起约球
  it('should navigate to create activity page when FAB is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /发起/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/activities/create');
  });

  // 来源: web-app-activity.md §2 — ActivityListPage — 交互流程 — 查看详情
  it('should navigate to activity detail page when card is clicked', async () => {
    const user = userEvent.setup();
    mockActivitiesState = {
      ...mockActivitiesState,
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

    // 点击活动卡片
    await user.click(screen.getByText('周末约球'));

    expect(mockNavigate).toHaveBeenCalledWith('/activities/activity-uuid-1');
  });

  // =========================================================================
  // 距离筛选与定位联动
  // =========================================================================

  // 来源: web-app-activity.md §6.3 — 距离筛选与定位联动 — permission 为 denied
  it('should hide distance filter button when location permission is denied', () => {
    mockGeolocationState = {
      ...mockGeolocationState,
      permission: 'denied',
    };
    renderPage();

    // 距离筛选按钮应隐藏
    expect(screen.queryByText(/距离/i)).not.toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.3 — 距离筛选与定位联动 — permission 为 granted
  it('should show distance filter button when location permission is granted', () => {
    mockGeolocationState = {
      ...mockGeolocationState,
      permission: 'granted',
      latitude: 39.9215,
      longitude: 116.4435,
    };
    renderPage();

    expect(screen.getByText(/距离/i)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.3 — 距离排序 — permission 为 denied 不可选距离排序
  it('should disable distance sort option when location permission is denied', () => {
    mockGeolocationState = {
      ...mockGeolocationState,
      permission: 'denied',
    };
    renderPage();

    // 排序选项中"按距离"应不可点击或不可见
    const distanceSortOption = screen.queryByText(/按距离/i);
    if (distanceSortOption) {
      expect(distanceSortOption).toHaveAttribute('aria-disabled', 'true');
    }
  });

  // =========================================================================
  // 多页数据
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityListPage — 交互流程 — 上拉加载更多
  it('should render activities from multiple pages', () => {
    const activity2 = {
      ...mockActivity,
      id: 'activity-uuid-second',
      title: '第二页活动',
    };

    mockActivitiesState = {
      ...mockActivitiesState,
      data: {
        pages: [
          { items: [mockActivity], total: 2, page: 1, pageSize: 1 },
          { items: [activity2], total: 2, page: 2, pageSize: 1 },
        ],
      },
      hasNextPage: false,
    };
    renderPage();

    expect(screen.getByText('周末约球')).toBeInTheDocument();
    expect(screen.getByText('第二页活动')).toBeInTheDocument();
  });
});
