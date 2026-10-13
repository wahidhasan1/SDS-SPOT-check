import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Briefcase, Check, GraduationCap } from 'lucide-react'
import { CALL_TOPICS, CEFR_INFO, TARGET_BANDS, type Cefr } from '../../../shared/config'
import { Logo } from '../../components/Logo'
import { Field, LevelBadge, Progress, Spinner, cx, toast } from '../../components/ui'
import { Assessment, type AssessmentResult } from '../../features/assessment/Assessment'
import { errorMessage, patch } from '../../lib/api'
import { useRefreshMe, useUser } from '../../lib/session'

export const LANGUAGES = ['Bengali', 'Hindi', 'Urdu', 'Nepali', 'Arabic', 'Persian', 'Turkish', 'Chinese', 'Japanese', 'Korean', 'Vietnamese', 'Thai', 'Indonesian', 'Malay', 'Filipino', 'Tamil', 'Telugu', 'Punjabi', 'Sinhala', 'Spanish', 'Portuguese', 'French', 'German', 'Italian', 'Russian', 'Ukrainian', 'Polish', 'Swahili', 'Amharic', 'Other']

const GOALS = [
  { id: 'ielts', icon: GraduationCap, title: 'Prepare for IELTS', body: 'Practice tests, feedback and a study plan for your target band.' },
  { id: 'general', icon: BookOpen, title: 'Improve my English', body: 'Vocabulary, grammar and conversation for everyday life.' },
  { id: 'work', icon: Briefcase, title: 'English for work', body: 'Speak confidently in interviews and meetings.' },
] as const

const STEPS = ['goals', 'assessment', 'interests'] as const

export default function Onboarding() {
  const me = useUser()
  const refresh = useRefreshMe()
  const nav = useNavigate()
  const step = me.profile.onboardingStep === 'done' ? 'interests' : me.profile.onboardingStep
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [testStarted, setTestStarted] = useState(false)

  const save = async (body: Record<string, unknown>) => {
    try {
      await patch('/me/profile', { ...body, timezoneOffset: -new Date().getTimezoneOffset() })
      await refresh()
      return true
    } catch (e) {
      toast(errorMessage(e), 'bad')
      return false
    }
  }

  const stepIndex = result && step === 'assessment' ? 1.5 : STEPS.indexOf(step as (typeof STEPS)[number])

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
        <Logo />
        <span className="text-sm font-semibold text-muted">Step {Math.floor(stepIndex) + 1} of 3</span>
      </header>
      <div className="mx-auto max-w-2xl px-5 pb-16">
        <Progress value={stepIndex + 1} max={3} className="mb-8" label="Setup progress" />
        {step === 'goals' && <Goals onSave={save} />}
        {step === 'assessment' && !result && !testStarted && (
          <div className="fade-up">
            <h1 className="h1">Let’s find your English level</h1>
            <p className="mt-2 text-muted">A short, adaptive check of about 22 questions: vocabulary, grammar, reading and listening. It takes 8–12 minutes. Questions get easier or harder depending on your answers.</p>
            <ul className="mt-5 space-y-2 text-[15px]">
              {['Use headphones or turn your sound on for listening questions.', 'Don’t use a dictionary — we want a fair picture of your level.', 'Your level helps us match you with speaking partners and choose lessons. It is an estimate, not an official certificate.'].map((t) => (
                <li key={t} className="flex gap-2"><Check className="mt-0.5 size-5 shrink-0 text-good" /> {t}</li>
              ))}
            </ul>
            <button className="btn btn-primary btn-lg mt-8" onClick={() => setTestStarted(true)}>Start the level check</button>
          </div>
        )}
        {step === 'assessment' && !result && testStarted && <Assessment onDone={setResult} />}
        {step === 'assessment' && result && <Result result={result} onNext={() => save({ onboardingStep: 'interests' })} />}
        {step === 'interests' && (
          <Interests
            onSave={async (body) => {
              if (await save({ ...body, onboardingStep: 'done' })) nav('/', { replace: true })
            }}
          />
        )}
      </div>
    </div>
  )
}

