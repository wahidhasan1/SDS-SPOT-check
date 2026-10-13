import { useState } from 'react';
import { Badge, Button, EmptyState, ErrorState, PageLoader, Tabs, Textarea, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface R { id: string; reason: string; details: string; status: string; adminNote: string | null; createdAt: string; reportedAlias: string; reportedEmail: string; reportedStatus: string; reporterName: string | null; callSessionId: string | null; battleId: string | null; priorReports: number }

export default function Reports() {
  const toast = useToast();
  const [status, setStatus] = useState<'open' | 'reviewing' | 'actioned' | 'dismissed' | 'all'>('open');
  const { data, error, loading, reload } = useApi<{ items: R[] }>(`/api/admin/reports?status=${status}`, [status]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const act = async (r: R, next: string, suspendUser = false) => {
    try {
      await api.patch(`/api/admin/reports/${r.id}`, { status: next, adminNote: notes[r.id] ?? r.adminNote ?? undefined, suspendUser });
      toast('Report updated');
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <div>
      <Tabs tabs={[{ id: 'open', label: 'Open' }, { id: 'reviewing', label: 'Reviewing' }, { id: 'actioned', label: 'Actioned' }, { id: 'dismissed', label: 'Dismissed' }, { id: 'all', label: 'All' }]} value={status} onChange={setStatus} />
      {loading && !data ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : data!.items.length === 0 ? <EmptyState title="No reports here" /> : (
        <div className="space-y-3">
          {data!.items.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{r.reason.replace('_', ' ')} <Badge className="ml-1">{r.status}</Badge> {r.priorReports > 1 && <Badge tone="red">{r.priorReports} reports total</Badge>}</div>
                  <div className="muted text-xs">{formatDateTime(r.createdAt)} · {r.callSessionId ? 'voice call' : r.battleId ? 'battle' : ''} · reported by {r.reporterName ?? 'deleted user'}</div>
                </div>
                <div className="text-right text-sm"><div>Reported: <strong>{r.reportedAlias}</strong></div><div className="muted text-xs">{r.reportedEmail} · account {r.reportedStatus}</div></div>
              </div>
              <p className="mt-2 text-sm">{r.details || <span className="muted">No details given.</span>}</p>
              <Textarea className="mt-2" rows={2} placeholder="Internal note (not shown to users)" value={notes[r.id] ?? r.adminNote ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} aria-label="Admin note" />
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === 'open' && <Button size="sm" variant="secondary" onClick={() => act(r, 'reviewing')}>Mark reviewing</Button>}
                <Button size="sm" variant="secondary" onClick={() => act(r, 'dismissed')}>Dismiss</Button>
                <Button size="sm" onClick={() => act(r, 'actioned')}>Action taken (warn)</Button>
                {r.reportedStatus !== 'suspended' && <Button size="sm" variant="danger" onClick={() => act(r, 'actioned', true)}>Suspend user</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
