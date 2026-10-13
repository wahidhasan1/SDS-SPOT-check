import { Navigate, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { lazy, Suspense, type ComponentType } from 'react';
import { Loading } from './components/ui';

/** Route-level code splitting: each page loads on first visit. */
function lz(loader: () => Promise<Record<string, unknown>>, name: string) {
  const C = lazy(async () => ({ default: (await loader())[name] as ComponentType<any> }));
  return (props: any) => (
    <Suspense fallback={<Loading />}>
      <C {...props} />
    </Suspense>
  );
}

const AdminPage = lz(() => import('./pages/Admin'), 'AdminPage');
const AssessmentPage = lz(() => import('./pages/Assessment'), 'AssessmentPage');
const BattlesPage = lz(() => import('./pages/Battles'), 'BattlesPage');
const GrammarLessonPage = lz(() => import('./pages/Grammar'), 'GrammarLessonPage');
const GrammarListPage = lz(() => import('./pages/Grammar'), 'GrammarListPage');
const HomePage = lz(() => import('./pages/Home'), 'HomePage');
const ProgressPage = lz(() => import('./pages/Home'), 'ProgressPage');
const IeltsHome = lz(() => import('./pages/Ielts'), 'IeltsHome');
const PracticePage = lz(() => import('./pages/Ielts'), 'PracticePage');
const SetList = lz(() => import('./pages/Ielts'), 'SetList');
const MockListPage = lz(() => import('./pages/Mock'), 'MockListPage');
const MockRunnerPage = lz(() => import('./pages/Mock'), 'MockRunnerPage');
const OnboardingPage = lz(() => import('./pages/Onboarding'), 'OnboardingPage');
const NotificationsPage = lz(() => import('./pages/Profile'), 'NotificationsPage');
const ProfilePage = lz(() => import('./pages/Profile'), 'ProfilePage');
const SubscriptionPage = lz(() => import('./pages/Profile'), 'SubscriptionPage');
const GuidelinesPage = lz(() => import('./pages/Public'), 'GuidelinesPage');
const LandingPage = lz(() => import('./pages/Public'), 'LandingPage');
const ReaderPage = lz(() => import('./pages/Read'), 'ReaderPage');
const ReadHomePage = lz(() => import('./pages/Read'), 'ReadHomePage');
const SpeakingPracticePage = lz(() => import('./pages/SpeakingPractice'), 'SpeakingPracticePage');
const ReviewPage = lz(() => import('./pages/Vocabulary'), 'ReviewPage');
const VocabularyPage = lz(() => import('./pages/Vocabulary'), 'VocabularyPage');
const WritingList = lz(() => import('./pages/Writing'), 'WritingList');
const WritingResultPage = lz(() => import('./pages/Writing'), 'WritingResultPage');
const WritingTaskPage = lz(() => import('./pages/Writing'), 'WritingTaskPage');

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
