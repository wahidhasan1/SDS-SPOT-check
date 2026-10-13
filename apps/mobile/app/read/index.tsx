import { useState } from 'react';
import { Image, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { api, errorMessage } from '../../src/lib/api';
import { fmtDate, useApi } from '../../src/lib/hooks';
import { Button, Card, Empty, ErrorText, H2, Input, P, Row, Screen } from '../../src/components/ui';

export default function ReadHome() {
  const sessions = useApi<any[]>('/reading/sessions');
  const caps = useApi<any>('/reading/capabilities');
  const [img, setImg] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const pick = async (camera: boolean) => {
    setErr(null);
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr(camera ? 'Camera permission is needed to photograph a page.' : 'Photo library permission is needed.');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, quality: 0.9 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled && r.assets[0]) setImg({ uri: r.assets[0].uri, width: r.assets[0].width, height: r.assets[0].height });
  };
  const rotate = async () => {
    if (!img) return;
    const r = await manipulateAsync(img.uri, [{ rotate: 90 }], { compress: 0.9, format: SaveFormat.JPEG });
    setImg({ uri: r.uri, width: r.width, height: r.height });
  };
  const upload = async () => {
    if (!img) return;
    setBusy(true);
    setErr(null);
    try {
      // Downscale very large photos before upload (faster, and within the 8 MB limit).
      const r = await manipulateAsync(img.uri, img.width > 2400 ? [{ resize: { width: 2400 } }] : [], { compress: 0.85, format: SaveFormat.JPEG });
      const fd = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(r.uri)).blob();
        fd.append('file', blob, 'page.jpg');
      } else {
        fd.append('file', { uri: r.uri, name: 'page.jpg', type: 'image/jpeg' } as any);
      }
      const s = await api.upload<any>('/reading/scan', fd);
      setImg(null);
      router.push(`/read/${s.id}`);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Read with AI' }} />
      <P muted>Photograph a page, then tap any word to see what it means in that sentence.</P>
      {img ? (
        <Card>
          <Image source={{ uri: img.uri }} style={{ width: '100%', height: 300, resizeMode: 'contain' }} />
          <Row><Button small variant="secondary" title="⟳ Rotate" onPress={rotate} /><Button small variant="ghost" title="Retake" onPress={() => setImg(null)} /></Row>
          <Button title="Extract text" loading={busy} onPress={upload} />
        </Card>
      ) : (
        <Card>
          <Button title="📷 Take a photo" onPress={() => pick(true)} />
          <Button variant="secondary" title="🖼️ Choose from photos" onPress={() => pick(false)} />
          <P small muted>Tip: crop to the paragraph you're reading. Photos are deleted on the server right after the text is extracted.</P>
        </Card>
      )}
      <ErrorText error={err} />
      <Card>
        <H2>…or paste text</H2>
        <Input multiline value={paste} onChangeText={setPaste} style={{ minHeight: 80 }} />
        <Button small variant="secondary" title="Open in reader" disabled={!paste.trim()} onPress={async () => { const s = await api.post<any>('/reading/sessions', { text: paste }); router.push(`/read/${s.id}`); }} />
      </Card>
      <P small muted>{caps.data?.aiMeanings ? 'Meanings in context are explained by AI.' : 'Meanings come from an offline dictionary matched to your sentence (AI explanations not configured).'}</P>
      <H2>Your reading sessions</H2>
      {!sessions.data?.length ? <Empty icon="📖" title="No scans yet" /> : sessions.data.map((s) => (
        <Card key={s.id} onPress={() => router.push(`/read/${s.id}`)}><P>{s.title}</P><P small muted>{fmtDate(s.createdAt)}</P></Card>
      ))}
    </Screen>
  );
}
