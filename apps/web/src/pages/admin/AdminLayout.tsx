import { NavLink, Outlet } from 'react-router';
import { PageHeader } from '../../components/ui';

const LINKS = [
  ['/admin', 'Overview'],
  ['/admin/users', 'Users'],
  ['/admin/reports', 'Reports'],
  ['/admin/lessons', 'Lessons'],
  ['/admin/words', 'Vocabulary'],
  ['/admin/ielts-sets', 'IELTS sets'],
  ['/admin/audio', 'Audio'],
  ['/admin/writing-tasks', 'Writing tasks'],
  ['/admin/speaking-prompts', 'Speaking'],
  ['/admin/mock-tests', 'Mock tests'],
  ['/admin/placement', 'Placement test'],
  ['/admin/categories', 'Categories'],
  ['/admin/subscriptions', 'Subscriptions'],
  ['/admin/outbox', 'Email outbox'],
  ['/admin/audit', 'Audit log'],
] as const;

export default function AdminLayout() {
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Admin" description="Manage users, moderation and learning content. Every action is checked on the server and recorded in the audit log." />
      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-900" aria-label="Admin sections">
        {LINKS.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-white shadow-sm dark:bg-slate-800' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}>{label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
