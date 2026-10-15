import Link from "next/link";
import { ArrowRight, Flame, Scale, Swords, Target, Trophy, Zap } from "lucide-react";
import { BATTLE_MODES, getBattleMode } from "@/content/battle-modes";
import type { BattlePrompt } from "@/content/battle-prompts";
import { XP_RULES } from "@/lib/game-rules";
import { SCORING_NOTE } from "@/lib/analysis/demo-analyzer";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, SampleBadge } from "@/components/ui/badge";
import { DailyChallengeArt, EmptyArt } from "@/components/art/scene-art";
import { BattleModeArt } from "@/components/art/battle-art";
import { BattleModeCard, type ModeStatLite } from "./mode-card";

export interface RecentBattleItem {
  id: string;
  sessionId: string;
  promptText: string;
  modeId: string | null;
  opponentName: string;
  result: string;
  userScore: number | null;
  opponentScore: number | null;
  createdAt: string;
  sample: boolean;
}

export const SCORING_RULES = [
  ["Fluency and continuity", 25, "How long and how smoothly you keep talking, and how you link ideas."],
  ["Grammar and sentence construction", 25, "How often common error patterns appear for the number of words you used."],
  ["Vocabulary and expression", 20, "Variety and precision of your words, and avoiding overused phrases."],
  ["Relevance and clarity", 20, "Whether you answer the prompt directly in clear sentences."],
  ["Response development", 10, "Reasons, examples, and a clear finish."],
] as const;

