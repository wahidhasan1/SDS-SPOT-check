import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, ClipboardList, FileJson, Flag, Gauge, Library, Save, Search, Settings2, Shield, Users } from 'lucide-react'
import { LIMIT_KEYS, type LimitKey } from '../../../shared/config'
import { api, errorMessage, post } from '../../lib/api'
import { useUser } from '../../lib/session'
import { Badge, EmptyState, ErrorState, Field, Modal, Page, PageHeader, PageLoader, Segmented, cx, toast } from '../../components/ui'

/** Admin console. The client hides it from non-admins, but every API route checks the role on the server. */
export default function Admin() {
  const me = useUser()
  if (me.role !== 'admin') return <Page><EmptyState icon={Shield} title="Admins only" body="You don’t have access to this area." /></Page>
  const tabs = [
    { to: '/admin', label: 'Overview', icon: Gauge, end: true },
    { to: '/admin/reports', label: 'Reports', icon: Flag },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/content', label: 'Content', icon: FileJson },
    { to: '/admin/vocab', label: 'Vocabulary', icon: Library },
    { to: '/admin/plans', label: 'Plans & limits', icon: ClipboardList },
    { to: '/admin/matching', label: 'Matching', icon: Settings2 },
    { to: '/admin/audit', label: 'Audit log', icon: Shield },
  ]
  return (
    <Page width="max-w-6xl">
      <PageHeader title="Admin" eyebrow="Bandmate" />
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4 pb-1" aria-label="Admin sections">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cx('chip shrink-0', isActive && 'chip-on')}>
            <t.icon className="size-4" /> {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<UserList />} />
        <Route path="users/:id" element={<UserDetail />} />
        <Route path="content" element={<ContentList />} />
        <Route path="content/:id" element={<ContentEditor />} />
        <Route path="vocab" element={<VocabAdmin />} />
        <Route path="plans" element={<Plans />} />
        <Route path="matching" element={<Matching />} />
        <Route path="audit" element={<Audit />} />
      </Routes>
    </Page>
  )
}

