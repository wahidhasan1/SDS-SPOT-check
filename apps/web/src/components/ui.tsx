import type { ReactNode } from 'react';
import { parseAvatar } from '@app/shared';

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="row" role="status">
      <span className="spinner" />
      {label && <span className="muted small">{label}</span>}
    </span>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="empty">
      <Spinner label={label} />
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="alert error row between" role="alert">
      <span>{error}</span>
      {onRetry && (
        <button className="btn sm secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ icon = '📭', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ico">{icon}</div>
      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{title}</div>
      {children && <div className="small mt">{children}</div>}
    </div>
  );
}

export function Avatar({ avatar, size }: { avatar: string | null | undefined; size?: 'lg' | 'xl' }) {
  const { emoji, color } = parseAvatar(avatar);
  return (
    <div className={`avatar ${size ?? ''}`} style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, border: `2px solid ${color}` }} aria-hidden>
      {emoji}
    </div>
  );
}

export function Progress({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between mb">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="row between wrap mb" style={{ alignItems: 'flex-end' }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>{title}</h1>
        {subtitle && <div className="muted">{subtitle}</div>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

export function LevelBadge({ level }: { level: string | null | undefined }) {
  if (!level) return <span className="badge">Level not assessed</span>;
  return <span className="badge primary">CEFR {level}</span>;
}

export function Unofficial() {
  return (
    <p className="disclaimer">
      Practice estimate only — not an official IELTS score. Real IELTS results can differ.
    </p>
  );
}
