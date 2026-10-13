import { Link } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { Button, Card, EmptyState } from '../components/ui';
import type { NotificationKind } from '../domain/types';
import { clearNotifications, markAllRead, markRead } from '../store/actions';
import { useApp } from '../store/AppStore';

const ICON: Record<NotificationKind, string> = {
  'battle-invite': 'swords',
  'battle-update': 'swords',
  'battle-result': 'trophy',
  'opponent-workout': 'dumbbell',
  achievement: 'trophy',
  'level-up': 'star',
  'missed-session': 'calendar',
  reminder: 'clock',
  system: 'info',
};

export default function NotificationsPage() {
  const { data, run } = useApp();
  const list = data.notifications;
  const unread = list.filter((n) => !n.read).length;
  return (
    <>
      <PageHead
        title="Notifications"
        sub={unread ? `${unread} unread` : 'You’re all caught up'}
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={!unread} onClick={() => run(markAllRead)}>
              Mark all read
            </Button>
            <Button variant="ghost" size="sm" disabled={list.length === unread} onClick={() => run(clearNotifications)}>
              Clear read
            </Button>
          </>
        }
      />
      <Card>
        {list.length === 0 ? (
          <EmptyState icon="bell" title="No notifications">
            Battle invitations, achievements and reminders will appear here.
          </EmptyState>
        ) : (
          <ul className="list">
            {list.map((n) => (
              <li key={n.id} className="list-row" style={{ opacity: n.read ? 0.7 : 1 }}>
                <span className="stat-icon" style={{ background: n.read ? 'var(--surface-2)' : 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                  <Icon name={ICON[n.kind]} size={18} />
                </span>
                <div className="grow">
                  <div style={{ fontWeight: n.read ? 600 : 800 }}>
                    {!n.read && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </div>
                  <div className="small muted">{n.body}</div>
                  <div className="small muted">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
                {n.link && (
                  <Link to={n.link} className="btn btn-ghost btn-sm" onClick={() => run(markRead, n.id)}>
                    Open
                  </Link>
                )}
                {!n.read && (
                  <button className="icon-btn" aria-label={`Mark “${n.title}” as read`} onClick={() => run(markRead, n.id)}>
                    <Icon name="check" size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="small muted mt-2">Notifications are generated on this device. Push notifications to your phone require a backend and push service (not configured in this build).</p>
    </>
  );
}
