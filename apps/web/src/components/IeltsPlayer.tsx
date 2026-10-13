import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, mediaUrl } from '../lib/api';
import { errorMessage, formatDuration, useInterval } from '../lib/hooks';
import { ErrorBox, Modal, Unofficial } from './ui';

export interface AttemptDto {
  id: string;
  status: 'in_progress' | 'submitted';
  mode: 'practice' | 'timed' | 'mock';
  mockAttemptId: string | null;
  answers: Record<string, string>;
  flagged: string[];
  startedAt: string;
  deadline: string | null;
  elapsedSec: number;
  audioPlays: number;
  score: number | null;
  total: number | null;
  band: number | null;
  result: { perQuestion: Record<string, { number: number; given: string; correct: boolean; answer: string; explanation: string }>; scaled?: boolean } | null;
  set: { id: string; slug: string; skill: 'reading' | 'listening'; testType: string; title: string; description: string; timeLimitSec: number; questionCount: number; content: any };
}

type Review = AttemptDto['result'];

function splitTemplate(text: string, render: (qid: string) => ReactNode): ReactNode[] {
  return text.split(/(\{\{q\d+\}\})/g).map((part, i) => {
    const m = part.match(/^\{\{(q\d+)\}\}$/);
    return m ? <Fragment key={i}>{render(m[1])}</Fragment> : <Fragment key={i}>{part}</Fragment>;
  });
}

function MapView({ map }: { map: any }) {
  return (
    <svg viewBox={`0 0 ${map.width} ${map.height}`} style={{ width: '100%', maxWidth: 560, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)' }} role="img" aria-label="Map for labelling questions">
      {map.areas.map((a: any, i: number) =>
        a.kind === 'lake' ? (
          <g key={i}><ellipse cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} fill="color-mix(in srgb, var(--series-1, #2a78d6) 30%, transparent)" stroke="var(--border)" /><text x={a.cx} y={a.cy + 4} textAnchor="middle" fontSize="14" fill="var(--text)">{a.label}</text></g>
        ) : (
          <g key={i}><rect x={a.x} y={a.y} width={a.w} height={a.h} rx={8} fill={a.kind === 'woodland' ? 'color-mix(in srgb, #1baf7a 25%, transparent)' : 'var(--surface)'} stroke="var(--border)" strokeDasharray={a.kind === 'woodland' ? '4 3' : undefined} /><text x={a.x + a.w / 2} y={a.kind === 'woodland' ? a.y + 18 : a.y + a.h / 2 + 5} textAnchor="middle" fontSize="13" fill="var(--text)">{a.label}</text></g>
        ),
      )}
      {map.paths.map((p: number[][], i: number) => (
        <polyline key={i} points={p.map((pt) => pt.join(',')).join(' ')} fill="none" stroke="var(--muted)" strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round" />
      ))}
      {map.markers.map((m: any) => (
        <g key={m.key}><circle cx={m.x} cy={m.y} r={13} fill="var(--primary)" /><text x={m.x} y={m.y + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">{m.key}</text></g>
      ))}
      {map.compass && <text x={map.width - 24} y={28} fontSize="16" fontWeight="800" fill="var(--text)">N↑</text>}
    </svg>
  );
}

function AudioPlayer({ src, attemptId, strict, locked }: { src: string; attemptId: string; strict: boolean; locked: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [allowedOnce, setAllowedOnce] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = async () => {
    const el = ref.current;
    if (!el) return;
    if (playing) {
      if (strict) return; // in strict conditions the recording plays straight through
      el.pause();
      return;
    }
    if (!allowedOnce) {
      try {
        const r = await api.post<{ allowed: boolean; message?: string }>(`/ielts/attempts/${attemptId}/audio-played`);
        if (!r.allowed) {
          setMsg(r.message ?? 'The recording cannot be replayed.');
          return;
        }
        setAllowedOnce(true);
      } catch (e) {
        setErr(errorMessage(e));
        return;
      }
    }
    try {
      await el.play();
    } catch {
      setErr('Your browser blocked audio playback. Click play again.');
    }
  };
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <audio
        ref={ref}
        src={src}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onError={() => setErr('The audio file could not be loaded.')}
        data-testid="listening-audio"
      />
      <div className="row">
        <button className="btn" onClick={toggle} disabled={locked || (strict && playing)} aria-label={playing ? 'Pause' : 'Play'} data-testid="audio-play">
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <span className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDuration(t)} / {formatDuration(dur)}</span>
        <input
          type="range"
          min={0}
          max={dur || 0}
          step={0.5}
          value={t}
          disabled={strict}
          aria-label="Playback position"
          onChange={(e) => {
            if (ref.current) ref.current.currentTime = Number(e.target.value);
          }}
          style={{ flex: 1 }}
        />
        <label className="row small" title="Volume">🔊<input type="range" min={0} max={1} step={0.05} value={vol} aria-label="Volume" onChange={(e) => { setVol(Number(e.target.value)); if (ref.current) ref.current.volume = Number(e.target.value); }} style={{ width: 80 }} /></label>
      </div>
      {strict && <div className="tiny muted">Test conditions: the recording plays once without pausing or rewinding.</div>}
      {msg && <div className="alert warning">{msg}</div>}
      <ErrorBox error={err} />
    </div>
  );
}

