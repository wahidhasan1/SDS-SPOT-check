import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { GuestOnly, RequireAdmin, RequireAuth, RequireOnboarded } from './components/layout/Guards';
import { PublicLayout } from './components/layout/PublicLayout';
import { PageLoader } from './components/ui';

const page = (loader: () => Promise<{ default: ComponentType }>) => {
  const C = lazy(loader);
  return (
    <Suspense fallback={<PageLoader />}>
      <C />
    </Suspense>
  );
};

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={page(() => import('./pages/public/Landing'))} />
        <Route path="pricing" element={page(() => import('./pages/public/Pricing'))} />
        <Route path="privacy" element={page(() => import('./pages/public/Privacy'))} />
      </Route>
      <Route element={<GuestOnly />}>
        <Route path="login" element={page(() => import('./pages/auth/Login'))} />
        <Route path="register" element={page(() => import('./pages/auth/Register'))} />
        <Route path="forgot-password" element={page(() => import('./pages/auth/ForgotPassword'))} />
      </Route>
      <Route path="reset-password" element={page(() => import('./pages/auth/ResetPassword'))} />

      <Route element={<RequireAuth />}>
        <Route path="onboarding" element={page(() => import('./pages/onboarding/Onboarding'))} />
        <Route path="assessment" element={page(() => import('./pages/onboarding/Assessment'))} />
        <Route element={<RequireOnboarded />}>
          <Route element={<AppLayout />}>
            <Route path="dashboard" element={page(() => import('./pages/Dashboard'))} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={page(() => import('./pages/NotFound'))} />
    </Routes>
  );
}
