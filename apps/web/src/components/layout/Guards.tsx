import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../lib/auth';
import { PageLoader } from '../ui';

export function RequireAuth() {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <Outlet />;
}

/** New users finish onboarding before the main app. */
export function RequireOnboarded() {
  const { me } = useAuth();
  if (me && !me.profile.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { me } = useAuth();
  if (me?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { me, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (me) return <Navigate to={me.profile.onboardingCompleted ? '/dashboard' : '/onboarding'} replace />;
  return <Outlet />;
}
