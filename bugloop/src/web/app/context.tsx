import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import type { Environment, Feature, Level, Module, Project, Role, StatusConfig, StatusKey, Team, User, Workspace } from "../../core/types";
import type { TimelineLookup } from "../../core/timeline";
import type { ApiClient } from "../api/client";

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const c = useContext(ApiContext);
  if (!c) throw new Error("ApiProvider missing");
  return c;
}

// ---------------------------------------------------------------------------
// Workspace lookups
// ---------------------------------------------------------------------------

export interface Lookup {
  user(id: string | null | undefined): User | null;
  userName(id: string | null | undefined): string;
  team(id: string | null | undefined): Team | null;
  project(id: string | null | undefined): Project | null;
  module(id: string | null | undefined): Module | null;
  feature(id: string | null | undefined): Feature | null;
  environment(id: string | null | undefined): Environment | null;
  status(key: StatusKey): StatusConfig;
  severity(key: string): Level | null;
  priority(key: string): Level | null;
  modulesOf(projectId: string | null | undefined): Module[];
  featuresOf(moduleId: string | null | undefined): Feature[];
  peopleWithRoles(roles: Role[], opts?: { includeInactive?: boolean }): User[];
  timeline: TimelineLookup;
}

export function buildLookup(ws: Workspace): Lookup {
  const users = new Map(ws.users.map((u) => [u.id, u]));
  const teams = new Map(ws.teams.map((t) => [t.id, t]));
  const projects = new Map(ws.projects.map((p) => [p.id, p]));
  const modules = new Map(ws.modules.map((m) => [m.id, m]));
  const features = new Map(ws.features.map((f) => [f.id, f]));
  const envs = new Map(ws.environments.map((e) => [e.id, e]));
  const statuses = new Map(ws.statuses.map((s) => [s.key, s]));
  const severities = new Map(ws.severities.map((l) => [l.key, l]));
  const priorities = new Map(ws.priorities.map((l) => [l.key, l]));
  const get = <T,>(m: Map<string, T>, id: string | null | undefined) => (id ? m.get(id) ?? null : null);
  const lookup: Lookup = {
    user: (id) => get(users, id),
    userName: (id) => (id ? users.get(id)?.name ?? "Unknown user" : "System"),
    team: (id) => get(teams, id),
    project: (id) => get(projects, id),
    module: (id) => get(modules, id),
    feature: (id) => get(features, id),
    environment: (id) => get(envs, id),
    status: (key) => statuses.get(key) ?? { key, label: key, description: "", color: "slate", sort_order: 99, enabled: true, attention_hours: null },
    severity: (key) => severities.get(key) ?? null,
    priority: (key) => priorities.get(key) ?? null,
    modulesOf: (projectId) => ws.modules.filter((m) => m.project_id === projectId && !m.archived),
    featuresOf: (moduleId) => ws.features.filter((f) => f.module_id === moduleId && !f.archived),
    peopleWithRoles: (roles, opts) => ws.users.filter((u) => roles.includes(u.role) && (opts?.includeInactive || u.active)),
    timeline: {
      user: (id) => (id ? users.get(id)?.name ?? "Unknown user" : "System"),
      status: (key) => statuses.get(key)?.label ?? key,
      bugKey: () => null,
      severity: (k) => severities.get(k)?.label ?? k,
      priority: (k) => priorities.get(k)?.label ?? k,
      environment: (id) => (id ? envs.get(id)?.name ?? null : null),
      module: (id) => (id ? modules.get(id)?.name ?? null : null),
    },
  };
  return lookup;
}

interface WorkspaceValue {
  ws: Workspace;
  lookup: Lookup;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ ws, children }: { ws: Workspace; children: ReactNode }) {
  const value = useMemo(() => ({ ws, lookup: buildLookup(ws) }), [ws]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const v = useContext(WorkspaceContext);
  if (!v) throw new Error("WorkspaceProvider missing");
  return v;
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
}

const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3800);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === "error" ? "error" : ""}`}>
            {t.tone === "error" ? <CircleAlert /> : <CircleCheck />}
            <span>{t.message}</span>
            <button aria-label="Dismiss" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
