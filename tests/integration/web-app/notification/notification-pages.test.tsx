/**
 * L1 集成测试: web-app/notification — NotificationListPage 端内数据流
 *
 * 验证: 页面操作 → hook 调用 → API 请求 → 状态更新 → 页面响应
 * Mock 策略: 仅 MSW mock 网络层，不 mock hooks
 *
 * 与契约测试的区别:
 *   - 契约测试: mock hooks，验证页面渲染和交互
 *   - L1 集成测试: 不 mock hooks，验证完整数据流
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  vi,
} from 'vitest';
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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
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
  };
});

// ---------------------------------------------------------------------------
// Mock auth store
// ---------------------------------------------------------------------------

vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-jwt-token',
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
// Import component (after mocks)
// ---------------------------------------------------------------------------

import { NotificationListPage } from '@web/features/notification/pages/NotificationListPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const notificationItems = [
  {
    id: 'notif-1',
    type: 'ACTIVITY_JOINED',
    title: '新成员加入',
    content: '张三 加入了你的活动「朝阳体育中心 04/05」',
    targetType: 'activity',
    targetId: 'activity-uuid-1',
    isRead: false,
    createdAt: '2026-04-07T10:00:00.000Z',
  },
  {
    id: 'notif-2',
    type: 'GROUP_CLASS_ENROLLED',
    title: '新学员报名',
    content: '李四 报名了你的团课「初级训练营」',
    targetType: 'group-class',
    targetId: 'gc-uuid-1',
    isRead: true,
    createdAt: '2026-04-06T09:00:00.000Z',
  },
  {
    id: 'notif-3',
    type: 'PRIVATE_LESSON_BOOKED',
    title: '新私教预约',
    content: '王五 预约了你的私教课（04/10 14:00-15:00）',
    targetType: 'private-lesson',
    targetId: 'pl-uuid-1',
    isRead: false,
    createdAt: '2026-04-05T08:00:00.000Z',
  },
];

const unreadNotifications = notificationItems.filter((n) => !n.isRead);
const readNotifications = notificationItems.filter((n) => n.isRead);

// =========================================================================
// NotificationListPage Integration Tests
// =========================================================================

describe('NotificationListPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-jwt-token');
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NotificationListPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  // -----------------------------------------------------------------------
  // Basic data loading flow: page → hook → API → render
  // -----------------------------------------------------------------------

  it('should load notifications from API and display them on page', async () => {
    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: notificationItems,
            total: 3,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 2 } });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('新成员加入')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.getByText('新学员报名')).toBeInTheDocument();
    expect(screen.getByText('新私教预约')).toBeInTheDocument();
    expect(
      screen.getByText('张三 加入了你的活动「朝阳体育中心 04/05」'),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  it('should show empty state when no notifications are returned', async () => {
    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 0 } });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText(/暂无通知/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  it('should show error state when API call fails', async () => {
    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' } },
          { status: 401 },
        );
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH_UNAUTHORIZED', message: 'Token 缺失或无效' } },
          { status: 401 },
        );
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText(/加载失败/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  // -----------------------------------------------------------------------
  // Filter switching: page action → hook requery → API → re-render
  // -----------------------------------------------------------------------

  it('should filter notifications by unread when clicking 未读 tab', async () => {
    const user = userEvent.setup();
    let capturedIsRead: string | null = null;

    server.use(
      http.get('/api/notifications', ({ request }) => {
        const url = new URL(request.url);
        capturedIsRead = url.searchParams.get('isRead');

        // Return different data based on filter
        const isReadParam = url.searchParams.get('isRead');
        const items =
          isReadParam === 'false'
            ? unreadNotifications
            : isReadParam === 'true'
              ? readNotifications
              : notificationItems;

        return HttpResponse.json({
          data: {
            items,
            total: items.length,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 2 } });
      }),
    );

    renderPage();

    // Wait for initial load
    await waitFor(
      () => {
        expect(screen.getByText('新成员加入')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Click "未读" tab
    const unreadTab = screen.getByText('未读');
    await user.click(unreadTab);

    // Wait for filtered results
    await waitFor(() => {
      expect(capturedIsRead).toBe('false');
    });

    // Only unread notifications should be visible
    await waitFor(() => {
      expect(screen.getByText('新成员加入')).toBeInTheDocument();
      expect(screen.getByText('新私教预约')).toBeInTheDocument();
    });
  });

  it('should filter notifications by read when clicking 已读 tab', async () => {
    const user = userEvent.setup();
    let lastCapturedIsRead: string | null = null;

    server.use(
      http.get('/api/notifications', ({ request }) => {
        const url = new URL(request.url);
        lastCapturedIsRead = url.searchParams.get('isRead');

        const isReadParam = url.searchParams.get('isRead');
        const items =
          isReadParam === 'false'
            ? unreadNotifications
            : isReadParam === 'true'
              ? readNotifications
              : notificationItems;

        return HttpResponse.json({
          data: {
            items,
            total: items.length,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 2 } });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('新成员加入')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Click "已读" tab — use exact match to avoid conflict with "全部已读" button
    const tabs = screen.getAllByText(/已读/);
    // Find the filter tab (not the "全部已读" button)
    const readTab = tabs.find(
      (el) =>
        el.textContent === '已读' &&
        !el.textContent?.includes('全部'),
    )!;
    await user.click(readTab);

    await waitFor(() => {
      expect(lastCapturedIsRead).toBe('true');
    });

    // Only read notifications should be visible
    await waitFor(() => {
      expect(screen.getByText('新学员报名')).toBeInTheDocument();
    });
  });

  it('should switch between filter tabs and send correct API parameters', async () => {
    const user = userEvent.setup();
    const isReadValues: (string | null)[] = [];

    server.use(
      http.get('/api/notifications', ({ request }) => {
        const url = new URL(request.url);
        isReadValues.push(url.searchParams.get('isRead'));

        const isReadParam = url.searchParams.get('isRead');
        const items =
          isReadParam === 'false'
            ? unreadNotifications
            : isReadParam === 'true'
              ? readNotifications
              : notificationItems;

        return HttpResponse.json({
          data: {
            items,
            total: items.length,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 2 } });
      }),
    );

    renderPage();

    // Wait for initial load (全部 tab, no isRead param)
    await waitFor(
      () => {
        expect(screen.getByText('新成员加入')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Initial request should have no isRead param
    expect(isReadValues[0]).toBeNull();

    // Click "未读" tab — should request with isRead=false
    await user.click(screen.getByText('未读'));
    await waitFor(
      () => {
        expect(isReadValues).toContain('false');
      },
      { timeout: 5000 },
    );

    // Verify unread items are shown
    await waitFor(() => {
      expect(screen.getByText('新成员加入')).toBeInTheDocument();
      expect(screen.getByText('新私教预约')).toBeInTheDocument();
    });
  }, 15000);

  // -----------------------------------------------------------------------
  // Mark as read: click notification → markAsRead API → navigate
  // -----------------------------------------------------------------------

  it('should call markAsRead API and navigate when clicking an unread notification', async () => {
    const user = userEvent.setup();
    let markAsReadCalled = false;
    let markedId = '';

    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: notificationItems,
            total: 3,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 2 } });
      }),
      http.put('/api/notifications/:id/read', ({ params }) => {
        markAsReadCalled = true;
        markedId = params.id as string;
        const notification = notificationItems.find((n) => n.id === markedId);
        return HttpResponse.json({
          data: { ...notification, isRead: true },
        });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('新成员加入')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Click unread notification "新成员加入" (targetType: activity)
    const notifElement = screen.getByText('新成员加入');
    const clickableEl =
      notifElement.closest('[role="button"]') || notifElement;
    await user.click(clickableEl);

    // Verify markAsRead API was called with correct notification ID
    await waitFor(() => {
      expect(markAsReadCalled).toBe(true);
      expect(markedId).toBe('notif-1');
    });

    // Verify navigation to activity detail page
    expect(mockNavigate).toHaveBeenCalledWith('/activities/activity-uuid-1');
  });

  it('should navigate without calling markAsRead when clicking a read notification', async () => {
    const user = userEvent.setup();
    let markAsReadCalled = false;

    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: notificationItems,
            total: 3,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 2 } });
      }),
      http.put('/api/notifications/:id/read', () => {
        markAsReadCalled = true;
        return HttpResponse.json({ data: {} });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('新学员报名')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Click read notification "新学员报名" (targetType: group-class)
    const notifElement = screen.getByText('新学员报名');
    const clickableEl =
      notifElement.closest('[role="button"]') || notifElement;
    await user.click(clickableEl);

    // Should navigate to group class detail
    expect(mockNavigate).toHaveBeenCalledWith('/group-classes/gc-uuid-1');

    // Should NOT call markAsRead (already read)
    expect(markAsReadCalled).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Navigation route mapping for different targetTypes
  // -----------------------------------------------------------------------

  it('should navigate to /my-courses for private-lesson notifications', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: notificationItems,
            total: 3,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 2 } });
      }),
      http.put('/api/notifications/:id/read', ({ params }) => {
        const notification = notificationItems.find(
          (n) => n.id === params.id,
        );
        return HttpResponse.json({
          data: { ...notification, isRead: true },
        });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('新私教预约')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const notifElement = screen.getByText('新私教预约');
    const clickableEl =
      notifElement.closest('[role="button"]') || notifElement;
    await user.click(clickableEl);

    // private-lesson → /my-courses (no targetId in route)
    expect(mockNavigate).toHaveBeenCalledWith('/my-courses');
  });

  it('should navigate to /coaches/:id for coach-profile notifications', async () => {
    const user = userEvent.setup();

    const coachNotification = {
      id: 'notif-coach-1',
      type: 'REVIEW_RECEIVED',
      title: '收到新评价',
      content: '赵六 对你的课程「进阶训练营」发表了评价',
      targetType: 'coach-profile',
      targetId: 'coach-user-uuid-1',
      isRead: false,
      createdAt: '2026-04-07T12:00:00.000Z',
    };

    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: [coachNotification],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 1 } });
      }),
      http.put('/api/notifications/:id/read', () => {
        return HttpResponse.json({
          data: { ...coachNotification, isRead: true },
        });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('收到新评价')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const notifElement = screen.getByText('收到新评价');
    const clickableEl =
      notifElement.closest('[role="button"]') || notifElement;
    await user.click(clickableEl);

    expect(mockNavigate).toHaveBeenCalledWith('/coaches/coach-user-uuid-1');
  });

  // -----------------------------------------------------------------------
  // Mark all as read: button click → API → refresh list and count
  // -----------------------------------------------------------------------

  it('should call markAllAsRead API when clicking 全部已读 button', async () => {
    const user = userEvent.setup();
    let markAllCalled = false;

    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: notificationItems,
            total: 3,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({
          data: { count: markAllCalled ? 0 : 2 },
        });
      }),
      http.put('/api/notifications/read-all', () => {
        markAllCalled = true;
        return HttpResponse.json({ data: { updatedCount: 2 } });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('新成员加入')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Find and click the "全部已读" button
    const markAllBtn = screen.getByText(/全部已读/);
    await user.click(markAllBtn);

    await waitFor(() => {
      expect(markAllCalled).toBe(true);
    });
  });

  it('should hide 全部已读 button when unread count is 0', async () => {
    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: readNotifications,
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 0 } });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('新学员报名')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // "全部已读" button should not be rendered when count is 0
    expect(screen.queryByText(/全部已读/)).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Time formatting in rendered output
  // -----------------------------------------------------------------------

  it('should display relative time for recent notifications', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));

    const recentNotification = {
      id: 'notif-recent',
      type: 'ACTIVITY_JOINED',
      title: '刚刚的通知',
      content: '测试内容',
      targetType: 'activity',
      targetId: 'activity-uuid-1',
      isRead: true,
      createdAt: '2026-04-08T11:55:00.000Z', // 5 minutes ago
    };

    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: [recentNotification],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 0 } });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('刚刚的通知')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.getByText('5 分钟前')).toBeInTheDocument();

    vi.useRealTimers();
  }, 15000);

  // -----------------------------------------------------------------------
  // Unread visual distinction
  // -----------------------------------------------------------------------

  it('should visually distinguish unread notifications with bold title and blue background', async () => {
    server.use(
      http.get('/api/notifications', () => {
        return HttpResponse.json({
          data: {
            items: notificationItems,
            total: 3,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 2 } });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('新成员加入')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Unread notification title should be bold
    const unreadTitle = screen.getByText('新成员加入');
    expect(unreadTitle).toHaveStyle({ fontWeight: 600 });

    // Read notification title should have normal weight
    const readTitle = screen.getByText('新学员报名');
    expect(readTitle).toHaveStyle({ fontWeight: 400 });

    // Unread notification container should have blue background
    const unreadContainer = unreadTitle.closest('[role="button"]');
    expect(unreadContainer).toHaveStyle({ backgroundColor: '#F0F5FF' });

    // Read notification container should have white background
    const readContainer = readTitle.closest('[role="button"]');
    expect(readContainer).toHaveStyle({ backgroundColor: '#fff' });
  }, 15000);

  // -----------------------------------------------------------------------
  // Pagination: query param verification
  // -----------------------------------------------------------------------

  it('should send correct page and pageSize parameters to API', async () => {
    let capturedPage: string | null = null;
    let capturedPageSize: string | null = null;

    server.use(
      http.get('/api/notifications', ({ request }) => {
        const url = new URL(request.url);
        capturedPage = url.searchParams.get('page');
        capturedPageSize = url.searchParams.get('pageSize');
        return HttpResponse.json({
          data: {
            items: notificationItems,
            total: 3,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        return HttpResponse.json({ data: { count: 2 } });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('新成员加入')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(capturedPage).toBe('1');
    expect(capturedPageSize).toBe('20');
  }, 15000);

  // -----------------------------------------------------------------------
  // Full data flow: mark as read → list refresh → unread count refresh
  // -----------------------------------------------------------------------

  it('should refresh notification list and unread count after marking as read', async () => {
    const user = userEvent.setup();
    let markAsReadCalled = false;
    let notificationListCallCount = 0;
    let unreadCountCallCount = 0;

    server.use(
      http.get('/api/notifications', () => {
        notificationListCallCount++;
        const items = markAsReadCalled
          ? notificationItems.map((n) =>
              n.id === 'notif-1' ? { ...n, isRead: true } : n,
            )
          : notificationItems;
        return HttpResponse.json({
          data: {
            items,
            total: 3,
            page: 1,
            pageSize: 20,
          },
        });
      }),
      http.get('/api/notifications/unread-count', () => {
        unreadCountCallCount++;
        return HttpResponse.json({
          data: { count: markAsReadCalled ? 1 : 2 },
        });
      }),
      http.put('/api/notifications/:id/read', ({ params }) => {
        markAsReadCalled = true;
        const notification = notificationItems.find(
          (n) => n.id === params.id,
        );
        return HttpResponse.json({
          data: { ...notification, isRead: true },
        });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('新成员加入')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const initialListCalls = notificationListCallCount;
    const initialCountCalls = unreadCountCallCount;

    // Click unread notification
    const notifElement = screen.getByText('新成员加入');
    const clickableEl =
      notifElement.closest('[role="button"]') || notifElement;
    await user.click(clickableEl);

    // After marking as read, both list and unread count should be re-fetched
    await waitFor(
      () => {
        expect(notificationListCallCount).toBeGreaterThan(initialListCalls);
        expect(unreadCountCallCount).toBeGreaterThan(initialCountCalls);
      },
      { timeout: 10000 },
    );
  }, 15000);
});
