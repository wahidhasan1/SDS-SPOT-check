// Application root: data client, sign-in gate, workspace and routes. The same tree runs against
// the Node server (browser router) and inside the single-file demo (memory router).

import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, MemoryRouter, Route, Routes, useLocation } from "react-router";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { ApiError, type ApiClient } from "../api/client";
import { errorMessage, useAuthStatus, useWorkspaceQuery } from "../api/hooks";
import { AppShell } from "../layout/AppShell";
import { ActionPage, NotificationsPage, RegressionPage } from "../pages/Queues";
import { AdminSettingsPage, AdminUsersPage, AdminWorkflowPage, AuditPage } from "../pages/Admin";
import { AnalyticsPage } from "../pages/Analytics";
import { BugDetailPage } from "../pages/bug/BugDetail";
import { BugsPage } from "../pages/Bugs";
import { DashboardPage } from "../pages/Dashboard";
import { LoginPage, NotFoundPage, SettingsPage, SetupPage } from "../pages/Account";
import { ProjectDetailPage, ProjectsPage } from "../pages/Projects";
import { ReportBugPage } from "../pages/ReportBug";
import { ApiProvider, ToastProvider, WorkspaceProvider, useApi, useWorkspace } from "./context";

export function BugloopApp({ client, router }: { client: ApiClient; router: "browser" | "memory" }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: (count, err) => !(err instanceof ApiError && err.status > 0 && err.status < 500) && count < 2,
          },
        },
      }),
  );
  const Router = router === "browser" ? BrowserRouter : MemoryRouter;
  return (
    <QueryClientProvider client={qc}>
      <ApiProvider client={client}>
        <ToastProvider>
          <Router>
            <AuthGate />
          </Router>
        </ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function Splash({ children }: { children?: ReactNode }) {
  return (
    <div className="splash">
      {children ?? (
        <>
          <span className="spinner" /> Loading Bugloop…
        </>
      )}
    </div>
  );
}

function AuthGate() {
  const api = useApi();
  const qc = useQueryClient();
  const status = useAuthStatus();
  const [signedIn, setSignedIn] = useState(!!api.token);
  useEffect(() => {
    api.onUnauthorized = () => {
      setSignedIn(false);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth-status" });
    };
    return () => {
      api.onUnauthorized = null;
    };
  }, [api, qc]);
  const ready = signedIn && !!status.data && !status.data.needs_setup;
  const ws = useWorkspaceQuery(ready);
  // The demo host announces when Claude becomes available (after the page has rendered).
  useEffect(() => {
    const onAi = () => void qc.invalidateQueries({ queryKey: ["workspace"] });
    window.addEventListener("bugloop:ai-changed", onAi);
    return () => window.removeEventListener("bugloop:ai-changed", onAi);
  }, [qc]);

  if (status.isLoading) return <Splash />;
  if (!status.data) {
    return (
      <Splash>
        <div className="callout danger" style={{ maxWidth: 440 }}>
          <CircleAlert />
          <div>
            <div className="title">Bugloop can't reach its server</div>
            <div>{errorMessage(status.error)}</div>
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => status.refetch()}>
              Try again
            </button>
          </div>
        </div>
      </Splash>
    );
  }
  if (status.data.needs_setup) return <SetupPage onDone={() => setSignedIn(true)} />;
  if (!signedIn) return <LoginPage status={status.data} onSignedIn={() => setSignedIn(true)} />;
  if (!ws.data) {
    if (ws.isError) {
      return (
        <Splash>
          <div className="callout danger" style={{ maxWidth: 440 }}>
            <CircleAlert />
            <div>
              <div className="title">Couldn't load the workspace</div>
              <div>{errorMessage(ws.error)}</div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => ws.refetch()}>
                Try again
              </button>
            </div>
          </div>
        </Splash>
      );
    }
    return <Splash />;
  }
  return (
    <WorkspaceProvider ws={ws.data}>
      <AppRoutes />
    </WorkspaceProvider>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Guard({ allow, children }: { allow: boolean; children: ReactNode }) {
  return allow ? <>{children}</> : <NotFoundPage />;
}

function AppRoutes() {
  const { ws } = useWorkspace();
  const caps = ws.capabilities;
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="action" element={<ActionPage />} />
          <Route path="bugs" element={<BugsPage />} />
          <Route path="bugs/new" element={<Guard allow={caps.report}><ReportBugPage /></Guard>} />
          <Route path="bugs/:ref" element={<BugDetailPage />} />
          <Route path="regression" element={<RegressionPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin/users" element={<Guard allow={caps.manage_users}><AdminUsersPage /></Guard>} />
          <Route path="admin/workflow" element={<Guard allow={caps.manage_config}><AdminWorkflowPage /></Guard>} />
          <Route path="admin/audit" element={<Guard allow={caps.view_audit}><AuditPage /></Guard>} />
          <Route path="admin/settings" element={<Guard allow={caps.manage_config}><AdminSettingsPage /></Guard>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
