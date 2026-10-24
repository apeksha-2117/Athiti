import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';

import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { GuestPortal } from './pages/guest/GuestPortal';
import { StaffPortal } from './pages/staff/StaffPortal';
import { AdminPortal } from './pages/admin/AdminPortal';
import { PublicReportPage } from './pages/public/PublicReportPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main style={{ flex: 1 }}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/report-incident" element={<PublicReportPage />} />

            {/* Guest */}
            <Route
              path="/guest"
              element={
                <ProtectedRoute allowedRoles={['GUEST']}>
                  <GuestPortal />
                </ProtectedRoute>
              }
            />

            {/* Staff */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute allowedRoles={['STAFF']}>
                  <StaffPortal />
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminPortal />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
