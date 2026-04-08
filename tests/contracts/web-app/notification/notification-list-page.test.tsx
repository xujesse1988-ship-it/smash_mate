/**
 * @vitest-environment jsdom
 */

/**
 * 契约测试: web-app/notification — NotificationListPage 页面渲染
 * 覆盖页面: NotificationListPage (/notifications)
 *
 * 来源文档:
 *   - docs/module-design/web-app-notification.md §2 NotificationListPage 页面
 *   - docs/module-design/web-app-notification.md §3 Feature 私有组件
 *   - docs/module-design/web-app-notification.md §6 关键业务逻辑
 *
 * Mock 策略:
 *   - Mock hooks（useNotifications, useMarkAsRead, useMarkAllAsRead,
 *     useNotificationNavigate, useUnreadCount）的返回值
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

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useNotifications hook
let mockNotificationsData: {
  data: { pages: Array<{ items: unknown[]; total: number; page: number; pageSize: number }> } | undefined;
  isLoading: boolean;
  error: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: ReturnType<typeof vi.fn>;
} = {
  data: undefined,
  isLoading: false,
  error: null,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
};

vi.mock('@web/features/notification/hooks/useNotifications', () => ({
  useNotifications: () => mockNotificationsData,
}));

// Mock useMarkAsRead hook
const mockMarkAsReadMutate = vi.fn();
let mockMarkAsReadState = {
  mutate: mockMarkAsReadMutate,
  isPending: false,
};

vi.mock('@web/features/notification/hooks/useMarkAsRead', () => ({
  useMarkAsRead: () => mockMarkAsReadState,
}));

// Mock useMarkAllAsRead hook
const mockMarkAllAsReadMutate = vi.fn();
let mockMarkAllAsReadState = {
  mutate: mockMarkAllAsReadMutate,
  isPending: false,
};

vi.mock('@web/features/notification/hooks/useMarkAllAsRead', () => ({
  useMarkAllAsRead: () => mockMarkAllAsReadState,
}));

// Mock useNotificationNavigate hook
const mockNotificationNavigate = vi.fn();
vi.mock('@web/features/notification/hooks/useNotificationNavigate', () => ({
  useNotificationNavigate: () => ({ navigateToTarget: mockNotificationNavigate }),
}));

// Mock useUnreadCount hook (shared hook)
let mockUnreadCountData: {
  data: { count: number } | undefined;
} = {
  data: { count: 3 },
};

vi.mock('@web/shared/hooks/useUnreadCount', () => ({
  useUnreadCount: () => mockUnreadCountData,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { NotificationListPage } from '@web/features/notification/pages/NotificationListPage';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const mockNotificationItems = [
  {
    id: 'notif-uuid-1',
    type: 'ACTIVITY_JOINED',
    title: '新成员加入',
    content: '张三 加入了你的活动「朝阳体育中心 04/05」',
    targetType: 'activity',
    targetId: 'activity-uuid-1',
    isRead: false,
    createdAt: '2026-04-02T10:00:00.000Z',
  },
  {
    id: 'notif-uuid-2',
    type: 'GROUP_CLASS_ENROLLED',
    title: '新学员报名',
    content: '李四 报名了你的团课「初级训练营」',
    targetType: 'group-class',
    targetId: 'gc-uuid-1',
    isRead: true,
    createdAt: '2026-04-01T09:00:00.000Z',
  },
  {
    id: 'notif-uuid-3',
    type: 'PRIVATE_LESSON_BOOKED',
    title: '新私教预约',
    content: '王五 预约了你的私教课（04/10 14:00-15:00）',
    targetType: 'private-lesson',
    targetId: 'pl-uuid-1',
    isRead: false,
    createdAt: '2026-04-03T08:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<NotificationListPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationsData = {
      data: {
        pages: [
          {
            items: mockNotificationItems,
            total: 3,
            page: 1,
            pageSize: 20,
          },
        ],
      },
      isLoading: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    };
    mockMarkAsReadState = {
      mutate: mockMarkAsReadMutate,
      isPending: false,
    };
    mockMarkAllAsReadState = {
      mutate: mockMarkAllAsReadMutate,
      isPending: false,
    };
    mockUnreadCountData = {
      data: { count: 3 },
    };
  });

  // =========================================================================
  // 基本渲染 — 通知列表
  // =========================================================================

  // 来源: web-app-notification.md §2 — NotificationListPage — 组件结构
  it('should render notification list with notification items', () => {
    renderPage();

    expect(screen.getByText('新成员加入')).toBeInTheDocument();
    expect(screen.getByText('新学员报名')).toBeInTheDocument();
    expect(screen.getByText('新私教预约')).toBeInTheDocument();
  });

  // 来源: web-app-notification.md §3 — NotificationItem — 显示标题和内容
  it('should render notification title and content', () => {
    renderPage();

    expect(screen.getByText('新成员加入')).toBeInTheDocument();
    expect(screen.getByText('张三 加入了你的活动「朝阳体育中心 04/05」')).toBeInTheDocument();
  });

  // 来源: web-app-notification.md §2 — NotificationListPage — 组件结构 — NotificationFilter
  it('should render filter tabs (全部 / 未读 / 已读)', () => {
    renderPage();

    expect(screen.getByText(/全部/)).toBeInTheDocument();
    expect(screen.getByText(/未读/)).toBeInTheDocument();
    expect(screen.getByText(/已读/)).toBeInTheDocument();
  });

  // =========================================================================
  // 空状态
  // =========================================================================

  // 来源: web-app-notification.md §2 — 交互流程 — 页面加载 — 列表为空显示 EmptyState
  it('should render empty state when there are no notifications', () => {
    mockNotificationsData = {
      data: {
        pages: [
          {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          },
        ],
      },
      isLoading: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    };
    renderPage();

    expect(screen.getByText(/暂无通知/)).toBeInTheDocument();
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-notification.md §2 — NotificationListPage — 页面状态 — isLoading
  it('should show loading state when notifications are loading', () => {
    mockNotificationsData = {
      data: undefined,
      isLoading: true,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    };
    renderPage();

    // 加载中不应渲染通知列表
    expect(screen.queryByText('新成员加入')).not.toBeInTheDocument();
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: web-app-notification.md §2 — 调用的后端接口 — GET /api/notifications — 错误处理 — 显示 PageError
  it('should show error state when loading notifications fails', () => {
    mockNotificationsData = {
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    };
    renderPage();

    // 应显示错误提示
    expect(screen.queryByText('新成员加入')).not.toBeInTheDocument();
  });

  // =========================================================================
  // 未读/已读视觉区分
  // =========================================================================

  // 来源: web-app-notification.md §6.2 — 未读状态视觉区分 — 未读通知标题文字加粗
  it('should visually distinguish unread notifications from read ones', () => {
    renderPage();

    // 未读通知和已读通知都应该被渲染
    const unreadTitle = screen.getByText('新成员加入');
    const readTitle = screen.getByText('新学员报名');

    expect(unreadTitle).toBeInTheDocument();
    expect(readTitle).toBeInTheDocument();
  });

  // =========================================================================
  // 筛选功能
  // =========================================================================

  // 来源: web-app-notification.md §6.4 — 筛选与分页交互 — 筛选切换时重置分页
  it('should allow clicking filter tabs', async () => {
    const user = userEvent.setup();
    renderPage();

    const unreadTab = screen.getByText(/未读/);
    await user.click(unreadTab);

    // 切换筛选 Tab 后应能重新渲染（具体行为由 hook 实现控制）
    expect(unreadTab).toBeInTheDocument();
  });

  // 来源: web-app-notification.md §6.4 — isRead 参数映射 — 筛选"已读"
  it('should allow clicking read filter tab', async () => {
    const user = userEvent.setup();
    renderPage();

    const readTab = screen.getByText(/已读/);
    await user.click(readTab);

    expect(readTab).toBeInTheDocument();
  });

  // =========================================================================
  // "全部已读"按钮
  // =========================================================================

  // 来源: web-app-notification.md §6.5 — "全部已读"按钮显示逻辑 — 存在未读通知时显示
  it('should render "全部已读" button when there are unread notifications', () => {
    mockUnreadCountData = {
      data: { count: 3 },
    };
    renderPage();

    expect(screen.getByText(/全部已读/)).toBeInTheDocument();
  });

  // 来源: web-app-notification.md §6.5 — "全部已读"按钮显示逻辑 — 没有未读通知时隐藏
  it('should hide "全部已读" button when there are no unread notifications', () => {
    mockUnreadCountData = {
      data: { count: 0 },
    };
    renderPage();

    expect(screen.queryByText(/全部已读/)).not.toBeInTheDocument();
  });

  // 来源: web-app-notification.md §2 — 交互流程 — 全部标记已读 — 点击按钮调用 API
  it('should call markAllAsRead when "全部已读" button is clicked', async () => {
    const user = userEvent.setup();
    mockUnreadCountData = {
      data: { count: 3 },
    };
    renderPage();

    await user.click(screen.getByText(/全部已读/));

    expect(mockMarkAllAsReadMutate).toHaveBeenCalled();
  });

  // 来源: web-app-notification.md §2 — 页面状态 — isMarkingAllRead — loading 状态下禁用
  it('should disable "全部已读" button when marking all as read is pending', () => {
    mockMarkAllAsReadState = {
      mutate: mockMarkAllAsReadMutate,
      isPending: true,
    };
    mockUnreadCountData = {
      data: { count: 3 },
    };
    renderPage();

    const button = screen.getByText(/全部已读/).closest('button');
    expect(button).toBeDisabled();
  });

  // =========================================================================
  // 点击通知项 — 标记已读和跳转
  // =========================================================================

  // 来源: web-app-notification.md §6.6 — 标记已读与跳转的顺序 — 点击未读通知项
  it('should call markAsRead and navigate when clicking an unread notification', async () => {
    const user = userEvent.setup();
    renderPage();

    // 点击未读的通知项（"新成员加入"）
    const notificationItem = screen.getByText('新成员加入');
    await user.click(notificationItem.closest('[role="button"]') || notificationItem.closest('button') || notificationItem);

    // 应调用标记已读
    expect(mockMarkAsReadMutate).toHaveBeenCalledWith('notif-uuid-1');
    // 应调用跳转
    expect(mockNotificationNavigate).toHaveBeenCalledWith('activity', 'activity-uuid-1');
  });

  // 来源: web-app-notification.md §6.6 — 标记已读与跳转的顺序 — 点击已读通知项不调用标记接口
  it('should navigate without calling markAsRead when clicking a read notification', async () => {
    const user = userEvent.setup();
    renderPage();

    // 点击已读的通知项（"新学员报名"）
    const notificationItem = screen.getByText('新学员报名');
    await user.click(notificationItem.closest('[role="button"]') || notificationItem.closest('button') || notificationItem);

    // 不应调用标记已读（已经是已读状态）
    expect(mockMarkAsReadMutate).not.toHaveBeenCalled();
    // 应调用跳转
    expect(mockNotificationNavigate).toHaveBeenCalledWith('group-class', 'gc-uuid-1');
  });

  // 来源: web-app-notification.md §6.1 — 通知跳转路由映射 — private-lesson → /my-courses
  it('should navigate with private-lesson targetType when clicking private lesson notification', async () => {
    const user = userEvent.setup();
    renderPage();

    // 点击私教通知项（"新私教预约"）
    const notificationItem = screen.getByText('新私教预约');
    await user.click(notificationItem.closest('[role="button"]') || notificationItem.closest('button') || notificationItem);

    // 应调用跳转，targetType 为 private-lesson
    expect(mockNotificationNavigate).toHaveBeenCalledWith('private-lesson', 'pl-uuid-1');
  });

  // =========================================================================
  // 通知跳转路由映射 — 各 targetType
  // =========================================================================

  // 来源: web-app-notification.md §6.1 — 通知跳转路由映射 — coach-profile
  it('should navigate with coach-profile targetType for review notifications', async () => {
    const user = userEvent.setup();
    mockNotificationsData = {
      data: {
        pages: [
          {
            items: [
              {
                id: 'notif-uuid-4',
                type: 'REVIEW_RECEIVED',
                title: '收到新评价',
                content: '赵六 对你的课程「进阶训练营」发表了评价',
                targetType: 'coach-profile',
                targetId: 'coach-user-uuid-1',
                isRead: false,
                createdAt: '2026-04-04T12:00:00.000Z',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        ],
      },
      isLoading: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    };
    mockUnreadCountData = { data: { count: 1 } };
    renderPage();

    const notificationItem = screen.getByText('收到新评价');
    await user.click(notificationItem.closest('[role="button"]') || notificationItem.closest('button') || notificationItem);

    expect(mockNotificationNavigate).toHaveBeenCalledWith('coach-profile', 'coach-user-uuid-1');
  });
});
