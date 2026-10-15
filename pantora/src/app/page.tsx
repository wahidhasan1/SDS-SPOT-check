import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Ban,
  CalendarCheck,
  Check,
  EyeOff,
  Flame,
  GraduationCap,
  Lightbulb,
  Lock,
  MessagesSquare,
  Mic,
  SkipForward,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  UserRound,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { config } from "@/server/config";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { DemoStartButton } from "@/components/marketing/demo-start-button";
import { ProductPreview } from "@/components/marketing/product-preview";
import { BATTLE_MODES, MODE_COLOR_CLASSES } from "@/content/battle-modes";
import { BattleModeArt } from "@/components/art/battle-art";

export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "Is Pantora an IELTS or exam preparation course?",
    a: "No. Pantora focuses on practical, everyday speaking: holding conversations, expressing opinions, and building confidence. It doesn't prepare you for a specific exam or award certificates.",
  },
  {
    q: "Do I have to use my real name?",
    a: "No. You choose a display name during onboarding, and you can change it any time. Your avatar is a color style, not a photo.",
  },
  {
    q: "How does the AI feedback work?",
    a: "After a conversation, battle, or coach exercise, Pantora reviews the text of what you said and suggests clearer, more natural sentences with short explanations. When no AI provider is configured, a transparent rule-based demo analyzer is used and clearly labeled.",
  },
  {
    q: "Is my voice recorded?",
    a: "Free Talk calls are not recorded. In Speaking Battles and the Coach you can choose to record an answer; the recording stays in your browser unless you explicitly send it for transcription.",
  },
  {
    q: "What if a conversation makes me uncomfortable?",
    a: "You can end the call, skip the partner, block them, or report them at any time. Blocked people are never matched with you again.",
  },
  {
    q: "Will Pantora make me fluent in 30 days?",
    a: "No app can promise that. What Pantora offers is regular, low-pressure speaking practice with useful feedback. Consistency is what makes the difference, and streaks help you keep it.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="bg-surface">
      {/* Navigation */}
      <header className="absolute inset-x-0 top-0 z-30">
        <nav className="mx-auto flex h-20 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8" aria-label="Main">
          <Link href="/" aria-label="Pantora home">
            <Logo tone="light" />
          </Link>
          <div className="hidden items-center gap-6 text-sm font-semibold text-white/70 md:flex">
            <a href="#how-it-works" className="hover:text-white">How it works</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#safety" className="hover:text-white">Safety</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <ButtonLink href="/dashboard" size="sm" className="px-4">
                Open dashboard <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            ) : (
              <ButtonLink href="/onboarding" size="sm" className="px-4">
                Start Speaking
              </ButtonLink>
            )}
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-950 pt-32 pb-28 text-white sm:pt-36 lg:pb-36">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-[120px]" />
          <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-info-500/20 blur-[100px]" />
        </div>
        <div className="relative mx-auto grid grid-cols-1 max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:px-8">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
              <Sparkles className="h-3.5 w-3.5 text-brand-300" /> Voice-first English speaking practice
            </p>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Speak Without Fear. <span className="bg-gradient-to-r from-brand-300 to-info-500 bg-clip-text text-transparent">Connect With the World.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Practice real conversations with English learners around the world, anonymously and at your own pace. Get friendly feedback on what
              you said, take on 30-second speaking battles, and build a habit that sticks.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href={user ? "/dashboard" : "/onboarding"} size="lg">
                <Mic className="h-5 w-5" /> Start Speaking
              </ButtonLink>
              <a
                href="#features"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-white/20 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                Explore Features
              </a>
            </div>
            {config.demoMode && !user && (
              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
                <span>Just looking?</span>
                <DemoStartButton variant="ghost" size="sm" className="[&_button]:text-brand-300 [&_button]:hover:bg-white/10 [&_button]:hover:text-white">
                  Explore the demo account <ArrowRight className="h-4 w-4" />
                </DemoStartButton>
              </div>
            )}
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
              {["Anonymous display names", "No payment details", "Feedback that explains, not judges"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="px-4 pb-6 sm:px-10 lg:px-0">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="How Pantora works" title="From nervous to natural, one conversation at a time" />
          <ol className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { icon: UserRound, title: "Create an anonymous profile", body: "Pick a display name, your level, and a small daily goal. Five minutes a day is a great start." },
              { icon: MessagesSquare, title: "Speak with real learners", body: "Join a low-pressure Free Talk or a 30-second Speaking Battle with a topic card to guide you." },
              { icon: Lightbulb, title: "Learn from what you said", body: "Review better ways to say your sentences, save the ones you like, and track your progress." },
            ].map((step, i) => (
              <li key={step.title} className="relative rounded-card border border-line bg-surface p-7 shadow-card">
                <span className="absolute top-6 right-6 text-5xl font-extrabold text-surface-muted">{i + 1}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <step.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <div id="features" className="scroll-mt-20 bg-canvas">
        <FeatureRow
          eyebrow="Free Talk"
          icon={MessagesSquare}
          title="Low-pressure conversations with learners like you"
          body="Get matched with someone at a similar level, pick a topic or get a suggestion, and talk for 5, 10, or 15 minutes. Follow-up questions keep the conversation flowing when you get stuck."
          points={["Matching by level and interests — never by nationality", "Topic cards with follow-up questions", "End, skip, block, or report at any time"]}
          visual={<FreeTalkVisual />}
        />
        <FeatureRow
          reverse
          eyebrow="Speaking Battles"
          icon={Swords}
          title="Thirty seconds. One topic. Your best answer."
          body="Prepare, speak against the clock, and compare answers using a clear 100-point rubric. Win or lose, you get specific feedback — and XP for taking part."
          points={["Fluency, grammar, vocabulary, relevance, and development", "Every score comes with an explanation", "Rewards for participation and personal bests"]}
          visual={<BattleVisual />}
        />
        <section aria-labelledby="modes-title" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h3 id="modes-title" className="text-center text-2xl font-extrabold tracking-tight">Six ways to battle</h3>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {BATTLE_MODES.map((m) => (
              <li key={m.id} className={`lift flex flex-col items-center rounded-[1.5rem] bg-gradient-to-br p-3 text-center ${MODE_COLOR_CLASSES[m.color].card}`}>
                <BattleModeArt mode={m.id} className="h-20 w-auto" />
                <span className="mt-2 w-full rounded-xl bg-white px-2 py-1.5">
                  <span className="block font-display font-extrabold">{m.name}</span>
                  <span className="block text-xs text-muted">{m.tagline}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <FeatureRow
          eyebrow="AI Speaking Coach"
          icon={GraduationCap}
          title="Feedback that explains why"
          body="Answer a practice prompt by typing or recording. The coach rewrites your answer in natural English, explains the important changes, and suggests one focused exercise."
          points={["Original vs. improved sentences", "Short, friendly explanations", "Save sentences to review later"]}
          visual={<CoachVisual />}
        />
        <FeatureRow
          reverse
          eyebrow="Progress and streaks"
          icon={BarChart3}
          title="See your practice add up"
          body="Daily goals, streaks, levels, and achievements turn practice into a habit. Charts show your speaking minutes and the skills you are building."
          points={["Daily goals of 5, 10, 15, or 30 minutes", "Streaks with clear, consistent rules", "Levels from First Words to Global Speaker"]}
          visual={<ProgressVisual />}
        />
      </div>

      {/* Safety */}
      <section id="safety" className="scroll-mt-20 bg-navy-900 py-24 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Privacy and safety" title="A comfortable place to make mistakes" light />
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: EyeOff, title: "Anonymous by default", body: "Display names and color avatars. No real name, photo, or location is shown to partners." },
              { icon: SkipForward, title: "Leave any time", body: "End a call or skip a partner with one tap. You never owe anyone a conversation." },
              { icon: Ban, title: "Block and report", body: "Blocked people are never matched with you again. Reports are recorded for review." },
              { icon: Lock, title: "You control your data", body: "Choose whether transcripts are kept, and delete your account and data whenever you like." },
            ].map((f) => (
              <div key={f.title} className="rounded-card border border-white/10 bg-white/[0.04] p-6">
                <f.icon className="h-6 w-6 text-brand-300" />
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-sm text-white/55">
            Pantora&apos;s safety tools include ending, skipping, blocking, and reporting. Reports are reviewed by people; Pantora does not claim to
            detect or prevent every kind of misconduct automatically. <Link href="/guidelines" className="font-semibold text-brand-300 hover:text-white">Read the community guidelines</Link>.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="FAQ" title="Questions people ask before their first conversation" />
          <div className="mt-12 divide-y divide-line rounded-card border border-line bg-surface shadow-card">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                  {item.q}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 to-navy-800 px-8 py-14 text-center text-white shadow-pop sm:px-16">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Your next conversation starts here.</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/75">Set up an anonymous profile in under a minute. No payment details needed.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href={user ? "/dashboard" : "/onboarding"} size="lg" variant="outline" className="border-0 text-brand-700">
              <Mic className="h-5 w-5" /> Start Speaking
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-canvas">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm text-muted">Speak Without Fear. Connect With the World.</p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <FooterCol title="Product" links={[["How it works", "/#how-it-works"], ["Features", "/#features"], ["Get started", "/onboarding"]]} />
            <FooterCol title="Trust" links={[["Community guidelines", "/guidelines"], ["Privacy", "/privacy"], ["Safety", "/#safety"]]} />
            <FooterCol title="Support" links={[["FAQ", "/#faq"], ["Help & feedback", "/help"], ["Demo admin", "/admin"]]} />
          </div>
        </div>
        <div className="border-t border-line py-6 text-center text-xs text-subtle">
          © {new Date().getFullYear()} Pantora. This is a demonstration build: practice partners are fictional and calls are simulated unless live mode is enabled.
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, light }: { eyebrow: string; title: string; light?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className={light ? "text-sm font-bold tracking-wide text-brand-300 uppercase" : "text-sm font-bold tracking-wide text-brand-600 uppercase"}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl ${light ? "text-white" : "text-ink"}`}>{title}</h2>
    </div>
  );
}

function FeatureRow({
  eyebrow,
  icon: Icon,
  title,
  body,
  points,
  visual,
  reverse,
}: {
  eyebrow: string;
  icon: typeof Mic;
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="py-16 sm:py-20">
      <div className={`mx-auto grid grid-cols-1 max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-bold tracking-wide text-brand-600 uppercase">
            <Icon className="h-4.5 w-4.5" /> {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance text-ink">{title}</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">{body}</p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-ink-soft">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div>{visual}</div>
      </div>
    </section>
  );
}

function VisualFrame({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[1.75rem] bg-gradient-to-br from-brand-100 via-lavender to-info-50 p-5 sm:p-8">{children}</div>;
}

function FreeTalkVisual() {
  return (
    <VisualFrame>
      <div className="space-y-3">
        {[
          { name: "Kenji", avatar: "sky", level: "Upper-intermediate", topic: "AI in Everyday Life", state: "Match found" },
          { name: "Sofia", avatar: "violet", level: "Elementary", topic: "Morning Routines", state: "Similar level" },
        ].map((m) => (
          <div key={m.name} className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white" style={{ backgroundImage: m.avatar === "sky" ? "linear-gradient(135deg,#38bdf8,#6366f1)" : "linear-gradient(135deg,#a78bfa,#7c3aed)" }}>
              {m.name[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{m.name}</p>
              <p className="truncate text-sm text-muted">
                {m.level} · {m.topic}
              </p>
            </div>
            <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-bold text-success-700">{m.state}</span>
          </div>
        ))}
        <div className="rounded-2xl bg-navy-900 p-5 text-white shadow-card">
          <p className="text-xs font-bold tracking-wide text-brand-300 uppercase">Follow-up ideas</p>
          <ul className="mt-2 space-y-1.5 text-sm text-white/80">
            <li>• Which tasks would you happily hand over to AI?</li>
            <li>• Do you feel excited or worried about new technology?</li>
          </ul>
        </div>
      </div>
    </VisualFrame>
  );
}

function BattleVisual() {
  const dims = [
    ["Fluency and continuity", 21, 25],
    ["Grammar and sentences", 19, 25],
    ["Vocabulary and expression", 16, 20],
    ["Relevance and clarity", 18, 20],
    ["Response development", 8, 10],
  ] as const;
  return (
    <VisualFrame>
      <div className="rounded-2xl bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between">
          <p className="font-bold">Your score</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-streak-50 px-2.5 py-1 text-xs font-bold text-streak-700">
            <Trophy className="h-3.5 w-3.5" /> Personal best
          </span>
        </div>
        <p className="mt-2 text-5xl font-extrabold text-ink">
          82<span className="text-xl text-subtle">/100</span>
        </p>
        <div className="mt-5 space-y-3">
          {dims.map(([label, score, max]) => (
            <div key={label}>
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">{label}</span>
                <span className="font-semibold">
                  {score}/{max}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface-muted">
                <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(score / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Timer className="h-4 w-4" /> 30-second answer · Pronunciation is never guessed from text
        </p>
      </div>
    </VisualFrame>
  );
}

function CoachVisual() {
  return (
    <VisualFrame>
      <div className="space-y-3">
        {[
          ["Yesterday I go to market.", "Yesterday, I went to the market.", "Use the past tense for a completed action in the past."],
          ["I am working here since two years.", "I have been working here for two years.", "Use “have been working” for an activity that began in the past and continues now."],
        ].map(([before, after, why]) => (
          <div key={before} className="rounded-2xl bg-surface p-5 shadow-card">
            <p className="text-sm text-muted line-through decoration-danger-500/60">{before}</p>
            <p className="mt-1.5 font-semibold text-ink">{after}</p>
            <p className="mt-3 rounded-xl bg-lavender px-3 py-2 text-sm text-ink-soft">{why}</p>
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}

function ProgressVisual() {
  const week = [12, 8, 15, 5, 18, 10, 14];
  return (
    <VisualFrame>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-surface p-5 shadow-card sm:col-span-2">
          <p className="text-sm font-semibold text-muted">Speaking minutes this week</p>
          <div className="mt-4 flex h-28 items-end gap-2">
            {week.map((v, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <div className="w-full rounded-t-lg bg-brand-500" style={{ height: `${(v / 18) * 80}%` }} />
                <span className="text-[11px] text-subtle">{"MTWTFSS"[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-surface p-5 shadow-card">
          <Flame className="h-6 w-6 fill-streak-400 text-streak-600" />
          <p className="mt-2 text-2xl font-extrabold">12 days</p>
          <p className="text-sm text-muted">Current streak</p>
        </div>
        <div className="rounded-2xl bg-surface p-5 shadow-card">
          <CalendarCheck className="h-6 w-6 text-success-600" />
          <p className="mt-2 text-2xl font-extrabold">Brave Speaker</p>
          <p className="text-sm text-muted">Level 2</p>
        </div>
      </div>
    </VisualFrame>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-bold text-ink">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-muted hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
