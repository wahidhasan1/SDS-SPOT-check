import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CEFR_INFO, LANGUAGES, LEARNING_GOALS, ACTIVITIES } from '@fluentpath/shared';
import { LevelNote } from '../../components/learning/Disclaimers';
import { Alert, Badge, Button, Card, CardHeader, ChoiceChip, Input, PageHeader, Select, Textarea, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth, useMe } from '../../lib/auth';
import { formatDate } from '../../lib/format';
import type { Me } from '../../lib/types';
import { useApi } from '../../lib/useApi';

export default function Profile() {
  const me = useMe();
  const { setMe } = useAuth();
  const toast = useToast();
  const p = me.profile;
  const [form, setForm] = useState({
    displayName: p.displayName,
    bio: p.bio,
    nativeLanguage: p.nativeLanguage ?? '',
    preferredLanguage: p.preferredLanguage ?? '',
    goals: p.goals,
    preferredActivities: p.preferredActivities,
    ieltsModule: p.ieltsModule ?? '',
    ieltsTargetBand: p.ieltsTargetBand ? String(p.ieltsTargetBand) : '',
    ieltsExamDate: p.ieltsExamDate ?? '',
    timezone: p.timezone,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ach = useApi<{ achievements: { code: string; title: string; description: string; earnedAt: string | null }[] }>('/api/achievements');
  const toggle = (k: 'goals' | 'preferredActivities', id: string) => setForm({ ...form, [k]: form[k].includes(id) ? form[k].filter((x) => x !== id) : [...form[k], id] });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (form.displayName.trim().length < 2) return setError('Display name must be at least 2 characters.');
    setBusy(true);
    setError(null);
    try {
      const r = await api.patch<{ me: Me }>('/api/profile', {
        displayName: form.displayName.trim(),
        bio: form.bio,
        nativeLanguage: form.nativeLanguage || null,
        preferredLanguage: form.preferredLanguage || null,
        goals: form.goals,
        preferredActivities: form.preferredActivities,
        ieltsModule: form.ieltsModule || null,
        ieltsTargetBand: form.ieltsTargetBand ? Number(form.ieltsTargetBand) : null,
        ieltsExamDate: form.ieltsExamDate || null,
        timezone: form.timezone,
      });
      setMe(r.me);
      toast('Profile saved');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const earned = ach.data?.achievements.filter((a) => a.earnedAt) ?? [];
  return (
    <div>
      <PageHeader title="Your profile" description="Your profile is private. Voice and battle partners only ever see a random anonymous name." />
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={save} className="space-y-6 lg:col-span-2">
          {error && <Alert tone="error">{error}</Alert>}
          <Card>
            <CardHeader title="About you" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Input label="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} maxLength={40} />
              <Input label="Email" value={me.email} disabled hint="Your email is never shown to other learners." />
              <div className="sm:col-span-2"><Textarea label="Bio (optional)" rows={2} maxLength={300} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
              <Select label="First language" value={form.nativeLanguage} onChange={(e) => setForm({ ...form, nativeLanguage: e.target.value })}>
                <option value="">Prefer not to say</option>
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </Select>
              <Select label="Translate words into" value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })} hint="Used for AI translations in the book reader.">
                <option value="">No translation</option>
                {LANGUAGES.filter((l) => l !== 'Other').map((l) => <option key={l}>{l}</option>)}
              </Select>
              <Input label="Time zone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} hint="Used to count study days for your streak (e.g. Europe/London)." />
            </div>
          </Card>
          <Card>
            <CardHeader title="Learning goals" />
            <div className="space-y-4 p-5">
              <div className="grid gap-2 sm:grid-cols-2">{LEARNING_GOALS.map((g) => <ChoiceChip key={g.id} selected={form.goals.includes(g.id)} onClick={() => toggle('goals', g.id)}>{g.label}</ChoiceChip>)}</div>
              <div><div className="label">Favourite activities</div><div className="grid gap-2 sm:grid-cols-2">{ACTIVITIES.map((a) => <ChoiceChip key={a.id} selected={form.preferredActivities.includes(a.id)} onClick={() => toggle('preferredActivities', a.id)}>{a.label}</ChoiceChip>)}</div></div>
            </div>
          </Card>
          <Card>
            <CardHeader title="IELTS" />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <Select label="Module" value={form.ieltsModule} onChange={(e) => setForm({ ...form, ieltsModule: e.target.value })}>
                <option value="">Not preparing</option>
                <option value="academic">Academic</option>
                <option value="general">General Training</option>
              </Select>
              <Select label="Target band" value={form.ieltsTargetBand} onChange={(e) => setForm({ ...form, ieltsTargetBand: e.target.value })}>
                <option value="">Not set</option>
                {[4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
              <div><label className="label" htmlFor="examdate">Exam date</label><input id="examdate" type="date" className="input" value={form.ieltsExamDate} onChange={(e) => setForm({ ...form, ieltsExamDate: e.target.value })} /></div>
            </div>
          </Card>
          <div className="flex justify-end"><Button type="submit" loading={busy}>Save profile</Button></div>
        </form>
        <div className="space-y-6">
          <Card className="p-5">
            <div className="muted text-sm">Estimated English level</div>
            {p.cefrLevel ? (
              <>
                <div className="mt-1 flex items-baseline gap-2"><span className="text-4xl font-bold text-brand-600">{p.cefrLevel}</span><span>{CEFR_INFO[p.cefrLevel].name}</span></div>
                <p className="muted mt-1 text-xs">Assessed {formatDate(p.cefrAssessedAt)}</p>
              </>
            ) : <div className="mt-1 font-semibold">Not assessed yet</div>}
            <Link to="/assessment" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{p.cefrLevel ? 'Retake the assessment' : 'Take the assessment'}</Link>
            <div className="mt-3"><LevelNote /></div>
          </Card>
          <Card className="p-5">
            <div className="muted text-sm">Plan</div>
            <div className="mt-1 flex items-center gap-2 text-lg font-semibold capitalize">{me.plan}{me.subscription?.provider === 'development' && <Badge tone="amber">Development mode</Badge>}</div>
            <Link to="/premium" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Manage plan</Link>
            <p className="muted mt-3 text-xs">Member since {formatDate(me.createdAt)}</p>
          </Card>
          <Card id="achievements">
            <CardHeader title="Achievements" subtitle={`${earned.length} of ${ach.data?.achievements.length ?? 0} earned`} />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {earned.slice(0, 8).map((a) => <li key={a.code} className="px-5 py-2.5 text-sm"><div className="font-medium">{a.title}</div><div className="muted text-xs">{a.description}</div></li>)}
              {earned.length === 0 && <li className="muted px-5 py-3 text-sm">Complete activities to earn achievements.</li>}
            </ul>
            <div className="px-5 py-3"><Link className="text-sm text-brand-700 hover:underline dark:text-brand-300" to="/progress#achievements">See all</Link></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
