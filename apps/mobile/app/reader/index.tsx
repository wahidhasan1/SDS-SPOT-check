import { useState } from 'react';
import { Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { Button, Card, Empty, Input, Loading, Notice, P, Row, Screen } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/lib/theme';
import { useApi } from '../../src/lib/useApi';

interface Doc { id: string; title: string; preview: string; confidence: number | null; createdAt: string }

export default function Reader() {
  const t = useTheme();
  const { me, refresh } = useAuth();
  const docs = useApi<{ documents: Doc[] }>('/api/reader/docs');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  const scan = async (camera: boolean) => {
    setErr(null);
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr(camera ? 'Camera permission is needed to photograph a page.' : 'Photo library permission is needed to choose a picture.');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, allowsEditing: true };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const fd = new FormData();
    fd.append('image', { uri: a.uri, name: a.fileName ?? 'page.jpg', type: a.mimeType ?? 'image/jpeg' } as unknown as Blob);
    setBusy(true);
    try {
      const r = await api.post<{ document: { id: string } }>('/api/reader/scan', fd);
      refresh().catch(() => {});
      router.push(`/reader/${r.document.id}`);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const savePaste = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ document: { id: string } }>('/api/reader/text', { title: title || 'Pasted text', text });
      setPaste(false);
      router.push(`/reader/${r.document.id}`);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const left = me?.limits.ocr_scan == null ? null : Math.max(0, me.limits.ocr_scan - (me.usage.ocr_scan ?? 0));

  return (
    <Screen onRefresh={docs.reload}>
      <Stack.Screen options={{ title: 'Book reader' }} />
      <P muted>Photograph a page of an English book. Text recognition (OCR) runs on our server; you can correct any mistakes. Then tap any word for its meaning in that sentence.</P>
      {left != null && <P muted>{left} scans left today</P>}
      {busy && <Loading label="Reading the page… this can take a few seconds" />}
      {err && <Notice tone="error" text={err} />}
      <Row>
        <Button title="Take a photo" onPress={() => scan(true)} disabled={busy} />
        <Button variant="secondary" title="Choose photo" onPress={() => scan(false)} disabled={busy} />
      </Row>
      <Button small variant="ghost" title={paste ? 'Hide' : 'Or paste text instead'} onPress={() => setPaste(!paste)} />
      {paste && (
        <Card>
          <Input label="Title" value={title} onChangeText={setTitle} />
          <Input label="Text" value={text} onChangeText={setText} multiline style={{ minHeight: 140, textAlignVertical: 'top' }} />
          <Button title="Open in reader" onPress={savePaste} loading={busy} disabled={text.trim().length < 10} />
        </Card>
      )}
      {!docs.data ? <Loading /> : docs.data.documents.length === 0 ? <Empty title="No pages yet" text="Your scanned pages will appear here." /> : docs.data.documents.map((d) => (
        <Card key={d.id} onPress={() => router.push(`/reader/${d.id}`)}>
          <Text style={{ color: t.text, fontWeight: '700' }}>{d.title}</Text>
          <P muted>{d.preview}…</P>
        </Card>
      ))}
    </Screen>
  );
}
