/**
 * 契约测试: web-app/coaching — GroupClassDetailPage 页面渲染
 * 覆盖页面: GroupClassDetailPage (/group-classes/:id)
 *
 * 来源文档:
 *   - docs/module-design/web-app-coaching.md §2 — GroupClassDetailPage 页面
 *   - docs/module-design/web-app-coaching.md §3 — Feature 私有组件
 *   - docs/module-design/web-app-coaching.md §6.3 — 团课详情操作按钮逻辑
 *
 * Mock 策略:
 *   - Mock hooks（useGroupClassDetail, useEnrollGroupClass, useCancelEnrollment, useGroupClassMatchRecords）的返回值
 *   - Mock react-router-dom 导航和 useParams
 *   - Mock authStore 获取当前用户 ID
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
    useParams: () => ({ id: 'gc-uuid-1' }),
  };
});

// Mock authStore — default: a normal user (not the coach)
let currentUserId = 'current-user-id';
vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-token',
      userId: currentUserId,
      isLoggedIn: true,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

// Mock useGroupClassDetail hook
let mockGroupClassDetailState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useGroupClassDetail', () => ({
  useGroupClassDetail: () => mockGroupClassDetailState,
}));

// Mock useEnrollGroupClass hook
const mockEnrollMutate = vi.fn();
let mockEnrollState = {
  mutate: mockEnrollMutate,
  isPending: false,
};

vi.mock('@web/features/coaching/hooks/useEnrollGroupClass', () => ({
  useEnrollGroupClass: () => mockEnrollState,
}));

// Mock useCancelEnrollment hook
const mockCancelEnrollMutate = vi.fn();
let mockCancelEnrollState = {
  mutate: mockCancelEnrollMutate,
  isPending: false,
};

vi.mock('@web/features/coaching/hooks/useCancelEnrollment', () => ({
  useCancelEnrollment: () => mockCancelEnrollState,
}));

// Mock useGroupClassMatchRecords hook
let mockMatchRecordsState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useGroupClassMatchRecords', () => ({
  useGroupClassMatchRecords: () => mockMatchRecordsState,
}));

// Mock useDeleteMatchRecord hook (coaching-local, invalidates group-class-match-records)
const mockDeleteRecordMutate = vi.fn();
vi.mock('@web/features/coaching/hooks/useDeleteMatchRecord', () => ({
  useDeleteMatchRecord: () => ({
    mutate: mockDeleteRecordMutate,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { GroupClassDetailPage } from '@web/features/coaching/pages/GroupClassDetailPage';

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

const mockGroupClassOpen = {
  id: 'gc-uuid-1',
  coachId: 'coach-uuid-1',
  coach: { id: 'coach-uuid-1', nickname: '教练张', avatarUrl: null },
  title: '初级单打提升班',
  venue: mockVenue,
  startTime: '2026-04-10T14:00:00.000Z',
  endTime: '2026-04-10T16:00:00.000Z',
  maxParticipants: 10,
  currentParticipants: 5,
  feeDescription: '200元/人',
  status: 'open',
  enrollments: [
    {
      userId: 'user-uuid-1',
      nickname: '羽球达人',
      avatarUrl: null,
      enrolledAt: '2026-04-03T09:00:00.000Z',
    },
  ],
  createdAt: '2026-04-02T10:00:00.000Z',
};

const mockGroupClassEnrolled = {
  ...mockGroupClassOpen,
  enrollments: [
    ...mockGroupClassOpen.enrollments,
    {
      userId: 'current-user-id',
      nickname: '当前用户',
      avatarUrl: null,
      enrolledAt: '2026-04-04T09:00:00.000Z',
    },
  ],
  currentParticipants: 6,
};

const mockGroupClassFull = {
  ...mockGroupClassOpen,
  status: 'full',
  currentParticipants: 10,
};

const mockGroupClassFullEnrolled = {
  ...mockGroupClassFull,
  enrollments: [
    ...mockGroupClassOpen.enrollments,
    {
      userId: 'current-user-id',
      nickname: '当前用户',
      avatarUrl: null,
      enrolledAt: '2026-04-04T09:00:00.000Z',
    },
  ],
};

const mockGroupClassCompleted = {
  ...mockGroupClassOpen,
  status: 'completed',
};

const mockGroupClassCancelled = {
  ...mockGroupClassOpen,
  status: 'cancelled',
};

const mockGroupClassInProgress = {
  ...mockGroupClassOpen,
  status: 'in_progress',
};

const mockMatchRecord = {
  id: 'mr-uuid-1',
  sourceType: 'group-class',
  sourceId: 'gc-uuid-1',
  matchType: 'singles',
  recordedBy: 'current-user-id',
  recorder: { id: 'current-user-id', nickname: '当前用户', avatarUrl: null },
  players: {
    sideA: [{ userId: 'user-uuid-1', nickname: '张三', avatarUrl: null }],
    sideB: [{ userId: 'user-uuid-2', nickname: '李四', avatarUrl: null }],
  },
  games: [{ gameNumber: 1, scoreA: 21, scoreB: 19 }],
  result: 'A_WIN',
  createdAt: '2026-04-06T20:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<GroupClassDetailPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GroupClassDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserId = 'current-user-id';
    mockGroupClassDetailState = { data: null, isLoading: false, error: null };
    mockEnrollState = { mutate: mockEnrollMutate, isPending: false };
    mockCancelEnrollState = { mutate: mockCancelEnrollMutate, isPending: false };
    mockMatchRecordsState = { data: null, isLoading: false, error: null };
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 页面状态 — isLoading
  it('should show loading spinner when data is loading', () => {
    mockGroupClassDetailState = { data: null, isLoading: true, error: null };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  it('should render back button and navigate back when clicked', async () => {
    const user = userEvent.setup();
    mockGroupClassDetailState = { data: mockGroupClassOpen, isLoading: false, error: null };
    renderPage();

    const backButton = screen.getByRole('button', { name: /返回/i });
    expect(backButton).toBeInTheDocument();

    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 调用的后端接口 — 错误处理
  it('should show error state when loading fails', () => {
    mockGroupClassDetailState = {
      data: null,
      isLoading: false,
      error: new Error('团课不存在'),
    };
    renderPage();

    expect(screen.getByText(/错误|失败|不存在/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 基本信息渲染
  // =========================================================================

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 组件结构 — GroupClassInfo
  it('should render group class title and basic info', () => {
    mockGroupClassDetailState = { data: mockGroupClassOpen, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
    expect(screen.getByText(/朝阳体育中心羽毛球馆/)).toBeInTheDocument();
    expect(screen.getByText(/200元\/人/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 组件结构 — CoachBrief
  it('should render coach info with click navigation', async () => {
    mockGroupClassDetailState = { data: mockGroupClassOpen, isLoading: false, error: null };
    renderPage();

    const coachName = screen.getByText('教练张');
    expect(coachName).toBeInTheDocument();
    await userEvent.click(coachName);

    expect(mockNavigate).toHaveBeenCalledWith('/coaches/coach-uuid-1');
  });

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 组件结构 — ClassDetailFields (人数)
  it('should render participant count', () => {
    mockGroupClassDetailState = { data: mockGroupClassOpen, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/5\/10/)).toBeInTheDocument();
  });

  // =========================================================================
  // 报名学员列表
  // =========================================================================

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 组件结构 — EnrollmentList
  it('should render enrollment list', () => {
    mockGroupClassDetailState = { data: mockGroupClassOpen, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText('羽球达人')).toBeInTheDocument();
  });

  // =========================================================================
  // 操作按钮逻辑 — open 状态未报名
  // =========================================================================

  // 来源: web-app-coaching.md §6.3 — status=open && !isEnrolled → "报名"按钮
  it('should show enroll button when open and not enrolled', () => {
    mockGroupClassDetailState = { data: mockGroupClassOpen, isLoading: false, error: null };
    renderPage();

    const enrollButton = screen.getByRole('button', { name: /报名/i });
    expect(enrollButton).toBeInTheDocument();
    expect(enrollButton).toBeEnabled();
  });

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 交互流程 — 报名
  it('should call enroll mutation when enroll button is clicked', async () => {
    mockGroupClassDetailState = { data: mockGroupClassOpen, isLoading: false, error: null };
    renderPage();

    const enrollButton = screen.getByRole('button', { name: /报名/i });
    await userEvent.click(enrollButton);

    expect(mockEnrollMutate).toHaveBeenCalled();
  });

  // =========================================================================
  // 操作按钮逻辑 — open/full 状态已报名
  // =========================================================================

  // 来源: web-app-coaching.md §6.3 — status=open && isEnrolled → "取消报名"按钮
  it('should show cancel enrollment button when open and enrolled', () => {
    mockGroupClassDetailState = { data: mockGroupClassEnrolled, isLoading: false, error: null };
    renderPage();

    const cancelButton = screen.getByRole('button', { name: /取消报名/i });
    expect(cancelButton).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 交互流程 — 取消报名 (确认弹窗)
  it('should show confirm dialog when cancel enrollment button is clicked', async () => {
    mockGroupClassDetailState = { data: mockGroupClassEnrolled, isLoading: false, error: null };
    renderPage();

    const cancelButton = screen.getByRole('button', { name: /取消报名/i });
    await userEvent.click(cancelButton);

    // Confirm dialog should appear
    expect(screen.getByText(/确认|确定/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §6.3 — status=full && isEnrolled → "取消报名"按钮
  it('should show cancel enrollment button when full and enrolled', () => {
    mockGroupClassDetailState = { data: mockGroupClassFullEnrolled, isLoading: false, error: null };
    renderPage();

    const cancelButton = screen.getByRole('button', { name: /取消报名/i });
    expect(cancelButton).toBeInTheDocument();
  });

  // =========================================================================
  // 操作按钮逻辑 — full 状态未报名
  // =========================================================================

  // 来源: web-app-coaching.md §6.3 — status=full && !isEnrolled → "已满员"按钮（灰色不可点击）
  it('should show disabled full button when full and not enrolled', () => {
    mockGroupClassDetailState = { data: mockGroupClassFull, isLoading: false, error: null };
    renderPage();

    const fullButton = screen.getByRole('button', { name: /已满员/i });
    expect(fullButton).toBeInTheDocument();
    expect(fullButton).toBeDisabled();
  });

  // =========================================================================
  // 操作按钮逻辑 — 教练本人
  // =========================================================================

  // 来源: web-app-coaching.md §6.3 — currentUserId === coachId → 无操作按钮
  it('should not show action buttons when current user is the coach', () => {
    currentUserId = 'coach-uuid-1';
    mockGroupClassDetailState = { data: mockGroupClassOpen, isLoading: false, error: null };
    renderPage();

    expect(screen.queryByRole('button', { name: /报名/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /取消报名/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // 操作按钮逻辑 — completed 状态
  // =========================================================================

  // 来源: web-app-coaching.md §6.3 — status=completed → "已结束"标签 + "录入战绩"按钮
  it('should show completed status and create record button when completed', () => {
    mockGroupClassDetailState = { data: mockGroupClassCompleted, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/已结束/i)).toBeInTheDocument();
    expect(screen.getByText(/录入战绩/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 交互流程 — 录入战绩
  it('should navigate to create match record page when button is clicked', async () => {
    mockGroupClassDetailState = { data: mockGroupClassCompleted, isLoading: false, error: null };
    renderPage();

    const createRecordButton = screen.getByText(/录入战绩/i);
    await userEvent.click(createRecordButton);

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/match-records/create'));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('sourceType=group-class'));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('sourceId=gc-uuid-1'));
  });

  // =========================================================================
  // 操作按钮逻辑 — cancelled 和 in_progress 状态
  // =========================================================================

  // 来源: web-app-coaching.md §6.3 — status=cancelled → "已取消"标签
  it('should show cancelled status label with no action buttons', () => {
    mockGroupClassDetailState = { data: mockGroupClassCancelled, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/已取消/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /报名/i })).not.toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §6.3 — status=in_progress → "进行中"标签
  it('should show in_progress status label with no action buttons', () => {
    mockGroupClassDetailState = { data: mockGroupClassInProgress, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/进行中/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /报名/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // 战绩区域 (completed 状态)
  // =========================================================================

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 组件结构 — MatchRecordSection
  it('should render match records when class is completed', () => {
    mockGroupClassDetailState = { data: mockGroupClassCompleted, isLoading: false, error: null };
    mockMatchRecordsState = {
      data: { items: [mockMatchRecord] },
      isLoading: false,
      error: null,
    };
    renderPage();

    // Match record should be visible
    expect(screen.getByText(/21.*19/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 页面状态 — 战绩仅 completed 加载
  it('should not render match records section when class is not completed', () => {
    mockGroupClassDetailState = { data: mockGroupClassOpen, isLoading: false, error: null };
    renderPage();

    expect(screen.queryByText(/战绩/i)).not.toBeInTheDocument();
  });

  // =========================================================================
  // 状态标签
  // =========================================================================

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — 组件结构 — StatusTag
  it('should render status tag for open class', () => {
    mockGroupClassDetailState = { data: mockGroupClassOpen, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/报名中|open/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — GroupClassDetailPage — venue 为 null
  it('should handle null venue gracefully', () => {
    const groupClassNullVenue = { ...mockGroupClassOpen, venue: null };
    mockGroupClassDetailState = { data: groupClassNullVenue, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
    // Should not crash, no venue info displayed
  });
});
