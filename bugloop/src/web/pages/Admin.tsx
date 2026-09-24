// Administration: people and teams, workflow configuration, the audit log and workspace settings.

import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Bot, Copy, KeyRound, Pencil, Plus, ShieldCheck } from "lucide-react";
import type { AuditResponse } from "../../core/api";
import { STATUS_DEFS } from "../../core/statuses";
import { describeEvent } from "../../core/timeline";
import {
  ENVIRONMENT_KINDS,
  PALETTE,
  ROLES,
  ROLE_LABELS,
  TEAM_KINDS,
  type Environment,
  type EventRecord,
  type Level,
  type PaletteColor,
  type Role,
  type StatusConfig,
  type Team,
  type User,
} from "../../core/types";
import { useToast, useWorkspace } from "../app/context";
import { useAudit, useMutate } from "../api/hooks";
import { Avatar, Person } from "../components/badges";
import { Dialog, Empty, Field, Loading, Tabs, cx } from "../components/ui";
import { dateTime, relativeTime } from "../lib/format";

// ---------------------------------------------------------------------------
// Users and teams
// ---------------------------------------------------------------------------

export function AdminUsersPage() {
  const { ws, lookup } = useWorkspace();
  const [tab, setTab] = useState<"people" | "teams">("people");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [teamEditing, setTeamEditing] = useState<Team | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(true);
  const [created, setCreated] = useState<{ user: User; temporary_password: string | null } | null>(null);
  const people = ws.users.filter((u) => showInactive || u.active);
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Users &amp; teams</h1>
          <p className="sub">Roles decide what people can do. Deactivating someone keeps their history and credit; their open work is flagged for reassignment.</p>
        </div>
        {tab === "people" ? (
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus /> Add person
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setTeamEditing("new")}>
            <Plus /> Add team
          </button>
        )}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "people", label: "People", count: ws.users.filter((u) => u.active).length },
          { value: "teams", label: "Teams", count: ws.teams.length },
        ]}
      />
      {tab === "people" ? (
        <section className="panel">
          <div className="panel-head">
            <label className="checkbox small">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show people who left
            </label>
            <span className="hint">
              {Object.entries(
                ws.users.filter((u) => u.active).reduce<Record<string, number>>((a, u) => ({ ...a, [u.role]: (a[u.role] ?? 0) + 1 }), {}),
              )
                .map(([r, n]) => `${n} ${ROLE_LABELS[r as Role].toLowerCase()}${n === 1 ? "" : "s"}`)
                .join(" · ")}
            </span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Role</th>
                    <th>Team</th>
                    <th>Email</th>
                    <th>Last active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {people.map((u) => (
                    <tr key={u.id} className={cx(!u.active && "archived")}>
                      <td>
                        <Person userId={u.id} sub={u.title ?? undefined} />
                      </td>
                      <td>
                        <span className={cx("chip", u.role === "admin" && "accent")}>{ROLE_LABELS[u.role]}</span>
                        {!u.active && <span className="chip" style={{ marginLeft: 6 }}>Inactive</span>}
                      </td>
                      <td className="small">{lookup.team(u.team_id)?.name ?? <span className="muted">—</span>}</td>
                      <td className="small secondary">{u.email}</td>
                      <td className="small muted nowrap">{u.active ? relativeTime(u.last_seen_at) : `Left ${relativeTime(u.deactivated_at)}`}</td>
                      <td className="num">
                        <button className="icon-btn" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>
                          <Pencil size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <div className="card-grid">
          {ws.teams.map((t) => {
            const members = ws.users.filter((u) => u.team_id === t.id && u.active);
            return (
              <section key={t.id} className="panel">
                <div className="panel-head">
                  <h2>{t.name}</h2>
                  <button className="icon-btn" onClick={() => setTeamEditing(t)} aria-label={`Edit ${t.name}`}>
                    <Pencil size={15} />
                  </button>
                </div>
                <div className="panel-body stack-sm">
                  <div className="row-wrap small muted">
                    <span className="chip">{t.kind === "qa" ? "QA" : t.kind === "engineering" ? "Engineering" : t.kind === "product" ? "Product" : "Other"}</span>
                    <span>{members.length} members</span>
                  </div>
                  {t.description && <p className="small secondary">{t.description}</p>}
                  <Person userId={t.lead_id} sub="Team lead" empty="No lead" />
                  <div className="avatar-stack">
                    {members.slice(0, 10).map((m) => (
                      <Avatar key={m.id} userId={m.id} size="sm" />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
      {editing && <UserDialog user={editing === "new" ? null : editing} onClose={() => setEditing(null)} onCreated={setCreated} />}
      {teamEditing && <TeamDialog team={teamEditing === "new" ? null : teamEditing} onClose={() => setTeamEditing(null)} />}
      {created && <CreatedDialog result={created} onClose={() => setCreated(null)} />}
    </div>
  );
}

function UserDialog({ user, onClose, onCreated }: { user: User | null; onClose: () => void; onCreated: (r: { user: User; temporary_password: string | null }) => void }) {
  const { ws } = useWorkspace();
  const [form, setForm] = useState({ name: user?.name ?? "", email: user?.email ?? "", role: (user?.role ?? "qa_analyst") as Role, team_id: user?.team_id ?? "", title: user?.title ?? "", active: user?.active ?? true });
  const self = user?.id === ws.me.id;
  const save = useMutate(
    (api, body: typeof form): Promise<User | { user: User; temporary_password: string | null }> =>
      user
        ? api.patch<User>(`/admin/users/${user.id}`, { ...body, team_id: body.team_id || null, title: body.title || null })
        : api.post<{ user: User; temporary_password: string | null }>("/admin/users", { ...body, team_id: body.team_id || null, title: body.title || null }),
    { success: user ? "Saved" : undefined },
  );
  return (
    <Dialog
      title={user ? `Edit ${user.name}` : "Add a person"}
      description={user ? undefined : "They get a temporary password to sign in with."}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={save.isPending || !form.name.trim() || !form.email.trim()}
            onClick={() =>
              save.mutate(form, {
                onSuccess: (r) => {
                  onClose();
                  if (!user) onCreated(r as { user: User; temporary_password: string | null });
                },
              })
            }
          >
            {user ? "Save" : "Add person"}
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Name" required htmlFor="u-name">
          <input id="u-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email" required htmlFor="u-email">
          <input id="u-email" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Role" htmlFor="u-role" help={ROLE_HELP[form.role]}>
          <select id="u-role" className="select" value={form.role} disabled={self} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Team" htmlFor="u-team">
          <select id="u-team" className="select" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
            <option value="">No team</option>
            {ws.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Job title" htmlFor="u-title">
        <input id="u-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </Field>
      {user && !self && (
        <label className="checkbox">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
          <span className="small muted"> (unticking signs them out; their open regressions and assignments go to the QA lead's queue for reassignment)</span>
        </label>
      )}
      {self && <p className="tiny muted">You can't change your own role or deactivate yourself.</p>}
    </Dialog>
  );
}

const ROLE_HELP: Record<Role, string> = {
  qa_analyst: "Reports bugs, answers questions, runs regressions and verifies fixes.",
  engineer: "Triages, investigates, asks for information and marks bugs fixed. Can't verify or close fixed bugs.",
  qa_lead: "Everything QA can do, plus settling disputes, reassigning regressions and closing without verification.",
  project_manager: "Sets priority, defers bugs and manages projects. Sees team analytics.",
  admin: "Manages people, projects, workflow settings and can see the audit log.",
};

function CreatedDialog({ result, onClose }: { result: { user: User; temporary_password: string | null }; onClose: () => void }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.temporary_password ?? "");
      toast("Password copied");
    } catch {
      toast("Select the password and copy it manually.", "error");
    }
  };
  return (
    <Dialog title={`${result.user.name} was added`} onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}>
      {result.temporary_password ? (
        <div className="stack-sm">
          <p className="small">Share this temporary password with them. It is shown only once; they can change it in Profile &amp; preferences.</p>
          <div className="row">
            <code className="secret">{result.temporary_password}</code>
            <button className="btn btn-sm" onClick={copy}>
              <Copy /> Copy
            </button>
          </div>
        </div>
      ) : (
        <p className="small">They can sign in with the password you set.</p>
      )}
    </Dialog>
  );
}

function TeamDialog({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const { ws } = useWorkspace();
  const [form, setForm] = useState({ name: team?.name ?? "", kind: team?.kind ?? "qa", lead_id: team?.lead_id ?? "", description: team?.description ?? "" });
  const save = useMutate(
    (api, body: typeof form) => (team ? api.patch(`/admin/teams/${team.id}`, { ...body, lead_id: body.lead_id || null, description: body.description || null }) : api.post("/admin/teams", { ...body, lead_id: body.lead_id || null, description: body.description || null })),
    { success: team ? "Team saved" : "Team added" },
  );
  return (
    <Dialog
      title={team ? `Edit ${team.name}` : "Add a team"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={save.isPending || !form.name.trim()} onClick={() => save.mutate(form, { onSuccess: onClose })}>
            Save
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Name" required htmlFor="t-name">
          <input id="t-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Kind" htmlFor="t-kind">
          <select id="t-kind" className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Team["kind"] })}>
            {TEAM_KINDS.map((k) => (
              <option key={k} value={k}>
                {k === "qa" ? "QA" : k[0].toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Lead" htmlFor="t-lead">
        <select id="t-lead" className="select" value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })}>
          <option value="">No lead</option>
          {ws.users
            .filter((u) => u.active)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Description" htmlFor="t-desc">
        <textarea id="t-desc" className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Workflow & fields
// ---------------------------------------------------------------------------

export function AdminWorkflowPage() {
  const [tab, setTab] = useState<"statuses" | "severity" | "priority" | "environments">("statuses");
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Workflow &amp; fields</h1>
          <p className="sub">Rename statuses, set how long each may wait before it needs attention, and manage severity, priority and environments.</p>
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "statuses", label: "Statuses" },
          { value: "severity", label: "Severity" },
          { value: "priority", label: "Priority" },
          { value: "environments", label: "Environments" },
        ]}
      />
      {tab === "statuses" && <StatusesTab />}
      {(tab === "severity" || tab === "priority") && <LevelsTab kind={tab} />}
      {tab === "environments" && <EnvironmentsTab />}
    </div>
  );
}

function StatusesTab() {
  const { ws } = useWorkspace();
  const [editing, setEditing] = useState<StatusConfig | null>(null);
  const statuses = [...ws.statuses].sort((a, b) => a.sort_order - b.sort_order);
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="hint">The lifecycle rules are fixed so every bug follows the same path; labels, colours, attention times and optional statuses are yours to change.</span>
      </div>
      <div className="panel-body flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Meaning</th>
                <th>Needs attention after</th>
                <th>In use</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) => (
                <tr key={s.key}>
                  <td>
                    <span className={cx("pill sm", `tone-${s.color}`)}>
                      <span className="dot" />
                      {s.label}
                    </span>
                    {s.label !== STATUS_DEFS[s.key].defaults.label && <div className="tiny muted">was {STATUS_DEFS[s.key].defaults.label}</div>}
                  </td>
                  <td className="small secondary" style={{ maxWidth: 420 }}>{s.description}</td>
                  <td className="small nowrap">{s.attention_hours ? hoursLabel(s.attention_hours) : <span className="muted">—</span>}</td>
                  <td className="small">{STATUS_DEFS[s.key].optional ? (s.enabled ? "Enabled" : <span className="muted">Turned off</span>) : <span className="muted">Core</span>}</td>
                  <td className="num">
                    <button className="icon-btn" onClick={() => setEditing(s)} aria-label={`Edit ${s.label}`}>
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <StatusDialog status={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function hoursLabel(h: number) {
  return h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} hours`;
}

function ColorPicker({ value, onChange }: { value: PaletteColor; onChange: (c: PaletteColor) => void }) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Colour">
      {PALETTE.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} title={c} className={cx("swatch-btn", `tone-${c}`, value === c && "on")} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

function StatusDialog({ status, onClose }: { status: StatusConfig; onClose: () => void }) {
  const def = STATUS_DEFS[status.key];
  const [form, setForm] = useState({ label: status.label, description: status.description, color: status.color, enabled: status.enabled, attention: status.attention_hours ? String(status.attention_hours) : "" });
  const save = useMutate(
    (api, f: typeof form) =>
      api.patch(`/admin/statuses/${status.key}`, { label: f.label, description: f.description, color: f.color, enabled: f.enabled, attention_hours: f.attention ? Number(f.attention) : null }),
    { success: "Status saved" },
  );
  return (
    <Dialog
      title={`Edit “${status.label}”`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={() => setForm({ label: def.defaults.label, description: def.defaults.description, color: def.defaults.color, enabled: true, attention: def.defaults.attention_hours ? String(def.defaults.attention_hours) : "" })}>
            Reset to default
          </button>
          <button className="btn btn-primary" disabled={save.isPending || !form.label.trim()} onClick={() => save.mutate(form, { onSuccess: onClose })}>
            Save
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Label" required htmlFor="s-label">
          <input id="s-label" className="input" value={form.label} maxLength={40} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </Field>
        <Field label="Needs attention after (hours)" help="Leave empty for no threshold." htmlFor="s-att">
          <input id="s-att" className="input" type="number" min={1} value={form.attention} onChange={(e) => setForm({ ...form, attention: e.target.value })} />
        </Field>
      </div>
      <Field label="Meaning" help="Shown when people hover the status." htmlFor="s-desc">
        <textarea id="s-desc" className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label="Colour">
        <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} />
      </Field>
      {def.optional ? (
        <label className="checkbox">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Use this status
          <span className="small muted"> ({status.key === "under_review" ? "when off, engineers go straight from New to In progress" : "when off, the related step is skipped"})</span>
        </label>
      ) : (
        <p className="tiny muted">This status is part of the core lifecycle and is always on.</p>
      )}
    </Dialog>
  );
}

function LevelsTab({ kind }: { kind: "severity" | "priority" }) {
  const { ws } = useWorkspace();
  const [editing, setEditing] = useState<Level | "new" | null>(null);
  const levels = [...(kind === "severity" ? ws.severities : ws.priorities)].sort((a, b) => a.rank - b.rank);
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="hint">{kind === "severity" ? "Severity is the impact on users, set by the reporter." : "Priority is the order of work, owned by the project manager."} Rank 1 is the highest.</span>
        <button className="btn btn-sm" onClick={() => setEditing("new")}>
          <Plus /> Add level
        </button>
      </div>
      <div className="panel-body flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="num">Rank</th>
                <th>Level</th>
                <th>Meaning</th>
                <th>In use</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {levels.map((l) => (
                <tr key={l.key} className={cx(!l.active && "archived")}>
                  <td className="num">{l.rank}</td>
                  <td>
                    <span className={cx("sev", `tone-${l.color}`)}>
                      <span className="bar" />
                      {l.label}
                    </span>
                  </td>
                  <td className="small secondary">{l.description}</td>
                  <td className="small">{l.active ? "Active" : <span className="muted">Retired</span>}</td>
                  <td className="num">
                    <button className="icon-btn" onClick={() => setEditing(l)} aria-label={`Edit ${l.label}`}>
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <LevelDialog kind={kind} level={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function LevelDialog({ kind, level, onClose }: { kind: "severity" | "priority"; level: Level | null; onClose: () => void }) {
  const [form, setForm] = useState({ key: level?.key ?? "", label: level?.label ?? "", description: level?.description ?? "", color: level?.color ?? ("slate" as PaletteColor), rank: String(level?.rank ?? 5), active: level?.active ?? true });
  const save = useMutate(
    (api, f: typeof form) => {
      const body = { label: f.label, description: f.description || null, color: f.color, rank: Number(f.rank), active: f.active };
      return level ? api.patch(`/admin/levels/${kind}/${level.key}`, body) : api.post(`/admin/levels/${kind}`, { ...body, key: f.key || f.label.toLowerCase().replace(/[^a-z0-9]+/g, "_") });
    },
    { success: "Saved" },
  );
  return (
    <Dialog
      title={level ? `Edit ${level.label}` : `New ${kind} level`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={save.isPending || !form.label.trim()} onClick={() => save.mutate(form, { onSuccess: onClose })}>
            Save
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Label" required htmlFor="l-label">
          <input id="l-label" className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </Field>
        <Field label="Rank" help="1 is the highest" htmlFor="l-rank">
          <input id="l-rank" className="input" type="number" min={1} max={20} value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
        </Field>
      </div>
      <Field label="Meaning" htmlFor="l-desc">
        <textarea id="l-desc" className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label="Colour">
        <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} />
      </Field>
      {level && (
        <label className="checkbox">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active (retired levels stay on existing bugs but can't be chosen)
        </label>
      )}
    </Dialog>
  );
}

function EnvironmentsTab() {
  const { ws } = useWorkspace();
  const [editing, setEditing] = useState<Environment | "new" | null>(null);
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="hint">Where bugs are found and fixes are tested.</span>
        <button className="btn btn-sm" onClick={() => setEditing("new")}>
          <Plus /> Add environment
        </button>
      </div>
      <div className="panel-body flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Environment</th>
                <th>Kind</th>
                <th>Description</th>
                <th>In use</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ws.environments.map((e) => (
                <tr key={e.id} className={cx(!e.active && "archived")}>
                  <td style={{ fontWeight: 500 }}>{e.name}</td>
                  <td className="small">{e.kind}</td>
                  <td className="small secondary">{e.description}</td>
                  <td className="small">{e.active ? "Active" : <span className="muted">Retired</span>}</td>
                  <td className="num">
                    <button className="icon-btn" onClick={() => setEditing(e)} aria-label={`Edit ${e.name}`}>
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <EnvironmentDialog env={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function EnvironmentDialog({ env, onClose }: { env: Environment | null; onClose: () => void }) {
  const [form, setForm] = useState({ name: env?.name ?? "", kind: env?.kind ?? "qa", description: env?.description ?? "", active: env?.active ?? true });
  const save = useMutate((api, f: typeof form) => (env ? api.patch(`/admin/environments/${env.id}`, { ...f, description: f.description || null }) : api.post("/admin/environments", { ...f, description: f.description || null })), { success: "Saved" });
  return (
    <Dialog
      title={env ? `Edit ${env.name}` : "New environment"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={save.isPending || !form.name.trim()} onClick={() => save.mutate(form, { onSuccess: onClose })}>
            Save
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Name" required htmlFor="e-name">
          <input id="e-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Kind" htmlFor="e-kind">
          <select id="e-kind" className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Environment["kind"] })}>
            {ENVIRONMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description" htmlFor="e-desc">
        <textarea id="e-desc" className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      {env && (
        <label className="checkbox">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
        </label>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

const AUDIT_TYPES = [
  { value: "", label: "Everything" },
  { value: "bug.", label: "Bug changes" },
  { value: "bug.status_changed", label: "Status changes" },
  { value: "regression.", label: "Regression" },
  { value: "comment.", label: "Comments" },
  { value: "bug.archived", label: "Archiving" },
  { value: "user.", label: "People" },
  { value: "project.", label: "Projects" },
  { value: "module.", label: "Modules" },
  { value: "config.", label: "Workflow & fields" },
  { value: "settings.", label: "Workspace settings" },
  { value: "auth.", label: "Sign-ins" },
];

function describeAdmin(e: EventRecord, name: (id: string | null) => string): { text: string; detail: string | null } {
  const d = e.data as Record<string, unknown>;
  const changes = d.changes as Record<string, { from: unknown; to: unknown }> | undefined;
  const changeText = changes && Object.keys(changes).length ? Object.entries(changes).map(([k, v]) => `${k.replace(/_/g, " ")}: ${fmt(v.from)} → ${fmt(v.to)}`).join("; ") : null;
  const who = e.entity_type === "user" && e.entity_id ? name(e.entity_id) : null;
  switch (e.type) {
    case "auth.login":
      return { text: "signed in", detail: null };
    case "user.created":
      return { text: `added ${d.name} as ${ROLE_LABELS[d.role as Role] ?? d.role}`, detail: null };
    case "user.deactivated":
      return { text: `deactivated ${who}`, detail: changeText };
    case "user.reactivated":
      return { text: `reactivated ${who}`, detail: null };
    case "user.role_changed":
      return { text: `changed ${who}'s role`, detail: changeText };
    case "user.updated":
      return { text: `updated ${who}`, detail: changeText };
    case "user.password_changed":
      return { text: "changed their password", detail: null };
    case "settings.updated":
      return { text: "changed workspace settings", detail: changeText };
    case "project.member_added":
    case "project.member_removed":
      return { text: `${e.type.endsWith("added") ? "added" : "removed"} ${name(String(d.user_id ?? ""))} ${e.type.endsWith("added") ? "to" : "from"} a project`, detail: null };
    default:
      return { text: e.type.replace(/[._]/g, " ").replace(/^config /, ""), detail: changeText ?? (d.name ? String(d.name) : null) };
  }
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function AuditPage() {
  const { ws, lookup } = useWorkspace();
  const [filters, setFilters] = useState({ actor: "", type: "", bug: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const q = useAudit({ ...filters, page, page_size: 50 });
  const data = q.data as AuditResponse | undefined;
  const keys = useMemo(() => new Map((data?.bugs ?? []).map((b) => [b.id, b.key])), [data]);
  const set = (patch: Partial<typeof filters>) => {
    setFilters({ ...filters, ...patch });
    setPage(1);
  };
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p className="sub">Every change to bugs, people and settings: who did it and when. Entries can't be edited or deleted.</p>
        </div>
      </div>
      <div className="filter-bar">
        <select className="select select-sm" value={filters.type} onChange={(e) => set({ type: e.target.value })} aria-label="Type">
          {AUDIT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select className="select select-sm" value={filters.actor} onChange={(e) => set({ actor: e.target.value })} aria-label="Person">
          <option value="">Anyone</option>
          <option value="system">Bugloop (automatic)</option>
          {ws.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input className="input input-sm" style={{ width: 150 }} placeholder="Bug ID" value={filters.bug} onChange={(e) => set({ bug: e.target.value.trim() })} aria-label="Bug ID" />
        <label className="small muted" htmlFor="a-from">
          From
        </label>
        <input id="a-from" className="input input-sm" type="date" style={{ width: 150 }} value={filters.from} onChange={(e) => set({ from: e.target.value })} />
        <label className="small muted" htmlFor="a-to">
          to
        </label>
        <input id="a-to" className="input input-sm" type="date" style={{ width: 150 }} value={filters.to} onChange={(e) => set({ to: e.target.value })} />
      </div>
      <section className="panel">
        <div className="panel-head">
          <span className="small secondary">{data ? `${data.total} entr${data.total === 1 ? "y" : "ies"}` : "Loading…"}</span>
          {q.isError && <span className="small danger-text">{(q.error as Error).message}</span>}
        </div>
        <div className="panel-body flush">
          {!data ? (
            q.isError ? <Empty title="Couldn't load the log" /> : <Loading />
          ) : data.items.length === 0 ? (
            <Empty title="No entries match" />
          ) : (
            <div className="table-wrap">
              <table className="table audit-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>What</th>
                    <th>Bug</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => {
                    const isBug = e.type.startsWith("bug.") || e.type.startsWith("regression.") || e.type.startsWith("comment.");
                    const bugKey = e.bug_id ? keys.get(e.bug_id) ?? null : null;
                    const desc = isBug
                      ? (() => {
                          const x = describeEvent(e, { ...lookup.timeline, bugKey: (id) => (id ? keys.get(id) ?? null : null) });
                          return { text: x.text, detail: x.detail };
                        })()
                      : describeAdmin(e, (id) => lookup.userName(id));
                    return (
                      <tr key={e.id}>
                        <td className="small nowrap muted" title={e.created_at}>
                          {dateTime(e.created_at)}
                        </td>
                        <td>{e.actor_id ? <Person userId={e.actor_id} /> : <span className="small muted">Bugloop</span>}</td>
                        <td className="small">
                          <div>{desc.text}</div>
                          {desc.detail && <div className="tiny muted clamp-2">{desc.detail}</div>}
                        </td>
                        <td className="nowrap">{bugKey ? <Link to={`/bugs/${bugKey}`} className="mono small">{bugKey}</Link> : <span className="muted small">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {data && data.total > data.page_size && (
          <div className="pager">
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Newer
            </button>
            <span className="small muted">
              Page {page} of {Math.ceil(data.total / data.page_size)}
            </span>
            <button className="btn btn-sm" disabled={page * data.page_size >= data.total} onClick={() => setPage(page + 1)}>
              Older
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace settings
// ---------------------------------------------------------------------------

export function AdminSettingsPage() {
  const { ws } = useWorkspace();
  const [form, setForm] = useState({ ...ws.settings, escalate: String(ws.settings.escalate_after_reopens) });
  const save = useMutate(
    (api, f: typeof form) => api.patch("/admin/settings", { workspace_name: f.workspace_name, bug_prefix: f.bug_prefix, auto_close_on_verify: f.auto_close_on_verify, escalate_after_reopens: Number(f.escalate) }),
    { success: "Settings saved" },
  );
  const ai = ws.ai;
  return (
    <div className="stack-lg narrow-page">
      <div className="page-head">
        <div>
          <h1>Workspace settings</h1>
          <p className="sub">Name, bug IDs and the rules that apply to every project.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-body stack-lg">
          <div className="grid-2">
            <Field label="Workspace name" htmlFor="w-name">
              <input id="w-name" className="input" value={form.workspace_name} onChange={(e) => setForm({ ...form, workspace_name: e.target.value })} />
            </Field>
            <Field label="Bug ID prefix" help={`New bugs look like ${(form.bug_prefix || "BUG").toUpperCase()}-000125. Existing IDs don't change.`} htmlFor="w-prefix">
              <input id="w-prefix" className="input mono" value={form.bug_prefix} maxLength={6} onChange={(e) => setForm({ ...form, bug_prefix: e.target.value.toUpperCase() })} />
            </Field>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={form.auto_close_on_verify} onChange={(e) => setForm({ ...form, auto_close_on_verify: e.target.checked })} />
            <span>
              Close bugs automatically when QA verifies the fix
              <span className="help block">When off, verified bugs wait for a QA lead or the reporter to close them.</span>
            </span>
          </label>
          <Field label="Escalate to the QA lead after this many failed regressions" htmlFor="w-esc" help="The lead is notified so a bug that keeps coming back gets a second look.">
            <input id="w-esc" className="input" type="number" min={1} max={10} style={{ width: 100 }} value={form.escalate} onChange={(e) => setForm({ ...form, escalate: e.target.value })} />
          </Field>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>
              Save settings
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="row" style={{ gap: 8 }}>
            <Bot size={16} /> AI assistant
          </h2>
          <span className={cx("chip", ai.provider === "offline" ? "" : "positive")}>{ai.provider === "offline" ? "Offline assistant" : "Connected"}</span>
        </div>
        <div className="panel-body stack small secondary">
          <p>
            <strong className="secondary">{ai.label}</strong>
            {ai.model ? ` · model ${ai.model}` : ""} · {ai.vision ? "reads screenshots" : "does not read screenshots"}
          </p>
          {ai.provider === "offline" ? (
            <p>
              The offline assistant structures reports with rules and never invents details, but it can't read screenshots or write summaries in natural language.{" "}
              {ws.mode === "server" ? (
                <>
                  To use Claude, set <code>ANTHROPIC_API_KEY</code> on the server and restart it. <code>BUGLOOP_AI_MODEL</code> chooses the model.
                </>
              ) : (
                "Open this demo inside Claude to let it use Claude."
              )}
            </p>
          ) : (
            <p>Drafts, summaries and regression checks are suggestions. The assistant never submits, closes or rejects anything; people make every decision.</p>
          )}
          <p className="row" style={{ gap: 6 }}>
            <ShieldCheck size={15} /> Reports sent to the assistant include only what the reporter wrote and attached.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="row" style={{ gap: 8 }}>
            <KeyRound size={16} /> Sign-in
          </h2>
        </div>
        <div className="panel-body small secondary">
          {ws.demo_login ? "Demo sign-in is on because this workspace holds sample data: anyone can switch between the sample people without a password. Set BUGLOOP_DEMO_LOGIN=false on the server to require passwords." : "People sign in with their email and password. Sessions last 30 days; deactivating someone signs them out everywhere."}
        </div>
      </section>
    </div>
  );
}
