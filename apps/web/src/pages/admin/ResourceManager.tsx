import { useEffect, useState, type ReactNode } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, PageLoader, useToast } from '../../components/ui';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useApi } from '../../lib/useApi';

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'lines' | 'json';
export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  hint?: string;
  rows?: number;
  required?: boolean;
  defaultValue?: unknown;
  /** Number fields stored as numbers. */
  numeric?: boolean;
}
export interface ColumnDef { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }

type Row = Record<string, unknown> & { id: string };

function toFormValue(f: FieldDef, v: unknown) {
  if (f.type === 'lines') return Array.isArray(v) ? (v as string[]).join('\n') : '';
  if (f.type === 'json') return v == null ? '' : JSON.stringify(v, null, 2);
  if (f.type === 'checkbox') return Boolean(v);
  if (v == null) return f.defaultValue ?? '';
  return String(v);
}

function fromForm(fields: FieldDef[], form: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = form[f.name];
    if (f.type === 'lines') out[f.name] = String(v ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
    else if (f.type === 'json') {
      const text = String(v ?? '').trim();
      if (!text) out[f.name] = null;
      else
        try {
          out[f.name] = JSON.parse(text);
        } catch {
          throw new Error(`${f.label}: invalid JSON`);
        }
    } else if (f.type === 'checkbox') out[f.name] = Boolean(v);
    else if (f.type === 'number' || f.numeric) out[f.name] = v === '' || v == null ? null : Number(v);
    else out[f.name] = v === '' && !f.required ? null : v;
  }
  return out;
}

export function ResourceManager({
  endpoint,
  title,
  fields,
  columns,
  filters,
  newDefaults,
  extraEditor,
  description,
}: {
  endpoint: string;
  title: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  filters?: { name: string; label: string; options: { value: string; label: string }[] }[];
  newDefaults?: Record<string, unknown>;
  extraEditor?: (row: Row | null) => ReactNode;
  description?: ReactNode;
}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const params = new URLSearchParams({ ...(query ? { q: query } : {}), ...Object.fromEntries(Object.entries(filterValues).filter(([, v]) => v)) });
  const list = useApi<{ items: Row[]; total: number }>(`/api/admin/${endpoint}?${params}`, [query, JSON.stringify(filterValues)]);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Row | null>(null);

  const open = async (row: Row | 'new') => {
    setErrors([]);
    if (row === 'new') {
      setForm(Object.fromEntries(fields.map((f) => [f.name, toFormValue(f, newDefaults?.[f.name] ?? f.defaultValue)])));
      setEditing('new');
      return;
    }
    // Load the full record (lists may omit large fields).
    const full = await api.get<{ item: Row }>(`/api/admin/${endpoint}/${row.id}`);
    setForm(Object.fromEntries(fields.map((f) => [f.name, toFormValue(f, full.item[f.name])])));
    setEditing(full.item);
  };

  useEffect(() => setErrors([]), [editing]);

  const save = async () => {
    setBusy(true);
    setErrors([]);
    try {
      const body = fromForm(fields, form);
      if (editing === 'new') await api.post(`/api/admin/${endpoint}`, body);
      else await api.patch(`/api/admin/${endpoint}/${(editing as Row).id}`, body);
      toast('Saved');
      setEditing(null);
      list.reload();
    } catch (err) {
      const details = err instanceof ApiError && Array.isArray(err.details) ? (err.details as { path: string; message: string }[]).map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)) : [];
      setErrors(details.length ? details : [errorMessage(err)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="muted text-sm">{description}</p>}</div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => open('new')}>New</Button>
      </div>
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
        <div className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" /></div>
        {filters?.map((f) => (
          <select key={f.name} className="input w-auto" aria-label={f.label} value={filterValues[f.name] ?? ''} onChange={(e) => setFilterValues({ ...filterValues, [f.name]: e.target.value })}>
            <option value="">{f.label}: all</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      {list.loading && !list.data ? <PageLoader /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.data!.items.length === 0 ? <EmptyState title="Nothing found" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left dark:border-slate-700"><tr>{columns.map((c) => <th key={c.key} className="px-4 py-2.5 font-semibold">{c.label}</th>)}<th className="w-24" /></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data!.items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  {columns.map((c) => <td key={c.key} className="px-4 py-2.5">{c.render ? c.render(r) : c.key === 'status' ? <StatusBadge s={String(r.status)} /> : String(r[c.key] ?? '—')}</td>)}
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => open(r)} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                    <button className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" onClick={() => setDel(r)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="muted border-t border-slate-100 px-4 py-2 text-xs dark:border-slate-800">{list.data!.total} total</div>
        </div>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} size="lg" title={editing === 'new' ? `New ${title.toLowerCase().replace(/s$/, '')}` : `Edit ${title.toLowerCase().replace(/s$/, '')}`} footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
        {errors.length > 0 && <Alert tone="error" className="mb-4" title="Please fix the following">{<ul className="list-disc pl-5">{errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}</ul>}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => {
            const wide = ['textarea', 'json', 'lines'].includes(f.type);
            const id = `f-${f.name}`;
            return (
              <div key={f.name} className={wide ? 'sm:col-span-2' : ''}>
                {f.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form[f.name])} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} /> {f.label}</label>
                ) : (
                  <>
                    <label className="label" htmlFor={id}>{f.label}{f.required && ' *'}</label>
                    {f.type === 'select' ? (
                      <select id={id} className="input" value={String(form[f.name] ?? '')} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                        {!f.required && <option value="">—</option>}
                        {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : f.type === 'textarea' || f.type === 'json' || f.type === 'lines' ? (
                      <textarea id={id} className={`input ${f.type === 'json' ? 'font-mono text-xs' : ''}`} rows={f.rows ?? (f.type === 'json' ? 14 : 4)} value={String(form[f.name] ?? '')} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} spellCheck={f.type !== 'json'} />
                    ) : (
                      <input id={id} className="input" type={f.type === 'number' ? 'number' : 'text'} value={String(form[f.name] ?? '')} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
                    )}
                    {f.hint && <p className="muted mt-1 text-xs">{f.hint}</p>}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {extraEditor && editing !== 'new' && editing && <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">{extraEditor(editing)}</div>}
      </Modal>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} danger title="Delete permanently?" message="This cannot be undone. Learners’ history linked to this item may also be removed." confirmLabel="Delete" onConfirm={async () => { try { await api.del(`/api/admin/${endpoint}/${del!.id}`); toast('Deleted'); list.reload(); } catch (e) { toast(errorMessage(e), 'error'); } }} />
    </div>
  );
}

export function StatusBadge({ s }: { s: string }) {
  return <Badge tone={s === 'published' ? 'green' : s === 'draft' ? 'amber' : 'slate'} className="capitalize">{s}</Badge>;
}

export const STATUS_FIELD: FieldDef = { name: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'draft', options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }], hint: 'Content is validated before it can be published.' };
export const STATUS_FILTER = { name: 'status', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }] };
export const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => ({ value: l, label: l }));
