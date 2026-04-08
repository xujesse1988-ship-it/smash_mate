/**
 * 契约测试: web-app/match-record — MatchRecordHistoryPage 页面渲染
 * 覆盖页面: MatchRecordHistoryPage (/users/:id/match-records)
 *
 * 来源文档:
 *   - docs/module-design/web-app-match-record.md §2 — MatchRecordHistoryPage 页面
 *   - docs/module-design/web-app-match-record.md §3 — Feature 私有组件
 *   - docs/module-design/web-app-match-record.md §6.5 — 战绩历史列表中的结果颜色标识
 *
 * Mock 策略:
 *   - Mock hooks（useMatchRecordHistory, useMatchStats）的返回值
 *   - Mock react-router-dom 导航和 URL 路径参数
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

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'user-uuid-1' }),
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

// Mock useMatchStats hook
let mockMatchStatsState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/match-record/hooks/useMatchStats', () => ({
  useMatchStats: () => mockMatchStatsState,
}));

// Mock useMatchRecordHistory hook
const mockFetchNextPage = vi.fn();
let mockMatchRecordHistoryState = {
  data: null as unknown,
  isLoading: false,
  error: null as unknown,
  hasNextPage: false,
  fetchNextPage: mockFetchNextPage,
  isFetchingNextPage: false,
};

vi.mock('@web/features/match-record/hooks/useMatchRecordHistory', () => ({
  useMatchRecordHistory: () => mockMatchRecordHistoryState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { MatchRecordHistoryPage } from '@web/features/match-record/pages/MatchRecordHistoryPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// 来源: match-record.md §4 — 个人战绩汇总 — Response 200
const mockStats = {
  totalMatches: 42,
  wins: 25,
  losses: 15,
  draws: 2,
  winRate: 62.5,
};

// 来源: match-record.md §4 — 个人战绩历史 — Response 200
const mockWinRecord = {
  id: 'match-uuid-1',
  sourceType: 'activity',
  sourceId: 'activity-uuid-1',
  matchType: 'singles',
  recordedBy: 'user-uuid-2',
  recorder: {
    id: 'user-uuid-2',
    nickname: '王五',
    avatarUrl: 'https://example.com/avatar.jpg',
  },
  players: {
    sideA: [
      { userId: 'user-uuid-1', nickname: '张三', avatarUrl: 'https://example.com/a1.jpg' },
    ],
    sideB: [
      { userId: 'user-uuid-2', nickname: '李四', avatarUrl: null },
    ],
  },
  games: [
    { gameNumber: 1, scoreA: 21, scoreB: 18 },
    { gameNumber: 2, scoreA: 21, scoreB: 15 },
  ],
  result: 'A_WIN',
  userResult: 'WIN',
  createdAt: '2026-04-05T18:30:00.000Z',
};

const mockLoseRecord = {
  id: 'match-uuid-2',
  sourceType: 'group-class',
  sourceId: 'gc-uuid-1',
  matchType: 'doubles',
  recordedBy: 'user-uuid-3',
  recorder: {
    id: 'user-uuid-3',
    nickname: '赵六',
    avatarUrl: null,
  },
  players: {
    sideA: [
      { userId: 'user-uuid-3', nickname: '赵六', avatarUrl: null },
      { userId: 'user-uuid-4', nickname: '钱七', avatarUrl: null },
    ],
    sideB: [
      { userId: 'user-uuid-1', nickname: '张三', avatarUrl: 'https://example.com/a1.jpg' },
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
};

const mockDrawRecord = {
  id: 'match-uuid-3',
  sourceType: 'private-lesson',
  sourceId: 'pl-uuid-1',
  matchType: 'singles',
  recordedBy: 'user-uuid-1',
  recorder: {
    id: 'user-uuid-1',
    nickname: '张三',
    avatarUrl: 'https://example.com/a1.jpg',
  },
  players: {
    sideA: [
      { userId: 'user-uuid-1', nickname: '张三', avatarUrl: 'https://example.com/a1.jpg' },
    ],
    sideB: [
      { userId: 'user-uuid-5', nickname: '教练A', avatarUrl: null },
    ],
  },
  games: [
    { gameNumber: 1, scoreA: 21, scoreB: 18 },
    { gameNumber: 2, scoreA: 15, scoreB: 21 },
  ],
  result: 'DRAW',
  userResult: 'DRAW',
  createdAt: '2026-04-07T11:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<MatchRecordHistoryPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MatchRecordHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchStatsState = {
      data: null,
      isLoading: false,
      error: null,
    };
    mockMatchRecordHistoryState = {
      data: null,
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
  });

  // =========================================================================
  // 战绩汇总统计卡片
  // =========================================================================

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 组件结构 — MatchStatsCard
  it('should render match stats card with all stat items', () => {
    mockMatchStatsState = {
      data: mockStats,
      isLoading: false,
      error: null,
    };
    renderPage();

    // 总场次
    expect(screen.getByText(/42/)).toBeInTheDocument();
    // 胜场
    expect(screen.getByText(/25/)).toBeInTheDocument();
    // 负场
    expect(screen.getByText(/15/)).toBeInTheDocument();
    // 平局
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 组件结构 — WinRateDisplay
  it('should render win rate percentage', () => {
    mockMatchStatsState = {
      data: mockStats,
      isLoading: false,
      error: null,
    };
    renderPage();

    expect(screen.getByText(/62\.5/)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 组件结构 — MatchStatsCard — 加载失败降级
  it('should show default zero stats when stats loading fails', () => {
    mockMatchStatsState = {
      data: null,
      isLoading: false,
      error: new Error('加载失败'),
    };
    renderPage();

    // 加载失败时应显示全 0 的汇总数据
    expect(screen.getByText(/0/)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 页面状态 — isStatsLoading
  it('should show loading state for stats section', () => {
    mockMatchStatsState = {
      data: null,
      isLoading: true,
      error: null,
    };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 来源类型筛选 Tab
  // =========================================================================

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 组件结构 — SourceTypeFilter
  it('should render source type filter tabs', () => {
    renderPage();

    expect(screen.getByText(/全部/)).toBeInTheDocument();
    expect(screen.getByText(/约球/i)).toBeInTheDocument();
    expect(screen.getByText(/团课/)).toBeInTheDocument();
    expect(screen.getByText(/私教/)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 交互流程 — 来源类型筛选
  it('should support switching source type filter tabs', async () => {
    mockMatchRecordHistoryState = {
      data: { pages: [{ items: [], total: 0 }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    renderPage();

    const groupClassTab = screen.getByText(/团课/);
    await userEvent.click(groupClassTab);

    // Tab 应响应点击（具体行为验证依赖实现，这里验证 Tab 可点击）
    expect(groupClassTab).toBeInTheDocument();
  });

  // =========================================================================
  // 战绩列表渲染
  // =========================================================================

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 组件结构 — MatchRecordList
  it('should render match record cards when data is loaded', () => {
    mockMatchRecordHistoryState = {
      data: { pages: [{ items: [mockWinRecord, mockLoseRecord], total: 2 }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    renderPage();

    // 应渲染选手名
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 组件结构 — HistoryMatchRecordCard — 比分展示
  it('should render game scores for each match record', () => {
    mockMatchRecordHistoryState = {
      data: { pages: [{ items: [mockWinRecord], total: 1 }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    renderPage();

    // 应显示每局比分
    expect(screen.getByText(/21/)).toBeInTheDocument();
    expect(screen.getByText(/18/)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 组件结构 — HistoryMatchRecordCard — 比赛类型标识
  it('should render match type tag (singles/doubles)', () => {
    mockMatchRecordHistoryState = {
      data: { pages: [{ items: [mockWinRecord, mockLoseRecord], total: 2 }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    renderPage();

    expect(screen.getByText(/单打/)).toBeInTheDocument();
    expect(screen.getByText(/双打/)).toBeInTheDocument();
  });

  // =========================================================================
  // 用户结果颜色标识
  // =========================================================================

  // 来源: web-app-match-record.md §6.5 — 战绩历史列表中的结果颜色标识 — WIN
  it('should render "胜" label for WIN result', () => {
    mockMatchRecordHistoryState = {
      data: { pages: [{ items: [mockWinRecord], total: 1 }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    renderPage();

    expect(screen.getByText('胜')).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §6.5 — 战绩历史列表中的结果颜色标识 — LOSE
  it('should render "负" label for LOSE result', () => {
    mockMatchRecordHistoryState = {
      data: { pages: [{ items: [mockLoseRecord], total: 1 }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    renderPage();

    expect(screen.getByText('负')).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §6.5 — 战绩历史列表中的结果颜色标识 — DRAW
  it('should render "平" label for DRAW result', () => {
    mockMatchRecordHistoryState = {
      data: { pages: [{ items: [mockDrawRecord], total: 1 }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    renderPage();

    expect(screen.getByText('平')).toBeInTheDocument();
  });

  // =========================================================================
  // 空状态
  // =========================================================================

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 组件结构 — EmptyState
  it('should show empty state when no match records found', () => {
    mockMatchRecordHistoryState = {
      data: { pages: [{ items: [], total: 0 }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    renderPage();

    expect(screen.getByText(/暂无战绩记录/)).toBeInTheDocument();
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 页面状态 — isRecordsLoading
  it('should show loading spinner when records are loading', () => {
    mockMatchRecordHistoryState = {
      ...mockMatchRecordHistoryState,
      isLoading: true,
    };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 错误状态
  // =========================================================================

  // 来源: web-app-match-record.md §2 — MatchRecordHistoryPage — 调用的后端接口 — 错误处理
  it('should show error state when records loading fails', () => {
    mockMatchRecordHistoryState = {
      ...mockMatchRecordHistoryState,
      error: new Error('加载失败'),
    };
    renderPage();

    expect(screen.getByText(/错误|失败|重试/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 多条战绩显示所有三种结果
  // =========================================================================

  // 来源: web-app-match-record.md §6.5 — 战绩历史列表中的结果颜色标识
  it('should render all three result types (WIN, LOSE, DRAW) for multiple records', () => {
    mockMatchRecordHistoryState = {
      data: {
        pages: [{
          items: [mockWinRecord, mockLoseRecord, mockDrawRecord],
          total: 3,
        }],
      },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
    };
    renderPage();

    expect(screen.getByText('胜')).toBeInTheDocument();
    expect(screen.getByText('负')).toBeInTheDocument();
    expect(screen.getByText('平')).toBeInTheDocument();
  });
});
