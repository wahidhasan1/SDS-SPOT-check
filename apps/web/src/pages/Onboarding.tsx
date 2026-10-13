import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEARNING_GOAL_LABELS, LEARNING_GOALS, TARGET_BANDS, type LearningGoal, type TestType } from '@app/shared';
import { APP_NAME, api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/hooks';

const INTERESTS = ['Travel', 'Technology', 'Food', 'Sport', 'Music', 'Films', 'Books', 'Business', 'Science', 'Education', 'Health', 'Environment'];
const LANGS = ['', 'Arabic', 'Bengali', 'Chinese', 'French', 'German', 'Hindi', 'Indonesian', 'Japanese', 'Korean', 'Persian', 'Portuguese', 'Russian', 'Spanish', 'Tamil', 'Thai', 'Turkish', 'Urdu', 'Vietnamese'];

export function OnboardingPage() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<LearningGoal[]>(user?.goals.length ? user.goals : []);
  const [testType, setTestType] = useState<TestType>(user?.testType ?? 'none');
  const [target, setTarget] = useState<number | null>(user?.targetBand ?? 6.5);
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [lang, setLang] = useState(user?.translationLanguage ?? '');
  const [err, setErr] = useState<string | null>(null);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = async (complete: boolean) => {
    try {
      const u = await api.patch<any>('/me', {
        goals,
        testType,
        targetBand: testType === 'none' ? null : target,
        interests,
        translationLanguage: lang || null,
        nativeLanguage: lang || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboardingCompleted: complete,
      });
      setUser(u);
      return true;
    } catch (e) {
      setErr(errorMessage(e));
      return false;
    }
  };

  const steps = [
    {
      title: `Welcome to ${APP_NAME}, ${user?.displayName}!`,
      body: (
        <div className="stack">
          <p>Let's personalise your learning in under two minutes. Then a short placement test will find your level, so practice and speaking partners match you.</p>
          <div className="card flat" style={{ background: 'var(--surface-2)' }}>
            <div className="row"><span style={{ fontSize: 28 }}>🎭</span><div><b>Your anonymous calling identity</b><div className="small muted">Speaking partners will see you as <b>{user?.anonName}</b>. You can change it later.</div></div></div>
          </div>
        </div>
      ),
      ok: true,
    },
    {
      title: 'What are your goals?',
      body: (
        <div className="grid cols-2">
          {LEARNING_GOALS.map((g) => (
            <button key={g} className={`option ${goals.includes(g) ? 'selected' : ''}`} onClick={() => {
              setGoals(toggle(goals, g));
              if (g === 'ielts_academic') setTestType('academic');
              if (g === 'ielts_general') setTestType('general');
            }}>
              {LEARNING_GOAL_LABELS[g]}
            </button>
          ))}
        </div>
      ),
      ok: goals.length > 0,
    },
    {
      title: 'Which IELTS test are you preparing for?',
      body: (
        <div className="stack">
          <div className="grid cols-3">
            {([['academic', 'IELTS Academic', 'University study and professional registration'], ['general', 'IELTS General Training', 'Work, migration and everyday life'], ['none', 'Not preparing for IELTS', 'General English improvement']] as const).map(([v, t, d]) => (
              <button key={v} className={`option ${testType === v ? 'selected' : ''}`} onClick={() => setTestType(v)} style={{ flexDirection: 'column' }}>
                <b>{t}</b><span className="small muted">{d}</span>
              </button>
            ))}
          </div>
          {testType !== 'none' && (
            <label className="field">
              Target band score
              <div className="row wrap">
                {TARGET_BANDS.map((b) => (
                  <button key={b} className={`chip ${target === b ? 'on' : ''}`} onClick={() => setTarget(b)}>{b}</button>
                ))}
              </div>
            </label>
          )}
        </div>
      ),
      ok: true,
    },
    {
      title: 'A little more about you (optional)',
      body: (
        <div className="stack">
          <div className="small muted">Conversation interests help us suggest call topics.</div>
          <div className="row wrap">
            {INTERESTS.map((i) => <button key={i} className={`chip ${interests.includes(i) ? 'on' : ''}`} onClick={() => setInterests(toggle(interests, i))}>{i}</button>)}
          </div>
          <label className="field">
            Translate words into
            <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map((l) => <option key={l} value={l}>{l || 'No translation'}</option>)}
            </select>
          </label>
        </div>
      ),
      ok: true,
    },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;
  return (
    <div className="auth-wrap">
      <div className="card pad-lg" style={{ maxWidth: 720, width: '100%' }}>
        <div className="row between mb">
          <span className="badge">Step {step + 1} of {steps.length + 1}</span>
          <span className="small muted">Next: placement test</span>
        </div>
        <h1>{s.title}</h1>
        {err && <div className="alert error mb">{err}</div>}
        {s.body}
        <div className="row between mt">
          <button className="btn secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          <button
            className="btn"
            disabled={!s.ok}
            onClick={async () => {
              if (!last) return setStep(step + 1);
              if (await save(true)) nav('/assessment');
            }}
          >
            {last ? 'Continue to placement test' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
