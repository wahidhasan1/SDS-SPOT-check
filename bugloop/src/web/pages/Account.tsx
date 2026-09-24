// Personal settings, sign-in and first-run setup.

import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Moon, Sun, SunMoon } from "lucide-react";
import type { AuthStatus, LoginResponse } from "../../core/api";
import { ROLE_LABELS, type Role } from "../../core/types";
import { useApi, useWorkspace } from "../app/context";
import { errorMessage, useMutate } from "../api/hooks";
import { BrandMark } from "../components/BrandMark";
import { Field, Segmented, cx } from "../components/ui";
import { initials } from "../lib/format";
import { useTheme, type ThemePref } from "../lib/theme";

export function SettingsPage() {
  const { ws } = useWorkspace();
  const me = ws.me;
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState({ name: me.name, title: me.title ?? "" });
  const [prefs, setPrefs] = useState(me.notification_prefs);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const saveProfile = useMutate((api, body: object) => api.patch("/me", body), { success: "Saved" });
  const changePw = useMutate((api, body: { current: string; next: string }) => api.post("/me/password", body), { success: "Password changed" });
  const pwMismatch = pw.confirm.length > 0 && pw.next !== pw.confirm;
  return (
    <div className="stack-lg narrow-page">
      <div className="page-head">
        <div>
          <h1>Profile &amp; preferences</h1>
          <p className="sub">
            {ROLE_LABELS[me.role]} · {me.email}
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Profile</h2>
        </div>
        <div className="panel-body stack">
          <div className="grid-2">
            <Field label="Name" htmlFor="me-name">
              <input id="me-name" className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </Field>
            <Field label="Job title" htmlFor="me-title">
              <input id="me-title" className="input" value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} />
            </Field>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" disabled={saveProfile.isPending || !profile.name.trim()} onClick={() => saveProfile.mutate({ name: profile.name, title: profile.title || null })}>
              Save profile
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Notifications</h2>
        </div>
        <div className="panel-body stack">
          <p className="small secondary">Anything that needs you (questions, regressions, decisions, assignments and mentions) is always sent. Choose the rest:</p>
          <label className="checkbox">
            <input type="checkbox" checked={prefs.progress} onChange={(e) => setPrefs({ ...prefs, progress: e.target.checked })} />
            <span>
              Progress updates
              <span className="help block">Work started, fixes made testable, bugs closed, on bugs you reported or watch.</span>
            </span>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={prefs.discussion} onChange={(e) => setPrefs({ ...prefs, discussion: e.target.checked })} />
            <span>
              Discussion
              <span className="help block">New comments and evidence on bugs you're involved in.</span>
            </span>
          </label>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate({ notification_prefs: prefs })}>
              Save notification settings
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Appearance</h2>
        </div>
        <div className="panel-body">
          <Segmented<ThemePref>
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: <span className="row" style={{ gap: 6 }}><SunMoon size={14} /> System</span> },
              { value: "light", label: <span className="row" style={{ gap: 6 }}><Sun size={14} /> Light</span> },
              { value: "dark", label: <span className="row" style={{ gap: 6 }}><Moon size={14} /> Dark</span> },
            ]}
          />
        </div>
      </section>

      {ws.mode === "server" && (
        <section className="panel">
          <div className="panel-head">
            <h2>Password</h2>
          </div>
          <div className="panel-body stack">
            <div className="grid-3">
              <Field label="Current password" htmlFor="pw-cur">
                <input id="pw-cur" className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </Field>
              <Field label="New password" help="At least 8 characters" htmlFor="pw-new">
                <input id="pw-new" className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </Field>
              <Field label="Repeat new password" error={pwMismatch ? "The passwords don't match." : null} htmlFor="pw-rep">
                <input id="pw-rep" className={cx("input", pwMismatch && "invalid")} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </Field>
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                disabled={changePw.isPending || !pw.next || pwMismatch}
                onClick={() => changePw.mutate({ current: pw.current, next: pw.next }, { onSuccess: () => setPw({ current: "", next: "", confirm: "" }) })}
              >
                Change password
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign in and setup (shown before a workspace is loaded)
// ---------------------------------------------------------------------------

const ROLE_ORDER: Role[] = ["qa_analyst", "qa_lead", "engineer", "project_manager", "admin"];

export function LoginPage({ status, onSignedIn }: { status: AuthStatus; onSignedIn: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finish = async (res: LoginResponse) => {
    api.setToken(res.token);
    await qc.resetQueries();
    onSignedIn();
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("form");
    setError(null);
    try {
      await finish(await api.post<LoginResponse>("/auth/login", { email, password }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const demo = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await finish(await api.post<LoginResponse>("/auth/demo-login", { user_id: id }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  };
  const groups = ROLE_ORDER.map((r) => ({ role: r, people: status.demo_accounts.filter((a) => a.role === r) })).filter((g) => g.people.length);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="row" style={{ gap: 10 }}>
          <BrandMark className="brand-mark" />
          <div>
            <div className="brand-name">Bugloop</div>
            <div className="tiny muted">{status.workspace_name}</div>
          </div>
        </div>
        <h1>Sign in</h1>
        <form className="stack" onSubmit={submit}>
          <Field label="Email" htmlFor="l-email">
            <input id="l-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password" htmlFor="l-pw">
            <input id="l-pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <div className="callout danger small">{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={!!busy}>
            {busy === "form" && <span className="spinner" />}Sign in
          </button>
        </form>
        {status.demo_login && groups.length > 0 && (
          <div className="stack-sm">
            <div className="divider" />
            <div className="small secondary">Demo workspace: sign in as anyone. Passwords for the sample people are <code>demo1234</code>.</div>
            <div className="demo-accounts">
              {groups.map((g) => (
                <div key={g.role} className="stack-sm" style={{ gap: 4 }}>
                  <div className="eyebrow">{ROLE_LABELS[g.role]}</div>
                  {g.people.map((a) => (
                    <button key={a.id} className="persona" onClick={() => demo(a.id)} disabled={!!busy}>
                      <span className={cx("avatar", `tone-${a.avatar_color}`)}>{initials(a.name)}</span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <strong className="truncate" style={{ display: "block" }}>{a.name}</strong>
                        <span className="tiny muted truncate" style={{ display: "block" }}>{a.title}</span>
                      </span>
                      {busy === a.id ? <span className="spinner" /> : <ArrowRight size={14} className="muted" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SetupPage({ onDone }: { onDone: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const [form, setForm] = useState({ workspace_name: "", name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<LoginResponse>("/auth/setup", form);
      api.setToken(res.token);
      await qc.resetQueries();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="row" style={{ gap: 10 }}>
          <BrandMark className="brand-mark" />
          <div className="brand-name">Bugloop</div>
        </div>
        <h1>Set up your workspace</h1>
        <p className="small secondary">You'll be the first administrator. Add projects, modules and people once you're in.</p>
        <Field label="Workspace name" htmlFor="s-ws">
          <input id="s-ws" className="input" placeholder="Acme QA" value={form.workspace_name} onChange={(e) => setForm({ ...form, workspace_name: e.target.value })} />
        </Field>
        <Field label="Your name" htmlFor="s-name">
          <input id="s-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email" htmlFor="s-email">
          <input id="s-email" className="input" type="email" required autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" help="At least 8 characters" htmlFor="s-pw">
          <input id="s-pw" className="input" type="password" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        {error && <div className="callout danger small">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy && <span className="spinner" />}Create workspace
        </button>
      </form>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="stack-lg narrow-page" style={{ alignItems: "flex-start" }}>
      <h1>Page not found</h1>
      <p className="secondary">The page you opened doesn't exist, or you don't have access to it.</p>
      <Link to="/" className="btn">
        Back to the dashboard
      </Link>
    </div>
  );
}
