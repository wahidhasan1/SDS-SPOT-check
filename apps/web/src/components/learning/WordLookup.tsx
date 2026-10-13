import { useEffect, useState } from 'react';
import { BookmarkCheck, Sparkles } from 'lucide-react';
import { Alert, Badge, Button, Modal, Spinner, useToast } from '../ui';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { AudioButton } from './AudioButton';

interface Sense { pos: string; definition: string; examples: string[]; synonyms: string[]; antonyms: string[] }
interface LookupResp {
  query: string;
  lemma: string;
  found: boolean;
  senses: Sense[];
  bestIndex: number | null;
  learnerEntry: { id: string; word: string; definition: string; example: string; cefrLevel: string; phonetic: string | null; audioUrl: string | null; partOfSpeech: string } | null;
  savedId: string | null;
  aiConfigured: boolean;
}
interface Explanation { lemma: string; partOfSpeech: string; meaningInContext: string; simpleDefinition: string; translation: string | null; exampleSentence: string }

export function WordLookup({ word, sentence, source, onClose }: { word: string | null; sentence: string; source: string; onClose: () => void }) {
  const me = useMe();
  const toast = useToast();
  const [data, setData] = useState<LookupResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [ai, setAi] = useState<Explanation | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!word) return;
    setData(null);
    setError(null);
    setAi(null);
    setAiErr(null);
    setShowAll(false);
    setSaved(false);
    api
      .post<LookupResp>('/api/reader/lookup', { word, sentence })
      .then((r) => {
        setData(r);
        setChosen(r.bestIndex);
        setSaved(Boolean(r.savedId));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [word, sentence]);

  const explain = async () => {
    setAiBusy(true);
    setAiErr(null);
    try {
      const r = await api.post<{ explanation: Explanation }>('/api/reader/explain', { word, sentence, language: me.profile.preferredLanguage ?? me.profile.nativeLanguage });
      setAi(r.explanation);
    } catch (e) {
      setAiErr(e instanceof ApiError ? e.message : errorMessage(e));
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const sense = chosen != null ? data.senses[chosen] : null;
      const definition = ai?.meaningInContext ?? sense?.definition ?? data.learnerEntry?.definition;
      if (data.learnerEntry && !ai && (!sense || chosen === data.bestIndex)) {
        await api.post('/api/vocab/my', { wordId: data.learnerEntry.id, source, context: sentence.slice(0, 500) });
      } else {
        await api.post('/api/vocab/my', { word: ai?.lemma ?? data.lemma, definition: definition ?? '(no definition)', context: sentence.slice(0, 500), translation: ai?.translation ?? undefined, source });
      }
      setSaved(true);
      toast(`“${data.lemma}” saved to your vocabulary`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const senses = data?.senses ?? [];
  const visible = showAll ? senses : senses.filter((_, i) => i === chosen).concat(chosen == null ? senses.slice(0, 3) : []);
  return (
    <Modal open={Boolean(word)} onClose={onClose} title={<span>Word: <span className="text-brand-700 dark:text-brand-300">{word}</span></span>} size="lg">
      {sentence && <blockquote className="mb-4 rounded-lg border-l-4 border-brand-400 bg-slate-50 px-3 py-2 text-sm italic dark:bg-slate-800/60">{sentence}</blockquote>}
      {error && <Alert tone="error">{error}</Alert>}
      {!data && !error && <div className="flex justify-center py-6"><Spinner className="h-6 w-6 text-brand-600" /></div>}
      {data && (
        <div className="space-y-4">
          {data.learnerEntry && (
            <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-900/30">
              <div className="flex items-center gap-2"><strong>{data.learnerEntry.word}</strong><AudioButton src={data.learnerEntry.audioUrl} /><em className="muted text-sm">{data.learnerEntry.partOfSpeech}</em><Badge tone="brand">{data.learnerEntry.cefrLevel}</Badge></div>
              <p className="mt-1 text-sm">{data.learnerEntry.definition}</p>
              <p className="muted text-xs">FluentPath learner dictionary</p>
            </div>
          )}
          {data.found ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Dictionary meanings {data.lemma !== data.query.toLowerCase() && <span className="muted font-normal">(base form: {data.lemma})</span>}</h3>
                {senses.length > 1 && <button className="text-xs text-brand-700 hover:underline dark:text-brand-300" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Show best match' : `Show all ${senses.length} meanings`}</button>}
              </div>
              <ul className="space-y-2">
                {visible.map((s) => {
                  const i = senses.indexOf(s);
                  return (
                    <li key={i}>
                      <button onClick={() => setChosen(i)} className={`w-full rounded-xl border p-3 text-left text-sm ${chosen === i ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                        <div className="flex flex-wrap items-center gap-2"><em className="muted">{s.pos}</em>{i === data.bestIndex && <Badge tone="green">Best match for this sentence</Badge>}</div>
                        <div className="mt-1">{s.definition}</div>
                        {s.examples[0] && <div className="muted mt-1 italic">“{s.examples[0]}”</div>}
                        {(s.synonyms.length > 0 || s.antonyms.length > 0) && <div className="mt-1 text-xs">{s.synonyms.length > 0 && <>Synonyms: {s.synonyms.slice(0, 5).join(', ')}. </>}{s.antonyms.length > 0 && <>Opposite: {s.antonyms.join(', ')}.</>}</div>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="muted mt-2 text-xs">Meanings from WordNet. The “best match” is chosen automatically by comparing the sentence with each meaning, so it can occasionally be wrong — tap another meaning to choose it.</p>
            </div>
          ) : (
            !data.learnerEntry && <Alert tone="warning">No dictionary entry found for “{data.query}”. Check the spelling (OCR can misread letters) or try the base form of the word.</Alert>
          )}
          <div className="rounded-xl border border-violet-200 p-3 dark:border-violet-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-800 dark:text-violet-300"><Sparkles className="h-4 w-4" /> AI explanation in context</div>
              {!ai && data.aiConfigured && <Button size="sm" variant="secondary" onClick={explain} loading={aiBusy}>Explain</Button>}
            </div>
            {!data.aiConfigured && <p className="muted mt-1 text-xs">Not available: AI is not configured on this server (an administrator must set ANTHROPIC_API_KEY). Translations are part of this feature.</p>}
            {aiErr && <Alert tone="error" className="mt-2">{aiErr}</Alert>}
            {ai && (
              <div className="mt-2 space-y-1 text-sm">
                <p><strong>{ai.lemma}</strong> <em className="muted">{ai.partOfSpeech}</em></p>
                <p>{ai.meaningInContext}</p>
                {ai.translation && <p className="text-violet-700 dark:text-violet-300">{me.profile.preferredLanguage ?? me.profile.nativeLanguage}: {ai.translation}</p>}
                <p className="muted italic">“{ai.exampleSentence}”</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={save} loading={saving} disabled={saved || (!data.found && !data.learnerEntry && !ai)} icon={saved ? <BookmarkCheck className="h-4 w-4" /> : undefined}>{saved ? 'Saved' : 'Save to my words'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
