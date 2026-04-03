import { Routes, Route, Navigate } from 'react-router-dom';

// Placeholder pages
function PlaceholderPage({ name }: { name: string }) {
  return <div>{name}</div>;
}

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PlaceholderPage name="AdminLoginPage" />} />
      <Route path="/cities" element={<PlaceholderPage name="CityManagementPage" />} />
      <Route path="/venues" element={<PlaceholderPage name="VenueManagementPage" />} />
      <Route path="/" element={<Navigate to="/cities" replace />} />
    </Routes>
  );
}
