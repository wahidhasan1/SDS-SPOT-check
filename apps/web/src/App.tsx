import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { CallProvider } from './lib/call';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/Auth';
import { CallHistoryPage, CallPage, CallSummary, SpeakingHub } from './pages/Speaking';
import { routes as featureRoutes } from './routes';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/welcome" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading label="Starting…" />;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {featureRoutes.public}
      <Route
        element={
          <RequireAuth>
            <CallProvider>
              <Layout />
            </CallProvider>
          </RequireAuth>
        }
      >
        <Route path="/speaking" element={<SpeakingHub />} />
        <Route path="/speaking/call" element={<CallPage />} />
        <Route path="/speaking/summary" element={<CallSummary />} />
        <Route path="/speaking/history" element={<CallHistoryPage />} />
        {featureRoutes.private}
      </Route>
      {featureRoutes.standalone}
      <Route path="*" element={<Navigate to={user ? '/' : '/welcome'} replace />} />
    </Routes>
  );
}
