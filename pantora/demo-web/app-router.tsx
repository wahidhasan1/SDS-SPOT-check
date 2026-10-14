// Renders Pantora's App Router pages and layouts in the browser. Pages are
// async server components in the full app; here they are awaited directly.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { NotFoundSignal, RedirectSignal, router } from "./router-core";
import * as Landing from "@/app/page";
import * as Onboarding from "@/app/onboarding/page";
import * as Guidelines from "@/app/guidelines/page";
import * as Privacy from "@/app/privacy/page";
import * as Admin from "@/app/admin/page";
import * as AppLayout from "@/app/(app)/layout";
import * as Dashboard from "@/app/(app)/dashboard/page";
import * as FreeTalk from "@/app/(app)/free-talk/page";
import * as Battles from "@/app/(app)/battles/page";
import * as Coach from "@/app/(app)/coach/page";
import * as CoachSaved from "@/app/(app)/coach/saved/page";
import * as Progress from "@/app/(app)/progress/page";
import * as Topics from "@/app/(app)/topics/page";
import * as History from "@/app/(app)/history/page";
import * as SessionReview from "@/app/(app)/history/[id]/page";
import * as Achievements from "@/app/(app)/achievements/page";
import * as Settings from "@/app/(app)/settings/page";
import * as Safety from "@/app/(app)/safety/page";
import * as Help from "@/app/(app)/help/page";
import NotFound from "@/app/not-found";
import AppError from "@/app/(app)/error";

interface PageModule {
  default: (props: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }) => ReactNode | Promise<ReactNode>;
  metadata?: { title?: string | { default?: string } };
}

const ROUTES: { pattern: RegExp; names: string[]; page: PageModule; inApp: boolean }[] = [
  { pattern: /^\/$/, names: [], page: Landing as PageModule, inApp: false },
  { pattern: /^\/onboarding$/, names: [], page: Onboarding as PageModule, inApp: false },
  { pattern: /^\/guidelines$/, names: [], page: Guidelines as PageModule, inApp: false },
  { pattern: /^\/privacy$/, names: [], page: Privacy as PageModule, inApp: false },
  { pattern: /^\/admin$/, names: [], page: Admin as PageModule, inApp: false },
  { pattern: /^\/dashboard$/, names: [], page: Dashboard as PageModule, inApp: true },
  { pattern: /^\/free-talk$/, names: [], page: FreeTalk as PageModule, inApp: true },
  { pattern: /^\/battles$/, names: [], page: Battles as PageModule, inApp: true },
  { pattern: /^\/coach$/, names: [], page: Coach as PageModule, inApp: true },
  { pattern: /^\/coach\/saved$/, names: [], page: CoachSaved as PageModule, inApp: true },
  { pattern: /^\/progress$/, names: [], page: Progress as PageModule, inApp: true },
  { pattern: /^\/topics$/, names: [], page: Topics as PageModule, inApp: true },
  { pattern: /^\/history$/, names: [], page: History as PageModule, inApp: true },
  { pattern: /^\/history\/([^/]+)$/, names: ["id"], page: SessionReview as unknown as PageModule, inApp: true },
  { pattern: /^\/achievements$/, names: [], page: Achievements as PageModule, inApp: true },
  { pattern: /^\/settings$/, names: [], page: Settings as PageModule, inApp: true },
  { pattern: /^\/safety$/, names: [], page: Safety as PageModule, inApp: true },
  { pattern: /^\/help$/, names: [], page: Help as PageModule, inApp: true },
];

const Layout = AppLayout.default as unknown as (props: { children: ReactNode }) => Promise<ReactNode>;

function titleOf(mod: PageModule) {
  const t = mod.metadata?.title;
  const name = typeof t === "string" ? t : t?.default;
  return name && !name.startsWith("Pantora") ? `${name} · Pantora Demo` : "Pantora Demo";
}

async function render(path: string, search: string): Promise<ReactNode> {
  const route = ROUTES.find((r) => r.pattern.test(path));
  if (!route) return <NotFound />;
  const m = route.pattern.exec(path)!;
  const params = Object.fromEntries(route.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
  const searchParams = Object.fromEntries(new URLSearchParams(search));
  document.title = titleOf(route.page);
  let el = await route.page.default({ params: Promise.resolve(params), searchParams: Promise.resolve(searchParams) });
  if (route.inApp) el = await Layout({ children: el });
  return el;
}

export function App() {
  const snapshot = useSyncExternalStore(router.subscribe, router.snapshot, router.snapshot);
  const [view, setView] = useState<ReactNode>(null);
  const [lastPath, setLastPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { path, search, hash } = router.location;
    render(path, search)
      .then((el) => {
        if (cancelled) return;
        setView(el);
        if (path !== lastPath) {
          setLastPath(path);
          requestAnimationFrame(() => {
            if (hash) document.getElementById(hash)?.scrollIntoView();
            else window.scrollTo(0, 0);
          });
        } else if (hash) {
          requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }));
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof RedirectSignal) return router.replace(error.to);
        if (error instanceof NotFoundSignal) return setView(<NotFound />);
        console.error(error);
        setView(<AppError error={error as Error} reset={() => router.refresh()} />);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  // In-page anchors such as "#features" scroll instead of changing the URL.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const href = a?.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      e.preventDefault();
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return <>{view}</>;
}
