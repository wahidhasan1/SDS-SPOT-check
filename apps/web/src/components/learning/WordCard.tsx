import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, useToast } from '../ui';
import { AudioButton } from './AudioButton';

export interface WordItem {
  id: string;
  word: string;
  partOfSpeech: string;
  phonetic: string | null;
  definition: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
  cefrLevel: string;
  categorySlug?: string | null;
  audioUrl: string | null;
  savedId?: string | null;
}

export function WordCard({ w, source = 'browse', compact }: { w: WordItem; source?: string; compact?: boolean }) {
  const toast = useToast();
  const [saved, setSaved] = useState(Boolean(w.savedId));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.post('/api/vocab/my', { wordId: w.id, source });
      setSaved(true);
      toast(`“${w.word}” saved to your vocabulary`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-lg font-semibold">{w.word}</h3>
            <AudioButton src={w.audioUrl} label={`Play pronunciation of ${w.word}`} />
          </div>
          <div className="muted text-sm">
            <em>{w.partOfSpeech}</em>
            {w.phonetic && <span className="ml-2 font-mono text-xs">{w.phonetic}</span>}
          </div>
        </div>
        <Badge tone="brand">{w.cefrLevel}</Badge>
      </div>
      <p className="mt-2 text-sm">{w.definition}</p>
      {!compact && <p className="muted mt-1.5 text-sm italic">“{w.example}”</p>}
      {!compact && (w.synonyms.length > 0 || w.antonyms.length > 0) && (
        <div className="mt-2 space-y-0.5 text-xs">
          {w.synonyms.length > 0 && <div><span className="font-semibold">Synonyms:</span> {w.synonyms.join(', ')}</div>}
          {w.antonyms.length > 0 && <div><span className="font-semibold">Opposites:</span> {w.antonyms.join(', ')}</div>}
        </div>
      )}
      <div className="mt-auto pt-3">
        <button
          onClick={save}
          disabled={saved || busy}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium ${saved ? 'text-emerald-700 dark:text-emerald-400' : 'text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/40'}`}
        >
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          {saved ? 'Saved' : busy ? 'Saving…' : 'Save word'}
        </button>
      </div>
    </div>
  );
}
