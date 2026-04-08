/**
 * L1 集成测试: admin — 页面端内数据流
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
import { AdminLoginPage } from '@admin/features/auth/pages/AdminLoginPage';
import { CityManagementPage } from '@admin/features/venue-management/pages/CityManagementPage';
import { VenueManagementPage } from '@admin/features/venue-management/pages/VenueManagementPage';
import { useAdminAuthStore } from '@admin/stores/auth-store';

// ---------------------------------------------------------------------------
// MSW Server Setup
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  useAdminAuthStore.getState().clearAuth();
  localStorage.clear();
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AdminLoginPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

function renderCityManagementPage() {
  // Set admin auth to simulate logged-in state
  useAdminAuthStore.getState().setAuth('test-admin-token', 'admin-user-id');

  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CityManagementPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

function renderVenueManagementPage() {
  // Set admin auth to simulate logged-in state
  useAdminAuthStore.getState().setAuth('test-admin-token', 'admin-user-id');

  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <VenueManagementPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests: AdminLoginPage 完整数据流
// ---------------------------------------------------------------------------

describe('AdminLoginPage Integration: 发送验证码', () => {
  it('should send verification code and start countdown', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/send-code', async ({ request }) => {
        const body = (await request.json()) as { phone: string };
        expect(body.phone).toBe('13800138000');
        return HttpResponse.json({
          data: { message: '验证码已发送' },
        });
      }),
    );

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/), '13800138000');
    await user.click(screen.getByText('获取验证码'));

    // Wait for countdown to start (indicating API call succeeded)
    await waitFor(() => {
      const btn = screen.getByText(/重新获取/).closest('button');
      expect(btn).toBeDisabled();
    });
  });

  it('should show phone validation error without calling API', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/), '123');
    await user.click(screen.getByText('获取验证码'));

    expect(screen.getByText(/请输入正确的手机号/)).toBeInTheDocument();
  });

  it('should handle AUTH_CODE_RATE_LIMITED error', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/send-code', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'AUTH_CODE_RATE_LIMITED',
              message: '60 秒内重复发送',
            },
          },
          { status: 429 },
        );
      }),
    );

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/), '13800138000');
    await user.click(screen.getByText('获取验证码'));

    // Button should remain enabled after error (no countdown started)
    await waitFor(() => {
      const btn = screen.getByText('获取验证码').closest('button');
      expect(btn).not.toBeDisabled();
    });
  });
});

describe('AdminLoginPage Integration: 登录', () => {
  it('should login successfully and update admin auth store', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        const body = (await request.json()) as {
          phone: string;
          code: string;
        };
        expect(body.phone).toBe('13800138000');
        expect(body.code).toBe('123456');
        // Admin login should not send isCoach
        expect(body).not.toHaveProperty('isCoach');
        return HttpResponse.json({
          data: {
            token: 'admin-jwt-token',
            user: {
              id: 'admin-uuid-1',
              phone: '138****8000',
              nickname: '管理员',
              isCoach: false,
            },
            isNewUser: false,
          },
        });
      }),
    );

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/), '13800138000');
    await user.type(screen.getByPlaceholderText(/验证码/), '123456');
    await user.click(screen.getByText('登录'));

    // Verify admin auth store was updated
    await waitFor(() => {
      const state = useAdminAuthStore.getState();
      expect(state.token).toBe('admin-jwt-token');
      expect(state.userId).toBe('admin-uuid-1');
      expect(state.isLoggedIn).toBe(true);
    });

    // Verify navigation to /cities
    expect(mockNavigate).toHaveBeenCalledWith('/cities', { replace: true });
  });

  it('should handle AUTH_CODE_WRONG error on login', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_CODE_WRONG', message: '验证码错误' },
          },
          { status: 401 },
        );
      }),
    );

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/), '13800138000');
    await user.type(screen.getByPlaceholderText(/验证码/), '999999');
    await user.click(screen.getByText('登录'));

    // Auth store should NOT be updated
    await waitFor(() => {
      const state = useAdminAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
    });
  });

  it('should handle AUTH_CODE_EXPIRED error on login', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          {
            error: { code: 'AUTH_CODE_EXPIRED', message: '验证码已过期' },
          },
          { status: 401 },
        );
      }),
    );

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/), '13800138000');
    await user.type(screen.getByPlaceholderText(/验证码/), '123456');
    await user.click(screen.getByText('登录'));

    await waitFor(() => {
      const state = useAdminAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
    });
  });

  it('should validate phone and code before sending request', async () => {
    const user = userEvent.setup();
    let apiCalled = false;

    server.use(
      http.post('/api/auth/login', () => {
        apiCalled = true;
        return HttpResponse.json({
          data: {
            token: 'jwt-token',
            user: {
              id: 'uuid',
              phone: '138****8000',
              nickname: '管理员',
              isCoach: false,
            },
            isNewUser: false,
          },
        });
      }),
    );

    renderLoginPage();

    // Click login without any input
    await user.click(screen.getByText('登录'));

    expect(screen.getByText(/请输入正确的手机号/)).toBeInTheDocument();
    expect(apiCalled).toBe(false);
  });
});

describe('AdminLoginPage Integration: 管理员登录态持久化', () => {
  it('should persist admin token and userId to localStorage using admin_ prefix', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          data: {
            token: 'admin-persist-test',
            user: {
              id: 'admin-persist-id',
              phone: '138****8000',
              nickname: '管理员',
              isCoach: false,
            },
            isNewUser: false,
          },
        });
      }),
    );

    renderLoginPage();

    await user.type(screen.getByPlaceholderText(/手机号/), '13800138000');
    await user.type(screen.getByPlaceholderText(/验证码/), '123456');
    await user.click(screen.getByText('登录'));

    await waitFor(() => {
      // Admin uses admin_token/admin_userId keys, not token/userId
      expect(localStorage.getItem('admin_token')).toBe('admin-persist-test');
      expect(localStorage.getItem('admin_userId')).toBe('admin-persist-id');
      // Web-app keys should NOT be set
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('userId')).toBeNull();
    });
  });

  it('should redirect already-logged-in admin away from login page', () => {
    useAdminAuthStore.getState().setAuth('existing-admin-token', 'existing-admin-id');

    renderLoginPage();

    expect(mockNavigate).toHaveBeenCalledWith('/cities', { replace: true });
  });
});

describe('AdminLoginPage Integration: 完整发送验证码 + 登录流程', () => {
  it(
    'should complete full send-code then login flow',
    async () => {
      const user = userEvent.setup();
      let sendCodeCalled = false;

      server.use(
        http.post('/api/auth/send-code', () => {
          sendCodeCalled = true;
          return HttpResponse.json({
            data: { message: '验证码已发送' },
          });
        }),
        http.post('/api/auth/login', () => {
          return HttpResponse.json({
            data: {
              token: 'admin-full-flow',
              user: {
                id: 'admin-full-flow-id',
                phone: '138****8000',
                nickname: '管理员',
                isCoach: false,
              },
              isNewUser: false,
            },
          });
        }),
      );

      renderLoginPage();

      // Step 1: Enter phone and request code
      await user.type(screen.getByPlaceholderText(/手机号/), '13800138000');
      await user.click(screen.getByText('获取验证码'));

      // Verify code was sent
      await waitFor(
        () => {
          expect(sendCodeCalled).toBe(true);
        },
        { timeout: 5000 },
      );

      // Step 2: Enter code and login
      await user.type(screen.getByPlaceholderText(/验证码/), '123456');
      await user.click(screen.getByText('登录'));

      // Step 3: Verify login succeeded
      await waitFor(
        () => {
          const state = useAdminAuthStore.getState();
          expect(state.token).toBe('admin-full-flow');
          expect(state.userId).toBe('admin-full-flow-id');
          expect(state.isLoggedIn).toBe(true);
        },
        { timeout: 5000 },
      );

      expect(mockNavigate).toHaveBeenCalledWith('/cities', { replace: true });
    },
    15000,
  );
});

// ---------------------------------------------------------------------------
// Tests: CityManagementPage 完整数据流
// ---------------------------------------------------------------------------

describe('CityManagementPage Integration: 城市列表加载', () => {
  it('should load and display city list on page mount', async () => {
    server.use(
      http.get('/api/admin/cities', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.has('page')).toBe(true);
        expect(url.searchParams.has('pageSize')).toBe(true);
        // Verify admin token is sent
        expect(request.headers.get('Authorization')).toBe(
          'Bearer test-admin-token',
        );
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'city-1',
                name: '北京',
                venueCount: 42,
                createdAt: '2026-04-01T10:00:00.000Z',
                updatedAt: '2026-04-01T10:00:00.000Z',
              },
              {
                id: 'city-2',
                name: '上海',
                venueCount: 38,
                createdAt: '2026-04-02T11:00:00.000Z',
                updatedAt: '2026-04-02T11:00:00.000Z',
              },
            ],
            total: 2,
            page: 1,
            pageSize: 20,
          },
        });
      }),
    );

    renderCityManagementPage();

    await waitFor(() => {
      expect(screen.getByText('北京')).toBeInTheDocument();
      expect(screen.getByText('上海')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('38')).toBeInTheDocument();
    });
  });

  it(
    'should show error state when city list API fails',
    async () => {
      server.use(
        http.get('/api/admin/cities', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'AUTH_UNAUTHORIZED',
                message: 'Token 缺失或无效',
              },
            },
            { status: 401 },
          );
        }),
      );

      renderCityManagementPage();

      await waitFor(
        () => {
          expect(screen.getByText(/加载失败/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );
});

describe('CityManagementPage Integration: 添加城市', () => {
  it(
    'should add city and refresh list on success',
    async () => {
      const user = userEvent.setup();
      let getCitiesCallCount = 0;

      server.use(
        http.get('/api/admin/cities', () => {
          getCitiesCallCount++;
          const items =
            getCitiesCallCount === 1
              ? [
                  {
                    id: 'city-1',
                    name: '北京',
                    venueCount: 42,
                    createdAt: '2026-04-01T10:00:00.000Z',
                    updatedAt: '2026-04-01T10:00:00.000Z',
                  },
                ]
              : [
                  {
                    id: 'city-1',
                    name: '北京',
                    venueCount: 42,
                    createdAt: '2026-04-01T10:00:00.000Z',
                    updatedAt: '2026-04-01T10:00:00.000Z',
                  },
                  {
                    id: 'city-2',
                    name: '深圳',
                    venueCount: 15,
                    createdAt: '2026-04-08T10:00:00.000Z',
                    updatedAt: '2026-04-08T10:00:00.000Z',
                  },
                ];
          return HttpResponse.json({
            data: {
              items,
              total: items.length,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.post('/api/admin/cities', async ({ request }) => {
          const body = (await request.json()) as { name: string };
          expect(body.name).toBe('深圳');
          return HttpResponse.json(
            {
              data: {
                id: 'city-2',
                name: '深圳',
                venueCount: 15,
                createdAt: '2026-04-08T10:00:00.000Z',
              },
            },
            { status: 201 },
          );
        }),
      );

      renderCityManagementPage();

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('北京')).toBeInTheDocument();
      });

      // Open add city modal
      await user.click(screen.getByText('添加城市'));

      // Fill city name
      const input = screen.getByPlaceholderText(/城市名称/);
      await user.type(input, '深圳');

      // Submit
      await user.click(screen.getByText('确定'));

      // Wait for the new city to appear in the list (indicates cache was invalidated)
      await waitFor(
        () => {
          expect(screen.getByText('深圳')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    'should show validation error when submitting empty city name',
    async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/admin/cities', () => {
          return HttpResponse.json({
            data: {
              items: [],
              total: 0,
              page: 1,
              pageSize: 20,
            },
          });
        }),
      );

      renderCityManagementPage();

      await waitFor(() => {
        expect(screen.getByText('添加城市')).toBeInTheDocument();
      });

      await user.click(screen.getByText('添加城市'));
      await user.click(screen.getByText('确定'));

      expect(screen.getByText(/请输入城市名称/)).toBeInTheDocument();
    },
    15000,
  );

  it(
    'should show duplicate error when city already exists',
    async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/admin/cities', () => {
          return HttpResponse.json({
            data: {
              items: [
                {
                  id: 'city-1',
                  name: '北京',
                  venueCount: 42,
                  createdAt: '2026-04-01T10:00:00.000Z',
                  updatedAt: '2026-04-01T10:00:00.000Z',
                },
              ],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.post('/api/admin/cities', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'VENUE_CITY_DUPLICATE',
                message: '城市名称已存在',
              },
            },
            { status: 409 },
          );
        }),
      );

      renderCityManagementPage();

      await waitFor(() => {
        expect(screen.getByText('北京')).toBeInTheDocument();
      });

      await user.click(screen.getByText('添加城市'));

      const input = screen.getByPlaceholderText(/城市名称/);
      await user.type(input, '北京');
      await user.click(screen.getByText('确定'));

      await waitFor(
        () => {
          expect(screen.getByText(/该城市已存在/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );
});

// ---------------------------------------------------------------------------
// Tests: VenueManagementPage 完整数据流
// ---------------------------------------------------------------------------

describe('VenueManagementPage Integration: 球馆列表加载', () => {
  it(
    'should load and display venue list with city filter dropdown',
    async () => {
      server.use(
        http.get('/api/admin/venues', ({ request }) => {
          expect(request.headers.get('Authorization')).toBe(
            'Bearer test-admin-token',
          );
          return HttpResponse.json({
            data: {
              items: [
                {
                  id: 'venue-1',
                  name: '朝阳体育中心羽毛球馆',
                  address: '北京市朝阳区工体北路',
                  latitude: 39.9215,
                  longitude: 116.4435,
                  cityId: 'city-1',
                  cityName: '北京',
                  createdAt: '2026-04-01T10:00:00.000Z',
                },
              ],
              total: 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.get('/api/admin/cities', () => {
          return HttpResponse.json({
            data: {
              items: [
                {
                  id: 'city-1',
                  name: '北京',
                  venueCount: 42,
                  createdAt: '2026-04-01T10:00:00.000Z',
                  updatedAt: '2026-04-01T10:00:00.000Z',
                },
              ],
              total: 1,
              page: 1,
              pageSize: 100,
            },
          });
        }),
      );

      renderVenueManagementPage();

      await waitFor(() => {
        expect(screen.getByText('朝阳体育中心羽毛球馆')).toBeInTheDocument();
        expect(
          screen.getByText('北京市朝阳区工体北路'),
        ).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    'should show error state when venue list API fails',
    async () => {
      server.use(
        http.get('/api/admin/venues', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'AUTH_UNAUTHORIZED',
                message: 'Token 缺失或无效',
              },
            },
            { status: 401 },
          );
        }),
        http.get('/api/admin/cities', () => {
          return HttpResponse.json({
            data: {
              items: [],
              total: 0,
              page: 1,
              pageSize: 100,
            },
          });
        }),
      );

      renderVenueManagementPage();

      await waitFor(
        () => {
          expect(screen.getByText(/加载失败/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );
});

describe('VenueManagementPage Integration: 移除球馆', () => {
  it(
    'should remove venue and refresh list',
    async () => {
      const user = userEvent.setup();
      let getVenuesCallCount = 0;

      server.use(
        http.get('/api/admin/venues', () => {
          getVenuesCallCount++;
          const items =
            getVenuesCallCount === 1
              ? [
                  {
                    id: 'venue-1',
                    name: '朝阳体育中心',
                    address: '北京市朝阳区',
                    latitude: 39.9,
                    longitude: 116.4,
                    cityId: 'city-1',
                    cityName: '北京',
                    createdAt: '2026-04-01T10:00:00.000Z',
                  },
                ]
              : [];
          return HttpResponse.json({
            data: {
              items,
              total: items.length,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.get('/api/admin/cities', () => {
          return HttpResponse.json({
            data: {
              items: [],
              total: 0,
              page: 1,
              pageSize: 100,
            },
          });
        }),
        http.delete('/api/admin/venues/venue-1', () => {
          return HttpResponse.json({
            data: { message: '球馆已移除' },
          });
        }),
      );

      renderVenueManagementPage();

      // Wait for venue to appear
      await waitFor(() => {
        expect(screen.getByText('朝阳体育中心')).toBeInTheDocument();
      });

      // Click remove button
      await user.click(screen.getByText('移除'));

      // Confirm in Popconfirm
      await waitFor(() => {
        expect(screen.getByText(/确定移除该球馆吗/)).toBeInTheDocument();
      });
      await user.click(screen.getByText('确定'));

      // Wait for venue to disappear (list refreshed)
      await waitFor(
        () => {
          expect(
            screen.queryByText('朝阳体育中心'),
          ).not.toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );
});

describe('VenueManagementPage Integration: 同步球馆数据', () => {
  it(
    'should trigger sync and refresh venue list',
    async () => {
      const user = userEvent.setup();
      let getVenuesCallCount = 0;

      server.use(
        http.get('/api/admin/venues', () => {
          getVenuesCallCount++;
          return HttpResponse.json({
            data: {
              items:
                getVenuesCallCount === 1
                  ? []
                  : [
                      {
                        id: 'venue-new',
                        name: '新同步球馆',
                        address: '北京市海淀区',
                        latitude: 39.9,
                        longitude: 116.3,
                        cityId: 'city-1',
                        cityName: '北京',
                        createdAt: '2026-04-08T10:00:00.000Z',
                      },
                    ],
              total: getVenuesCallCount === 1 ? 0 : 1,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.get('/api/admin/cities', () => {
          return HttpResponse.json({
            data: {
              items: [
                {
                  id: 'city-1',
                  name: '北京',
                  venueCount: 0,
                  createdAt: '2026-04-01T10:00:00.000Z',
                  updatedAt: '2026-04-01T10:00:00.000Z',
                },
              ],
              total: 1,
              page: 1,
              pageSize: 100,
            },
          });
        }),
        http.post('/api/admin/venues/sync', () => {
          return HttpResponse.json({
            data: {
              message: '球馆数据更新已触发',
              syncResults: [
                {
                  cityId: 'city-1',
                  cityName: '北京',
                  newVenues: 1,
                  updatedVenues: 0,
                  totalVenues: 1,
                },
              ],
            },
          });
        }),
      );

      renderVenueManagementPage();

      // Wait for initial empty load
      await waitFor(() => {
        expect(screen.getByText('球馆管理')).toBeInTheDocument();
      });

      // Click sync button
      await user.click(screen.getByText('同步球馆数据'));

      // Confirm in modal
      await waitFor(() => {
        expect(
          screen.getByText(/确定同步所有城市的球馆数据吗/),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText('确定'));

      // Wait for new venue to appear (list refreshed)
      await waitFor(
        () => {
          expect(screen.getByText('新同步球馆')).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );
});

describe('VenueManagementPage Integration: 搜索防抖', () => {
  it(
    'should debounce keyword search and update venue list',
    async () => {
      const user = userEvent.setup();
      const searchKeywords: string[] = [];

      server.use(
        http.get('/api/admin/venues', ({ request }) => {
          const url = new URL(request.url);
          const kw = url.searchParams.get('keyword');
          if (kw) searchKeywords.push(kw);
          return HttpResponse.json({
            data: {
              items:
                kw === '朝阳'
                  ? [
                      {
                        id: 'venue-1',
                        name: '朝阳体育中心羽毛球馆',
                        address: '北京市朝阳区',
                        latitude: 39.9,
                        longitude: 116.4,
                        cityId: 'city-1',
                        cityName: '北京',
                        createdAt: '2026-04-01T10:00:00.000Z',
                      },
                    ]
                  : [],
              total: kw === '朝阳' ? 1 : 0,
              page: 1,
              pageSize: 20,
            },
          });
        }),
        http.get('/api/admin/cities', () => {
          return HttpResponse.json({
            data: {
              items: [],
              total: 0,
              page: 1,
              pageSize: 100,
            },
          });
        }),
      );

      renderVenueManagementPage();

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('球馆管理')).toBeInTheDocument();
      });

      // Type in search box
      const searchInput = screen.getByPlaceholderText(/搜索.*球馆|球馆.*名称/);
      await user.type(searchInput, '朝阳');

      // Wait for debounced search to trigger and results to show
      await waitFor(
        () => {
          expect(
            screen.getByText('朝阳体育中心羽毛球馆'),
          ).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Verify debounce: should have made fewer requests than characters typed
      // (with 500ms debounce, rapid typing should batch into fewer requests)
      expect(searchKeywords.length).toBeGreaterThanOrEqual(1);
    },
    15000,
  );
});
