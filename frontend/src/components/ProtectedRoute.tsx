import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { isAuthenticated, isLoading, roles } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-backgroundDark text-textDark">
        <div className="rounded-cozy bg-white/10 px-6 py-4 shadow-cozy">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !roles.some((role) => allowedRoles.includes(role.toUpperCase()))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
