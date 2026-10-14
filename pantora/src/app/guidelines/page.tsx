import type { Metadata } from "next";
import { COMMUNITY_GUIDELINES } from "@/content/guidelines";
import { SimplePage } from "@/components/marketing/simple-page";

export const metadata: Metadata = { title: "Community guidelines" };

export default function GuidelinesPage() {
  return (
    <SimplePage title="Community guidelines" intro="Pantora works because people feel safe making mistakes. These rules apply to every conversation and battle.">
      <ol className="space-y-6">
        {COMMUNITY_GUIDELINES.map((g, i) => (
          <li key={g.title} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">{i + 1}</span>
            <div>
              <h2 className="font-bold">{g.title}</h2>
              <p className="mt-1 text-ink-soft">{g.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="rounded-card border border-line bg-surface p-6">
        <h2 className="font-bold">If something goes wrong</h2>
        <p className="mt-2 text-ink-soft">
          End the conversation, then block or report the person. Reports are recorded with the reason you choose and reviewed by people. Pantora does not monitor calls automatically, so your reports matter.
        </p>
      </section>
    </SimplePage>
  );
}
