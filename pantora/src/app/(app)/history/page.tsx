import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { requireUser } from "@/server/auth";
import { listSessions, type HistoryFilters } from "@/server/queries";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionRow } from "@/components/app/session-row";
import { HistoryFiltersBar } from "@/features/history/history-filters";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Conversation History" };

type Search = { type?: string; status?: string; from?: string; to?: string; sort?: string; page?: string; feedback?: string };

const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { profile, settings } = await requireUser();
  const sp = await searchParams;
  const filters: HistoryFilters = {
    type: (["free_talk", "battle", "coach"] as const).find((t) => t === sp.type) ?? "all",
    status: (["completed", "incomplete"] as const).find((t) => t === sp.status) ?? "all",
    from: isDate(sp.from),
    to: isDate(sp.to),
    sort: (["oldest", "longest"] as const).find((t) => t === sp.sort) ?? "newest",
    withFeedback: sp.feedback === "1",
    page: Math.max(1, Number(sp.page) || 1),
    pageSize: 10,
  };
  const result = listSessions(profile.id, filters);
  const pageHref = (page: number) => {
    const params = new URLSearchParams(Object.entries({ ...sp, page: String(page) }).filter(([, v]) => v) as [string, string][]);
    return `/history?${params.toString()}`;
  };

  return (
    <div>
      <PageHeader title="Conversation History" description="Every Free Talk, Speaking Battle, and AI practice session. Open a session to review its transcript and feedback." />
      <HistoryFiltersBar
        initial={{ type: filters.type!, status: filters.status!, from: filters.from ?? "", to: filters.to ?? "", sort: filters.sort!, feedback: filters.withFeedback! }}
      />
      <Card className="mt-5">
        <CardBody className="p-3 sm:p-4">
          <p className="px-3 pb-2 text-sm text-muted" aria-live="polite">
            {result.total} session{result.total === 1 ? "" : "s"}
            {result.pages > 1 && ` · page ${result.page} of ${result.pages}`}
          </p>
          {result.items.length === 0 ? (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title={result.total === 0 && filters.type === "all" && !filters.from ? "No sessions yet" : "No sessions match these filters"}
              description="Completed and incomplete sessions appear here. Try clearing filters or start a new practice session."
              action={<ButtonLink href="/free-talk">Start a conversation</ButtonLink>}
              className="m-2"
            />
          ) : (
            <div className="divide-y divide-line/60">
              {result.items.map((s) => (
                <SessionRow key={s.id} s={s} timeZone={profile.timezone} showPartner={settings.privacy.showPartnerNamesInHistory} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      {result.pages > 1 && (
        <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
          {result.page > 1 && (
            <Link href={pageHref(result.page - 1)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted">
              Previous
            </Link>
          )}
          {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={pageHref(p)}
              aria-current={p === result.page ? "page" : undefined}
              className={cn("min-w-10 rounded-xl border px-3 py-2 text-center text-sm font-semibold", p === result.page ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface hover:bg-surface-muted")}
            >
              {p}
            </Link>
          ))}
          {result.page < result.pages && (
            <Link href={pageHref(result.page + 1)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted">
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
