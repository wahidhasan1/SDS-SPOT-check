import { useState } from 'react';
import { router } from 'expo-router';
import { ACTIVITIES, LEARNING_GOALS } from '@fluentpath/shared';
import { Button, Chip, H2, Notice, P, Row, Screen } from '../src/components/ui';
import { api, errorMessage } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import type { Me } from '../src/lib/types';

export default function Onboarding() {
  const { me, setMe } = useAuth();
  const [goals, setGoals] = useState<string[]>([]);
  const [module, setModule] = useState<'academic' | 'general' | null>(null);
  const [acts, setActs] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (l: string[], s: (v: string[]) => void, id: string) => s(l.includes(id) ? l.filter((x) => x !== id) : [...l, id]);
  const finish = async (assess: boolean) => {
    if (!goals.length || !acts.length || confidence == null) return setError('Please choose at least one goal, one activity and your confidence level.');
    setBusy(true);
    try {
      const r = await api.put<{ me: Me }>('/api/profile/onboarding', { goals, preferredActivities: acts, confidence, ieltsModule: module });
      setMe(r.me);
      router.replace(assess ? '/assessment' : '/home');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <Screen>
      <H2>Hi {me?.profile.displayName}! What are your goals?</H2>
      <Row>{LEARNING_GOALS.map((g) => <Chip key={g.id} label={g.label} selected={goals.includes(g.id)} onPress={() => toggle(goals, setGoals, g.id)} />)}</Row>
      <H2>IELTS module</H2>
      <Row>
        <Chip label="Academic" selected={module === 'academic'} onPress={() => setModule('academic')} />
        <Chip label="General Training" selected={module === 'general'} onPress={() => setModule('general')} />
        <Chip label="Not now" selected={module === null} onPress={() => setModule(null)} />
      </Row>
      <H2>Favourite activities</H2>
      <Row>{ACTIVITIES.map((a) => <Chip key={a.id} label={a.label} selected={acts.includes(a.id)} onPress={() => toggle(acts, setActs, a.id)} />)}</Row>
      <H2>Your confidence in English</H2>
      <Row>{['Very low', 'Low', 'Medium', 'Good', 'Very good'].map((l, i) => <Chip key={l} label={l} selected={confidence === i + 1} onPress={() => setConfidence(i + 1)} />)}</Row>
      {error && <Notice tone="error" text={error} />}
      <P muted>Next, a 30-question assessment estimates your level (A1–C2). It is an estimate, not an official certificate.</P>
      <Button title="Start level assessment" onPress={() => finish(true)} loading={busy} />
      <Button title="Skip for now" variant="secondary" onPress={() => finish(false)} />
    </Screen>
  );
}
