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
            <Route path="progress" element={page(() => import('./pages/Progress'))} />
            <Route path="notifications" element={page(() => import('./pages/Notifications'))} />
            <Route path="grammar" element={page(() => import('./pages/grammar/GrammarHome'))} />
            <Route path="grammar/:slug" element={page(() => import('./pages/grammar/Lesson'))} />
            <Route path="vocabulary" element={page(() => import('./pages/vocabulary/VocabHome'))} />
            <Route path="vocabulary/my" element={page(() => import('./pages/vocabulary/MyWords'))} />
            <Route path="vocabulary/review" element={page(() => import('./pages/vocabulary/Review'))} />
            <Route path="vocabulary/quiz" element={page(() => import('./pages/vocabulary/Quiz'))} />
            <Route path="reader" element={page(() => import('./pages/reader/ReaderHome'))} />
            <Route path="reader/:id" element={page(() => import('./pages/reader/ReaderDoc'))} />
            <Route path="ielts" element={page(() => import('./pages/ielts/IeltsHome'))} />
            <Route path="ielts/reading" element={page(() => import('./pages/ielts/ReadingList'))} />
            <Route path="ielts/listening" element={page(() => import('./pages/ielts/ListeningList'))} />
            <Route path="ielts/attempts/:id" element={page(() => import('./pages/ielts/Practice'))} />
            <Route path="ielts/writing" element={page(() => import('./pages/ielts/WritingHome'))} />
            <Route path="ielts/writing/submissions/:id" element={page(() => import('./pages/ielts/WritingSubmission'))} />
            <Route path="ielts/speaking" element={page(() => import('./pages/ielts/SpeakingHome'))} />
            <Route path="ielts/speaking/attempts/:id" element={page(() => import('./pages/ielts/SpeakingAttempt'))} />
            <Route path="ielts/speaking/:id" element={page(() => import('./pages/ielts/SpeakingPractice'))} />
            <Route path="ielts/mock" element={page(() => import('./pages/ielts/MockList'))} />
            <Route path="ielts/mock/:id" element={page(() => import('./pages/ielts/MockRunner'))} />
            <Route path="speak" element={page(() => import('./pages/speak/Speak'))} />
            <Route path="battles" element={page(() => import('./pages/speak/Battles'))} />
            <Route path="profile" element={page(() => import('./pages/account/Profile'))} />
            <Route path="settings" element={page(() => import('./pages/account/Settings'))} />
            <Route path="premium" element={page(() => import('./pages/account/Premium'))} />
            <Route element={<RequireAdmin />}>
              <Route path="admin" element={page(() => import('./pages/admin/AdminLayout'))}>
                <Route index element={page(() => import('./pages/admin/Overview'))} />
                <Route path="users" element={page(() => import('./pages/admin/Users'))} />
                <Route path="reports" element={page(() => import('./pages/admin/Reports'))} />
                <Route path="lessons" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.Lessons })))} />
                <Route path="placement" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.Placement })))} />
                <Route path="words" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.Words })))} />
                <Route path="ielts-sets" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.IeltsSets })))} />
                <Route path="audio" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.Audio })))} />
                <Route path="writing-tasks" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.WritingTasks })))} />
                <Route path="speaking-prompts" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.SpeakingPrompts })))} />
                <Route path="mock-tests" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.MockTests })))} />
                <Route path="categories" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.Categories })))} />
                <Route path="subscriptions" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.Subscriptions })))} />
                <Route path="outbox" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.Outbox })))} />
                <Route path="audit" element={page(() => import('./pages/admin/Content').then((m) => ({ default: m.AuditLog })))} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={page(() => import('./pages/NotFound'))} />
    </Routes>
  );
}
