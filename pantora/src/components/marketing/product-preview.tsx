import { ArrowRight, Flame, Mic, PhoneOff, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

/** Illustrative mock of the Pantora call screen used on the landing page. */
export function ProductPreview() {
  const bars = [10, 18, 28, 16, 34, 22, 40, 26, 18, 30, 14, 24, 36, 20, 12, 26, 32, 16];
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-label="Preview of a Pantora practice session" role="img">
      <div className="relative rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-3 shadow-pop backdrop-blur-sm">
        <div className="rounded-[1.4rem] bg-surface p-5 text-ink">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-bold text-success-700">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" /> Connected
            </span>
            <span className="font-mono text-sm font-semibold text-muted tabular-nums">06:42</span>
          </div>
          <div className="mt-5 flex flex-col items-center text-center">
            <div className="relative">
              <span className="absolute inset-0 animate-ping-slow rounded-full bg-brand-300/50" />
              <Avatar name="Amara" avatar="coral" size="lg" className="relative h-20 w-20 text-3xl" />
            </div>
            <p className="mt-3 font-bold">Amara</p>
            <p className="text-xs text-muted">Intermediate · Free Talk</p>
          </div>
          <div className="mt-4 flex h-12 items-end justify-center gap-1" aria-hidden>
            {bars.map((h, i) => (
              <span key={i} className="w-1.5 rounded-full bg-brand-400" style={{ height: h }} />
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-lavender p-3.5">
            <p className="text-[11px] font-bold tracking-wide text-brand-700 uppercase">Topic · My Ideal Weekend</p>
            <p className="mt-1 text-sm font-semibold">Would you prefer a quiet weekend or an adventurous one?</p>
          </div>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-soft">
              <Mic className="h-5 w-5" />
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-600 text-white">
              <PhoneOff className="h-5 w-5" />
            </span>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-10 -left-4 w-64 animate-float rounded-2xl border border-line bg-surface p-4 text-ink shadow-pop sm:-left-10">
        <p className="flex items-center gap-1.5 text-xs font-bold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" /> Better sentence
        </p>
        <p className="mt-2 text-sm text-muted line-through decoration-danger-500/60">I am working here since two years.</p>
        <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold">
          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-600" />I have been working here for two years.
        </p>
      </div>

      <div className="absolute -top-5 -right-2 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-ink shadow-pop sm:-right-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-streak-50">
          <Flame className="h-5 w-5 fill-streak-400 text-streak-600" />
        </span>
        <span>
          <span className="block text-sm font-extrabold">7-day streak</span>
          <span className="block text-[11px] text-muted">+35 XP today</span>
        </span>
      </div>
    </div>
  );
}
