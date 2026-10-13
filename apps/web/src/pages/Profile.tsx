import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CEFR_LABELS, LEARNING_GOAL_LABELS, LEARNING_GOALS, TARGET_BANDS, type LearningGoal } from '@app/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { errorMessage, formatDate, useApi } from '../lib/hooks';
import { Avatar, Empty, ErrorBox, LevelBadge, Loading, Modal, PageHeader } from '../components/ui';

function useTheme() {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('fp.theme') ?? 'system';
    } catch {
      return 'system';
    }
  });
  const apply = (t: string) => {
    setTheme(t);
    try {
      if (t === 'system') localStorage.removeItem('fp.theme');
      else localStorage.setItem('fp.theme', t);
    } catch {
      /* ignore */
    }
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  };
  return [theme, apply] as const;
}

export function ProfilePage() {
  const { user, setUser, logout, entitlements } = useAuth();
  const nav = useNavigate();
  const [theme, setTheme] = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(user?.displayName ?? '');
  const [birthYear, setBirthYear] = useState('');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [del, setDel] = useState({ open: false, password: '', confirm: '' });
  const blocks = useApi<any[]>('/safety/blocks');
  if (!user) return null;
  const patch = async (body: any, note = 'Saved.') => {
    setErr(null);
    try {
      setUser(await api.patch('/me', body));
      setMsg(note);
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const rotateIdentity = async () => setUser(await api.post('/me/anon-identity'));
  const changePw = async () => {
    setErr(null);
    try {
      await api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '' });
      setMsg('Password changed.');
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const exportData = async () => {
    const data = await api.get('/me/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-learning-data.json';
    a.click();
  };
  const deleteAccount = async () => {
    try {
      await api.post('/auth/delete-account', { password: del.password, confirm: del.confirm });
      await logout();
      nav('/welcome');
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const toggleGoal = (g: LearningGoal) => patch({ goals: user.goals.includes(g) ? user.goals.filter((x) => x !== g) : [...user.goals, g] });
  return (
    <div className="stack lg">
      <PageHeader title="Profile & settings" actions={<button className="btn secondary" onClick={async () => { await logout(); nav('/welcome'); }} data-testid="logout">Sign out</button>} />
      {msg && <div className="alert success">{msg}</div>}
      <ErrorBox error={err} />
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="card stack center">
          <Avatar avatar={user.avatar} size="lg" />
          <div><div className="small muted">Anonymous calling identity</div><h2 style={{ margin: 0 }} data-testid="anon-name">{user.anonName}</h2></div>
          <button className="btn ghost sm" onClick={rotateIdentity}>🔄 New anonymous identity</button>
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            <LevelBadge level={user.cefrLevel} />
            {user.cefrLevel && <span className="small muted">{CEFR_LABELS[user.cefrLevel]}</span>}
          </div>
          <div className="small muted">🔥 {user.streakDays}-day streak · ⚔️ {user.battleRating} battle rating</div>
          <div className="small">Plan: <b>{entitlements?.planName ?? '…'}</b> · <Link to="/subscription">Manage</Link></div>
          <Link to="/assessment" className="btn secondary sm">Retake placement test</Link>
        </div>
        <div className="card stack" style={{ gridColumn: 'span 2' }}>
          <h3>Account</h3>
          <div className="grid cols-2">
            <label className="field">Name (private)<div className="row"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn sm" onClick={() => patch({ displayName: name })}>Save</button></div></label>
            <label className="field">Email<input className="input" value={user.email} disabled /></label>
            {user.birthYear == null && (
              <label className="field">Birth year (needed for live calls)<div className="row"><input className="input" value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))} /><button className="btn sm" onClick={async () => { try { setUser(await api.post('/me/birth-year', { birthYear: Number(birthYear) })); } catch (e) { setErr(errorMessage(e)); } }}>Save</button></div></label>
            )}
          </div>
          <h3>Learning goals</h3>
          <div className="row wrap">{LEARNING_GOALS.map((g) => <button key={g} className={`chip ${user.goals.includes(g) ? 'on' : ''}`} onClick={() => toggleGoal(g)}>{LEARNING_GOAL_LABELS[g]}</button>)}</div>
          <div className="grid cols-2">
            <label className="field">IELTS test type
              <select className="input" value={user.testType} onChange={(e) => patch({ testType: e.target.value })}>
                <option value="academic">Academic</option><option value="general">General Training</option><option value="none">Not preparing for IELTS</option>
              </select>
            </label>
            <label className="field">Target band
              <select className="input" value={user.targetBand ?? ''} onChange={(e) => patch({ targetBand: e.target.value ? Number(e.target.value) : null })}>
                <option value="">No target</option>{TARGET_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="field">Translate words into
              <input className="input" defaultValue={user.translationLanguage ?? ''} onBlur={(e) => patch({ translationLanguage: e.target.value || null })} placeholder="e.g. Spanish" />
            </label>
            <label className="field">Theme
              <select className="input" value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <h3>Privacy</h3>
          <label className="row"><input type="checkbox" checked={user.privacy.showLevelToPartners} onChange={(e) => patch({ privacy: { showLevelToPartners: e.target.checked } })} /> Show my English level to speaking partners</label>
          <label className="row"><input type="checkbox" checked={user.privacy.showOnLeaderboard} onChange={(e) => patch({ privacy: { showOnLeaderboard: e.target.checked } })} /> Show my anonymous name on battle leaderboards</label>
          <div className="small muted">Partners never see your name, email or other account details.</div>
          <h3>Notifications</h3>
          <label className="row"><input type="checkbox" checked={user.notificationPrefs.dailyReminder} onChange={(e) => patch({ notificationPrefs: { dailyReminder: e.target.checked } })} /> Daily practice reminder</label>
          <label className="row"><input type="checkbox" checked={user.notificationPrefs.vocabReview} onChange={(e) => patch({ notificationPrefs: { vocabReview: e.target.checked } })} /> Vocabulary review reminders</label>
          <label className="row"><input type="checkbox" checked={user.notificationPrefs.streaks} onChange={(e) => patch({ notificationPrefs: { streaks: e.target.checked } })} /> Streak updates</label>
          <label className="row"><input type="checkbox" checked={user.notificationPrefs.battleInvites} onChange={(e) => patch({ notificationPrefs: { battleInvites: e.target.checked } })} /> Battle invitations</label>
          <label className="field">Reminder time (your local time)
            <select className="input" style={{ maxWidth: 160 }} value={user.notificationPrefs.reminderHour} onChange={(e) => patch({ notificationPrefs: { reminderHour: Number(e.target.value) }, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </label>
        </div>
        <div className="card stack">
          <h3>Blocked users</h3>
          {blocks.loading ? <Loading /> : !blocks.data?.length ? <div className="small muted">You haven't blocked anyone.</div> : (
            <div className="list">
              {blocks.data.map((b) => (
                <div key={b.id} className="list-item small"><span style={{ flex: 1 }}>{b.anon_name}</span><span className="tiny muted">{formatDate(b.created_at)}</span>
                  <button className="btn ghost sm" onClick={async () => { await api.del(`/safety/blocks/${b.id}`); blocks.reload(); }}>Unblock</button></div>
              ))}
            </div>
          )}
          <h3>Security</h3>
          <div className="grid cols-2">
            <input className="input" type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <input className="input" type="password" placeholder="New password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </div>
          <button className="btn secondary sm" style={{ alignSelf: 'flex-start' }} disabled={!pw.current || !pw.next} onClick={changePw}>Change password</button>
          <h3>Your data</h3>
          <div className="row wrap">
            <button className="btn secondary sm" onClick={exportData}>⬇ Export my data</button>
            <button className="btn danger sm" onClick={() => setDel({ ...del, open: true })}>Delete account</button>
          </div>
          <div className="tiny muted">Calls are never recorded. Photos used for AI reading are deleted immediately after text extraction.</div>
        </div>
      </div>
      <Modal open={del.open} onClose={() => setDel({ open: false, password: '', confirm: '' })} title="Delete your account?">
        <div className="stack">
          <p>This permanently deletes your profile, progress, saved words, writing, call history and subscription records. It cannot be undone. Cancel any app-store subscription in the store first.</p>
          <input className="input" type="password" placeholder="Password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} />
          <input className="input" placeholder='Type "DELETE" to confirm' value={del.confirm} onChange={(e) => setDel({ ...del, confirm: e.target.value })} />
          <button className="btn danger" disabled={del.confirm !== 'DELETE' || !del.password} onClick={deleteAccount}>Permanently delete</button>
        </div>
      </Modal>
    </div>
  );
}

const LIMIT_LABEL: [string, string][] = [
  ['callsPerDay', 'Speaking calls per day'], ['maxCallMinutes', 'Minutes per call'], ['aiWritingFeedbackPerDay', 'Writing evaluations per day'],
  ['speakingAnalysesPerDay', 'Speaking analyses per day'], ['mockTestsPerMonth', 'Mock tests per 30 days'], ['aiReadingScansPerDay', 'Photo scans per day'],
  ['wordLookupsPerDay', 'Word lookups per day'], ['translationsPerDay', 'Translations per day'], ['rankedBattlesPerDay', 'Ranked battles per day'],
  ['premiumTopics', 'All conversation topics'], ['matchingPreferences', 'Partner level preferences'], ['priorityMatching', 'Priority matching'],
];

export function SubscriptionPage() {
  const { entitlements, refreshEntitlements } = useAuth();
  const plans = useApi<any>('/billing/plans');
  const status = useApi<any>('/billing/status');
  const [params] = useSearchParams();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void refreshEntitlements();
  }, [refreshEntitlements]);
  const checkout = async () => {
    setErr(null);
    try {
      const r = await api.post<{ url: string }>('/billing/checkout');
      window.location.href = r.url;
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const portal = async () => {
    try {
      const r = await api.post<{ url: string }>('/billing/portal');
      window.location.href = r.url;
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const fmt = (v: any) => (v === null ? 'Unlimited' : v === true ? '✓' : v === false ? '—' : String(v));
  const free = plans.data?.plans.find((p: any) => p.id === 'free');
  const prem = plans.data?.plans.find((p: any) => p.id === 'premium');
  return (
    <div className="stack lg">
      <PageHeader title="Your plan" subtitle={entitlements ? `You're on ${entitlements.planName}${entitlements.currentPeriodEnd ? ` until ${formatDate(entitlements.currentPeriodEnd)}` : ''}.` : ''} />
      {params.get('checkout') === 'success' && <div className="alert success">Payment received. Your plan updates as soon as the payment provider confirms it (usually within a minute).</div>}
      {params.get('checkout') === 'cancelled' && <div className="alert info">Checkout cancelled. You have not been charged.</div>}
      <ErrorBox error={err} />
      {plans.loading ? <Loading /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th></th><th>Free</th><th>Premium {prem?.price_display && <span className="tiny muted">({prem.price_display})</span>}</th></tr></thead>
            <tbody>{LIMIT_LABEL.map(([k, l]) => <tr key={k}><td>{l}</td><td>{fmt(free?.limits[k])}</td><td><b>{fmt(prem?.limits[k])}</b></td></tr>)}</tbody>
          </table>
        </div>
      )}
      {entitlements && (
        <div className="card">
          <h3>Today's usage</h3>
          <div className="grid cols-4 small">
            <div>Calls: <b>{entitlements.usageToday.calls}</b> / {fmt(entitlements.limits.callsPerDay)}</div>
            <div>Writing evaluations: <b>{entitlements.usageToday.aiWritingFeedback}</b> / {fmt(entitlements.limits.aiWritingFeedbackPerDay)}</div>
            <div>Photo scans: <b>{entitlements.usageToday.aiReadingScans}</b> / {fmt(entitlements.limits.aiReadingScansPerDay)}</div>
            <div>Word lookups: <b>{entitlements.usageToday.wordLookups}</b> / {fmt(entitlements.limits.wordLookupsPerDay)}</div>
          </div>
        </div>
      )}
      <div className="card stack">
        {entitlements?.plan === 'premium' ? (
          <>
            <h3>⭐ You have Premium</h3>
            <div className="small muted">Source: {entitlements.source}. {entitlements.status === 'past_due' && 'There is a payment problem — please update your payment details.'}</div>
            {entitlements.source === 'stripe' && <button className="btn secondary" onClick={portal}>Manage billing</button>}
            {(entitlements.source === 'revenuecat' || entitlements.source === 'app_store' || entitlements.source === 'play_store') && <div className="small">Manage this subscription in the App Store or Google Play on your phone.</div>}
          </>
        ) : (
          <>
            <h3>Upgrade to Premium</h3>
            {plans.data?.web.available ? (
              <button className="btn lg" onClick={checkout}>Upgrade with card (web)</button>
            ) : (
              <div className="alert info small">Web payments are not enabled yet on this server. Premium can be granted by an administrator for testing, or purchased in the mobile app once app-store billing is configured.</div>
            )}
            <div className="tiny muted">Premium is linked to your account, so it works on the web, Android and iOS. Purchases are verified by our server before access is granted.</div>
          </>
        )}
        {status.data?.subscriptions?.length > 0 && (
          <details className="small"><summary>Subscription history</summary>
            {status.data.subscriptions.map((s: any, i: number) => <div key={i}>{s.provider} · {s.status} · {s.current_period_end ? `until ${formatDate(s.current_period_end)}` : ''}{s.cancel_at_period_end ? ' · cancels at period end' : ''}</div>)}
          </details>
        )}
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const { data, loading, error, reload } = useApi<any>('/me/notifications');
  useEffect(() => {
    if (data?.unread) void api.post('/me/notifications/read', {}).catch(() => undefined);
  }, [data]);
  return (
    <div className="stack lg" style={{ maxWidth: 760 }}>
      <PageHeader title="Notifications" subtitle={<Link to="/profile">Notification settings</Link>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Loading /> : !data.items.length ? <div className="card"><Empty icon="🔔" title="No notifications" /></div> : (
        <div className="card list">
          {data.items.map((n: any) => (
            <div key={n.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <span>{n.read_at ? '○' : '●'}</span>
              <div style={{ flex: 1 }}><b>{n.title}</b><div className="small muted">{n.body}</div></div>
              <span className="tiny muted">{formatDate(n.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