const when = (t: number | null | undefined) => (t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—')

function Overview() {
  const q = useQuery({ queryKey: ['admin-overview'], queryFn: () => api<Record<string, number | null> & { activeByDay: { day: string; users: number }[] }>('/admin/overview') })
  if (q.isLoading) return <PageLoader />
  if (q.error) return <ErrorState error={q.error} />
  const d = q.data!
  const stats: [string, string | number][] = [
    ['Users', d.users ?? 0],
    ['New (7 days)', d.newUsers7d ?? 0],
    ['Active (7 days)', d.active7d ?? 0],
    ['Premium', d.premium ?? 0],
    ['Calls (24 h)', d.calls24h ?? 0],
    ['Avg call (7 days)', d.avgCallMin7d != null ? `${(d.avgCallMin7d as number).toFixed(1)} min` : '—'],
    ['Open reports', d.openReports ?? 0],
    ['Battles (24 h)', d.battles24h ?? 0],
    ['Essays (7 days)', d.essays7d ?? 0],
    ['Tests (7 days)', d.tests7d ?? 0],
  ]
  const max = Math.max(1, ...d.activeByDay.map((x) => x.users))
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(([k, v]) => <div key={k} className="card p-4"><p className="text-2xl font-extrabold tabular-nums">{v}</p><p className="text-xs text-muted">{k}</p></div>)}
      </div>
      <div className="card p-5">
        <p className="mb-3 font-bold">Active learners per day (last 14 days)</p>
        <div className="flex h-36 items-end gap-1.5" role="img" aria-label={d.activeByDay.map((x) => `${x.day}: ${x.users}`).join(', ')}>
          {d.activeByDay.map((x) => (
            <div key={x.day} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-muted">{x.users || ''}</span>
              <div className="w-full rounded-t bg-primary" style={{ height: `${(x.users / max) * 100}%`, minHeight: x.users ? 4 : 1 }} />
              <span className="text-[10px] text-faint">{x.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type Report = { id: string; reason: string; details: string | null; context: string; status: string; createdAt: number; resolution: string | null; reportedId: string | null; reported: string | null; reporter: string | null; recentReports: number; callMode: string | null; callTopic: string | null; callConnectedAt: number | null; callEndedAt: number | null }

function Reports() {
  const [status, setStatus] = useState<'open' | 'actioned' | 'dismissed'>('open')
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['admin-reports', status], queryFn: () => api<Report[]>(`/admin/reports?status=${status}`) })
  const [act, setAct] = useState<Report | null>(null)
  return (
    <div>
      <Segmented label="Report status" value={status} onChange={setStatus} items={[{ id: 'open', label: 'Open' }, { id: 'actioned', label: 'Actioned' }, { id: 'dismissed', label: 'Dismissed' }]} />
      <p className="mt-2 text-xs text-muted">Calls are never recorded, so decisions rely on the report, the reporter’s details and patterns across reports.</p>
      <div className="mt-4">
        {q.isLoading ? <PageLoader /> : q.error ? <ErrorState error={q.error} /> : !q.data!.length ? <EmptyState icon={Flag} title={`No ${status} reports`} /> : (
          <ul className="space-y-2">
            {q.data!.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="bad">{r.reason.replace(/_/g, ' ')}</Badge>
                  <span className="text-sm">against <b>{r.reported ?? 'deleted user'}</b> by {r.reporter ?? 'deleted user'}</span>
                  {r.recentReports > 1 && <Badge tone="warn">{r.recentReports} reporters in 30 days</Badge>}
                  <span className="ml-auto text-xs text-muted">{when(r.createdAt)}</span>
                </div>
                {r.details && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-sm">{r.details}</p>}
                <p className="mt-2 text-xs text-muted">{r.context} · {r.callMode ?? ''} {r.callTopic ?? ''} {r.callConnectedAt && r.callEndedAt ? `· ${Math.round((r.callEndedAt - r.callConnectedAt) / 60000)} min call` : ''}</p>
                {r.resolution && <p className="mt-1 text-sm text-muted">Resolution: {r.resolution}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.reportedId && <Link to={`/admin/users/${r.reportedId}`} className="btn btn-ghost btn-sm">View user</Link>}
                  {r.status === 'open' && <button className="btn btn-primary btn-sm" onClick={() => setAct(r)}>Resolve…</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {act && <ResolveModal r={act} onClose={() => setAct(null)} onDone={() => { setAct(null); qc.invalidateQueries({ queryKey: ['admin-reports'] }) }} />}
    </div>
  )
}

function ResolveModal({ r, onClose, onDone }: { r: Report; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<'dismiss' | 'warn' | 'suspend_calls' | 'suspend' | 'ban'>('warn')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal open onClose={onClose} title={`Resolve report about ${r.reported ?? 'user'}`} footer={<button className="btn btn-primary" disabled={note.trim().length < 3 || busy} onClick={async () => { setBusy(true); try { await post(`/admin/reports/${r.id}/resolve`, { action, note }); toast('Report resolved'); onDone() } catch (e) { toast(errorMessage(e), 'bad'); setBusy(false) } }}>Confirm</button>}>
      <div className="space-y-4">
        <div className="grid gap-2">
          {([['dismiss', 'Dismiss — no action'], ['warn', 'Warn the user'], ['suspend_calls', 'Pause voice calls for 7 days'], ['suspend', 'Suspend the account'], ['ban', 'Ban permanently']] as const).map(([id, label]) => (
            <label key={id} className={cx('flex items-center gap-2 rounded-xl border p-3', action === id ? 'border-primary bg-primary-soft' : 'border-border')}>
              <input type="radio" name="act" checked={action === id} onChange={() => setAction(id)} /> {label}
            </label>
          ))}
        </div>
        <Field label="Note (shown to the user for warnings and pauses; always kept in the audit log)" htmlFor="note"><textarea id="note" className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function UserList() {
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const list = useQuery({ queryKey: ['admin-users', term], queryFn: () => api<{ id: string; email: string; role: string; status: string; createdAt: number; lastSeenAt: number | null; anonName: string; displayName: string; level: string | null; plan: string }[]>(`/admin/users?q=${encodeURIComponent(term)}`) })
  return (
    <div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q) }}>
        <input className="input" placeholder="Search email, name or anonymous name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <button className="btn btn-secondary"><Search className="size-4" /> Search</button>
      </form>
      <div className="card mt-4 overflow-x-auto">
        {list.isLoading ? <PageLoader /> : list.error ? <ErrorState error={list.error} /> : (
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-border text-left text-muted"><th className="p-3">User</th><th className="p-3">Anonymous</th><th className="p-3">Level</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Joined</th></tr></thead>
            <tbody>
              {list.data!.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="p-3"><Link to={`/admin/users/${u.id}`} className="link font-semibold">{u.email}</Link>{u.role === 'admin' && <Badge tone="primary" className="ml-1">admin</Badge>}</td>
                  <td className="p-3">{u.anonName}</td>
                  <td className="p-3">{u.level ?? '—'}</td>
                  <td className="p-3">{u.plan}</td>
                  <td className="p-3"><Badge tone={u.status === 'active' ? 'good' : 'bad'}>{u.status}</Badge></td>
                  <td className="p-3 text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

type UserDetailT = { id: string; email: string; role: string; status: string; created_at: number; last_seen_at: number | null; profile: Record<string, unknown>; plan: { planId: string; planName: string; subscription: { provider: string; currentPeriodEnd: number | null } | null }; subscriptions: { id: string; planId: string; provider: string; status: string; currentPeriodEnd: number | null }[]; reportsAgainst: { id: string; reason: string; details: string | null; status: string; createdAt: number; reporter: string | null }[]; reportsMade: number; moderation: { action: string; reason: string; actor: string; createdAt: number; expiresAt: number | null }[]; calls: number }

function UserDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['admin-user', id], queryFn: () => api<UserDetailT>(`/admin/users/${id}`) })
  const [modal, setModal] = useState<null | 'status' | 'grant' | 'lift'>(null)
  const [status, setStatus] = useState<'active' | 'suspended' | 'banned'>('suspended')
  const [reason, setReason] = useState('')
  const [days, setDays] = useState<number | ''>(30)
  const refresh = () => {
    setModal(null)
    setReason('')
    qc.invalidateQueries({ queryKey: ['admin-user', id] })
  }
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      toast(msg)
      refresh()
    } catch (e) {
      toast(errorMessage(e), 'bad')
    }
  }
  if (q.isLoading) return <PageLoader />
  if (q.error) return <ErrorState error={q.error} />
  const u = q.data!
  return (
    <div className="space-y-4">
      <Link to="/admin/users" className="link text-sm">← All users</Link>
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="h2 flex-1">{u.email}</h2>
          <Badge tone={u.status === 'active' ? 'good' : 'bad'}>{u.status}</Badge>
          <Badge tone="primary">{u.plan.planName}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">Anonymous name {String(u.profile.anon_name)} · level {String(u.profile.cefr_level ?? '—')} · joined {when(u.created_at)} · last seen {when(u.last_seen_at)} · {u.calls} calls · {u.reportsMade} reports made</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setModal('status')}><Ban className="size-4" /> Change status</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setModal('grant')}>Grant / revoke Premium</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setModal('lift')}>Lift call suspension</button>
          <button className="btn btn-ghost btn-sm" onClick={() => run(() => post(`/admin/users/${u.id}/role`, { role: u.role === 'admin' ? 'user' : 'admin' }), 'Role updated')}>{u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="font-bold">Reports against this user</h3>
          {!u.reportsAgainst.length ? <p className="mt-2 text-sm text-muted">None.</p> : <ul className="mt-2 space-y-2 text-sm">{u.reportsAgainst.map((r) => <li key={r.id}><Badge tone={r.status === 'open' ? 'warn' : 'neutral'}>{r.status}</Badge> {r.reason} by {r.reporter ?? '—'} · {when(r.createdAt)}{r.details && <span className="block text-muted">{r.details}</span>}</li>)}</ul>}
        </section>
        <section className="card p-5">
          <h3 className="font-bold">Moderation history</h3>
          {!u.moderation.length ? <p className="mt-2 text-sm text-muted">None.</p> : <ul className="mt-2 space-y-2 text-sm">{u.moderation.map((m, i) => <li key={i}><b>{m.action}</b> · {m.reason} · {m.actor === 'system' ? 'automatic' : 'admin'} · {when(m.createdAt)}{m.expiresAt && ` (until ${when(m.expiresAt)})`}</li>)}</ul>}
        </section>
        <section className="card p-5 lg:col-span-2">
          <h3 className="font-bold">Subscriptions</h3>
          {!u.subscriptions.length ? <p className="mt-2 text-sm text-muted">None.</p> : <ul className="mt-2 space-y-1 text-sm">{u.subscriptions.map((s) => <li key={s.id}>{s.planId} · {s.provider} · {s.status} · ends {when(s.currentPeriodEnd)}</li>)}</ul>}
        </section>
      </div>
      <Modal open={modal === 'status'} onClose={() => setModal(null)} title="Change account status" footer={<button className="btn btn-primary" disabled={reason.trim().length < 3} onClick={() => run(() => post(`/admin/users/${u.id}/status`, { status, reason }), 'Status updated')}>Save</button>}>
        <div className="space-y-4">
          <Segmented label="Status" value={status} onChange={setStatus} items={[{ id: 'active', label: 'Active' }, { id: 'suspended', label: 'Suspended' }, { id: 'banned', label: 'Banned' }]} />
          <Field label="Reason (audit log; shown to the user for suspensions)" htmlFor="rs"><textarea id="rs" className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
      </Modal>
      <Modal open={modal === 'grant'} onClose={() => setModal(null)} title="Premium grant" footer={<><button className="btn btn-ghost" disabled={reason.trim().length < 3} onClick={() => run(() => post(`/admin/users/${u.id}/grant`, { planId: 'premium', days: null, reason, revoke: true }), 'Grant revoked')}>Revoke</button><button className="btn btn-primary" disabled={reason.trim().length < 3} onClick={() => run(() => post(`/admin/users/${u.id}/grant`, { planId: 'premium', days: days === '' ? null : days, reason }), 'Premium granted')}>Grant</button></>}>
        <div className="space-y-4">
          <Field label="Days (empty = no end date)" htmlFor="dy"><input id="dy" type="number" min={1} className="input" value={days} onChange={(e) => setDays(e.target.value ? Number(e.target.value) : '')} /></Field>
          <Field label="Reason (audit log)" htmlFor="gr"><input id="gr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <p className="text-xs text-muted">This only affects admin grants. Paid subscriptions are managed by the payment provider.</p>
        </div>
      </Modal>
      <Modal open={modal === 'lift'} onClose={() => setModal(null)} title="Lift call suspension" footer={<button className="btn btn-primary" disabled={reason.trim().length < 3} onClick={() => run(() => post(`/admin/users/${u.id}/lift-call-suspension`, { reason }), 'Calls re-enabled')}>Lift</button>}>
        <Field label="Reason (audit log)" htmlFor="lr"><input id="lr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </div>
  )
}

const KINDS = ['reading', 'listening', 'writing', 'speaking', 'grammar', 'mock'] as const

function ContentList() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('writing')
  const nav = useNavigate()
  const q = useQuery({ queryKey: ['admin-content', kind], queryFn: () => api<{ id: string; kind: string; testType: string | null; title: string; level: string | null; premium: number; status: string; source: string; updatedAt: number }[]>(`/admin/content?kind=${kind}`) })
  const [newId, setNewId] = useState('')
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">{KINDS.map((k) => <button key={k} className={cx('chip', kind === k && 'chip-on')} onClick={() => setKind(k)}>{k}</button>)}</div>
      <p className="mt-2 text-xs text-muted">Content is validated before saving so the app can always use it. Edited items are marked “admin” and are never overwritten by seed updates. Only publish original material you have the rights to use.</p>
      <div className="card mt-4 overflow-x-auto">
        {q.isLoading ? <PageLoader /> : q.error ? <ErrorState error={q.error} /> : (
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-b border-border text-left text-muted"><th className="p-3">Title</th><th className="p-3">ID</th><th className="p-3">Test</th><th className="p-3">Status</th><th className="p-3">Source</th></tr></thead>
            <tbody>
              {q.data!.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="p-3"><Link className="link font-semibold" to={`/admin/content/${c.id}`}>{c.title}</Link> {!!c.premium && <Badge tone="primary">premium</Badge>}</td>
                  <td className="p-3 font-mono text-xs">{c.id}</td>
                  <td className="p-3">{c.testType ?? '—'}</td>
                  <td className="p-3"><Badge tone={c.status === 'published' ? 'good' : 'neutral'}>{c.status}</Badge></td>
                  <td className="p-3">{c.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (newId) nav(`/admin/content/${newId}?kind=${kind}`) }}>
        <input className="input w-auto" placeholder="new-item-id" value={newId} onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} aria-label="New content id" />
        <button className="btn btn-secondary">New {kind} item</button>
      </form>
    </div>
  )
}

function ContentEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const kindParam = new URLSearchParams(location.search).get('kind') as (typeof KINDS)[number] | null
  const q = useQuery({ queryKey: ['admin-content-item', id], queryFn: () => api<{ id: string; kind: (typeof KINDS)[number]; test_type: string | null; title: string; level: string | null; premium: number; status: string; sort: number; data: unknown }>(`/admin/content/${id}`), retry: false })
  const [f, setF] = useState<{ title: string; kind: (typeof KINDS)[number]; testType: string | null; level: string; premium: boolean; status: string; sort: number; json: string } | null>(null)
  useEffect(() => {
    if (q.data) setF({ title: q.data.title, kind: q.data.kind, testType: q.data.test_type, level: q.data.level ?? '', premium: !!q.data.premium, status: q.data.status, sort: q.data.sort, json: JSON.stringify(q.data.data, null, 2) })
    else if (q.error && kindParam) setF({ title: '', kind: kindParam, testType: 'both', level: '', premium: false, status: 'draft', sort: 100, json: '{\n}' })
  }, [q.data, q.error, kindParam])
  if (q.isLoading || !f) return q.error && !kindParam ? <ErrorState error={q.error} /> : <PageLoader />
  const save = async () => {
    let data: unknown
    try {
      data = JSON.parse(f.json)
    } catch (e) {
      return toast(`JSON error: ${(e as Error).message}`, 'bad')
    }
    try {
      await api(`/admin/content/${id}`, { method: 'PUT', body: { title: f.title, kind: f.kind, testType: f.testType, level: f.level || null, premium: f.premium, status: f.status, sort: f.sort, data } })
      toast('Saved')
      qc.invalidateQueries({ queryKey: ['admin-content'] })
      nav('/admin/content')
    } catch (e) {
      toast(errorMessage(e), 'bad')
    }
  }
  return (
    <div className="space-y-4">
      <Link to="/admin/content" className="link text-sm">← Content</Link>
      <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Title" htmlFor="t"><input id="t" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Status" htmlFor="st"><select id="st" className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{['published', 'draft', 'pending_review', 'archived'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Test type" htmlFor="tt"><select id="tt" className="input" value={f.testType ?? ''} onChange={(e) => setF({ ...f, testType: e.target.value || null })}>{['', 'academic', 'general_training', 'both'].map((s) => <option key={s} value={s}>{s || '—'}</option>)}</select></Field>
        <Field label="Level" htmlFor="lv"><input id="lv" className="input" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} placeholder="e.g. B2" /></Field>
        <Field label="Order" htmlFor="so"><input id="so" type="number" className="input" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} /></Field>
        <label className="flex items-center gap-2 self-end pb-3"><input type="checkbox" checked={f.premium} onChange={(e) => setF({ ...f, premium: e.target.checked })} /> Premium content</label>
      </div>
      <Field label={`Data (${f.kind}, JSON)`} htmlFor="js"><textarea id="js" className="input min-h-[55vh] font-mono text-[13px]" spellCheck={false} value={f.json} onChange={(e) => setF({ ...f, json: e.target.value })} /></Field>
      <button className="btn btn-primary" onClick={save}><Save className="size-4" /> Validate & save</button>
    </div>
  )
}

function VocabAdmin() {
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['admin-vocab', term], queryFn: () => api<{ id: number; word: string; pos: string; level: string; tags: string[]; definition: string; examples: string[]; synonyms: string[]; status: string }[]>(`/admin/vocab?q=${encodeURIComponent(term)}`) })
  const [edit, setEdit] = useState<{ id?: number; word: string; pos: string; level: string; tags: string; definition: string; examples: string; synonyms: string; status: string } | null>(null)
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q) }}><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search words" aria-label="Search words" /><button className="btn btn-secondary"><Search className="size-4" /></button></form>
        <button className="btn btn-primary" onClick={() => setEdit({ word: '', pos: 'noun', level: 'B1', tags: '', definition: '', examples: '', synonyms: '', status: 'published' })}>Add word</button>
      </div>
      <div className="card mt-4 divide-y divide-border">
        {list.isLoading ? <PageLoader /> : list.data?.map((w) => (
          <button key={w.id} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2" onClick={() => setEdit({ id: w.id, word: w.word, pos: w.pos, level: w.level, tags: w.tags.join(', '), definition: w.definition, examples: w.examples.join('\n'), synonyms: w.synonyms.join(', '), status: w.status })}>
            <b className="w-40 truncate">{w.word}</b><span className="w-10 text-xs text-muted">{w.level}</span><span className="flex-1 truncate text-sm text-muted">{w.definition}</span>{w.status !== 'published' && <Badge>{w.status}</Badge>}
          </button>
        ))}
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? `Edit “${edit.word}”` : 'Add word'} size="lg" footer={<button className="btn btn-primary" onClick={async () => { try { await api('/admin/vocab', { method: 'PUT', body: { ...edit, tags: edit.tags.split(',').map((x) => x.trim()).filter(Boolean), examples: edit.examples.split('\n').map((x) => x.trim()).filter(Boolean), synonyms: edit.synonyms.split(',').map((x) => x.trim()).filter(Boolean) } }); toast('Saved'); setEdit(null); qc.invalidateQueries({ queryKey: ['admin-vocab'] }) } catch (e) { toast(errorMessage(e), 'bad') } }}>Save</button>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Word" htmlFor="w"><input id="w" className="input" value={edit.word} onChange={(e) => setEdit({ ...edit, word: e.target.value })} /></Field>
            <Field label="Part of speech" htmlFor="p"><input id="p" className="input" value={edit.pos} onChange={(e) => setEdit({ ...edit, pos: e.target.value })} /></Field>
            <Field label="Level" htmlFor="l"><select id="l" className="input" value={edit.level} onChange={(e) => setEdit({ ...edit, level: e.target.value })}>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Topics (comma separated)" htmlFor="tg"><input id="tg" className="input" value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Definition" htmlFor="d"><input id="d" className="input" value={edit.definition} onChange={(e) => setEdit({ ...edit, definition: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Examples (one per line)" htmlFor="ex"><textarea id="ex" className="input" value={edit.examples} onChange={(e) => setEdit({ ...edit, examples: e.target.value })} /></Field></div>
            <Field label="Synonyms (comma separated)" htmlFor="sy"><input id="sy" className="input" value={edit.synonyms} onChange={(e) => setEdit({ ...edit, synonyms: e.target.value })} /></Field>
            <Field label="Status" htmlFor="ss"><select id="ss" className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option>published</option><option>draft</option></select></Field>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Plans() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['admin-plans'], queryFn: () => api<{ id: string; name: string; priceLabel: string | null; limits: Record<LimitKey, number | boolean> }[]>('/admin/plans') })
  const [draft, setDraft] = useState<Record<string, { name: string; priceLabel: string; limits: Record<string, number | boolean> }>>({})
  useEffect(() => {
    if (q.data) setDraft(Object.fromEntries(q.data.map((p) => [p.id, { name: p.name, priceLabel: p.priceLabel ?? '', limits: { ...p.limits } }])))
  }, [q.data])
  if (q.isLoading) return <PageLoader />
  if (q.error) return <ErrorState error={q.error} />
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Limits are enforced on the server. Use −1 for unlimited. Prices are set in your payment provider; the label here is only what users see.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {q.data!.map((p) => {
          const d = draft[p.id]
          if (!d) return null
          return (
            <div key={p.id} className="card space-y-3 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" htmlFor={`n-${p.id}`}><input id={`n-${p.id}`} className="input" value={d.name} onChange={(e) => setDraft({ ...draft, [p.id]: { ...d, name: e.target.value } })} /></Field>
                <Field label="Price label" htmlFor={`pl-${p.id}`}><input id={`pl-${p.id}`} className="input" value={d.priceLabel} onChange={(e) => setDraft({ ...draft, [p.id]: { ...d, priceLabel: e.target.value } })} /></Field>
              </div>
              {(Object.keys(LIMIT_KEYS) as LimitKey[]).map((k) => (
                <label key={k} className="flex items-center gap-3 text-sm">
                  <span className="flex-1">{LIMIT_KEYS[k]}</span>
                  {typeof d.limits[k] === 'boolean' ? (
                    <input type="checkbox" checked={!!d.limits[k]} onChange={(e) => setDraft({ ...draft, [p.id]: { ...d, limits: { ...d.limits, [k]: e.target.checked } } })} />
                  ) : (
                    <input type="number" min={-1} className="input h-9 w-24" value={Number(d.limits[k])} onChange={(e) => setDraft({ ...draft, [p.id]: { ...d, limits: { ...d.limits, [k]: Number(e.target.value) } } })} />
                  )}
                </label>
              ))}
              <button className="btn btn-primary" onClick={async () => { try { await api(`/admin/plans/${p.id}`, { method: 'PUT', body: { name: d.name, priceLabel: d.priceLabel || null, limits: d.limits } }); toast('Plan saved'); qc.invalidateQueries({ queryKey: ['admin-plans'] }) } catch (e) { toast(errorMessage(e), 'bad') } }}><Save className="size-4" /> Save {d.name}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Matching() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['admin-matching'], queryFn: () => api<{ current: Record<string, number>; defaults: Record<string, number> }>('/admin/config/matching') })
  const [d, setD] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    if (q.data) setD(q.data.current)
  }, [q.data])
  if (q.isLoading || !d) return <PageLoader />
  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm text-muted">How voice-call matching widens and protects users. Changes apply to the next matching round.</p>
      {Object.keys(q.data!.defaults).map((k) => (
        <label key={k} className="flex items-center gap-3 text-sm">
          <span className="flex-1 font-mono">{k}</span>
          <span className="text-xs text-faint">default {q.data!.defaults[k]}</span>
          <input type="number" min={0} className="input h-9 w-28" value={d[k]} onChange={(e) => setD({ ...d, [k]: Number(e.target.value) })} />
        </label>
      ))}
      <button className="btn btn-primary" onClick={async () => { try { await api('/admin/config/matching', { method: 'PUT', body: d }); toast('Matching updated'); qc.invalidateQueries({ queryKey: ['admin-matching'] }) } catch (e) { toast(errorMessage(e), 'bad') } }}><Save className="size-4" /> Save</button>
    </div>
  )
}

function Audit() {
  const q = useQuery({ queryKey: ['admin-audit'], queryFn: () => api<{ id: number; action: string; target: string | null; details: Record<string, unknown>; createdAt: number; actor: string | null }[]>('/admin/audit') })
  if (q.isLoading) return <PageLoader />
  if (q.error) return <ErrorState error={q.error} />
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-border text-left text-muted"><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Details</th></tr></thead>
        <tbody>
          {q.data!.map((a) => (
            <tr key={a.id} className="border-b border-border align-top last:border-0">
              <td className="whitespace-nowrap p-3 text-muted">{when(a.createdAt)}</td>
              <td className="p-3">{a.actor ?? 'system'}</td>
              <td className="p-3 font-mono text-xs">{a.action}</td>
              <td className="p-3 font-mono text-xs">{a.target ?? '—'}</td>
              <td className="max-w-xs break-words p-3 font-mono text-xs text-muted">{JSON.stringify(a.details)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
