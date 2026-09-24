import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  Bot,
  Bug,
  ClipboardCheck,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Plus,
  RefreshCcw,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  SunMoon,
  UserCog,
  Users,
} from "lucide-react";
import type { LoginResponse } from "../../core/api";
import { ROLE_LABELS, type Role } from "../../core/types";
import { useApi, useToast, useWorkspace } from "../app/context";
import { errorMessage, useCounts, useNotifications, useSearch } from "../api/hooks";
import { Avatar, StatusPill } from "../components/badges";
import { Dialog, Popover, cx, useDebounced } from "../components/ui";
import { relativeTime } from "../lib/format";
import { useTheme } from "../lib/theme";
import { BrandMark } from "../components/BrandMark";

function NavItem({ to, icon: Icon, label, count, hot, match }: { to: string; icon: typeof Bug; label: string; count?: number; hot?: boolean; match?: (path: string, search: string) => boolean }) {
  const loc = useLocation();
  const active = match ? match(loc.pathname, loc.search) : undefined;
  return (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => cx((active ?? isActive) && "active")}>
      <Icon aria-hidden />
      <span>{label}</span>
      {count ? <span className={cx("count", hot && "hot")}>{count}</span> : null}
    </NavLink>
  );
}

export function AppShell() {
  const { ws } = useWorkspace();
  const caps = ws.capabilities;
  const counts = useCounts();
  const loc = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const c = counts.data;
  const isEngineer = ws.me.role === "engineer";

  useEffect(() => setNavOpen(false), [loc.pathname, loc.search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c" && caps.report) {
        e.preventDefault();
        navigate("/bugs/new");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate, caps.report]);

  const inView = (view: string) => (path: string, search: string) => path === "/bugs" && new URLSearchParams(search).get("view") === view;

  return (
    <div className={cx("shell", navOpen && "nav-open")}>
      {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
      <aside className="sidebar" aria-label="Main navigation">
        <NavLink to="/" className="brand" aria-label="Bugloop home">
          <BrandMark className="brand-mark" />
          <span>
            <div className="brand-name">Bugloop</div>
            <div className="brand-sub">{ws.settings.workspace_name}</div>
          </span>
        </NavLink>
        {caps.report && (
          <button className="btn btn-primary btn-block" onClick={() => navigate("/bugs/new")} title="Report a bug (c)">
            <Plus /> Report bug
          </button>
        )}
        <nav className="nav">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/action" icon={Inbox} label="Needs my action" count={c?.action_items} hot={!!c?.action_items} />
          <NavItem to="/bugs" icon={Bug} label="Bugs" match={(p, s) => p === "/bugs" && !["mine", "assigned"].includes(new URLSearchParams(s).get("view") ?? "")} />
          {isEngineer ? (
            <NavItem to="/bugs?view=assigned" icon={ListChecks} label="Assigned to me" count={c?.assigned} match={inView("assigned")} />
          ) : (
            <NavItem to="/bugs?view=mine" icon={ListChecks} label="My bugs" count={c?.mine_open} match={inView("mine")} />
          )}
          {(caps.qa || ws.me.role === "project_manager") && <NavItem to="/regression" icon={ClipboardCheck} label="Regression" count={c?.my_regression} hot={!!c?.my_regression} />}
          <NavItem to="/notifications" icon={Bell} label="Notifications" count={c?.unread_notifications} />
          <NavItem to="/analytics" icon={BarChart3} label="Analytics" />
          <NavItem to="/projects" icon={FolderKanban} label="Projects" />
          {(caps.manage_users || caps.manage_config || caps.view_audit) && <div className="nav-label eyebrow">Admin</div>}
          {caps.manage_users && <NavItem to="/admin/users" icon={Users} label="Users & teams" />}
          {caps.manage_config && <NavItem to="/admin/workflow" icon={SlidersHorizontal} label="Workflow & fields" />}
          {caps.view_audit && <NavItem to="/admin/audit" icon={ScrollText} label="Audit log" />}
          {caps.manage_config && <NavItem to="/admin/settings" icon={Settings} label="Workspace settings" />}
        </nav>
        <div className="sidebar-foot">
          <AiStatusLine />
          {ws.demo_login && (
            <button className="demo-banner" onClick={() => setSwitcher(true)} style={{ cursor: "pointer", textAlign: "left" }}>
              <UserCog size={16} />
              <span>
                <strong>Demo workspace.</strong> People and bugs are fictional sample data. Switch person to try the QA, engineering and lead views.
                {ws.mode === "demo" && " Changes stay in this browser."}
              </span>
            </button>
          )}
          <UserMenu onSwitch={() => setSwitcher(true)} />
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn menu-toggle" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
            <Menu />
          </button>
          <GlobalSearch />
          <div className="grow" />
          {caps.report && (
            <button className="btn btn-primary btn-sm hide-wide" onClick={() => navigate("/bugs/new")}>
              <Plus /> Report
            </button>
          )}
          <NotificationBell />
        </header>
        <main className="content" id="main">
          <Outlet />
        </main>
      </div>
      {switcher && <SwitchPersonDialog onClose={() => setSwitcher(false)} />}
    </div>
  );
}

function AiStatusLine() {
  const { ws } = useWorkspace();
  const ai = ws.ai;
  return (
    <div className="row tiny muted" style={{ padding: "0 6px" }} title={ai.vision ? "Can read screenshots" : "Can't read screenshots"}>
      <Bot size={14} />
      <span className="truncate">Assistant: {ai.label}</span>
    </div>
  );
}

function UserMenu({ onSwitch }: { onSwitch: () => void }) {
  const { ws } = useWorkspace();
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const me = ws.me;
  const [confirmReset, setConfirmReset] = useState(false);
  const signOut = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // The session may already be gone; sign out locally regardless.
    }
    api.setToken(null);
    qc.clear();
    navigate("/");
    api.onUnauthorized?.();
  };
  return (
    <>
    {confirmReset && (
      <Dialog
        title="Reset the demo?"
        description="This discards every report, comment and change made in this browser and restores the sample workspace."
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button className="btn btn-danger solid" onClick={() => window.dispatchEvent(new Event("bugloop:reset-demo"))}>
              Reset demo data
            </button>
          </>
        }
      >
        <p className="small secondary">You'll be signed in as Wahid Hasan again.</p>
      </Dialog>
    )}
    <Popover
      align="left"
      side="top"
      width={230}
      trigger={({ toggle }) => (
        <button className="list-row" style={{ borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px" }} onClick={toggle}>
          <Avatar userId={me.id} />
          <span className="stack-sm grow" style={{ gap: 0 }}>
            <span className="truncate" style={{ fontWeight: 600, fontSize: 13 }}>{me.name}</span>
            <span className="tiny muted truncate">{ROLE_LABELS[me.role]}</span>
          </span>
        </button>
      )}
    >
      {(close) => (
        <div>
          <button className="menu-item" onClick={() => { close(); navigate("/settings"); }}>
            <Settings /> Profile & preferences
          </button>
          <button className="menu-item" onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}>
            {theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <SunMoon />} Theme: {theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
          </button>
          {ws.demo_login && (
            <button className="menu-item" onClick={() => { close(); onSwitch(); }}>
              <UserCog /> Switch person
            </button>
          )}
          {ws.mode === "demo" && (
            <button
              className="menu-item"
              onClick={() => {
                close();
                setConfirmReset(true);
              }}
            >
              <RotateCcw /> Reset demo data
            </button>
          )}
          <div className="menu-sep" />
          <button className="menu-item" onClick={signOut}>
            <LogOut /> Sign out
          </button>
        </div>
      )}
    </Popover>
    </>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounced(q, 200);
  const res = useSearch(debounced);
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const items = debounced ? res.data?.items ?? [] : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !t.closest("input, textarea, select")) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (key: string) => {
    setOpen(false);
    setQ("");
    navigate(`/bugs/${key}`);
  };

  return (
    <div className="global-search" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <div className="search-input">
        <Search />
        <input
          ref={input}
          className="input"
          placeholder="Search bugs by ID, title, person…"
          value={q}
          aria-label="Search bugs"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, Math.max(items.length, 1)));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter") {
              e.preventDefault();
              if (items[active]) go(items[active].key);
              else if (q.trim()) {
                setOpen(false);
                navigate(`/bugs?view=all&q=${encodeURIComponent(q.trim())}`);
              }
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        <kbd className="search-kbd">/</kbd>
      </div>
      {open && debounced && (
        <div className="popover search-results">
          {res.isFetching && !items.length && <div className="muted small" style={{ padding: 10 }}>Searching…</div>}
          {!res.isFetching && !items.length && <div className="muted small" style={{ padding: 10 }}>No bugs match “{debounced}”.</div>}
          {items.map((b, i) => (
            <button key={b.id} className={cx("menu-item", i === active && "active")} onMouseDown={(e) => e.preventDefault()} onClick={() => go(b.key)}>
              <span className="mono muted" style={{ width: 94, flex: "none" }}>{b.key}</span>
              <span className="truncate grow">{b.title}</span>
              <StatusPill status={b.status} size="sm" />
            </button>
          ))}
          {items.length > 0 && (
            <button className="menu-item" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); navigate(`/bugs?view=all&q=${encodeURIComponent(debounced)}`); }}>
              <Search /> See all results for “{debounced}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const n = useNotifications(8);
  const navigate = useNavigate();
  const unread = n.data?.unread ?? 0;
  return (
    <Popover
      align="right"
      width={360}
      trigger={({ toggle }) => (
        <button className="icon-btn" onClick={toggle} aria-label={`Notifications (${unread} unread)`}>
          <Bell />
          {unread > 0 && <span className="dot-count">{unread > 9 ? "9+" : unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="row-between" style={{ padding: "4px 8px 8px" }}>
            <strong>Notifications</strong>
            <button className="link-btn small" onClick={() => { close(); navigate("/notifications"); }}>See all</button>
          </div>
          {(n.data?.items ?? []).length === 0 && <div className="muted small" style={{ padding: 10 }}>Nothing yet.</div>}
          {(n.data?.items ?? []).map((item) => (
            <NotificationLink key={item.id} n={item} onGo={close} compact />
          ))}
        </div>
      )}
    </Popover>
  );
}

export function NotificationLink({ n, onGo, compact }: { n: import("../../core/types").Notification; onGo?: () => void; compact?: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { lookup } = useWorkspace();
  const bugKey = /[A-Z]{2,6}-\d{6}/.exec(n.title)?.[0] ?? null;
  const open = async () => {
    onGo?.();
    if (!n.read_at) {
      try {
        await api.post("/notifications/read", { ids: [n.id] });
        void qc.invalidateQueries({ queryKey: ["notifications"] });
        void qc.invalidateQueries({ queryKey: ["counts"] });
      } catch {
        // Marking as read is best-effort.
      }
    }
    if (n.bug_id) navigate(`/bugs/${bugKey ?? n.bug_id}`);
  };
  return (
    <button className={cx("notif", !n.read_at && "unread", compact && "compact")} onClick={open}>
      <Avatar userId={n.actor_id} size="sm" />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="notif-title">{n.title}</span>
        {n.body && !compact && <span className="notif-body">{n.body}</span>}
        <span className="notif-meta">
          <span className={cx("chip", n.category === "action" ? "danger" : n.category === "decision" ? "warning" : "")} style={{ height: 18, fontSize: 11 }}>
            {n.category === "action" ? "Action needed" : n.category === "decision" ? "Decision" : n.category === "discussion" ? "Discussion" : "Update"}
          </span>
          <span>{relativeTime(n.created_at)}</span>
          {n.actor_id && <span className="truncate">· {lookup.userName(n.actor_id)}</span>}
        </span>
      </span>
      {!n.read_at && <span className="unread-dot" aria-label="Unread" />}
    </button>
  );
}

const PERSONA_HINTS: Record<string, string> = {
  "Wahid Hasan": "Reports bugs. Has questions to answer, a regression to run and decisions to review.",
  "Rafiq Chowdhury": "Engineer for Members and Sites. Has a new bug waiting for triage.",
  "Maria Olsen": "Engineer for SDS Hub. Her Not a Bug decision was disputed.",
  "Imran Hossain": "Engineer for EHS. Waiting on QA for information.",
  "Nusrat Jahan": "QA lead. Settles disputes and picks up regressions for people who left.",
  "Hanne Lie": "Product manager. A deferred bug is due for review.",
  "Mahmud Karim": "Administrator. Manages people, projects and workflow settings.",
  "Kamal Uddin": "Mobile engineer. A sync bug has been reopened three times.",
  "Sofie Berg": "Mobile lead. Has a fix waiting for a test build.",
};

const ROLE_ORDER: Role[] = ["qa_analyst", "qa_lead", "engineer", "project_manager", "admin"];

function SwitchPersonDialog({ onClose }: { onClose: () => void }) {
  const { ws } = useWorkspace();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const groups = useMemo(
    () => ROLE_ORDER.map((role) => ({ role, people: ws.users.filter((u) => u.role === role && u.active) })).filter((g) => g.people.length),
    [ws.users],
  );
  const choose = async (id: string) => {
    setBusy(id);
    try {
      const res = await api.post<LoginResponse>("/auth/demo-login", { user_id: id });
      api.setToken(res.token);
      await qc.resetQueries();
      onClose();
      navigate("/");
      toast(`You're now ${res.user.name} (${ROLE_LABELS[res.user.role]}).`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog title="Switch person" description="Everyone sees the same bugs, but each role gets different actions, queues and permissions." onClose={onClose} wide>
      <div className="persona-grid">
        {groups.map((g) => (
          <div key={g.role} className="stack-sm">
            <div className="eyebrow">{ROLE_LABELS[g.role]}</div>
            {g.people.map((u) => (
              <button key={u.id} className={cx("persona", u.id === ws.me.id && "current")} onClick={() => choose(u.id)} disabled={!!busy}>
                <Avatar userId={u.id} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="row" style={{ gap: 6 }}>
                    <strong className="truncate">{u.name}</strong>
                    {u.id === ws.me.id && <span className="chip accent" style={{ height: 18, fontSize: 11 }}>You</span>}
                  </span>
                  <span className="tiny muted">{PERSONA_HINTS[u.name] ?? u.title}</span>
                </span>
                {busy === u.id ? <span className="spinner" /> : <RefreshCcw size={14} className="muted" />}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
