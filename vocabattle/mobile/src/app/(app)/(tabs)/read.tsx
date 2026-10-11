import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Banner, Button, Card, Icon, type IconName, Row, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'camera', title: 'Capture a page', text: 'Photograph a book page or upload one from your gallery. Crop, rotate or retake if it is blurry.' },
  { icon: 'scan', title: 'Text recognition (OCR)', text: 'Words are recognised with their positions, so tapping a word selects exactly that word.' },
  { icon: 'hand-left', title: 'Tap any word', text: 'Get the meaning in this sentence — not just the dictionary default — plus pronunciation, synonyms and a translation.' },
  { icon: 'language', title: 'Translate & simplify', text: 'Translate a sentence, paragraph or the whole page (including Bengali), or rewrite it in simpler English.' },
];

/** AI Reading home. The OCR/AI pipeline is Phase 2; manual word capture works today. */
export default function Read() {
  const qc = useQueryClient();
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [sentence, setSentence] = useState('');
  const save = useMutation({
    mutationFn: () => api.saveCustomWord(word, meaning, sentence),
    onSuccess: () => { setWord(''); setMeaning(''); setSentence(''); qc.invalidateQueries({ queryKey: ['saved-words'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });

  return (
    <Screen title="Read with AI" subtitle="Read real books without switching to a translator.">
      <Banner tone="phase" title="Coming in Phase 2"
        message="Camera capture, OCR, tap-to-explain and page translation need an OCR and AI provider connected through a secure backend function. The database and API contracts are designed; the provider keys are not configured in this build." />
      {STEPS.map((s) => (
        <Card key={s.title}>
          <Row gap={Spacing.md} style={{ alignItems: 'flex-start' }}>
            <Icon name={s.icon} color="textMuted" size={24} />
            <View style={{ flex: 1 }}>
              <Row><Text variant="bodyStrong">{s.title}</Text><Badge label="Phase 2" tone="muted" /></Row>
              <Text variant="small" color="textMuted">{s.text}</Text>
            </View>
          </Row>
        </Card>
      ))}
      <Row gap={Spacing.sm}>
        <Button style={{ flex: 1 }} title="Camera" icon="camera" variant="secondary" disabled />
        <Button style={{ flex: 1 }} title="Upload photo" icon="image" variant="secondary" disabled />
      </Row>

      <SectionHeader title="Save a word from your book" />
      <Card>
        <Text variant="small" color="textMuted">Available now: add an unfamiliar word you met while reading. It joins your spaced-repetition reviews.</Text>
        {save.isSuccess ? <Banner tone="success" message="Saved to your vocabulary." /> : null}
        {save.error ? <Banner tone="danger" message={errorMessage(save.error)} /> : null}
        <TextField testID="read-word" label="Word" value={word} onChangeText={setWord} autoCapitalize="none" maxLength={80} />
        <TextField testID="read-meaning" label="Meaning (your own words)" value={meaning} onChangeText={setMeaning} maxLength={300} />
        <TextField label="Sentence from the book (optional)" value={sentence} onChangeText={setSentence} multiline maxLength={500} />
        <Button testID="read-save" title="Save word" icon="bookmark" disabled={!word.trim() || !meaning.trim()} loading={save.isPending} onPress={() => save.mutate()} />
        <Button title="Open saved vocabulary" variant="ghost" size="sm" onPress={() => router.push('/saved-words')} />
      </Card>
      <Text variant="small" color="textFaint">Privacy: uploaded pages will be private to you, never shared with other users, and deletable at any time. Only the sentence around a tapped word is sent for explanation — never a whole book.</Text>
    </Screen>
  );
}
