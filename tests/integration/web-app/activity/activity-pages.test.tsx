/**
 * L1 集成测试: web-app/activity — 全部页面端内数据流
 *
 * 验证: 页面操作 → hook 调用 → API 请求 → 状态更新 → 页面响应
 * Mock 策略: 仅 MSW mock 网络层，不 mock hooks
 *
 * 与契约测试的区别:
 *   - 契约测试: mock hooks，验证页面渲染和交互
 *   - L1 集成测试: 不 mock hooks，验证完整数据流
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// ---------------------------------------------------------------------------
// MSW Server Setup
// ---------------------------------------------------------------------------

const server = setupServer();
const mockLocalStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    configurable: true,
  });
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Mock navigate
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'activity-uuid-1' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// ---------------------------------------------------------------------------
// Mock auth store with real state management
// ---------------------------------------------------------------------------

vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-jwt-token',
      userId: 'current-user-id',
      isLoggedIn: true,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

// Mock geolocation store for ActivityListPage
vi.mock('@web/stores/geolocation-store', () => {
  const state = {
    latitude: null as number | null,
    longitude: null as number | null,
    permission: 'prompt' as 'granted' | 'denied' | 'prompt',
    loading: false,
    setLocation: (_lat: number, _lon: number) => {},
    setPermission: (_p: 'granted' | 'denied' | 'prompt') => {},
    setLoading: (_l: boolean) => {},
  };
  return {
    useGeolocationStore: vi.fn((selector?: (s: unknown) => unknown) => {
      if (typeof selector === 'function') {
        return selector(state);
      }
      return state;
    }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockVenue = {
  id: 'venue-uuid-1',
  name: '朝阳体育中心羽毛球馆',
  address: '北京市朝阳区...',
  latitude: 39.9215,
  longitude: 116.4435,
};

const mockActivityListItem = {
  id: 'activity-uuid-1',
  creatorId: 'creator-user-id',
  venue: mockVenue,
  title: '周末约球',
  startTime: '2026-04-05T14:00:00.000Z',
  endTime: '2026-04-05T16:00:00.000Z',
  maxParticipants: 8,
  currentParticipants: 3,
  status: 'open',
  createdAt: '2026-04-02T10:00:00.000Z',
};

const mockActivityDetail = {
  id: 'activity-uuid-1',
  creatorId: 'creator-user-id',
  creator: {
    id: 'creator-user-id',
    nickname: '活动发起人',
    avatarUrl: null,
  },
  venue: mockVenue,
  title: '周末约球',
  startTime: '2026-04-05T14:00:00.000Z',
  endTime: '2026-04-05T16:00:00.000Z',
  maxParticipants: 8,
  currentParticipants: 2,
  status: 'open',
  participants: [
    {
      userId: 'creator-user-id',
      nickname: '活动发起人',
      avatarUrl: null,
      joinedAt: '2026-04-02T10:00:00.000Z',
    },
    {
      userId: 'current-user-id',
      nickname: '当前用户',
      avatarUrl: null,
      joinedAt: '2026-04-02T11:00:00.000Z',
    },
  ],
  createdAt: '2026-04-02T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Import components (after mocks)
// ---------------------------------------------------------------------------

import { ActivityListPage } from '@web/features/activity/pages/ActivityListPage';
import { ActivityDetailPage } from '@web/features/activity/pages/ActivityDetailPage';
import { MyActivityListPage } from '@web/features/activity/pages/MyActivityListPage';

// =========================================================================
// ActivityListPage Integration Tests
// =========================================================================

describe('ActivityListPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ActivityListPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it('should load and display activities from API', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json({
          data: {
            items: [mockActivityListItem],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    renderPage();

    // Wait for data to load (increased timeout for initial render with heavy antd imports)
    await waitFor(
      () => {
        expect(screen.getByText('周末约球')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Verify activity details are rendered
    expect(screen.getByText(/3\/8/)).toBeInTheDocument();
  }, 15000);

  it('should display empty state when no activities returned', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json({
          data: {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/暂无/i)).toBeInTheDocument();
    });
  });

  it('should display error state when API fails', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json(
          {
            error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
          },
          { status: 500 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/失败/i)).toBeInTheDocument();
    });
  });

  it('should navigate to activity detail when card is clicked', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json({
          data: {
            items: [mockActivityListItem],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('周末约球')).toBeInTheDocument();
    });

    await user.click(screen.getByText('周末约球'));
    expect(mockNavigate).toHaveBeenCalledWith('/activities/activity-uuid-1');
  });

  it('should navigate to create activity page when FAB is clicked', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /发起/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/activities/create');
  });

  it('should pass query parameters to API based on filters', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    renderPage();

    // Wait for initial load
    await waitFor(() => {
      expect(capturedUrl).toContain('/api/activities');
    });

    // Verify default params don't include filters
    const url = new URL(capturedUrl);
    expect(url.searchParams.has('dateFilter')).toBe(false);
    expect(url.searchParams.has('hasSlot')).toBe(false);
  });

  it('should display status tags on activity cards', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json({
          data: {
            items: [{ ...mockActivityListItem, status: 'full' }],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/已满员/i)).toBeInTheDocument();
    });
  });

  it('should show venue name as title when activity title is null', async () => {
    server.use(
      http.get('/api/activities', () => {
        return HttpResponse.json({
          data: {
            items: [{ ...mockActivityListItem, title: null }],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/朝阳体育中心/)).toBeInTheDocument();
    });
  });
});

// =========================================================================
// ActivityDetailPage Integration Tests
// =========================================================================

describe('ActivityDetailPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ActivityDetailPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it('should load and display activity detail from API', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({ data: mockActivityDetail });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: [] });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/朝阳体育中心/)).toBeInTheDocument();
    });

    // Verify participants are rendered
    expect(screen.getByText('活动发起人')).toBeInTheDocument();
    expect(screen.getByText('当前用户')).toBeInTheDocument();
  });

  it('should show not found message for non-existent activity', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json(
          { error: { code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' } },
          { status: 404 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/活动不存在/i)).toBeInTheDocument();
    });
  });

  it('should call join API and update view when join button is clicked', async () => {
    let joinCalled = false;

    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({
          data: {
            ...mockActivityDetail,
            participants: [mockActivityDetail.participants[0]], // Only creator
            currentParticipants: 1,
          },
        });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: [] });
      }),
      http.post('/api/activities/:id/join', () => {
        joinCalled = true;
        return HttpResponse.json({
          data: {
            activityId: 'activity-uuid-1',
            userId: 'current-user-id',
            currentParticipants: 2,
            status: 'open',
            joinedAt: '2026-04-02T12:00:00.000Z',
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Wait for join button to appear (current user not a participant)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /加入/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /加入/i }));

    await waitFor(() => {
      expect(joinCalled).toBe(true);
    });
  });

  it('should show leave button for participant and call leave API with confirm', async () => {
    let leaveCalled = false;

    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({ data: mockActivityDetail });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: [] });
      }),
      http.post('/api/activities/:id/leave', () => {
        leaveCalled = true;
        return HttpResponse.json({
          data: {
            activityId: 'activity-uuid-1',
            userId: 'current-user-id',
            currentParticipants: 1,
            status: 'open',
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Current user is a participant (non-creator), so leave button should appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /退出/i })).toBeInTheDocument();
    });

    // Click leave
    await user.click(screen.getByRole('button', { name: /退出/i }));

    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/确认/i)).toBeInTheDocument();
    });

    // Click confirm
    await user.click(screen.getByText(/确认/i));

    await waitFor(() => {
      expect(leaveCalled).toBe(true);
    });
  });

  it('should navigate to match record creation for completed activity', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({
          data: { ...mockActivityDetail, status: 'completed' },
        });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: [] });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /录入战绩/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /录入战绩/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/match-records/create?sourceType=activity&sourceId=activity-uuid-1',
    );
  });

  it('should enter and exit edit mode for creator', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({
          data: {
            ...mockActivityDetail,
            creatorId: 'current-user-id', // current user is the creator
          },
        });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: [] });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Wait for edit button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /编辑/i })).toBeInTheDocument();
    });

    // Enter edit mode
    await user.click(screen.getByRole('button', { name: /编辑/i }));

    expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取消编辑/i })).toBeInTheDocument();

    // Exit edit mode
    await user.click(screen.getByRole('button', { name: /取消编辑/i }));

    expect(screen.getByRole('button', { name: /编辑/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /保存/i })).not.toBeInTheDocument();
  });

  it('should search and submit a new venue when creator edits activity', async () => {
    const updatedVenue = {
      id: 'venue-uuid-2',
      name: '海淀全民健身中心',
      address: '北京市海淀区学院路 66 号',
      latitude: 39.98,
      longitude: 116.31,
    };
    let updateBody: Record<string, unknown> | null = null;

    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({
          data: {
            ...mockActivityDetail,
            creatorId: 'current-user-id',
          },
        });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: [] });
      }),
      http.get('/api/venues/search', () => {
        return HttpResponse.json({
          data: { items: [updatedVenue] },
        });
      }),
      http.put('/api/activities/:id', async ({ request }) => {
        updateBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            ...mockActivityListItem,
            venue: updatedVenue,
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /编辑/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /编辑/i }));
    await user.clear(screen.getByPlaceholderText('搜索球馆'));
    await user.type(screen.getByPlaceholderText('搜索球馆'), '海淀');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /海淀全民健身中心/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /海淀全民健身中心/i }));
    await user.click(screen.getByRole('button', { name: /保存/i }));

    await waitFor(() => {
      expect(updateBody).toMatchObject({ venueId: 'venue-uuid-2' });
    });
  });

  it('should show cancel activity confirm dialog for creator', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({
          data: {
            ...mockActivityDetail,
            creatorId: 'current-user-id',
          },
        });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: [] });
      }),
      http.post('/api/activities/:id/cancel', () => {
        return HttpResponse.json({
          data: { id: 'activity-uuid-1', status: 'cancelled' },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /取消活动/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /取消活动/i }));

    // Confirm dialog should show warning about irreversible action
    await waitFor(() => {
      expect(screen.getByText(/不可恢复/i)).toBeInTheDocument();
    });
  });

  it('should render match records and allow deletion by recorder', async () => {
    const mockRecord = {
      id: 'record-uuid-1',
      sourceType: 'activity',
      sourceId: 'activity-uuid-1',
      matchType: 'singles',
      recordedBy: 'current-user-id',
      recorder: {
        id: 'current-user-id',
        nickname: '当前用户',
        avatarUrl: null,
      },
      players: {
        sideA: [{ userId: 'user-a', nickname: '选手甲', avatarUrl: null }],
        sideB: [{ userId: 'user-b', nickname: '选手乙', avatarUrl: null }],
      },
      games: [{ gameNumber: 1, scoreA: 21, scoreB: 18 }],
      result: 'A_WIN',
      createdAt: '2026-04-05T17:00:00.000Z',
    };

    let deleteCalled = false;

    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({
          data: { ...mockActivityDetail, status: 'completed' },
        });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: [mockRecord] });
      }),
      http.delete('/api/match-records/:id', () => {
        deleteCalled = true;
        return HttpResponse.json({ data: null });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Wait for match records to load
    await waitFor(() => {
      expect(screen.getByText('选手甲')).toBeInTheDocument();
      expect(screen.getByText('选手乙')).toBeInTheDocument();
    });

    // Should show delete button (current user is recorder)
    const deleteButton = screen.getByRole('button', { name: /删除/i });
    expect(deleteButton).toBeInTheDocument();

    // Click delete
    await user.click(deleteButton);

    // Confirm dialog
    await waitFor(() => {
      expect(screen.getByText(/确认/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/确认/i));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it('should render match records when backend returns { items } envelope', async () => {
    const mockRecord = {
      id: 'record-uuid-2',
      sourceType: 'activity',
      sourceId: 'activity-uuid-1',
      matchType: 'singles',
      recordedBy: 'current-user-id',
      recorder: {
        id: 'current-user-id',
        nickname: '当前用户',
        avatarUrl: null,
      },
      players: {
        sideA: [{ userId: 'user-a', nickname: '选手甲', avatarUrl: null }],
        sideB: [{ userId: 'user-b', nickname: '选手乙', avatarUrl: null }],
      },
      games: [{ gameNumber: 1, scoreA: 21, scoreB: 18 }],
      result: 'A_WIN',
      createdAt: '2026-04-05T17:00:00.000Z',
    };

    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({
          data: { ...mockActivityDetail, status: 'completed' },
        });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: { items: [mockRecord] } });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('选手甲')).toBeInTheDocument();
      expect(screen.getByText('选手乙')).toBeInTheDocument();
    });
  });

  it('should show disabled full button for non-participant when activity is full', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({
          data: {
            ...mockActivityDetail,
            status: 'full',
            participants: [mockActivityDetail.participants[0]], // Only creator, current user not participant
          },
        });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: [] });
      }),
    );

    renderPage();

    await waitFor(() => {
      const fullButton = screen.getByRole('button', { name: /已满员/i });
      expect(fullButton).toBeInTheDocument();
      expect(fullButton).toBeDisabled();
    });
  });

  it('should show in-progress hint for participant when activity is in_progress', async () => {
    server.use(
      http.get('/api/activities/:id', () => {
        return HttpResponse.json({
          data: { ...mockActivityDetail, status: 'in_progress' },
        });
      }),
      http.get('/api/activities/:id/match-records', () => {
        return HttpResponse.json({ data: [] });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/活动进行中.*结束后可录入战绩/)).toBeInTheDocument();
    });
  });
});

// =========================================================================
// MyActivityListPage Integration Tests
// =========================================================================

describe('MyActivityListPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <MyActivityListPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it('should load and display user activities from API', async () => {
    server.use(
      http.get('/api/users/:id/activities', ({ request }) => {
        const url = new URL(request.url);
        // Verify it uses the current user's ID
        expect(url.pathname).toContain('/api/users/current-user-id/activities');
        return HttpResponse.json({
          data: {
            items: [mockActivityListItem],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('周末约球')).toBeInTheDocument();
    });
  });

  it('should display empty state when no user activities', async () => {
    server.use(
      http.get('/api/users/:id/activities', () => {
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/暂无/i)).toBeInTheDocument();
    });
  });

  it('should navigate to activity detail when card is clicked', async () => {
    server.use(
      http.get('/api/users/:id/activities', () => {
        return HttpResponse.json({
          data: {
            items: [mockActivityListItem],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('周末约球')).toBeInTheDocument();
    });

    await user.click(screen.getByText('周末约球'));
    expect(mockNavigate).toHaveBeenCalledWith('/activities/activity-uuid-1');
  });

  it('should pass role filter to API when tab is changed', async () => {
    let capturedUrl = '';

    server.use(
      http.get('/api/users/:id/activities', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Wait for initial load
    await waitFor(() => {
      expect(capturedUrl).toContain('/api/users/current-user-id/activities');
    });

    // Click "我发起的" tab
    await user.click(screen.getByText(/我发起的/i));

    // Wait for new request with role=creator
    await waitFor(() => {
      const url = new URL(capturedUrl);
      expect(url.searchParams.get('role')).toBe('creator');
    });
  });

  it('should navigate back when back button is clicked', async () => {
    server.use(
      http.get('/api/users/:id/activities', () => {
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    const backButton = screen.getByRole('button', { name: /返回/i });
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should show error state when API fails', async () => {
    server.use(
      http.get('/api/users/:id/activities', () => {
        return HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
          { status: 500 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/失败/i)).toBeInTheDocument();
    });
  });

  it('should render role filter tabs correctly', async () => {
    server.use(
      http.get('/api/users/:id/activities', () => {
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    renderPage();

    expect(screen.getByText(/全部/i)).toBeInTheDocument();
    expect(screen.getByText(/我发起的/i)).toBeInTheDocument();
    expect(screen.getByText(/我参加的/i)).toBeInTheDocument();
  });

  it('should display activity status tags in cards', async () => {
    server.use(
      http.get('/api/users/:id/activities', () => {
        return HttpResponse.json({
          data: {
            items: [{ ...mockActivityListItem, status: 'completed' }],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/已结束/i)).toBeInTheDocument();
    });
  });
});
