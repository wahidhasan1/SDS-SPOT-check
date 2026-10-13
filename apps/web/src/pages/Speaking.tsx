import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PRACTICE_MODE_LABELS, CEFR_LABELS, type CallHistoryItem, type PracticeMode } from '@app/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCall } from '../lib/call';
import { formatDate, formatDuration, useApi, useInterval } from '../lib/hooks';
import { Avatar, Empty, ErrorBox, LevelBadge, Loading, Modal, PageHeader } from '../components/ui';

interface TopicDto {
  id: string;
  label: string;
  mode: PracticeMode | 'any';
  premium: boolean;
}

export function SpeakingHub() {
  const { user, entitlements, refreshEntitlements } = useAuth();
  const { phase, match, startMatching, cancelMatching } = useCall();
  const topics = useApi<TopicDto[]>('/calls/topics');
  const [mode, setMode] = useState<PracticeMode>('free_talk');
  const [topicId, setTopicId] = useState('random');
  const [pref, setPref] = useState<'similar' | 'any' | 'higher'>('similar');
  const [now, setNow] = useState(Date.now());
  useInterval(() => setNow(Date.now()), phase === 'queued' ? 1000 : null);
  useEffect(() => {
    void refreshEntitlements();
  }, [refreshEntitlements]);

  const premium = entitlements?.plan === 'premium';
  const limits = entitlements?.limits;
  const callsLeft = limits?.callsPerDay == null ? null : Math.max(0, limits.callsPerDay - (entitlements?.usageToday.calls ?? 0));
  const visibleTopics = (topics.data ?? []).filter((t) => t.mode === 'any' || t.mode === mode);
  const searching = phase === 'queued' || phase === 'checking_mic';
  const waited = match.queuedAt ? Math.floor((now - match.queuedAt) / 1000) : 0;
  const needsAge = user && user.birthYear == null;

  const start = () => void startMatching(mode, topicId, premium ? pref : undefined);

  return (
    <div className="stack lg">
      <PageHeader
        title="Speaking practice"
        subtitle="Talk with a real learner, or practise on your own with feedback."
        actions={<Link className="btn secondary" to="/speaking/history">📞 Call history</Link>}
      />
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card pad-lg">
          {!searching ? (
            <div className="stack">
              <h2>🎧 Find a speaking partner</h2>
              <p className="muted">
                You'll be connected anonymously with another learner for a live voice call. Calls are not recorded. Your partner sees
                only <b>{user?.anonName}</b> and {user?.privacy.showLevelToPartners ? 'your level' : 'no level (hidden in privacy settings)'}.
              </p>
              <div className="row wrap">
                <span className="muted small">Your level:</span>
                <LevelBadge level={user?.cefrLevel} />
                {!user?.cefrLevel && <Link to="/assessment" className="small">Take the level test</Link>}
              </div>
              <div>
                <div className="small muted mb" style={{ marginBottom: 6, fontWeight: 700 }}>Practice mode</div>
                <div className="row wrap">
                  {(['free_talk', 'ielts_speaking'] as PracticeMode[]).map((m) => (
                    <button key={m} className={`chip ${mode === m ? 'on' : ''}`} onClick={() => { setMode(m); setTopicId(m === 'ielts_speaking' ? 'ielts_part1' : 'random'); }}>
                      {m === 'free_talk' ? '💬 ' : '🎯 '}
                      {PRACTICE_MODE_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="small muted" style={{ marginBottom: 6, fontWeight: 700 }}>
                  {mode === 'ielts_speaking' ? 'Focus' : 'Topic (optional)'}
                </div>
                {topics.loading ? <Loading /> : (
                  <div className="row wrap">
                    {visibleTopics.map((t) => {
                      const locked = t.premium && !limits?.premiumTopics;
                      return (
                        <button key={t.id} className={`chip ${topicId === t.id ? 'on' : ''}`} disabled={locked} title={locked ? 'Premium topic' : ''} onClick={() => setTopicId(t.id)}>
                          {t.label} {locked && '🔒'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {premium && limits?.matchingPreferences && (
                <label className="field">
                  Partner level preference
                  <select className="input" value={pref} onChange={(e) => setPref(e.target.value as any)}>
                    <option value="similar">Similar level (recommended)</option>
                    <option value="higher">Same or higher level</option>
                    <option value="any">Any level (fastest)</option>
                  </select>
                </label>
              )}
              {match.message && <div className="alert warning" role="alert">{match.message}</div>}
              {needsAge && <div className="alert warning">Add your birth year in your <Link to="/profile">profile</Link> to use live calls.</div>}
              <button className="btn lg block" onClick={start} disabled={callsLeft === 0} data-testid="start-call">
                🎙️ Start call
              </button>
              <div className="small muted center">
                {callsLeft === null ? 'Unlimited calls on your plan' : `${callsLeft} of ${limits?.callsPerDay} calls left today`} · up to {limits?.maxCallMinutes ?? '…'} min per call
                {callsLeft === 0 && <> · <Link to="/subscription">Upgrade</Link></>}
              </div>
            </div>
          ) : (
            <div className="match-stage" aria-live="polite">
              <div className="pulse" aria-hidden>
                <span className="ring" />
                <span className="ring" />
                <span className="ring" />
                <div className="core">🎧</div>
              </div>
              <h2 data-testid="match-status">{phase === 'checking_mic' ? 'Checking your microphone…' : 'Finding a speaking partner…'}</h2>
              <div className="muted">
                {PRACTICE_MODE_LABELS[mode]} · {visibleTopics.find((t) => t.id === topicId)?.label ?? 'Random'}
              </div>
              {phase === 'queued' && (
                <>
                  <div className="call-timer" style={{ fontSize: '1.4rem' }}>{formatDuration(waited)}</div>
                  <div className="small muted">
                    {match.waitingCount == null
                      ? 'Looking for learners online…'
                      : match.waitingCount === 0
                        ? 'No other learners are searching right now. Stay here and we will connect you as soon as someone joins.'
                        : `${match.waitingCount} other learner${match.waitingCount === 1 ? ' is' : 's are'} searching in this mode.`}
                  </div>
                  {match.levelRange != null && match.levelRange > 1 && (
                    <div className="badge accent">Widening level range to ±{match.levelRange} to find someone faster</div>
                  )}
                </>
              )}
              <button className="btn secondary" onClick={cancelMatching} data-testid="cancel-match">Cancel matching</button>
            </div>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <h3>🤖 Practise without a partner</h3>
            <p className="muted small">IELTS Speaking Parts 1–3 with timers, transcription and feedback. Works any time, even when nobody is online.</p>
            <Link className="btn secondary" to="/ielts/speaking">Start solo speaking practice</Link>
          </div>
          <div className="card">
            <h3>🛡️ Staying safe</h3>
            <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
              <li>Never share your phone number, address or social accounts.</li>
              <li>Use Report or Block at any time during or after a call.</li>
              <li>Blocked users are never matched with you again, on any device.</li>
              <li>Calls are not recorded. <Link to="/guidelines">Community guidelines</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATE_LABEL: Record<string, string> = {
  requesting_mic: 'Starting microphone…',
  connecting: 'Establishing connection…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  ended: 'Call completed',
  failed: 'Connection failed',
};

export function CallPage() {
  const { session, snapshot, audioBlocked, enableAudio } = useCall();
  const nav = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [level, setLevel] = useState(0);
  const [receiving, setReceiving] = useState(false);
  const [promptIdx, setPromptIdx] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  useInterval(() => setNow(Date.now()), 500);
  useInterval(async () => {
    if (!session) return;
    const s = await session.getAudioStats();
    setLevel(s.audioLevel ?? 0);
    setReceiving(s.bytesReceived > 0);
  }, snapshot?.state === 'connected' ? 400 : null);

  useEffect(() => {
    if (!session) nav('/speaking', { replace: true });
  }, [session, nav]);
  useEffect(() => {
    if (snapshot && (snapshot.state === 'ended' || snapshot.state === 'failed')) {
      const t = setTimeout(() => nav('/speaking/summary', { replace: true }), 600);
      return () => clearTimeout(t);
    }
  }, [snapshot, nav]);

  if (!session || !snapshot) return <Loading />;
  const info = session.info;
  const elapsed = snapshot.connectedAt ? Math.floor((now - snapshot.connectedAt) / 1000) : 0;
  const remaining = info.maxDurationSec - elapsed;
  const stateLabel = snapshot.state === 'connecting' && snapshot.partnerState === 'reconnecting' ? 'Partner is reconnecting…' : STATE_LABEL[snapshot.state];
  const dot = snapshot.state === 'connected' ? 'ok' : snapshot.state === 'failed' ? 'bad' : 'warn';

  return (
    <div className="call-screen">
      <div className="card call-main">
        <div className="row small">
          <span className={`status-dot ${dot}`} />
          <span data-testid="call-state">{stateLabel}</span>
          {snapshot.partnerState === 'reconnecting' && snapshot.state === 'connected' && <span className="badge warning">Partner's connection is unstable</span>}
        </div>
        <div className={level > 0.02 ? 'speaking-ring' : ''} style={{ borderRadius: '50%' }}>
          <Avatar avatar={info.partner.avatar} size="xl" />
        </div>
        <div>
          <h2 style={{ marginBottom: 4 }} data-testid="partner-name">{info.partner.anonName}</h2>
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            <LevelBadge level={info.partner.level} />
            {info.partner.level && <span className="muted small">{CEFR_LABELS[info.partner.level]}</span>}
            {snapshot.partnerMuted && <span className="badge warning">🔇 Partner muted</span>}
          </div>
        </div>
        <div className="muted">{PRACTICE_MODE_LABELS[info.mode]} · {info.topicLabel}</div>
        <div className="call-timer" data-testid="call-timer">{formatDuration(elapsed)}</div>
        {snapshot.state === 'connected' && (
          <div className="small muted">{receiving ? '🔊 Receiving audio' : 'Waiting for audio…'} · {formatDuration(Math.max(0, remaining))} left</div>
        )}
        {snapshot.secondsLeftWarning != null && <div className="alert warning">This call will end in about a minute (plan limit).</div>}
        {audioBlocked && (
          <button className="btn" onClick={enableAudio}>🔊 Tap to enable call audio</button>
        )}
        {snapshot.error && <div className="alert error">{snapshot.error}</div>}
        <div className="call-controls">
          <div className="center">
            <button
              className={`round-btn ${snapshot.muted ? 'muted' : ''}`}
              aria-pressed={snapshot.muted}
              aria-label={snapshot.muted ? 'Unmute microphone' : 'Mute microphone'}
              onClick={() => session.setMuted(!snapshot.muted)}
              data-testid="mute-btn"
            >
              {snapshot.muted ? '🔇' : '🎙️'}
            </button>
            <div className="round-label">{snapshot.muted ? 'Muted' : 'Mic on'}</div>
          </div>
          <div className="center">
            <button className="round-btn end" aria-label="End call" onClick={() => session.hangUp()} data-testid="end-call">
              📞
            </button>
            <div className="round-label">End call</div>
          </div>
          <div className="center">
            <button className="round-btn" aria-label="Report or block" onClick={() => setReportOpen(true)}>
              🚩
            </button>
            <div className="round-label">Report</div>
          </div>
        </div>
      </div>
      <div className="stack">
        {info.mode === 'ielts_speaking' && info.ielts ? (
          <IeltsPartnerPanel />
        ) : (
          <div className="card">
            <h3>💡 Conversation prompts</h3>
            <p className="small muted">Optional ideas — talk about anything you like.</p>
            {info.prompts.length === 0 ? (
              <p className="muted">Free conversation. Introduce yourselves and see where it goes!</p>
            ) : (
              <>
                <div className="alert info" style={{ fontSize: '1.05rem' }}>{info.prompts[promptIdx % info.prompts.length]}</div>
                <button className="btn secondary sm mt" onClick={() => setPromptIdx((i) => i + 1)}>Next prompt →</button>
              </>
            )}
          </div>
        )}
        <div className="card small muted">
          Tip: use headphones to avoid echo. If you can't hear anything, check your volume and that the right speaker is selected.
        </div>
      </div>
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} callId={info.id} />
    </div>
  );
}

function IeltsPartnerPanel() {
  const { session, snapshot } = useCall();
  const [now, setNow] = useState(Date.now());
  useInterval(() => setNow(Date.now()), 500);
  if (!session || !snapshot || !session.info.ielts) return null;
  const script = session.info.ielts;
  const step = snapshot.ieltsStep;
  const me = session.info.role;
  const send = (s: Partial<NonNullable<typeof step>>) =>
    session.sendIeltsStep({ part: 1, index: 0, phase: 'asking', candidate: step?.candidate ?? 'answerer', ...step, ...s, startedAt: Date.now() } as any);

  if (!step) {
    return (
      <div className="card stack">
        <h3>🎯 IELTS Speaking partner mode</h3>
        <p className="small muted">One of you plays the candidate, the other reads the examiner questions. You can swap roles afterwards. This practises the format; it is not an official test.</p>
        <div className="row wrap">
          <button className="btn" onClick={() => send({ candidate: me, part: 1, index: 0, phase: 'asking' })}>I'll be the candidate</button>
          <button className="btn secondary" onClick={() => send({ candidate: me === 'offerer' ? 'answerer' : 'offerer', part: 1, index: 0, phase: 'asking' })}>My partner is the candidate</button>
        </div>
      </div>
    );
  }
  const iAmCandidate = step.candidate === me;
  const secs = Math.floor((now - step.startedAt) / 1000);
  const p2 = script.part2;
  let body: React.ReactNode;
  if (step.phase === 'done') {
    body = (
      <>
        <div className="alert success">Practice complete. Well done!</div>
        <button className="btn" onClick={() => send({ candidate: step.candidate === 'offerer' ? 'answerer' : 'offerer', part: 1, index: 0, phase: 'asking' })}>Swap roles and restart</button>
      </>
    );
  } else if (step.part === 1 || step.part === 3) {
    const qs = step.part === 1 ? script.part1.questions : script.part3.questions;
    const q = qs[step.index];
    body = (
      <>
        <div className="badge primary">Part {step.part}{step.part === 1 ? ` · ${script.part1.topic}` : ' · Discussion'} · Question {step.index + 1}/{qs.length}</div>
        {iAmCandidate ? (
          <div className="alert info">Listen to your partner's question and answer naturally{step.part === 1 ? ' in 2–3 sentences' : ' with reasons and examples'}.</div>
        ) : (
          <div className="alert info" style={{ fontSize: '1.05rem' }}>Ask: “{q}”</div>
        )}
        {!iAmCandidate && (
          <button
            className="btn"
            onClick={() =>
              step.index + 1 < qs.length
                ? send({ index: step.index + 1 })
                : step.part === 1
                  ? send({ part: 2, index: 0, phase: 'preparing' })
                  : send({ phase: 'done' })
            }
          >
            {step.index + 1 < qs.length ? 'Next question' : step.part === 1 ? 'Go to Part 2' : 'Finish'}
          </button>
        )}
      </>
    );
  } else {
    const limit = step.phase === 'preparing' ? p2.prepSeconds : p2.speakSeconds;
    const left = Math.max(0, limit - secs);
    body = (
      <>
        <div className="badge primary">Part 2 · {step.phase === 'preparing' ? 'Preparation' : 'Long turn'}</div>
        <div className="card flat" style={{ background: 'var(--surface-2)' }}>
          <b>{p2.cueCard}</b>
          <div className="small">You should say:</div>
          <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{p2.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
        <div className={`timer ${left < 15 ? 'low' : ''}`}>{formatDuration(left)}</div>
        <div className="small muted">{step.phase === 'preparing' ? (iAmCandidate ? 'Make notes. You will speak for 1–2 minutes.' : 'Your partner is preparing (1 minute).') : iAmCandidate ? 'Speak until the timer ends.' : 'Listen without interrupting.'}</div>
        {!iAmCandidate && (
          <button className="btn" onClick={() => (step.phase === 'preparing' ? send({ phase: 'speaking' }) : send({ part: 3, index: 0, phase: 'asking' }))}>
            {step.phase === 'preparing' ? 'Start speaking timer' : 'Go to Part 3'}
          </button>
        )}
      </>
    );
  }
  return (
    <div className="card stack">
      <div className="row between">
        <h3 style={{ margin: 0 }}>🎯 IELTS partner</h3>
        <span className="badge">{iAmCandidate ? 'You: candidate' : 'You: examiner'}</span>
      </div>
      {body}
    </div>
  );
}

const REASONS: [string, string][] = [
  ['harassment', 'Harassment or bullying'],
  ['hate_speech', 'Hate speech'],
  ['sexual_content', 'Sexual or explicit content'],
  ['spam_or_scam', 'Spam, scam or advertising'],
  ['inappropriate_language', 'Offensive language'],
  ['underage', 'Appears to be under 18'],
  ['not_practising_english', 'Not practising English / disruptive'],
  ['other', 'Something else'],
];

export function ReportModal({ open, onClose, callId }: { open: boolean; onClose: () => void; callId: string }) {
  const [reason, setReason] = useState('harassment');
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(true);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setState('busy');
    setErr(null);
    try {
      await api.post('/safety/report', { callId, reason, details: details || undefined, alsoBlock: block });
      setState('done');
    } catch (e: any) {
      setErr(e.message);
      setState('idle');
    }
  };
  const blockOnly = async () => {
    setState('busy');
    try {
      await api.post('/safety/block', { callId });
      setState('done');
    } catch (e: any) {
      setErr(e.message);
      setState('idle');
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Report or block">
      {state === 'done' ? (
        <div className="stack">
          <div className="alert success">Thank you. Our moderators will review this. {block ? 'You will not be matched with this person again.' : ''}</div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      ) : (
        <div className="stack">
          <ErrorBox error={err} />
          <div className="stack" role="radiogroup">
            {REASONS.map(([k, l]) => (
              <label key={k} className={`option ${reason === k ? 'selected' : ''}`}>
                <input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} /> {l}
              </label>
            ))}
          </div>
          <label className="field">
            Details (optional)
            <textarea className="input" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
          <label className="row small"><input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} /> Also block this person (ends the call if it is still active)</label>
          <div className="row wrap">
            <button className="btn danger" disabled={state === 'busy'} onClick={submit}>Submit report</button>
            <button className="btn secondary" disabled={state === 'busy'} onClick={blockOnly}>Block only</button>
          </div>
        </div>
      )}
    </Modal>
  );
}



const END_TEXT: Record<string, string> = {
  hangup: 'You ended the call.',
  partner_ended: 'Your partner ended the call.',
  partner_disconnected: 'Your partner lost their connection.',
  connection_failed: 'The connection failed and could not be recovered.',
  connect_timeout: 'We could not establish an audio connection in time.',
  time_limit: 'The call reached your plan’s time limit.',
  mic_denied: 'Microphone access was denied.',
  mic_error: 'The microphone could not be started.',
  blocked: 'The call ended because a user was blocked.',
  moderation: 'The call was ended by moderation.',
  client_reset: 'The call ended because the page was reloaded.',
};

export function CallSummary() {
  const { session, snapshot, clearSession } = useCall();
  const nav = useNavigate();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [word, setWord] = useState('');
  const [savedWords, setSavedWords] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!session) nav('/speaking', { replace: true });
  }, [session, nav]);
  if (!session || !snapshot) return null;
  const info = session.info;
  const connected = snapshot.connectedAt != null;
  const statusLabel = { completed: 'Completed', short: 'Short call', failed: 'Not connected', cancelled: 'Cancelled' }[snapshot.endStatus ?? 'failed'];

  const sendFeedback = async () => {
    try {
      await api.post(`/calls/${info.id}/feedback`, { rating, comment: comment || undefined });
      setSent(true);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const saveWord = async () => {
    if (!word.trim()) return;
    try {
      await api.post('/vocabulary/saved', { word: word.trim(), source: 'call', context: `Call about ${info.topicLabel}` });
      setSavedWords((w) => [...w, word.trim()]);
      setWord('');
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const again = () => {
    clearSession();
    nav('/speaking');
  };
  return (
    <div className="stack lg" style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="card pad-lg center stack">
        <div style={{ fontSize: 44 }}>{connected ? '🎉' : '📵'}</div>
        <h1 data-testid="summary-title">{connected ? 'Call completed' : 'Call ended'}</h1>
        <p className="muted">{END_TEXT[snapshot.endReason ?? ''] ?? 'The call has ended.'}</p>
        <div className="grid cols-4">
          <div className="stat"><span className="v" data-testid="summary-duration">{formatDuration(snapshot.durationSec)}</span><span className="l">Duration</span></div>
          <div className="stat"><span className="v" style={{ fontSize: '1rem' }}>{PRACTICE_MODE_LABELS[info.mode]}</span><span className="l">Mode</span></div>
          <div className="stat"><span className="v" style={{ fontSize: '1rem' }}>{info.topicLabel}</span><span className="l">Topic</span></div>
          <div className="stat"><span className="v" style={{ fontSize: '1rem' }}>{statusLabel}</span><span className="l">Status</span></div>
        </div>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <button className="btn lg" onClick={again}>🔁 Find another partner</button>
          <button className="btn secondary" onClick={() => setReportOpen(true)}>🚩 Report or block</button>
        </div>
      </div>
      <ErrorBox error={err} />
      {connected && (
        <div className="grid cols-2">
          <div className="card stack">
            <h3>How was your partner?</h3>
            {sent ? <div className="alert success">Thanks for your feedback.</div> : (
              <>
                <div className="row" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} className={`chip ${rating >= n ? 'on' : ''}`} onClick={() => setRating(n)} aria-label={`${n} stars`}>★</button>
                  ))}
                </div>
                <textarea className="input" rows={2} maxLength={500} placeholder="Optional private note (only stored for safety and quality)" value={comment} onChange={(e) => setComment(e.target.value)} />
                <button className="btn" disabled={!rating} onClick={sendFeedback}>Send feedback</button>
              </>
            )}
          </div>
          <div className="card stack">
            <h3>Save new words from this call</h3>
            <p className="small muted">We don't record or transcribe calls, so add any words you want to remember.</p>
            <div className="row">
              <input className="input" value={word} placeholder="e.g. itinerary" onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveWord()} />
              <button className="btn" onClick={saveWord}>Save</button>
            </div>
            {savedWords.length > 0 && <div className="small">Saved: {savedWords.join(', ')}</div>}
          </div>
        </div>
      )}
      <div className="card">
        <h3>Suggested next steps</h3>
        <div className="grid cols-3">
          <Link className="tile" to="/ielts/speaking"><span className="ico">🗣️</span><span className="t">Solo speaking practice</span><span className="small muted">Get transcript-based feedback</span></Link>
          <Link className="tile" to="/vocabulary"><span className="ico">📚</span><span className="t">Review vocabulary</span><span className="small muted">Words due for review</span></Link>
          <Link className="tile" to="/grammar"><span className="ico">✍️</span><span className="t">Grammar lesson</span><span className="small muted">Recommended for your level</span></Link>
        </div>
      </div>
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} callId={info.id} />
    </div>
  );
}

export function CallHistoryPage() {
  const { data, error, loading, reload } = useApi<CallHistoryItem[]>('/calls/history');
  const statusBadge: Record<string, string> = { completed: 'success', short: 'warning', failed: 'danger', cancelled: '' };
  return (
    <div className="stack">
      <PageHeader title="Call history" subtitle="Your practice calls. Partners are shown only by their anonymous names." />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Loading /> : !data?.length ? (
        <div className="card"><Empty icon="📞" title="No calls yet">Find a speaking partner to start practising.</Empty></div>
      ) : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Date</th><th>Partner</th><th>Mode · Topic</th><th>Duration</th><th>Status</th><th>Feedback</th></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>{formatDate(c.startedAt)}</td>
                  <td>{c.partner ? <span className="row"><Avatar avatar={c.partner.avatar} />{c.partner.anonName}</span> : '—'}</td>
                  <td>{PRACTICE_MODE_LABELS[c.mode]}<div className="small muted">{c.topicLabel}</div></td>
                  <td>{formatDuration(c.durationSec)}</td>
                  <td><span className={`badge ${statusBadge[c.status]}`}>{c.status}</span></td>
                  <td className="small">{c.myFeedback ? `You: ${'★'.repeat(c.myFeedback.rating)}` : '—'}{c.partnerFeedbackRating ? <div className="muted">Partner rated you {c.partnerFeedbackRating}★</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
