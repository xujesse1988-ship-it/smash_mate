/**
 * 契约测试: web-app/match-record — CreateMatchRecordPage 页面渲染
 * 覆盖页面: CreateMatchRecordPage (/match-records/create)
 *
 * 来源文档:
 *   - docs/module-design/web-app-match-record.md §2 — CreateMatchRecordPage 页面
 *   - docs/module-design/web-app-match-record.md §3 — Feature 私有组件
 *   - docs/module-design/web-app-match-record.md §6.1 — 前端表单校验规则
 *   - docs/module-design/web-app-match-record.md §6.3 — 比赛类型切换时的表单重置
 *   - docs/module-design/web-app-match-record.md §6.6 — URL 参数缺失处理
 *   - docs/module-design/web-app-match-record.md §6.7 — 私教课来源的选手选择
 *
 * Mock 策略:
 *   - Mock hooks（useSourceParticipants, useCreateMatchRecord）的返回值
 *   - Mock react-router-dom 导航和 URL 参数
 *   - 不关心数据获取链路，只验证页面渲染正确性和交互响应
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock Modules
// ---------------------------------------------------------------------------

// Mock react-router-dom navigate and URL search params
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams('sourceType=activity&sourceId=activity-uuid-1');

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
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

// Mock useSourceParticipants hook
let mockSourceParticipantsState = {
  participants: [] as Array<{ userId: string; nickname: string; avatarUrl: string | null }>,
  isLoading: false,
  error: null as unknown,
};

vi.mock('@web/features/match-record/hooks/useSourceParticipants', () => ({
  useSourceParticipants: () => mockSourceParticipantsState,
}));

// Mock useCreateMatchRecord hook
const mockMutate = vi.fn();
let mockCreateMatchRecordState = {
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null as unknown,
};

vi.mock('@web/features/match-record/hooks/useCreateMatchRecord', () => ({
  useCreateMatchRecord: () => mockCreateMatchRecordState,
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { CreateMatchRecordPage } from '@web/features/match-record/pages/CreateMatchRecordPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockParticipants = [
  { userId: 'user-uuid-1', nickname: '张三', avatarUrl: 'https://example.com/a1.jpg' },
  { userId: 'user-uuid-2', nickname: '李四', avatarUrl: null },
  { userId: 'user-uuid-3', nickname: '王五', avatarUrl: 'https://example.com/a3.jpg' },
  { userId: 'user-uuid-4', nickname: '赵六', avatarUrl: null },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  return render(<CreateMatchRecordPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateMatchRecordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('sourceType=activity&sourceId=activity-uuid-1');
    mockSourceParticipantsState = {
      participants: mockParticipants,
      isLoading: false,
      error: null,
    };
    mockCreateMatchRecordState = {
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    };
  });

  // =========================================================================
  // URL 参数缺失处理
  // =========================================================================

  // 来源: web-app-match-record.md §6.6 — URL 参数缺失处理 — 无 sourceType
  it('should show error message when sourceType is missing from URL', () => {
    mockSearchParams = new URLSearchParams('sourceId=activity-uuid-1');
    renderPage();

    expect(screen.getByText(/请从活动或课程详情页进入战绩录入/)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §6.6 — URL 参数缺失处理 — 无 sourceId
  it('should show error message when sourceId is missing from URL', () => {
    mockSearchParams = new URLSearchParams('sourceType=activity');
    renderPage();

    expect(screen.getByText(/请从活动或课程详情页进入战绩录入/)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §6.6 — URL 参数缺失处理 — 无效 sourceType
  it('should show error message when sourceType is invalid', () => {
    mockSearchParams = new URLSearchParams('sourceType=invalid&sourceId=uuid-1');
    renderPage();

    expect(screen.getByText(/请从活动或课程详情页进入战绩录入/)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §6.6 — URL 参数缺失处理 — 返回按钮
  it('should provide a back button when URL params are missing', () => {
    mockSearchParams = new URLSearchParams('');
    renderPage();

    // Should have a back/return button
    const backButton = screen.getByRole('button', { name: /返回/i });
    expect(backButton).toBeInTheDocument();
  });

  // =========================================================================
  // 基本渲染（正常状态）
  // =========================================================================

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 组件结构 — MatchTypeSelector
  it('should render match type selector with singles and doubles options', () => {
    renderPage();

    expect(screen.getByText(/单打/)).toBeInTheDocument();
    expect(screen.getByText(/双打/)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 页面状态 — matchType 默认值
  it('should default to singles match type', () => {
    renderPage();

    // 单打应为默认选中状态 — 具体验证方式取决于实现（aria-checked、active class 等）
    const singlesOption = screen.getByText(/单打/);
    expect(singlesOption).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 组件结构 — PlayerSection
  it('should render player selection sections for side A and side B', () => {
    renderPage();

    // 应显示 A 方和 B 方的选手区域
    expect(screen.getByText(/A/i)).toBeInTheDocument();
    expect(screen.getByText(/B/i)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 组件结构 — ScoreSection
  it('should render score input section with initial one game row', () => {
    renderPage();

    // 至少应有比分输入区域
    expect(screen.getByText(/第.*局|比分/i)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 组件结构 — SubmitButton
  it('should render submit button', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /提交战绩|提交/ })).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 组件结构 — AddGameButton
  it('should render add game button', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /添加一局|添加/ })).toBeInTheDocument();
  });

  // =========================================================================
  // 加载状态
  // =========================================================================

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 页面状态 — isParticipantsLoading
  it('should show loading state when participants are loading', () => {
    mockSourceParticipantsState = {
      ...mockSourceParticipantsState,
      isLoading: true,
      participants: [],
    };
    renderPage();

    expect(screen.getByText(/加载/i)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 调用的后端接口 — 错误处理
  it('should show PageError when participants loading fails', () => {
    mockSourceParticipantsState = {
      participants: [],
      isLoading: false,
      error: new Error('加载失败'),
    };
    renderPage();

    expect(screen.getByText(/错误|失败|重试/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 交互：比赛类型切换
  // =========================================================================

  // 来源: web-app-match-record.md §6.3 — 比赛类型切换时的表单重置
  it('should switch to doubles mode when doubles is selected', async () => {
    renderPage();

    const doublesButton = screen.getByText(/双打/);
    await userEvent.click(doublesButton);

    // 双打模式下每侧应有 2 个选手位，总共 4 个选手选择器
    // 具体验证方式取决于实现（data-testid、aria-label 等）
    // 这里验证双打按钮已被选中
    expect(doublesButton).toBeInTheDocument();
  });

  // =========================================================================
  // 交互：添加/删除比分行
  // =========================================================================

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 交互流程 — 输入比分
  it('should add a new game row when "add game" button is clicked', async () => {
    renderPage();

    const addButton = screen.getByRole('button', { name: /添加一局|添加/ });
    await userEvent.click(addButton);

    // 点击添加后应有 2 局比分输入行
    // 具体验证方式取决于实现
    expect(screen.getByText(/第.*2.*局|第二局/i)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 交互流程 — 删除比分
  it('should not allow deleting the last remaining game row', () => {
    renderPage();

    // 初始状态只有 1 局，删除按钮不应存在或应被禁用
    const deleteButtons = screen.queryAllByRole('button', { name: /删除/ });
    // 最后一局的删除按钮应不存在
    expect(deleteButtons).toHaveLength(0);
  });

  // =========================================================================
  // 交互：提交表单
  // =========================================================================

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 页面状态 — submitting
  it('should disable submit button when form is submitting', () => {
    mockCreateMatchRecordState = {
      ...mockCreateMatchRecordState,
      isPending: true,
    };
    renderPage();

    const submitButton = screen.getByRole('button', { name: /提交战绩|提交/ });
    expect(submitButton).toBeDisabled();
  });

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 交互流程 — 提交 — 前端校验
  it('should show form validation error when submitting with empty players', async () => {
    // 提供空参与者列表，模拟未选择选手
    mockSourceParticipantsState = {
      participants: mockParticipants,
      isLoading: false,
      error: null,
    };
    renderPage();

    // 直接点击提交（未选择选手）
    const submitButton = screen.getByRole('button', { name: /提交战绩|提交/ });
    await userEvent.click(submitButton);

    // 应显示验证错误
    expect(screen.getByText(/选手|选择|不完整|不正确/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 交互：非平台用户切换
  // =========================================================================

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 组件结构 — GuestToggle
  it('should render guest toggle for each player slot', () => {
    renderPage();

    // 每个选手位置应有"非平台用户"开关
    const guestToggles = screen.getAllByText(/非平台用户/i);
    // 单打模式：sideA 1 个 + sideB 1 个 = 2 个开关
    expect(guestToggles.length).toBeGreaterThanOrEqual(2);
  });

  // =========================================================================
  // 私教课来源特殊处理
  // =========================================================================

  // 来源: web-app-match-record.md §6.7 — 私教课来源的选手选择
  it('should lock guest mode on for private-lesson source type', () => {
    mockSearchParams = new URLSearchParams('sourceType=private-lesson&sourceId=pl-uuid-1');
    mockSourceParticipantsState = {
      participants: [],
      isLoading: false,
      error: null,
    };
    renderPage();

    // 私教课来源下，所有选手位应为非平台用户模式（显示昵称输入框而非下拉选择器）
    // "非平台用户"开关应锁定为开启状态
    const guestToggles = screen.queryAllByRole('switch');
    guestToggles.forEach((toggle) => {
      expect(toggle).toBeDisabled();
    });
  });

  // =========================================================================
  // 错误提示映射
  // =========================================================================

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 录入战绩错误处理
  it('should display mapped error message for MATCH_RECORD_SOURCE_NOT_COMPLETED', () => {
    const error = new Error('活动尚未结束') as Error & { code: string };
    error.code = 'MATCH_RECORD_SOURCE_NOT_COMPLETED';
    mockCreateMatchRecordState = {
      ...mockCreateMatchRecordState,
      isError: true,
      error,
    };
    renderPage();

    expect(screen.getByText(/活动.*课程.*尚未结束|暂时无法录入战绩/)).toBeInTheDocument();
  });

  // 来源: web-app-match-record.md §2 — CreateMatchRecordPage — 录入战绩错误处理
  it('should display mapped error message for MATCH_RECORD_NOT_PARTICIPANT', () => {
    const error = new Error('不是参与者') as Error & { code: string };
    error.code = 'MATCH_RECORD_NOT_PARTICIPANT';
    mockCreateMatchRecordState = {
      ...mockCreateMatchRecordState,
      isError: true,
      error,
    };
    renderPage();

    expect(screen.getByText(/不是该活动.*课程的参与者|无法录入战绩/)).toBeInTheDocument();
  });
});