export function BattleGallery({
  daily,
  dailyDone,
  stats,
  modeStats,
  recent,
  timeZone,
}: {
  daily: BattlePrompt;
  dailyDone: boolean;
  stats: { total: number; wins: number; draws: number; losses: number; best: number | null; average: number | null };
  modeStats: Record<string, ModeStatLite>;
  recent: RecentBattleItem[];
  timeZone: string;
}) {
  const dailyMode = getBattleMode(daily.mode)!;
  const winRate = stats.total ? Math.round((stats.wins / stats.total) * 100) : null;
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 bg-dots-light px-6 py-7 text-white sm:px-8">
        <div className="pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full bg-pink-500/40 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <Badge tone="dark" className="bg-pink-500/25 text-pink-100">
              <Swords className="h-3.5 w-3.5" /> Speaking mini-games
            </Badge>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Speaking Battles</h1>
            <p className="mt-2 text-white/75">
              Pick a battle type, beat the clock, and get scored on the same 100-point rubric as your opponent. Every battle earns XP, win or lose.
            </p>
          </div>
          <dl className="grid grid-cols-4 gap-2 text-center sm:gap-3">
            {[
              ["Played", stats.total],
              ["Wins", stats.wins],
              ["Win rate", winRate == null ? "–" : `${winRate}%`],
              ["Best", stats.best ?? "–"],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/10">
                <dd className="font-display text-2xl font-extrabold tabular-nums">{value}</dd>
                <dt className="text-[11px] font-bold tracking-wide text-white/60 uppercase">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Daily challenge */}
      <section aria-labelledby="daily-title" className="relative overflow-hidden rounded-[1.75rem] border-2 border-sun-300 bg-gradient-to-r from-sun-100 via-sun-50 to-pink-50 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <DailyChallengeArt className="h-24 w-32 shrink-0 animate-bob self-center" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-xs font-extrabold tracking-wide text-pink-700 uppercase">
              <Target className="h-4 w-4" /> Daily Challenge · {dailyMode.name}
              {dailyDone && <Badge tone="mint">Done today ✓</Badge>}
            </p>
            <h2 id="daily-title" className="mt-1 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              {daily.prompt}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Objective: finish today&apos;s prompt in a {dailyMode.name} battle. Bonus{" "}
              <strong className="text-ink">+{XP_RULES.dailyChallenge} XP</strong> once per day, on top of {dailyMode.xp} XP for the battle.
            </p>
          </div>
          <ButtonLink href={`/battles?prompt=${daily.id}&go=1`} variant="pink" size="lg" className="shrink-0">
            <Zap className="h-5 w-5" /> {dailyDone ? "Play again" : "Play now"}
          </ButtonLink>
        </div>
      </section>

      {/* Battle types */}
      <section aria-labelledby="types-title">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 id="types-title" className="text-2xl font-extrabold tracking-tight">
              Choose your battle
            </h2>
            <p className="text-muted">Six ways to play. Tap a card to see how it works.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {BATTLE_MODES.map((m, i) => (
            <BattleModeCard
              key={m.id}
              mode={m}
              stat={modeStats[m.id]}
              detailHref={`/battles?mode=${m.id}`}
              actionHref={`/battles?mode=${m.id}`}
              actionLabel="Let's go"
              className="animate-slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader
            title="Recent battles"
            icon={<Trophy className="h-5 w-5" />}
            action={
              <ButtonLink href="/history?type=battle" variant="ghost" size="sm">
                All battles <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            }
          />
          <CardBody className="pt-3">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <EmptyArt className="h-24 w-24" />
                <p className="mt-2 font-bold">No battles yet</p>
                <p className="text-sm text-muted">Your first result lands here. Quick Fire is a great place to start.</p>
              </div>
            ) : (
              <ul className="-mx-2 space-y-1">
                {recent.map((b) => {
                  const mode = getBattleMode(b.modeId);
                  return (
                    <li key={b.id}>
                      <Link href={`/history/${b.sessionId}`} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-surface-muted/70">
                        <span className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
                          {mode ? <BattleModeArt mode={mode.id} className="h-10 w-auto" /> : <Swords className="h-5 w-5 text-muted" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{b.promptText}</span>
                          <span className="text-xs text-muted">
                            {mode?.name ?? "Battle"} · vs {b.opponentName} · {formatDate(b.createdAt, timeZone)}
                          </span>
                        </span>
                        {b.sample && <SampleBadge label="Sample" className="hidden sm:inline-flex" />}
                        <span
                          className={cn(
                            "flex shrink-0 flex-col items-center rounded-xl px-2.5 py-1 text-center",
                            b.result === "win" ? "bg-mint-50 text-mint-700" : b.result === "draw" ? "bg-sky-50 text-sky-700" : "bg-surface-muted text-muted",
                          )}
                        >
                          <span className="font-display text-lg leading-none font-extrabold tabular-nums">
                            {b.userScore ?? "–"}
                            <span className="text-xs font-bold opacity-60">–{b.opponentScore ?? "–"}</span>
                          </span>
                          <span className="text-[10px] font-extrabold uppercase">{b.result === "win" ? "Won" : b.result === "draw" ? "Draw" : b.result === "loss" ? "Lost" : "No result"}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How scoring works" icon={<Scale className="h-5 w-5" />} />
          <CardBody className="space-y-3 text-sm">
            <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
              <li>You and a demo opponent get the same prompt.</li>
              <li>Prepare, then answer before the timer runs out.</li>
              <li>Both answers are scored with the same 100-point rubric.</li>
              <li>Scores within 2 points are a draw.</li>
            </ol>
            <details className="group rounded-2xl bg-surface-muted/60 p-3">
              <summary className="cursor-pointer font-bold text-ink">The 100-point rubric</summary>
              <ul className="mt-2 space-y-2">
                {SCORING_RULES.map(([label, max, desc]) => (
                  <li key={label}>
                    <p className="flex justify-between font-semibold">
                      <span>{label}</span>
                      <span>{max}</span>
                    </p>
                    <p className="text-muted">{desc}</p>
                  </li>
                ))}
              </ul>
            </details>
            <p className="flex items-start gap-2 text-xs text-muted">
              <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" /> Beat your best score for +{XP_RULES.battlePersonalBest} XP.
            </p>
            <p className="text-xs text-muted">{SCORING_NOTE} Pronunciation is scored only when a reliable speech-analysis service is available, and accent never affects scores.</p>
            <p className="text-xs text-muted">In demo mode, opponents are fictional and their answers are pre-written samples.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
