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

// Placeholder pages - will be replaced with actual implementations
function PlaceholderPage({ name }: { name: string }) {
  return <div>{name}</div>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
      <Route path="/users/:id" element={<PlaceholderPage name="UserProfilePage" />} />
      <Route path="/profile/edit" element={<PlaceholderPage name="ProfileEditPage" />} />
      <Route path="/profile/coach-edit" element={<PlaceholderPage name="CoachProfileEditPage" />} />
      <Route path="/settings" element={<PlaceholderPage name="SettingsPage" />} />
      <Route path="/notifications" element={<PlaceholderPage name="NotificationListPage" />} />
      <Route path="/" element={<Navigate to="/activities" replace />} />
    </Routes>
  );
}
