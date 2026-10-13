import { Link, Outlet } from 'react-router';
import { useAuth } from '../../lib/auth';
import { ButtonLink } from '../ui';
import { Logo } from './Logo';

export function PublicLayout() {
  const { me } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="ml-6 hidden gap-5 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            <a href="/#features" className="hover:text-slate-900 dark:hover:text-white">Features</a>
            <a href="/#ielts" className="hover:text-slate-900 dark:hover:text-white">IELTS</a>
            <Link to="/pricing" className="hover:text-slate-900 dark:hover:text-white">Pricing</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {me ? (
              <ButtonLink to="/dashboard" size="sm">Open app</ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="ghost" size="sm">Sign in</ButtonLink>
                <ButtonLink to="/register" size="sm">Get started</ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-8 text-sm dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="muted">© {new Date().getFullYear()} FluentPath. Practice content is original and not affiliated with IELTS, the British Council, IDP or Cambridge.</p>
          <div className="flex gap-4">
            <Link to="/pricing" className="muted hover:underline">Pricing</Link>
            <Link to="/privacy" className="muted hover:underline">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
