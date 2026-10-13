import { useApp } from '../store/AppStore';
import { Icon } from './Icon';

const ICON: Record<string, string> = { success: 'check', info: 'info', error: 'alert', xp: 'zap', achievement: 'trophy', 'level-up': 'star' };

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <Icon name={ICON[t.kind] ?? 'info'} size={18} />
          <span className="toast-msg">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
