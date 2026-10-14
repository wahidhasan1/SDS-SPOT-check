import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Flag, PhoneOff, ShieldCheck, SkipForward } from "lucide-react";
import { requireUser } from "@/server/auth";
import { listBlocks, listMyReports } from "@/server/queries";
import { COMMUNITY_GUIDELINES } from "@/content/guidelines";
import { REPORT_REASON_LABELS } from "@/lib/schemas";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BlockedList } from "@/features/safety/blocked-list";

export const metadata: Metadata = { title: "Safety Center" };

export default async function SafetyPage() {
  const { profile } = await requireUser();
  const blocks = listBlocks(profile.id);
  const reports = listMyReports(profile.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Privacy & Safety" description="Tools that keep conversations comfortable, and how Pantora handles your reports and data." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [PhoneOff, "End", "Leave any conversation immediately with the red End call button."],
          [SkipForward, "Skip", "End the conversation and find a different partner."],
          [Ban, "Block", "Blocked people are excluded from all your future matches."],
          [Flag, "Report", "Choose a reason and add details. Reports are reviewed by people."],
        ].map(([Icon, title, body]) => {
          const I = Icon as typeof Ban;
          return (
            <Card key={title as string} className="p-5">
              <I className="h-6 w-6 text-brand-600" />
              <p className="mt-3 font-bold">{title as string}</p>
              <p className="mt-1 text-sm text-muted">{body as string}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Blocked partners" icon={<Ban className="h-5 w-5" />} description="They won't be matched with you again." />
          <CardBody>
            <BlockedList blocks={blocks} timeZone={profile.timezone} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Your reports" icon={<Flag className="h-5 w-5" />} description="Status updates appear here." />
          <CardBody>
            {reports.length === 0 ? (
              <EmptyState title="No reports" description="If someone makes you uncomfortable, use Report during or after a conversation." className="py-6" />
            ) : (
              <ul className="divide-y divide-line">
                {reports.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{r.reportedName}</p>
                      <Badge tone={r.status === "resolved" ? "success" : r.status === "dismissed" ? "neutral" : r.status === "reviewing" ? "info" : "streak"}>{r.status[0].toUpperCase() + r.status.slice(1)}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {REPORT_REASON_LABELS[r.reason as keyof typeof REPORT_REASON_LABELS] ?? r.reason} · {formatDate(r.createdAt, profile.timezone)}
                    </p>
                    {r.details && <p className="mt-1 text-sm text-ink-soft">“{r.details}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card id="guidelines">
        <CardHeader title="Community guidelines" icon={<ShieldCheck className="h-5 w-5" />} />
        <CardBody>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {COMMUNITY_GUIDELINES.map((g, i) => (
              <li key={g.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{i + 1}</span>
                <div>
                  <p className="font-semibold">{g.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{g.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What Pantora's safety tools can and can't do" />
        <CardBody className="space-y-2 text-sm text-ink-soft">
          <p>• Reports and blocks are stored in Pantora&apos;s database and visible to administrators in the admin area.</p>
          <p>• There is no automated monitoring of conversations: Pantora does not listen to or record calls, so it relies on your reports.</p>
          <p>• In this demo, partners are fictional, so reports about them are recorded for demonstration but no real person is affected.</p>
          <p>• A production deployment needs a staffed moderation process, response times, and escalation rules before it is opened to the public.</p>
          <p>
            Manage what Pantora keeps in <Link href="/settings#privacy" className="font-semibold text-brand-600">privacy settings</Link>, or read the{" "}
            <Link href="/privacy" className="font-semibold text-brand-600">privacy overview</Link>.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
