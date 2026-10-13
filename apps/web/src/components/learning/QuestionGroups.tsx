import { Fragment, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { CHOICE_TYPES, QUESTION_TYPE_LABELS, type IeltsOption, type QuestionType } from '@fluentpath/shared';

export interface PublicQ { n: number; prompt: string; options?: IeltsOption[] }
export interface PublicG {
  id: string;
  type: QuestionType;
  instructions: string;
  title?: string;
  options?: IeltsOption[];
  gapText?: string;
  questions: PublicQ[];
  passageId?: string;
  sectionId?: string;
}
export interface QResult { n: number; given: string | null; correct: boolean; correctAnswer: string; explanation: string }

interface Props {
  groups: PublicG[];
  answers: Record<string, string>;
  onChange?: (n: number, value: string) => void;
  results?: Record<number, QResult> | null;
  idPrefix?: string;
}

function Mark({ r }: { r?: QResult }) {
  if (!r) return null;
  return r.correct ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Correct" /> : <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-label="Incorrect" />;
}

function Review({ r }: { r?: QResult }) {
  if (!r) return null;
  return (
    <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${r.correct ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200'}`}>
      {!r.correct && (
        <div>
          Your answer: <strong>{r.given ?? '(blank)'}</strong> · Correct: <strong>{r.correctAnswer}</strong>
        </div>
      )}
      <div className={r.correct ? '' : 'mt-1'}>{r.explanation}</div>
    </div>
  );
}

function GapInput({ n, value, onChange, result, options, idPrefix }: { n: number; value: string; onChange?: (n: number, v: string) => void; result?: QResult; options?: IeltsOption[]; idPrefix: string }) {
  const cls = `mx-1 inline-block w-36 rounded-md border px-2 py-1 align-baseline text-sm ${
    result ? (result.correct ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-red-500 bg-red-50 dark:bg-red-950/40') : 'border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-900'
  }`;
  const label = `Question ${n}`;
  return (
    <span className="whitespace-nowrap">
      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-white dark:bg-slate-200 dark:text-slate-900">{n}</span>
      {options ? (
        <select id={`${idPrefix}q${n}`} aria-label={label} className={cls} value={value} disabled={!onChange} onChange={(e) => onChange?.(n, e.target.value)}>
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.key}. {o.text}
            </option>
          ))}
        </select>
      ) : (
        <input id={`${idPrefix}q${n}`} aria-label={label} className={cls} value={value} disabled={!onChange} autoComplete="off" spellCheck={false} onChange={(e) => onChange?.(n, e.target.value)} />
      )}
    </span>
  );
}

function renderGapText(g: PublicG, props: Props, idPrefix: string): ReactNode {
  const parts = g.gapText!.split(/(\{\{\d+\}\})/);
  const withOptions = g.type === 'summary_completion' && g.options?.length ? g.options : undefined;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 leading-9 whitespace-pre-line dark:border-slate-700 dark:bg-slate-800/50">
      {g.title && <div className="mb-2 font-semibold leading-6">{g.title}</div>}
      {parts.map((p, i) => {
        const m = p.match(/^\{\{(\d+)\}\}$/);
        if (!m) return <Fragment key={i}>{p}</Fragment>;
        const n = Number(m[1]);
        return <GapInput key={i} n={n} value={props.answers[String(n)] ?? ''} onChange={props.onChange} result={props.results?.[n]} options={withOptions} idPrefix={idPrefix} />;
      })}
    </div>
  );
}

