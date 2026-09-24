import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useWorkspace } from "../app/context";
import { Popover, cx } from "./ui";

/** A compact multi-select in a popover. */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  width = 240,
}: {
  label: string;
  options: { value: string; label: ReactNode }[];
  value: string[];
  onChange: (v: string[]) => void;
  width?: number;
}) {
  const summary = value.length === 0 ? "Any" : value.length === 1 ? options.find((o) => o.value === value[0])?.label ?? value[0] : `${value.length} selected`;
  return (
    <Popover
      width={width}
      trigger={({ toggle, open }) => (
        <button className={cx("filter-btn", value.length > 0 && "active")} onClick={toggle} aria-expanded={open}>
          <span className="muted">{label}:</span> <span className="truncate">{summary}</span>
          <ChevronDown size={14} />
        </button>
      )}
    >
      {() => (
        <div className="stack-sm" style={{ gap: 0 }}>
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <button key={o.value} className="menu-item" role="menuitemcheckbox" aria-checked={on} onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}>
                <span className={cx("check-box", on && "on")}>{on && <Check size={12} />}</span>
                {o.label}
              </button>
            );
          })}
          {value.length > 0 && (
            <>
              <div className="menu-sep" />
              <button className="menu-item muted" onClick={() => onChange([])}>
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}

export function ProjectSelect({ value, onChange, allLabel = "All projects", className }: { value: string; onChange: (v: string) => void; allLabel?: string; className?: string }) {
  const { ws } = useWorkspace();
  return (
    <select className={cx("select select-sm select-inline", className)} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Project">
      <option value="">{allLabel}</option>
      {ws.projects
        .filter((p) => !p.archived)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );
}
