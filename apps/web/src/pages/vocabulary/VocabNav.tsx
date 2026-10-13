import { NavLink } from 'react-router';

export function VocabNav({ due }: { due?: number }) {
  const items = [
    { to: '/vocabulary', label: 'Discover', end: true },
    { to: '/vocabulary/my', label: 'My words' },
    { to: '/vocabulary/review', label: `Flashcards${due ? ` (${due})` : ''}` },
    { to: '/vocabulary/quiz', label: 'Quiz' },
  ];
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-900" aria-label="Vocabulary sections">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium ${isActive ? 'bg-white shadow-sm dark:bg-slate-800' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}>
          {i.label}
        </NavLink>
      ))}
    </nav>
  );
}
