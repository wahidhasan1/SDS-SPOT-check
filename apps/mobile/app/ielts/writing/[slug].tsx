import { useEffect, useState } from 'react';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { api, errorMessage } from '../../../src/lib/api';
import { Button, ErrorText, Loading, Screen } from '../../../src/components/ui';
import { PromptCard, WritingEditor } from '../../../src/components/WritingEditor';

export default function WritingTask() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [data, setData] = useState<any>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get<any>(`/ielts/writing/prompts/${slug}`).then((d) => { setData(d); setSubId(d.draft?.id ?? null); }).catch((e) => setErr(errorMessage(e)));
  }, [slug]);
  if (!data) return <Screen>{err ? <ErrorText error={err} /> : <Loading />}</Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: data.prompt.title }} />
      <PromptCard prompt={data.prompt} />
      <WritingEditor prompt={data.prompt} initialText={data.draft?.text ?? ''} submissionId={data.draft?.id} onSaved={setSubId} />
      <ErrorText error={err} />
      <Button title="Submit for feedback" disabled={!subId} loading={busy} onPress={async () => {
        setBusy(true);
        try {
          await api.post(`/ielts/writing/submissions/${subId}/submit`);
          router.replace(`/ielts/writing/result/${subId}`);
        } catch (e) {
          setErr(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }} />
    </Screen>
  );
}
