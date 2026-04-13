/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: web-app/coaching — CoachApplicationPage 页面渲染 + API 层
 * 覆盖页面: CoachApplicationPage (/coach-apply)
 *
 * 来源文档:
 *   - docs/module-design/coach-verification.md §4 — POST /api/coach-applications
 *   - docs/module-design/coach-verification.md §4 — GET /api/coach-applications/me
 *   - docs/module-design/coach-verification.md 附录 C.1 — 教练申请页
 *
 * Mock 策略:
 *   - Mock hooks（useCoachApplication, useSubmitApplication）的返回值
 *   - Mock useCurrentUser
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

// Mock useCurrentUser
let mockCurrentUserData: {
  data: { id: string; phone: string; nickname: string; avatarUrl: string | null; bio: string | null; isCoach: boolean; createdAt: string } | undefined;
  isLoading: boolean;
  error: unknown;
} = {
  data: {
    id: 'current-user-id',
    phone: '13800001234',
    nickname: '测试用户',
    avatarUrl: null,
    bio: null,
    isCoach: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  isLoading: false,
  error: null,
};

vi.mock('@web/shared/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUserData,
}));

// Mock useCoachApplication hook
let mockApplicationData: {
  data: {
    id: string;
    userId: string;
    certificateUrls: string[];
    description: string | null;
    status: 'pending' | 'approved' | 'rejected';
    rejectReason: string | null;
    createdAt: string;
    updatedAt: string;
  } | null | undefined;
  isLoading: boolean;
  error: unknown;
};

const mockSubmitMutate = vi.fn();
let mockSubmitState = {
  mutate: mockSubmitMutate,
  isPending: false,
};

vi.mock('@web/features/coaching/hooks/useCoachApplication', () => ({
  useCoachApplication: () => mockApplicationData,
  useSubmitApplication: () => mockSubmitState,
}));

// Mock api-client (for uploadCertificate inside the page)
vi.mock('@web/shared/utils/api-client', () => ({
  resolveUrl: (path: string) => `http://localhost${path}`,
  getAuthHeaders: () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
  }),
  handleResponse: async (response: Response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || 'Error');
    return body.data;
  },
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { CoachApplicationPage } from '@web/features/coaching/pages/CoachApplicationPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPendingApplication = {
  id: 'app-uuid-1',
  userId: 'current-user-id',
  certificateUrls: [
    'https://example.com/cert1.jpg',
    'https://example.com/cert2.png',
  ],
  description: '国家二级运动员',
  status: 'pending' as const,
  rejectReason: null,
  createdAt: '2026-04-13T10:00:00.000Z',
  updatedAt: '2026-04-13T10:00:00.000Z',
};

const mockRejectedApplication = {
  id: 'app-uuid-2',
  userId: 'current-user-id',
  certificateUrls: [
    'https://example.com/cert1.jpg',
  ],
  description: '教练经验5年',
  status: 'rejected' as const,
  rejectReason: '上传的证书图片模糊，无法辨认姓名和证书类型',
  createdAt: '2026-04-12T10:00:00.000Z',
  updatedAt: '2026-04-12T14:00:00.000Z',
};

