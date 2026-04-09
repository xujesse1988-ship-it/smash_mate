/**
 * L1 集成测试: web-app/profile — 全部页面端内数据流
 *
 * 验证: 页面操作 → hook 调用 → API 请求 → 状态更新 → 页面响应
 * Mock 策略: 仅 MSW mock 网络层，不 mock hooks
 *
 * 与契约测试的区别:
 *   - 契约测试: mock hooks，验证页面渲染和交互
 *   - L1 集成测试: 不 mock hooks，验证完整数据流
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
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
const mockLocalStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    configurable: true,
  });
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Mock navigate and route params
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
let mockParamsId = 'current-user-id';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: mockParamsId }),
  };
});

// ---------------------------------------------------------------------------
// Mock auth store
// ---------------------------------------------------------------------------

const mockClearAuth = vi.fn();
vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      token: 'test-jwt-token',
      userId: 'current-user-id',
      isLoggedIn: true,
      setAuth: vi.fn(),
      clearAuth: mockClearAuth,
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

const mockUserPublicInfo = {
  id: 'current-user-id',
  nickname: '球友A',
  avatarUrl: 'https://example.com/avatar.jpg',
  bio: '热爱羽毛球',
  isCoach: false,
  createdAt: '2026-04-01T10:00:00.000Z',
};

const mockMatchStats = {
  totalMatches: 42,
  wins: 25,
  losses: 15,
  draws: 2,
  winRate: 62.5,
};

const mockCurrentUser = {
  id: 'current-user-id',
  phone: '138****1234',
  nickname: '球友A',
  avatarUrl: 'https://example.com/avatar.jpg',
  bio: '热爱羽毛球',
  isCoach: false,
  createdAt: '2026-04-01T10:00:00.000Z',
};

const mockCoachProfile = {
  userId: 'current-user-id',
  nickname: '教练A',
  avatarUrl: null,
  bio: '10年教学经验',
  specialties: ['singles', 'footwork'],
  studentCount: 15,
  groupClasses: [],
  privateLessonSlots: [],
};

// ---------------------------------------------------------------------------
// Import components (after mocks)
// ---------------------------------------------------------------------------

import { UserProfilePage } from '@web/features/profile/pages/UserProfilePage';
import { ProfileEditPage } from '@web/features/profile/pages/ProfileEditPage';
import { CoachProfileEditPage } from '@web/features/profile/pages/CoachProfileEditPage';
import { SettingsPage } from '@web/features/profile/pages/SettingsPage';

// =========================================================================
// UserProfilePage Integration Tests
// =========================================================================

describe('UserProfilePage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParamsId = 'current-user-id';
    localStorage.setItem('token', 'test-jwt-token');
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <UserProfilePage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it('should load user profile and match stats from API and display them', async () => {
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json({ data: mockUserPublicInfo });
      }),
      http.get('/api/users/:id/match-stats', () => {
        return HttpResponse.json({ data: mockMatchStats });
      }),
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('球友A')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText(/62\.5/)).toBeInTheDocument();
  });

  it('should display quick links when viewing own profile', async () => {
    mockParamsId = 'current-user-id';

    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json({ data: mockUserPublicInfo });
      }),
      http.get('/api/users/:id/match-stats', () => {
        return HttpResponse.json({ data: mockMatchStats });
      }),
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('球友A')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.getByText(/我发起的活动/)).toBeInTheDocument();
    expect(screen.getByText(/我参加的活动/)).toBeInTheDocument();
    expect(screen.getByText(/战绩记录/)).toBeInTheDocument();
    expect(screen.getByText(/个人资料/)).toBeInTheDocument();
    expect(screen.getByText(/设置/)).toBeInTheDocument();
  });

  it('should not show quick links when viewing other user profile', async () => {
    mockParamsId = 'other-user-id';

    const otherUser = {
      ...mockUserPublicInfo,
      id: 'other-user-id',
      nickname: '他人',
      bio: '其他用户简介',
    };

    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json({ data: otherUser });
      }),
      http.get('/api/users/:id/match-stats', () => {
        return HttpResponse.json({ data: mockMatchStats });
      }),
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('他人')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.queryByText(/我发起的活动/)).not.toBeInTheDocument();
    expect(screen.queryByText(/设置/)).not.toBeInTheDocument();
    expect(screen.getByText('其他用户简介')).toBeInTheDocument();
  });

  it('should navigate to correct routes when clicking quick links', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json({ data: mockUserPublicInfo });
      }),
      http.get('/api/users/:id/match-stats', () => {
        return HttpResponse.json({ data: mockMatchStats });
      }),
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText(/个人资料/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await user.click(screen.getByText(/个人资料/));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/edit');
  });

  it('should show "课程管理" and "我的报名" for coach users', async () => {
    const coachUser = { ...mockCurrentUser, isCoach: true };

    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json({ data: { ...mockUserPublicInfo, isCoach: true } });
      }),
      http.get('/api/users/:id/match-stats', () => {
        return HttpResponse.json({ data: mockMatchStats });
      }),
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: coachUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('球友A')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.getByText(/课程管理/)).toBeInTheDocument();
    expect(screen.getByText(/我的报名/)).toBeInTheDocument();
    expect(screen.queryByText(/我的课程/)).not.toBeInTheDocument();
  });

  it('should show error message when user is not found', async () => {
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json(
          { error: { code: 'USER_NOT_FOUND', message: '用户不存在' } },
          { status: 404 },
        );
      }),
      http.get('/api/users/:id/match-stats', () => {
        return HttpResponse.json({ data: mockMatchStats });
      }),
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText(/用户不存在/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });
});

// =========================================================================
// ProfileEditPage Integration Tests
// =========================================================================

describe('ProfileEditPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-jwt-token');
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ProfileEditPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it('should load current user and pre-fill the form', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByDisplayValue('球友A')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.getByAltText('头像预览')).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg',
    );
    expect(screen.getByRole('button', { name: /修改头像/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('热爱羽毛球')).toBeInTheDocument();
    expect(screen.getByText(/138\*{4}1234/)).toBeInTheDocument();
  });

  it('should validate nickname and show error for too short value', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByDisplayValue('球友A')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const nicknameInput = screen.getByDisplayValue('球友A');
    await user.clear(nicknameInput);
    await user.type(nicknameInput, 'x');
    await user.click(screen.getByRole('button', { name: /保存/i }));

    expect(screen.getByText(/昵称长度需在 2-20 个字符之间/)).toBeInTheDocument();
  });

  it('should validate avatar URL and show error for invalid format', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(globalThis, 'prompt').mockReturnValue('not-a-url');

    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /修改头像/i })).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await user.click(screen.getByRole('button', { name: /修改头像/i }));
    await user.click(screen.getByRole('button', { name: /保存/i }));

    expect(screen.getByText(/请输入合法的头像链接/)).toBeInTheDocument();
    promptSpy.mockRestore();
  });

  it('should call PUT /api/users/me with only changed fields on save', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;

    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
      http.put('/api/users/me', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          data: { ...mockCurrentUser, nickname: '新昵称' },
        });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByDisplayValue('球友A')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const nicknameInput = screen.getByDisplayValue('球友A');
    await user.clear(nicknameInput);
    await user.type(nicknameInput, '新昵称');
    await user.click(screen.getByRole('button', { name: /保存/i }));

    await waitFor(() => {
      expect(capturedBody).toEqual({ nickname: '新昵称' });
    });
  });

  it('should show unsaved changes dialog and navigate away on confirm', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByDisplayValue('球友A')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const nicknameInput = screen.getByDisplayValue('球友A');
    await user.clear(nicknameInput);
    await user.type(nicknameInput, '新昵称');

    await user.click(screen.getByRole('button', { name: /返回/i }));

    expect(screen.getByText(/未保存/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /确认|确定/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});

// =========================================================================
// CoachProfileEditPage Integration Tests
// =========================================================================

describe('CoachProfileEditPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-jwt-token');
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CoachProfileEditPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it('should show coach guard message for non-coach users', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({
          data: { ...mockCurrentUser, isCoach: false },
        });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText(/请先在设置中开启教练模式/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('should load and display coach profile for coach users', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({
          data: { ...mockCurrentUser, isCoach: true },
        });
      }),
      http.get('/api/coaches/:id', () => {
        return HttpResponse.json({ data: mockCoachProfile });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByDisplayValue('10年教学经验')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Specialty tags should be rendered
    expect(screen.getByText(/单打/)).toBeInTheDocument();
    expect(screen.getByText(/步法/)).toBeInTheDocument();
    expect(screen.getByText(/双打/)).toBeInTheDocument();
  });

  it('should call PUT /api/coaches/me on save with bio and specialties', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;

    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({
          data: { ...mockCurrentUser, isCoach: true },
        });
      }),
      http.get('/api/coaches/:id', () => {
        return HttpResponse.json({ data: mockCoachProfile });
      }),
      http.put('/api/coaches/me', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          data: {
            userId: 'current-user-id',
            bio: '新简介',
            specialties: ['singles', 'footwork'],
            updatedAt: '2026-04-08T10:00:00.000Z',
          },
        });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByDisplayValue('10年教学经验')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await user.click(screen.getByRole('button', { name: /保存/i }));

    await waitFor(() => {
      expect(capturedBody).toBeDefined();
    });

    const body = capturedBody as Record<string, unknown>;
    expect(body).toHaveProperty('bio');
    expect(body).toHaveProperty('specialties');
  });

  it('should initialize with empty values when coach profile does not exist yet', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({
          data: { ...mockCurrentUser, isCoach: true },
        });
      }),
      http.get('/api/coaches/:id', () => {
        return HttpResponse.json(
          { error: { code: 'COACHING_NOT_A_COACH', message: '不是教练' } },
          { status: 404 },
        );
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // All specialty tags should be rendered for selection
    expect(screen.getByText(/单打/)).toBeInTheDocument();
    expect(screen.getByText(/双打/)).toBeInTheDocument();
  });

  it('should show unsaved changes dialog when navigating back with changes', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({
          data: { ...mockCurrentUser, isCoach: true },
        });
      }),
      http.get('/api/coaches/:id', () => {
        return HttpResponse.json({ data: mockCoachProfile });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByDisplayValue('10年教学经验')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const bioInput = screen.getByDisplayValue('10年教学经验');
    await user.clear(bioInput);
    await user.type(bioInput, '新简介');

    await user.click(screen.getByRole('button', { name: /返回/i }));

    expect(screen.getByText(/未保存/)).toBeInTheDocument();
  });
});

// =========================================================================
// SettingsPage Integration Tests
// =========================================================================

describe('SettingsPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-jwt-token');
  });

  function renderPage() {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SettingsPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  }

  it('should render settings page with all sections', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText(/教练模式/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.getByText(/修改手机号/)).toBeInTheDocument();
    expect(screen.getByText(/关于我们/)).toBeInTheDocument();
    expect(screen.getByText(/退出登录/)).toBeInTheDocument();
  });

  it('should show coach mode switch as off for non-coach user', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({
          data: { ...mockCurrentUser, isCoach: false },
        });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByRole('switch')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const switchEl = screen.getByRole('switch');
    expect(switchEl).not.toBeChecked();
    expect(switchEl).not.toBeDisabled();
  });

  it('should show coach mode switch as on and disabled for coach user', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({
          data: { ...mockCurrentUser, isCoach: true },
        });
      }),
    );

    renderPage();

    // Wait for the switch to become checked (data loaded)
    await waitFor(
      () => {
        const switchEl = screen.getByRole('switch');
        expect(switchEl).toBeChecked();
      },
      { timeout: 10000 },
    );

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toBeDisabled();
  });

  it('should show confirm dialog and call API when enabling coach mode', async () => {
    const user = userEvent.setup();
    let apiCalled = false;

    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({
          data: { ...mockCurrentUser, isCoach: false },
        });
      }),
      http.put('/api/users/me/coach-role', async () => {
        apiCalled = true;
        return HttpResponse.json({
          data: { ...mockCurrentUser, isCoach: true },
        });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByRole('switch')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await user.click(screen.getByRole('switch'));

    // Confirm dialog should appear
    expect(screen.getByText(/确认开启/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /确认|确定/i }));

    await waitFor(() => {
      expect(apiCalled).toBe(true);
    });
  });

  it('should logout and navigate to /login when confirmed', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText(/退出登录/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await user.click(screen.getByText(/退出登录/));
    expect(screen.getByText(/确定退出登录/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /确认|确定/i }));

    expect(mockClearAuth).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should show "该功能暂未开放" when clicking change phone number', async () => {
    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText(/修改手机号/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const phoneEntry = screen.getByText(/修改手机号/);
    const parentEl = phoneEntry.closest('[role="button"]') || phoneEntry;
    expect(parentEl).toHaveAttribute('aria-disabled', 'true');
  });

  it('should show app info when clicking "关于我们"', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/users/me', () => {
        return HttpResponse.json({ data: mockCurrentUser });
      }),
    );

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText(/关于我们/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const aboutEntry = screen.getByText(/关于我们/);
    await user.click(aboutEntry.closest('[role="button"]') || aboutEntry);

    expect(screen.getByText(/羽约/)).toBeInTheDocument();
  });
});
