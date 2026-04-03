import { Routes, Route, Navigate } from 'react-router-dom';

// Placeholder pages - will be replaced with actual implementations
function PlaceholderPage({ name }: { name: string }) {
  return <div>{name}</div>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PlaceholderPage name="LoginPage" />} />
      <Route path="/activities" element={<PlaceholderPage name="ActivityListPage" />} />
      <Route path="/activities/create" element={<PlaceholderPage name="CreateActivityPage" />} />
      <Route path="/activities/:id" element={<PlaceholderPage name="ActivityDetailPage" />} />
      <Route path="/my-activities" element={<PlaceholderPage name="MyActivityListPage" />} />
      <Route path="/coaches" element={<PlaceholderPage name="CoachListPage" />} />
      <Route path="/coaches/:id" element={<PlaceholderPage name="CoachProfilePage" />} />
      <Route path="/group-classes/:id" element={<PlaceholderPage name="GroupClassDetailPage" />} />
      <Route
        path="/coaches/:id/private-lessons"
        element={<PlaceholderPage name="PrivateLessonBookingPage" />}
      />
      <Route path="/my-courses" element={<PlaceholderPage name="MyCourseManagementPage" />} />
      <Route path="/my-enrollments" element={<PlaceholderPage name="MyEnrollmentListPage" />} />
      <Route
        path="/match-records/create"
        element={<PlaceholderPage name="CreateMatchRecordPage" />}
      />
      <Route
        path="/users/:id/match-records"
        element={<PlaceholderPage name="MatchRecordHistoryPage" />}
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