function Goals({ onSave }: { onSave: (b: Record<string, unknown>) => Promise<boolean> }) {
  const me = useUser()
  const [goal, setGoal] = useState<string>(me.profile.goal ?? 'ielts')
  const [testType, setTestType] = useState<string>(me.profile.testType ?? 'academic')
  const [band, setBand] = useState<number>(me.profile.targetBand ?? 6.5)
  const [minutes, setMinutes] = useState<number>(me.profile.dailyMinutes ?? 20)
  const [lang, setLang] = useState<string>(me.profile.nativeLanguage ?? '')
  const [busy, setBusy] = useState(false)
  return (
    <div className="fade-up">
      <h1 className="h1">What do you want to achieve?</h1>
      <p className="mt-2 text-muted">You can change this later in your profile.</p>
      <div className="mt-6 grid gap-3" role="radiogroup" aria-label="Goal">
        {GOALS.map((g) => (
          <button key={g.id} role="radio" aria-checked={goal === g.id} onClick={() => setGoal(g.id)} className={cx('card flex items-center gap-4 p-4 text-left transition-colors', goal === g.id ? 'border-primary ring-3 ring-primary/15' : 'hover:border-primary/40')}>
            <span className={cx('grid size-12 shrink-0 place-items-center rounded-xl', goal === g.id ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted')}><g.icon className="size-6" /></span>
            <span><span className="block font-bold">{g.title}</span><span className="block text-sm text-muted">{g.body}</span></span>
          </button>
        ))}
      </div>

      {goal === 'ielts' && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Which IELTS test?">
            <div className="grid grid-cols-2 gap-2">
              {[['academic', 'Academic'], ['general_training', 'General Training']].map(([id, label]) => (
                <button key={id} onClick={() => setTestType(id)} className={cx('chip h-11 justify-center', testType === id && 'chip-on')}>{label}</button>
              ))}
            </div>
          </Field>
          <Field label="Target band" htmlFor="band">
            <select id="band" className="input" value={band} onChange={(e) => setBand(Number(e.target.value))}>
              {TARGET_BANDS.map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}
            </select>
          </Field>
        </div>
      )}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="How much time can you study each day?">
          <div className="flex flex-wrap gap-2">
            {[10, 20, 30, 60].map((m) => <button key={m} onClick={() => setMinutes(m)} className={cx('chip', minutes === m && 'chip-on')}>{m} min</button>)}
          </div>
        </Field>
        <Field label="Your first language" htmlFor="lang" hint="Used for translations of difficult words.">
          <select id="lang" className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">Choose…</option>
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
      </div>
      <button
        className="btn btn-primary btn-lg mt-8 w-full sm:w-auto"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await onSave({ goal, testType: goal === 'ielts' ? testType : null, targetBand: goal === 'ielts' ? band : null, dailyMinutes: minutes, nativeLanguage: lang || null, onboardingStep: 'assessment' })
          setBusy(false)
        }}
      >
        {busy && <Spinner className="size-4 text-on-primary" />} Continue
      </button>
    </div>
  )
}

function Result({ result, onNext }: { result: AssessmentResult; onNext: () => void }) {
  const info = CEFR_INFO[result.level as Cefr]
  return (
    <div className="fade-up text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-primary">Your estimated level</p>
      <p className="mt-3 text-6xl font-extrabold tracking-tight">{result.level}</p>
      <p className="mt-1 text-xl font-bold">{info.name}</p>
      <p className="mx-auto mt-2 max-w-md text-muted">{info.can}</p>
      <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-2 text-left">
        {Object.entries(result.sections).map(([s, v]) => (
          <div key={s} className="card p-3">
            <p className="text-sm font-semibold capitalize text-muted">{s}</p>
            <p className="text-lg font-bold">{v.correct} / {v.total} correct</p>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-5 max-w-md text-xs text-faint">This is an app estimate based on {Object.values(result.sections).reduce((n, s) => n + s.total, 0)} adaptive questions, not an official CEFR or IELTS result. You can retake it after 7 days, and it updates as you practise.</p>
      <button className="btn btn-primary btn-lg mt-8" onClick={onNext}>Continue</button>
    </div>
  )
}

function Interests({ onSave }: { onSave: (b: Record<string, unknown>) => Promise<void> }) {
  const me = useUser()
  const [topics, setTopics] = useState<string[]>(me.profile.interests)
  const [showLevel, setShowLevel] = useState(me.profile.showLevelToPartners)
  const [busy, setBusy] = useState(false)
  const choices = CALL_TOPICS.filter((t) => !['random', 'free'].includes(t.id))
  return (
    <div className="fade-up">
      <div className="mb-2"><LevelBadge level={me.profile.cefrLevel} /></div>
      <h1 className="h1">What do you like talking about?</h1>
      <p className="mt-2 text-muted">We’ll suggest these topics for speaking practice. Choose as many as you like.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {choices.map((t) => {
          const on = topics.includes(t.id)
          return (
            <button key={t.id} aria-pressed={on} onClick={() => setTopics(on ? topics.filter((x) => x !== t.id) : [...topics, t.id])} className={cx('chip', on && 'chip-on')}>
              {on && <Check className="size-4" />} {t.label}
            </button>
          )
        })}
      </div>
      <label className="card mt-6 flex cursor-pointer items-start gap-3 p-4">
        <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={showLevel} onChange={(e) => setShowLevel(e.target.checked)} />
        <span>
          <span className="block font-bold">Show my level to speaking partners</span>
          <span className="block text-sm text-muted">Partners see your anonymous name ({me.profile.anonName}) and, if you allow it, your level ({me.profile.cefrLevel}). Never your real name or email.</span>
        </span>
      </label>
      <button
        className="btn btn-primary btn-lg mt-8 w-full sm:w-auto"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await onSave({ interests: topics, showLevelToPartners: showLevel })
          setBusy(false)
        }}
      >
        {busy && <Spinner className="size-4 text-on-primary" />} Go to my dashboard
      </button>
    </div>
  )
}
