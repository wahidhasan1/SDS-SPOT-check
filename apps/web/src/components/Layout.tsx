import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { APP_NAME, api, realtime } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCall } from '../lib/call';
import { Avatar } from './ui';

const NAV = [
  { to: '/', label: 'Home', ico: '🏠', end: true },
  { to: '/ielts', label: 'IELTS', ico: '🎯' },
  { to: '/speaking', label: 'Speaking', ico: '🎙️' },
  { to: '/battles', label: 'Battles', ico: '⚔️' },
  { to: '/read', label: 'Reading', ico: '📷' },
  { to: '/vocabulary', label: 'Vocabulary', ico: '📚' },
  { to: '/profile', label: 'Profile', ico: '👤' },
];

const MORE = [
  { to: '/grammar', label: 'Grammar', ico: '✍️' },
  { to: '/progress', label: 'Progress', ico: '📈' },
  { to: '/subscription', label: 'Plan', ico: '⭐' },
];

export function Layout() {
  const { user, entitlements } = useAuth();
  const { snapshot, phase } = useCall();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);
  const [rtState, setRt] = useState(realtime.state);

  useEffect(() => realtime.onState(setRt) as unknown as () => void, []);
  useEffect(() => {
    api.get<{ unread: number }>('/me/notifications').then((r) => setUnread(r.unread)).catch(() => undefined);
    const off = realtime.on((m: any) => {
      if (m.t === 'notification') setUnread((u) => u + 1);
    });
    return () => void off();
  }, []);

  const inCall = snapshot && ['connecting', 'connected', 'reconnecting', 'requesting_mic'].includes(snapshot.state);
  const onCallPage = loc.pathname.startsWith('/speaking/call');

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark">◐</span>
          {APP_NAME}
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="tiny muted" style={{ padding: '14px 12px 4px', fontWeight: 700, letterSpacing: '.05em' }}>
          MORE
        </div>
        {MORE.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="ico">🛡️</span>Admin
          </NavLink>
        )}
        <div className="spacer" />
        {entitlements?.plan === 'free' && (
          <NavLink to="/subscription" className="card flat" style={{ padding: 12, textDecoration: 'none', color: 'var(--text)' }}>
            <div style={{ fontWeight: 800 }}>⭐ Go Premium</div>
            <div className="tiny muted">More calls, mock tests and AI feedback</div>
          </NavLink>
        )}
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="title">{phase === 'queued' && !onCallPage ? '🔎 Finding a speaking partner…' : ''}</div>
          {inCall && !onCallPage && (
            <NavLink to="/speaking/call" className="btn success sm">
              🎙️ Return to call
            </NavLink>
          )}
          {rtState !== 'ready' && (
            <span className="badge warning" title="Live features reconnecting">
              <span className="status-dot warn" /> Reconnecting
            </span>
          )}
          <NavLink to="/notifications" className="btn ghost sm" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => setUnread(0)}>
            🔔{unread > 0 && <span className="badge danger">{unread}</span>}
          </NavLink>
          <NavLink to="/profile" aria-label="Profile">
            <Avatar avatar={user?.avatar} />
          </NavLink>
        </header>
        <main className={`content ${loc.pathname.startsWith('/ielts/') ? 'wide' : ''}`}>
          <Outlet />
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
