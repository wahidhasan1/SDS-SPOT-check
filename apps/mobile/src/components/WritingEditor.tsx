import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { countWords } from '@app/shared';
import { api, errorMessage } from '../lib/api';
import { fmtDuration, useInterval } from '../lib/hooks';
import { useTheme } from '../lib/theme';
import { Badge, Card, ErrorText, H2, P, Row } from './ui';

export function PromptCard({ prompt }: { prompt: any }) {
  const v = prompt.visual;
  return (
    <Card>
      <Badge label={`Task ${prompt.task} · ${prompt.minWords}+ words · ${Math.round(prompt.timeLimitSec / 60)} min`} tone="primary" />
      <P style={{ fontWeight: '700' }}>{prompt.prompt}</P>
      {v?.type === 'bar' || v?.type === 'line' ? (
        <View style={{ gap: 4 }}>
          <P small muted>{v.type === 'bar' ? 'Bar chart' : 'Line graph'} ({v.unit})</P>
          {v.series.map((s: any) => <P key={s.name} small>{s.name}: {v.categories.map((c: string, i: number) => `${c} ${s.values[i]}`).join(' · ')}</P>)}
        </View>
      ) : v?.type === 'table' ? (
        <View>{[v.headers, ...v.rows].map((r: string[], i: number) => <P key={i} small style={i === 0 ? { fontWeight: '700' } : undefined}>{r.join('  |  ')}</P>)}</View>
      ) : v?.type === 'process' ? (
        <View>{v.steps.map((s: any, i: number) => <P key={s.label} small>{i + 1}. {s.label} — {s.detail}</P>)}</View>
      ) : v?.type === 'maps' ? (
        <View>{v.maps.map((m: any) => <P key={m.title} small><P small style={{ fontWeight: '700' }}>{m.title}: </P>{m.items.map((i: any) => i.label).join(', ')}</P>)}</View>
      ) : null}
      <P small muted>{prompt.instructions}</P>
    </Card>
  );
}

export function WritingEditor({ prompt, initialText, submissionId, mockAttemptId, deadline, onSaved }: { prompt: any; initialText: string; submissionId?: string | null; mockAttemptId?: string; deadline?: string | null; onSaved?: (id: string) => void }) {
  const t = useTheme();
  const [text, setText] = useState(initialText);
  const [subId, setSubId] = useState<string | null>(submissionId ?? null);
  const [state, setState] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const started = useRef(Date.now());
  const latest = useRef(text);
  latest.current = text;
  useInterval(() => setNow(Date.now()), 1000);
  useEffect(() => {
    if (state !== 'unsaved') return;
    const tm = setTimeout(async () => {
      setState('saving');
      try {
        const r = await api.put<{ id: string }>('/ielts/writing/drafts', { promptId: prompt.id, text: latest.current, elapsedSec: Math.round((Date.now() - started.current) / 1000), mockAttemptId, submissionId: subId ?? undefined });
        setSubId(r.id);
        onSaved?.(r.id);
        setState('saved');
      } catch (e) {
        setErr(errorMessage(e));
        setState('error');
      }
    }, 1500);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, state]);
  const words = countWords(text);
  const remaining = deadline ? Math.max(0, Math.floor((Date.parse(deadline) - now) / 1000)) : null;
  return (
    <Card>
      <Row between>
        <Badge label={`${words} words`} tone={words < prompt.minWords ? 'warning' : 'success'} />
        <P small muted>{state === 'saving' ? 'Saving…' : state === 'saved' ? (subId ? '✓ Saved' : '') : state === 'error' ? '⚠ Not saved' : 'Editing…'} · ⏱ {remaining != null ? fmtDuration(remaining) : fmtDuration((now - started.current) / 1000)}</P>
      </Row>
      <TextInput multiline value={text} onChangeText={(v) => { setText(v); setState('unsaved'); }} autoCorrect={false} spellCheck={false} placeholder="Write your response here…" placeholderTextColor={t.textMuted}
        style={{ minHeight: 320, textAlignVertical: 'top', borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 12, fontSize: 16, lineHeight: 24, color: t.text, backgroundColor: t.surface }} />
      <ErrorText error={err} />
    </Card>
  );
}

export { H2 };