const CHOICE = new Set(['tfng', 'ynng']);
const SELECT = new Set(['matching_headings', 'matching_info', 'matching_features', 'matching_names', 'matching_endings', 'map_labelling']);

export function QuestionGroups({
  content,
  answers,
  setAnswer,
  flagged,
  toggleFlag,
  review,
  readOnly,
}: {
  content: any;
  answers: Record<string, string>;
  setAnswer: (qid: string, v: string) => void;
  flagged: string[];
  toggleFlag: (qid: string) => void;
  review: Review;
  readOnly: boolean;
}) {
  const numberOf = (qid: string) => content.groups.flatMap((g: any) => g.questions).find((q: any) => q.id === qid)?.number;
  const state = (qid: string) => (review ? (review.perQuestion[qid]?.correct ? 'correct' : 'wrong') : '');
  const ReviewNote = ({ qid }: { qid: string }) => {
    const r = review?.perQuestion[qid];
    if (!r) return null;
    return (
      <div className={`small ${r.correct ? '' : ''}`} style={{ marginTop: 4 }}>
        {r.correct ? <span className="badge success">✓ Correct</span> : <span className="badge danger">✗ Your answer: {r.given || '—'} · Correct: {r.answer}</span>}
        <div className="muted tiny" style={{ marginTop: 2 }}>{r.explanation}</div>
      </div>
    );
  };
  const Flag = ({ qid }: { qid: string }) =>
    readOnly ? null : (
      <button className="btn ghost sm" onClick={() => toggleFlag(qid)} aria-pressed={flagged.includes(qid)} title="Mark for review">
        {flagged.includes(qid) ? '🚩' : '⚐'}
      </button>
    );
  const gap = (g: any) => (qid: string) =>
    g.wordBox ? (
      <select id={`q-${qid}`} className={`gap-input ${state(qid)}`} value={answers[qid] ?? ''} disabled={readOnly} onChange={(e) => setAnswer(qid, e.target.value)} aria-label={`Question ${numberOf(qid)}`}>
        <option value="">{numberOf(qid)} …</option>
        {g.wordBox.map((w: any) => <option key={w.key} value={w.key}>{w.key}</option>)}
      </select>
    ) : (
      <span style={{ whiteSpace: 'nowrap' }}>
        <b className="qn">{numberOf(qid)}</b>
        <input
          id={`q-${qid}`}
          className={`gap-input ${state(qid)}`}
          value={answers[qid] ?? ''}
          disabled={readOnly}
          autoComplete="off"
          spellCheck={false}
          aria-label={`Question ${numberOf(qid)}`}
          onChange={(e) => setAnswer(qid, e.target.value)}
        />
      </span>
    );

  return (
    <div>
      {content.groups.map((g: any) => (
        <section key={g.id} className="qblock">
          <h3>{g.title}</h3>
          <div className="instr">{g.instructions}</div>
          {g.headings && (
            <div className="card flat mb" style={{ background: 'var(--surface-2)' }}>
              <b>List of headings</b>
              {g.headings.map((h: any) => <div key={h.key} className="small"><b style={{ display: 'inline-block', width: 36 }}>{h.key}</b>{h.text}</div>)}
            </div>
          )}
          {(g.features || g.endings || g.wordBox) && (
            <div className="card flat mb" style={{ background: 'var(--surface-2)' }}>
              {(g.features || g.endings || g.wordBox).map((f: any) => <div key={f.key} className="small"><b style={{ display: 'inline-block', width: 28 }}>{f.key}</b>{f.text}</div>)}
            </div>
          )}
          {g.map && <div className="mb"><MapView map={g.map} /></div>}
          {g.heading && <h4>{g.heading}</h4>}
          {g.template && (
            <div className="stack" style={{ gap: 10 }}>
              {g.template.map((line: string, i: number) => {
                const ids = [...line.matchAll(/\{\{(q\d+)\}\}/g)].map((m) => m[1]);
                return (
                  <div key={i} className="q" id={ids[0] ? `qq-${ids[0]}` : undefined}>
                    <div style={{ lineHeight: 2.2 }}>{splitTemplate(line, gap(g))} {ids.map((id) => <Flag key={id} qid={id} />)}</div>
                    {ids.map((id) => <ReviewNote key={id} qid={id} />)}
                  </div>
                );
              })}
            </div>
          )}
          {g.table && (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr>{g.table.headers.map((h: string) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {g.table.rows.map((r: string[], i: number) => (
                    <tr key={i}>{r.map((c, j) => <td key={j} id={(c.match(/\{\{(q\d+)\}\}/) ?? [])[1] ? `qq-${(c.match(/\{\{(q\d+)\}\}/) ?? [])[1]}` : undefined}>{splitTemplate(c, gap(g))}{[...c.matchAll(/\{\{(q\d+)\}\}/g)].map((m) => <ReviewNote key={m[1]} qid={m[1]} />)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {g.steps && (
            <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
              {g.steps.map((s: string, i: number) => {
                const ids = [...s.matchAll(/\{\{(q\d+)\}\}/g)].map((m) => m[1]);
                return (
                  <Fragment key={i}>
                    <div className="card flat center" style={{ width: '100%', maxWidth: 520, padding: 12 }} id={ids[0] ? `qq-${ids[0]}` : undefined}>
                      {splitTemplate(s, gap(g))}
                      {ids.map((id) => <ReviewNote key={id} qid={id} />)}
                    </div>
                    {i < g.steps.length - 1 && <div className="muted">↓</div>}
                  </Fragment>
                );
              })}
            </div>
          )}
          {!g.template && !g.table && !g.steps &&
            g.questions.map((qq: any) => (
              <div key={qq.id} className="q" id={`qq-${qq.id}`}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div><span className="qn">{qq.number}</span>{qq.text}</div>
                  <Flag qid={qq.id} />
                </div>
                {CHOICE.has(g.type) && (
                  <div className="row wrap mt" role="radiogroup" aria-label={`Question ${qq.number}`}>
                    {g.options.map((o: string) => (
                      <button key={o} role="radio" aria-checked={answers[qq.id] === o} disabled={readOnly}
                        className={`chip ${answers[qq.id] === o ? 'on' : ''}`} onClick={() => setAnswer(qq.id, o)}>{o}</button>
                    ))}
                  </div>
                )}
                {g.type === 'mcq' && (
                  <div className="stack mt" style={{ gap: 6 }} role="radiogroup" aria-label={`Question ${qq.number}`}>
                    {qq.options.map((o: string) => {
                      const letter = o.trim()[0];
                      return (
                        <button key={o} role="radio" aria-checked={answers[qq.id] === letter} disabled={readOnly}
                          className={`option ${answers[qq.id] === letter ? 'selected' : ''}`} onClick={() => setAnswer(qq.id, letter)}>{o}</button>
                      );
                    })}
                  </div>
                )}
                {SELECT.has(g.type) && (
                  <select className="input mt" style={{ maxWidth: 220 }} value={answers[qq.id] ?? ''} disabled={readOnly} aria-label={`Question ${qq.number}`} onChange={(e) => setAnswer(qq.id, e.target.value)}>
                    <option value="">Choose…</option>
                    {(g.headings ?? g.features ?? g.endings ?? g.options.map((k: string) => ({ key: k }))).map((h: any) => (
                      <option key={h.key} value={h.key}>{h.key}{h.text && g.type !== 'matching_headings' ? ` — ${h.text.slice(0, 40)}` : ''}</option>
                    ))}
                  </select>
                )}
                <ReviewNote qid={qq.id} />
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Reading/listening test runner. In a mock test the parent controls submission (`embedded`).
 */
export function IeltsPlayer({ attempt: initial, embedded, onSubmitted, strictAudio }: { attempt: AttemptDto; embedded?: boolean; onSubmitted?: (a: AttemptDto) => void; strictAudio?: boolean }) {
  const [attempt, setAttempt] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, string>>(initial.answers ?? {});
  const [flagged, setFlagged] = useState<string[]>(initial.flagged ?? []);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const dirty = useRef<Record<string, string>>({});
  const started = useRef(Date.parse(initial.startedAt));
  const submitted = attempt.status === 'submitted';
  const review = submitted ? attempt.result : null;
  const content = attempt.set.content;
  const questions = useMemo(() => content.groups.flatMap((g: any) => g.questions) as { id: string; number: number }[], [content]);
  useInterval(() => setNow(Date.now()), submitted ? null : 1000);

  const flush = useCallback(async () => {
    const pending = dirty.current;
    if (!Object.keys(pending).length && saveState !== 'unsaved') return;
    dirty.current = {};
    setSaveState('saving');
    try {
      await api.put(`/ielts/attempts/${attempt.id}/answers`, { answers: pending, flagged, elapsedSec: Math.round((Date.now() - started.current) / 1000) });
      setSaveState('saved');
    } catch (e) {
      dirty.current = { ...pending, ...dirty.current };
      setSaveState('error');
      setErr(errorMessage(e));
    }
  }, [attempt.id, flagged, saveState]);

  useEffect(() => {
    if (submitted || saveState !== 'unsaved') return;
    const t = setTimeout(() => void flush(), 1200);
    return () => clearTimeout(t);
  }, [answers, flagged, saveState, flush, submitted]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(dirty.current).length) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const setAnswer = (qid: string, v: string) => {
    setAnswers((a) => ({ ...a, [qid]: v }));
    dirty.current[qid] = v;
    setSaveState('unsaved');
  };
  const toggleFlag = (qid: string) => {
    setFlagged((f) => (f.includes(qid) ? f.filter((x) => x !== qid) : [...f, qid]));
    setSaveState('unsaved');
  };

  const deadline = attempt.deadline ? Date.parse(attempt.deadline) : null;
  const remaining = deadline ? Math.max(0, Math.floor((deadline - now) / 1000)) : null;
  const elapsed = Math.floor((now - started.current) / 1000);

  const submit = useCallback(async () => {
    setConfirm(false);
    setErr(null);
    try {
      const r = await api.post<AttemptDto>(`/ielts/attempts/${attempt.id}/submit`, { answers });
      dirty.current = {};
      setAttempt(r);
      setSaveState('saved');
      onSubmitted?.(r);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [attempt.id, answers, onSubmitted]);

  // Auto-submit when a timed practice runs out of time.
  useEffect(() => {
    if (!embedded && !submitted && remaining === 0) void submit();
  }, [remaining, embedded, submitted, submit]);

  const answeredCount = questions.filter((q) => (answers[q.id] ?? '').trim()).length;
  const scrollTo = (qid: string) => document.getElementById(`qq-${qid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="test-shell card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="test-header">
        <div style={{ flex: 1, minWidth: 200 }}>
          <b>{attempt.set.title}</b>
          <div className="tiny muted">{attempt.set.skill === 'reading' ? 'Reading' : 'Listening'} · {attempt.mode === 'practice' ? 'Practice mode' : attempt.mode === 'timed' ? 'Timed test' : 'Mock test'}</div>
        </div>
        {!submitted && (
          <>
            <span className="small muted" aria-live="polite" data-testid="save-state">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : saveState === 'error' ? '⚠ Not saved' : 'Unsaved changes'}
            </span>
            {remaining !== null ? (
              <span className={`timer ${remaining < 120 ? 'low' : ''}`} title="Time remaining">⏱ {formatDuration(remaining)}</span>
            ) : (
              <span className="timer" title="Time spent">⏱ {formatDuration(elapsed)}</span>
            )}
            {!embedded && <button className="btn" onClick={() => { void flush(); setConfirm(true); }} data-testid="submit-test">Submit</button>}
          </>
        )}
        {submitted && (
          <span className="badge success" data-testid="score">Score {attempt.score}/{attempt.total}{attempt.band != null ? ` · Band ≈ ${attempt.band}` : ''}</span>
        )}
      </div>
      <ErrorBox error={err} />
      {submitted && !embedded && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="row wrap">
            <b>Result: {attempt.score} of {attempt.total} correct</b>
            {attempt.band != null && <span className="badge primary">Estimated band {attempt.band}</span>}
            {attempt.result?.scaled && <span className="tiny muted">(scaled from a {attempt.total}-question set to the 40-question scale)</span>}
            <span className="small muted">Time: {formatDuration(attempt.elapsedSec)} of {formatDuration(attempt.set.timeLimitSec)} suggested</span>
          </div>
          <Unofficial />
        </div>
      )}
      <div className="test-body">
        <div className="test-pane passage">
          {attempt.set.skill === 'listening' ? (
            <div className="stack">
              <h2>{attempt.set.title}</h2>
              <AudioPlayer src={mediaUrl(content.audio)} attemptId={attempt.id} strict={!!strictAudio && !submitted} locked={false} />
              <p className="small muted" style={{ fontFamily: 'var(--font)' }}>Read the questions first, then play the recording and answer as you listen.</p>
              {submitted && content.transcript && (
                <div className="card flat">
                  <h3>Transcript</h3>
                  {content.transcript.map((l: string, i: number) => <p key={i} className="small">{l}</p>)}
                </div>
              )}
            </div>
          ) : (
            content.passages.map((p: any) => (
              <article key={p.id}>
                <h2>{p.title}</h2>
                {p.paragraphs.map((para: any, i: number) => (
                  <p key={i}>{para.label && <b style={{ marginRight: 8, fontFamily: 'var(--font)' }}>{para.label}</b>}{para.text}</p>
                ))}
              </article>
            ))
          )}
        </div>
        <div className="test-pane">
          <QuestionGroups content={content} answers={answers} setAnswer={setAnswer} flagged={flagged} toggleFlag={toggleFlag} review={review} readOnly={submitted} />
        </div>
      </div>
      <div className="test-footer" aria-label="Question navigation">
        <span className="small muted" style={{ marginRight: 8, whiteSpace: 'nowrap' }}>{answeredCount}/{questions.length} answered</span>
        {questions.map((q) => {
          const r = review?.perQuestion[q.id];
          const cls = r ? (r.correct ? 'correct' : 'wrong') : (answers[q.id] ?? '').trim() ? 'answered' : '';
          return (
            <button key={q.id} className={`qnav ${cls} ${flagged.includes(q.id) ? 'flagged' : ''}`} onClick={() => scrollTo(q.id)} aria-label={`Go to question ${q.number}`}>
              {q.number}
            </button>
          );
        })}
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Submit your answers?">
        <p>You have answered <b>{answeredCount}</b> of {questions.length} questions{flagged.length ? ` and marked ${flagged.length} for review` : ''}. You cannot change answers after submitting.</p>
        <div className="row">
          <button className="btn" onClick={submit} data-testid="confirm-submit">Submit answers</button>
          <button className="btn secondary" onClick={() => setConfirm(false)}>Keep working</button>
        </div>
      </Modal>
    </div>
  );
}
