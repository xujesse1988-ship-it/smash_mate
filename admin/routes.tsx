import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLoginPage } from './features/auth/pages/AdminLoginPage';
import { CityManagementPage } from './features/venue-management/pages/CityManagementPage';
import { VenueManagementPage } from './features/venue-management/pages/VenueManagementPage';
import { UserManagementPage } from './features/user-management/pages/UserManagementPage';
import { AdminAuthGuard } from './shared/components/AdminAuthGuard';
import { AdminLayout } from './shared/components/AdminLayout';

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route
        element={
          <AdminAuthGuard>
            <AdminLayout />
          </AdminAuthGuard>
        }
      >
        <Route path="/cities" element={<CityManagementPage />} />
        <Route path="/venues" element={<VenueManagementPage />} />
        <Route path="/users" element={<UserManagementPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/cities" replace />} />
    </Routes>
  );
}
