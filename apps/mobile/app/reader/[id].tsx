import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, H2, Input, Loading, Notice, P, Row, Screen } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { playUrl } from '../../src/lib/audio';
import { useTheme } from '../../src/lib/theme';
import { useApi } from '../../src/lib/useApi';

interface Doc { id: string; title: string; recognizedText: string; correctedText: string | null; confidence: number | null }
interface Lookup { query: string; lemma: string; found: boolean; senses: { pos: string; definition: string; examples: string[]; synonyms: string[] }[]; bestIndex: number | null; learnerEntry: { id: string; definition: string; example: string; audioUrl: string | null; cefrLevel: string } | null; savedId: string | null; aiConfigured: boolean }
interface Explanation { lemma: string; meaningInContext: string; simpleDefinition: string; translation: string | null; exampleSentence: string }

/** Split text into paragraphs → sentences → tappable word tokens. */
function tokenize(text: string) {
  return text.split(/\n{2,}/).map((para) => (para.match(/[^.!?]+[.!?]*["')\]]*\s*/g) ?? [para]).map((sentence) => ({ sentence: sentence.trim(), parts: sentence.split(/([A-Za-z][A-Za-z'’-]*)/) })));
}

export default function ReaderDoc() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { data, error, reload } = useApi<{ document: Doc; aiConfigured: boolean }>(`/api/reader/docs/${id}`);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [sel, setSel] = useState<{ word: string; sentence: string } | null>(null);
  const [look, setLook] = useState<Lookup | null>(null);
  const [expl, setExpl] = useState<Explanation | null>(null);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const text = data ? data.document.correctedText ?? data.document.recognizedText : '';
  const paras = useMemo(() => tokenize(text), [text]);

  if (error) return <Screen><Notice tone="error" text={error} /></Screen>;
  if (!data) return <Screen><Loading /></Screen>;
  const doc = data.document;

  const open = async (word: string, sentence: string) => {
    setSel({ word, sentence });
    setLook(null);
    setExpl(null);
    setMsg(null);
    try {
      setLook(await api.post<Lookup>('/api/reader/lookup', { word, sentence }));
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const explain = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      setExpl((await api.post<{ explanation: Explanation }>('/api/reader/explain', { word: sel.word, sentence: sel.sentence, language: null })).explanation);
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!sel || !look) return;
    const sense = look.bestIndex != null ? look.senses[look.bestIndex] : look.senses[0];
    try {
      if (look.learnerEntry) await api.post('/api/vocab/my', { wordId: look.learnerEntry.id, source: 'reader', context: sel.sentence.slice(0, 500) });
      else await api.post('/api/vocab/my', { word: look.lemma, definition: (expl?.simpleDefinition ?? sense?.definition ?? '').slice(0, 500), context: sel.sentence.slice(0, 500), source: 'reader' });
      setLook({ ...look, savedId: 'saved' });
      setMsg({ tone: 'success', text: 'Saved to your words. It will appear in your reviews.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };
  const best = look && look.bestIndex != null ? look.senses[look.bestIndex] : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: doc.title }} />
      <Row>
        {doc.confidence != null && <Badge text={`OCR confidence ${Math.round(doc.confidence)}%`} tone={doc.confidence > 80 ? 'green' : 'amber'} />}
        {doc.correctedText && <Badge text="Corrected by you" tone="slate" />}
      </Row>
      {editing ? (
        <Card>
          <Input label="Correct the recognised text" value={draft} onChangeText={setDraft} multiline style={{ minHeight: 260, textAlignVertical: 'top' }} />
          <Row>
            <Button title="Save" onPress={async () => { try { await api.patch(`/api/reader/docs/${id}`, { correctedText: draft }); setEditing(false); reload(); } catch (e) { Alert.alert('Error', errorMessage(e)); } }} />
            <Button variant="secondary" title="Cancel" onPress={() => setEditing(false)} />
          </Row>
        </Card>
      ) : (
        <Card>
          <P muted style={{ fontSize: 13 }}>Tap a word to see its meaning in this sentence.</P>
          {paras.map((sentences, pi) => (
            <Text key={pi} style={{ color: t.text, fontSize: 18, lineHeight: 30 }}>
              {sentences.map((s, si) => s.parts.map((part, k) => (k % 2 === 1 ? (
                <Text key={`${si}-${k}`} onPress={() => open(part, s.sentence)} suppressHighlighting={false} style={sel?.word === part && sel.sentence === s.sentence ? { backgroundColor: t.brand + '33' } : undefined}>{part}</Text>
              ) : part)))}
            </Text>
          ))}
        </Card>
      )}
      {!editing && (
        <Row>
          <Button small variant="secondary" title="Correct text" onPress={() => { setDraft(text); setEditing(true); }} />
          <Button small variant="danger" title="Delete" onPress={() => Alert.alert('Delete this page?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await api.del(`/api/reader/docs/${id}`).catch(() => {}); router.back(); } }])} />
        </Row>
      )}

      <Modal visible={Boolean(sel)} animationType="slide" transparent onRequestClose={() => setSel(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={() => setSel(null)} accessibilityLabel="Close" />
        <View style={{ maxHeight: '75%', backgroundColor: t.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18 }}>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
            {sel && <H2>{sel.word}{look && look.lemma.toLowerCase() !== sel.word.toLowerCase() ? ` → ${look.lemma}` : ''}</H2>}
            {!look && !msg && <Loading />}
            {look && !look.found && !look.learnerEntry && <P muted>No dictionary entry found for this word.</P>}
            {look?.learnerEntry && (
              <View style={{ gap: 4 }}>
                <Row><Badge text={look.learnerEntry.cefrLevel} />{look.learnerEntry.audioUrl && <Button small variant="secondary" title="▶ Listen" onPress={() => playUrl(look.learnerEntry!.audioUrl!)} />}</Row>
                <P>{look.learnerEntry.definition}</P>
                <P muted>“{look.learnerEntry.example}”</P>
              </View>
            )}
            {best && <View><P muted style={{ fontSize: 12 }}>Most likely meaning here ({best.pos}) — chosen automatically, may be imperfect</P><P>{best.definition}</P>{best.examples[0] && <P muted>“{best.examples[0]}”</P>}</View>}
            {look && look.senses.length > 1 && <P muted style={{ fontSize: 13 }}>Other meanings: {look.senses.filter((_, i) => i !== look.bestIndex).slice(0, 3).map((s) => `(${s.pos}) ${s.definition}`).join(' · ')}</P>}
            {expl && <Card><P>{expl.meaningInContext}</P><P muted>{expl.simpleDefinition}</P>{expl.translation && <P>Translation: {expl.translation}</P>}<P muted>“{expl.exampleSentence}”</P><P muted style={{ fontSize: 12 }}>AI explanation</P></Card>}
            {msg && <Notice tone={msg.tone} text={msg.text} />}
            {look && (
              <Row>
                <Button small title={look.savedId ? 'Saved' : 'Save word'} disabled={Boolean(look.savedId)} onPress={save} />
                {look.aiConfigured ? <Button small variant="secondary" title="Explain with AI" loading={busy} onPress={explain} /> : <P muted style={{ fontSize: 12 }}>AI explanations not configured on this server</P>}
              </Row>
            )}
            <Button variant="ghost" title="Close" onPress={() => setSel(null)} />
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}
