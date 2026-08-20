import { Navigate, Route, Routes } from 'react-router-dom';

import { ActivityPage } from './components/ActivityPage';
import { AIJobConsole } from './components/AIJobConsole';
import { ApprovalsQueue } from './components/ApprovalsQueue';
import { AppShell } from './components/AppShell';
import { AssetWorkspace } from './components/AssetWorkspace';
import { Dashboard } from './components/Dashboard';
import { LoginPage } from './components/LoginPage';
import { OrganizationPage } from './components/OrganizationPage';
import { ProjectPage } from './components/ProjectPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StationPage } from './components/StationPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Home: what the employee needs to work on */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <Dashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={<Navigate to="/" replace />}
      />

      {/* Organization: management-only workspace */}
      <Route
        path="/organization"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
            <AppShell>
              <OrganizationPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* My Projects and project production campaigns */}
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <AppShell>
              <ProjectPage />
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

      {/* Production Stations */}
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

      {/* Dedicated Asset Workspace */}
      <Route
        path="/assets/:assetId"
        element={
          <ProtectedRoute>
            <AppShell>
              <AssetWorkspace />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Workflow Routes */}
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
