import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ACTIVITIES, LANGUAGES, LEARNING_GOALS } from '@fluentpath/shared';
import { Logo } from '../../components/layout/Logo';
import { Alert, Button, ChoiceChip, Select } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { Me } from '../../lib/types';

const CONFIDENCE = [
  { v: 1, label: 'Very low', text: 'I find it hard to understand or say simple things.' },
  { v: 2, label: 'Low', text: 'I can handle basic everyday situations slowly.' },
  { v: 3, label: 'Medium', text: 'I can talk about familiar topics but make mistakes.' },
  { v: 4, label: 'Good', text: 'I communicate well in most situations.' },
  { v: 5, label: 'Very good', text: 'I am comfortable even in complex discussions.' },
];

export default function Onboarding() {
  const { me, setMe } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>(me?.profile.goals ?? []);
  const [ieltsModule, setIeltsModule] = useState<'academic' | 'general' | null>(me?.profile.ieltsModule ?? null);
  const [target, setTarget] = useState<string>(me?.profile.ieltsTargetBand ? String(me.profile.ieltsTargetBand) : '');
  const [examDate, setExamDate] = useState<string>(me?.profile.ieltsExamDate ?? '');
  const [activities, setActivities] = useState<string[]>(me?.profile.preferredActivities ?? []);
  const [confidence, setConfidence] = useState<number | null>(me?.profile.confidence ?? null);
  const [nativeLanguage, setNativeLanguage] = useState(me?.profile.nativeLanguage ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const wantsIelts = goals.includes('ielts') || goals.includes('study') || goals.includes('immigration');

  const steps = ['Goals', 'IELTS', 'Activities', 'Confidence'];
  const canNext = [goals.length > 0, true, activities.length > 0, confidence != null][step];

  const finish = async (thenAssess: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.put<{ me: Me }>('/api/profile/onboarding', {
        goals,
        preferredActivities: activities,
        confidence,
        ieltsModule,
        ieltsTargetBand: target ? Number(target) : null,
        ieltsExamDate: examDate || null,
        nativeLanguage: nativeLanguage || null,
        preferredLanguage: nativeLanguage || null,
      });
      setMe(r.me);
      nav(thenAssess ? '/assessment' : '/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-8 dark:from-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Logo to="/" />
          <span className="muted text-sm">Step {step + 1} of {steps.length}</span>
        </div>
        <div className="mb-6 flex gap-1.5" aria-hidden>
          {steps.map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-800'}`} />)}
        </div>
        <div className="card p-6 sm:p-8">
          {error && <Alert tone="error" className="mb-4">{error}</Alert>}
          {step === 0 && (
            <>
              <h1 className="text-2xl font-bold">Welcome, {me?.profile.displayName}! What are your goals?</h1>
              <p className="muted mt-1">Choose all that apply. This helps us recommend the right activities.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {LEARNING_GOALS.map((g) => <ChoiceChip key={g.id} selected={goals.includes(g.id)} onClick={() => toggle(goals, setGoals, g.id)}>{g.label}</ChoiceChip>)}
              </div>
              <div className="mt-6 max-w-xs">
                <Select label="Your first language (optional)" value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value)} hint="Used for translations in the book reader.">
                  <option value="">Prefer not to say</option>
                  {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                </Select>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold">IELTS preparation</h1>
              <p className="muted mt-1">{wantsIelts ? 'Which version of IELTS do you need?' : 'Are you also preparing for IELTS? You can change this later.'}</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                <ChoiceChip selected={ieltsModule === 'academic'} onClick={() => setIeltsModule('academic')}><strong className="block">Academic</strong><span className="muted text-xs">For university study and professional registration</span></ChoiceChip>
                <ChoiceChip selected={ieltsModule === 'general'} onClick={() => setIeltsModule('general')}><strong className="block">General Training</strong><span className="muted text-xs">For work, migration and secondary education</span></ChoiceChip>
                <ChoiceChip selected={ieltsModule === null} onClick={() => setIeltsModule(null)}><strong className="block">Not now</strong><span className="muted text-xs">I just want to improve my English</span></ChoiceChip>
              </div>
              {ieltsModule && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Select label="Target band (optional)" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">Not sure yet</option>
                    {[4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                  <div>
                    <label className="label" htmlFor="exam">Exam date (optional)</label>
                    <input id="exam" type="date" className="input" value={examDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExamDate(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold">How do you like to learn?</h1>
              <p className="muted mt-1">Pick your favourite activities.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {ACTIVITIES.map((a) => <ChoiceChip key={a.id} selected={activities.includes(a.id)} onClick={() => toggle(activities, setActivities, a.id)}>{a.label}</ChoiceChip>)}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h1 className="text-2xl font-bold">How confident do you feel in English?</h1>
              <p className="muted mt-1">Be honest — there is no wrong answer. Next, a short assessment will estimate your level.</p>
              <div className="mt-6 grid gap-2">
                {CONFIDENCE.map((c) => (
                  <ChoiceChip key={c.v} selected={confidence === c.v} onClick={() => setConfidence(c.v)}>
                    <strong>{c.label}</strong> <span className="muted">— {c.text}</span>
                  </ChoiceChip>
                ))}
              </div>
            </>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy}>Back</Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Continue</Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => finish(false)} disabled={!canNext} loading={busy}>Skip assessment for now</Button>
                <Button onClick={() => finish(true)} disabled={!canNext} loading={busy}>Start level assessment</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
