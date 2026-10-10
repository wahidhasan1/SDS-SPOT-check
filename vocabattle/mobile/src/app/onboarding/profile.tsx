import { getCalendars } from 'expo-localization';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Chip, ProgressBar, Row, Screen, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { DAILY_TARGETS, GOALS, IELTS_BANDS, LANGUAGES } from '@/lib/options';
import { validUsername } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';

function suggestUsername(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'learner';
  return `${base}${Math.floor(100 + Math.random() * 900)}`;
}

/** Onboarding step 1: profile, language, goals and daily target. Proficiency is NOT asked — it is assessed next. */
export default function ProfileSetup() {
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? suggestUsername(profile?.display_name ?? ''));
  const [check, setCheck] = useState<{ username: string; available: boolean } | null>(null);
  const available = check && check.username === username ? check.available : null;
  const [language, setLanguage] = useState(profile?.interface_language ?? 'en');
  const [goals, setGoals] = useState<string[]>(profile?.learning_goals ?? []);
  const [band, setBand] = useState<number | null>(profile?.ielts_target_band ?? null);
  const [examDate, setExamDate] = useState(profile?.ielts_exam_date ?? '');
  const [target, setTarget] = useState(profile?.daily_goal_xp ?? 50);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!validUsername(username)) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api.isUsernameAvailable(username).then((ok) => { if (!cancelled) setCheck({ username, available: ok }); }).catch(() => {});
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username]);

  const ielts = goals.includes('ielts');
  const toggleGoal = (id: string) => setGoals((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  async function submit() {
    setError(null);
    if (!displayName.trim()) return setError('Please enter a display name.');
    if (!validUsername(username)) return setError('Usernames use 3–20 letters, numbers or underscores.');
    if (available === false) return setError('That username is taken. Try another.');
    if (goals.length === 0) return setError('Pick at least one learning goal.');
    if (ielts && examDate && !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return setError('Enter the exam date as YYYY-MM-DD.');
    setBusy(true);
    try {
      await api.completeProfileSetup({
        displayName, username, language, goals, dailyGoalXp: target,
        ieltsBand: ielts ? band : null, ieltsDate: ielts && examDate ? examDate : null,
        timezone: getCalendars()[0]?.timeZone ?? 'UTC',
      });
      await refreshProfile();
      router.replace('/onboarding/assessment-intro');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Set up your profile" subtitle="Step 1 of 2" footer={<Button testID="profile-continue" title="Continue" size="lg" loading={busy} onPress={submit} />}>
      <ProgressBar value={0.5} />
      {error ? <Banner tone="danger" message={error} /> : null}
      <TextField testID="profile-display-name" label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={40} />
      <TextField
        testID="profile-username"
        label="Username"
        value={username}
        onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
        autoCapitalize="none"
        maxLength={20}
        error={username && !validUsername(username) ? '3–20 letters, numbers or underscores.' : available === false ? 'Already taken.' : null}
        hint={available ? 'Available ✓ — shown on leaderboards. Battles stay anonymous unless you choose otherwise.' : 'Shown on leaderboards.'}
      />

      <View style={{ gap: Spacing.sm }}>
        <Text variant="h3">Interface language</Text>
        <Text variant="small" color="textMuted">Also used for translations in the reading assistant.</Text>
        <Row wrap>
          {LANGUAGES.map((l) => <Chip key={l.code} label={l.label} selected={language === l.code} onPress={() => setLanguage(l.code)} />)}
        </Row>
      </View>

      <View style={{ gap: Spacing.sm }}>
        <Text variant="h3">What are your goals?</Text>
        <Row wrap>
          {GOALS.map((g) => <Chip key={g.id} label={g.label} icon={g.icon} selected={goals.includes(g.id)} onPress={() => toggleGoal(g.id)} />)}
        </Row>
      </View>

      {ielts ? (
        <View style={{ gap: Spacing.sm }}>
          <Text variant="h3">IELTS target</Text>
          <Row wrap>
            {IELTS_BANDS.map((b) => <Chip key={b} label={b.toFixed(1)} selected={band === b} onPress={() => setBand(band === b ? null : b)} />)}
          </Row>
          <TextField label="Exam date (optional)" placeholder="YYYY-MM-DD" value={examDate} onChangeText={setExamDate} maxLength={10} />
        </View>
      ) : null}

      <View style={{ gap: Spacing.sm }}>
        <Text variant="h3">Daily learning target</Text>
        <Row wrap>
          {DAILY_TARGETS.map((d) => <Chip key={d.xp} label={`${d.label} · ${d.xp} XP`} selected={target === d.xp} onPress={() => setTarget(d.xp)} />)}
        </Row>
        <Text variant="small" color="textMuted">{DAILY_TARGETS.find((d) => d.xp === target)?.detail}. You can change this any time.</Text>
      </View>
    </Screen>
  );
}
