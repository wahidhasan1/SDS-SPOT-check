import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { LANGUAGES, LEVEL_DISCLAIMER } from '@fluentpath/shared';
import { Button, Chip, H2, Input, Notice, P, Row, Screen } from '../src/components/ui';
import { api, errorMessage } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';

const BANDS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

export default function Profile() {
  const { me, refresh } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [mod, setMod] = useState<'academic' | 'general' | null>(null);
  const [band, setBand] = useState<number | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!me) return;
    setName(me.profile.displayName);
    setBio(me.profile.bio);
    setMod(me.profile.ieltsModule);
    setBand(me.profile.ieltsTargetBand);
    setLang(me.profile.nativeLanguage);
  }, [me]);
  if (!me) return null;
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.patch('/api/profile', { displayName: name.trim(), bio: bio.trim(), ieltsModule: mod, ieltsTargetBand: band, nativeLanguage: lang });
      await refresh();
      setMsg({ tone: 'success', text: 'Profile saved.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Profile' }} />
      <Input label="Display name" value={name} onChangeText={setName} maxLength={40} />
      <Input label="About you (optional)" value={bio} onChangeText={setBio} maxLength={300} multiline />
      <P muted>Estimated level: {me.profile.cefrLevel ?? 'not assessed yet'}. {LEVEL_DISCLAIMER}</P>
      <H2>IELTS module</H2>
      <Row><Chip label="Academic" selected={mod === 'academic'} onPress={() => setMod('academic')} /><Chip label="General Training" selected={mod === 'general'} onPress={() => setMod('general')} /></Row>
      <H2>Target band</H2>
      <Row>{BANDS.map((b) => <Chip key={b} label={String(b)} selected={band === b} onPress={() => setBand(b)} />)}</Row>
      <H2>Native language (for translations)</H2>
      <Row>{LANGUAGES.map((l) => <Chip key={l} label={l} selected={lang === l} onPress={() => setLang(l)} />)}</Row>
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      <Button title="Save" loading={busy} onPress={save} />
    </Screen>
  );
}
