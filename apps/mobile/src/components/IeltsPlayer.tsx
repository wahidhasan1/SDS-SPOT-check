import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { api, errorMessage, mediaUrl } from '../lib/api';
import { fmtDuration, useInterval } from '../lib/hooks';
import { useTheme } from '../lib/theme';
import { Badge, Button, Card, Chip, Disclaimer, ErrorText, H2, Notice, Option, P, Row } from './ui';

const CHOICE = new Set(['tfng', 'ynng']);
const SELECT = new Set(['matching_headings', 'matching_info', 'matching_features', 'matching_names', 'matching_endings', 'map_labelling']);

function MapSvg({ map }: { map: any }) {
  const t = useTheme();
  return (
    <Svg viewBox={`0 0 ${map.width} ${map.height}`} width="100%" height={260}>
      {map.areas.map((a: any, i: number) =>
        a.kind === 'lake' ? (
          <Ellipse key={i} cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} fill="#9cc3f0" />
        ) : (
          <Rect key={i} x={a.x} y={a.y} width={a.w} height={a.h} rx={8} fill={a.kind === 'woodland' ? '#b7e4cf' : t.surface} stroke={t.border} />
        ),
      )}
      {map.areas.map((a: any, i: number) => (
        <SvgText key={`l${i}`} x={a.kind === 'lake' ? a.cx : a.x + a.w / 2} y={a.kind === 'lake' ? a.cy + 4 : a.kind === 'woodland' ? a.y + 18 : a.y + a.h / 2 + 5} fontSize="13" fill={t.text} textAnchor="middle">{a.label}</SvgText>
      ))}
      {map.paths.map((p: number[][], i: number) => <Polyline key={i} points={p.map((x) => x.join(',')).join(' ')} fill="none" stroke={t.textMuted} strokeWidth={3} strokeDasharray="6 5" />)}
      {map.markers.map((m: any) => (
        <G key={m.key}>
          <Circle cx={m.x} cy={m.y} r={13} fill={t.primary} />
          <SvgText x={m.x} y={m.y + 5} fontSize="14" fontWeight="bold" fill="#fff" textAnchor="middle">{m.key}</SvgText>
        </G>
      ))}
    </Svg>
  );
}

