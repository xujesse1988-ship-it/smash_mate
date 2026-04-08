/**
 * L1 集成测试: web-app/match-record — 全部页面端内数据流
 *
 * 验证: 页面操作 -> hook 调用 -> API 请求 -> 状态更新 -> 页面响应
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
// Mock navigate and URL params
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
let mockUrlParams: Record<string, string> = { id: 'user-uuid-1' };
let mockSearchParams = new URLSearchParams(
  'sourceType=activity&sourceId=activity-uuid-1',
);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUrlParams,
    useSearchParams: () => [mockSearchParams, vi.fn()],
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
// Fixtures
// ---------------------------------------------------------------------------

const mockActivityDetail = {
  id: 'activity-uuid-1',
  creatorId: 'creator-user-id',
  creator: {
    id: 'creator-user-id',
    nickname: '活动发起人',
    avatarUrl: null,
  },
  venue: {
    id: 'venue-uuid-1',
    name: '朝阳体育中心',
    address: '北京市朝阳区',
    latitude: 39.9215,
    longitude: 116.4435,
  },
  title: '周末约球',
  startTime: '2026-04-05T14:00:00.000Z',
  endTime: '2026-04-05T16:00:00.000Z',
  maxParticipants: 8,
  currentParticipants: 4,
  status: 'completed',
  participants: [
    {
      userId: 'current-user-id',
      nickname: '当前用户',
      avatarUrl: null,
      joinedAt: '2026-04-02T10:00:00.000Z',
    },
    {
      userId: 'user-uuid-2',
      nickname: '张三',
      avatarUrl: 'https://example.com/a1.jpg',
      joinedAt: '2026-04-02T11:00:00.000Z',
    },
    {
      userId: 'user-uuid-3',
      nickname: '李四',
      avatarUrl: null,
      joinedAt: '2026-04-02T12:00:00.000Z',
    },
    {
      userId: 'user-uuid-4',
      nickname: '王五',
      avatarUrl: null,
      joinedAt: '2026-04-02T13:00:00.000Z',
    },
  ],
  createdAt: '2026-04-02T10:00:00.000Z',
};

const mockGroupClassDetail = {
  id: 'gc-uuid-1',
  coachId: 'coach-user-id',
  coach: {
    id: 'coach-user-id',
    nickname: '教练A',
    avatarUrl: null,
  },
  title: '初级羽毛球团课',
  venue: {
    id: 'venue-uuid-1',
    name: '朝阳体育中心',
    address: '北京市朝阳区',
    latitude: 39.9215,
    longitude: 116.4435,
  },
  startTime: '2026-04-06T10:00:00.000Z',
  endTime: '2026-04-06T12:00:00.000Z',
  maxParticipants: 10,
  currentParticipants: 3,
  feeDescription: '100元/人',
  status: 'completed',
  enrollments: [
    {
      userId: 'current-user-id',
      nickname: '当前用户',
      avatarUrl: null,
      enrolledAt: '2026-04-04T10:00:00.000Z',
    },
    {
      userId: 'user-uuid-2',
      nickname: '张三',
      avatarUrl: 'https://example.com/a1.jpg',
      enrolledAt: '2026-04-04T11:00:00.000Z',
    },
  ],
  createdAt: '2026-04-03T10:00:00.000Z',
};

const mockCreatedMatchRecord = {
  id: 'match-uuid-new',
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
    sideA: [
      {
        userId: 'current-user-id',
        nickname: '当前用户',
        avatarUrl: null,
      },
    ],
    sideB: [{ guestId: 'guest-uuid-1', nickname: '临时球友' }],
  },
  games: [{ gameNumber: 1, scoreA: 21, scoreB: 18 }],
  result: 'A_WIN',
  createdAt: '2026-04-08T10:00:00.000Z',
};

const mockMatchStats = {
  totalMatches: 10,
  wins: 6,
  losses: 3,
  draws: 1,
  winRate: 66.7,
};

const mockMatchRecords = [
  {
    id: 'match-uuid-1',
    sourceType: 'activity',
    sourceId: 'activity-uuid-1',
    matchType: 'singles',
    recordedBy: 'user-uuid-2',
    recorder: {
      id: 'user-uuid-2',
      nickname: '张三',
      avatarUrl: 'https://example.com/a1.jpg',
    },
    players: {
      sideA: [
        {
          userId: 'user-uuid-1',
          nickname: '目标用户',
          avatarUrl: null,
        },
      ],
      sideB: [
        {
          userId: 'user-uuid-2',
          nickname: '张三',
          avatarUrl: 'https://example.com/a1.jpg',
        },
      ],
    },
    games: [
      { gameNumber: 1, scoreA: 21, scoreB: 18 },
      { gameNumber: 2, scoreA: 21, scoreB: 15 },
    ],
    result: 'A_WIN',
    userResult: 'WIN',
    createdAt: '2026-04-05T18:30:00.000Z',
  },
  {
    id: 'match-uuid-2',
    sourceType: 'group-class',
    sourceId: 'gc-uuid-1',
    matchType: 'doubles',
    recordedBy: 'user-uuid-3',
    recorder: {
      id: 'user-uuid-3',
      nickname: '李四',
      avatarUrl: null,
    },
    players: {
      sideA: [
        { userId: 'user-uuid-3', nickname: '李四', avatarUrl: null },
        { userId: 'user-uuid-4', nickname: '王五', avatarUrl: null },
      ],
      sideB: [
        { userId: 'user-uuid-1', nickname: '目标用户', avatarUrl: null },
        { guestId: 'guest-uuid-1', nickname: '临时球友A' },
      ],
    },
    games: [
      { gameNumber: 1, scoreA: 21, scoreB: 15 },
      { gameNumber: 2, scoreA: 21, scoreB: 18 },
    ],
    result: 'A_WIN',
    userResult: 'LOSE',
    createdAt: '2026-04-06T20:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Import components (after mocks)
// ---------------------------------------------------------------------------

import { CreateMatchRecordPage } from '@web/features/match-record/pages/CreateMatchRecordPage';
import { MatchRecordHistoryPage } from '@web/features/match-record/pages/MatchRecordHistoryPage';

// =========================================================================
// CreateMatchRecordPage Integration Tests
// =========================================================================

describe('CreateMatchRecordPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams(
      'sourceType=activity&sourceId=activity-uuid-1',
    );
    localStorage.setItem('token', 'test-jwt-token');
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CreateMatchRecordPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it(
    'should load participants from activity API and display form',
    async () => {
      server.use(
        http.get('/api/activities/:id', () => {
          return HttpResponse.json({ data: mockActivityDetail });
        }),
      );

      renderPage();

      // Wait for the form to render with participants loaded
      await waitFor(
        () => {
          expect(screen.getByText(/单打/)).toBeInTheDocument();
          expect(screen.getByText(/双打/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Should render player sections
      expect(screen.getByText(/A/i)).toBeInTheDocument();
      expect(screen.getByText(/B/i)).toBeInTheDocument();
    },
    15000,
  );

  it(
    'should load participants from group class API for group-class source',
    async () => {
      mockSearchParams = new URLSearchParams(
        'sourceType=group-class&sourceId=gc-uuid-1',
      );

      server.use(
        http.get('/api/group-classes/:id', () => {
          return HttpResponse.json({ data: mockGroupClassDetail });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/单打/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should render form without loading participants for private-lesson source',
    async () => {
      mockSearchParams = new URLSearchParams(
        'sourceType=private-lesson&sourceId=pl-uuid-1',
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/单打/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // For private-lesson, all player selectors should be in guest mode
      const guestToggles = screen.queryAllByRole('switch');
      guestToggles.forEach((toggle) => {
        expect(toggle).toBeDisabled();
      });
    },
    15000,
  );

  it(
    'should show error page when URL params are missing',
    async () => {
      mockSearchParams = new URLSearchParams('');

      renderPage();

      expect(
        screen.getByText(/请从活动或课程详情页进入战绩录入/),
      ).toBeInTheDocument();
    },
    15000,
  );

  it(
    'should submit match record and navigate to activity detail on success',
    async () => {
      let capturedBody: unknown = null;

      server.use(
        http.get('/api/activities/:id', () => {
          return HttpResponse.json({ data: mockActivityDetail });
        }),
        http.post('/api/match-records', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(
            { data: mockCreatedMatchRecord },
            { status: 201 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for form to load
      await waitFor(
        () => {
          expect(screen.getByText(/单打/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Toggle side A player to guest mode and enter name
      const guestToggles = screen.getAllByRole('switch');
      await user.click(guestToggles[0]); // Toggle side A player 1 to guest
      const guestInputs = screen.getAllByPlaceholderText('输入昵称');
      await user.type(guestInputs[0], '选手A');

      // Toggle side B player to guest mode and enter name
      await user.click(guestToggles[1]); // Toggle side B player 1 to guest
      const guestInputsAfter = screen.getAllByPlaceholderText('输入昵称');
      await user.type(guestInputsAfter[1], '选手B');

      // Enter score for game 1
      const scoreInputs = screen.getAllByRole('spinbutton');
      await user.clear(scoreInputs[0]);
      await user.type(scoreInputs[0], '21');
      await user.clear(scoreInputs[1]);
      await user.type(scoreInputs[1], '18');

      // Submit
      await user.click(screen.getByRole('button', { name: /提交战绩|提交/ }));

      // Wait for submission and navigation
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith(
            '/activities/activity-uuid-1',
          );
        },
        { timeout: 10000 },
      );

      // Verify request body was sent correctly
      expect(capturedBody).toMatchObject({
        sourceType: 'activity',
        sourceId: 'activity-uuid-1',
        matchType: 'singles',
        players: {
          sideA: [{ guestName: '选手A' }],
          sideB: [{ guestName: '选手B' }],
        },
      });
    },
    30000,
  );

  it(
    'should display API error message on submission failure',
    async () => {
      server.use(
        http.get('/api/activities/:id', () => {
          return HttpResponse.json({ data: mockActivityDetail });
        }),
        http.post('/api/match-records', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'MATCH_RECORD_SOURCE_NOT_COMPLETED',
                message: '活动尚未结束',
              },
            },
            { status: 409 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for form
      await waitFor(
        () => {
          expect(screen.getByText(/单打/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Fill in guest players
      const guestToggles = screen.getAllByRole('switch');
      await user.click(guestToggles[0]);
      await user.click(guestToggles[1]);
      const guestInputs = screen.getAllByPlaceholderText('输入昵称');
      await user.type(guestInputs[0], '选手A');
      await user.type(guestInputs[1], '选手B');

      // Enter score
      const scoreInputs = screen.getAllByRole('spinbutton');
      await user.clear(scoreInputs[0]);
      await user.type(scoreInputs[0], '21');
      await user.clear(scoreInputs[1]);
      await user.type(scoreInputs[1], '18');

      // Submit
      await user.click(screen.getByRole('button', { name: /提交战绩|提交/ }));

      // Should display the mapped error message
      await waitFor(
        () => {
          expect(
            screen.getByText(/活动.*课程.*尚未结束|暂时无法录入战绩/),
          ).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    30000,
  );

  it(
    'should switch between singles and doubles mode',
    async () => {
      server.use(
        http.get('/api/activities/:id', () => {
          return HttpResponse.json({ data: mockActivityDetail });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for form
      await waitFor(
        () => {
          expect(screen.getByText(/单打/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Initially in singles mode - 2 guest toggles (one per side)
      expect(screen.getAllByText(/非平台用户/i)).toHaveLength(2);

      // Switch to doubles
      await user.click(screen.getByText(/双打/));

      // Now should have 4 player slots
      await waitFor(() => {
        expect(screen.getAllByText(/非平台用户/i).length).toBeGreaterThanOrEqual(
          4,
        );
      });
    },
    15000,
  );

  it(
    'should add and remove game rows',
    async () => {
      server.use(
        http.get('/api/activities/:id', () => {
          return HttpResponse.json({ data: mockActivityDetail });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for form
      await waitFor(
        () => {
          expect(screen.getByText(/第 1 局/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Initially one game row, no delete button
      expect(screen.queryAllByRole('button', { name: /删除/ })).toHaveLength(0);

      // Add a game
      await user.click(
        screen.getByRole('button', { name: /添加一局|添加/ }),
      );

      // Should now have 2 game rows
      expect(screen.getByText(/第 2 局/)).toBeInTheDocument();

      // Delete buttons should appear
      const deleteButtons = screen.getAllByRole('button', { name: /删除/ });
      expect(deleteButtons.length).toBeGreaterThanOrEqual(1);

      // Remove one game
      await user.click(deleteButtons[0]);

      // Should be back to 1 game row
      await waitFor(() => {
        expect(screen.queryByText(/第 2 局/)).not.toBeInTheDocument();
      });
    },
    15000,
  );
});

// =========================================================================
// MatchRecordHistoryPage Integration Tests
// =========================================================================

describe('MatchRecordHistoryPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUrlParams = { id: 'user-uuid-1' };
    localStorage.setItem('token', 'test-jwt-token');
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <MatchRecordHistoryPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it(
    'should load and display match stats and records from API',
    async () => {
      server.use(
        http.get('/api/users/:id/match-stats', () => {
          return HttpResponse.json({ data: mockMatchStats });
        }),
        http.get('/api/users/:id/match-records', () => {
          return HttpResponse.json({
            data: {
              items: mockMatchRecords,
              total: 2,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      renderPage();

      // Wait for stats to load
      await waitFor(
        () => {
          // Stats should be displayed (all in one element)
          expect(screen.getByText(/10/)).toBeInTheDocument();
          expect(screen.getByText(/66\.7/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Wait for records to load
      await waitFor(
        () => {
          expect(screen.getByText('目标用户')).toBeInTheDocument();
          expect(screen.getByText('张三')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Should show result labels
      expect(screen.getByText('胜')).toBeInTheDocument();
      expect(screen.getByText('负')).toBeInTheDocument();

      // Should show match type labels
      expect(screen.getByText(/单打/)).toBeInTheDocument();
      expect(screen.getByText(/双打/)).toBeInTheDocument();
    },
    15000,
  );

  it(
    'should show empty state when no records exist',
    async () => {
      server.use(
        http.get('/api/users/:id/match-stats', () => {
          return HttpResponse.json({
            data: {
              totalMatches: 0,
              wins: 0,
              losses: 0,
              draws: 0,
              winRate: 0,
            },
          });
        }),
        http.get('/api/users/:id/match-records', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/暂无战绩记录/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should filter records by source type when tab is clicked',
    async () => {
      let capturedSourceType: string | null = null;

      server.use(
        http.get('/api/users/:id/match-stats', () => {
          return HttpResponse.json({ data: mockMatchStats });
        }),
        http.get('/api/users/:id/match-records', ({ request }) => {
          const url = new URL(request.url);
          capturedSourceType = url.searchParams.get('sourceType');
          return HttpResponse.json({
            data: {
              items: capturedSourceType
                ? mockMatchRecords.filter(
                    (r) => r.sourceType === capturedSourceType,
                  )
                : mockMatchRecords,
              total: capturedSourceType
                ? mockMatchRecords.filter(
                    (r) => r.sourceType === capturedSourceType,
                  ).length
                : mockMatchRecords.length,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      // Wait for initial load
      await waitFor(
        () => {
          expect(screen.getByText('目标用户')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Click "约球活动" filter tab
      await user.click(screen.getByText(/约球活动/));

      // Wait for filtered results
      await waitFor(
        () => {
          expect(capturedSourceType).toBe('activity');
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should display error state when records API fails',
    async () => {
      server.use(
        http.get('/api/users/:id/match-stats', () => {
          return HttpResponse.json({ data: mockMatchStats });
        }),
        http.get('/api/users/:id/match-records', () => {
          return HttpResponse.json(
            {
              error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
            },
            { status: 500 },
          );
        }),
      );

      renderPage();

      await waitFor(
        () => {
          expect(screen.getByText(/失败|重试/i)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should show default zero stats when stats API fails',
    async () => {
      server.use(
        http.get('/api/users/:id/match-stats', () => {
          return HttpResponse.json(
            {
              error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
            },
            { status: 500 },
          );
        }),
        http.get('/api/users/:id/match-records', () => {
          return HttpResponse.json({
            data: { items: [], total: 0, page: 1, pageSize: 20 },
          });
        }),
      );

      renderPage();

      // Should still render page with zero stats
      await waitFor(
        () => {
          expect(screen.getByText(/0/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should display formatted dates on match record cards',
    async () => {
      server.use(
        http.get('/api/users/:id/match-stats', () => {
          return HttpResponse.json({ data: mockMatchStats });
        }),
        http.get('/api/users/:id/match-records', () => {
          return HttpResponse.json({
            data: {
              items: [mockMatchRecords[0]],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      renderPage();

      // createdAt = '2026-04-05T18:30:00.000Z' -> should show as 2026-04-05 (or similar)
      await waitFor(
        () => {
          expect(screen.getByText(/2026-04-05/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should display game scores for each match record',
    async () => {
      server.use(
        http.get('/api/users/:id/match-stats', () => {
          return HttpResponse.json({ data: mockMatchStats });
        }),
        http.get('/api/users/:id/match-records', () => {
          return HttpResponse.json({
            data: {
              items: [mockMatchRecords[0]],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      renderPage();

      await waitFor(
        () => {
          // Should display scores "21:18  21:15"
          expect(screen.getByText(/21:18/)).toBeInTheDocument();
          expect(screen.getByText(/21:15/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );
});
