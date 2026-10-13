import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { api, errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useApi } from '../../src/lib/hooks';
import { useTheme } from '../../src/lib/theme';
import { Badge, Button, Card, ErrorText, H2, Input, Loading, P, Row, Screen } from '../../src/components/ui';

function sentenceAround(text: string, idx: number) {
  const start = Math.max(text.lastIndexOf('.', idx - 1), text.lastIndexOf('!', idx - 1), text.lastIndexOf('?', idx - 1), text.lastIndexOf('\n', idx - 1)) + 1;
  const ends = ['.', '!', '?', '\n'].map((c) => text.indexOf(c, idx)).filter((x) => x >= 0);
  return text.slice(start, ends.length ? Math.min(...ends) + 1 : text.length).trim();
}

export default function Reader() {
  const t = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, setData } = useApi<any>(`/reading/sessions/${id}`);
  const [sel, setSel] = useState<{ word: string; i: number; sentence: string } | null>(null);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [tr, setTr] = useState<string | null>(null);
  const text: string = data?.text ?? '';
  const tokens = useMemo(() => {
    const out: { s: string; w: boolean; i: number }[] = [];
    const re = /([A-Za-z]+(?:['’-][A-Za-z]+)*)|([^A-Za-z]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) out.push({ s: m[0], w: !!m[1], i: m.index });
    return out;
  }, [text]);
  const look = async (w: string, i: number) => {
    const sentence = sentenceAround(text, i);
    setSel({ word: w, i, sentence });
    setRes(null);
    setSaved(false);
    setTr(null);
    setErr(null);
    try {
      setRes(await api.post('/reading/lookup', { word: w, sentence, sessionId: id }));
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  if (loading || !data) return <Loading />;
  const meaning = res?.ai?.meaningInContext ?? res?.dictionary?.senses[0]?.definition;
  return (
    <Screen>
      <Stack.Screen options={{ title: data.title }} />
      <Row between>{data.confidence != null && <Badge label={`OCR ${Math.round(data.confidence)}%`} tone={data.confidence > 80 ? 'success' : 'warning'} />}<Button small variant="ghost" title={editing ? 'Cancel' : '✏️ Correct text'} onPress={() => { setDraft(text); setEditing(!editing); }} /></Row>
      {editing ? (
        <Card>
          <Input multiline value={draft} onChangeText={setDraft} style={{ minHeight: 220 }} />
          <Button title="Save corrections" onPress={async () => { const r = await api.put<any>(`/reading/sessions/${id}`, { text: draft }); setData({ ...data, ...r }); setEditing(false); }} />
        </Card>
      ) : (
        <Card>
          <Text style={{ fontSize: 18, lineHeight: 30, color: t.text, fontFamily: 'serif' }}>
            {tokens.map((tk, k) => tk.w ? (
              <Text key={k} onPress={() => look(tk.s, tk.i)} style={sel?.i === tk.i ? { backgroundColor: t.primary, color: '#fff' } : undefined}>{tk.s}</Text>
            ) : <Text key={k}>{tk.s}</Text>)}
          </Text>
        </Card>
      )}
      {sel && (
        <Card>
          <P small muted>“{sel.sentence}”</P>
          <ErrorText error={err} />
          {!res ? <Loading /> : !res.found ? <P>{res.message}</P> : (
            <>
              <H2>{res.ai?.headword ?? res.dictionary?.lemma}</H2>
              <P><P style={{ fontWeight: '700' }}>{res.ai ? 'In this sentence: ' : res.dictionary?.method === 'lesk' ? 'Best match: ' : 'Common meaning: '}</P>{meaning}</P>
              {(res.ai?.examples ?? res.dictionary?.senses[0]?.examples ?? []).slice(0, 2).map((e: string) => <P key={e} small>• {e}</P>)}
              {res.ai?.translation && <P small>{user?.translationLanguage}: {res.ai.translation}</P>}
              <P small muted>{res.ai ? 'Explained by AI — may occasionally be wrong.' : 'From the WordNet dictionary.'}</P>
              <Button small title={saved ? '✓ Saved' : '+ Save word'} disabled={saved} onPress={async () => { await api.post('/vocabulary/saved', { word: res.ai?.headword ?? res.dictionary?.lemma ?? sel.word, meaning, context: sel.sentence, source: 'ai_reading' }); setSaved(true); }} />
              {user?.translationLanguage && !res.ai?.translation && (
                <Button small variant="secondary" title={`Translate sentence (${user.translationLanguage})`} onPress={async () => { const r = await api.post<any>('/reading/translate', { text: sel.sentence, targetLanguage: user.translationLanguage }); setTr(r.available === false ? r.message : r.translation); }} />
              )}
              {tr && <P small>{tr}</P>}
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}
