import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Banner, Button, Card, Chip, Row, Screen, SectionHeader, Text, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

/** Privacy settings, opponent preference and blocked users. */
export default function Privacy() {
  const qc = useQueryClient();
  const { profile, refreshProfile } = useAuth();
  const ent = useQuery({ queryKey: ['entitlements'], queryFn: api.getEntitlements });
  const blocked = useQuery({ queryKey: ['blocked'], queryFn: api.getBlockedUsers });
  const update = useMutation({ mutationFn: (patch: Partial<Profile>) => api.updateProfile(profile!.id, patch), onSuccess: () => refreshProfile() });
  const unblock = useMutation({ mutationFn: api.unblockUser, onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked'] }) });
  if (!profile) return null;
  const premium = ent.data?.plan === 'premium';

  return (
    <Screen title="Privacy" back>
      {update.error ? <Banner tone="danger" message={errorMessage(update.error)} /> : null}
      <SectionHeader title="What others can see" />
      <Card>
        <ToggleRow title="Show me on leaderboards" subtitle="Your username, avatar, level and battle rating." value={profile.show_on_leaderboard} onChange={(v) => update.mutate({ show_on_leaderboard: v })} />
        <ToggleRow title="Reveal my username in battles" subtitle="Off: opponents see a temporary pseudonym like “SilentOwl42”." value={profile.show_identity_in_battles} onChange={(v) => update.mutate({ show_identity_in_battles: v })} />
        <ToggleRow title="Show my learning streak" value={profile.show_streak_publicly} onChange={(v) => update.mutate({ show_streak_publicly: v })} />
        <ToggleRow title="Show my badges" value={profile.show_badges_publicly} onChange={(v) => update.mutate({ show_badges_publicly: v })} />
      </Card>
      <Text variant="small" color="textMuted">Your email address, gender and other private details are never shown to other users.</Text>

      <SectionHeader title="Battle opponents" />
      <Card>
        <Text variant="bodyStrong">Your gender (optional, private)</Text>
        <Text variant="small" color="textMuted">Only used so other premium learners’ opponent preferences can be respected. Never displayed.</Text>
        <Row wrap>
          {([['female', 'Female'], ['male', 'Male'], ['nonbinary', 'Non-binary'], ['prefer_not_to_say', 'Prefer not to say']] as const).map(([v, l]) => (
            <Chip key={v} label={l} selected={profile.gender === v} onPress={() => update.mutate({ gender: profile.gender === v ? null : v })} />
          ))}
        </Row>
        <View style={{ height: Spacing.sm }} />
        <Text variant="bodyStrong">Preferred opponents {premium ? '' : '· Premium'}</Text>
        <Text variant="small" color="textMuted">Matching depends on who is available, so a preference can make searches longer. No match is guaranteed.</Text>
        <Row wrap>
          {([['any', 'Anyone'], ['female', 'Female'], ['male', 'Male']] as const).map(([v, l]) => (
            <Chip key={v} label={l} selected={profile.battle_gender_preference === v}
              onPress={() => (premium || v === 'any' ? update.mutate({ battle_gender_preference: v }) : router.push('/subscription'))} />
          ))}
        </Row>
        {!premium && profile.battle_gender_preference !== 'any' ? <Text variant="small" color="warning">Saved, but only applied while you have Premium.</Text> : null}
      </Card>

      <SectionHeader title="Blocked users" />
      <Card>
        {blocked.data?.length ? blocked.data.map((b) => (
          <Row key={b.id} style={{ justifyContent: 'space-between' }}>
            <View>
              <Text variant="bodyStrong">{b.label}</Text>
              <Text variant="tiny" color="textFaint">Blocked {new Date(b.created_at).toLocaleDateString()}</Text>
            </View>
            <Button title="Unblock" size="sm" variant="secondary" loading={unblock.isPending} onPress={() => unblock.mutate(b.id)} />
          </Row>
        )) : <Text color="textMuted">You haven’t blocked anyone. You can block an opponent from the battle results screen.</Text>}
      </Card>

      <SectionHeader title="Your data" />
      <Card>
        <Text variant="small" color="textMuted">Reading pages and photos (Phase 2) will be private to you and deletable at any time. Deleting your account permanently removes all your data.</Text>
        <Button title="Account & deletion" variant="secondary" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/settings/account')} />
      </Card>
    </Screen>
  );
}
