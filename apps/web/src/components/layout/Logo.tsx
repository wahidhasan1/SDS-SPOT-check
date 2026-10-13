import { Link } from 'react-router';

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-bold text-slate-900 dark:text-white" aria-label="FluentPath home">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg">FluentPath</span>
    </Link>
  );
}
