import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ActivityListPage } from './features/activity/pages/ActivityListPage';
import { CreateActivityPage } from './features/activity/pages/CreateActivityPage';
import { ActivityDetailPage } from './features/activity/pages/ActivityDetailPage';
import { MyActivityListPage } from './features/activity/pages/MyActivityListPage';
import { CoachListPage } from './features/coaching/pages/CoachListPage';
import { CoachProfilePage } from './features/coaching/pages/CoachProfilePage';
import { GroupClassDetailPage } from './features/coaching/pages/GroupClassDetailPage';
import { PrivateLessonBookingPage } from './features/coaching/pages/PrivateLessonBookingPage';
import { MyCourseManagementPage } from './features/coaching/pages/MyCourseManagementPage';
import { MyEnrollmentListPage } from './features/coaching/pages/MyEnrollmentListPage';
import { CreateMatchRecordPage } from './features/match-record/pages/CreateMatchRecordPage';
import { MatchRecordHistoryPage } from './features/match-record/pages/MatchRecordHistoryPage';
import { UserProfilePage } from './features/profile/pages/UserProfilePage';
import { ProfileEditPage } from './features/profile/pages/ProfileEditPage';
import { CoachProfileEditPage } from './features/profile/pages/CoachProfileEditPage';
import { SettingsPage } from './features/profile/pages/SettingsPage';
import { NotificationListPage } from './features/notification/pages/NotificationListPage';
import { AuthGuard } from './shared/components/AuthGuard';
import { AppLayout } from './shared/components/AppLayout';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

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
  );
}
