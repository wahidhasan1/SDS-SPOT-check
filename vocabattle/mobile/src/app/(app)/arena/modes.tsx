import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Badge, Card, ErrorView, Icon, LoadingView, Row, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { BATTLE_MODE_KEY } from '@/lib/storage-keys';

/** Battle mode selection. */
export default function BattleModes() {
  const lobby = useQuery({ queryKey: ['battle-lobby'], queryFn: api.getBattleLobby });
  if (lobby.isPending) return <LoadingView />;
  if (lobby.error) return <Screen title="Battle modes" back><ErrorView error={lobby.error} onRetry={() => lobby.refetch()} /></Screen>;

  return (
    <Screen title="Battle modes" subtitle="Every mode uses the same fair, server-side scoring." back>
      {lobby.data!.modes.map((m) => (
        <Card key={m.id} testID={`mode-${m.id}`} accessibilityLabel={m.name}
          onPress={m.enabled ? async () => {
            await AsyncStorage.setItem(BATTLE_MODE_KEY, m.id).catch(() => {});
            router.back();
          } : undefined}
          tone={m.enabled ? 'surface' : 'alt'}>
          <Row gap={Spacing.md} style={{ alignItems: 'flex-start' }}>
            <Icon name={m.icon} color={m.enabled ? 'primary' : 'textFaint'} size={26} />
            <View style={{ flex: 1, gap: 4 }}>
              <Row><Text variant="bodyStrong" color={m.enabled ? 'text' : 'textMuted'}>{m.name}</Text>
                {!m.enabled ? <Badge label={m.phase ? `Phase ${m.phase}` : 'Unavailable'} tone="muted" /> : null}</Row>
              <Text variant="small" color="textMuted">{m.description}</Text>
            </View>
          </Row>
        </Card>
      ))}
      <Text variant="small" color="textFaint">Points: 100 for a correct answer plus up to 50 for speed. Time is measured by the server, not your device.</Text>
    </Screen>
  );
}
