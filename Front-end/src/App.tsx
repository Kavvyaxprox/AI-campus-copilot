import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_ROLES, AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminPortal from './pages/AdminPortal';
import StudentPortal from './pages/StudentPortal';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import type { Role } from './lib/types';

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={user.homePath} replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? user.homePath : '/login'} replace />;
}

function NotFound() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        The page you requested does not exist. Return to the portal for your role.
      </p>
      <a
        href={user ? user.homePath : '/login'}
        className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Go back
      </a>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route
          path="/admin/*"
          element={
            <RequireRole roles={ADMIN_ROLES}>
              <AdminPortal />
            </RequireRole>
          }
        />
        <Route
          path="/student/*"
          element={
            <RequireRole roles={['STUDENT']}>
              <StudentPortal />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
