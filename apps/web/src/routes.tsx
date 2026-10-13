import { Navigate, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { AdminPage } from './pages/Admin';
import { AssessmentPage } from './pages/Assessment';
import { BattlesPage } from './pages/Battles';
import { GrammarLessonPage, GrammarListPage } from './pages/Grammar';
import { HomePage, ProgressPage } from './pages/Home';
import { IeltsHome, PracticePage, SetList } from './pages/Ielts';
import { MockListPage, MockRunnerPage } from './pages/Mock';
import { OnboardingPage } from './pages/Onboarding';
import { NotificationsPage, ProfilePage, SubscriptionPage } from './pages/Profile';
import { GuidelinesPage, LandingPage } from './pages/Public';
import { ReaderPage, ReadHomePage } from './pages/Read';
import { SpeakingPracticePage } from './pages/SpeakingPractice';
import { ReviewPage, VocabularyPage } from './pages/Vocabulary';
import { WritingList, WritingResultPage, WritingTaskPage } from './pages/Writing';

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />;
}

function HomeOrOnboarding() {
  const { user } = useAuth();
  if (user && !user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <HomePage />;
}

function Standalone({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

export const routes = {
  public: [
    <Route key="welcome" path="/welcome" element={<LandingPage />} />,
    <Route key="guidelines" path="/guidelines" element={<GuidelinesPage />} />,
  ],
  private: [
    <Route key="home" path="/" element={<HomeOrOnboarding />} />,
    <Route key="assessment" path="/assessment" element={<AssessmentPage />} />,
    <Route key="progress" path="/progress" element={<ProgressPage />} />,
    <Route key="ielts" path="/ielts" element={<IeltsHome />} />,
    <Route key="reading" path="/ielts/reading" element={<SetList skill="reading" />} />,
    <Route key="listening" path="/ielts/listening" element={<SetList skill="listening" />} />,
    <Route key="practice" path="/ielts/practice/:id" element={<PracticePage />} />,
    <Route key="writing" path="/ielts/writing" element={<WritingList />} />,
    <Route key="writing-result" path="/ielts/writing/result/:id" element={<WritingResultPage />} />,
    <Route key="writing-task" path="/ielts/writing/:slug" element={<WritingTaskPage />} />,
    <Route key="speaking-solo" path="/ielts/speaking" element={<SpeakingPracticePage />} />,
    <Route key="mock" path="/ielts/mock" element={<MockListPage />} />,
    <Route key="mock-run" path="/ielts/mock/:id" element={<MockRunnerPage />} />,
    <Route key="vocab" path="/vocabulary" element={<VocabularyPage />} />,
    <Route key="review" path="/vocabulary/review" element={<ReviewPage />} />,
    <Route key="grammar" path="/grammar" element={<GrammarListPage />} />,
    <Route key="grammar-lesson" path="/grammar/:slug" element={<GrammarLessonPage />} />,
    <Route key="battles" path="/battles" element={<BattlesPage />} />,
    <Route key="read" path="/read" element={<ReadHomePage />} />,
    <Route key="reader" path="/read/:id" element={<ReaderPage />} />,
    <Route key="profile" path="/profile" element={<ProfilePage />} />,
    <Route key="subscription" path="/subscription" element={<SubscriptionPage />} />,
    <Route key="notifications" path="/notifications" element={<NotificationsPage />} />,
    <Route key="admin" path="/admin" element={<AdminOnly><AdminPage /></AdminOnly>} />,
  ],
  standalone: [<Route key="onboarding" path="/onboarding" element={<Standalone><OnboardingPage /></Standalone>} />],
};
