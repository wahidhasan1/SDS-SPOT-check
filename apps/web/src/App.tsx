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
          </Route>
        </Route>
      </Route>
      <Route path="*" element={page(() => import('./pages/NotFound'))} />
    </Routes>
  );
}
