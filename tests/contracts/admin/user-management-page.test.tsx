/**
 * 契约测试: admin/user-management — UserManagementPage 页面渲染
 * 覆盖页面: UserManagementPage (/users)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

const { mockMessageError, mockGetAllUsers } = vi.hoisted(() => ({
  mockMessageError: vi.fn(),
  mockGetAllUsers: vi.fn(),
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      ...actual.message,
      error: mockMessageError,
    },
  };
});

vi.mock('@admin/features/user-management/api/user-management-api', () => ({
  getAllUsers: () => mockGetAllUsers(),
}));

import { UserManagementPage } from '@admin/features/user-management/pages/UserManagementPage';

describe('UserManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and render user list', async () => {
    mockGetAllUsers.mockResolvedValue([
      {
        id: 'user-uuid-1',
        phone: '13800001234',
        nickname: '普通用户A',
        avatarUrl: null,
        bio: '喜欢约球',
        isCoach: false,
        createdAt: '2026-04-01T10:00:00.000Z',
      },
      {
        id: 'coach-uuid-1',
        phone: '13900004567',
        nickname: '教练张',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: '10年教学经验',
        isCoach: true,
        createdAt: '2026-04-02T10:00:00.000Z',
      },
    ]);

    render(<UserManagementPage />);

    expect(screen.getByText('用户管理')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('普通用户A')).toBeInTheDocument();
    });

    expect(mockGetAllUsers).toHaveBeenCalledTimes(1);
    expect(screen.getByText('教练张')).toBeInTheDocument();
    expect(screen.getByText('普通用户')).toBeInTheDocument();
    expect(screen.getByText('教练')).toBeInTheDocument();
    expect(screen.getByText('13800001234')).toBeInTheDocument();
    expect(screen.getByText('13900004567')).toBeInTheDocument();
  });

  it('should show error message when loading fails', async () => {
    mockGetAllUsers.mockRejectedValue(new Error('获取失败'));

    render(<UserManagementPage />);

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('获取失败');
    });
  });
});
