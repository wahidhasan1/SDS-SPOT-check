import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Database, Flag, MessagesSquare, Sparkles, Swords, Users } from "lucide-react";
import { adminAccessMode, isAdmin } from "@/server/admin";
import { config, integrationStatus } from "@/server/config";
import { databasePath } from "@/server/db";
import { adminBattles, adminDemoPartners, adminFeedback, adminOverview, adminProductFeedback, adminReports, adminSessions, adminUsers } from "@/server/admin-queries";
import { getCurrentUser } from "@/server/auth";
import { REPORT_REASON_LABELS } from "@/lib/schemas";
import { PROFICIENCY_LABELS, SESSION_TYPE_LABELS } from "@/lib/labels";
import { formatDuration } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/logo";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, SampleBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { StatCard } from "@/components/ui/stat-card";
import { ToastProvider } from "@/components/ui/toast";
import { AdminGate } from "@/features/admin/admin-gate";
import { ReportStatusControl } from "@/features/admin/report-status";
import { ResetDemoButton, ExitAdminButton } from "@/features/admin/admin-actions";

export const metadata: Metadata = { title: "Demo admin" };
export const dynamic = "force-dynamic";

const TABS = [
  ["overview", "Overview"],
  ["users", "Users & profiles"],
  ["sessions", "Sessions"],
  ["battles", "Battles"],
  ["reports", "Safety reports"],
  ["feedback", "AI feedback"],
  ["config", "Configuration"],
] as const;

