/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: admin/coach-review — CoachReviewListPage + CoachReviewDetailPage 页面渲染 + API 层
 * 覆盖页面: CoachReviewListPage (/coach-review), CoachReviewDetailPage (/coach-review/:id)
 *
 * 来源文档:
 *   - docs/module-design/coach-verification.md §4 — GET /api/admin/coach-applications
 *   - docs/module-design/coach-verification.md §4 — GET /api/admin/coach-applications/:id
 *   - docs/module-design/coach-verification.md §4 — POST /api/admin/coach-applications/:id/review
 *   - docs/module-design/coach-verification.md 附录 C.2 — 教练审核
 *
 * Mock 策略:
 *   - Mock hooks（useApplicationList, useApplicationDetail, useReviewApplication）的返回值
 *   - Mock adminAuthStore
 *   - Mock react-router-dom 导航 / useParams
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
let mockParams: Record<string, string> = {};
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

// Mock useApplicationList hook
let mockApplicationListData: {
  data:
    | {
        items: Array<{
          id: string;
          userId: string;
          nickname: string;
          avatarUrl: string | null;
          certificateUrls: string[];
          description: string | null;
          status: string;
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

vi.mock('@admin/features/coach-review/hooks/useApplicationList', () => ({
  useApplicationList: () => mockApplicationListData,
}));

// Mock useApplicationDetail hook
let mockApplicationDetailData: {
  data:
    | {
        id: string;
        userId: string;
        nickname: string;
        avatarUrl: string | null;
        phone: string;
        certificateUrls: string[];
        description: string | null;
        status: string;
        rejectReason: string | null;
        reviewedBy: string | null;
        reviewedAt: string | null;
        createdAt: string;
        updatedAt: string;
      }
    | undefined;
  isLoading: boolean;
  error: unknown;
} = {
  data: undefined,
  isLoading: false,
  error: null,
};

vi.mock('@admin/features/coach-review/hooks/useApplicationDetail', () => ({
  useApplicationDetail: () => mockApplicationDetailData,
}));

// Mock useReviewApplication hook
const mockReviewMutate = vi.fn();
let mockReviewState = {
  mutate: mockReviewMutate,
  isPending: false,
};

vi.mock('@admin/features/coach-review/hooks/useReviewApplication', () => ({
  useReviewApplication: () => mockReviewState,
}));

// ---------------------------------------------------------------------------
// Import components under test (after mocks)
// ---------------------------------------------------------------------------

import { CoachReviewListPage } from '@admin/features/coach-review/pages/CoachReviewListPage';
import { CoachReviewDetailPage } from '@admin/features/coach-review/pages/CoachReviewDetailPage';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const mockApplicationItems = [
  {
    id: 'app-uuid-1',
    userId: 'user-uuid-1',
    nickname: '张文舞',
    avatarUrl: 'https://example.com/avatar1.jpg',
    certificateUrls: ['https://example.com/cert1.jpg', 'https://example.com/cert2.png'],
    description: '国家一级运动员',
    status: 'pending',
    createdAt: '2026-04-13T10:00:00.000Z',
    updatedAt: '2026-04-13T10:00:00.000Z',
  },
  {
    id: 'app-uuid-2',
    userId: 'user-uuid-2',
    nickname: '李佑赫',
    avatarUrl: null,
    certificateUrls: ['https://example.com/cert3.jpg'],
    description: null,
    status: 'pending',
    createdAt: '2026-04-12T10:00:00.000Z',
    updatedAt: '2026-04-12T10:00:00.000Z',
  },
];

const mockDetailPending = {
  id: 'app-uuid-1',
  userId: 'user-uuid-1',
  nickname: '张文舞',
  avatarUrl: 'https://example.com/avatar1.jpg',
  phone: '138****1234',
  certificateUrls: ['https://example.com/cert1.jpg', 'https://example.com/cert2.png'],
  description: '国家一级运动员，2018年市级羽毛球单打冠军',
  status: 'pending',
  rejectReason: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: '2026-04-13T10:00:00.000Z',
  updatedAt: '2026-04-13T10:00:00.000Z',
};

const mockDetailRejected = {
  ...mockDetailPending,
  id: 'app-uuid-3',
  status: 'rejected',
  rejectReason: '证书图片不清晰',
  reviewedBy: 'admin-uuid',
  reviewedAt: '2026-04-14T10:00:00.000Z',
  updatedAt: '2026-04-14T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderListPage() {
  return render(<CoachReviewListPage />);
}

function renderDetailPage() {
  return render(<CoachReviewDetailPage />);
}

// ---------------------------------------------------------------------------
// Tests: CoachReviewListPage
// ---------------------------------------------------------------------------

describe('CoachReviewListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApplicationListData = {
      data: {
        items: mockApplicationItems,
        total: 2,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
      error: null,
    };
  });

  // =========================================================================
  // Basic rendering
  // =========================================================================

  // 来源: coach-verification.md 附录 C.2 — CoachReviewListPage
  it('should render page title "教练审核"', () => {
    renderListPage();

    expect(screen.getByText('教练审核')).toBeInTheDocument();
  });

  // 来源: coach-verification.md 附录 C.2 — 待审核/已通过/已拒绝筛选
  it('should render status filter tabs', () => {
    renderListPage();

    // Use getAllByText for "待审核" because it appears in both the tab label
    // and the status Tag column of table rows (both pending items).
    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getAllByText('待审核').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('已通过')).toBeInTheDocument();
    expect(screen.getByText('已拒绝')).toBeInTheDocument();
  });

  // 来源: coach-verification.md §4 — GET /api/admin/coach-applications
  it('should render table with application data', () => {
    renderListPage();

    expect(screen.getByText('张文舞')).toBeInTheDocument();
    expect(screen.getByText('李佑赫')).toBeInTheDocument();
  });

  it('should render table column headers', () => {
    renderListPage();

    expect(screen.getByText('申请人')).toBeInTheDocument();
    expect(screen.getByText('证书数量')).toBeInTheDocument();
    expect(screen.getByText('状态')).toBeInTheDocument();
    expect(screen.getByText('提交时间')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
  });

  it('should show certificate count for each application', () => {
    renderListPage();

    expect(screen.getByText('2 张')).toBeInTheDocument();
    expect(screen.getByText('1 张')).toBeInTheDocument();
  });

  it('should show status tags', () => {
    renderListPage();

    const pendingTags = screen.getAllByText('待审核');
    // At least 2: one in tab and two in table rows (the tab is also showing "待审核")
    expect(pendingTags.length).toBeGreaterThanOrEqual(2);
  });

  it('should render "查看详情" links', () => {
    renderListPage();

    const links = screen.getAllByText('查看详情');
    expect(links).toHaveLength(2);
  });

  // =========================================================================
  // Loading state
  // =========================================================================

  it('should show loading state when list is loading', () => {
    mockApplicationListData = {
      data: undefined,
      isLoading: true,
      error: null,
    };
    renderListPage();

    expect(screen.queryByText('张文舞')).not.toBeInTheDocument();
  });

  // =========================================================================
  // Error state
  // =========================================================================

  it('should show error state when loading fails', () => {
    mockApplicationListData = {
      data: undefined,
      isLoading: false,
      error: new Error('Failed'),
    };
    renderListPage();

    expect(screen.getByText(/加载失败/)).toBeInTheDocument();
  });

  // =========================================================================
  // Empty state
  // =========================================================================

  it('should render empty table when there are no applications', () => {
    mockApplicationListData = {
      data: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
      error: null,
    };
    renderListPage();

    expect(screen.getByText('申请人')).toBeInTheDocument();
    expect(screen.queryByText('张文舞')).not.toBeInTheDocument();
  });

  // =========================================================================
  // Navigation
  // =========================================================================

  it('should navigate to detail page when clicking "查看详情"', async () => {
    const user = userEvent.setup();
    renderListPage();

    const links = screen.getAllByText('查看详情');
    await user.click(links[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/coach-review/app-uuid-1');
  });

  // =========================================================================
  // Pagination
  // =========================================================================

  it('should render pagination when total exceeds pageSize', () => {
    mockApplicationListData = {
      data: {
        items: mockApplicationItems,
        total: 50,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
      error: null,
    };
    renderListPage();

    expect(screen.getByText(/50/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: CoachReviewDetailPage
// ---------------------------------------------------------------------------

describe('CoachReviewDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { id: 'app-uuid-1' };
    mockApplicationDetailData = {
      data: mockDetailPending,
      isLoading: false,
      error: null,
    };
    mockReviewState = {
      mutate: mockReviewMutate,
      isPending: false,
    };
  });

  // =========================================================================
  // Basic rendering
  // =========================================================================

  // 来源: coach-verification.md 附录 C.2 — CoachReviewDetailPage
  it('should render page title "审核详情"', () => {
    renderDetailPage();

    expect(screen.getByText('审核详情')).toBeInTheDocument();
  });

  it('should render applicant nickname', () => {
    renderDetailPage();

    expect(screen.getByText('张文舞')).toBeInTheDocument();
  });

  // 来源: coach-verification.md §4 — 手机号脱敏展示
  it('should render masked phone number', () => {
    renderDetailPage();

    expect(screen.getByText(/138\*\*\*\*1234/)).toBeInTheDocument();
  });

  it('should render description', () => {
    renderDetailPage();

    expect(screen.getByText(/国家一级运动员/)).toBeInTheDocument();
  });

  // 来源: coach-verification.md §4 — GET /api/admin/coach-applications/:id — certificateUrls
  it('should render certificate images', () => {
    renderDetailPage();

    expect(screen.getByText(/上传的证书.*2张/)).toBeInTheDocument();
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it('should render status tag', () => {
    renderDetailPage();

    expect(screen.getByText('待审核')).toBeInTheDocument();
  });

  // =========================================================================
  // Action buttons (pending state)
  // =========================================================================

  // 来源: coach-verification.md §4 — POST /api/admin/coach-applications/:id/review
  it('should render approve and reject buttons for pending application', () => {
    renderDetailPage();

    expect(screen.getByText('通过')).toBeInTheDocument();
    expect(screen.getByText('拒绝')).toBeInTheDocument();
  });

  it('should call approve mutation when clicking "通过"', async () => {
    const user = userEvent.setup();
    renderDetailPage();

    await user.click(screen.getByText('通过'));

    expect(mockReviewMutate).toHaveBeenCalledWith(
      { id: 'app-uuid-1', input: { status: 'approved' } },
      expect.any(Object),
    );
  });

  // 来源: coach-verification.md §4 — 拒绝时必填原因
  it('should show reject modal when clicking "拒绝"', async () => {
    const user = userEvent.setup();
    renderDetailPage();

    await user.click(screen.getByText('拒绝'));

    expect(screen.getByText('拒绝申请')).toBeInTheDocument();
    expect(screen.getByText(/拒绝原因.*至少 5 个字符/)).toBeInTheDocument();
  });

  // =========================================================================
  // Rejected detail
  // =========================================================================

  it('should show reject reason for rejected application', () => {
    mockApplicationDetailData = {
      data: mockDetailRejected,
      isLoading: false,
      error: null,
    };
    renderDetailPage();

    expect(screen.getByText('拒绝原因')).toBeInTheDocument();
    expect(screen.getByText('证书图片不清晰')).toBeInTheDocument();
  });

  it('should not show action buttons for non-pending application', () => {
    mockApplicationDetailData = {
      data: mockDetailRejected,
      isLoading: false,
      error: null,
    };
    renderDetailPage();

    expect(screen.queryByRole('button', { name: '通过' })).not.toBeInTheDocument();
  });

  // =========================================================================
  // Loading state
  // =========================================================================

  it('should show loading state', () => {
    mockApplicationDetailData = {
      data: undefined,
      isLoading: true,
      error: null,
    };
    renderDetailPage();

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  // =========================================================================
  // Error state
  // =========================================================================

  it('should show error state', () => {
    mockApplicationDetailData = {
      data: undefined,
      isLoading: false,
      error: new Error('Failed'),
    };
    renderDetailPage();

    expect(screen.getByText(/加载失败/)).toBeInTheDocument();
  });

  // =========================================================================
  // Back navigation
  // =========================================================================

  it('should have a back button that navigates to list', async () => {
    const user = userEvent.setup();
    renderDetailPage();

    await user.click(screen.getByText('返回列表'));

    expect(mockNavigate).toHaveBeenCalledWith('/coach-review');
  });
});

// ---------------------------------------------------------------------------
// API layer tests
// ---------------------------------------------------------------------------

describe('coach-review-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('getApplicationList should GET /api/admin/coach-applications with params', async () => {
    const mockResponse = {
      data: {
        items: mockApplicationItems,
        total: 2,
        page: 1,
        pageSize: 20,
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const { getApplicationList } = await import(
      '@admin/features/coach-review/api/coach-review-api'
    );

    const result = await getApplicationList({ status: 'pending', page: 1, pageSize: 20 });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/coach-applications'),
      expect.objectContaining({
        method: 'GET',
      }),
    );

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=pending');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('pageSize=20');

    expect(result).toEqual(mockResponse.data);
  });

  it('getApplicationDetail should GET /api/admin/coach-applications/:id', async () => {
    const mockResponse = { data: mockDetailPending };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const { getApplicationDetail } = await import(
      '@admin/features/coach-review/api/coach-review-api'
    );

    const result = await getApplicationDetail('app-uuid-1');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/coach-applications/app-uuid-1'),
      expect.objectContaining({
        method: 'GET',
      }),
    );

    expect(result).toEqual(mockDetailPending);
  });

  it('reviewApplication should POST /api/admin/coach-applications/:id/review', async () => {
    const mockResponse = {
      data: {
        id: 'app-uuid-1',
        userId: 'user-uuid-1',
        certificateUrls: ['https://example.com/cert.jpg'],
        description: '国家一级运动员',
        status: 'approved',
        rejectReason: null,
        reviewedBy: 'admin-uuid',
        reviewedAt: '2026-04-14T10:00:00.000Z',
        createdAt: '2026-04-13T10:00:00.000Z',
        updatedAt: '2026-04-14T10:00:00.000Z',
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const { reviewApplication } = await import(
      '@admin/features/coach-review/api/coach-review-api'
    );

    const result = await reviewApplication('app-uuid-1', { status: 'approved' });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/coach-applications/app-uuid-1/review'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ status: 'approved' }),
      }),
    );

    expect(result).toEqual(mockResponse.data);
  });

  it('reviewApplication should include rejectReason when rejecting', async () => {
    const mockResponse = {
      data: {
        id: 'app-uuid-1',
        userId: 'user-uuid-1',
        certificateUrls: ['https://example.com/cert.jpg'],
        description: '国家一级运动员',
        status: 'rejected',
        rejectReason: '证书图片不清晰',
        reviewedBy: 'admin-uuid',
        reviewedAt: '2026-04-14T10:00:00.000Z',
        createdAt: '2026-04-13T10:00:00.000Z',
        updatedAt: '2026-04-14T10:00:00.000Z',
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const { reviewApplication } = await import(
      '@admin/features/coach-review/api/coach-review-api'
    );

    await reviewApplication('app-uuid-1', {
      status: 'rejected',
      rejectReason: '证书图片不清晰',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/coach-applications/app-uuid-1/review'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          status: 'rejected',
          rejectReason: '证书图片不清晰',
        }),
      }),
    );
  });
});
