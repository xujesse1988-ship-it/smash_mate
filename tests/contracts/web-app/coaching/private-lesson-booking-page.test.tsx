/**
 * 契约测试: web-app/coaching — PrivateLessonBookingPage 页面渲染
 * 覆盖页面: PrivateLessonBookingPage (/coaches/:id/private-lessons)
 *
 * 来源文档:
 *   - docs/module-design/web-app-coaching.md §2 — PrivateLessonBookingPage 页面
 *   - docs/module-design/web-app-coaching.md §3 — Feature 私有组件
 *   - docs/module-design/web-app-coaching.md §6.4 — 私教预约球馆选择逻辑
 *
 * Mock 策略:
 *   - Mock hooks（useCoachAvailability, useBookPrivateLesson）的返回值
 *   - Mock react-router-dom 导航和 useParams
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
    useParams: () => ({ id: 'coach-uuid-1' }),
  };
});

// Mock authStore
vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-token',
      userId: 'current-user-id',
      isLoggedIn: true,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
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

// Mock useBookPrivateLesson hook
const mockBookMutate = vi.fn();
let mockBookState = {
  mutate: mockBookMutate,
  isPending: false,
};

vi.mock('@web/features/coaching/hooks/useBookPrivateLesson', () => ({
  useBookPrivateLesson: () => mockBookState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { PrivateLessonBookingPage } from '@web/features/coaching/pages/PrivateLessonBookingPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSlotWithVenues = {
  id: 'slot-uuid-1',
  startTime: '2026-04-11T10:00:00.000Z',
  endTime: '2026-04-11T12:00:00.000Z',
  venues: [
    { id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆', address: '北京市朝阳区...' },
    { id: 'venue-uuid-2', name: '海淀体育馆', address: '北京市海淀区...' },
  ],
  feeDescription: '300元/小时',
  isBooked: false,
};

const mockSlotWithOneVenue = {
  id: 'slot-uuid-2',
  startTime: '2026-04-12T14:00:00.000Z',
  endTime: '2026-04-12T16:00:00.000Z',
  venues: [
    { id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆', address: '北京市朝阳区...' },
  ],
  feeDescription: '300元/小时',
  isBooked: false,
};

const mockSlotNoVenue = {
  id: 'slot-uuid-3',
  startTime: '2026-04-13T09:00:00.000Z',
  endTime: '2026-04-13T11:00:00.000Z',
  venues: [],
  feeDescription: null,
  isBooked: false,
};

const mockSlotBooked = {
  id: 'slot-uuid-4',
  startTime: '2026-04-14T10:00:00.000Z',
  endTime: '2026-04-14T12:00:00.000Z',
  venues: [],
  feeDescription: null,
  isBooked: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<PrivateLessonBookingPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PrivateLessonBookingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAvailabilityState = { data: null, isLoading: false, error: null };
    mockBookState = { mutate: mockBookMutate, isPending: false };
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — PrivateLessonBookingPage — 页面状态 — isLoading
  it('should show loading spinner when data is loading', () => {
    mockAvailabilityState = { data: null, isLoading: true, error: null };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — PrivateLessonBookingPage — 调用的后端接口 — 错误处理
  it('should show error state when loading fails', () => {
    mockAvailabilityState = {
      data: null,
      isLoading: false,
      error: new Error('教练不存在'),
    };
    renderPage();

    expect(screen.getByText(/错误|失败|不存在/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 空状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — PrivateLessonBookingPage — 组件结构 — EmptyState
  it('should show empty state when no available slots', () => {
    mockAvailabilityState = {
      data: { slots: [] },
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText(/暂无/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 时间段渲染
  // =========================================================================

  // 来源: web-app-coaching.md §2 — PrivateLessonBookingPage — 组件结构 — SlotCard
  it('should render available time slots', () => {
    mockAvailabilityState = {
      data: { slots: [mockSlotWithVenues, mockSlotNoVenue] },
      isLoading: false,
      error: null,
    };
    renderPage();

    // Should render slot time ranges
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
    expect(screen.getByText(/12:00/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — PrivateLessonBookingPage — 组件结构 — FeeDescription
  it('should render fee description when available', () => {
    mockAvailabilityState = {
      data: { slots: [mockSlotWithVenues] },
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText(/300元\/小时/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — PrivateLessonBookingPage — 交互流程 — 已预约时间段
  it('should mark booked slots as not clickable', () => {
    mockAvailabilityState = {
      data: { slots: [mockSlotBooked] },
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText(/已约/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 球馆选择逻辑
  // =========================================================================

  // 来源: web-app-coaching.md §6.4 — slot.venues.length > 1 → 显示球馆选择列表
  it('should show venue selector when slot has multiple venues', async () => {
    mockAvailabilityState = {
      data: { slots: [mockSlotWithVenues] },
      isLoading: false,
      error: null,
    };
    renderPage();

    // Click to select the slot
    const slotCard = screen.getByText(/10:00/).closest('[data-testid]') ||
      screen.getByText(/10:00/).closest('div');
    if (slotCard) {
      await userEvent.click(slotCard);
    }

    // Venue selector should appear with venue names
    expect(screen.getByText('朝阳体育中心羽毛球馆')).toBeInTheDocument();
    expect(screen.getByText('海淀体育馆')).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §6.4 — slot.venues.length === 1 → 自动选中
  it('should auto-select venue when slot has only one venue', async () => {
    mockAvailabilityState = {
      data: { slots: [mockSlotWithOneVenue] },
      isLoading: false,
      error: null,
    };
    renderPage();

    // Click to select the slot
    const slotCard = screen.getByText(/14:00/).closest('[data-testid]') ||
      screen.getByText(/14:00/).closest('div');
    if (slotCard) {
      await userEvent.click(slotCard);
    }

    // Venue should be auto-selected and displayed
    expect(screen.getByText('朝阳体育中心羽毛球馆')).toBeInTheDocument();
    // Confirm button should be available
    expect(screen.getByText(/确认预约/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §6.4 — slot.venues.length === 0 → 不显示球馆选择区域
  it('should show confirm button directly when slot has no venues', async () => {
    mockAvailabilityState = {
      data: { slots: [mockSlotNoVenue] },
      isLoading: false,
      error: null,
    };
    renderPage();

    // Click to select the slot
    const slotCard = screen.getByText(/09:00/).closest('[data-testid]') ||
      screen.getByText(/09:00/).closest('div');
    if (slotCard) {
      await userEvent.click(slotCard);
    }

    // Confirm button should be directly visible without venue selector
    expect(screen.getByText(/确认预约/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 预约确认
  // =========================================================================

  // 来源: web-app-coaching.md §2 — PrivateLessonBookingPage — 交互流程 — 确认预约
  it('should show booking confirm dialog when confirm button is clicked', async () => {
    mockAvailabilityState = {
      data: { slots: [mockSlotNoVenue] },
      isLoading: false,
      error: null,
    };
    renderPage();

    // Select slot
    const slotCard = screen.getByText(/09:00/).closest('[data-testid]') ||
      screen.getByText(/09:00/).closest('div');
    if (slotCard) {
      await userEvent.click(slotCard);
    }

    // Click confirm
    const confirmButton = screen.getByText(/确认预约/i);
    await userEvent.click(confirmButton);

    // Confirm dialog should appear
    expect(screen.getByText(/确认|确定/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 日期范围选择器
  // =========================================================================

  // 来源: web-app-coaching.md §2 — PrivateLessonBookingPage — 组件结构 — DateRangePicker
  it('should render date range picker', () => {
    mockAvailabilityState = {
      data: { slots: [mockSlotWithVenues] },
      isLoading: false,
      error: null,
    };
    renderPage();

    // Date range picker should be rendered
    expect(screen.getByText(/日期|时间范围/i)).toBeInTheDocument();
  });
});
