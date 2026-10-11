import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Banner, Button, Chip, Row, Screen, Text, TextField } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { errorMessage, toAppError } from '@/lib/errors';
import { AVATARS, DAILY_TARGETS, GOALS, IELTS_BANDS, LANGUAGES } from '@/lib/options';
import { validUsername } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';

/** Edit profile. Only presentation and preferences are editable — never level or stats. */
export default function ProfileEdit() {
  const { colors } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? '🦊');
  const [language, setLanguage] = useState(profile?.interface_language ?? 'en');
  const [goals, setGoals] = useState<string[]>(profile?.learning_goals ?? []);
  const [target, setTarget] = useState(profile?.daily_goal_xp ?? 50);
  const [band, setBand] = useState<number | null>(profile?.ielts_target_band ? Number(profile.ielts_target_band) : null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.updateProfile(profile!.id, {
      display_name: name.trim(), username, avatar, interface_language: language, learning_goals: goals, daily_goal_xp: target, ielts_target_band: band,
    }),
    onSuccess: async () => { await refreshProfile(); router.back(); },
    onError: (e) => setError(toAppError(e).message.includes('profiles_username_lower_idx') ? 'That username is taken.' : errorMessage(e)),
  });

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError('Display name cannot be empty.');
    if (!validUsername(username)) return setError('Usernames use 3–20 letters, numbers or underscores.');
    save.mutate();
  };

  return (
    <Screen title="Edit profile" back footer={<Button testID="profile-save" title="Save changes" size="lg" loading={save.isPending} onPress={submit} />}>
      {error ? <Banner tone="danger" message={error} /> : null}
      <Text variant="h3">Avatar</Text>
      <Row wrap>
        {AVATARS.map((a) => (
          <Pressable key={a} onPress={() => setAvatar(a)} accessibilityRole="radio" accessibilityState={{ checked: avatar === a }} accessibilityLabel={`Avatar ${a}`}
            style={{ width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center',
              backgroundColor: avatar === a ? colors.primarySoft : colors.surface, borderWidth: 2, borderColor: avatar === a ? colors.primary : colors.border }}>
            <Text style={{ fontSize: 24, lineHeight: 30 }}>{a}</Text>
          </Pressable>
        ))}
      </Row>
      <TextField testID="edit-display-name" label="Display name" value={name} onChangeText={setName} maxLength={40} />
      <TextField label="Username" value={username} onChangeText={(t) => setUsername(t.replace(/\s/g, ''))} autoCapitalize="none" maxLength={20} />
      <View style={{ gap: Spacing.sm }}>
        <Text variant="h3">Interface language</Text>
        <Row wrap>{LANGUAGES.map((l) => <Chip key={l.code} label={l.label} selected={language === l.code} onPress={() => setLanguage(l.code)} />)}</Row>
        <Text variant="small" color="textFaint">The interface is currently in English; your language is used for translations (reading assistant, Phase 2).</Text>
      </View>
      <View style={{ gap: Spacing.sm }}>
        <Text variant="h3">Goals</Text>
        <Row wrap>{GOALS.map((g) => <Chip key={g.id} label={g.label} icon={g.icon} selected={goals.includes(g.id)} onPress={() => setGoals((x) => x.includes(g.id) ? x.filter((y) => y !== g.id) : [...x, g.id])} />)}</Row>
      </View>
      <View style={{ gap: Spacing.sm }}>
        <Text variant="h3">Daily target</Text>
        <Row wrap>{DAILY_TARGETS.map((d) => <Chip key={d.xp} label={`${d.label} · ${d.xp} XP`} selected={target === d.xp} onPress={() => setTarget(d.xp)} />)}</Row>
      </View>
      <View style={{ gap: Spacing.sm }}>
        <Text variant="h3">IELTS target band</Text>
        <Row wrap>{IELTS_BANDS.map((b) => <Chip key={b} label={b.toFixed(1)} selected={band === b} onPress={() => setBand(band === b ? null : b)} />)}</Row>
      </View>
      <Banner tone="info" message="Your proficiency level, battle rating and statistics are calculated by the server and can't be edited." />
    </Screen>
  );
}
