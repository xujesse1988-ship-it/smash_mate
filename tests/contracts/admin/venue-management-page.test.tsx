/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: admin/venue-management — VenueManagementPage 页面渲染
 * 覆盖页面: VenueManagementPage (/venues)
 *
 * 来源文档:
 *   - docs/module-design/admin.md §8.3 VenueManagementPage 页面
 *   - docs/module-design/admin.md §9 Feature 私有组件（venue-management）
 *   - docs/module-design/admin.md §10 Feature 私有 Hooks（venue-management）
 *   - docs/module-design/admin.md §12.5 同步结果展示逻辑
 *   - docs/module-design/admin.md §12.6 球馆搜索防抖
 *
 * Mock 策略:
 *   - Mock hooks（useVenueList, useCityList, useRemoveVenue, useSyncVenues）的返回值
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
      token: 'test-admin-token',
      userId: 'admin-user-id',
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
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useVenueList hook
let mockVenueListData: {
  data:
    | {
        items: Array<{
          id: string;
          name: string;
          address: string;
          latitude: number;
          longitude: number;
          cityId: string;
          cityName: string;
          createdAt: string;
        }>;
        total: number;
        page: number;
        pageSize: number;
      }
    | undefined;
  isLoading: boolean;
  error: unknown;
} = {
  data: undefined,
  isLoading: false,
  error: null,
};

vi.mock('@admin/features/venue-management/hooks/useVenueList', () => ({
  useVenueList: () => mockVenueListData,
}));

// Mock useCityList hook (used for city filter dropdown)
let mockCityListForFilter: {
  data:
    | {
        items: Array<{
          id: string;
          name: string;
          venueCount: number;
          createdAt: string;
          updatedAt: string;
        }>;
        total: number;
        page: number;
        pageSize: number;
      }
    | undefined;
  isLoading: boolean;
  error: unknown;
} = {
  data: undefined,
  isLoading: false,
  error: null,
};

vi.mock('@admin/features/venue-management/hooks/useCityList', () => ({
  useCityList: () => mockCityListForFilter,
}));

// Mock useRemoveVenue hook
const mockRemoveVenueMutate = vi.fn();
let mockRemoveVenueState = {
  mutate: mockRemoveVenueMutate,
  isPending: false,
  variables: undefined as string | undefined,
};

vi.mock('@admin/features/venue-management/hooks/useRemoveVenue', () => ({
  useRemoveVenue: () => mockRemoveVenueState,
}));

// Mock useSyncVenues hook
const mockSyncVenuesMutate = vi.fn();
let mockSyncVenuesState = {
  mutate: mockSyncVenuesMutate,
  isPending: false,
};

