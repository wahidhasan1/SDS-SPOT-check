import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Banner, Button, Chip, Row, Screen, Text, TextField, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const REASONS = [
  { id: 'cheating', label: 'Cheating / automated answers' },
  { id: 'offensive_name', label: 'Offensive name or avatar' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'spam', label: 'Spam' },
  { id: 'other', label: 'Something else' },
];

/** Report an opponent. The report references the battle; the reporter never needs the opponent's account. */
export default function Report() {
  const { battle, alias } = useLocalSearchParams<{ battle: string; alias?: string }>();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const submit = useMutation({
    mutationFn: async () => {
      await api.reportOpponent(battle!, reason!, details.trim());
      if (alsoBlock) await api.blockOpponent(battle!);
    },
  });

  if (submit.isSuccess) {
    return (
      <Screen title="Report sent" back>
        <Banner tone="success" title="Thank you" message="Our moderators will review this match. We don't share who reported." />
        <Button title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen title={`Report ${alias ?? 'opponent'}`} subtitle="Reports are reviewed by moderators." back
      footer={<Button title="Send report" size="lg" disabled={!reason} loading={submit.isPending} onPress={() => submit.mutate()} />}>
      {submit.error ? <Banner tone="danger" message={errorMessage(submit.error)} /> : null}
      <Text variant="h3">What happened?</Text>
      <Row wrap>{REASONS.map((r) => <Chip key={r.id} label={r.label} selected={reason === r.id} onPress={() => setReason(r.id)} />)}</Row>
      <TextField label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} style={{ minHeight: 96, textAlignVertical: 'top' }} />
      <ToggleRow title="Also block this player" subtitle="You won't be matched with them again." value={alsoBlock} onChange={setAlsoBlock} />
    </Screen>
  );
}
