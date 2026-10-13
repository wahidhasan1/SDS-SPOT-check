import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { Toasts } from './components/Toasts';
import { Spinner } from './components/ui';
import { AppProvider, useApp } from './store/AppStore';
const Landing = lazy(() => import('./pages/Landing'));
const SignIn = lazy(() => import('./pages/Auth').then((m) => ({ default: m.SignIn })));
const SignUp = lazy(() => import('./pages/Auth').then((m) => ({ default: m.SignUp })));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const WorkoutPage = lazy(() => import('./pages/Workout'));
const ExerciseLibrary = lazy(() => import('./pages/Exercises').then((m) => ({ default: m.ExerciseLibrary })));
const ExerciseDetailPage = lazy(() => import('./pages/Exercises').then((m) => ({ default: m.ExerciseDetailPage })));
const FoodPlanner = lazy(() => import('./pages/Food'));
const HydrationPage = lazy(() => import('./pages/Hydration'));
const ChecklistPage = lazy(() => import('./pages/Checklist'));
const StreaksPage = lazy(() => import('./pages/Streaks'));
const SchedulePage = lazy(() => import('./pages/Schedule'));
const BattlesPage = lazy(() => import('./pages/Battles').then((m) => ({ default: m.BattlesPage })));
const FindOpponent = lazy(() => import('./pages/Battles').then((m) => ({ default: m.FindOpponent })));
const BattleDetail = lazy(() => import('./pages/Battles').then((m) => ({ default: m.BattleDetail })));
const ProgressPage = lazy(() => import('./pages/Progress'));
const AchievementsPage = lazy(() => import('./pages/Achievements'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const SafetyPage = lazy(() => import('./pages/Safety'));
const CoachPage = lazy(() => import('./pages/Coach'));
import NotFound from './pages/NotFound';

const PoseGallery = lazy(() => import('./dev/PoseGallery'));

function PageLoading() {
  return (
    <div className="content" style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
      <Spinner label="Loading page" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const loc = useLocation();
  if (!user) return <Navigate to="/signin" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function RequirePlan({ children }: { children: ReactNode }) {
  const { data } = useApp();
  if (!data.profile || !data.plan) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicPage({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<PublicPage><Landing /></PublicPage>} />
          <Route path="/signup" element={<PublicPage><SignUp /></PublicPage>} />
          <Route path="/signin" element={<PublicPage><SignIn /></PublicPage>} />
          <Route path="/safety" element={<PublicPage><SafetyPage /></PublicPage>} />
          <Route
            path="/onboarding/*"
            element={
              <RequireAuth>
                <PublicPage>
                  <Onboarding />
                </PublicPage>
              </RequireAuth>
            }
          />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <RequirePlan>
                  <AppLayout />
                </RequirePlan>
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="workout" element={<WorkoutPage />} />
            <Route path="exercises" element={<ExerciseLibrary />} />
            <Route path="exercises/:id" element={<ExerciseDetailPage />} />
            <Route path="food" element={<FoodPlanner />} />
            <Route path="hydration" element={<HydrationPage />} />
            <Route path="checklist" element={<ChecklistPage />} />
            <Route path="streaks" element={<StreaksPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="battles" element={<BattlesPage />} />
            <Route path="battles/find" element={<FindOpponent />} />
            <Route path="battles/:id" element={<BattleDetail />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="achievements" element={<AchievementsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="coach" element={<CoachPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          {import.meta.env.DEV && (
            <Route
              path="/dev/poses"
              element={
                <Suspense fallback={<Spinner />}>
                  <PoseGallery />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<PublicPage><NotFound /></PublicPage>} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  );
}