vi.mock('@admin/features/venue-management/hooks/useSyncVenues', () => ({
  useSyncVenues: () => mockSyncVenuesState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { VenueManagementPage } from '@admin/features/venue-management/pages/VenueManagementPage';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const mockVenueItems = [
  {
    id: 'venue-uuid-1',
    name: '朝阳体育中心羽毛球馆',
    address: '北京市朝阳区工体北路',
    latitude: 39.9215,
    longitude: 116.4435,
    cityId: 'city-uuid-1',
    cityName: '北京',
    createdAt: '2026-04-01T10:00:00.000Z',
  },
  {
    id: 'venue-uuid-2',
    name: '浦东源深体育中心',
    address: '上海市浦东新区张杨路',
    latitude: 31.2304,
    longitude: 121.4737,
    cityId: 'city-uuid-2',
    cityName: '上海',
    createdAt: '2026-04-01T11:00:00.000Z',
  },
];

const mockCityItemsForFilter = [
  {
    id: 'city-uuid-1',
    name: '北京',
    venueCount: 42,
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  },
  {
    id: 'city-uuid-2',
    name: '上海',
    venueCount: 38,
    createdAt: '2026-04-01T11:00:00.000Z',
    updatedAt: '2026-04-01T11:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<VenueManagementPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VenueManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVenueListData = {
      data: {
        items: mockVenueItems,
        total: 2,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
      error: null,
    };
    mockCityListForFilter = {
      data: {
        items: mockCityItemsForFilter,
        total: 2,
        page: 1,
        pageSize: 100,
      },
      isLoading: false,
      error: null,
    };
    mockRemoveVenueState = {
      mutate: mockRemoveVenueMutate,
      isPending: false,
      variables: undefined,
    };
    mockSyncVenuesState = {
      mutate: mockSyncVenuesMutate,
      isPending: false,
    };
  });

  // =========================================================================
  // 基本渲染 — 球馆管理页面
  // =========================================================================

  // 来源: admin.md §8.3 — VenueManagementPage — 组件结构 — PageHeader
  it('should render page title "球馆管理"', () => {
    renderPage();

    expect(screen.getByText('球馆管理')).toBeInTheDocument();
  });

  // 来源: admin.md §8.3 — VenueManagementPage — 组件结构 — PageHeader — "同步球馆数据"按钮
  it('should render "同步球馆数据" button', () => {
    renderPage();

    expect(screen.getByText('同步球馆数据')).toBeInTheDocument();
  });

  // 来源: admin.md §8.3 — VenueManagementPage — 组件结构 — VenueTable — columns
  it('should render venue table with column headers', () => {
    renderPage();

    expect(screen.getByText(/球馆名称/)).toBeInTheDocument();
    expect(screen.getByText(/地址/)).toBeInTheDocument();
    expect(screen.getByText(/所属城市/)).toBeInTheDocument();
    expect(screen.getByText(/创建时间/)).toBeInTheDocument();
    expect(screen.getByText(/操作/)).toBeInTheDocument();
  });

  // 来源: admin.md §8.3 — VenueManagementPage — 组件结构 — VenueTable — 数据行
  it('should render venue data rows', () => {
    renderPage();

    expect(screen.getByText('朝阳体育中心羽毛球馆')).toBeInTheDocument();
    expect(screen.getByText('北京市朝阳区工体北路')).toBeInTheDocument();
    expect(screen.getByText('浦东源深体育中心')).toBeInTheDocument();
    expect(screen.getByText('上海市浦东新区张杨路')).toBeInTheDocument();
  });

  // 来源: admin.md §8.3 — VenueManagementPage — 组件结构 — VenueTable — 所属城市列
  it('should render city name in venue rows', () => {
    renderPage();

    expect(screen.getByText('北京')).toBeInTheDocument();
    expect(screen.getByText('上海')).toBeInTheDocument();
  });

  // 来源: admin.md §8.3 — VenueManagementPage — 组件结构 — VenueTable — 操作列 — 移除按钮
  it('should render "移除" button for each venue row', () => {
    renderPage();

    const removeButtons = screen.getAllByText('移除');
    expect(removeButtons).toHaveLength(2);
  });

  // =========================================================================
  // 筛选区域
  // =========================================================================

  // 来源: admin.md §8.3 — VenueManagementPage — 组件结构 — VenueFilterBar — CitySelect
  it('should render city filter dropdown', () => {
    renderPage();

    // 城市筛选下拉框应包含"全部城市"选项
    expect(screen.getByText(/全部城市/)).toBeInTheDocument();
  });

  // 来源: admin.md §8.3 — VenueManagementPage — 组件结构 — VenueFilterBar — KeywordSearch
  it('should render keyword search input', () => {
    renderPage();

    expect(screen.getByPlaceholderText(/搜索.*球馆|球馆.*名称/)).toBeInTheDocument();
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: admin.md §8.3 — 调用的后端接口 — GET /api/admin/venues — 页面加载
  it('should show loading state when venue list is loading', () => {
    mockVenueListData = {
      data: undefined,
      isLoading: true,
      error: null,
    };
    renderPage();

    // 加载中不应渲染球馆数据
    expect(screen.queryByText('朝阳体育中心羽毛球馆')).not.toBeInTheDocument();
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: admin.md §8.3 — 调用的后端接口 — GET /api/admin/venues — 错误处理 — 渲染 PageError
  it('should show error state when loading venues fails', () => {
    mockVenueListData = {
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    };
    renderPage();

    expect(screen.queryByText('朝阳体育中心羽毛球馆')).not.toBeInTheDocument();
    expect(screen.getByText(/加载失败|出错|错误/)).toBeInTheDocument();
  });

  // =========================================================================
  // 空状态
  // =========================================================================

  // 来源: admin.md §8.3 — 交互流程 — 页面加载 — 渲染表格
  it('should render empty table when there are no venues', () => {
    mockVenueListData = {
      data: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
      error: null,
    };
    renderPage();

    // 表头应仍然存在
    expect(screen.getByText(/球馆名称/)).toBeInTheDocument();
    // 但无数据行
    expect(screen.queryByText('朝阳体育中心羽毛球馆')).not.toBeInTheDocument();
  });

  // =========================================================================
  // 移除球馆交互
  // =========================================================================

  // 来源: admin.md §8.3 — 交互流程 — 移除球馆 — 2. 弹出确认弹窗
  it('should show confirm dialog when "移除" button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    const removeButtons = screen.getAllByText('移除');
    await user.click(removeButtons[0]);

    // Popconfirm 应显示确认文字
    expect(screen.getByText(/确定移除该球馆吗/)).toBeInTheDocument();
  });

  // 来源: admin.md §8.3 — 交互流程 — 移除球馆 — 3. 确认后调用 DELETE
  it('should call removeVenue when removal is confirmed', async () => {
    const user = userEvent.setup();
    renderPage();

    const removeButtons = screen.getAllByText('移除');
    await user.click(removeButtons[0]);

    // 在 Popconfirm 中点击"确定"
    const confirmButton = screen.getByText('确定');
    await user.click(confirmButton);

    expect(mockRemoveVenueMutate).toHaveBeenCalledWith('venue-uuid-1');
  });

  // 来源: admin.md §8.3 — 交互流程 — 移除球馆 — 4. 该行显示 loading 状态
  it('should show loading state on the venue row being removed', () => {
    mockRemoveVenueState = {
      mutate: mockRemoveVenueMutate,
      isPending: true,
      variables: 'venue-uuid-1',
    };
    renderPage();

    // 当正在移除 venue-uuid-1 时，第一行的移除按钮应该处于 loading/disabled
    const removeButtons = screen.getAllByText('移除');
    const firstRemoveButton = removeButtons[0].closest('button');
    expect(firstRemoveButton).toBeDisabled();
  });

  // =========================================================================
  // 同步球馆数据交互
  // =========================================================================

  // 来源: admin.md §8.3 — 交互流程 — 同步球馆数据 — 2. 弹出确认弹窗
  it('should show confirm dialog when "同步球馆数据" button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('同步球馆数据'));

    expect(screen.getByText(/确定同步所有城市的球馆数据吗/)).toBeInTheDocument();
  });

  // 来源: admin.md §8.3 — 交互流程 — 同步球馆数据 — 3. 确认后调用 POST /api/admin/venues/sync
  it('should call syncVenues when sync is confirmed', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('同步球馆数据'));

    // 在确认弹窗中点击"确定"
    const confirmButton = screen.getByText('确定');
    await user.click(confirmButton);

    expect(mockSyncVenuesMutate).toHaveBeenCalled();
  });

  // 来源: admin.md §8.3 — 交互流程 — 同步球馆数据 — 4. 同步按钮显示 loading 状态
  it('should show loading state on sync button when syncing is in progress', () => {
    mockSyncVenuesState = {
      mutate: mockSyncVenuesMutate,
      isPending: true,
    };
    renderPage();

    const syncButton = screen.getByText('同步球馆数据').closest('button');
    expect(syncButton).toBeDisabled();
  });

  // =========================================================================
  // 分页
  // =========================================================================

  // 来源: admin.md §8.3 — 组件结构 — Pagination — Ant Design 分页控件（内置于 Table）
  it('should render pagination when total exceeds pageSize', () => {
    mockVenueListData = {
      data: {
        items: mockVenueItems,
        total: 50,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
      error: null,
    };
    renderPage();

    // 应显示总数
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  // =========================================================================
  // 时间格式化
  // =========================================================================

  // 来源: admin.md §8.3 — VenueTable — columns — 创建时间（格式化为 YYYY-MM-DD HH:mm）
  it('should format createdAt as YYYY-MM-DD HH:mm', () => {
    renderPage();

    // 2026-04-01T10:00:00.000Z should be formatted
    expect(screen.getAllByText(/2026-04-01/).length).toBeGreaterThanOrEqual(1);
  });
});