function when(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line text-xs text-muted uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

const td = "px-3 py-2.5 align-top";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const mode = adminAccessMode();
  const allowed = await isAdmin();
  const user = await getCurrentUser();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find(([t]) => t === rawTab)?.[0] ?? "overview";

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-canvas">
        <header className="border-b border-line bg-navy-900 text-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" aria-label="Pantora home">
              <Logo tone="light" />
            </Link>
            <span className="rounded-full bg-streak-500/20 px-2.5 py-0.5 text-xs font-bold text-streak-400">{mode === "token" ? "Admin" : "Demo admin"}</span>
            <div className="ml-auto flex items-center gap-2">
              <Link href={user ? "/dashboard" : "/"} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Back to app
              </Link>
              {allowed && <ExitAdminButton />}
            </div>
          </div>
        </header>

        {!allowed ? (
          <AdminGate mode={mode} />
        ) : (
          <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            {mode === "demo" && (
              <p className="rounded-2xl border border-streak-100 bg-streak-50 px-4 py-3 text-sm text-streak-700">
                Demo admin is open to anyone using this demo because no <code className="font-mono">PANTORA_ADMIN_TOKEN</code> is set. Set a token before exposing Pantora to other people.
              </p>
            )}
            <nav aria-label="Admin sections" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
              {TABS.map(([id, label]) => (
                <Link
                  key={id}
                  href={`/admin?tab=${id}`}
                  aria-current={tab === id ? "page" : undefined}
                  className={cn("shrink-0 rounded-xl px-4 py-2 text-sm font-semibold", tab === id ? "bg-navy-900 text-white" : "text-ink-soft hover:bg-surface")}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {tab === "overview" && <Overview />}
            {tab === "users" && <UsersTab />}
            {tab === "sessions" && <SessionsTab />}
            {tab === "battles" && <BattlesTab />}
            {tab === "reports" && <ReportsTab />}
            {tab === "feedback" && <FeedbackTab />}
            {tab === "config" && <ConfigTab />}
          </main>
        )}
      </div>
    </ToastProvider>
  );
}

function Overview() {
  const o = adminOverview();
  const product = adminProductFeedback();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Profiles" value={o.users} icon={<Users className="h-5 w-5" />} hint={`${o.localUsers} created locally`} />
        <StatCard label="Sessions" value={o.sessions} icon={<MessagesSquare className="h-5 w-5" />} tone="info" hint={`${o.seedSessions} sample · ${o.liveSessions} live`} />
        <StatCard label="Battles" value={o.battles} icon={<Swords className="h-5 w-5" />} tone="streak" />
        <StatCard label="Open reports" value={o.openReports} icon={<Flag className="h-5 w-5" />} tone="streak" hint={`${o.blocks} blocks recorded`} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Demo data" icon={<Database className="h-5 w-5" />} />
          <CardBody className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-muted">Application mode</dt>
                <dd className="font-semibold">{config.demoMode ? "Demo mode" : "Production mode"}</dd>
              </div>
              <div>
                <dt className="text-muted">Seeded</dt>
                <dd className="font-semibold">{o.seededAt ? when(o.seededAt) : "Not seeded"}</dd>
              </div>
              <div>
                <dt className="text-muted">Schema version</dt>
                <dd className="font-semibold">{o.schemaVersion}</dd>
              </div>
              <div>
                <dt className="text-muted">Feedback records</dt>
                <dd className="font-semibold">
                  {o.feedback} ({o.aiFeedback} from AI)
                </dd>
              </div>
            </dl>
            <div className="rounded-2xl border border-danger-100 bg-danger-50/50 p-4">
              <p className="font-semibold text-danger-700">Reset demo data</p>
              <p className="mt-1 text-muted">Deletes every profile, session, report, and setting on this server and restores the original sample data. You&apos;ll be signed in to the demo account afterwards.</p>
              <div className="mt-3">
                <ResetDemoButton />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Product feedback" icon={<Sparkles className="h-5 w-5" />} description={`${product.length} message${product.length === 1 ? "" : "s"}`} />
          <CardBody>
            {product.length === 0 ? (
              <p className="text-sm text-muted">No feedback yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {product.slice(0, 8).map((p) => (
                  <li key={p.id} className="py-3 text-sm">
                    <p className="flex items-center gap-2">
                      <Badge tone="neutral">{p.category}</Badge>
                      <span className="font-semibold">{p.user_name ?? "Deleted user"}</span>
                      <span className="text-xs text-muted">{when(p.created_at)}</span>
                    </p>
                    <p className="mt-1 text-ink-soft">{p.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const users = adminUsers();
  const partners = adminDemoPartners();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Pantora profiles" description="Sample accounts are fictional. Local profiles were created through onboarding on this server." />
        <CardBody>
          <Table head={["Profile", "Level", "Type", "Sessions", "Minutes", "XP", "Created"]}>
            {users.map((u) => (
              <tr key={u.id}>
                <td className={td}>
                  <span className="flex items-center gap-2">
                    <Avatar name={u.display_name} avatar={u.avatar} size="xs" />
                    <span className="font-semibold">{u.display_name}</span>
                  </span>
                </td>
                <td className={td}>{PROFICIENCY_LABELS[u.proficiency as keyof typeof PROFICIENCY_LABELS]}</td>
                <td className={td}>{u.is_demo_account ? <Badge tone="demo">Demo account</Badge> : u.origin === "seed" ? <SampleBadge label="Sample" /> : <Badge tone="brand">Local</Badge>}</td>
                <td className={td}>{u.sessions}</td>
                <td className={td}>{u.minutes}</td>
                <td className={td}>{u.xp}</td>
                <td className={td}>{when(u.created_at)}</td>
              </tr>
            ))}
          </Table>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Fictional demo partners" description="Used by simulated matching and battles." />
        <CardBody>
          <Table head={["Partner", "Level", "Interests", "Blocked by", "Reports"]}>
            {partners.map((p) => (
              <tr key={p.id}>
                <td className={td}>
                  <span className="flex items-center gap-2">
                    <Avatar name={p.display_name} avatar={p.avatar} size="xs" />
                    <span className="font-semibold">{p.display_name}</span>
                  </span>
                </td>
                <td className={td}>{PROFICIENCY_LABELS[p.proficiency as keyof typeof PROFICIENCY_LABELS]}</td>
                <td className={td}>{(JSON.parse(p.interests) as string[]).join(", ")}</td>
                <td className={td}>{p.blocked_by}</td>
                <td className={td}>{p.reported}</td>
              </tr>
            ))}
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

function SessionsTab() {
  const rows = adminSessions();
  return (
    <Card>
      <CardHeader title="Conversation sessions" description="Most recent 40 across all profiles." />
      <CardBody>
        <Table head={["When", "User", "Type", "Topic / prompt", "Partner", "Duration", "Status", "Origin", "XP"]}>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className={td}>{when(s.started_at)}</td>
              <td className={td}>{s.user_name}</td>
              <td className={td}>{SESSION_TYPE_LABELS[s.type as keyof typeof SESSION_TYPE_LABELS]}</td>
              <td className={cn(td, "max-w-64 truncate")}>{s.topic ?? s.prompt_text ?? "—"}</td>
              <td className={td}>{s.partner_name ?? "—"}</td>
              <td className={td}>{formatDuration(s.duration_seconds)}</td>
              <td className={td}>{s.status === "completed" ? <Badge tone="success">Completed</Badge> : <Badge>Incomplete</Badge>}</td>
              <td className={td}>{s.origin === "seed" ? <SampleBadge label="Sample" /> : s.origin === "live" ? <Badge tone="success">Live</Badge> : <Badge tone="demo">Demo</Badge>}</td>
              <td className={td}>{s.xp_awarded}</td>
            </tr>
          ))}
        </Table>
      </CardBody>
    </Card>
  );
}

function BattlesTab() {
  const rows = adminBattles();
  return (
    <Card>
      <CardHeader title="Speaking battles" description="Opponent answers in demo mode are pre-written samples." />
      <CardBody>
        <Table head={["When", "User", "Prompt", "Opponent", "Input", "Score", "Result", "Origin"]}>
          {rows.map((b) => (
            <tr key={b.id}>
              <td className={td}>{when(b.created_at)}</td>
              <td className={td}>{b.user_name}</td>
              <td className={cn(td, "max-w-64")}>{b.prompt_text}</td>
              <td className={td}>{b.opponent_name}</td>
              <td className={td}>{b.user_input_mode}</td>
              <td className={td}>
                {b.user_score ?? "–"} vs {b.opponent_score ?? "–"}
              </td>
              <td className={td}>
                <Badge tone={b.result === "win" ? "success" : b.result === "draw" ? "info" : "neutral"}>{b.result}</Badge>
              </td>
              <td className={td}>{b.origin === "seed" ? <SampleBadge label="Sample" /> : <Badge tone="demo">Simulated</Badge>}</td>
            </tr>
          ))}
        </Table>
      </CardBody>
    </Card>
  );
}

function ReportsTab() {
  const rows = adminReports();
  return (
    <Card>
      <CardHeader title="Safety reports" description="Update a report's status as it is handled. Reporters see the status in their Safety Center." />
      <CardBody>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No reports.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{r.reported_name}</span>
                    <Badge tone="danger">{REPORT_REASON_LABELS[r.reason as keyof typeof REPORT_REASON_LABELS]}</Badge>
                    <Badge tone="neutral">{r.reported_kind === "demo_partner" ? "Demo partner" : "User"}</Badge>
                    {r.origin === "seed" && <SampleBadge label="Sample" />}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Reported by {r.reporter_name ?? "deleted user"} · {when(r.created_at)}
                  </p>
                  {r.details && <p className="mt-1.5 text-sm text-ink-soft">“{r.details}”</p>}
                  {r.admin_note && <p className="mt-1.5 text-sm text-muted">Note: {r.admin_note}</p>}
                </div>
                <ReportStatusControl id={r.id} status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function FeedbackTab() {
  const rows = adminFeedback();
  return (
    <Card>
      <CardHeader title="AI feedback records" description="Every analysis is labeled with the analyzer that produced it." />
      <CardBody>
        <Table head={["When", "User", "Kind", "Analyzer", "Input", "Corrections", "Summary", "Reviewed"]}>
          {rows.map((f) => (
            <tr key={f.id}>
              <td className={td}>{when(f.created_at)}</td>
              <td className={td}>{f.user_name}</td>
              <td className={td}>{f.kind}</td>
              <td className={td}>
                <Badge tone={f.analyzer === "anthropic" ? "brand" : "demo"}>{f.analyzer === "anthropic" ? f.model ?? "Claude" : "Demo rules"}</Badge>
                {f.origin === "seed" && <SampleBadge label="Sample" className="ml-1" />}
              </td>
              <td className={td}>{f.input_mode}</td>
              <td className={td}>{f.issues}</td>
              <td className={cn(td, "max-w-80 text-muted")}>{f.summary}</td>
              <td className={td}>{f.reviewed_at ? "Yes" : "No"}</td>
            </tr>
          ))}
        </Table>
      </CardBody>
    </Card>
  );
}

function ConfigTab() {
  const integrations = integrationStatus();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Feature configuration" description="Derived from environment variables. Secrets are never shown." />
        <CardBody>
          <ul className="divide-y divide-line">
            {integrations.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-44 shrink-0 font-semibold">{i.name}</span>
                <Badge tone={i.state === "configured" ? "success" : "demo"} className="w-fit">
                  {i.state === "configured" ? "Configured" : "Demo fallback"}
                </Badge>
                <span className="text-sm text-ink-soft">{i.detail}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Runtime" />
        <CardBody>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Mode</dt>
              <dd className="font-semibold">{config.demoMode ? "Demo (PANTORA_DEMO_MODE=true)" : "Production (demo account disabled)"}</dd>
            </div>
            <div>
              <dt className="text-muted">Admin access</dt>
              <dd className="font-semibold">{adminAccessMode() === "token" ? "Token required" : "Open in demo mode"}</dd>
            </div>
            <div>
              <dt className="text-muted">Database file</dt>
              <dd className="font-mono text-xs break-all">{databasePath()}</dd>
            </div>
            <div>
              <dt className="text-muted">AI model</dt>
              <dd className="font-semibold">{config.ai.anthropicKey ? `${config.ai.model} (effort: ${config.ai.effort})` : "Not configured"}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
