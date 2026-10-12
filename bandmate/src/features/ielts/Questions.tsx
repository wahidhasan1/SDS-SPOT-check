import { Fragment, type ReactNode } from 'react'
import { ArrowDown, CheckCircle2, XCircle } from 'lucide-react'
import { cx } from '../../components/ui'
import { LETTERS, ROMAN, wordLimitText, type Group, type ResultItem } from './types'

type Props = {
  group: Group
  answers: Record<string, string>
  onAnswer: (n: number, v: string) => void
  review?: Map<number, ResultItem>
  focus?: number | null
}

const Num = ({ n }: { n: number }) => <span className="mr-2 inline-grid h-6 min-w-6 place-items-center rounded-md bg-text px-1 text-xs font-bold text-bg">{n}</span>

function Verdict({ r }: { r?: ResultItem }) {
  if (!r) return null
  return (
    <div className={cx('mt-2 rounded-lg px-3 py-2 text-sm', r.correct ? 'bg-good-soft' : 'bg-bad-soft')}>
      <p className={cx('flex items-center gap-1.5 font-semibold', r.correct ? 'text-good' : 'text-bad')}>
        {r.correct ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
        {r.correct ? 'Correct' : <>Your answer: {r.given || '—'} · Correct: {r.answer}</>}
      </p>
      <p className="mt-0.5 text-text/80">{r.why}</p>
    </div>
  )
}

function Choice({ value, current, onPick, disabled, children, label }: { value: string; current?: string; onPick: (v: string) => void; disabled?: boolean; children: ReactNode; label?: string }) {
  const on = current?.toUpperCase() === value.toUpperCase()
  return (
    <button type="button" role="radio" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onPick(value)} className={cx('flex min-h-10 items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[15px] transition-colors', on ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-primary/50', disabled && 'cursor-default')}>
      {children}
    </button>
  )
}

function Select({ n, value, options, onChange, disabled, label }: { n: number; value?: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  return (
    <select id={`q-${n}`} aria-label={label} disabled={disabled} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input h-10 w-auto min-w-24 py-0">
      <option value="">—</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/** Inline text input for completion questions. */
function GapInput({ n, value, onChange, disabled, r, bank }: { n: number; value?: string; onChange: (v: string) => void; disabled?: boolean; r?: ResultItem; bank?: string[] }) {
  if (bank)
    return (
      <span className="mx-1 inline-flex items-center gap-1 align-middle">
        <Num n={n} />
        <Select n={n} value={value} disabled={disabled} label={`Question ${n}`} onChange={onChange} options={bank.map((_, i) => ({ value: LETTERS[i], label: LETTERS[i] }))} />
        {r && (r.correct ? <CheckCircle2 className="size-4 text-good" /> : <XCircle className="size-4 text-bad" />)}
      </span>
    )
  return (
    <span className="mx-1 inline-flex items-center align-middle">
      <Num n={n} />
      <input
        id={`q-${n}`}
        aria-label={`Question ${n}`}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className={cx('h-9 w-36 rounded-lg border bg-surface px-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20', r ? (r.correct ? 'border-good' : 'border-bad') : 'border-border')}
      />
      {r && (r.correct ? <CheckCircle2 className="ml-1 size-4 text-good" /> : <XCircle className="ml-1 size-4 text-bad" />)}
    </span>
  )
}

/** Renders text with {n} gap markers and **bold** headings. */
function GapText({ text, render }: { text: string; render: (n: number) => ReactNode }) {
  const parts = text.split(/(\{\d+\})/g)
  const bold = /^\*\*(.+)\*\*$/.exec(text)
  if (bold) return <p className="mt-3 font-bold">{bold[1]}</p>
  return (
    <span>
      {parts.map((p, i) => {
        const m = /^\{(\d+)\}$/.exec(p)
        return <Fragment key={i}>{m ? render(Number(m[1])) : p}</Fragment>
      })}
    </span>
  )
}

export function QuestionGroup({ group: g, answers, onAnswer, review }: Props) {
  const ro = !!review
  const nums = g.type === 'gaps' ? g.numbers : g.type === 'mcq_multi' ? g.numbers : g.questions.map((q) => q.n)
  const range = nums.length > 1 ? `Questions ${Math.min(...nums)}–${Math.max(...nums)}` : `Question ${nums[0]}`
  const header = (
    <div className="mb-3">
      <p className="text-sm font-extrabold">{range}</p>
      <p className="mt-0.5 text-sm text-muted">{g.instructions}</p>
      {g.type === 'gaps' && g.wordLimit && !g.bank && <p className="mt-1 text-xs font-bold tracking-wide text-primary">Write {wordLimitText(g.wordLimit, g.allowNumber)} for each answer.</p>}
    </div>
  )

  switch (g.type) {
    case 'tfng':
    case 'ynng': {
      const opts = g.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']
      return (
        <section>
          {header}
          <div className="space-y-4">
            {g.questions.map((q) => (
              <div key={q.n} id={`qq-${q.n}`}>
                <p className="text-[15px]"><Num n={q.n} />{q.text}</p>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={`Question ${q.n}`}>
                  {opts.map((o) => <Choice key={o} value={o} current={answers[q.n]} disabled={ro} onPick={(v) => onAnswer(q.n, v)}><span className="text-sm font-bold">{o}</span></Choice>)}
                </div>
                <Verdict r={review?.get(q.n)} />
              </div>
            ))}
          </div>
        </section>
      )
    }
    case 'mcq':
      return (
        <section>
          {header}
          <div className="space-y-5">
            {g.questions.map((q) => (
              <div key={q.n} id={`qq-${q.n}`}>
                <p className="text-[15px] font-medium"><Num n={q.n} />{q.text}</p>
                <div className="mt-2 grid gap-1.5" role="radiogroup" aria-label={`Question ${q.n}`}>
                  {q.options.map((o, i) => (
                    <Choice key={i} value={LETTERS[i]} current={answers[q.n]} disabled={ro} onPick={(v) => onAnswer(q.n, v)}>
                      <span className="font-bold text-muted">{LETTERS[i]}</span> <span>{o}</span>
                    </Choice>
                  ))}
                </div>
                <Verdict r={review?.get(q.n)} />
              </div>
            ))}
          </div>
        </section>
      )
    case 'mcq_multi': {
      const chosen = g.numbers.map((n) => answers[n]).filter(Boolean)
      const toggle = (letter: string) => {
        const next = chosen.includes(letter) ? chosen.filter((c) => c !== letter) : chosen.length < g.numbers.length ? [...chosen, letter] : chosen
        g.numbers.forEach((n, i) => onAnswer(n, next[i] ?? ''))
      }
      return (
        <section id={`qq-${g.numbers[0]}`}>
          {header}
          <p className="text-[15px] font-medium">{g.text}</p>
          <div className="mt-2 grid gap-1.5">
            {g.options.map((o, i) => {
              const on = chosen.includes(LETTERS[i])
              return (
                <button key={i} type="button" role="checkbox" aria-checked={on} disabled={ro} onClick={() => toggle(LETTERS[i])} className={cx('flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[15px]', on ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-primary/50')}>
                  <span className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded border text-xs', on ? 'border-primary bg-primary text-on-primary' : 'border-border')}>{on ? '✓' : ''}</span>
                  <span className="font-bold text-muted">{LETTERS[i]}</span> {o}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted">{chosen.length}/{g.numbers.length} chosen</p>
          {g.numbers.map((n) => <Verdict key={n} r={review?.get(n)} />)}
        </section>
      )
    }
    case 'headings':
    case 'match_info':
    case 'match_features':
    case 'endings':
    case 'map': {
      const list: { value: string; label: string; text?: string }[] =
        g.type === 'headings' ? g.headings.map((h, i) => ({ value: ROMAN[i], label: ROMAN[i], text: h })) : g.type === 'match_features' ? g.features.map((f, i) => ({ value: LETTERS[i], label: LETTERS[i], text: f })) : g.type === 'endings' ? g.endings.map((e, i) => ({ value: LETTERS[i], label: LETTERS[i], text: e })) : g.letters.map((l) => ({ value: l, label: l }))
      return (
        <section>
          {header}
          {g.type === 'map' && <img src={g.image} alt={g.imageAlt} className="mb-4 w-full max-w-md rounded-xl border border-border" />}
          {list.some((l) => l.text) && (
            <div className="mb-4 rounded-xl border border-border bg-surface-2 p-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">{g.type === 'headings' ? 'List of headings' : g.type === 'endings' ? 'Endings' : 'List'}</p>
              <ul className="space-y-1 text-[15px]">{list.map((l) => <li key={l.value}><span className="inline-block w-8 font-bold text-muted">{l.label}</span>{l.text}</li>)}</ul>
            </div>
          )}
          <div className="space-y-3">
            {g.questions.map((q) => (
              <div key={q.n} id={`qq-${q.n}`}>
                <div className="flex flex-wrap items-center gap-2 text-[15px]">
                  <span className="min-w-0 flex-1"><Num n={q.n} />{g.type === 'headings' ? <>Paragraph <b>{q.paragraph}</b></> : q.text}</span>
                  <Select n={q.n} value={answers[q.n]} disabled={ro} label={`Question ${q.n}`} onChange={(v) => onAnswer(q.n, v)} options={list.map((l) => ({ value: l.value, label: l.label }))} />
                </div>
                <Verdict r={review?.get(q.n)} />
              </div>
            ))}
          </div>
        </section>
      )
    }
    case 'gaps': {
      const input = (n: number) => <GapInput key={n} n={n} value={answers[n]} onChange={(v) => onAnswer(n, v)} disabled={ro} r={review?.get(n)} bank={g.bank} />
      return (
        <section>
          {header}
          {g.bank && (
            <div className="mb-4 rounded-xl border border-border bg-surface-2 p-3">
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[15px] sm:grid-cols-3">{g.bank.map((b, i) => <li key={i}><b className="mr-1.5 text-muted">{LETTERS[i]}</b>{b}</li>)}</ul>
            </div>
          )}
          <div className="rounded-xl border border-border p-4">
            {g.title && <p className="mb-2 text-center font-bold">{g.title}</p>}
            {g.lines && <div className="space-y-2 text-[15px] leading-9">{g.lines.map((l, i) => <div key={i}><GapText text={l} render={input} /></div>)}</div>}
            {g.table && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-[15px]">
                  <thead><tr>{g.table.columns.map((c) => <th key={c} className="border border-border bg-surface-2 px-3 py-2 text-left">{c}</th>)}</tr></thead>
                  <tbody>{g.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border border-border px-3 py-2 leading-9"><GapText text={c} render={input} /></td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {g.steps && (
              <div className="flex flex-col items-center gap-1">
                {g.steps.map((s, i) => (
                  <Fragment key={i}>
                    <div className="w-full max-w-md rounded-lg border border-border bg-surface-2 px-3 py-2 text-center text-[15px] leading-9"><GapText text={s} render={input} /></div>
                    {i < g.steps!.length - 1 && <ArrowDown className="size-4 text-faint" />}
                  </Fragment>
                ))}
              </div>
            )}
          </div>
          {review && <div className="mt-2 space-y-1">{g.numbers.map((n) => <Verdict key={n} r={review.get(n)} />)}</div>}
        </section>
      )
    }
  }
}
