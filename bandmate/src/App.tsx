import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useMe } from './lib/session'
import { AppLayout } from './components/Layout'
import { ConfirmHost, ErrorState, PageLoader, Toaster } from './components/ui'

const Welcome = lazy(() => import('./pages/public/Welcome'))
const Auth = lazy(() => import('./pages/public/Auth'))
const Legal = lazy(() => import('./pages/public/Legal'))
const Onboarding = lazy(() => import('./pages/onboarding/Onboarding'))
const Home = lazy(() => import('./pages/Home'))
const SpeakHub = lazy(() => import('./pages/speak/SpeakHub'))
const CallScreen = lazy(() => import('./pages/speak/CallScreen'))
const CallHistory = lazy(() => import('./pages/speak/CallHistory'))
const SpeakPractice = lazy(() => import('./pages/speak/SpeakPractice'))
const Ielts = lazy(() => import('./pages/ielts/IeltsRoutes'))
const Learn = lazy(() => import('./pages/learn/Learn'))
const Vocab = lazy(() => import('./pages/learn/Vocab'))
const Grammar = lazy(() => import('./pages/learn/Grammar'))
const Battles = lazy(() => import('./pages/learn/Battles'))
const Read = lazy(() => import('./pages/learn/Read'))
const Profile = lazy(() => import('./pages/profile/Profile'))
const Notifications = lazy(() => import('./pages/profile/Notifications'))
const Admin = lazy(() => import('./pages/admin/Admin'))

function RequireAuth({ children }: { children: ReactNode }) {
  const { data: me, isLoading, error, refetch } = useMe()
  const loc = useLocation()
  if (isLoading) return <PageLoader />
  if (error) return <div className="p-6"><ErrorState error={error} onRetry={() => refetch()} /></div>
  if (!me) return <Navigate to={`/welcome?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (me.profile.onboardingStep !== 'done' && !loc.pathname.startsWith('/onboarding')) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe()
  if (isLoading) return <PageLoader />
  if (me) return <Navigate to="/" replace />
  return <>{children}</>
}

export function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/welcome" element={<PublicOnly><Welcome /></PublicOnly>} />
          <Route path="/login" element={<PublicOnly><Auth mode="login" /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><Auth mode="signup" /></PublicOnly>} />
          <Route path="/forgot-password" element={<PublicOnly><Auth mode="forgot" /></PublicOnly>} />
          <Route path="/reset-password" element={<Auth mode="reset" />} />
          <Route path="/guidelines" element={<Legal page="guidelines" />} />
          <Route path="/privacy" element={<Legal page="privacy" />} />
          <Route path="/terms" element={<Legal page="terms" />} />
          <Route path="/onboarding/*" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<Home />} />
            <Route path="speak" element={<SpeakHub />} />
            <Route path="speak/call" element={<CallScreen />} />
            <Route path="speak/history" element={<CallHistory />} />
            <Route path="speak/history/:id" element={<CallHistory />} />
            <Route path="speak/practice/*" element={<SpeakPractice />} />
            <Route path="ielts/*" element={<Ielts />} />
            <Route path="learn" element={<Learn />} />
            <Route path="vocab/*" element={<Vocab />} />
            <Route path="grammar/*" element={<Grammar />} />
            <Route path="battles/*" element={<Battles />} />
            <Route path="read/*" element={<Read />} />
            <Route path="profile/*" element={<Profile />} />
            <Route path="account/*" element={<Profile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="admin/*" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
      <ConfirmHost />
    </>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="text-5xl font-extrabold text-primary">404</p>
      <p className="mt-3 text-lg font-bold">This page doesn’t exist</p>
      <a href="/" className="btn btn-primary mt-6">Go home</a>
    </div>
  )
}
