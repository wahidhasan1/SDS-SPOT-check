import { useState } from "react";
import { Search } from "lucide-react";
import { useSearch } from "../api/hooks";
import { StatusPill } from "./badges";
import { cx, useDebounced } from "./ui";

/** Pick a bug by ID or title. Calls onPick with the bug key. */
export function BugPicker({ value, onPick, excludeId, placeholder = "Search by ID or title", invalid }: { value: string; onPick: (key: string) => void; excludeId?: string; placeholder?: string; invalid?: boolean }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q, 200);
  const res = useSearch(debounced);
  const items = (res.data?.items ?? []).filter((b) => b.id !== excludeId);
  return (
    <div className="picker" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <div className="search-input">
        <Search />
        <input
          className={cx("input", invalid && "invalid")}
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            onPick(e.target.value.trim());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && debounced && items.length > 0 && (
        <div className="popover" style={{ top: "calc(100% + 4px)", left: 0, right: 0 }}>
          {items.slice(0, 6).map((b) => (
            <button
              key={b.id}
              type="button"
              className="menu-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQ(b.key);
                onPick(b.key);
                setOpen(false);
              }}
            >
              <span className="mono muted" style={{ flex: "none" }}>{b.key}</span>
              <span className="truncate grow">{b.title}</span>
              <StatusPill status={b.status} size="sm" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
