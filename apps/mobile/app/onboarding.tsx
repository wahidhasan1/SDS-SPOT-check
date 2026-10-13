import { useState } from 'react';
import { router } from 'expo-router';
import { LEARNING_GOAL_LABELS, LEARNING_GOALS, TARGET_BANDS, type LearningGoal, type TestType } from '@app/shared';
import { api, errorMessage } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { Button, Chip, ErrorText, H1, H2, Option, P, Row, Screen } from '../src/components/ui';

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const [goals, setGoals] = useState<LearningGoal[]>(user?.goals ?? []);
  const [testType, setTestType] = useState<TestType>(user?.testType ?? 'none');
  const [target, setTarget] = useState<number | null>(user?.targetBand ?? 6.5);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (g: LearningGoal) => setGoals((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]));
  const save = async () => {
    try {
      setUser(await api.patch('/me', { goals, testType, targetBand: testType === 'none' ? null : target, onboardingCompleted: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
      router.replace('/assessment');
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Screen>
      <H1>Welcome, {user?.displayName}!</H1>
      <P muted>Partners will see you as {user?.anonName}. Let's personalise your learning.</P>
      <H2>Your goals</H2>
      {LEARNING_GOALS.map((g) => <Option key={g} label={LEARNING_GOAL_LABELS[g]} selected={goals.includes(g)} onPress={() => { toggle(g); if (g === 'ielts_academic') setTestType('academic'); if (g === 'ielts_general') setTestType('general'); }} />)}
      <H2>IELTS test</H2>
      <Row wrap>
        <Chip label="Academic" on={testType === 'academic'} onPress={() => setTestType('academic')} />
        <Chip label="General Training" on={testType === 'general'} onPress={() => setTestType('general')} />
        <Chip label="Not taking IELTS" on={testType === 'none'} onPress={() => setTestType('none')} />
      </Row>
      {testType !== 'none' && (
        <>
          <H2>Target band</H2>
          <Row wrap>{TARGET_BANDS.map((b) => <Chip key={b} label={String(b)} on={target === b} onPress={() => setTarget(b)} />)}</Row>
        </>
      )}
      <ErrorText error={err} />
      <Button title="Continue to placement test" disabled={!goals.length} onPress={save} />
    </Screen>
  );
}
