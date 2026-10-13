import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Download, LogOut, Monitor, Moon, Smartphone, Sun } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, ChoiceChip, ConfirmDialog, Input, Modal, PageHeader, Toggle, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth, useMe } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import type { Me, Settings as S } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { validatePassword } from '../auth/Register';

export default function Settings() {
  const me = useMe();
  const { setMe, integrations } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const blocks = useApi<{ blocks: { id: string; alias: string; createdAt: string }[] }>('/api/blocks');
  const sessions = useApi<{ sessions: { id: string; client: string; userAgent: string | null; lastUsedAt: string; current: boolean }[] }>('/api/auth/sessions');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [deactivate, setDeactivate] = useState(false);
  const [del, setDel] = useState(false);
  const [delForm, setDelForm] = useState({ password: '', confirm: '' });
  const [delErr, setDelErr] = useState<string | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [deactPw, setDeactPw] = useState('');

  const update = async (patch: Partial<S>) => {
    try {
      const r = await api.patch<{ me: Me }>('/api/settings', patch);
      setMe(r.me);
      toast('Settings saved');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validatePassword(pw.next);
    if (problem) return setPwMsg({ tone: 'error', text: problem });
    if (pw.next !== pw.confirm) return setPwMsg({ tone: 'error', text: 'New passwords do not match.' });
    setPwBusy(true);
    try {
      await api.post('/api/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ tone: 'success', text: 'Password changed. Other devices have been signed out.' });
      sessions.reload();
    } catch (err) {
      setPwMsg({ tone: 'error', text: errorMessage(err) });
    } finally {
      setPwBusy(false);
    }
  };

  const s = me.settings;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" />

      <Card>
        <CardHeader title="Appearance and study goal" />
        <div className="space-y-4 p-5">
          <div>
            <div className="label">Theme</div>
            <div className="grid grid-cols-3 gap-2">
              {([['system', 'System', Monitor], ['light', 'Light', Sun], ['dark', 'Dark', Moon]] as const).map(([id, label, Icon]) => (
                <ChoiceChip key={id} selected={s.theme === id} onClick={() => update({ theme: id })}><span className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span></ChoiceChip>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="goal">Daily study goal</label>
            <select id="goal" className="input max-w-xs" value={s.dailyGoalMinutes} onChange={(e) => update({ dailyGoalMinutes: Number(e.target.value) })}>
              {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Notifications" subtitle="In-app notifications are always shown in the bell menu." />
        <div className="divide-y divide-slate-100 px-5 dark:divide-slate-800">
          <Toggle label="Email notifications" description={integrations?.email ? 'Receive the notifications below by email too.' : 'Email delivery is not configured on this server, so only in-app notifications are sent.'} checked={s.notifyEmail} onChange={(v) => update({ notifyEmail: v })} />
          <Toggle label="Streak reminders" description="A reminder in the evening if you have not studied yet and your streak is at risk." checked={s.notifyStreak} onChange={(v) => update({ notifyStreak: v })} />
          <Toggle label="Feedback ready" description="When AI feedback on your writing or speaking is ready." checked={s.notifyFeedback} onChange={(v) => update({ notifyFeedback: v })} />
          <Toggle label="Product news" description="Occasional updates about new features." checked={s.notifyProduct} onChange={(v) => update({ notifyProduct: v })} />
        </div>
      </Card>

      <Card id="privacy">
        <CardHeader title="Privacy and safety" />
        <div className="divide-y divide-slate-100 px-5 dark:divide-slate-800">
          <Toggle label="Allow voice calls" description="When off, you cannot join the voice practice queue." checked={s.allowCalls} onChange={(v) => update({ allowCalls: v })} />
          <Toggle label="Show my estimated level to call partners" description="Partners always see a random name. This only adds your CEFR estimate, e.g. “B1”." checked={s.showLevelInCalls} onChange={(v) => update({ showLevelInCalls: v })} />
        </div>
        <div className="border-t border-slate-100 p-5 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Blocked users</h3>
          <p className="muted text-xs">You will never be matched with these people in calls or battles. Names shown are the anonymous names they had when you blocked them.</p>
          {blocks.data?.blocks.length ? (
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {blocks.data.blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{b.alias} <span className="muted text-xs">· blocked {formatDateTime(b.createdAt)}</span></span>
                  <Button size="sm" variant="ghost" onClick={async () => { await api.del(`/api/blocks/${b.id}`); toast('Unblocked'); blocks.reload(); }}>Unblock</Button>
                </li>
              ))}
            </ul>
          ) : <p className="muted mt-2 text-sm">You have not blocked anyone.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Password and security" />
        <form className="space-y-3 p-5" onSubmit={changePassword}>
          {pwMsg && <Alert tone={pwMsg.tone}>{pwMsg.text}</Alert>}
          {me.hasPassword ? <Input label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /> : <Alert tone="info">You signed up with Google. You can set a password to also sign in with your email.</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </div>
          <Button type="submit" variant="secondary" loading={pwBusy}>{me.hasPassword ? 'Change password' : 'Set password'}</Button>
        </form>
        <div className="border-t border-slate-100 p-5 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Signed-in devices</h3>
          <ul className="mt-2 space-y-2">
            {sessions.data?.sessions.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">{x.client === 'mobile' ? <Smartphone className="h-4 w-4 shrink-0" /> : <Monitor className="h-4 w-4 shrink-0" />}<span className="truncate">{x.userAgent?.slice(0, 60) ?? x.client}</span>{x.current && <Badge tone="green">This device</Badge>}</span>
                {!x.current && <Button size="sm" variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={async () => { await api.del(`/api/auth/sessions/${x.id}`); sessions.reload(); }}>Sign out</Button>}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card>
        <CardHeader title="Your data" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="muted text-sm">Download everything FluentPath stores about you as a JSON file.</p>
          <a href="/api/account/export" download className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Download className="h-4 w-4" /> Download my data</a>
        </div>
      </Card>

      <Card className="border-red-200 dark:border-red-900">
        <CardHeader title={<span className="text-red-700 dark:text-red-400">Danger zone</span>} />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="font-medium">Deactivate account</div><p className="muted text-sm">Signs you out everywhere and hides you from matching. Sign in again any time to reactivate.</p></div>
            <Button variant="secondary" onClick={() => setDeactivate(true)}>Deactivate</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="font-medium">Delete account permanently</div><p className="muted text-sm">Deletes your profile, progress, recordings, photos and history. This cannot be undone.</p></div>
            <Button variant="danger" onClick={() => setDel(true)}>Delete account</Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={deactivate}
        onClose={() => setDeactivate(false)}
        title="Deactivate your account?"
        confirmLabel="Deactivate"
        danger
        message={<div className="space-y-3"><p>You will be signed out on all devices.</p>{me.hasPassword && <Input label="Password" type="password" value={deactPw} onChange={(e) => setDeactPw(e.target.value)} />}</div>}
        onConfirm={async () => {
          try {
            await api.post('/api/account/deactivate', { password: deactPw });
            setMe(null);
            nav('/');
          } catch (err) {
            toast(errorMessage(err), 'error');
            throw err;
          }
        }}
      />
      <Modal open={del} onClose={() => setDel(false)} title="Delete your account permanently?" footer={<><Button variant="secondary" onClick={() => setDel(false)}>Cancel</Button><Button variant="danger" loading={delBusy} disabled={delForm.confirm !== 'DELETE'} onClick={async () => {
        setDelBusy(true);
        setDelErr(null);
        try {
          await api.del('/api/account', { password: delForm.password, confirm: delForm.confirm });
          setMe(null);
          nav('/');
        } catch (err) {
          setDelErr(errorMessage(err));
        } finally {
          setDelBusy(false);
        }
      }}>Delete forever</Button></>}>
        <div className="space-y-3 text-sm">
          {delErr && <Alert tone="error">{delErr}</Alert>}
          <p>All of your data will be deleted immediately. Paid subscriptions are cancelled.</p>
          {me.hasPassword && <Input label="Password" type="password" value={delForm.password} onChange={(e) => setDelForm({ ...delForm, password: e.target.value })} />}
          <Input label="Type DELETE to confirm" value={delForm.confirm} onChange={(e) => setDelForm({ ...delForm, confirm: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
