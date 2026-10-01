import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.js';

// Layouts
import { LawyerLayout } from './components/layout/LawyerLayout.js';
import { GuardianLayout } from './components/layout/GuardianLayout.js';

// Pages
import { RoleSelect } from './pages/Landing/RoleSelect.js';
import { LawyerLogin } from './pages/auth/LawyerLogin.js';
import { GuardianOtp } from './pages/auth/GuardianOtp.js';
import { Dashboard as LawyerDashboard } from './pages/lawyer/Dashboard.js';
import { NewCase } from './pages/lawyer/NewCase.js';
import { CaseWorkspace } from './pages/lawyer/CaseWorkspace.js';
import { SystemStatusPage } from './pages/lawyer/SystemStatusPage.js';
import { GuardianDashboard } from './pages/guardian/GuardianDashboard.js';
import { GuardianCase } from './pages/guardian/GuardianCase.js';

const LawyerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-xs text-[#5C5E66]">Verifying counsel session...</div>;
  if (!user || user.role !== 'lawyer') {
    return <Navigate to="/auth/lawyer" replace />;
  }
  return <LawyerLayout>{children}</LawyerLayout>;
};

const GuardianRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-xs text-[#5C5E66]">Verifying client session...</div>;
  if (!user || user.role !== 'guardian') {
    return <Navigate to="/auth/guardian" replace />;
  }
  return <GuardianLayout>{children}</GuardianLayout>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<RoleSelect />} />
      <Route path="/auth/lawyer" element={<LawyerLogin />} />
      <Route path="/auth/guardian" element={<GuardianOtp />} />

      {/* Lawyer Routes */}
      <Route
        path="/lawyer/dashboard"
        element={
          <LawyerRoute>
            <LawyerDashboard />
          </LawyerRoute>
        }
      />
      <Route
        path="/lawyer/cases"
        element={
          <LawyerRoute>
            <LawyerDashboard />
          </LawyerRoute>
        }
      />
      <Route
        path="/lawyer/cases/new"
        element={
          <LawyerRoute>
            <NewCase />
          </LawyerRoute>
        }
      />
      <Route
        path="/lawyer/cases/:id"
        element={
          <LawyerRoute>
            <CaseWorkspace />
          </LawyerRoute>
        }
      />
      <Route
        path="/lawyer/system"
        element={
          <LawyerRoute>
            <SystemStatusPage />
          </LawyerRoute>
        }
      />

      {/* Guardian Routes */}
      <Route
        path="/guardian/dashboard"
        element={
          <GuardianRoute>
            <GuardianDashboard />
          </GuardianRoute>
        }
      />
      <Route
        path="/guardian/cases/:id"
        element={
          <GuardianRoute>
            <GuardianCase />
          </GuardianRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
