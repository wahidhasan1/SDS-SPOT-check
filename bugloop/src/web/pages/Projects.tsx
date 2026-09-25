import { useState } from "react";
import { Link, useParams } from "react-router";
import { Archive, ArchiveRestore, ArrowLeft, FileUp, FolderKanban, Map as MapIcon, Pencil, Plus, UserMinus, UserPlus } from "lucide-react";
import type { Feature, Module, Page, PageImportance, Project } from "../../core/types";
import { PAGE_IMPORTANCE, ROLE_LABELS } from "../../core/types";
import { useWorkspace } from "../app/context";
import { errorMessage, useModuleHealth, useMutate } from "../api/hooks";
import { useApi } from "../app/context";
import { plural } from "../lib/format";
import { Person } from "../components/badges";
import { Dialog, Empty, Field } from "../components/ui";

export function ProjectsPage() {
  const { ws, lookup } = useWorkspace();
  const health = useModuleHealth({});
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const can = ws.capabilities.manage_projects;
  const projects = ws.projects.filter((p) => showArchived || !p.archived);
  const counts = (pid: string) => {
    const rows = health.data?.modules.filter((m) => m.project_id === pid) ?? [];
    return { open: rows.reduce((a, m) => a + m.open, 0), total: rows.reduce((a, m) => a + m.total, 0) };
  };
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="sub">Each project has modules and features. Reports are filed against them and routed to each module's default owner.</p>
        </div>
        <div className="row">
          {ws.projects.some((p) => p.archived) && (
            <label className="checkbox small">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
            </label>
          )}
          {can && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus /> New project
            </button>
          )}
        </div>
      </div>
      <div className="card-grid">
        {projects.map((p) => {
          const mods = lookup.modulesOf(p.id);
          const c = counts(p.id);
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="panel project-card">
              <div className="row-between">
                <span className="project-key mono">{p.key}</span>
                {p.archived && <span className="chip">Archived</span>}
              </div>
              <h2>{p.name}</h2>
              {p.description && <p className="small secondary clamp-2">{p.description}</p>}
              <div className="row-wrap small muted">
                <span>{mods.length} modules</span>·<span>{c.open} open</span>·<span>{c.total} bugs all time</span>
              </div>
              <div className="row-wrap" style={{ gap: 16 }}>
                <Person userId={p.qa_lead_id} sub="QA lead" empty="No QA lead" />
                <Person userId={p.pm_id} sub="Project manager" empty="No PM" />
              </div>
            </Link>
          );
        })}
      </div>
      {creating && <ProjectDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const { ws, lookup } = useWorkspace();
  const health = useModuleHealth({ project: id });
  const project = lookup.project(id);
  const [editing, setEditing] = useState(false);
  const [moduleDialog, setModuleDialog] = useState<Module | "new" | null>(null);
  const [featureDialog, setFeatureDialog] = useState<{ module: Module; feature: Feature | null } | null>(null);
  const [addMember, setAddMember] = useState(false);
  const can = ws.capabilities.manage_projects;
  const membership = useMutate((api, args: { user_id: string; member: boolean }) => api.post(`/admin/projects/${id}/members`, args), {
    success: (_r, a) => (a.member ? "Added to the project" : "Removed from the project"),
  });
  const archiveModule = useMutate((api, m: Module) => api.patch(`/admin/modules/${m.id}`, { archived: !m.archived }), {
    success: (_r, m) => (m.archived ? `${m.name} restored` : `${m.name} archived`),
  });
  if (!project) return <Empty title="Project not found" />;
  const modules = ws.modules.filter((m) => m.project_id === project.id).sort((a, b) => Number(a.archived) - Number(b.archived) || a.sort_order - b.sort_order);
  const members = ws.project_members.filter((m) => m.project_id === project.id && !m.left_at);
  const stats = (mid: string) => health.data?.modules.find((m) => m.module_id === mid);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div className="stack-sm">
          <Link to="/projects" className="small back-link">
            <ArrowLeft size={14} /> Projects
          </Link>
          <h1>
            {project.name} <span className="mono muted" style={{ fontSize: 15, fontWeight: 500 }}>{project.key}</span>
          </h1>
          {project.description && <p className="sub">{project.description}</p>}
        </div>
        <div className="row-wrap">
          <Link className="btn" to={`/bugs?view=open&project=${project.id}`}>
            Open bugs
          </Link>
          {can && (
            <button className="btn" onClick={() => setEditing(true)}>
              <Pencil /> Edit project
            </button>
          )}
        </div>
      </div>

      <div className="bug-grid">
        <div className="stack-lg" style={{ minWidth: 0 }}>
          <section className="panel">
            <div className="panel-head">
              <h2>Modules and features</h2>
              {can && (
                <button className="btn btn-sm" onClick={() => setModuleDialog("new")}>
                  <Plus /> Add module
                </button>
              )}
            </div>
            <div className="panel-body flush">
              {!modules.length && <Empty icon={<FolderKanban />} title="No modules yet" />}
              <div className="list">
                {modules.map((m) => {
                  const s = stats(m.id);
                  const feats = ws.features.filter((f) => f.module_id === m.id);
                  return (
                    <div key={m.id} className={`list-row module-row${m.archived ? " archived" : ""}`}>
                      <div className="grow stack-sm" style={{ gap: 4 }}>
                        <div className="row-wrap">
                          <strong>{m.name}</strong>
                          {m.archived && <span className="chip">Archived</span>}
                          {s && (
                            <Link to={`/bugs?view=open&module=${m.id}`} className="tiny">
                              {s.open} open · {s.total} all time
                            </Link>
                          )}
                        </div>
                        {m.description && <div className="small secondary">{m.description}</div>}
                        <div className="row-wrap" style={{ gap: 5 }}>
                          {feats.map((f) => (
                            <button key={f.id} className={`chip${f.archived ? " muted" : ""}`} disabled={!can} onClick={() => setFeatureDialog({ module: m, feature: f })} title={can ? "Edit feature" : f.description ?? undefined}>
                              {f.name}
                              {f.archived ? " (archived)" : ""}
                            </button>
                          ))}
                          {can && !m.archived && (
                            <button className="chip dashed" onClick={() => setFeatureDialog({ module: m, feature: null })}>
                              <Plus /> Feature
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="stack-sm module-side">
                        <Person userId={m.owner_id} sub="Default owner" empty="No default owner" />
                        {can && (
                          <div className="row">
                            <button className="icon-btn" onClick={() => setModuleDialog(m)} aria-label={`Edit ${m.name}`} title="Edit module">
                              <Pencil size={15} />
                            </button>
                            <button className="icon-btn" onClick={() => archiveModule.mutate(m)} aria-label={m.archived ? `Restore ${m.name}` : `Archive ${m.name}`} title={m.archived ? "Restore module" : "Archive module (existing bugs keep it)"}>
                              {m.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
          <ProductMapPanel project={project} />
        </div>

        <aside className="bug-rail">
          <section className="panel">
            <div className="panel-head">
              <h2>People</h2>
            </div>
            <div className="panel-body stack">
              <Person userId={project.qa_lead_id} sub="QA lead · settles disputes, owns orphaned regressions" empty="No QA lead" />
              <Person userId={project.pm_id} sub="Project manager · priorities and deferrals" empty="No project manager" />
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Members</h2>
              {can && (
                <button className="btn btn-sm btn-ghost" onClick={() => setAddMember(true)}>
                  <UserPlus /> Add
                </button>
              )}
            </div>
            <div className="panel-body stack-sm">
              {members.length === 0 && <p className="small muted">No members listed.</p>}
              {members.map((pm) => {
                const u = lookup.user(pm.user_id);
                return (
                  <div key={pm.id} className="row-between">
                    <Person userId={pm.user_id} sub={u ? ROLE_LABELS[u.role] : undefined} />
                    {can && (
                      <button className="icon-btn" aria-label={`Remove ${u?.name}`} title="Remove from project" onClick={() => membership.mutate({ user_id: pm.user_id, member: false })}>
                        <UserMinus size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
              <p className="tiny muted">Membership decides who is offered as regression owner and assignee first. Everyone in the workspace can still see and report bugs.</p>
            </div>
          </section>
        </aside>
      </div>

      {editing && <ProjectDialog project={project} onClose={() => setEditing(false)} />}
      {moduleDialog && <ModuleDialog project={project} module={moduleDialog === "new" ? null : moduleDialog} onClose={() => setModuleDialog(null)} />}
      {featureDialog && <FeatureDialog module={featureDialog.module} feature={featureDialog.feature} onClose={() => setFeatureDialog(null)} />}
      {addMember && (
        <AddMemberDialog
          exclude={members.map((m) => m.user_id)}
          onClose={() => setAddMember(false)}
          onAdd={(uid) => membership.mutate({ user_id: uid, member: true }, { onSuccess: () => setAddMember(false) })}
        />
      )}
    </div>
  );
}

function ProjectDialog({ project, onClose }: { project?: Project; onClose: () => void }) {
  const { lookup } = useWorkspace();
  const [form, setForm] = useState({
    key: project?.key ?? "",
    name: project?.name ?? "",
    description: project?.description ?? "",
    qa_lead_id: project?.qa_lead_id ?? "",
    pm_id: project?.pm_id ?? "",
    archived: project?.archived ?? false,
  });
  const save = useMutate(
    (api, body: typeof form) =>
      project
        ? api.patch(`/admin/projects/${project.id}`, { name: body.name, description: body.description || null, qa_lead_id: body.qa_lead_id || null, pm_id: body.pm_id || null, archived: body.archived })
        : api.post("/admin/projects", { ...body, description: body.description || null, qa_lead_id: body.qa_lead_id || null, pm_id: body.pm_id || null }),
    { success: project ? "Project saved" : "Project created" },
  );
  return (
    <Dialog
      title={project ? `Edit ${project.name}` : "New project"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={save.isPending || !form.name.trim() || (!project && !form.key.trim())} onClick={() => save.mutate(form, { onSuccess: onClose })}>
            {project ? "Save" : "Create project"}
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Name" required htmlFor="p-name">
          <input id="p-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Key" required={!project} help={project ? "Keys can't change after creation." : "2–8 letters or digits, e.g. SDS"} htmlFor="p-key">
          <input id="p-key" className="input mono" value={form.key} disabled={!!project} onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} maxLength={8} />
        </Field>
      </div>
      <Field label="Description" htmlFor="p-desc">
        <textarea id="p-desc" className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <div className="grid-2">
        <Field label="QA lead" htmlFor="p-lead">
          <select id="p-lead" className="select" value={form.qa_lead_id} onChange={(e) => setForm({ ...form, qa_lead_id: e.target.value })}>
            <option value="">None</option>
            {lookup.peopleWithRoles(["qa_lead"]).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project manager" htmlFor="p-pm">
          <select id="p-pm" className="select" value={form.pm_id} onChange={(e) => setForm({ ...form, pm_id: e.target.value })}>
            <option value="">None</option>
            {lookup.peopleWithRoles(["project_manager", "admin"]).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {project && (
        <label className="checkbox">
          <input type="checkbox" checked={form.archived} onChange={(e) => setForm({ ...form, archived: e.target.checked })} /> Archived (hidden from the report form; existing bugs stay)
        </label>
      )}
    </Dialog>
  );
}

function ModuleDialog({ project, module, onClose }: { project: Project; module: Module | null; onClose: () => void }) {
  const { lookup } = useWorkspace();
  const [form, setForm] = useState({ name: module?.name ?? "", description: module?.description ?? "", owner_id: module?.owner_id ?? "" });
  const save = useMutate(
    (api, body: typeof form) =>
      module
        ? api.patch(`/admin/modules/${module.id}`, { ...body, description: body.description || null, owner_id: body.owner_id || null })
        : api.post("/admin/modules", { ...body, project_id: project.id, description: body.description || null, owner_id: body.owner_id || null }),
    { success: module ? "Module saved" : "Module added" },
  );
  return (
    <Dialog
      title={module ? `Edit ${module.name}` : `New module in ${project.name}`}
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
      <Field label="Name" required htmlFor="m-name">
        <input id="m-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Description" htmlFor="m-desc">
        <textarea id="m-desc" className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label="Default owner" help="New bugs in this module are assigned to this engineer." htmlFor="m-owner">
        <select id="m-owner" className="select" value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
          <option value="">Nobody (goes to triage)</option>
          {lookup.peopleWithRoles(["engineer"]).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
    </Dialog>
  );
}

function FeatureDialog({ module, feature, onClose }: { module: Module; feature: Feature | null; onClose: () => void }) {
  const [form, setForm] = useState({ name: feature?.name ?? "", description: feature?.description ?? "", archived: feature?.archived ?? false });
  const save = useMutate(
    (api, body: typeof form) =>
      feature ? api.patch(`/admin/features/${feature.id}`, { ...body, description: body.description || null }) : api.post("/admin/features", { name: body.name, description: body.description || null, module_id: module.id }),
    { success: feature ? "Feature saved" : "Feature added" },
  );
  return (
    <Dialog
      title={feature ? `Edit ${feature.name}` : `New feature in ${module.name}`}
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
      <Field label="Name" required htmlFor="f-name">
        <input id="f-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Description" htmlFor="f-desc">
        <textarea id="f-desc" className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      {feature && (
        <label className="checkbox">
          <input type="checkbox" checked={form.archived} onChange={(e) => setForm({ ...form, archived: e.target.checked })} /> Archived
        </label>
      )}
    </Dialog>
  );
}

function AddMemberDialog({ exclude, onClose, onAdd }: { exclude: string[]; onClose: () => void; onAdd: (userId: string) => void }) {
  const { ws } = useWorkspace();
  const [uid, setUid] = useState("");
  const people = ws.users.filter((u) => u.active && !exclude.includes(u.id));
  if (!people.length) {
    return (
      <Dialog title="Add a member" onClose={onClose}>
        <p className="small muted">Everyone is already a member.</p>
      </Dialog>
    );
  }
  return (
    <Dialog
      title="Add a member"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!uid} onClick={() => onAdd(uid)}>
            Add
          </button>
        </>
      }
    >
      <Field label="Person" htmlFor="am-user">
        <select id="am-user" className="select" value={uid} onChange={(e) => setUid(e.target.value)}>
          <option value="">Choose…</option>
          {people.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {ROLE_LABELS[u.role]}
            </option>
          ))}
        </select>
      </Field>
    </Dialog>
  );
}


// ---------------------------------------------------------------------------
// Product map
// ---------------------------------------------------------------------------

const IMPORTANCE_LABEL: Record<PageImportance, string> = { critical: "Critical", high: "High", normal: "Normal", low: "Low" };

function ProductMapPanel({ project }: { project: Project }) {
  const { ws, lookup } = useWorkspace();
  const can = ws.capabilities.manage_product_map;
  const [editing, setEditing] = useState<Page | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const pages = ws.pages.filter((p) => p.project_id === project.id && !p.archived);
  const modules = lookup.modulesOf(project.id).filter((m) => pages.some((p) => p.module_id === m.id));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="row" style={{ gap: 8 }}>
          <MapIcon size={16} /> Product map <span className="chip">{pages.length} pages</span>
        </h2>
        {can && (
          <div className="row-wrap">
            <button className="btn btn-sm" onClick={() => setImporting(true)}>
              <FileUp /> Import map
            </button>
            <button className="btn btn-sm" onClick={() => setEditing("new")}>
              <Plus /> Add page
            </button>
          </div>
        )}
      </div>
      <div className="panel-body stack">
        <p className="small secondary">
          The screens of {project.name}: where each one lives, what is on it and how it must behave. When someone reports a problem, the assistant uses this to name the exact page and element, write the expected result from the rules, and weigh priority by how important the screen is.
        </p>
        {!pages.length && <p className="small muted">No pages yet. {can ? "Import your site map or add pages one by one." : "A QA lead, project manager or admin can add them."}</p>}
        {modules.map((m) => (
          <div key={m.id} className="stack-sm">
            <div className="eyebrow">{m.name}</div>
            <div className="map-pages">
              {pages
                .filter((p) => p.module_id === m.id)
                .map((p) => (
                  <button key={p.id} className="map-page" onClick={() => can && setEditing(p)} disabled={!can} title={can ? "Edit page" : undefined}>
                    <span className="row-between">
                      <strong className="truncate">{p.name}</strong>
                      <span className={`chip imp-${p.importance}`}>{IMPORTANCE_LABEL[p.importance]}</span>
                    </span>
                    {p.path && <span className="mono tiny muted truncate">{p.path}</span>}
                    <span className="tiny muted">
                      {plural(p.elements.length, "element")} · {plural(p.rules.length, "rule")}
                      {p.feature_id ? ` · ${lookup.feature(p.feature_id)?.name}` : ""}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      {editing && <PageDialog project={project} page={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {importing && <ImportMapDialog project={project} onClose={() => setImporting(false)} />}
    </section>
  );
}

function PageDialog({ project, page, onClose }: { project: Project; page: Page | null; onClose: () => void }) {
  const { lookup } = useWorkspace();
  const modules = lookup.modulesOf(project.id);
  const [form, setForm] = useState({
    module_id: page?.module_id ?? modules[0]?.id ?? "",
    feature_id: page?.feature_id ?? "",
    name: page?.name ?? "",
    path: page?.path ?? "",
    description: page?.description ?? "",
    elements: (page?.elements ?? []).join("\n"),
    rules: (page?.rules ?? []).join("\n"),
    keywords: (page?.keywords ?? []).join(", "),
    importance: page?.importance ?? ("normal" as PageImportance),
  });
  const features = lookup.featuresOf(form.module_id);
  const body = () => ({
    module_id: form.module_id,
    feature_id: form.feature_id || null,
    name: form.name,
    path: form.path || null,
    description: form.description || null,
    elements: form.elements.split("\n"),
    rules: form.rules.split("\n"),
    keywords: form.keywords.split(","),
    importance: form.importance,
  });
  const save = useMutate((api) => (page ? api.patch(`/admin/pages/${page.id}`, body()) : api.post("/admin/pages", body())), { success: page ? "Page saved" : "Page added" });
  const archive = useMutate((api) => api.patch(`/admin/pages/${page!.id}`, { archived: true }), { success: "Page removed from the map" });
  return (
    <Dialog
      title={page ? `Edit ${page.name}` : "Add a page"}
      onClose={onClose}
      wide
      footer={
        <>
          {page && (
            <button className="btn btn-ghost" style={{ marginRight: "auto" }} onClick={() => archive.mutate(undefined, { onSuccess: onClose })}>
              Remove from map
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={save.isPending || !form.name.trim() || !form.module_id} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            Save
          </button>
        </>
      }
    >
      <div className="grid-3">
        <Field label="Module" required htmlFor="pg-mod">
          <select id="pg-mod" className="select" value={form.module_id} onChange={(e) => setForm({ ...form, module_id: e.target.value, feature_id: "" })}>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Feature" htmlFor="pg-feat">
          <select id="pg-feat" className="select" value={form.feature_id} onChange={(e) => setForm({ ...form, feature_id: e.target.value })}>
            <option value="">None</option>
            {features.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Importance" help="Weighs the priority suggestion." htmlFor="pg-imp">
          <select id="pg-imp" className="select" value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value as PageImportance })}>
            {PAGE_IMPORTANCE.map((i) => (
              <option key={i} value={i}>
                {IMPORTANCE_LABEL[i]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Page name" required htmlFor="pg-name">
          <input id="pg-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Edit member" />
        </Field>
        <Field label="Path or URL" htmlFor="pg-path">
          <input id="pg-path" className="input mono" value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/members/:id/edit" />
        </Field>
      </div>
      <Field label="What the page is for" htmlFor="pg-desc">
        <textarea id="pg-desc" className="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <div className="grid-2">
        <Field label="Elements on the page" help="One per line: fields, buttons, tables, messages." htmlFor="pg-el">
          <textarea id="pg-el" className="textarea" rows={6} value={form.elements} onChange={(e) => setForm({ ...form, elements: e.target.value })} placeholder={"Role dropdown\nSave button"} />
        </Field>
        <Field label="How it must behave" help="One rule per line. Used to write the expected result." htmlFor="pg-rules">
          <textarea id="pg-rules" className="textarea" rows={6} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} placeholder="Saving keeps every changed field." />
        </Field>
      </div>
      <Field label="Other names people use" help="Comma separated." htmlFor="pg-kw">
        <input id="pg-kw" className="input" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="member settings, user profile" />
      </Field>
    </Dialog>
  );
}

interface ImportResult {
  modules_created: string[];
  features_created: string[];
  pages_created: string[];
  pages_updated: string[];
  warnings: string[];
}

function ImportMapDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const api = useApi();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useMutate((a, dry: boolean) => a.post<ImportResult>(`/admin/projects/${project.id}/product-map`, { map: text, dry_run: dry }), { success: (_r, dry) => (dry ? null : "Product map imported"), silentError: true });
  const check = async () => {
    setError(null);
    setBusy(true);
    try {
      setPreview(await run.mutateAsync(true));
    } catch (e) {
      setPreview(null);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const template = async () => {
    try {
      setText(JSON.stringify(await api.get("/product-map/template"), null, 2));
      setPreview(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
    setPreview(null);
  };
  return (
    <Dialog
      title={`Import the product map for ${project.name}`}
      description="Paste or load a JSON map of modules, features and pages. Existing pages with the same name are updated; missing modules and features are created. Nothing is deleted."
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy || !text.trim()} onClick={check}>
            Preview
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !preview}
            onClick={async () => {
              setBusy(true);
              try {
                await run.mutateAsync(false);
                onClose();
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Import
          </button>
        </>
      }
    >
      <div className="row-wrap">
        <button className="btn btn-sm" onClick={template}>
          Start from the template
        </button>
        <label className="btn btn-sm">
          Load a .json file
          <input type="file" accept="application/json,.json" hidden onChange={(e) => readFile(e.target.files?.[0])} />
        </label>
      </div>
      <textarea
        className="textarea mono"
        rows={14}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
        placeholder='{ "modules": [ { "name": "Members", "features": [ { "name": "Edit member", "pages": [ { "name": "Edit member", "path": "/members/:id/edit", "elements": ["Role dropdown"], "rules": ["Saving keeps every changed field."], "importance": "high" } ] } ] } ] }'
        aria-label="Product map JSON"
      />
      {error && <div className="callout danger small">{error}</div>}
      {preview && (
        <div className="callout info small">
          <div className="grow stack-sm">
            <div className="title">Preview: nothing has been saved yet</div>
            <div>
              {preview.pages_created.length} new pages, {preview.pages_updated.length} updated, {preview.modules_created.length} new modules, {preview.features_created.length} new features.
            </div>
            {preview.modules_created.length > 0 && <div className="muted">New modules: {preview.modules_created.join(", ")}</div>}
            {preview.pages_created.length > 0 && <div className="muted">New pages: {preview.pages_created.slice(0, 12).join(", ")}{preview.pages_created.length > 12 ? "…" : ""}</div>}
            {preview.warnings.map((w) => (
              <div key={w} className="danger-text">
                {w}
              </div>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}
