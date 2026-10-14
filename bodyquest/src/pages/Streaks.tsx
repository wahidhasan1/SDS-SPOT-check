import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, Modal, Note } from '../components/ui';
import type { DateKey, DayStatus } from '../domain/types';
import { addDays, diffDays, formatDate, fromDateKey, startOfWeek, toDateKey, WEEK_ORDER, WEEKDAY_SHORT } from '../services/dates';
import { buildCalendar, RESOLVE_WINDOW_DAYS, rescheduleOptions, templateForDate } from '../services/schedule';
import { COMEBACK_OPTIONS, TEMPLATES } from '../services/workoutGenerator';
import { canStartPlanned, clearOverride, resolveDay } from '../store/actions';
import { useApp } from '../store/AppStore';
import { useDerived } from '../store/hooks';

export const STATUS_INFO: Record<DayStatus, { label: string; icon: string; color: string }> = {
  completed: { label: 'Completed', icon: '✓', color: 'var(--success)' },
  comeback: { label: 'Comeback session', icon: '↺', color: 'var(--success)' },
  protected: { label: 'Recovery token', icon: '🛡', color: 'var(--xp)' },
  rest: { label: 'Scheduled rest', icon: '·', color: 'var(--muted)' },
  scheduled: { label: 'Planned', icon: '●', color: 'var(--accent-text)' },
  overdue: { label: 'Needs decision', icon: '!', color: 'var(--warning)' },
  missed: { label: 'Missed', icon: '✕', color: 'var(--danger)' },
  excused: { label: 'Unwell / medical rest', icon: '☾', color: 'var(--info)' },
  rescheduled: { label: 'Moved', icon: '→', color: 'var(--muted)' },
  'before-plan': { label: 'Before plan', icon: '', color: 'var(--muted)' },
};

export const STREAK_RULES = [
  'Your streak counts planned sessions kept in a row — not calendar days.',
  'Scheduled rest days never break your streak.',
  'A session is kept when you complete it, complete an approved comeback session, or use a recovery token.',
  'Marking a day as unwell or medical rest is never a failure — it simply doesn’t count either way.',
  `You have ${RESOLVE_WINDOW_DAYS} days to decide what to do about a missed session. After that it counts as missed and the current streak restarts (your best streak is kept).`,
  'Only one full workout per day — you never have to double up to catch up.',
  'Earn a recovery token for every week where you keep all planned sessions (hold up to 3).',
];

