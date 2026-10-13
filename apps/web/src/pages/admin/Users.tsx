import { useState } from 'react';
import { Search } from 'lucide-react';
import { Alert, Badge, Button, ErrorState, Modal, PageLoader, Select, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { formatDate, formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface U { id: string; email: string; role: string; status: string; createdAt: string; lastLoginAt: string | null; displayName: string; cefrLevel: string | null; plan: string | null; provider: string | null }
interface Detail { user: U & { googleLinked: boolean }; profile: { displayName: string; cefrLevel: string | null; goals: string[] }; subscription: { plan: string; provider: string; currentPeriodEnd: string | null } | null; reportsAgainst: { id: string; reason: string; status: string; createdAt: string; details: string }[]; stats: { activities: number; xp: number; calls: number } }

export default function Users() {
  const me = useMe();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const list = useApi<{ items: U[]; total: number }>(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`, [query]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [days, setDays] = useState('30');

  const open = async (id: string) => setDetail(await api.get<Detail>(`/api/admin/users/${id}`));
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      list.reload();
      if (detail) await open(detail.user.id);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
        <div className="relative flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search by email or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" /></div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      {list.loading && !list.data ? <PageLoader /> : list.error ? <ErrorState message={list.error} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left dark:border-slate-700"><tr><th className="px-4 py-2.5">User</th><th>Role</th><th>Status</th><th>Plan</th><th>Joined</th><th>Last login</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data!.items.map((u) => (
                <tr key={u.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => open(u.id)}>
                  <td className="px-4 py-2.5"><div className="font-medium">{u.displayName}</div><div className="muted text-xs">{u.email}</div></td>
                  <td>{u.role === 'admin' ? <Badge tone="violet">admin</Badge> : 'user'}</td>
                  <td><Badge tone={u.status === 'active' ? 'green' : u.status === 'suspended' ? 'red' : 'slate'}>{u.status}</Badge></td>
                  <td className="capitalize">{u.plan ?? 'free'}{u.provider === 'development' ? ' (dev)' : ''}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{formatDateTime(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="muted border-t border-slate-100 px-4 py-2 text-xs dark:border-slate-800">{list.data!.total} users</div>
        </div>
      )}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} size="lg" title={detail?.profile.displayName ?? ''}>
        {detail && (
          <div className="space-y-5 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div><span className="muted">Email:</span> {detail.user.email}</div>
              <div><span className="muted">Level:</span> {detail.profile.cefrLevel ?? 'not assessed'}</div>
              <div><span className="muted">Activities:</span> {detail.stats.activities} ({detail.stats.xp} XP)</div>
              <div><span className="muted">Calls:</span> {detail.stats.calls}</div>
              <div><span className="muted">Google linked:</span> {detail.user.googleLinked ? 'yes' : 'no'}</div>
              <div><span className="muted">Plan:</span> {detail.subscription?.plan ?? 'free'} ({detail.subscription?.provider ?? 'none'}){detail.subscription?.currentPeriodEnd ? ` until ${formatDate(detail.subscription.currentPeriodEnd)}` : ''}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {detail.user.status === 'active'
                ? <Button size="sm" variant="danger" disabled={detail.user.id === me.id} onClick={() => act(() => api.patch(`/api/admin/users/${detail.user.id}`, { status: 'suspended' }), 'User suspended')}>Suspend</Button>
                : <Button size="sm" variant="success" onClick={() => act(() => api.patch(`/api/admin/users/${detail.user.id}`, { status: 'active' }), 'User reactivated')}>Reactivate</Button>}
              {detail.user.role === 'admin'
                ? <Button size="sm" variant="secondary" disabled={detail.user.id === me.id} onClick={() => act(() => api.patch(`/api/admin/users/${detail.user.id}`, { role: 'user' }), 'Admin role removed')}>Remove admin role</Button>
                : <Button size="sm" variant="secondary" onClick={() => act(() => api.patch(`/api/admin/users/${detail.user.id}`, { role: 'admin' }), 'User is now an admin')}>Make admin</Button>}
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-2 font-semibold">Subscription</div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-40"><Select label="Grant Premium for" value={days} onChange={(e) => setDays(e.target.value)}>{['7', '30', '90', '365'].map((d) => <option key={d} value={d}>{d} days</option>)}</Select></div>
                <Button size="sm" onClick={() => act(() => api.patch(`/api/admin/users/${detail.user.id}/subscription`, { plan: 'premium', days: Number(days) }), 'Premium granted')}>Grant Premium</Button>
                <Button size="sm" variant="secondary" onClick={() => act(() => api.patch(`/api/admin/users/${detail.user.id}/subscription`, { plan: 'free' }), 'Set to Free')}>Set to Free</Button>
              </div>
              <p className="muted mt-2 text-xs">Admin grants are recorded as provider “admin”. Stripe subscriptions must be managed in Stripe.</p>
            </div>
            <div>
              <div className="mb-1 font-semibold">Reports against this user ({detail.reportsAgainst.length})</div>
              {detail.reportsAgainst.length ? <ul className="space-y-1">{detail.reportsAgainst.map((r) => <li key={r.id}><Badge>{r.status}</Badge> {r.reason} — {r.details || 'no details'} <span className="muted">({formatDate(r.createdAt)})</span></li>)}</ul> : <p className="muted">None.</p>}
            </div>
            {detail.user.id === me.id && <Alert tone="info">This is your own account. You cannot suspend yourself or remove your own admin role.</Alert>}
          </div>
        )}
      </Modal>
    </div>
  );
}
