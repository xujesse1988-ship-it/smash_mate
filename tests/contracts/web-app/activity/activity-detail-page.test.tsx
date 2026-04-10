/**
 * 契约测试: web-app/activity — ActivityDetailPage 页面渲染
 * 覆盖页面: ActivityDetailPage (/activities/:id)
 *
 * 来源文档:
 *   - docs/module-design/web-app-activity.md §2 — ActivityDetailPage 页面
 *   - docs/module-design/web-app-activity.md §3 — Feature 私有组件
 *   - docs/module-design/web-app-activity.md §6 — 关键业务逻辑
 *
 * Mock 策略:
 *   - Mock hooks（useActivityDetail, useActivityMatchRecords, useJoinActivity,
 *     useLeaveActivity, useUpdateActivity, useCancelActivity, useDeleteMatchRecord）的返回值
 *   - Mock authStore（当前用户身份判断）
 *   - Mock react-router-dom 导航和路由参数
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
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'activity-uuid-1' }),
  };
});

// Mock authStore — currentUserId determines button visibility
let mockCurrentUserId = 'current-user-id';
vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-token',
      userId: mockCurrentUserId,
      isLoggedIn: true,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

// Mock useActivityDetail hook
let mockActivityDetailState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/activity/hooks/useActivityDetail', () => ({
  useActivityDetail: () => mockActivityDetailState,
}));

// Mock useActivityMatchRecords hook
let mockMatchRecordsState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/activity/hooks/useActivityMatchRecords', () => ({
  useActivityMatchRecords: () => mockMatchRecordsState,
}));

// Mock useJoinActivity hook
const mockJoinActivity = vi.fn();
vi.mock('@web/features/activity/hooks/useJoinActivity', () => ({
  useJoinActivity: () => ({
    mutate: mockJoinActivity,
    isPending: false,
  }),
}));

// Mock useLeaveActivity hook
const mockLeaveActivity = vi.fn();
vi.mock('@web/features/activity/hooks/useLeaveActivity', () => ({
  useLeaveActivity: () => ({
    mutate: mockLeaveActivity,
    isPending: false,
  }),
}));

// Mock useUpdateActivity hook
const mockUpdateActivity = vi.fn();
vi.mock('@web/features/activity/hooks/useUpdateActivity', () => ({
  useUpdateActivity: () => ({
    mutate: mockUpdateActivity,
    isPending: false,
  }),
}));

// Mock useCancelActivity hook
const mockCancelActivity = vi.fn();
vi.mock('@web/features/activity/hooks/useCancelActivity', () => ({
  useCancelActivity: () => ({
    mutate: mockCancelActivity,
    isPending: false,
  }),
}));

// Mock useDeleteMatchRecord hook
const mockDeleteMatchRecord = vi.fn();
vi.mock('@web/features/activity/hooks/useDeleteMatchRecord', () => ({
  useDeleteMatchRecord: () => ({
    mutate: mockDeleteMatchRecord,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { ActivityDetailPage } from '@web/features/activity/pages/ActivityDetailPage';

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

const mockCreator = {
  id: 'creator-user-id',
  nickname: '发起人',
  avatarUrl: null,
};

const mockParticipant1 = {
  userId: 'creator-user-id',
  nickname: '发起人',
  avatarUrl: null,
  joinedAt: '2026-04-02T10:00:00.000Z',
};

const mockParticipant2 = {
  userId: 'participant-user-id',
  nickname: '参与者A',
  avatarUrl: 'https://example.com/avatar.jpg',
  joinedAt: '2026-04-02T11:00:00.000Z',
};

const mockActivityDetail = {
  id: 'activity-uuid-1',
  creatorId: 'creator-user-id',
  creator: mockCreator,
  venue: mockVenue,
  title: '周末约球',
  startTime: '2026-04-05T14:00:00.000Z',
  endTime: '2026-04-05T16:00:00.000Z',
  maxParticipants: 8,
  currentParticipants: 2,
  status: 'open',
  participants: [mockParticipant1, mockParticipant2],
  createdAt: '2026-04-02T10:00:00.000Z',
};

const mockMatchRecord = {
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
    sideA: [{ userId: 'user-a', nickname: '选手A', avatarUrl: null }],
    sideB: [{ userId: 'user-b', nickname: '选手B', avatarUrl: null }],
  },
  games: [
    { gameNumber: 1, scoreA: 21, scoreB: 18 },
    { gameNumber: 2, scoreA: 15, scoreB: 21 },
    { gameNumber: 3, scoreA: 21, scoreB: 16 },
  ],
  result: 'A_WIN',
  createdAt: '2026-04-05T17:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<ActivityDetailPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserId = 'current-user-id';
    mockActivityDetailState = {
      data: null,
      isLoading: false,
      error: null,
    };
    mockMatchRecordsState = {
      data: null,
      isLoading: false,
      error: null,
    };
  });

  // =========================================================================
  // 加载与错误状态
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 页面状态 — isLoading
  it('should show loading spinner when activity is loading', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      isLoading: true,
    };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 错误处理 — 404
  it('should show not found message when activity does not exist', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      error: { code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' },
    };
    renderPage();

    expect(screen.getByText(/活动不存在|不存在/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 活动信息渲染
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 组件结构 — StatusTag
  it('should render activity status tag', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: mockActivityDetail,
    };
    renderPage();

    expect(screen.getByText(/报名中|open/i)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 组件结构 — VenueInfo
  it('should render venue name and address', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: mockActivityDetail,
    };
    renderPage();

    expect(screen.getByText(/朝阳体育中心/)).toBeInTheDocument();
    expect(screen.getByText(/北京市朝阳区/)).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 组件结构 — ParticipantCount
  it('should render participant count', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: mockActivityDetail,
    };
    renderPage();

    expect(
      screen.getAllByText((_, element) => element?.textContent?.includes('2 / 8 人') ?? false)
        .length,
    ).toBeGreaterThanOrEqual(1);
  });

  // 来源: web-app-activity.md §6.5 — venue 为 null
  it('should show fallback when venue is null', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, venue: null },
    };
    renderPage();

    expect(screen.getByText(/已删除的球馆/)).toBeInTheDocument();
  });

  // =========================================================================
  // 参与者列表
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 组件结构 — ParticipantSection
  it('should render participant list with nicknames', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: mockActivityDetail,
    };
    renderPage();

    expect(screen.getAllByText('发起人').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('参与者A')).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §3 — ParticipantItem — 发起人标识
  it('should show creator badge on creator participant', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: mockActivityDetail,
    };
    renderPage();

    // 发起人应有特殊标识
    expect(screen.getAllByText(/发起人/).length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 操作按钮显示逻辑 — 当前用户为发起人
  // =========================================================================

  // 来源: web-app-activity.md §6.2 — status=open, isCreator → [编辑活动] [取消活动]
  it('should show edit and cancel buttons for creator when status is open', () => {
    mockCurrentUserId = 'creator-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'open' },
    };
    renderPage();

    expect(screen.getByRole('button', { name: /编辑/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取消活动/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /加入/i })).not.toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.2 — status=full, isCreator → [编辑活动] [取消活动]
  it('should show edit and cancel buttons for creator when status is full', () => {
    mockCurrentUserId = 'creator-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'full' },
    };
    renderPage();

    expect(screen.getByRole('button', { name: /编辑/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取消活动/i })).toBeInTheDocument();
  });

  // =========================================================================
  // 操作按钮显示逻辑 — 当前用户为参与者（非发起人）
  // =========================================================================

  // 来源: web-app-activity.md §6.2 — status=open, isParticipant(非发起人) → [退出活动]
  it('should show leave button for participant when status is open', () => {
    mockCurrentUserId = 'participant-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'open' },
    };
    renderPage();

    expect(screen.getByRole('button', { name: /退出/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /加入/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /编辑/i })).not.toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.2 — status=full, isParticipant(非发起人) → [退出活动]
  it('should show leave button for participant when status is full', () => {
    mockCurrentUserId = 'participant-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'full' },
    };
    renderPage();

    expect(screen.getByRole('button', { name: /退出/i })).toBeInTheDocument();
  });

  // =========================================================================
  // 操作按钮显示逻辑 — 当前用户未加入
  // =========================================================================

  // 来源: web-app-activity.md §6.2 — status=open, 未加入 → [加入活动]
  it('should show join button for non-participant when status is open', () => {
    mockCurrentUserId = 'other-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'open' },
    };
    renderPage();

    expect(screen.getByRole('button', { name: /加入/i })).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.2 — status=full, 未加入 → [已满员]（禁用态）
  it('should show disabled full button for non-participant when status is full', () => {
    mockCurrentUserId = 'other-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'full' },
    };
    renderPage();

    const fullButton = screen.getByRole('button', { name: /已满员/i });
    expect(fullButton).toBeInTheDocument();
    expect(fullButton).toBeDisabled();
  });

  // =========================================================================
  // 操作按钮显示逻辑 — 活动已结束
  // =========================================================================

  // 来源: web-app-activity.md §6.2 — status=completed, isParticipant → [录入战绩]
  it('should show record match button for participant when status is completed', () => {
    mockCurrentUserId = 'participant-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'completed' },
    };
    renderPage();

    expect(screen.getByRole('button', { name: /录入战绩/i })).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.2 — status=completed, 未加入 → 无操作按钮
  it('should not show action buttons for non-participant when status is completed', () => {
    mockCurrentUserId = 'other-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'completed' },
    };
    renderPage();

    expect(screen.queryByRole('button', { name: /录入战绩/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /加入/i })).not.toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.2 — status=in_progress, isParticipant → 显示提示文案
  it('should show in-progress message for participant when status is in_progress', () => {
    mockCurrentUserId = 'participant-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'in_progress' },
    };
    renderPage();

    expect(screen.getByText(/活动进行中.*结束后可录入战绩/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /录入/i })).not.toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.2 — status=in_progress, 非参与者 → 无提示
  it('should not show any action or message for non-participant when status is in_progress', () => {
    mockCurrentUserId = 'other-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'in_progress' },
    };
    renderPage();

    expect(screen.queryByText(/活动进行中/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /加入/i })).not.toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.2 — status=cancelled → 无操作按钮
  it('should not show action buttons when status is cancelled', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'cancelled' },
    };
    renderPage();

    expect(screen.queryByRole('button', { name: /加入/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /退出/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /编辑/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /取消活动/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // 加入活动交互
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 交互流程 — 加入活动
  it('should call joinActivity when join button is clicked', async () => {
    const user = userEvent.setup();
    mockCurrentUserId = 'other-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'open' },
    };
    renderPage();

    await user.click(screen.getByRole('button', { name: /加入/i }));

    expect(mockJoinActivity).toHaveBeenCalled();
  });

  // =========================================================================
  // 退出活动交互
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 交互流程 — 退出活动（需确认弹窗）
  it('should show confirm dialog when leave button is clicked', async () => {
    const user = userEvent.setup();
    mockCurrentUserId = 'participant-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'open' },
    };
    renderPage();

    await user.click(screen.getByRole('button', { name: /退出/i }));

    // 确认弹窗应可见
    expect(screen.getByText(/确认|确定/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 取消活动交互
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 交互流程 — 取消活动（需确认弹窗）
  it('should show confirm dialog with warning when cancel button is clicked', async () => {
    const user = userEvent.setup();
    mockCurrentUserId = 'creator-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'open' },
    };
    renderPage();

    await user.click(screen.getByRole('button', { name: /取消活动/i }));

    // 确认弹窗应显示警告文案
    expect(screen.getByText(/不可恢复|通知/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 编辑模式
  // =========================================================================

  // 来源: web-app-activity.md §6.7 — 活动编辑模式的进入
  it('should enter edit mode when edit button is clicked by creator', async () => {
    const user = userEvent.setup();
    mockCurrentUserId = 'creator-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'open' },
    };
    renderPage();

    await user.click(screen.getByRole('button', { name: /编辑/i }));

    // 编辑模式下应显示保存和取消编辑按钮
    expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取消编辑/i })).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.7 — 活动编辑模式的退出 — 取消编辑
  it('should exit edit mode when cancel edit is clicked', async () => {
    const user = userEvent.setup();
    mockCurrentUserId = 'creator-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'open' },
    };
    renderPage();

    // 进入编辑模式
    await user.click(screen.getByRole('button', { name: /编辑/i }));
    expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument();

    // 退出编辑模式
    await user.click(screen.getByRole('button', { name: /取消编辑/i }));

    // 应恢复为查看模式
    expect(screen.getByRole('button', { name: /编辑/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /保存/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // 录入战绩导航
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 交互流程 — 录入战绩
  it('should navigate to create match record page with sourceType and sourceId', async () => {
    const user = userEvent.setup();
    mockCurrentUserId = 'participant-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'completed' },
    };
    renderPage();

    await user.click(screen.getByRole('button', { name: /录入战绩/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/match-records/create?sourceType=activity&sourceId=activity-uuid-1',
    );
  });

  // =========================================================================
  // 战绩列表
  // =========================================================================

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 组件结构 — MatchRecordSection
  it('should render match records when available', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'completed' },
    };
    mockMatchRecordsState = {
      ...mockMatchRecordsState,
      data: [mockMatchRecord],
    };
    renderPage();

    // 战绩卡片应显示选手信息和比分
    expect(screen.getByText('选手A')).toBeInTheDocument();
    expect(screen.getByText('选手B')).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 组件结构 — EmptyState（无战绩）
  it('should show empty state when no match records', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'completed' },
    };
    mockMatchRecordsState = {
      ...mockMatchRecordsState,
      data: [],
    };
    renderPage();

    expect(screen.getByText(/暂无战绩/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 战绩删除
  // =========================================================================

  // 来源: web-app-activity.md §6.6 — 战绩列表中的删除权限判断
  it('should show delete icon on match record recorded by current user', () => {
    mockCurrentUserId = 'current-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'completed' },
    };
    mockMatchRecordsState = {
      ...mockMatchRecordsState,
      data: [mockMatchRecord],
    };
    renderPage();

    // 当前用户录入的战绩应有删除按钮
    expect(screen.getByRole('button', { name: /删除/i })).toBeInTheDocument();
  });

  // 来源: web-app-activity.md §6.6 — recordedBy !== currentUser.id 时不显示删除图标
  it('should not show delete icon on match record recorded by another user', () => {
    mockCurrentUserId = 'other-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'completed' },
    };
    mockMatchRecordsState = {
      ...mockMatchRecordsState,
      data: [mockMatchRecord],
    };
    renderPage();

    expect(screen.queryByRole('button', { name: /删除/i })).not.toBeInTheDocument();
  });

  // 来源: web-app-activity.md §2 — ActivityDetailPage — 交互流程 — 删除战绩（需确认弹窗）
  it('should show confirm dialog when delete match record button is clicked', async () => {
    const user = userEvent.setup();
    mockCurrentUserId = 'current-user-id';
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'completed' },
    };
    mockMatchRecordsState = {
      ...mockMatchRecordsState,
      data: [mockMatchRecord],
    };
    renderPage();

    await user.click(screen.getByRole('button', { name: /删除/i }));

    // 确认弹窗应可见
    expect(screen.getByText(/确认|确定/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 比分展示
  // =========================================================================

  // 来源: web-app-activity.md §3 — ScoreDisplay — 每局比分
  it('should render game scores in match record card', () => {
    mockActivityDetailState = {
      ...mockActivityDetailState,
      data: { ...mockActivityDetail, status: 'completed' },
    };
    mockMatchRecordsState = {
      ...mockMatchRecordsState,
      data: [mockMatchRecord],
    };
    renderPage();

    // 第一局 21:18
    expect(screen.getByText(/21.*18/)).toBeInTheDocument();
  });
});