function AudioBar({ src, attemptId, strict }: { src: string; attemptId: string; strict: boolean }) {
  const player = useAudioPlayer(src);
  const status = useAudioPlayerStatus(player);
  const [allowed, setAllowed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const toggle = async () => {
    if (status.playing) {
      if (!strict) player.pause();
      return;
    }
    if (!allowed) {
      const r = await api.post<{ allowed: boolean; message?: string }>(`/ielts/attempts/${attemptId}/audio-played`);
      if (!r.allowed) return setMsg(r.message ?? 'The recording can only be played once.');
      setAllowed(true);
    }
    player.play();
  };
  return (
    <Card>
      <Row between>
        <Button small title={status.playing ? '⏸ Pause' : '▶ Play recording'} onPress={toggle} disabled={strict && status.playing} />
        <P small>{fmtDuration(status.currentTime)} / {fmtDuration(status.duration || 0)}</P>
      </Row>
      {!strict && (
        <Row>
          <Button small variant="secondary" title="⏪ 10s" onPress={() => player.seekTo(Math.max(0, status.currentTime - 10))} />
          <Button small variant="secondary" title="10s ⏩" onPress={() => player.seekTo(status.currentTime + 10)} />
        </Row>
      )}
      {strict && <P small muted>Test conditions: the recording plays once without pausing.</P>}
      {msg && <Notice tone="warning" text={msg} />}
    </Card>
  );
}

export function IeltsPlayer({ attempt: initial, embedded, strictAudio }: { attempt: any; embedded?: boolean; strictAudio?: boolean }) {
  const t = useTheme();
  const [attempt, setAttempt] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, string>>(initial.answers ?? {});
  const [tab, setTab] = useState<'passage' | 'questions'>(initial.set.skill === 'listening' ? 'questions' : 'passage');
  const [save, setSave] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState(false);
  const dirty = useRef<Record<string, string>>({});
  const submitted = attempt.status === 'submitted';
  const review = submitted ? attempt.result : null;
  const content = attempt.set.content;
  const questions = useMemo(() => content.groups.flatMap((g: any) => g.questions), [content]);
  useInterval(() => setNow(Date.now()), submitted ? null : 1000);

  const flush = useCallback(async () => {
    const pending = dirty.current;
    if (!Object.keys(pending).length) return;
    dirty.current = {};
    setSave('saving');
    try {
      await api.put(`/ielts/attempts/${attempt.id}/answers`, { answers: pending });
      setSave('saved');
    } catch (e) {
      dirty.current = { ...pending, ...dirty.current };
      setSave('error');
      setErr(errorMessage(e));
    }
  }, [attempt.id]);
  useEffect(() => {
    if (save !== 'unsaved') return;
    const tm = setTimeout(() => void flush(), 1200);
    return () => clearTimeout(tm);
  }, [answers, save, flush]);
  useEffect(() => () => void flush(), [flush]);

  const set = (qid: string, v: string) => {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [qid]: v }));
    dirty.current[qid] = v;
    setSave('unsaved');
  };
  const submit = async () => {
    await flush();
    try {
      setAttempt(await api.post(`/ielts/attempts/${attempt.id}/submit`, { answers }));
      setConfirm(false);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const remaining = attempt.deadline ? Math.max(0, Math.floor((Date.parse(attempt.deadline) - now) / 1000)) : null;
  useEffect(() => {
    if (!embedded && !submitted && remaining === 0) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);
  const num = (qid: string) => questions.find((q: any) => q.id === qid)?.number;
  const Review = ({ qid }: { qid: string }) => {
    const r = review?.perQuestion[qid];
    if (!r) return null;
    return <P small style={{ color: r.correct ? t.success : t.danger }}>{r.correct ? '✓ Correct' : `✗ ${r.given || '—'} → ${r.answer}`}{`\n`}<P small muted>{r.explanation}</P></P>;
  };
  const Gap = ({ qid, g }: { qid: string; g: any }) => (
    <View style={{ gap: 4 }}>
      <Row>
        <Text style={{ color: t.primary, fontWeight: '800', width: 28 }}>{num(qid)}</Text>
        {g.wordBox ? (
          <Row wrap gap={6}>{g.wordBox.map((w: any) => <Chip key={w.key} label={w.key} on={answers[qid] === w.key} onPress={() => set(qid, w.key)} />)}</Row>
        ) : (
          <TextInput accessibilityLabel={`Question ${num(qid)}`} editable={!submitted} value={answers[qid] ?? ''} onChangeText={(v) => set(qid, v)} autoCapitalize="none" autoCorrect={false}
            style={{ flex: 1, borderBottomWidth: 2, borderColor: t.primary, backgroundColor: t.primarySoft, color: t.text, padding: 8, borderRadius: 6 }} />
        )}
      </Row>
      <Review qid={qid} />
    </View>
  );
  const withMarkers = (s: string) => s.replace(/\{\{(q\d+)\}\}/g, (_, id) => `(${num(id)}) ______`);
  const ids = (s: string) => [...s.matchAll(/\{\{(q\d+)\}\}/g)].map((m) => m[1]);

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Row between>
          <View style={{ flex: 1 }}><P style={{ fontWeight: '700' }}>{attempt.set.title}</P><P small muted>{attempt.mode} · {questions.filter((q: any) => (answers[q.id] ?? '').trim()).length}/{questions.length} answered</P></View>
          {submitted ? <Badge label={`Score ${attempt.score}/${attempt.total}${attempt.band != null ? ` · ≈${attempt.band}` : ''}`} tone="success" /> : remaining != null ? <Badge label={`⏱ ${fmtDuration(remaining)}`} tone={remaining < 120 ? 'danger' : 'default'} /> : null}
        </Row>
        {!submitted && <P small muted>{save === 'saving' ? 'Saving…' : save === 'saved' ? '✓ Saved' : save === 'error' ? '⚠ Not saved' : 'Unsaved changes'}</P>}
        {submitted && <Disclaimer />}
      </Card>
      <ErrorText error={err} />
      {attempt.set.skill === 'listening' && <AudioBar src={mediaUrl(content.audio)} attemptId={attempt.id} strict={!!strictAudio && !submitted} />}
      {attempt.set.skill === 'reading' && (
        <Row><Chip label="Passage" on={tab === 'passage'} onPress={() => setTab('passage')} /><Chip label="Questions" on={tab === 'questions'} onPress={() => setTab('questions')} /></Row>
      )}
      {tab === 'passage' && attempt.set.skill === 'reading' && content.passages.map((p: any) => (
        <Card key={p.id}>
          <H2>{p.title}</H2>
          {p.paragraphs.map((para: any, i: number) => <P key={i} style={{ fontFamily: 'serif', fontSize: 16, lineHeight: 26 }}>{para.label ? `${para.label}  ` : ''}{para.text}</P>)}
        </Card>
      ))}
      {(tab === 'questions' || attempt.set.skill === 'listening') && content.groups.map((g: any) => (
        <Card key={g.id}>
          <H2>{g.title}</H2>
          <P small muted>{g.instructions}</P>
          {(g.headings || g.features || g.endings || g.wordBox) && (
            <View style={{ backgroundColor: t.surface2, borderRadius: 10, padding: 10, gap: 2 }}>
              {(g.headings || g.features || g.endings || g.wordBox).map((h: any) => <P key={h.key} small><P small style={{ fontWeight: '800' }}>{h.key}</P>  {h.text}</P>)}
            </View>
          )}
          {g.map && <MapSvg map={g.map} />}
          {g.template && g.template.map((line: string, i: number) => (
            <View key={i} style={{ gap: 6 }}><P>{withMarkers(line)}</P>{ids(line).map((id) => <Gap key={id} qid={id} g={g} />)}</View>
          ))}
          {g.table && g.table.rows.map((r: string[], i: number) => (
            <View key={i} style={{ borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 10, gap: 4 }}>
              {r.map((c, j) => <View key={j} style={{ gap: 4 }}><P small muted>{g.table.headers[j]}</P><P>{withMarkers(c)}</P>{ids(c).map((id) => <Gap key={id} qid={id} g={g} />)}</View>)}
            </View>
          ))}
          {g.steps && g.steps.map((s: string, i: number) => (
            <View key={i} style={{ gap: 4 }}><P>{i > 0 ? '↓ ' : ''}{withMarkers(s)}</P>{ids(s).map((id) => <Gap key={id} qid={id} g={g} />)}</View>
          ))}
          {!g.template && !g.table && !g.steps && g.questions.map((q: any) => (
            <View key={q.id} style={{ gap: 6, paddingVertical: 6, borderTopWidth: 1, borderColor: t.border }}>
              <P><Text style={{ color: t.primary, fontWeight: '800' }}>{q.number}  </Text>{q.text}</P>
              {CHOICE.has(g.type) && <Row wrap>{g.options.map((o: string) => <Chip key={o} label={o} on={answers[q.id] === o} onPress={() => set(q.id, o)} />)}</Row>}
              {g.type === 'mcq' && q.options.map((o: string) => <Option key={o} label={o} selected={answers[q.id] === o.trim()[0]} onPress={() => set(q.id, o.trim()[0])} disabled={submitted} />)}
              {SELECT.has(g.type) && <Row wrap gap={6}>{(g.headings ?? g.features ?? g.endings ?? g.options.map((k: string) => ({ key: k }))).map((h: any) => <Chip key={h.key} label={h.key} on={answers[q.id] === h.key} onPress={() => set(q.id, h.key)} />)}</Row>}
              <Review qid={q.id} />
            </View>
          ))}
        </Card>
      ))}
      {submitted && attempt.set.skill === 'listening' && content.transcript && (
        <Card><H2>Transcript</H2>{content.transcript.map((l: string, i: number) => <P key={i} small>{l}</P>)}</Card>
      )}
      {!embedded && !submitted && (confirm ? (
        <Card>
          <P>Submit your answers? You can't change them afterwards.</P>
          <Row><Button title="Submit" onPress={submit} /><Button variant="secondary" title="Keep working" onPress={() => setConfirm(false)} /></Row>
        </Card>
      ) : <Button title="Submit answers" onPress={() => setConfirm(true)} />)}
    </View>
  );
}
