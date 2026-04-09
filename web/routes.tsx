import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { AuthGuard } from './shared/components/AuthGuard';
import { AppLayout } from './shared/components/AppLayout';

// Lazy-loaded page components (route-level code splitting)
const LoginPage = React.lazy(() =>
  import('./features/auth/pages/LoginPage').then((m) => ({
    default: m.LoginPage,
  })),
);
const LogoutPage = React.lazy(() =>
  import('./features/auth/pages/LogoutPage').then((m) => ({
    default: m.LogoutPage,
  })),
);
const ActivityListPage = React.lazy(() =>
  import('./features/activity/pages/ActivityListPage').then((m) => ({
    default: m.ActivityListPage,
  })),
);
const CreateActivityPage = React.lazy(() =>
  import('./features/activity/pages/CreateActivityPage').then((m) => ({
    default: m.CreateActivityPage,
  })),
);
const ActivityDetailPage = React.lazy(() =>
  import('./features/activity/pages/ActivityDetailPage').then((m) => ({
    default: m.ActivityDetailPage,
  })),
);
const MyActivityListPage = React.lazy(() =>
  import('./features/activity/pages/MyActivityListPage').then((m) => ({
    default: m.MyActivityListPage,
  })),
);
const CoachListPage = React.lazy(() =>
  import('./features/coaching/pages/CoachListPage').then((m) => ({
    default: m.CoachListPage,
  })),
);
const CoachProfilePage = React.lazy(() =>
  import('./features/coaching/pages/CoachProfilePage').then((m) => ({
    default: m.CoachProfilePage,
  })),
);
const GroupClassDetailPage = React.lazy(() =>
  import('./features/coaching/pages/GroupClassDetailPage').then((m) => ({
    default: m.GroupClassDetailPage,
  })),
);
const PrivateLessonBookingPage = React.lazy(() =>
  import('./features/coaching/pages/PrivateLessonBookingPage').then((m) => ({
    default: m.PrivateLessonBookingPage,
  })),
);
const MyCourseManagementPage = React.lazy(() =>
  import('./features/coaching/pages/MyCourseManagementPage').then((m) => ({
    default: m.MyCourseManagementPage,
  })),
);
const MyEnrollmentListPage = React.lazy(() =>
  import('./features/coaching/pages/MyEnrollmentListPage').then((m) => ({
    default: m.MyEnrollmentListPage,
  })),
);
const CreateMatchRecordPage = React.lazy(() =>
  import('./features/match-record/pages/CreateMatchRecordPage').then((m) => ({
    default: m.CreateMatchRecordPage,
  })),
);
const MatchRecordHistoryPage = React.lazy(() =>
  import('./features/match-record/pages/MatchRecordHistoryPage').then((m) => ({
    default: m.MatchRecordHistoryPage,
  })),
);
const UserProfilePage = React.lazy(() =>
  import('./features/profile/pages/UserProfilePage').then((m) => ({
    default: m.UserProfilePage,
  })),
);
const ProfileEditPage = React.lazy(() =>
  import('./features/profile/pages/ProfileEditPage').then((m) => ({
    default: m.ProfileEditPage,
  })),
);
const CoachProfileEditPage = React.lazy(() =>
  import('./features/profile/pages/CoachProfileEditPage').then((m) => ({
    default: m.CoachProfileEditPage,
  })),
);
const SettingsPage = React.lazy(() =>
  import('./features/profile/pages/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
);
const NotificationListPage = React.lazy(() =>
  import('./features/notification/pages/NotificationListPage').then((m) => ({
    default: m.NotificationListPage,
  })),
);

const PageLoader = (
  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
    <Spin size="large" />
  </div>
);

export function AppRoutes() {
  return (
    <Suspense fallback={PageLoader}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/logout" element={<LogoutPage />} />

        {/* Authenticated routes wrapped in AuthGuard + AppLayout */}
        <Route element={<AuthGuard />}>
          <Route element={<AppLayout />}>
            <Route path="/activities" element={<ActivityListPage />} />
            <Route path="/activities/create" element={<CreateActivityPage />} />
            <Route path="/activities/:id" element={<ActivityDetailPage />} />
            <Route path="/my-activities" element={<MyActivityListPage />} />
            <Route path="/coaches" element={<CoachListPage />} />
            <Route path="/coaches/:id" element={<CoachProfilePage />} />
            <Route path="/group-classes/:id" element={<GroupClassDetailPage />} />
            <Route
              path="/coaches/:id/private-lessons"
              element={<PrivateLessonBookingPage />}
            />
            <Route path="/my-courses" element={<MyCourseManagementPage />} />
            <Route path="/my-enrollments" element={<MyEnrollmentListPage />} />
            <Route
              path="/match-records/create"
              element={<CreateMatchRecordPage />}
            />
            <Route
              path="/users/:id/match-records"
              element={<MatchRecordHistoryPage />}
            />
            <Route path="/users/:id" element={<UserProfilePage />} />
            <Route path="/profile/edit" element={<ProfileEditPage />} />
            <Route
              path="/profile/coach-edit"
              element={<CoachProfileEditPage />}
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notifications" element={<NotificationListPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/activities" replace />} />
      </Routes>
    </Suspense>
  );
}
