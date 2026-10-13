import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppStore';
import { unreadCount } from '../store/selectors';
import { levelFor, totalXp } from '../services/xp';
import { Avatar, Modal, ProgressBar, Spinner } from './ui';
import { BrandMark, Icon } from './Icon';
import { Toasts } from './Toasts';
import { useHydrationReminders } from './useReminders';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Train',
    items: [
      { to: '/app', label: 'Dashboard', icon: 'home', end: true },
      { to: '/app/workout', label: 'Today’s Workout', icon: 'dumbbell' },
      { to: '/app/schedule', label: 'Schedule & Plan', icon: 'calendar' },
      { to: '/app/exercises', label: 'Exercise Library', icon: 'book' },
      { to: '/app/coach', label: 'Coach', icon: 'chat' },
    ],
  },
  {
    title: 'Daily habits',
    items: [
      { to: '/app/checklist', label: 'Daily Checklist', icon: 'checklist' },
      { to: '/app/food', label: 'Food Planner', icon: 'food' },
      { to: '/app/hydration', label: 'Hydration', icon: 'droplet' },
      { to: '/app/streaks', label: 'Streak Calendar', icon: 'flame' },
    ],
  },
  {
    title: 'Compete & grow',
    items: [
      { to: '/app/battles', label: 'Fitness Battles', icon: 'swords' },
      { to: '/app/progress', label: 'Progress', icon: 'chart' },
      { to: '/app/achievements', label: 'Achievements', icon: 'trophy' },
      { to: '/app/notifications', label: 'Notifications', icon: 'bell' },
    ],
  },
  {
    title: 'You',
    items: [
      { to: '/app/profile', label: 'Profile', icon: 'user' },
      { to: '/app/settings', label: 'Settings', icon: 'settings' },
      { to: '/safety', label: 'Privacy & Safety', icon: 'shield' },
    ],
  },
];

const BOTTOM: NavItem[] = [
  { to: '/app', label: 'Home', icon: 'home', end: true },
  { to: '/app/workout', label: 'Workout', icon: 'dumbbell' },
  { to: '/app/food', label: 'Food', icon: 'food' },
  { to: '/app/battles', label: 'Battles', icon: 'swords' },
];

export function AppLayout() {
  const { data, user } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const unread = unreadCount(data);
  const lv = levelFor(totalXp(data.xp));
  useHydrationReminders();

  useEffect(() => {
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  const profile = data.profile;
  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Main navigation">
        <Link to="/app" className="brand">
          <BrandMark />
          <span>
            <span className="brand-name">BODYQUEST</span>
            <span className="brand-tag">Build Your Body. Beat Your Limits.</span>
          </span>
        </Link>
        <nav>
          {NAV_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="nav-section">{g.title}</div>
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Icon name={it.icon} size={18} />
                  {it.label}
                  {it.to === '/app/notifications' && unread > 0 && <span className="badge-dot">{unread}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          {profile && (
            <div className="sidebar-user">
              <Avatar emoji={profile.avatar.emoji} color={profile.avatar.color} size="sm" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.displayName}</div>
                <div className="level-mini">
                  Level {lv.level} · {lv.title}
                </div>
                <div className="mt-1">
                  <ProgressBar value={lv.progress} label="XP to next level" variant="xp" thin />
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Link to="/app" className="brand mobile-only" style={{ padding: 0 }} aria-label="BODYQUEST home">
            <BrandMark size={30} />
          </Link>
          <span className="mobile-only" style={{ fontWeight: 900, letterSpacing: '0.06em' }}>
            BODYQUEST
          </span>
          <div className="spacer" />
          <span className="badge badge-xp desktop-only" title={`${totalXp(data.xp)} XP total`}>
            <Icon name="zap" size={14} /> Lv {lv.level} · {totalXp(data.xp)} XP
          </span>
          <button className="icon-btn" onClick={() => navigate('/app/notifications')} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Icon name="bell" />
            {unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button className="icon-btn" onClick={() => navigate('/app/profile')} aria-label="Profile">
            {profile ? <Avatar emoji={profile.avatar.emoji} color={profile.avatar.color} size="sm" /> : <Icon name="user" />}
          </button>
        </header>
        {user?.isGuest && (
          <div className="demo-banner" role="note">
            <Icon name="info" size={15} /> Guest mode — data is saved only in this browser. <Link to="/signup">Create a local account</Link>
          </div>
        )}
        <main id="main" className="content" tabIndex={-1}>
          <Suspense fallback={<div className="row" style={{ justifyContent: 'center', padding: 40 }}><Spinner label="Loading page" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {BOTTOM.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={it.icon} size={22} />
            {it.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen}>
          <Icon name="menu" size={22} />
          More{unread > 0 ? ` (${unread})` : ''}
        </button>
      </nav>

      {moreOpen && (
        <Modal title="All pages" onClose={() => setMoreOpen(false)}>
          <MoreMenu unread={unread} />
        </Modal>
      )}
      <Toasts />
    </div>
  );
}

function MoreMenu({ unread }: { unread: number }) {
  return (
    <nav aria-label="All pages" className="stack">
      {NAV_GROUPS.map((g) => (
        <div key={g.title}>
          <div className="card-title" style={{ margin: '8px 0 4px' }}>
            {g.title}
          </div>
          <div className="grid-2" style={{ gap: 6, gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                <Icon name={it.icon} size={16} />
                {it.label}
                {it.to === '/app/notifications' && unread > 0 ? ` (${unread})` : ''}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    if (typeof title === 'string') document.title = `${title} · BODYQUEST`;
  }, [title]);
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