export default function StreaksPage() {
  const { data, today } = useApp();
  const d = useDerived();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [detail, setDetail] = useState<DateKey | null>(null);
  const first = `${month}-01`;
  const gridStart = startOfWeek(first);
  const lastOfMonth = toDateKey(new Date(fromDateKey(first).getFullYear(), fromDateKey(first).getMonth() + 1, 0, 12));
  const gridEnd = addDays(startOfWeek(lastOfMonth), 6);
  const cal = buildCalendar(d.ctx, gridStart, gridEnd);
  const shiftMonth = (n: number) => {
    const dt = fromDateKey(first);
    dt.setMonth(dt.getMonth() + n);
    setMonth(toDateKey(dt).slice(0, 7));
  };
  const history = Object.values(data.overrides).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <PageHead title="Streak Calendar" sub="Consistency, not perfection. Rest days and sick days never count against you." />
      <div className="grid-4 mb-3">
        <Card>
          <div className="stat">
            <span className="value" style={{ color: 'var(--streak)' }}>
              🔥 {d.streak.current}
            </span>
            <span className="label">Current streak (sessions)</span>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <span className="value">{d.streak.longest}</span>
            <span className="label">Longest streak</span>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <span className="value">{d.streak.weekScheduled === 0 ? '—' : `${d.streak.weeklyCompletionPct}%`}</span>
            <span className="label">
              {d.streak.weekScheduled === 0 ? 'This week (no sessions due yet)' : `This week (${d.streak.weekKept}/${d.streak.weekScheduled} due kept)`}
            </span>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <span className="value" style={{ color: 'var(--xp)' }}>
              🛡 {d.tokens.length}
            </span>
            <span className="label">Recovery tokens</span>
          </div>
        </Card>
      </div>

      {d.overdue.length > 0 && (
        <div className="stack mb-3">
          {d.overdue.map((date) => (
            <MissedCard key={date} date={date} />
          ))}
        </div>
      )}

      <div className="grid-3">
        <Card className="span-2" title={fromDateKey(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} action={
          <div className="row">
            <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <Icon name="chevronLeft" />
            </button>
            <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <Icon name="chevronRight" />
            </button>
          </div>
        }>
          <div className="cal" role="grid" aria-label="Training calendar">
            {WEEK_ORDER.map((w) => (
              <div key={w} className="cal-head" role="columnheader">
                {WEEKDAY_SHORT[w]}
              </div>
            ))}
            {cal.map((c) => {
              const out = c.date.slice(0, 7) !== month;
              const info = STATUS_INFO[c.status];
              return (
                <button
                  key={c.date}
                  type="button"
                  className={`cal-day ${c.status} ${c.isToday ? 'today' : ''} ${out ? 'out' : ''}`}
                  onClick={() => setDetail(c.date)}
                  aria-label={`${formatDate(c.date, { weekday: 'long', month: 'long', day: 'numeric' })}: ${info.label}${c.template ? `, ${TEMPLATES[c.template].title}` : ''}${c.movedIn.length ? ', includes a moved session' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <span>{Number(c.date.slice(8))}</span>
                  <span className="icon" aria-hidden="true">
                    {c.movedIn.length ? '⇢' : info.icon}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="legend mt-3" aria-label="Legend">
            {(['completed', 'scheduled', 'rest', 'overdue', 'missed', 'excused', 'protected', 'comeback', 'rescheduled'] as DayStatus[]).map((s) => (
              <span key={s}>
                <i className={`cal-day ${s}`} style={{ aspectRatio: 'auto', width: 12, height: 12, borderRadius: 4, padding: 0 }} /> {STATUS_INFO[s].label}
              </span>
            ))}
          </div>
        </Card>
        <Card title="Streak rules">
          <ul className="bullets small">
            {STREAK_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Recovery history" className="mt-3">
        {history.length === 0 ? (
          <p className="muted mb-0">No missed or adjusted sessions yet.</p>
        ) : (
          <ul className="list">
            {history.map((o) => (
              <li key={o.date} className="list-row">
                <span className="grow">
                  {formatDate(o.date)} —{' '}
                  {o.resolution === 'rescheduled' ? `moved to ${formatDate(o.movedTo!)}` : o.resolution === 'acknowledged-missed' ? 'resumed normal schedule' : o.resolution === 'unwell' ? 'unwell / medical rest' : o.resolution === 'token' ? 'recovery token used' : 'comeback session'}
                </span>
                <Badge>{STATUS_INFO[d.ctx ? buildCalendar(d.ctx, o.date, o.date)[0].status : 'missed'].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {detail && <DayModal date={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function MissedCard({ date }: { date: DateKey }) {
  const { data, today, run } = useApp();
  const d = useDerived();
  const tpl = templateForDate(d.plan, date)!;
  const opts = rescheduleOptions(d.ctx, date, d.profile);
  const okOpts = opts.filter((o) => o.ok);
  const late = canStartPlanned(data, { nowIso: '', today, userId: '' }, date);
  const deadline = addDays(date, RESOLVE_WINDOW_DAYS);
  const [moveTo, setMoveTo] = useState(okOpts[0]?.date ?? '');
  return (
    <Card className="mb-0" title={<h2 style={{ margin: 0 }}>Missed: {TEMPLATES[tpl].title} on {formatDate(date)}</h2>}>
      <p className="small muted">
        Decide by the end of {formatDate(deadline)}. Pick what suits your schedule and how you feel — there’s no penalty workout.
      </p>
      <div className="grid-2">
        <div className="card flat stack">
          <strong>Do it now (late)</strong>
          <span className="small muted">Counts as the original session. Only if you haven’t already done a full workout today.</span>
          {late.ok ? (
            <Link to={`/app/workout?date=${date}`} className="btn btn-primary btn-sm">
              Start {TEMPLATES[tpl].title}
            </Link>
          ) : (
            <span className="small" style={{ color: 'var(--warning)' }}>
              {late.reason}
            </span>
          )}
        </div>
        <div className="card flat stack">
          <strong>Move it to a rest day</strong>
          {okOpts.length ? (
            <>
              <label className="sr-only" htmlFor={`mv-${date}`}>
                New date
              </label>
              <select id={`mv-${date}`} className="select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {okOpts.map((o) => (
                  <option key={o.date} value={o.date}>
                    {o.date === today ? 'Today' : formatDate(o.date)} — {o.reason}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="secondary" onClick={() => run(resolveDay, date, 'rescheduled', { movedTo: moveTo })}>
                Reschedule
              </Button>
            </>
          ) : (
            <span className="small muted">No suitable rest day in the next few days without stacking hard sessions. Try a comeback session instead.</span>
          )}
          {opts.filter((o) => !o.ok).map((o) => (
            <span key={o.date} className="small muted">
              {formatDate(o.date)}: {o.reason}
            </span>
          ))}
        </div>
        <div className="card flat stack">
          <strong>Approved lighter comeback</strong>
          <span className="small muted">A short session that keeps your streak — suitable for busy or tired days.</span>
          {COMEBACK_OPTIONS.map((c) => (
            <Link key={c.id} to={`/app/workout?mode=comeback&for=${date}&t=${c.id}`} className="btn btn-secondary btn-sm">
              {c.label}
            </Link>
          ))}
        </div>
        <div className="card flat stack">
          <strong>Other options</strong>
          <Button size="sm" variant="secondary" disabled={d.tokens.length === 0} onClick={() => run(resolveDay, date, 'token')}>
            Use a recovery token ({d.tokens.length} left)
          </Button>
          <Button size="sm" variant="secondary" onClick={() => run(resolveDay, date, 'unwell')}>
            I was unwell / medical rest
          </Button>
          <Button size="sm" variant="ghost" onClick={() => run(resolveDay, date, 'acknowledged-missed')}>
            Resume my normal schedule
          </Button>
        </div>
      </div>
      <p className="small muted mt-2 mb-0">Feeling unwell? Please rest. Never train through illness to protect a streak.</p>
    </Card>
  );
}

function DayModal({ date, onClose }: { date: DateKey; onClose: () => void }) {
  const { data, today, run } = useApp();
  const d = useDerived();
  const c = buildCalendar(d.ctx, date, date)[0];
  const info = STATUS_INFO[c.status];
  const o = data.overrides[date];
  const session = data.sessions.find((s) => s.plannedDate === date && s.status === 'completed');
  const futureOrToday = diffDays(date, today) >= 0;
  return (
    <Modal title={formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })} onClose={onClose}>
      <div className="stack">
        <div className="row">
          <Badge>{info.label}</Badge>
          {c.template && <Badge tone="accent">{TEMPLATES[c.template].title}</Badge>}
        </div>
        {session && (
          <p className="mb-0">
            Completed {session.workout.title} · {Math.round(session.activeMs / 60000)} active min · +{session.xpAwarded} XP
          </p>
        )}
        {c.movedIn.map((m) => (
          <p key={m.date} className="mb-0">
            Session from {formatDate(m.date)} moved here.{' '}
            {date === today && (
              <Link to={`/app/workout?date=${m.date}`} onClick={onClose}>
                Start it
              </Link>
            )}
          </p>
        ))}
        {c.status === 'overdue' && <Note tone="warning">This session needs a decision — see the options at the top of the page.</Note>}
        {c.template && futureOrToday && c.status === 'scheduled' && (
          <Button variant="secondary" onClick={() => run(resolveDay, date, 'unwell') && onClose()}>
            Mark as unwell / medical rest
          </Button>
        )}
        {o && o.resolution !== 'comeback' && (
          <Button variant="ghost" onClick={() => run(clearOverride, date) && onClose()}>
            Undo “{o.resolution === 'acknowledged-missed' ? 'resume schedule' : o.resolution}”
          </Button>
        )}
      </div>
    </Modal>
  );
}
