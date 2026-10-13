import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { Badge, Button, Note } from '../components/ui';
import { COACH_SUGGESTIONS } from '../services/coach';
import { clearCoach, sendCoach } from '../store/actions';
import { useApp } from '../store/AppStore';

function Rich({ text }: { text: string }) {
  // Minimal **bold** support; everything else is plain text (no HTML injection).
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </>
  );
}

export default function CoachPage() {
  const { data, run } = useApp();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [data.coach.length]);
  const send = (t: string) => {
    if (run(sendCoach, t)) setText('');
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };
  return (
    <>
      <PageHead title="Coach" sub="Ask about today’s training, technique, substitutions, food and recovery." actions={data.coach.length > 0 && <Button variant="ghost" size="sm" onClick={() => run(clearCoach)}>Clear chat</Button>} />
      <Note tone="info" title="Rule-based demo coach">
        No AI service is connected. Answers come from your saved plan, the exercise library and BODYQUEST’s safety rules, and are generated on this device. <Badge>Private</Badge>
      </Note>
      <div className="chat mt-3" aria-live="polite">
        {data.coach.length === 0 && (
          <div className="msg coach">
            Hi! I’m your BODYQUEST coach. Try one of these questions:
            <div className="chips mt-2">
              {COACH_SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {data.coach.map((m) => (
          <div key={m.id} className={`msg ${m.role} ${m.urgent ? 'urgent' : ''}`} role={m.urgent ? 'alert' : undefined}>
            {m.urgent && (
              <strong style={{ display: 'block', color: 'var(--danger)' }}>
                <Icon name="alert" size={16} /> Safety alert
              </strong>
            )}
            <Rich text={m.text} />
            {m.links && m.links.length > 0 && (
              <div className="row mt-2">
                {m.links.map((l) => (
                  <Link key={l.to + l.label} to={l.to} className="btn btn-secondary btn-sm">
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {data.coach.length > 0 && (
        <div className="chips mt-3" aria-label="Suggested questions">
          {COACH_SUGGESTIONS.slice(0, 4).map((s) => (
            <button key={s} type="button" className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form className="chat-input" onSubmit={submit}>
        <label htmlFor="coach-input" className="sr-only">
          Message the coach
        </label>
        <input id="coach-input" className="input" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="e.g. How do I do a reverse lunge?" />
        <Button type="submit" icon="chat" disabled={!text.trim()}>
          Send
        </Button>
      </form>
    </>
  );
}
