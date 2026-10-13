import { useEffect, useRef, useState } from 'react';
import { countWords } from '@app/shared';
import { api } from '../lib/api';
import { errorMessage, formatDuration, useInterval } from '../lib/hooks';
import { WritingVisual } from './Charts';

export interface PromptDto {
  id: string;
  slug: string;
  testType: string;
  task: number;
  kind: string;
  title: string;
  prompt: string;
  instructions: string;
  visual: any;
  minWords: number;
  timeLimitSec: number;
  isPremium: boolean;
}

export function PromptCard({ prompt }: { prompt: PromptDto }) {
  return (
    <div className="card stack">
      <div className="row wrap">
        <span className="badge primary">{prompt.testType === 'general' ? 'General Training' : prompt.testType === 'academic' ? 'Academic' : 'Academic & GT'} · Task {prompt.task}</span>
        <span className="badge">{formatDuration(prompt.timeLimitSec)} · {prompt.minWords}+ words</span>
      </div>
      <p style={{ fontWeight: 600 }}>{prompt.prompt}</p>
      {prompt.visual && <WritingVisual visual={prompt.visual} />}
      <p className="small muted" style={{ margin: 0 }}>{prompt.instructions}</p>
    </div>
  );
}

/** Autosaving essay editor used for practice and inside mock tests. */
export function WritingEditor({
  prompt,
  initialText,
  submissionId: initialId,
  mockAttemptId,
  deadline,
  onSaved,
  readOnly,
}: {
  prompt: PromptDto;
  initialText: string;
  submissionId?: string | null;
  mockAttemptId?: string;
  deadline?: string | null;
  onSaved?: (id: string) => void;
  readOnly?: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [subId, setSubId] = useState<string | null>(initialId ?? null);
  const [state, setState] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const started = useRef(Date.now());
  const latest = useRef(text);
  latest.current = text;
  useInterval(() => setNow(Date.now()), 1000);

  const save = async () => {
    setState('saving');
    try {
      const r = await api.put<{ id: string }>('/ielts/writing/drafts', {
        promptId: prompt.id,
        text: latest.current,
        elapsedSec: Math.round((Date.now() - started.current) / 1000),
        mockAttemptId,
        submissionId: subId ?? undefined,
      });
      setSubId(r.id);
      onSaved?.(r.id);
      setState(latest.current === text ? 'saved' : 'unsaved');
      setErr(null);
    } catch (e) {
      setState('error');
      setErr(errorMessage(e));
    }
  };

  useEffect(() => {
    if (state !== 'unsaved' || readOnly) return;
    const t = setTimeout(() => void save(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, state]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state === 'unsaved' || state === 'saving') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  const words = countWords(text);
  const remaining = deadline ? Math.max(0, Math.floor((Date.parse(deadline) - now) / 1000)) : null;
  const elapsed = Math.floor((now - started.current) / 1000);
  return (
    <div className="stack">
      <div className="row between wrap small">
        <span className={words < prompt.minWords ? 'badge warning' : 'badge success'} data-testid="word-count">{words} words {words < prompt.minWords ? `(minimum ${prompt.minWords})` : '✓'}</span>
        <span className="row">
          <span className="muted" aria-live="polite" data-testid="writing-save-state">{state === 'saving' ? 'Saving…' : state === 'saved' ? (subId ? '✓ Draft saved' : '') : state === 'error' ? '⚠ Not saved' : 'Editing…'}</span>
          {remaining !== null ? <span className={`timer ${remaining < 300 ? 'low' : ''}`}>⏱ {formatDuration(remaining)}</span> : <span className="timer" title="Suggested time">⏱ {formatDuration(elapsed)} / {formatDuration(prompt.timeLimitSec)}</span>}
        </span>
      </div>
      <textarea
        className="editor"
        value={text}
        readOnly={readOnly}
        spellCheck={false}
        placeholder="Write your response here. Leave a blank line between paragraphs."
        aria-label={`Response to ${prompt.title}`}
        onChange={(e) => {
          setText(e.target.value);
          setState('unsaved');
        }}
        data-testid="writing-editor"
      />
      <div className="tiny muted">Browser spell-check is turned off, as in the computer-delivered test.</div>
      {err && <div className="alert error">{err}</div>}
    </div>
  );
}
