import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, useApi } from '../lib/hooks';
import { SpeakingRecorder } from '../components/SpeakingRecorder';
import { Empty, ErrorBox, Loading, PageHeader } from '../components/ui';
import { IeltsTabs } from './Ielts';

export function SpeakingPracticePage() {
  const { data, error, loading, reload } = useApi<any>('/ielts/speaking/prompts');
  const history = useApi<any[]>('/ielts/speaking/sessions');
  const [part, setPart] = useState<1 | 2 | 3>(1);
  const [pIdx, setPIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const list = part === 1 ? data.part1 : part === 2 ? data.part2 : data.part3;
  const prompt = list[pIdx % list.length];
  const question = part === 2 ? prompt.text : prompt.questions[qIdx % prompt.questions.length];
  return (
    <div className="stack lg">
      <PageHeader title="IELTS Speaking practice" subtitle="Practise alone any time. Your answer is transcribed and analysed; no audio is stored." actions={<Link to="/speaking" className="btn secondary">Practise with a partner instead</Link>} />
      <IeltsTabs />
      {!data.aiFeedback && <div className="alert info small">AI feedback is not configured on this server, so you'll get measurable transcript statistics (pace, fillers, vocabulary range, length) but no band estimate.</div>}
      <div className="row wrap">
        {[1, 2, 3].map((p) => (
          <button key={p} className={`chip ${part === p ? 'on' : ''}`} onClick={() => { setPart(p as 1 | 2 | 3); setPIdx(0); setQIdx(0); }}>
            Part {p}: {p === 1 ? 'Introduction & interview' : p === 2 ? 'Long turn (cue card)' : 'Discussion'}
          </button>
        ))}
      </div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <div className="row between">
            <span className="badge primary">Part {part} · {prompt.topic}</span>
            <div className="row">
              <button className="btn ghost sm" onClick={() => { setPIdx((i) => i + 1); setQIdx(0); }}>New topic</button>
              {part !== 2 && <button className="btn ghost sm" onClick={() => setQIdx((i) => i + 1)}>Next question</button>}
            </div>
          </div>
          {part === 2 ? (
            <div>
              <h2>{prompt.text}</h2>
              <div className="small">You should say:</div>
              <ul>{prompt.bullets.map((b: string) => <li key={b}>{b}</li>)}</ul>
              <p className="small muted">You have one minute to prepare, then speak for up to two minutes.</p>
            </div>
          ) : (
            <h2 data-testid="speaking-question">{question}</h2>
          )}
          <SpeakingRecorder
            key={`${part}-${pIdx}-${qIdx}`}
            part={part}
            question={question}
            promptId={prompt.id}
            prepSeconds={part === 2 ? 60 : 0}
            speakSeconds={part === 2 ? 120 : part === 1 ? 60 : 90}
            serverStt={data.serverTranscription}
            onResult={() => history.reload()}
          />
        </div>
        <div className="card">
          <h3>Tips for Part {part}</h3>
          <ul className="small">
            {part === 1 && <><li>Give 2–3 sentence answers: answer, reason, example.</li><li>Keep it natural — this part is about familiar topics.</li></>}
            {part === 2 && <><li>Use the minute to note key words for each bullet point.</li><li>Keep talking until the timer ends; tell a story with details.</li></>}
            {part === 3 && <><li>Give opinions with reasons and compare viewpoints.</li><li>Use phrases like “It depends on…”, “On the other hand…”.</li></>}
          </ul>
          <h3>Recent practice</h3>
          {history.loading ? <Loading /> : !history.data?.length ? <Empty icon="🗣️" title="No speaking practice yet" /> : (
            <div className="list">
              {history.data.slice(0, 8).map((s) => (
                <div key={s.id} className="list-item small">
                  <span className="badge">P{s.part}</span>
                  <span style={{ flex: 1 }}>{s.question}</span>
                  <span>{s.band_estimate ?? '—'}</span>
                  <span className="tiny muted">{formatDate(s.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