function ChoiceButtons({ q, options, value, onChange, result }: { q: PublicQ; options: IeltsOption[]; value: string; onChange?: (n: number, v: string) => void; result?: QResult }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={`Question ${q.n}`}>
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!onChange}
            onClick={() => onChange?.(q.n, o.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900'
            } ${result && selected && !result.correct ? 'border-red-600 bg-red-600' : ''}`}
          >
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

export function QuestionGroups(props: Props) {
  const { groups, answers, onChange, results, idPrefix = '' } = props;
  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const first = g.questions[0]?.n;
        const last = g.questions[g.questions.length - 1]?.n;
        const isListChoice = ['matching_headings', 'matching_information', 'matching_features'].includes(g.type);
        const isTf = g.type === 'tfng' || g.type === 'ynng';
        return (
          <section key={g.id} aria-labelledby={`${idPrefix}${g.id}-h`}>
            <h3 id={`${idPrefix}${g.id}-h`} className="font-semibold">
              Questions {first}{last !== first ? `–${last}` : ''} <span className="muted text-sm font-normal">· {QUESTION_TYPE_LABELS[g.type]}</span>
            </h3>
            <p className="muted mt-1 text-sm">{g.instructions}</p>

            {isListChoice && g.options && (
              <div className="mt-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                <div className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{g.type === 'matching_headings' ? 'List of headings' : 'Options'}</div>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {g.options.map((o) => (
                    <li key={o.key}><strong className="mr-1.5">{o.key}</strong>{o.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {g.type === 'summary_completion' && g.options?.length ? (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {g.options.map((o) => <span key={o.key} className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800"><strong>{o.key}</strong> {o.text}</span>)}
              </div>
            ) : null}

            <div className="mt-4">
              {g.gapText ? (
                <>
                  {renderGapText(g, props, idPrefix)}
                  {results && (
                    <div className="mt-3 space-y-2">
                      {g.questions.map((q) => (
                        <div key={q.n} className="flex gap-2 text-sm">
                          <Mark r={results[q.n]} />
                          <div className="flex-1"><strong>Q{q.n}.</strong><Review r={results[q.n]} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <ol className="space-y-4">
                  {g.questions.map((q) => {
                    const r = results?.[q.n];
                    const value = answers[String(q.n)] ?? '';
                    const choice = CHOICE_TYPES.includes(g.type);
                    const hasBlank = q.prompt.includes('______');
                    return (
                      <li key={q.n} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700" id={`${idPrefix}item${q.n}`}>
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 rounded bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-white dark:bg-slate-200 dark:text-slate-900">{q.n}</span>
                          <div className="min-w-0 flex-1 text-sm leading-7">
                            {!choice && hasBlank ? (
                              q.prompt.split('______').map((part, i, arr) => (
                                <Fragment key={i}>
                                  {part}
                                  {i < arr.length - 1 && (
                                    <input aria-label={`Question ${q.n}`} className={`mx-1 inline-block w-40 rounded-md border px-2 py-0.5 ${r ? (r.correct ? 'border-emerald-500' : 'border-red-500') : 'border-slate-400 dark:border-slate-600'} bg-white dark:bg-slate-900`} value={value} disabled={!onChange} autoComplete="off" onChange={(e) => onChange?.(q.n, e.target.value)} />
                                  )}
                                </Fragment>
                              ))
                            ) : (
                              <span>{q.prompt}</span>
                            )}
                            {g.type === 'mcq' && q.options && (
                              <div className="mt-2 space-y-1.5" role="radiogroup" aria-label={`Question ${q.n}`}>
                                {q.options.map((o) => (
                                  <label key={o.key} className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 ${value === o.key ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <input type="radio" name={`${idPrefix}q${q.n}`} className="mt-1.5" checked={value === o.key} disabled={!onChange} onChange={() => onChange?.(q.n, o.key)} />
                                    <span><strong className="mr-1">{o.key}</strong>{o.text}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                            {isTf && g.options && <ChoiceButtons q={q} options={g.options} value={value} onChange={onChange} result={r} />}
                            {isListChoice && g.options && (
                              <select aria-label={`Question ${q.n}`} className="input mt-2 max-w-sm" value={value} disabled={!onChange} onChange={(e) => onChange?.(q.n, e.target.value)}>
                                <option value="">Choose…</option>
                                {g.options.map((o) => <option key={o.key} value={o.key}>{o.key}. {o.text}</option>)}
                              </select>
                            )}
                            {!choice && !hasBlank && (
                              <input aria-label={`Question ${q.n}`} className="input mt-2 max-w-sm" value={value} disabled={!onChange} autoComplete="off" onChange={(e) => onChange?.(q.n, e.target.value)} placeholder="Your answer" />
                            )}
                            <Review r={r} />
                          </div>
                          <Mark r={r} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
