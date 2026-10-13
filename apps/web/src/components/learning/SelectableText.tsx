import { Fragment, useMemo, useState } from 'react';
import { WordLookup } from './WordLookup';

/** Splits text into sentences and words; tapping a word opens the dictionary/explanation panel. */
export function SelectableText({ text, source }: { text: string; source: string }) {
  const [sel, setSel] = useState<{ word: string; sentence: string } | null>(null);
  const sentences = useMemo(() => text.match(/[^.!?]+[.!?]*["”’)]*\s*|[^.!?]+$/g) ?? [text], [text]);
  return (
    <>
      {sentences.map((s, si) => (
        <Fragment key={si}>
          {s.split(/(\s+)/).map((tok, ti) => {
            const m = tok.match(/^([^A-Za-z]*)([A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z])([^A-Za-z]*)$/);
            if (!m) return <Fragment key={ti}>{tok}</Fragment>;
            return (
              <Fragment key={ti}>
                {m[1]}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setSel({ word: m[2], sentence: s.trim() })}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel({ word: m[2], sentence: s.trim() }))}
                  className="cursor-pointer rounded-sm hover:bg-amber-100 focus:bg-amber-100 focus:outline-none dark:hover:bg-amber-900/40 dark:focus:bg-amber-900/40"
                >
                  {m[2]}
                </span>
                {m[3]}
              </Fragment>
            );
          })}
        </Fragment>
      ))}
      <WordLookup word={sel?.word ?? null} sentence={sel?.sentence ?? ''} source={source} onClose={() => setSel(null)} />
    </>
  );
}
