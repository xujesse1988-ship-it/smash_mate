/**
 * 契约测试: web-app/coaching — CoachProfilePage 页面渲染
 * 覆盖页面: CoachProfilePage (/coaches/:id)
 *
 * 来源文档:
 *   - docs/module-design/web-app-coaching.md §2 — CoachProfilePage 页面
 *   - docs/module-design/web-app-coaching.md §3 — Feature 私有组件
 *   - docs/module-design/web-app-coaching.md §6.2 — 教练主页数据聚合逻辑
 *   - docs/module-design/web-app-coaching.md §6.6 — 评价提交资格判断
 *
 * Mock 策略:
 *   - Mock hooks（useCoachProfile, useCoachRating, useCoachReviews, useSubmitReview）的返回值
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

// Mock useCoachProfile hook
let mockCoachProfileState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/coaching/hooks/useCoachProfile', () => ({
  useCoachProfile: () => mockCoachProfileState,
}));

// Mock useCoachRating hook
let mockCoachRatingState = {
  data: null as unknown,
  isLoading: false,
};

vi.mock('@web/features/coaching/hooks/useCoachRating', () => ({
  useCoachRating: () => mockCoachRatingState,
}));

// Mock useCoachReviews hook
const mockFetchNextReviewPage = vi.fn();
let mockCoachReviewsState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
  hasNextPage: false,
  fetchNextPage: mockFetchNextReviewPage,
  isFetchingNextPage: false,
};

vi.mock('@web/features/coaching/hooks/useCoachReviews', () => ({
  useCoachReviews: () => mockCoachReviewsState,
}));

// Mock useSubmitReview hook
const mockSubmitReview = vi.fn();
let mockSubmitReviewState = {
  mutate: mockSubmitReview,
  isPending: false,
};

vi.mock('@web/features/coaching/hooks/useSubmitReview', () => ({
  useSubmitReview: () => mockSubmitReviewState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { CoachProfilePage } from '@web/features/coaching/pages/CoachProfilePage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCoachProfile = {
  userId: 'coach-uuid-1',
  nickname: '教练张',
  avatarUrl: 'https://example.com/avatar.jpg',
  bio: '10年教学经验，擅长单打技术',
  specialties: ['singles', 'footwork'],
  studentCount: 42,
  groupClasses: [
    {
      id: 'gc-uuid-1',
      title: '初级单打提升班',
      startTime: '2026-04-10T14:00:00.000Z',
      endTime: '2026-04-10T16:00:00.000Z',
      venue: { id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆', address: '北京市朝阳区...' },
      maxParticipants: 10,
      currentParticipants: 5,
      feeDescription: '200元/人',
      status: 'open',
    },
    {
      id: 'gc-uuid-2',
      title: '高级战术课',
      startTime: '2026-03-15T14:00:00.000Z',
      endTime: '2026-03-15T16:00:00.000Z',
      venue: { id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆', address: '北京市朝阳区...' },
      maxParticipants: 8,
      currentParticipants: 8,
      feeDescription: '300元/人',
      status: 'completed',
    },
  ],
  privateLessonSlots: [
    {
      id: 'slot-uuid-1',
      startTime: '2026-04-11T10:00:00.000Z',
      endTime: '2026-04-11T12:00:00.000Z',
      venues: [{ id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆', address: '北京市朝阳区...' }],
      feeDescription: '300元/小时',
      isBooked: false,
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockRating = {
  coachId: 'coach-uuid-1',
  averageRating: 4.5,
  totalCount: 15,
};

const mockReview = {
  id: 'review-uuid-1',
  reviewer: { id: 'user-uuid-2', nickname: '张三', avatarUrl: null },
  courseType: 'group-class',
  courseId: 'gc-uuid-2',
  rating: 5,
  comment: '教练讲解很细致，推荐！',
  createdAt: '2026-04-02T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<CoachProfilePage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CoachProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCoachProfileState = {
      data: null,
      isLoading: false,
      error: null,
    };
    mockCoachRatingState = {
      data: null,
      isLoading: false,
    };
    mockCoachReviewsState = {
      data: null,
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextReviewPage,
      isFetchingNextPage: false,
    };
    mockSubmitReviewState = {
      mutate: mockSubmitReview,
      isPending: false,
    };
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 页面状态 — isCoachLoading
  it('should show loading spinner when coach data is loading', () => {
    mockCoachProfileState = { ...mockCoachProfileState, isLoading: true };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 调用的后端接口 — GET /api/coaches/:id 错误处理
  it('should show error state when coach data loading fails', () => {
    mockCoachProfileState = {
      ...mockCoachProfileState,
      error: new Error('教练不存在'),
    };
    renderPage();

    expect(screen.getByText(/错误|失败|不存在/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 教练基本信息渲染
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 组件结构 — CoachInfoHeader
  it('should render coach nickname and bio', () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText('教练张')).toBeInTheDocument();
    expect(screen.getByText('10年教学经验，擅长单打技术')).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 组件结构 — SpecialtyTagList
  it('should render specialty tags', () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/单打/i)).toBeInTheDocument();
    expect(screen.getByText(/步法/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §6.2 — 教练主页数据聚合逻辑 — 评分显示规则
  it('should render rating display with value and review count', () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    mockCoachRatingState = { data: mockRating, isLoading: false };
    renderPage();

    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §6.2 — 教练主页数据聚合逻辑 — 评分显示规则 (null)
  it('should show "暂无评价" when no rating', () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    mockCoachRatingState = {
      data: { coachId: 'coach-uuid-1', averageRating: null, totalCount: 0 },
      isLoading: false,
    };
    renderPage();

    expect(screen.getByText(/暂无评价/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 组件结构 — StudentCountDisplay
  it('should render student count', () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  // =========================================================================
  // Tab 切换
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 页面状态 — activeTab
  it('should render tabs for courses and reviews', () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/课程/i)).toBeInTheDocument();
    expect(screen.getByText(/评价/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 课程 Tab — 团课列表
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 组件结构 — GroupClassSection
  it('should render group class cards in courses tab', () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 组件结构 — GroupClassCard (人数)
  it('should render group class participant count', () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/5\/10/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 交互流程 — 查看团课详情
  it('should navigate to group class detail page when card is clicked', async () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    const groupClassCard = screen.getByText('初级单打提升班').closest('[data-testid]') ||
      screen.getByText('初级单打提升班').closest('div');
    if (groupClassCard) {
      await userEvent.click(groupClassCard);
    }

    expect(mockNavigate).toHaveBeenCalledWith('/group-classes/gc-uuid-1');
  });

  // =========================================================================
  // 课程 Tab — 私教概览
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 组件结构 — PrivateLessonSection
  it('should render private lesson section with available slots count', () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    // 应显示可预约的时间段数量
    expect(screen.getByText(/1/)).toBeInTheDocument();
    expect(screen.getByText(/预约私教/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 交互流程 — 预约私教
  it('should navigate to private lesson booking page when button is clicked', async () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    const bookButton = screen.getByText(/预约私教/i);
    await userEvent.click(bookButton);

    expect(mockNavigate).toHaveBeenCalledWith('/coaches/coach-uuid-1/private-lessons');
  });

  // =========================================================================
  // 评价 Tab
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 交互流程 — Tab 切换
  it('should load and render reviews when reviews tab is clicked', async () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    mockCoachReviewsState = {
      data: { pages: [{ items: [mockReview], total: 1 }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextReviewPage,
      isFetchingNextPage: false,
    };
    renderPage();

    // Click the reviews tab
    const reviewsTab = screen.getByText(/评价/i);
    await userEvent.click(reviewsTab);

    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText(/教练讲解很细致/)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §6.6 — 评价提交资格判断 — "写评价"按钮显示条件
  it('should show write review button when user is not the coach', () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    // Current user (current-user-id) is not the coach (coach-uuid-1), so button should appear
    expect(screen.getByText(/写评价|评价/i)).toBeInTheDocument();
  });

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 交互流程 — 提交评价
  it('should open review modal when write review button is clicked', async () => {
    mockCoachProfileState = { data: mockCoachProfile, isLoading: false, error: null };
    renderPage();

    const writeReviewButton = screen.getByText(/写评价/i);
    await userEvent.click(writeReviewButton);

    // Modal should be visible with course selector and rating input
    expect(screen.getByText(/选择课程|课程/i)).toBeInTheDocument();
    expect(screen.getByText(/评分/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 无团课和无私教时间段
  // =========================================================================

  // 来源: web-app-coaching.md §2 — CoachProfilePage — 组件结构 — GroupClassSection (无数据)
  it('should show empty message when coach has no group classes', () => {
    const profileNoClasses = {
      ...mockCoachProfile,
      groupClasses: [],
      privateLessonSlots: [],
    };
    mockCoachProfileState = { data: profileNoClasses, isLoading: false, error: null };
    renderPage();

    expect(screen.getByText(/暂无/i)).toBeInTheDocument();
  });
});
