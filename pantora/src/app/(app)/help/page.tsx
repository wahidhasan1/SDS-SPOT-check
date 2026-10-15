import type { Metadata } from "next";
import { CircleCheck, CircleHelp, FlaskConical, MessageSquareHeart } from "lucide-react";
import { requireUser } from "@/server/auth";
import { integrationStatus } from "@/server/config";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeedbackForm } from "@/features/help/feedback-form";
import { Mascot } from "@/components/art/mascot";

export const metadata: Metadata = { title: "Help & Feedback" };

const HELP = [
  ["How do I start practicing?", "Open Free Talk and press Start Matching, or try a 30-second Speaking Battle from the dashboard."],
  ["Why don't I get feedback after a Free Talk?", "Feedback needs a transcript. Turn on live captions (Chrome or Edge) before or during the call. Pantora never invents a transcript."],
  ["What counts toward my streak?", "At least 2 minutes of speaking practice in a day: completed conversations plus recorded battle and coach answers."],
  ["Can I change my level?", "Yes — your level is only an estimate. Change it in Settings → Profile at any time."],
  ["How do I stop seeing a partner?", "Block them during or after a conversation. You can unblock people in the Safety Center."],
  ["Is my microphone audio recorded?", "Free Talk is never recorded. Battle and coach recordings stay in your browser unless you explicitly send them for transcription."],
];

export default async function HelpPage() {
  await requireUser();
  const integrations = integrationStatus();
  return (
    <div className="space-y-6">
      <PageHeader title="Help & Feedback" description="Answers to common questions, what this demo simulates, and a way to tell us what you think." tone="sky" art={<Mascot mood="think" />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader title="Frequently asked" icon={<CircleHelp className="h-5 w-5" />} />
          <CardBody className="divide-y divide-line py-2">
            {HELP.map(([q, a]) => (
              <details key={q} className="group py-3 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                  {q}
                  <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm text-ink-soft">{a}</p>
              </details>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Send feedback" icon={<MessageSquareHeart className="h-5 w-5" />} description="Ideas, problems, or praise — stored for the Pantora team." />
          <CardBody>
            <FeedbackForm />
          </CardBody>
        </Card>
      </div>

      <Card id="demo-mode" className="scroll-mt-24">
        <CardHeader title="What's real and what's simulated" icon={<FlaskConical className="h-5 w-5" />} description="This build runs without paid services. Here is exactly what each part does right now." />
        <CardBody>
          <ul className="divide-y divide-line">
            {integrations.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex w-48 shrink-0 items-center gap-2">
                  <span className="font-semibold">{i.name}</span>
                </div>
                <Badge tone={i.state === "configured" ? "success" : "demo"} className="w-fit">
                  {i.state === "configured" ? "Live" : "Demo / simulated"}
                </Badge>
                <p className="text-sm text-ink-soft">{i.detail}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl bg-success-50/70 p-4 text-sm text-ink-soft">
            <p className="flex items-center gap-2 font-semibold text-success-700">
              <CircleCheck className="h-4 w-4" /> Always real
            </p>
            <p className="mt-1">
              Your profile, settings, session history, practice minutes, streaks, XP, achievements, saved sentences, favorites, blocks, and reports are stored in Pantora&apos;s database and update as you use the app. Microphone level meters, recording, playback, and browser captions use your real device.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
