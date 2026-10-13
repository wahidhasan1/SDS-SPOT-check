import { Link } from 'react-router';
import { Bell, Trash2 } from 'lucide-react';
import { Button, EmptyState, ErrorState, PageHeader, PageLoader } from '../components/ui';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useApi } from '../lib/useApi';

interface N { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }

export default function Notifications() {
  const { data, error, loading, reload, setData } = useApi<{ notifications: N[] }>('/api/notifications');
  const markAll = async () => {
    await api.post('/api/notifications/read-all');
    reload();
  };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" actions={data?.notifications.some((n) => !n.readAt) && <Button variant="secondary" size="sm" onClick={markAll}>Mark all as read</Button>} />
      {loading && !data ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : data!.notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="Achievements, feedback and safety updates will appear here." />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {data!.notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${n.readAt ? '' : 'bg-brand-50/50 dark:bg-brand-900/10'}`}>
              {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
              <div className="min-w-0 flex-1">
                {n.link ? <Link to={n.link} onClick={() => api.post(`/api/notifications/${n.id}/read`)} className="font-medium hover:underline">{n.title}</Link> : <div className="font-medium">{n.title}</div>}
                <p className="muted text-sm">{n.body}</p>
                <p className="muted mt-1 text-xs">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.readAt && <button className="text-xs text-brand-700 hover:underline dark:text-brand-300" onClick={async () => { await api.post(`/api/notifications/${n.id}/read`); reload(); }}>Mark read</button>}
              <button aria-label="Delete notification" className="rounded p-1 text-slate-400 hover:text-red-600" onClick={async () => { await api.del(`/api/notifications/${n.id}`); setData({ notifications: data!.notifications.filter((x) => x.id !== n.id) }); }}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
