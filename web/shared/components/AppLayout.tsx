import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { TopBar } from './TopBar';
import { BottomTabBar } from './BottomTabBar';

/**
 * Global layout for authenticated pages.
 * Renders TopBar (always), page content (Outlet), and BottomTabBar (on main pages only).
 *
 * Design reference: docs/module-design/web-app.md §5 — AppLayout
 */

const pageTitles: Record<string, string> = {
  '/activities': '约球',
  '/activities/create': '发起约球',
  '/coaches': '找教练',
  '/my-activities': '我的活动',
  '/my-courses': '课程管理',
  '/my-enrollments': '我的报名',
  '/match-records/create': '录入战绩',
  '/profile/edit': '编辑资料',
  '/profile/coach-edit': '教练资料',
  '/settings': '设置',
  '/notifications': '通知',
};

/** Pages that display the bottom tab bar */
const MAIN_PAGES = ['/activities', '/coaches'];

function isMainPage(pathname: string, userId: string | null): boolean {
  if (MAIN_PAGES.includes(pathname)) return true;
  if (userId && pathname === `/users/${userId}`) return true;
  return false;
}

function hasLocalTopBar(pathname: string, userId: string | null): boolean {
  if (
    pathname === '/activities/create' ||
    pathname === '/my-activities' ||
    pathname === '/my-enrollments' ||
    pathname === '/notifications' ||
    pathname === '/profile/edit' ||
    pathname === '/profile/coach-edit' ||
    pathname === '/settings' ||
    pathname === '/match-records/create'
  ) {
    return true;
  }

  if (/^\/activities\/[^/]+$/.test(pathname)) return true;
  if (/^\/users\/[^/]+\/match-records$/.test(pathname)) return true;

  if (userId && /^\/users\/[^/]+$/.test(pathname) && pathname !== `/users/${userId}`) {
    return true;
  }

  return false;
}

function resolveTitle(pathname: string, userId: string | null): string {
  const exact = pageTitles[pathname];
  if (exact) return exact;

  // Dynamic route patterns
  if (/^\/activities\/[^/]+$/.test(pathname)) return '活动详情';
  if (/^\/coaches\/[^/]+\/private-lessons$/.test(pathname)) return '私教预约';
  if (/^\/coaches\/[^/]+$/.test(pathname)) return '教练主页';
  if (/^\/group-classes\/[^/]+$/.test(pathname)) return '团课详情';
  if (/^\/users\/[^/]+\/match-records$/.test(pathname)) return '战绩历史';
  if (userId && pathname === `/users/${userId}`) return '我的';
  if (/^\/users\/[^/]+$/.test(pathname)) return '个人主页';

  return '羽约';
}

export function AppLayout() {
  const location = useLocation();
  const userId = useAuthStore((state) => state.userId);

  const title = resolveTitle(location.pathname, userId);
  const showTabBar = isMainPage(location.pathname, userId);
  const showTopBar = !hasLocalTopBar(location.pathname, userId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      {showTopBar && <TopBar title={title} />}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>
      {showTabBar && <BottomTabBar />}
    </div>
  );
}
