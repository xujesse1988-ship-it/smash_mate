/**
 * 契约测试: web-app/coaching — MyCourseManagementPage 页面渲染
 * 覆盖页面: MyCourseManagementPage (/my-courses)
 *
 * 来源文档:
 *   - docs/module-design/web-app-coaching.md §2 — MyCourseManagementPage 页面
 *   - docs/module-design/web-app-coaching.md §3 — Feature 私有组件
 *   - docs/module-design/web-app-coaching.md §6.5 — 前端表单校验规则
 *   - docs/module-design/web-app-coaching.md §6.7 — 权限控制
 *
 * Mock 策略:
 *   - Mock hooks（useCoachProfile, useCoachAvailability, useCoachPrivateLessons,
 *     useCreateGroupClass, useUpdateGroupClass, useCancelGroupClass,
 *     useSetAvailability, useCancelPrivateLesson）的返回值
 *   - Mock react-router-dom 导航
 *   - Mock authStore（教练角色）
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
  };
});

// Mock authStore — coach user
vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-token',
      userId: 'coach-uuid-1',
      isLoggedIn: true,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

// Mock useCurrentUser hook (coach role)
let mockCurrentUserState = {
  data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张' } as unknown,
  isLoading: false,
};

vi.mock('@web/shared/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUserState,
}));

// Mock useCoachProfile hook (for coach's own data)
let mockCoachProfileState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useCoachProfile', () => ({
  useCoachProfile: () => mockCoachProfileState,
}));

// Mock useCoachAvailability hook
let mockAvailabilityState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useCoachAvailability', () => ({
  useCoachAvailability: () => mockAvailabilityState,
}));

// Mock useCoachPrivateLessons hook
let mockPrivateLessonsState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useCoachPrivateLessons', () => ({
  useCoachPrivateLessons: () => mockPrivateLessonsState,
}));

// Mock mutation hooks
const mockCreateGroupClass = vi.fn();
const mockUpdateGroupClass = vi.fn();
const mockCancelGroupClass = vi.fn();
const mockSetAvailability = vi.fn();
const mockCancelPrivateLesson = vi.fn();

vi.mock('@web/features/coaching/hooks/useCreateGroupClass', () => ({
  useCreateGroupClass: () => ({ mutate: mockCreateGroupClass, isPending: false }),
}));

vi.mock('@web/features/coaching/hooks/useUpdateGroupClass', () => ({
  useUpdateGroupClass: () => ({ mutate: mockUpdateGroupClass, isPending: false }),
}));

vi.mock('@web/features/coaching/hooks/useCancelGroupClass', () => ({
  useCancelGroupClass: () => ({ mutate: mockCancelGroupClass, isPending: false }),
}));

vi.mock('@web/features/coaching/hooks/useSetAvailability', () => ({
  useSetAvailability: () => ({ mutate: mockSetAvailability, isPending: false }),
}));

vi.mock('@web/features/coaching/hooks/useCancelPrivateLesson', () => ({
  useCancelPrivateLesson: () => ({ mutate: mockCancelPrivateLesson, isPending: false }),
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { MyCourseManagementPage } from '@web/features/coaching/pages/MyCourseManagementPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSlotVenue = {
  id: 'venue-uuid-1',
  name: '朝阳体育中心羽毛球馆',
  address: '北京市朝阳区...',
};

const mockCoachProfileData = {
  userId: 'coach-uuid-1',
  nickname: '教练张',
  avatarUrl: null,
  bio: '10年教学经验',
  specialties: ['singles'],
  studentCount: 42,
  groupClasses: [
    {
      id: 'gc-uuid-1',
      title: '初级单打提升班',
      startTime: '2026-04-10T14:00:00.000Z',
      endTime: '2026-04-10T16:00:00.000Z',
      venue: mockSlotVenue,
      maxParticipants: 10,
      currentParticipants: 5,
      feeDescription: '200元/人',
      status: 'open',
    },
    {
      id: 'gc-uuid-2',
      title: '已取消的课程',
      startTime: '2026-04-08T14:00:00.000Z',
      endTime: '2026-04-08T16:00:00.000Z',
      venue: mockSlotVenue,
      maxParticipants: 8,
      currentParticipants: 3,
      feeDescription: null,
      status: 'cancelled',
    },
  ],
  privateLessonSlots: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockAvailabilitySlot = {
  id: 'slot-uuid-1',
  startTime: '2026-04-11T10:00:00.000Z',
  endTime: '2026-04-11T12:00:00.000Z',
  venues: [mockSlotVenue],
  feeDescription: '300元/小时',
  isBooked: false,
};

const mockBookedSlot = {
  id: 'slot-uuid-2',
  startTime: '2026-04-12T14:00:00.000Z',
  endTime: '2026-04-12T16:00:00.000Z',
  venues: [],
  feeDescription: null,
  isBooked: true,
};

const mockPrivateLesson = {
  id: 'pl-uuid-1',
  slot: {
    startTime: '2026-04-12T14:00:00.000Z',
    endTime: '2026-04-12T16:00:00.000Z',
  },
  venue: mockSlotVenue,
  student: {
    id: 'user-uuid-1',
    nickname: '羽球达人',
    avatarUrl: null,
  },
  status: 'scheduled',
  createdAt: '2026-04-03T10:00:00.000Z',
};

const mockCompletedPrivateLesson = {
  ...mockPrivateLesson,
  id: 'pl-uuid-2',
  status: 'completed',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<MyCourseManagementPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MyCourseManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserState = {
      data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张' },
      isLoading: false,
    };
    mockCoachProfileState = { data: null, isLoading: false, error: null };
    mockAvailabilityState = { data: null, isLoading: false, error: null };
    mockPrivateLessonsState = { data: null, isLoading: false, error: null };
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 页面状态 — isLoading
  it('should show loading spinner when data is loading', () => {
    mockCoachProfileState = { data: null, isLoading: true, error: null };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // =========================================================================
  // Tab 结构
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 页面状态 — activeTab
  it('should render three tabs: group classes, private schedule, private lessons', () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/团课/i)).toBeInTheDocument();
    expect(screen.getByText(/私教时间/i)).toBeInTheDocument();
    expect(screen.getByText(/私教预约/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 团课管理 Tab
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 组件结构 — CreateClassButton
  it('should render "发布团课" button', () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/发布团课/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 组件结构 — ManageableGroupClassCard
  it('should render group class cards with management buttons', () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
    // Open status class should have edit and cancel buttons
    expect(screen.getByText(/修改/i)).toBeInTheDocument();
    expect(screen.getByText(/取消/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 交互流程 — 修改/取消按钮仅 open/full 显示
  it('should not show edit/cancel buttons for cancelled classes', () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    renderPage();

    // The cancelled class should not have edit/cancel buttons
    // Count total modify buttons — should be 1 (only for open class)
    const modifyButtons = screen.getAllByText(/修改/i);
    expect(modifyButtons).toHaveLength(1);
  });

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 交互流程 — 发布团课
  it('should open create group class modal when button is clicked', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    renderPage();

    const createButton = screen.getByText(/发布团课/i);
    await userEvent.click(createButton);

    // Modal should appear with form fields
    expect(screen.getByText(/课程名称/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 交互流程 — 取消团课 (确认弹窗)
  it('should show confirm dialog when cancel class button is clicked', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    renderPage();

    // Click the cancel button for the open class
    const cancelButtons = screen.getAllByText(/取消/i);
    // The first one should be the cancel button for the open class
    await userEvent.click(cancelButtons[0]);

    // Confirm dialog should appear
    expect(screen.getByText(/确认|确定/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 组件结构 — EmptyState
  it('should show empty state when no group classes', () => {
    const emptyProfile = { ...mockCoachProfileData, groupClasses: [] };
    mockCoachProfileState = { data: emptyProfile, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/暂无/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 私教时间设置 Tab
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 交互流程 — 私教时间设置 Tab
  it('should render slot list when switching to private schedule tab', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    mockAvailabilityState = {
      data: { slots: [mockAvailabilitySlot, mockBookedSlot] },
      isLoading: false,
      error: null,
    };
    renderPage();

    // Click private schedule tab
    const scheduleTab = screen.getByText(/私教时间/i);
    await userEvent.click(scheduleTab);

    // Should render the add slot button
    expect(screen.getByText(/添加时间段/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 组件结构 — ManageableSlotCard
  it('should render slot cards with booking status', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    mockAvailabilityState = {
      data: { slots: [mockAvailabilitySlot, mockBookedSlot] },
      isLoading: false,
      error: null,
    };
    renderPage();

    const scheduleTab = screen.getByText(/私教时间/i);
    await userEvent.click(scheduleTab);

    // Should show booking status
    expect(screen.getByText(/可预约|空闲/i)).toBeInTheDocument();
    expect(screen.getByText(/已约|已预约/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 交互流程 — 添加私教时间
  it('should open add slot modal when button is clicked', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    mockAvailabilityState = {
      data: { slots: [] },
      isLoading: false,
      error: null,
    };
    renderPage();

    const scheduleTab = screen.getByText(/私教时间/i);
    await userEvent.click(scheduleTab);

    const addButton = screen.getByText(/添加时间段/i);
    await userEvent.click(addButton);

    // Modal should appear with time inputs
    expect(screen.getByText(/开始时间/i)).toBeInTheDocument();
    expect(screen.getByText(/结束时间/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 私教预约管理 Tab
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 交互流程 — 私教预约管理 Tab
  it('should render private lesson list when switching to private lessons tab', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    mockPrivateLessonsState = {
      data: { items: [mockPrivateLesson], total: 1, page: 1, pageSize: 20 },
      isLoading: false,
      error: null,
    };
    renderPage();

    // Click private lessons tab
    const lessonsTab = screen.getByText(/私教预约/i);
    await userEvent.click(lessonsTab);

    // Should render the private lesson card
    expect(screen.getByText('羽球达人')).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 组件结构 — PrivateLessonCard (取消按钮)
  it('should show cancel button for scheduled private lessons', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    mockPrivateLessonsState = {
      data: { items: [mockPrivateLesson], total: 1, page: 1, pageSize: 20 },
      isLoading: false,
      error: null,
    };
    renderPage();

    const lessonsTab = screen.getByText(/私教预约/i);
    await userEvent.click(lessonsTab);

    // Scheduled private lesson should have cancel button
    expect(screen.getByText(/取消/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 交互流程 — 取消私教预约 (确认弹窗)
  it('should show confirm dialog when cancel private lesson button is clicked', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    mockPrivateLessonsState = {
      data: { items: [mockPrivateLesson], total: 1, page: 1, pageSize: 20 },
      isLoading: false,
      error: null,
    };
    renderPage();

    const lessonsTab = screen.getByText(/私教预约/i);
    await userEvent.click(lessonsTab);

    const cancelButton = screen.getByText(/取消/i);
    await userEvent.click(cancelButton);

    // Confirm dialog should appear
    expect(screen.getByText(/确认|确定/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 交互流程 — 取消按钮仅 scheduled 显示
  it('should not show cancel button for completed private lessons', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    mockPrivateLessonsState = {
      data: { items: [mockCompletedPrivateLesson], total: 1, page: 1, pageSize: 20 },
      isLoading: false,
      error: null,
    };
    renderPage();

    const lessonsTab = screen.getByText(/私教预约/i);
    await userEvent.click(lessonsTab);

    // Completed private lesson should not have cancel button
    expect(screen.queryByRole('button', { name: /取消/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // 团课查看详情
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 交互流程 — 查看团课详情
  it('should navigate to group class detail when card is clicked', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    renderPage();

    const classCard = screen.getByText('初级单打提升班').closest('[data-testid]') ||
      screen.getByText('初级单打提升班').closest('div');
    if (classCard) {
      await userEvent.click(classCard);
    }

    expect(mockNavigate).toHaveBeenCalledWith('/group-classes/gc-uuid-1');
  });

  // =========================================================================
  // 修改团课弹窗交互
  // =========================================================================

  // 来源: web-app-coaching.md §2 — MyCourseManagementPage — 交互流程 — 修改团课
  it('should open edit group class modal with pre-filled values when modify button is clicked', async () => {
    mockCoachProfileState = { data: mockCoachProfileData, isLoading: false, error: null };
    renderPage();

    const modifyButton = screen.getByText(/修改/i);
    await userEvent.click(modifyButton);

    // Edit modal should appear with pre-filled course name
    expect(screen.getByDisplayValue('初级单打提升班')).toBeInTheDocument();
  });

  // =========================================================================
  // CoachGuard — 非教练用户场景
  // =========================================================================

  // 来源: web-app-coaching.md §6.7 — 权限控制 — CoachGuard 非教练用户
  it('should show coach role required prompt when user is not a coach', () => {
    mockCurrentUserState = {
      data: { id: 'user-uuid-1', isCoach: false, nickname: '普通用户' },
      isLoading: false,
    };
    renderPage();

    // Should prompt user to enable coach role
    expect(screen.getByText(/教练角色|需要教练/i)).toBeInTheDocument();
  });
});