const mockApprovedApplication = {
  id: 'app-uuid-3',
  userId: 'current-user-id',
  certificateUrls: [
    'https://example.com/cert1.jpg',
  ],
  description: '国家一级运动员',
  status: 'approved' as const,
  rejectReason: null,
  createdAt: '2026-04-10T10:00:00.000Z',
  updatedAt: '2026-04-11T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<CoachApplicationPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CoachApplicationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserData = {
      data: {
        id: 'current-user-id',
        phone: '13800001234',
        nickname: '测试用户',
        avatarUrl: null,
        bio: null,
        isCoach: false,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      isLoading: false,
      error: null,
    };
    mockApplicationData = {
      data: null,
      isLoading: false,
      error: null,
    };
    mockSubmitState = {
      mutate: mockSubmitMutate,
      isPending: false,
    };
  });

  // =========================================================================
  // Loading state
  // =========================================================================

  it('should show loading state when application data is loading', () => {
    mockApplicationData = {
      data: undefined,
      isLoading: true,
      error: null,
    };
    renderPage();

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  // =========================================================================
  // Error state
  // =========================================================================

  it('should show error state when loading fails', () => {
    mockApplicationData = {
      data: undefined,
      isLoading: false,
      error: new Error('Failed'),
    };
    renderPage();

    expect(screen.getByText(/加载失败/)).toBeInTheDocument();
  });

  // =========================================================================
  // No application — show submission form
  // =========================================================================

  // 来源: coach-verification.md 附录 C.1 — 未申请：展示上传表单
  it('should show submission form when no application exists', () => {
    renderPage();

    expect(screen.getByText('申请成为教练')).toBeInTheDocument();
    expect(screen.getByText('上传证书/奖状')).toBeInTheDocument();
    expect(screen.getByText('补充说明')).toBeInTheDocument();
    expect(screen.getByText('提交申请')).toBeInTheDocument();
  });

  // 来源: coach-verification.md §4 — certificateUrls 至少 1 个
  it('should show upload hint text with format and size limits', () => {
    renderPage();

    expect(screen.getByText(/至少 1 张.*最多 5 张/)).toBeInTheDocument();
    expect(screen.getByText(/JPG\/PNG/)).toBeInTheDocument();
  });

  // 来源: coach-verification.md §4 — description 选填，最多 200 字符
  it('should show description textarea with character counter', () => {
    renderPage();

    expect(screen.getByPlaceholderText(/简要描述.*选填.*200/)).toBeInTheDocument();
    expect(screen.getByText('0/200')).toBeInTheDocument();
  });

  it('should have add certificate button', () => {
    renderPage();

    expect(screen.getByLabelText('添加证书')).toBeInTheDocument();
  });

  // 来源: coach-verification.md §4 — certificateUrls 不为空时才能提交
  it('should disable submit button when no certificates uploaded', () => {
    renderPage();

    const submitBtn = screen.getByText('提交申请');
    expect(submitBtn).toBeDisabled();
  });

  // =========================================================================
  // Pending state
  // =========================================================================

  // 来源: coach-verification.md 附录 C.1 — 审核中：展示"审核中"提示，不可重复提交
  it('should show pending status when application is pending', () => {
    mockApplicationData = {
      data: mockPendingApplication,
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText('审核中')).toBeInTheDocument();
    expect(screen.getByText(/教练资质正在审核中/)).toBeInTheDocument();
    expect(screen.getByText(/1-3 个工作日/)).toBeInTheDocument();
  });

  it('should show submitted certificates in pending state', () => {
    mockApplicationData = {
      data: mockPendingApplication,
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText('提交的证书')).toBeInTheDocument();
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
  });

  it('should show description in pending state', () => {
    mockApplicationData = {
      data: mockPendingApplication,
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText('国家二级运动员')).toBeInTheDocument();
  });

  it('should show submission time in pending state', () => {
    mockApplicationData = {
      data: mockPendingApplication,
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText(/提交时间.*2026-04-13/)).toBeInTheDocument();
  });

  // 来源: coach-verification.md 附录 C.1 — 审核中不可重复提交
  it('should not show submit button in pending state', () => {
    mockApplicationData = {
      data: mockPendingApplication,
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.queryByText('提交申请')).not.toBeInTheDocument();
  });

  // =========================================================================
  // Rejected state
  // =========================================================================

  // 来源: coach-verification.md 附录 C.1 — 已拒绝：展示拒绝原因，允许重新提交
  it('should show rejection reason when application is rejected', () => {
    mockApplicationData = {
      data: mockRejectedApplication,
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText('拒绝原因')).toBeInTheDocument();
    expect(
      screen.getByText('上传的证书图片模糊，无法辨认姓名和证书类型'),
    ).toBeInTheDocument();
  });

  it('should show resubmit form when application is rejected', () => {
    mockApplicationData = {
      data: mockRejectedApplication,
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText('申请成为教练')).toBeInTheDocument();
    expect(screen.getByText('上传证书/奖状')).toBeInTheDocument();
    expect(screen.getByText('重新提交申请')).toBeInTheDocument();
  });

  // =========================================================================
  // Approved state
  // =========================================================================

  // 来源: coach-verification.md 附录 C.1 — 已通过：展示"已通过"状态
  it('should show approved status when application is approved and user is coach', () => {
    mockCurrentUserData = {
      data: {
        id: 'current-user-id',
        phone: '13800001234',
        nickname: '测试用户',
        avatarUrl: null,
        bio: null,
        isCoach: true,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      isLoading: false,
      error: null,
    };
    mockApplicationData = {
      data: mockApprovedApplication,
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText('已通过')).toBeInTheDocument();
    expect(screen.getByText(/教练资质审核已通过/)).toBeInTheDocument();
    expect(screen.getByText('管理教练资料')).toBeInTheDocument();
  });

  it('should navigate to coach profile edit when clicking manage button in approved state', async () => {
    const user = userEvent.setup();
    mockCurrentUserData = {
      data: {
        id: 'current-user-id',
        phone: '13800001234',
        nickname: '测试用户',
        avatarUrl: null,
        bio: null,
        isCoach: true,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      isLoading: false,
      error: null,
    };
    mockApplicationData = {
      data: mockApprovedApplication,
      isLoading: false,
      error: null,
    };
    renderPage();

    await user.click(screen.getByText('管理教练资料'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/coach-edit');
  });

  // =========================================================================
  // Description input
  // =========================================================================

  it('should update character count when typing description', async () => {
    const user = userEvent.setup();
    renderPage();

    const textarea = screen.getByPlaceholderText(/简要描述.*选填.*200/);
    await user.type(textarea, '测试说明');

    expect(screen.getByText('4/200')).toBeInTheDocument();
  });

  // =========================================================================
  // Submit pending state
  // =========================================================================

  it('should show loading text on submit button when mutation is pending', () => {
    mockSubmitState = {
      mutate: mockSubmitMutate,
      isPending: true,
    };
    renderPage();

    expect(screen.getByText('提交中...')).toBeInTheDocument();
  });

  // =========================================================================
  // Back navigation
  // =========================================================================

  it('should have a back button that navigates back', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText('返回'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});

// ---------------------------------------------------------------------------
// API layer tests
// ---------------------------------------------------------------------------

describe('coach-application-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('submitCoachApplication should POST to /api/coach-applications', async () => {
    const mockResponse = {
      data: {
        id: 'app-uuid-1',
        userId: 'user-uuid-1',
        certificateUrls: ['https://example.com/cert.jpg'],
        description: '国家二级运动员',
        status: 'pending',
        createdAt: '2026-04-13T10:00:00.000Z',
        updatedAt: '2026-04-13T10:00:00.000Z',
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    // Import the API function directly
    const { submitCoachApplication } = await import(
      '@web/features/coaching/api/coach-application-api'
    );

    const result = await submitCoachApplication({
      certificateUrls: ['https://example.com/cert.jpg'],
      description: '国家二级运动员',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost/api/coach-applications',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          certificateUrls: ['https://example.com/cert.jpg'],
          description: '国家二级运动员',
        }),
      }),
    );

    expect(result).toEqual(mockResponse.data);
  });

  it('getMyApplicationStatus should GET /api/coach-applications/me', async () => {
    const mockResponse = {
      data: {
        id: 'app-uuid-1',
        status: 'pending',
        certificateUrls: ['https://example.com/cert.jpg'],
        description: '国家二级运动员',
        rejectReason: null,
        createdAt: '2026-04-13T10:00:00.000Z',
        updatedAt: '2026-04-13T10:00:00.000Z',
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const { getMyApplicationStatus } = await import(
      '@web/features/coaching/api/coach-application-api'
    );

    const result = await getMyApplicationStatus();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost/api/coach-applications/me',
      expect.objectContaining({
        method: 'GET',
      }),
    );

    expect(result).toEqual(mockResponse.data);
  });

  it('getMyApplicationStatus should return null when no application', async () => {
    const mockResponse = { data: null };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const { getMyApplicationStatus } = await import(
      '@web/features/coaching/api/coach-application-api'
    );

    const result = await getMyApplicationStatus();
    expect(result).toBeNull();
  });

  it('submitCoachApplication should throw on error response', async () => {
    const mockErrorResponse = {
      error: {
        code: 'COACHING_APPLICATION_PENDING',
        message: '已有审核中的申请',
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve(mockErrorResponse),
    } as Response);

    const { submitCoachApplication } = await import(
      '@web/features/coaching/api/coach-application-api'
    );

    await expect(
      submitCoachApplication({
        certificateUrls: ['https://example.com/cert.jpg'],
      }),
    ).rejects.toThrow();
  });
});
