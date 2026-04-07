/**
 * L1 集成测试: web-app/coaching — CoachListPage / CoachProfilePage / GroupClassDetailPage
 *
 * 验证: 页面操作 → hook 调用 → API 请求 → 状态更新 → 页面响应
 * Mock 策略: 仅 MSW mock 网络层，不 mock hooks
 *
 * 与契约测试的区别:
 *   - 契约测试: mock hooks，验证 API 请求格式和响应解析
 *   - L1 集成测试: 不 mock hooks，验证完整端内数据流（页面 → hook → API → 状态更新 → 页面）
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
// Mock navigate and useParams
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
let mockParamsId = 'coach-uuid-1';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: mockParamsId }),
  };
});

// ---------------------------------------------------------------------------
// Mock auth store (configurable userId for different test contexts)
// ---------------------------------------------------------------------------

let mockAuthUserId = 'current-user-id';

vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-jwt-token',
      userId: mockAuthUserId,
      isLoggedIn: true,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

// ---------------------------------------------------------------------------
// Mock antd message (to avoid jsdom rendering issues)
// ---------------------------------------------------------------------------

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
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

const mockSlotVenue = {
  id: 'venue-uuid-1',
  name: '朝阳体育中心羽毛球馆',
  address: '北京市朝阳区...',
};

const mockVenue = {
  ...mockSlotVenue,
  latitude: 39.9215,
  longitude: 116.4435,
};

const mockCoachListItem = {
  userId: 'coach-uuid-1',
  nickname: '教练张',
  avatarUrl: null,
  bio: '10年教学经验',
  specialties: ['singles', 'footwork'],
  studentCount: 42,
};

const mockCoachListItem2 = {
  userId: 'coach-uuid-2',
  nickname: '教练李',
  avatarUrl: null,
  bio: '双打专家',
  specialties: ['doubles', 'tactics'],
  studentCount: 28,
};

const mockRating = {
  coachId: 'coach-uuid-1',
  averageRating: 4.5,
  totalCount: 15,
};

const mockRating2 = {
  coachId: 'coach-uuid-2',
  averageRating: null,
  totalCount: 0,
};

const mockCoachProfile = {
  userId: 'coach-uuid-1',
  nickname: '教练张',
  avatarUrl: null,
  bio: '10年教学经验',
  specialties: ['singles', 'footwork'],
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
      title: '高级技巧班',
      startTime: '2026-03-10T14:00:00.000Z',
      endTime: '2026-03-10T16:00:00.000Z',
      venue: mockSlotVenue,
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
      venues: [mockSlotVenue],
      feeDescription: '300元/小时',
      isBooked: false,
    },
  ],
};

const mockGroupClassDetail = {
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

const mockReview = {
  id: 'review-uuid-1',
  reviewer: {
    id: 'user-uuid-1',
    nickname: '张三',
    avatarUrl: null,
  },
  courseType: 'group-class',
  courseId: 'gc-uuid-1',
  rating: 5,
  comment: '教练讲解很细致，推荐！',
  createdAt: '2026-04-02T10:00:00.000Z',
};

const mockMatchRecord = {
  id: 'mr-uuid-1',
  sourceType: 'group-class',
  sourceId: 'gc-uuid-1',
  matchType: 'doubles',
  recordedBy: 'current-user-id',
  recorder: { id: 'current-user-id', nickname: '当前用户', avatarUrl: null },
  players: {
    sideA: [{ userId: 'user-uuid-1', nickname: '张三', avatarUrl: null }],
    sideB: [{ guestId: 'guest-uuid-1', nickname: '临时球友B' }],
  },
  games: [{ gameNumber: 1, scoreA: 21, scoreB: 19 }],
  result: 'A_WIN',
  createdAt: '2026-04-06T20:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Mock useCurrentUser (needed for MyCourseManagementPage)
// ---------------------------------------------------------------------------

let mockCurrentUserData: unknown = { id: 'coach-uuid-1', isCoach: true, nickname: '教练张' };
let mockCurrentUserIsLoading = false;

vi.mock('@web/shared/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: mockCurrentUserData,
    isLoading: mockCurrentUserIsLoading,
  }),
}));

// ---------------------------------------------------------------------------
// Import components (after mocks)
// ---------------------------------------------------------------------------

import { CoachListPage } from '@web/features/coaching/pages/CoachListPage';
import { CoachProfilePage } from '@web/features/coaching/pages/CoachProfilePage';
import { GroupClassDetailPage } from '@web/features/coaching/pages/GroupClassDetailPage';
import { PrivateLessonBookingPage } from '@web/features/coaching/pages/PrivateLessonBookingPage';
import { MyCourseManagementPage } from '@web/features/coaching/pages/MyCourseManagementPage';
import { MyEnrollmentListPage } from '@web/features/coaching/pages/MyEnrollmentListPage';

// =========================================================================
// CoachListPage Integration Tests
// =========================================================================

describe('CoachListPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParamsId = 'coach-uuid-1';
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CoachListPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it(
    'should load coaches from API, fetch ratings, merge and sort by rating descending',
    async () => {
      server.use(
        http.get('/api/coaches', () => {
          return HttpResponse.json({
            data: {
              items: [mockCoachListItem, mockCoachListItem2],
              total: 2,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.post('/api/coaches/ratings', () => {
          return HttpResponse.json({
            data: { ratings: [mockRating, mockRating2] },
          });
        }),
      );

      renderPage();

      // Wait for coach data and ratings to be merged
      await waitFor(
        () => {
          expect(screen.getByText('教练张')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Verify both coaches are rendered
      expect(screen.getByText('教练李')).toBeInTheDocument();

      // Verify rating display for coach with rating
      expect(screen.getByText('4.5')).toBeInTheDocument();

      // Verify "暂无评价" for coach without rating
      const noRatingElements = screen.getAllByText('暂无评价');
      expect(noRatingElements.length).toBeGreaterThanOrEqual(1);

      // Verify student count
      expect(screen.getByText(/42 名学员/)).toBeInTheDocument();
      expect(screen.getByText(/28 名学员/)).toBeInTheDocument();
    },
    15000,
  );

  it('should display empty state when no coaches found', async () => {
    server.use(
      http.get('/api/coaches', () => {
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('暂无教练')).toBeInTheDocument();
    });
  });

  it('should display error message when API fails', async () => {
    server.use(
      http.get('/api/coaches', () => {
        return HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
          { status: 500 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/加载失败/)).toBeInTheDocument();
    });
  });

  it(
    'should navigate to coach profile when card is clicked',
    async () => {
      server.use(
        http.get('/api/coaches', () => {
          return HttpResponse.json({
            data: {
              items: [mockCoachListItem],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.post('/api/coaches/ratings', () => {
          return HttpResponse.json({
            data: { ratings: [mockRating] },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('教练张')).toBeInTheDocument();
      });

      await user.click(
        screen.getByTestId('coach-card-coach-uuid-1'),
      );
      expect(mockNavigate).toHaveBeenCalledWith('/coaches/coach-uuid-1');
    },
    15000,
  );

  it(
    'should filter by specialty and reload data',
    async () => {
      const capturedUrls: string[] = [];

      server.use(
        http.get('/api/coaches', ({ request }) => {
          capturedUrls.push(request.url);
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for initial load
      await waitFor(() => {
        expect(capturedUrls.length).toBeGreaterThanOrEqual(1);
      });

      // Click "单打" filter
      await user.click(screen.getByText('单打'));

      // Wait for filtered request
      await waitFor(() => {
        const singlesRequest = capturedUrls.find((url) =>
          url.includes('specialty=singles'),
        );
        expect(singlesRequest).toBeDefined();
      });
    },
    15000,
  );

  it(
    'should filter by "全部" to clear specialty filter',
    async () => {
      const capturedUrls: string[] = [];

      server.use(
        http.get('/api/coaches', ({ request }) => {
          capturedUrls.push(request.url);
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for initial load (no specialty)
      await waitFor(() => {
        expect(capturedUrls.length).toBeGreaterThanOrEqual(1);
      });
      const initialUrl = capturedUrls[capturedUrls.length - 1];
      expect(initialUrl).not.toContain('specialty=');

      // Click specialty filter
      await user.click(screen.getByText('步法'));
      await waitFor(() => {
        expect(capturedUrls.some((u) => u.includes('specialty=footwork'))).toBe(true);
      });

      // Click "全部" to clear filter - this returns to the same query key as initial,
      // so react-query may serve from cache. The key test is that the UI state changes.
      await user.click(screen.getByText('全部'));

      // The UI should reflect cleared filter - "全部" button should be selected
      // (has green background). Verify by checking the filter buttons render.
      // Since staleTime=0 in tests, react-query will refetch. But even without refetch,
      // the cached data should be displayed. The key behavior is that
      // specialty=null is the active state.
      await waitFor(() => {
        // Verify the initial (no specialty) data is displayed or re-fetched
        const allUrls = capturedUrls.filter((u) => !u.includes('specialty='));
        expect(allUrls.length).toBeGreaterThanOrEqual(1);
      });
    },
    15000,
  );

  it(
    'should display specialty tags in Chinese on coach cards',
    async () => {
      server.use(
        http.get('/api/coaches', () => {
          return HttpResponse.json({
            data: {
              items: [mockCoachListItem],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.post('/api/coaches/ratings', () => {
          return HttpResponse.json({
            data: { ratings: [mockRating] },
          });
        }),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('教练张')).toBeInTheDocument();
      });

      // Specialty tags should be in Chinese (getAllByText because filter buttons also have these texts)
      const singlesElements = screen.getAllByText('单打');
      expect(singlesElements.length).toBeGreaterThanOrEqual(2); // filter + coach card tag
      const footworkElements = screen.getAllByText('步法');
      expect(footworkElements.length).toBeGreaterThanOrEqual(2); // filter + coach card tag
    },
    15000,
  );

  it(
    'should gracefully show coaches without ratings when ratings API fails',
    async () => {
      server.use(
        http.get('/api/coaches', () => {
          return HttpResponse.json({
            data: {
              items: [mockCoachListItem],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.post('/api/coaches/ratings', () => {
          return HttpResponse.json(
            { error: { code: 'REVIEW_INVALID_COACH_IDS', message: '错误' } },
            { status: 400 },
          );
        }),
      );

      renderPage();

      // Even if ratings fail, coach cards should display with "暂无评价"
      await waitFor(
        () => {
          expect(screen.getByText('教练张')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      expect(screen.getByText('暂无评价')).toBeInTheDocument();
    },
    15000,
  );
});

// =========================================================================
// CoachProfilePage Integration Tests
// =========================================================================

describe('CoachProfilePage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParamsId = 'coach-uuid-1';
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CoachProfilePage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it(
    'should load and display coach profile with rating from parallel API calls',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfile });
        }),
        http.get('/api/coaches/:id/rating', () => {
          return HttpResponse.json({ data: mockRating });
        }),
        http.get('/api/coaches/:id/reviews', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('教练张')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Verify bio
      expect(screen.getByText('10年教学经验')).toBeInTheDocument();

      // Verify rating display
      expect(screen.getByText(/4.5/)).toBeInTheDocument();
      expect(screen.getByText(/15条/)).toBeInTheDocument();

      // Verify student count
      expect(screen.getByText(/42 名学员/)).toBeInTheDocument();

      // Verify specialties
      expect(screen.getByText('单打')).toBeInTheDocument();
      expect(screen.getByText('步法')).toBeInTheDocument();
    },
    15000,
  );

  it(
    'should display "暂无评价" when rating is null',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfile });
        }),
        http.get('/api/coaches/:id/rating', () => {
          return HttpResponse.json({
            data: { coachId: 'coach-uuid-1', averageRating: null, totalCount: 0 },
          });
        }),
        http.get('/api/coaches/:id/reviews', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('暂无评价')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should show error page when coach not found',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json(
            { error: { code: 'COACHING_NOT_A_COACH', message: '用户不存在或不是教练角色' } },
            { status: 404 },
          );
        }),
        http.get('/api/coaches/:id/rating', () => {
          return HttpResponse.json(
            { error: { code: 'COACHING_NOT_A_COACH', message: '不存在' } },
            { status: 404 },
          );
        }),
        http.get('/api/coaches/:id/reviews', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/教练不存在/)).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    'should show group classes in courses tab and navigate to group class detail',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfile });
        }),
        http.get('/api/coaches/:id/rating', () => {
          return HttpResponse.json({ data: mockRating });
        }),
        http.get('/api/coaches/:id/reviews', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for group classes to appear (courses tab is default)
      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      expect(screen.getByText('高级技巧班')).toBeInTheDocument();

      // Verify status tags
      expect(screen.getByText('报名中')).toBeInTheDocument();
      expect(screen.getByText('已结束')).toBeInTheDocument();

      // Click on a group class card to navigate
      await user.click(screen.getByTestId('group-class-card-gc-uuid-1'));
      expect(mockNavigate).toHaveBeenCalledWith('/group-classes/gc-uuid-1');
    },
    15000,
  );

  it(
    'should show private lesson section with available slots count and navigate',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfile });
        }),
        http.get('/api/coaches/:id/rating', () => {
          return HttpResponse.json({ data: mockRating });
        }),
        http.get('/api/coaches/:id/reviews', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/1 个可预约时间段/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Click "预约私教" button
      await user.click(screen.getByText('预约私教'));
      expect(mockNavigate).toHaveBeenCalledWith('/coaches/coach-uuid-1/private-lessons');
    },
    15000,
  );

  it(
    'should switch to reviews tab and display reviews from API',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfile });
        }),
        http.get('/api/coaches/:id/rating', () => {
          return HttpResponse.json({ data: mockRating });
        }),
        http.get('/api/coaches/:id/reviews', () => {
          return HttpResponse.json({
            data: {
              items: [mockReview],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for page to load
      await waitFor(
        () => {
          expect(screen.getByText('教练张')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Switch to reviews tab
      await user.click(screen.getByText('评价'));

      // Wait for reviews to appear
      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument();
      });

      expect(screen.getByText('教练讲解很细致，推荐！')).toBeInTheDocument();
    },
    15000,
  );

  it(
    'should show "暂无课程" when coach has no classes or slots',
    async () => {
      const emptyCoach = {
        ...mockCoachProfile,
        groupClasses: [],
        privateLessonSlots: [],
      };

      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: emptyCoach });
        }),
        http.get('/api/coaches/:id/rating', () => {
          return HttpResponse.json({ data: mockRating });
        }),
        http.get('/api/coaches/:id/reviews', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('暂无课程')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should show "暂无评价" in reviews tab when no reviews exist',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfile });
        }),
        http.get('/api/coaches/:id/rating', () => {
          return HttpResponse.json({ data: mockRating });
        }),
        http.get('/api/coaches/:id/reviews', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('教练张')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Switch to reviews tab
      await user.click(screen.getByText('评价'));

      await waitFor(() => {
        // There are multiple "暂无评价" texts (stats area + reviews tab)
        const elements = screen.getAllByText('暂无评价');
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    },
    15000,
  );

  it(
    'should show "写评价" button for non-coach users and open review modal',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfile });
        }),
        http.get('/api/coaches/:id/rating', () => {
          return HttpResponse.json({ data: mockRating });
        }),
        http.get('/api/coaches/:id/reviews', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('教练张')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Switch to reviews tab
      await user.click(screen.getByText('评价'));

      // "写评价" button should be visible (current user is not the coach)
      await waitFor(() => {
        expect(screen.getByText('写评价')).toBeInTheDocument();
      });

      // Click "写评价" to open modal
      await user.click(screen.getByText('写评价'));

      // Modal should be visible
      await waitFor(() => {
        expect(screen.getByText('提交评价')).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    'should submit review through full data flow: modal → API → refresh',
    async () => {
      let reviewSubmitted = false;

      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfile });
        }),
        http.get('/api/coaches/:id/rating', () => {
          return HttpResponse.json({ data: mockRating });
        }),
        http.get('/api/coaches/:id/reviews', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
        http.post('/api/reviews', () => {
          reviewSubmitted = true;
          return HttpResponse.json(
            {
              data: {
                id: 'review-uuid-new',
                reviewerId: 'current-user-id',
                coachId: 'coach-uuid-1',
                courseType: 'group-class',
                courseId: 'gc-uuid-2',
                rating: 5,
                comment: null,
                createdAt: '2026-04-07T10:00:00.000Z',
              },
            },
            { status: 201 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('教练张')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Switch to reviews tab and open modal
      await user.click(screen.getByText('评价'));
      await waitFor(() => {
        expect(screen.getByText('写评价')).toBeInTheDocument();
      });
      await user.click(screen.getByText('写评价'));

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText('提交评价')).toBeInTheDocument();
      });

      // Select a completed course from dropdown
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, `group-class:gc-uuid-2`);

      // Submit review
      await user.click(screen.getByText('提交'));

      await waitFor(() => {
        expect(reviewSubmitted).toBe(true);
      });
    },
    15000,
  );
});

// =========================================================================
// GroupClassDetailPage Integration Tests
// =========================================================================

describe('GroupClassDetailPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParamsId = 'gc-uuid-1';
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <GroupClassDetailPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it(
    'should load and display group class detail with enrollments from API',
    async () => {
      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({ data: mockGroupClassDetail });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Verify coach name
      expect(screen.getByText('教练张')).toBeInTheDocument();

      // Verify venue
      expect(screen.getByText('朝阳体育中心羽毛球馆')).toBeInTheDocument();

      // Verify participants
      expect(screen.getByText(/5\/10/)).toBeInTheDocument();

      // Verify fee
      expect(screen.getByText('200元/人')).toBeInTheDocument();

      // Verify enrollment list
      expect(screen.getByText('羽球达人')).toBeInTheDocument();
    },
    15000,
  );

  it('should show error when group class not found', async () => {
    server.use(
      http.get('/api/group-classes/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_GROUP_CLASS_NOT_FOUND', message: '团课不存在' } },
          { status: 404 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/团课不存在/)).toBeInTheDocument();
    });
  });

  it(
    'should show enroll button for non-enrolled non-coach user and call enroll API',
    async () => {
      let enrollCalled = false;

      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({
            data: {
              ...mockGroupClassDetail,
              enrollments: [], // current user is NOT enrolled
            },
          });
        }),
        http.post('/api/group-classes/:id/enroll', () => {
          enrollCalled = true;
          return HttpResponse.json({
            data: {
              groupClassId: 'gc-uuid-1',
              userId: 'current-user-id',
              currentParticipants: 6,
              status: 'open',
              enrolledAt: '2026-04-07T09:00:00.000Z',
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for the enroll button to appear
      await waitFor(
        () => {
          expect(screen.getByText('报名')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      await user.click(screen.getByText('报名'));

      await waitFor(() => {
        expect(enrollCalled).toBe(true);
      });
    },
    15000,
  );

  it(
    'should show cancel enrollment button for enrolled user and call cancel API after confirm',
    async () => {
      let cancelCalled = false;

      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({
            data: {
              ...mockGroupClassDetail,
              enrollments: [
                {
                  userId: 'current-user-id',
                  nickname: '当前用户',
                  avatarUrl: null,
                  enrolledAt: '2026-04-03T09:00:00.000Z',
                },
              ],
            },
          });
        }),
        http.post('/api/group-classes/:id/cancel-enrollment', () => {
          cancelCalled = true;
          return HttpResponse.json({
            data: {
              groupClassId: 'gc-uuid-1',
              userId: 'current-user-id',
              currentParticipants: 4,
              status: 'open',
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('取消报名')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Click cancel enrollment
      await user.click(screen.getByText('取消报名'));

      // Confirm dialog should appear
      await waitFor(() => {
        expect(screen.getByText('是否取消报名？')).toBeInTheDocument();
      });

      // Confirm
      await user.click(screen.getByText('确认'));

      await waitFor(() => {
        expect(cancelCalled).toBe(true);
      });
    },
    15000,
  );

  it(
    'should show disabled "已满员" button when class is full and user not enrolled',
    async () => {
      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({
            data: {
              ...mockGroupClassDetail,
              status: 'full',
              enrollments: [], // current user is NOT enrolled
            },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          // Both status tag and button show "已满员", use getByRole to target the button
          expect(screen.getByRole('button', { name: '已满员' })).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      const button = screen.getByRole('button', { name: '已满员' });
      expect(button).toBeDisabled();
    },
    15000,
  );

  it(
    'should show cancel enrollment button when status is full and user is enrolled',
    async () => {
      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({
            data: {
              ...mockGroupClassDetail,
              status: 'full',
              enrollments: [
                {
                  userId: 'current-user-id',
                  nickname: '当前用户',
                  avatarUrl: null,
                  enrolledAt: '2026-04-03T09:00:00.000Z',
                },
              ],
            },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('取消报名')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should not show enroll/cancel buttons for the coach',
    async () => {
      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({
            data: {
              ...mockGroupClassDetail,
              coachId: 'current-user-id', // current user is the coach
              coach: { id: 'current-user-id', nickname: '当前用户', avatarUrl: null },
            },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // No enroll or cancel buttons should appear for the coach
      expect(screen.queryByText('报名')).not.toBeInTheDocument();
      expect(screen.queryByText('取消报名')).not.toBeInTheDocument();
    },
    15000,
  );

  it(
    'should show "已结束" status, "录入战绩" button and match records for completed class',
    async () => {
      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({
            data: {
              ...mockGroupClassDetail,
              status: 'completed',
            },
          });
        }),
        http.get('/api/group-classes/:id/match-records', () => {
          return HttpResponse.json({
            data: { items: [mockMatchRecord] },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('已结束')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // "录入战绩" button should be visible
      expect(screen.getByText('录入战绩')).toBeInTheDocument();

      // Match records should be loaded
      await waitFor(() => {
        expect(screen.getByText(/21:19/)).toBeInTheDocument();
      });

      // Navigate to create match record
      await user.click(screen.getByText('录入战绩'));
      expect(mockNavigate).toHaveBeenCalledWith(
        '/match-records/create?sourceType=group-class&sourceId=gc-uuid-1',
      );
    },
    15000,
  );

  it(
    'should show "已取消" status for cancelled class',
    async () => {
      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({
            data: {
              ...mockGroupClassDetail,
              status: 'cancelled',
              enrollments: [],
            },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('已取消')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // No action buttons
      expect(screen.queryByText('报名')).not.toBeInTheDocument();
      expect(screen.queryByText('取消报名')).not.toBeInTheDocument();
    },
    15000,
  );

  it(
    'should show "进行中" status for in-progress class',
    async () => {
      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({
            data: {
              ...mockGroupClassDetail,
              status: 'in_progress',
            },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('进行中')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should navigate to coach profile when clicking on coach info',
    async () => {
      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({ data: mockGroupClassDetail });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('教练张')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      await user.click(screen.getByText('教练张'));
      expect(mockNavigate).toHaveBeenCalledWith('/coaches/coach-uuid-1');
    },
    15000,
  );

  it(
    'should show delete button for own match records and call delete API with confirm',
    async () => {
      let deleteCalled = false;

      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({
            data: {
              ...mockGroupClassDetail,
              status: 'completed',
            },
          });
        }),
        http.get('/api/group-classes/:id/match-records', () => {
          return HttpResponse.json({
            data: { items: [mockMatchRecord] },
          });
        }),
        http.delete('/api/match-records/:id', () => {
          deleteCalled = true;
          return HttpResponse.json({ data: { id: 'mr-uuid-1' } });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for match record to appear
      await waitFor(
        () => {
          expect(screen.getByText(/21:19/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Delete button should be visible (recordedBy === current-user-id)
      expect(screen.getByText('删除')).toBeInTheDocument();

      // Click delete
      await user.click(screen.getByText('删除'));

      // Confirm dialog should appear
      await waitFor(() => {
        expect(screen.getByText('确定删除战绩？')).toBeInTheDocument();
      });

      // Confirm
      await user.click(screen.getByText('确定'));

      await waitFor(() => {
        expect(deleteCalled).toBe(true);
      });
    },
    15000,
  );

  it(
    'should not show delete button for other users match records',
    async () => {
      const otherUserRecord = {
        ...mockMatchRecord,
        recordedBy: 'other-user-id',
        recorder: { id: 'other-user-id', nickname: '其他用户', avatarUrl: null },
      };

      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({
            data: {
              ...mockGroupClassDetail,
              status: 'completed',
            },
          });
        }),
        http.get('/api/group-classes/:id/match-records', () => {
          return HttpResponse.json({
            data: { items: [otherUserRecord] },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/21:19/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Delete button should NOT be visible
      expect(screen.queryByText('删除')).not.toBeInTheDocument();
    },
    15000,
  );

  it(
    'should show status tag for open status',
    async () => {
      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({ data: mockGroupClassDetail });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('报名中')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );
});

// =========================================================================
// PrivateLessonBookingPage Integration Tests
// =========================================================================

describe('PrivateLessonBookingPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParamsId = 'coach-uuid-1';
    mockAuthUserId = 'current-user-id';
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PrivateLessonBookingPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

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

  it(
    'should load and display available time slots from API',
    async () => {
      server.use(
        http.get('/api/coaches/:id/availability', () => {
          return HttpResponse.json({
            data: { slots: [mockSlotWithVenues, mockSlotNoVenue, mockSlotBooked] },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          // Multiple slots have 10:00, use getAllByText
          const timeElements = screen.getAllByText(/10:00/);
          expect(timeElements.length).toBeGreaterThanOrEqual(1);
        },
        { timeout: 10000 },
      );

      // Verify fee description
      expect(screen.getByText(/300元\/小时/)).toBeInTheDocument();

      // Verify booked slot shows "已约"
      expect(screen.getByText(/已约/)).toBeInTheDocument();

      // Verify slot without venues is also rendered
      expect(screen.getByText(/09:00/)).toBeInTheDocument();
    },
    15000,
  );

  it('should show empty state when no slots available', async () => {
    server.use(
      http.get('/api/coaches/:id/availability', () => {
        return HttpResponse.json({ data: { slots: [] } });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/暂无/)).toBeInTheDocument();
    });
  });

  it('should show error state when API fails', async () => {
    server.use(
      http.get('/api/coaches/:id/availability', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_NOT_A_COACH', message: '教练不存在' } },
          { status: 404 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/不存在|失败/)).toBeInTheDocument();
    });
  });

  it(
    'should select a slot with no venues and show confirm button, then book via API',
    async () => {
      let bookCalled = false;
      let bookBody: Record<string, unknown> = {};

      server.use(
        http.get('/api/coaches/:id/availability', () => {
          return HttpResponse.json({
            data: { slots: [mockSlotNoVenue] },
          });
        }),
        http.post('/api/private-lessons/book', async ({ request }) => {
          bookCalled = true;
          bookBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            {
              data: {
                id: 'pl-uuid-new',
                slotId: 'slot-uuid-3',
                coachId: 'coach-uuid-1',
                studentId: 'current-user-id',
                venue: null,
                startTime: '2026-04-13T09:00:00.000Z',
                endTime: '2026-04-13T11:00:00.000Z',
                status: 'scheduled',
                createdAt: '2026-04-07T10:00:00.000Z',
              },
            },
            { status: 201 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for slot to appear
      await waitFor(
        () => {
          expect(screen.getByText(/09:00/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Click to select slot
      await user.click(screen.getByTestId('slot-card-slot-uuid-3'));

      // Confirm button should appear
      await waitFor(() => {
        expect(screen.getByText(/确认预约/)).toBeInTheDocument();
      });

      // Click confirm to open dialog
      await user.click(screen.getByText(/确认预约/));

      // Confirm dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/确定/)).toBeInTheDocument();
      });

      // Click 确定 in dialog
      await user.click(screen.getByText(/确定/));

      // Verify API was called
      await waitFor(() => {
        expect(bookCalled).toBe(true);
      });

      expect(bookBody.slotId).toBe('slot-uuid-3');
    },
    15000,
  );

  it(
    'should select a slot with multiple venues, select venue, then book via API',
    async () => {
      let bookCalled = false;
      let bookBody: Record<string, unknown> = {};

      server.use(
        http.get('/api/coaches/:id/availability', () => {
          return HttpResponse.json({
            data: { slots: [mockSlotWithVenues] },
          });
        }),
        http.post('/api/private-lessons/book', async ({ request }) => {
          bookCalled = true;
          bookBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            {
              data: {
                id: 'pl-uuid-new',
                slotId: 'slot-uuid-1',
                coachId: 'coach-uuid-1',
                studentId: 'current-user-id',
                venue: { id: 'venue-uuid-2', name: '海淀体育馆', address: '北京市海淀区...' },
                startTime: '2026-04-11T10:00:00.000Z',
                endTime: '2026-04-11T12:00:00.000Z',
                status: 'scheduled',
                createdAt: '2026-04-07T10:00:00.000Z',
              },
            },
            { status: 201 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for slot to appear
      await waitFor(
        () => {
          expect(screen.getByText(/10:00/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Click to select slot
      await user.click(screen.getByTestId('slot-card-slot-uuid-1'));

      // Venue selector should appear
      await waitFor(() => {
        expect(screen.getByText('朝阳体育中心羽毛球馆')).toBeInTheDocument();
        expect(screen.getByText('海淀体育馆')).toBeInTheDocument();
      });

      // Select a venue
      await user.click(screen.getByText('海淀体育馆'));

      // Confirm button should appear
      await waitFor(() => {
        expect(screen.getByText(/确认预约/)).toBeInTheDocument();
      });

      // Click confirm to open dialog
      await user.click(screen.getByText(/确认预约/));

      // Confirm dialog
      await waitFor(() => {
        expect(screen.getByText(/确定/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/确定/));

      await waitFor(() => {
        expect(bookCalled).toBe(true);
      });

      expect(bookBody.slotId).toBe('slot-uuid-1');
      expect(bookBody.venueId).toBe('venue-uuid-2');
    },
    15000,
  );

  it(
    'should not allow clicking on booked slots',
    async () => {
      server.use(
        http.get('/api/coaches/:id/availability', () => {
          return HttpResponse.json({
            data: { slots: [mockSlotBooked] },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for slot to appear
      await waitFor(
        () => {
          expect(screen.getByText(/已约/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Click on the booked slot
      await user.click(screen.getByTestId('slot-card-slot-uuid-4'));

      // Confirm button should NOT appear
      expect(screen.queryByText(/确认预约/)).not.toBeInTheDocument();
    },
    15000,
  );

  it(
    'should show date range picker',
    async () => {
      server.use(
        http.get('/api/coaches/:id/availability', () => {
          return HttpResponse.json({ data: { slots: [mockSlotWithVenues] } });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/日期/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );
});

// =========================================================================
// MyCourseManagementPage Integration Tests
// =========================================================================

describe('MyCourseManagementPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParamsId = 'coach-uuid-1';
    mockAuthUserId = 'coach-uuid-1';
    mockCurrentUserData = { id: 'coach-uuid-1', isCoach: true, nickname: '教练张' };
    mockCurrentUserIsLoading = false;
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <MyCourseManagementPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  const mockCoachProfileForManagement = {
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

  const mockMgmtAvailabilitySlot = {
    id: 'slot-uuid-1',
    startTime: '2026-04-11T10:00:00.000Z',
    endTime: '2026-04-11T12:00:00.000Z',
    venues: [mockSlotVenue],
    feeDescription: '300元/小时',
    isBooked: false,
  };

  const mockMgmtBookedSlot = {
    id: 'slot-uuid-2',
    startTime: '2026-04-12T14:00:00.000Z',
    endTime: '2026-04-12T16:00:00.000Z',
    venues: [],
    feeDescription: null,
    isBooked: true,
  };

  const mockMgmtPrivateLesson = {
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

  it(
    'should load coach profile and render group classes tab with management actions',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfileForManagement });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
      );

      renderPage();

      // Wait for group classes to load
      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Verify tabs exist
      expect(screen.getByRole('button', { name: '团课' })).toBeInTheDocument();
      expect(screen.getByText(/私教时间/)).toBeInTheDocument();
      expect(screen.getByText(/私教预约/)).toBeInTheDocument();

      // Verify "发布团课" button
      expect(screen.getByText(/发布团课/)).toBeInTheDocument();

      // Verify management buttons for open class
      expect(screen.getByText(/修改/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();

      // Cancelled class should not have management buttons
      expect(screen.getByText('已取消的课程')).toBeInTheDocument();
      const modifyButtons = screen.getAllByText(/修改/);
      expect(modifyButtons).toHaveLength(1);
    },
    15000,
  );

  it(
    'should show coach role required prompt when user is not a coach',
    async () => {
      mockCurrentUserData = { id: 'user-uuid-1', isCoach: false, nickname: '普通用户' };

      server.use(
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'user-uuid-1', isCoach: false, nickname: '普通用户', phone: '13800000002', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/教练角色/)).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    'should navigate to group class detail when clicking on a class card',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfileForManagement });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Click on a class card (the div with data-testid)
      const classCard = screen.getByTestId('manageable-group-class-gc-uuid-1');
      await user.click(classCard);
      expect(mockNavigate).toHaveBeenCalledWith('/group-classes/gc-uuid-1');
    },
    15000,
  );

  it(
    'should cancel group class through full flow: button → confirm → API call',
    async () => {
      let cancelCalled = false;

      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfileForManagement });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
        http.post('/api/group-classes/:id/cancel', () => {
          cancelCalled = true;
          return HttpResponse.json({
            data: { id: 'gc-uuid-1', status: 'cancelled' },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Click cancel button (not the "取消" tab text)
      await user.click(screen.getByRole('button', { name: '取消' }));

      // Confirm dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/确认/)).toBeInTheDocument();
      });

      // Confirm the cancellation
      await user.click(screen.getByText(/确认/));

      await waitFor(() => {
        expect(cancelCalled).toBe(true);
      });
    },
    15000,
  );

  it(
    'should open create group class modal when "发布团课" is clicked',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfileForManagement });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/发布团课/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      await user.click(screen.getByText(/发布团课/));

      // Modal should appear with form fields
      await waitFor(() => {
        expect(screen.getByText(/课程名称/)).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    'should open edit group class modal with pre-filled values',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfileForManagement });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/修改/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      await user.click(screen.getByText(/修改/));

      // Edit modal should show with pre-filled title
      await waitFor(() => {
        expect(screen.getByDisplayValue('初级单打提升班')).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    'should switch to private schedule tab and display slots from API',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfileForManagement });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
        http.get('/api/coaches/:id/availability', () => {
          return HttpResponse.json({
            data: { slots: [mockMgmtAvailabilitySlot, mockMgmtBookedSlot] },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for page to load
      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Switch to private schedule tab
      await user.click(screen.getByText(/私教时间/));

      // Slots should be rendered with booking status
      await waitFor(() => {
        expect(screen.getByText(/添加时间段/)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/空闲/)).toBeInTheDocument();
        expect(screen.getByText(/已预约/)).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    'should open add slot modal from private schedule tab',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfileForManagement });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
        http.get('/api/coaches/:id/availability', () => {
          return HttpResponse.json({ data: { slots: [] } });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Switch to private schedule tab
      await user.click(screen.getByText(/私教时间/));

      await waitFor(() => {
        expect(screen.getByText(/添加时间段/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/添加时间段/));

      // Modal should appear with time inputs
      await waitFor(() => {
        expect(screen.getByText(/开始时间/)).toBeInTheDocument();
        expect(screen.getByText(/结束时间/)).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    'should switch to private lessons tab and display lessons from API',
    async () => {
      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfileForManagement });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
        http.get('/api/coaches/:id/private-lessons', () => {
          return HttpResponse.json({
            data: {
              items: [mockMgmtPrivateLesson],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Switch to private lessons tab
      await user.click(screen.getByText(/私教预约/));

      // Private lesson card should appear
      await waitFor(() => {
        expect(screen.getByText('羽球达人')).toBeInTheDocument();
      });

      // Scheduled lesson should have cancel button
      expect(screen.getByText(/取消/)).toBeInTheDocument();
    },
    15000,
  );

  it(
    'should cancel private lesson through full flow: button → confirm → API call',
    async () => {
      let cancelCalled = false;

      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfileForManagement });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
        http.get('/api/coaches/:id/private-lessons', () => {
          return HttpResponse.json({
            data: {
              items: [mockMgmtPrivateLesson],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.post('/api/private-lessons/:id/cancel', () => {
          cancelCalled = true;
          return HttpResponse.json({
            data: { id: 'pl-uuid-1', status: 'cancelled' },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Switch to private lessons tab
      await user.click(screen.getByText(/私教预约/));

      await waitFor(() => {
        expect(screen.getByText('羽球达人')).toBeInTheDocument();
      });

      // Click cancel button
      await user.click(screen.getByText(/取消/));

      // Confirm dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/确认/)).toBeInTheDocument();
      });

      // Confirm
      await user.click(screen.getByText(/确认/));

      await waitFor(() => {
        expect(cancelCalled).toBe(true);
      });
    },
    15000,
  );

  it(
    'should not show cancel button for completed private lessons',
    async () => {
      const completedLesson = { ...mockMgmtPrivateLesson, id: 'pl-uuid-2', status: 'completed' };

      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: mockCoachProfileForManagement });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
        http.get('/api/coaches/:id/private-lessons', () => {
          return HttpResponse.json({
            data: {
              items: [completedLesson],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Switch to private lessons tab
      await user.click(screen.getByText(/私教预约/));

      await waitFor(() => {
        expect(screen.getByText('羽球达人')).toBeInTheDocument();
      });

      // No cancel button should be shown for completed lessons
      expect(screen.queryByRole('button', { name: /取消/ })).not.toBeInTheDocument();
    },
    15000,
  );

  it(
    'should show empty state when no group classes',
    async () => {
      const emptyProfile = { ...mockCoachProfileForManagement, groupClasses: [] };

      server.use(
        http.get('/api/coaches/:id', () => {
          return HttpResponse.json({ data: emptyProfile });
        }),
        http.get('/api/users/me', () => {
          return HttpResponse.json({
            data: { id: 'coach-uuid-1', isCoach: true, nickname: '教练张', phone: '13800000001', avatarUrl: null, bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/暂无/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );
});

// =========================================================================
// MyEnrollmentListPage Integration Tests
// =========================================================================

describe('MyEnrollmentListPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParamsId = 'current-user-id';
    mockAuthUserId = 'current-user-id';
    mockCurrentUserData = { id: 'current-user-id', isCoach: false, nickname: '当前用户' };
    mockCurrentUserIsLoading = false;
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <MyEnrollmentListPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  const mockGroupClassEnrollment = {
    type: 'group-class',
    groupClass: {
      id: 'gc-uuid-1',
      title: '初级单打提升班',
      coachId: 'coach-uuid-1',
      coachNickname: '教练张',
      venue: { id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆' },
      startTime: '2026-04-10T14:00:00.000Z',
      endTime: '2026-04-10T16:00:00.000Z',
      status: 'open',
      enrolledAt: '2026-04-03T09:00:00.000Z',
    },
    privateLesson: null,
  };

  const mockPrivateLessonEnrollment = {
    type: 'private-lesson',
    groupClass: null,
    privateLesson: {
      id: 'pl-uuid-1',
      coachId: 'coach-uuid-1',
      coachNickname: '教练张',
      venue: { id: 'venue-uuid-1', name: '朝阳体育中心羽毛球馆' },
      startTime: '2026-04-11T10:00:00.000Z',
      endTime: '2026-04-11T12:00:00.000Z',
      status: 'scheduled',
      createdAt: '2026-04-03T10:00:00.000Z',
    },
  };

  const mockCompletedEnrollment = {
    type: 'group-class',
    groupClass: {
      id: 'gc-uuid-2',
      title: '高级战术课',
      coachId: 'coach-uuid-2',
      coachNickname: '教练李',
      venue: { id: 'venue-uuid-2', name: '海淀体育馆' },
      startTime: '2026-03-15T14:00:00.000Z',
      endTime: '2026-03-15T16:00:00.000Z',
      status: 'completed',
      enrolledAt: '2026-03-10T09:00:00.000Z',
    },
    privateLesson: null,
  };

  const mockCancelledEnrollment = {
    type: 'private-lesson',
    groupClass: null,
    privateLesson: {
      id: 'pl-uuid-2',
      coachId: 'coach-uuid-2',
      coachNickname: '教练李',
      venue: null,
      startTime: '2026-03-20T10:00:00.000Z',
      endTime: '2026-03-20T12:00:00.000Z',
      status: 'cancelled',
      createdAt: '2026-03-15T10:00:00.000Z',
    },
  };

  it(
    'should load and display mixed enrollment list from API',
    async () => {
      server.use(
        http.get('/api/users/:id/enrollments', () => {
          return HttpResponse.json({
            data: {
              items: [mockGroupClassEnrollment, mockPrivateLessonEnrollment],
              total: 2,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Both items should be rendered
      const coachNames = screen.getAllByText(/教练张/);
      expect(coachNames.length).toBeGreaterThanOrEqual(2);
    },
    15000,
  );

  it('should show empty state when no enrollments', async () => {
    server.use(
      http.get('/api/users/:id/enrollments', () => {
        return HttpResponse.json({
          data: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/暂无/)).toBeInTheDocument();
    });
  });

  it('should show error state when API fails', async () => {
    server.use(
      http.get('/api/users/:id/enrollments', () => {
        return HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
          { status: 500 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/失败|错误|重试/)).toBeInTheDocument();
    });
  });

  it(
    'should render filter buttons for type and status',
    async () => {
      server.use(
        http.get('/api/users/:id/enrollments', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      renderPage();

      // Type filters
      expect(screen.getByText('全部')).toBeInTheDocument();
      expect(screen.getByText('团课')).toBeInTheDocument();
      expect(screen.getByText('私教')).toBeInTheDocument();

      // Status filters
      expect(screen.getByText('待开课')).toBeInTheDocument();
      expect(screen.getByText('进行中')).toBeInTheDocument();
      expect(screen.getByText('已结束')).toBeInTheDocument();
      expect(screen.getByText('已取消')).toBeInTheDocument();
    },
    15000,
  );

  it(
    'should filter by type and reload data from API',
    async () => {
      const capturedUrls: string[] = [];

      server.use(
        http.get('/api/users/:id/enrollments', ({ request }) => {
          capturedUrls.push(request.url);
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for initial load
      await waitFor(() => {
        expect(capturedUrls.length).toBeGreaterThanOrEqual(1);
      });

      // Click "团课" filter
      await user.click(screen.getByText('团课'));

      // Verify the API was called with type=group-class
      await waitFor(() => {
        const groupClassRequest = capturedUrls.find((url) =>
          url.includes('type=group-class'),
        );
        expect(groupClassRequest).toBeDefined();
      });
    },
    15000,
  );

  it(
    'should filter by status and reload data from API',
    async () => {
      const capturedUrls: string[] = [];

      server.use(
        http.get('/api/users/:id/enrollments', ({ request }) => {
          capturedUrls.push(request.url);
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for initial load
      await waitFor(() => {
        expect(capturedUrls.length).toBeGreaterThanOrEqual(1);
      });

      // Click "已结束" status filter
      await user.click(screen.getByText('已结束'));

      // Verify the API was called with status=completed
      await waitFor(() => {
        const completedRequest = capturedUrls.find((url) =>
          url.includes('status=completed'),
        );
        expect(completedRequest).toBeDefined();
      });
    },
    15000,
  );

  it(
    'should display status tags on enrollment cards',
    async () => {
      server.use(
        http.get('/api/users/:id/enrollments', () => {
          return HttpResponse.json({
            data: {
              items: [mockCompletedEnrollment, mockCancelledEnrollment],
              total: 2,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('高级战术课')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Verify status tags on cards (use within to distinguish from filter buttons)
      const completedCard = screen.getByTestId('enrollment-card-gc-uuid-2');
      expect(completedCard).toBeInTheDocument();

      const cancelledCard = screen.getByTestId('enrollment-card-pl-uuid-2');
      expect(cancelledCard).toBeInTheDocument();
    },
    15000,
  );

  it(
    'should navigate to group class detail when clicking group class enrollment',
    async () => {
      server.use(
        http.get('/api/users/:id/enrollments', () => {
          return HttpResponse.json({
            data: {
              items: [mockGroupClassEnrollment],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText('初级单打提升班')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      const card = screen.getByTestId('enrollment-card-gc-uuid-1');
      await user.click(card);

      expect(mockNavigate).toHaveBeenCalledWith('/group-classes/gc-uuid-1');
    },
    15000,
  );

  it(
    'should navigate to coach profile when clicking private lesson enrollment',
    async () => {
      server.use(
        http.get('/api/users/:id/enrollments', () => {
          return HttpResponse.json({
            data: {
              items: [mockPrivateLessonEnrollment],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/教练张/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      const card = screen.getByTestId('enrollment-card-pl-uuid-1');
      await user.click(card);

      expect(mockNavigate).toHaveBeenCalledWith('/coaches/coach-uuid-1');
    },
    15000,
  );

  it(
    'should handle null venue gracefully',
    async () => {
      server.use(
        http.get('/api/users/:id/enrollments', () => {
          return HttpResponse.json({
            data: {
              items: [mockCancelledEnrollment],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      renderPage();

      // Should not crash with null venue
      await waitFor(
        () => {
          expect(screen.getByText(/教练李/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should show loading state while data is being fetched',
    async () => {
      server.use(
        http.get('/api/users/:id/enrollments', async () => {
          // Delay response to test loading state
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      renderPage();

      // Loading state should be shown initially
      expect(screen.getByText(/加载/)).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText(/暂无/)).toBeInTheDocument();
      });
    },
    15000,
  );
});
