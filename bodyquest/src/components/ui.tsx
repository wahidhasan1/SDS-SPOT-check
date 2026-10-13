import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'dark';

export function Button({
  variant = 'primary',
  size,
  block,
  icon,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'lg'; block?: boolean; icon?: string }) {
  const cls = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', block ? 'btn-block' : '', className ?? ''].join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}

export function Card({ children, className, title, action, as: As = 'section', ...rest }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; as?: 'section' | 'div' | 'article' } & Record<string, unknown>) {
  return (
    <As className={`card ${className ?? ''}`} {...rest}>
      {(title || action) && (
        <div className="card-head">
          {typeof title === 'string' ? <h2 className="card-title">{title}</h2> : title}
          {action}
        </div>
      )}
      {children}
    </As>
  );
}

export function ProgressBar({ value, max = 1, variant, label, thin }: { value: number; max?: number; variant?: 'xp' | 'water' | 'food' | 'streak'; label: string; thin?: boolean }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className={`progress ${variant ?? ''} ${thin ? 'thin' : ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, size = 96, stroke = 10, color = 'var(--accent-strong)', label, children }: { value: number; size?: number; stroke?: number; color?: string; label: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" role="img" aria-label={label} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} style={{ transition: 'stroke-dasharray .5s ease' }} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'accent' | 'xp' | 'streak' | 'water' | 'food' | 'battle' | 'success' | 'warning' | 'danger' | 'info' | 'demo' }) {
  return <span className={`badge ${tone ? `badge-${tone}` : ''}`}>{children}</span>;
}

export function DemoBadge({ label = 'Demo' }: { label?: string }) {
  return (
    <span className="badge badge-demo" title="Simulated for development — not a real person or live service">
      {label}
    </span>
  );
}

export function Note({ tone, icon, children, title }: { tone?: 'info' | 'warning' | 'danger' | 'success' | 'accent'; icon?: string; title?: string; children: ReactNode }) {
  return (
    <div className={`note ${tone ?? ''}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon name={icon ?? (tone === 'danger' || tone === 'warning' ? 'alert' : 'info')} size={18} />
      <div className="note-body">
        {title && <strong style={{ display: 'block', marginBottom: 2, color: 'inherit' }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'info', title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Field({ label, error, hint, children, id, className }: { label: ReactNode; error?: string; hint?: ReactNode; children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode; id?: string; className?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  const errId = error ? `${fid}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={fid}>{label}</label>
      {children({ id: fid, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="error" id={errId} role="alert">
          <Icon name="alert" size={15} /> {error}
        </span>
      )}
    </div>
  );
}

export function Toggle({ label, description, checked, onChange, id }: { label: ReactNode; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void; id?: string }) {
  const auto = useId();
  const tid = id ?? auto;
  return (
    <div className="toggle">
      <div>
        <label htmlFor={tid} style={{ fontWeight: 700, cursor: 'pointer' }}>
          {label}
        </label>
        {description && <div className="small muted">{description}</div>}
      </div>
      <span className="switch">
        <input id={tid} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="track" />
      </span>
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: Array<{ value: T; label: ReactNode }>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Array<{ value: T; label: ReactNode }>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          id={`tab-${t.value}`}
          aria-selected={t.value === value}
          aria-controls={`panel-${t.value}`}
          tabIndex={t.value === value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => {
            const i = tabs.findIndex((x) => x.value === value);
            if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length].value);
            if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length].value);
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Accessible modal dialog: focus moves in, Esc closes, focus is trapped and restored. */
export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute('disabled'));
    (focusables()[1] ?? focusables()[0] ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Stat({ value, label, icon, tone }: { value: ReactNode; label: ReactNode; icon?: string; tone?: string }) {
  return (
    <div className="stat-card">
      {icon && (
        <span className="stat-icon" style={{ background: `var(--${tone ?? 'accent'}-soft)`, color: tone ? `var(--${tone})` : 'var(--accent-text)' }}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <div className="stat">
        <span className="value">{value}</span>
        <span className="label">{label}</span>
      </div>
    </div>
  );
}

export function Avatar({ emoji, color, size }: { emoji: string; color: string; size?: 'sm' | 'lg' }) {
  return (
    <span className={`avatar ${size ?? ''}`} style={{ background: color }} aria-hidden="true">
      {emoji}
    </span>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="row">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, label, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; step?: number }) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </div>
  );
}
