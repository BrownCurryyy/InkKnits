import { Navigate, Route, Routes } from 'react-router-dom';

import { ActivityPage } from './components/ActivityPage';
import { AIJobConsole } from './components/AIJobConsole';
import { AppShell } from './components/AppShell';
import { ApprovalsQueue } from './components/ApprovalsQueue';
import { Home } from './components/Home';
import { LoginPage } from './components/LoginPage';
import { OrganizationPage } from './components/OrganizationPage';
import { ProjectPage } from './components/ProjectPage';
import { ProjectsPage } from './components/ProjectsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StationPage } from './components/StationPage';
import { VersionTrackingPage } from './components/VersionTrackingPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <Home />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <AppShell>
              <ProjectsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <AppShell>
              <ProjectPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/stations/:stationId"
        element={
          <ProtectedRoute>
            <AppShell>
              <StationPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/organization"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AppShell>
              <OrganizationPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/approvals"
        element={
          <ProtectedRoute>
            <AppShell>
              <ApprovalsQueue />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai"
        element={
          <ProtectedRoute>
            <AppShell>
              <AIJobConsole />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity"
        element={
          <ProtectedRoute>
            <AppShell>
              <ActivityPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/version-tracking"
        element={
          <ProtectedRoute>
            <AppShell>
              <VersionTrackingPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
