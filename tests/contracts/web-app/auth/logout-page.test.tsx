/**
 * 契约测试: web-app/auth — LogoutPage 页面行为
 * 覆盖页面: LogoutPage (/logout)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

const mockClearAuth = vi.fn();

vi.mock('@web/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      clearAuth: mockClearAuth,
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
    <div data-testid="navigate" data-to={to} data-replace={String(Boolean(replace))} />
  ),
}));

import { LogoutPage } from '@web/features/auth/pages/LogoutPage';

describe('LogoutPage', () => {
  it('should clear auth and redirect to login', () => {
    render(<LogoutPage />);

    expect(mockClearAuth).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-replace', 'true');
  });
});
