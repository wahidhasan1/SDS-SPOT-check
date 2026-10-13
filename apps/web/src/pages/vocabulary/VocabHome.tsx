import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { CEFR_LEVELS } from '@fluentpath/shared';
import { WordCard, type WordItem } from '../../components/learning/WordCard';
import { Badge, Button, EmptyState, ErrorState, PageHeader, PageLoader, ProgressBar } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { VocabNav } from './VocabNav';

interface Category { slug: string; name: string; description: string; total: number; saved: number }

export default function VocabHome() {
  const daily = useApi<{ day: string; levels: string[]; words: WordItem[] }>('/api/vocab/daily');
  const cats = useApi<{ categories: Category[] }>('/api/vocab/categories');
  const stats = useApi<{ stats: { due: number } }>('/api/vocab/stats');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [words, setWords] = useState<WordItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingWords, setLoadingWords] = useState(false);
  const browsing = Boolean(category || level || query);

  useEffect(() => {
    if (!browsing) return setWords(null);
    const params = new URLSearchParams({ page: String(page) });
    if (category) params.set('category', category);
    if (level) params.set('level', level);
    if (query) params.set('q', query);
    setLoadingWords(true);
    api
      .get<{ words: WordItem[]; hasMore: boolean }>(`/api/vocab/words?${params}`)
      .then((r) => {
        setWords((prev) => (page === 1 ? r.words : [...(prev ?? []), ...r.words]));
        setHasMore(r.hasMore);
      })
      .finally(() => setLoadingWords(false));
  }, [category, level, query, page, browsing]);

  return (
    <div>
      <PageHeader eyebrow="Learn" title="Vocabulary" description="Learn new words every day, save them, and review them with spaced repetition until you master them." />
      <VocabNav due={stats.data?.stats.due} />

      <form className="mb-6 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }} role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search words or definitions…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search vocabulary" />
        </div>
        <select className="input sm:w-40" value={level} onChange={(e) => { setPage(1); setLevel(e.target.value); }} aria-label="Filter by level">
          <option value="">All levels</option>
          {CEFR_LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <Button type="submit">Search</Button>
      </form>

      {browsing ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Results</h2>
            {category && <Badge tone="brand">{cats.data?.categories.find((c) => c.slug === category)?.name}</Badge>}
            {level && <Badge tone="brand">{level}</Badge>}
            {query && <Badge tone="brand">“{query}”</Badge>}
            <button className="text-sm text-brand-700 hover:underline dark:text-brand-300" onClick={() => { setCategory(''); setLevel(''); setQuery(''); setQ(''); setPage(1); }}>Clear filters</button>
          </div>
          {words == null ? <PageLoader /> : words.length === 0 ? (
            <EmptyState title="No words found" description="Try a different search or filter." />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{words.map((w) => <WordCard key={w.id} w={w} />)}</div>
              {hasMore && <div className="mt-4 text-center"><Button variant="secondary" loading={loadingWords} onClick={() => setPage((p) => p + 1)}>Load more</Button></div>}
            </>
          )}
        </section>
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-semibold">Today’s words</h2>
                <p className="muted text-sm">{daily.data ? `Chosen for your level (${daily.data.levels.join('–')}). New words every day.` : ' '}</p>
              </div>
            </div>
            {daily.loading && !daily.data ? <PageLoader /> : daily.error ? <ErrorState message={daily.error} onRetry={daily.reload} /> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{daily.data!.words.map((w) => <WordCard key={w.id} w={w} source="daily" />)}</div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">IELTS topic lists</h2>
            {cats.data && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cats.data.categories.map((c) => (
                  <button key={c.slug} onClick={() => { setPage(1); setCategory(c.slug); window.scrollTo(0, 0); }} className="card p-4 text-left transition-shadow hover:shadow-md">
                    <div className="font-semibold">{c.name}</div>
                    <div className="muted mt-0.5 text-sm">{c.description}</div>
                    <div className="mt-3 flex items-center gap-2 text-xs"><span className="muted shrink-0">{c.saved}/{c.total} saved</span><ProgressBar value={c.saved} max={c.total} /></div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
