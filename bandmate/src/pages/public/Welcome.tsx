import { Link } from 'react-router-dom'
import { GraduationCap, Mic, ScanText, ShieldCheck, Swords, UserRoundX } from 'lucide-react'
import { Logo, LogoMark } from '../../components/Logo'
import { appName } from '../../lib/session'

const FEATURES = [
  { icon: Mic, title: 'Speak with real learners', body: 'Get matched with another English learner for a live voice call. You stay anonymous.', tone: 'text-talk bg-talk-soft' },
  { icon: GraduationCap, title: 'Full IELTS preparation', body: 'Reading, Listening, Writing and Speaking practice for Academic and General Training, plus mock tests.', tone: 'text-primary bg-primary-soft' },
  { icon: ScanText, title: 'Read anything with help', body: 'Take a photo of a page and tap any word to see what it means in that sentence.', tone: 'text-good bg-good-soft' },
  { icon: Swords, title: 'Vocabulary battles', body: 'Quick, fair word battles against other learners. Learn while you play.', tone: 'text-warn bg-warn-soft' },
]

export default function Welcome() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <div className="flex gap-2">
          <Link to="/login" className="btn btn-ghost">Log in</Link>
          <Link to="/signup" className="btn btn-primary hidden sm:inline-flex">Create free account</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 md:grid-cols-[1.1fr_0.9fr] md:pt-16">
        <div className="fade-up">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">IELTS · Speaking · Vocabulary</p>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-balance sm:text-5xl">Practise English with real people. Prepare for IELTS with a plan.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            {appName()} brings together IELTS preparation, anonymous speaking practice with other learners, and smart reading help — in one simple app.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/signup" className="btn btn-primary btn-lg">Start free</Link>
            <Link to="/login" className="btn btn-secondary btn-lg">I have an account</Link>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <UserRoundX className="size-4" /> Partners never see your real name, email or phone number.
          </p>
        </div>
        <div className="relative mx-auto w-full max-w-sm fade-up" aria-hidden="true">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <span className="relative grid size-14 place-items-center rounded-full bg-talk text-white">
                <span className="absolute inset-0 rounded-full bg-talk ripple" />
                <Mic className="relative size-6" />
              </span>
              <div>
                <p className="font-bold">Find a speaking partner</p>
                <p className="text-sm text-muted">Matched by level and topic</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {['Reading', 'Listening', 'Writing', 'Speaking'].map((s, i) => (
                <div key={s}>
                  <div className="mb-1 flex justify-between text-sm font-semibold"><span>{s}</span><span className="text-muted">practice</span></div>
                  <div className="h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary/70" style={{ width: `${35 + i * 15}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-faint">Illustration</p>
          </div>
          <div className="absolute -bottom-5 -left-5 hidden sm:block"><LogoMark size={56} /></div>
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl p-1">
              <span className={`grid size-11 place-items-center rounded-xl ${f.tone}`}><f.icon className="size-5" /></span>
              <p className="mt-3 font-bold">{f.title}</p>
              <p className="mt-1 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-primary-soft p-6 sm:flex-row sm:items-center sm:p-8">
          <ShieldCheck className="size-8 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="font-bold">Safe by design</p>
            <p className="text-sm text-muted">Report or block anyone in one tap. Calls are never recorded. Voice calls are for adults (18+).</p>
          </div>
          <Link to="/guidelines" className="btn btn-secondary">Community guidelines</Link>
        </div>
        <p className="mt-8 text-center text-xs text-faint">
          {appName()} is an independent practice app and is not affiliated with or endorsed by the IELTS partners. Practice scores are estimates, not official results. ·{' '}
          <Link to="/privacy" className="underline">Privacy</Link> · <Link to="/terms" className="underline">Terms</Link>
        </p>
      </section>
    </div>
  )
}
