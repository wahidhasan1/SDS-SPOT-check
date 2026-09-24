// Small, dependency-free UI primitives.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Inbox, X } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="row">
      <span className="spinner" aria-hidden />
      {label && <span className="muted small">{label}</span>}
    </span>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" aria-hidden />
      {label}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox />}
      <div className="title">{title}</div>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function Panel({ title, hint, actions, children, flush, className }: { title?: ReactNode; hint?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; className?: string }) {
  return (
    <section className={cx("panel", className)}>
      {(title || actions) && (
        <div className="panel-head">
          <div className="row" style={{ gap: 10 }}>
            {title && <h2>{title}</h2>}
            {hint && <span className="hint">{hint}</span>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={cx("panel-body", flush && "flush")}>{children}</div>
    </section>
  );
}

export function Field({ label, required, help, error, children, htmlFor, aside }: { label: ReactNode; required?: boolean; help?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; aside?: ReactNode }) {
  const labelEl = (
    <label htmlFor={htmlFor}>
      {label}
      {required && <span className="req" aria-hidden>*</span>}
    </label>
  );
  return (
    <div className="field">
      {aside ? (
        <div className="field-head">
          {labelEl}
          {aside}
        </div>
      ) : (
        labelEl
      )}
      {children}
      {error ? <div className="error">{error}</div> : help ? <div className="help">{help}</div> : null}
    </div>
  );
}

export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("textarea, input:not([type=hidden]), select, button:not(.dialog-close)");
    first?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx("dialog", wide && "wide")} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="dialog-head">
          <div>
            <h2 id={id}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-btn dialog-close" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Click-to-open popover anchored below its trigger. */
export function Popover({
  trigger,
  children,
  align = "left",
  side = "bottom",
  width,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  side?: "bottom" | "top";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className="popover" style={{ ...(side === "top" ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }), [align]: 0, width }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label?: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number | null }[] }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={value === t.value ? "on" : ""} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && t.count !== null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Debounce a value for live queries. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}
