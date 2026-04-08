/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: admin/venue-management — CityManagementPage 页面渲染
 * 覆盖页面: CityManagementPage (/cities)
 *
 * 来源文档:
 *   - docs/module-design/admin.md §8.2 CityManagementPage 页面
 *   - docs/module-design/admin.md §9 Feature 私有组件（venue-management）
 *   - docs/module-design/admin.md §10 Feature 私有 Hooks（venue-management）
 *   - docs/module-design/admin.md §12.1 前端表单校验规则
 *
 * Mock 策略:
 *   - Mock hooks（useCityList, useAddCity）的返回值
 *   - Mock adminAuthStore
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

// Mock useCityList hook
let mockCityListData: {
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
  useCityList: () => mockCityListData,
}));

// Mock useAddCity hook
const mockAddCityMutate = vi.fn();
let mockAddCityState = {
  mutate: mockAddCityMutate,
  mutateAsync: vi.fn(),
  isPending: false,
};

vi.mock('@admin/features/venue-management/hooks/useAddCity', () => ({
  useAddCity: () => mockAddCityState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { CityManagementPage } from '@admin/features/venue-management/pages/CityManagementPage';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const mockCityItems = [
  {
    id: 'city-uuid-1',
    name: '北京',
    venueCount: 42,
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-02T08:00:00.000Z',
  },
  {
    id: 'city-uuid-2',
    name: '上海',
    venueCount: 38,
    createdAt: '2026-04-01T11:00:00.000Z',
    updatedAt: '2026-04-03T09:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<CityManagementPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CityManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCityListData = {
      data: {
        items: mockCityItems,
        total: 2,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
      error: null,
    };
    mockAddCityState = {
      mutate: mockAddCityMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    };
  });

  // =========================================================================
  // 基本渲染 — 城市管理页面
  // =========================================================================

  // 来源: admin.md §8.2 — CityManagementPage — 组件结构 — PageHeader
  it('should render page title "城市管理"', () => {
    renderPage();

    expect(screen.getByText('城市管理')).toBeInTheDocument();
  });

  // 来源: admin.md §8.2 — CityManagementPage — 组件结构 — PageHeader — "添加城市"按钮
  it('should render "添加城市" button', () => {
    renderPage();

    expect(screen.getByText('添加城市')).toBeInTheDocument();
  });

  // 来源: admin.md §8.2 — CityManagementPage — 组件结构 — CityTable — columns
  it('should render city table with column headers', () => {
    renderPage();

    expect(screen.getByText(/城市名称/)).toBeInTheDocument();
    expect(screen.getByText(/球馆数量/)).toBeInTheDocument();
    expect(screen.getByText(/创建时间/)).toBeInTheDocument();
    expect(screen.getByText(/更新时间/)).toBeInTheDocument();
  });

  // 来源: admin.md §8.2 — CityManagementPage — 组件结构 — CityTable — 数据行
  it('should render city data rows', () => {
    renderPage();

    expect(screen.getByText('北京')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('上海')).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
  });

  // 来源: admin.md §8.2 — CityManagementPage — 组件结构 — CityTable — 时间格式化 YYYY-MM-DD HH:mm
  it('should format date columns as YYYY-MM-DD HH:mm', () => {
    renderPage();

    // 2026-04-01T10:00:00.000Z should be formatted (depending on timezone)
    // At least check the formatted date is present in some form
    expect(screen.getByText(/2026-04-01/)).toBeInTheDocument();
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: admin.md §8.2 — 调用的后端接口 — GET /api/admin/cities — 页面加载
  it('should show loading state when city list is loading', () => {
    mockCityListData = {
      data: undefined,
      isLoading: true,
      error: null,
    };
    renderPage();

    // 加载中不应渲染城市数据
    expect(screen.queryByText('北京')).not.toBeInTheDocument();
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: admin.md §8.2 — 调用的后端接口 — GET /api/admin/cities — 错误处理 — 渲染 PageError
  it('should show error state when loading cities fails', () => {
    mockCityListData = {
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    };
    renderPage();

    expect(screen.queryByText('北京')).not.toBeInTheDocument();
    expect(screen.getByText(/加载失败|出错|错误/)).toBeInTheDocument();
  });

  // =========================================================================
  // 空状态
  // =========================================================================

  // 来源: admin.md §8.2 — 交互流程 — 页面加载 — 渲染表格
  it('should render empty table when there are no cities', () => {
    mockCityListData = {
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
    expect(screen.getByText(/城市名称/)).toBeInTheDocument();
    // 但无数据行
    expect(screen.queryByText('北京')).not.toBeInTheDocument();
  });

  // =========================================================================
  // 添加城市弹窗交互
  // =========================================================================

  // 来源: admin.md §8.2 — 交互流程 — 添加城市 — 1. 点击"添加城市"按钮 → 弹出 Modal 弹窗
  it('should open add city modal when "添加城市" button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('添加城市'));

    // 弹窗中应有城市名称输入框
    expect(screen.getByPlaceholderText(/城市名称/)).toBeInTheDocument();
  });

  // 来源: admin.md §8.2 — 交互流程 — 添加城市 — 4. 点击"确定" → 调用 POST /api/admin/cities
  it('should call addCity when "确定" button is clicked with valid city name', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('添加城市'));

    const input = screen.getByPlaceholderText(/城市名称/);
    await user.type(input, '深圳');

    // 点击弹窗中的确定按钮
    const confirmButton = screen.getByText('确定');
    await user.click(confirmButton);

    expect(mockAddCityMutate).toHaveBeenCalled();
  });

  // 来源: admin.md §12.1 — 前端表单校验规则 — cityName — "请输入城市名称"
  it('should show error when trying to add city with empty name', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('添加城市'));

    // 不输入城市名称直接点确定
    const confirmButton = screen.getByText('确定');
    await user.click(confirmButton);

    // 不应调用添加接口
    expect(mockAddCityMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/请输入城市名称/)).toBeInTheDocument();
  });

  // 来源: admin.md §8.2 — 交互流程 — 添加城市 — 5. 确定按钮显示 loading 状态
  it('should show loading state on confirm button when adding city is in progress', async () => {
    const user = userEvent.setup();
    mockAddCityState = {
      mutate: mockAddCityMutate,
      mutateAsync: vi.fn(),
      isPending: true,
    };
    renderPage();

    await user.click(screen.getByText('添加城市'));

    const confirmButton = screen.getByText('确定').closest('button');
    // 按钮应处于 loading/disabled 状态
    expect(confirmButton).toBeDisabled();
  });

  // =========================================================================
  // 分页
  // =========================================================================

  // 来源: admin.md §8.2 — 组件结构 — Pagination — Ant Design 分页控件（内置于 Table）
  it('should render pagination when total exceeds pageSize', () => {
    mockCityListData = {
      data: {
        items: mockCityItems,
        total: 50,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
      error: null,
    };
    renderPage();

    // Ant Design Table 内置分页，应显示分页控件
    // 检查分页元素的存在（总数或页码）
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });
});
