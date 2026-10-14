"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Clock, GraduationCap, Heart, MessagesSquare, Search, Swords, X } from "lucide-react";
import type { Difficulty, Topic, TopicCategory } from "@/lib/types";
import { DIFFICULTIES, TOPIC_CATEGORIES } from "@/lib/types";
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from "@/lib/labels";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

const DIFF_TONE: Record<Difficulty, "success" | "brand" | "streak"> = { easy: "success", medium: "brand", challenging: "streak" };

export function TopicsLibrary({
  topics,
  favoriteIds,
  practiced,
  battleByTopic,
}: {
  topics: Topic[];
  favoriteIds: string[];
  practiced: Record<string, number>;
  battleByTopic: Record<string, string>;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TopicCategory | "all">("all");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState(new Set(favoriteIds));
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (difficulty !== "all" && t.difficulty !== difficulty) return false;
      if (onlyFavorites && !favorites.has(t.id)) return false;
      if (!q) return true;
      return [t.title, t.description, t.openingQuestion, ...t.tags, ...t.followUps, CATEGORY_LABELS[t.category]].some((s) => s.toLowerCase().includes(q));
    });
  }, [topics, query, category, difficulty, onlyFavorites, favorites]);

  async function toggleFavorite(t: Topic) {
    const next = !favorites.has(t.id);
    setPending(t.id);
    try {
      await api(`/api/topics/${t.id}/favorite`, { body: { favorite: next } });
      setFavorites((prev) => {
        const s = new Set(prev);
        if (next) s.add(t.id);
        else s.delete(t.id);
        return s;
      });
      toast({ tone: "success", title: next ? "Added to favorites" : "Removed from favorites", description: t.title });
    } catch (e) {
      toast({ tone: "error", title: "Could not update favorites", description: errorMessage(e) });
    } finally {
      setPending(null);
    }
  }

  const hasFilters = query || category !== "all" || difficulty !== "all" || onlyFavorites;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4.5 w-4.5 -translate-y-1/2 text-subtle" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics, questions, or tags…" className="pl-10" aria-label="Search topics" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select value={category} onChange={(e) => setCategory(e.target.value as TopicCategory | "all")} aria-label="Filter by category" className="sm:w-56">
            <option value="all">All categories</option>
            {TOPIC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | "all")} aria-label="Filter by difficulty" className="sm:w-44">
            <option value="all">All difficulties</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </Select>
        </div>
        <Button variant={onlyFavorites ? "secondary" : "outline"} onClick={() => setOnlyFavorites(!onlyFavorites)} aria-pressed={onlyFavorites}>
          <Heart className={cn("h-4 w-4", onlyFavorites && "fill-brand-500 text-brand-600")} /> Favorites ({favorites.size})
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm text-muted">
        <p aria-live="polite">
          Showing {filtered.length} of {topics.length} topics
        </p>
        {hasFilters && (
          <button
            className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-800"
            onClick={() => {
              setQuery("");
              setCategory("all");
              setDifficulty("all");
              setOnlyFavorites(false);
            }}
          >
            <X className="h-4 w-4" /> Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Search className="h-6 w-6" />} title="No topics found" description={onlyFavorites && favorites.size === 0 ? "You haven't added any favorites yet. Tap the heart on a topic to save it." : "Try a different search or clear the filters."} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((t) => {
            const isOpen = open === t.id;
            const fav = favorites.has(t.id);
            return (
              <Card key={t.id} className="flex flex-col p-5" data-testid="topic-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="neutral">{CATEGORY_LABELS[t.category]}</Badge>
                      <Badge tone={DIFF_TONE[t.difficulty]}>{DIFFICULTY_LABELS[t.difficulty]}</Badge>
                    </div>
                    <h2 className="mt-2.5 text-lg font-bold text-ink">{t.title}</h2>
                  </div>
                  <button
                    onClick={() => toggleFavorite(t)}
                    disabled={pending === t.id}
                    aria-pressed={fav}
                    aria-label={fav ? `Remove ${t.title} from favorites` : `Add ${t.title} to favorites`}
                    className={cn("rounded-xl p-2 transition-colors disabled:opacity-50", fav ? "bg-brand-50 text-brand-600" : "text-subtle hover:bg-surface-muted hover:text-ink")}
                  >
                    <Heart className={cn("h-5 w-5", fav && "fill-brand-500")} />
                  </button>
                </div>
                <p className="mt-1 text-sm text-muted">{t.description}</p>
                <p className="mt-3 rounded-xl bg-lavender px-3.5 py-2.5 text-sm font-semibold text-ink">“{t.openingQuestion}”</p>
                <button className="mt-3 inline-flex items-center gap-1 self-start text-sm font-semibold text-brand-600 hover:text-brand-800" onClick={() => setOpen(isOpen ? null : t.id)} aria-expanded={isOpen}>
                  {t.followUps.length} follow-up questions <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                    {t.followUps.map((q) => (
                      <li key={q} className="flex gap-2">
                        <span className="text-brand-500">•</span> {q}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.tags.map((tag) => (
                    <button key={tag} onClick={() => setQuery(tag)} className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted hover:bg-line hover:text-ink">
                      #{tag}
                    </button>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <span className="mr-auto flex items-center gap-1.5 text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" /> ~{t.durationMinutes} min{practiced[t.id] ? ` · practiced ${practiced[t.id]}×` : ""}
                  </span>
                  <ButtonLink href={`/free-talk?topic=${t.id}`} size="sm">
                    <MessagesSquare className="h-4 w-4" /> Free Talk
                  </ButtonLink>
                  {battleByTopic[t.id] ? (
                    <ButtonLink href={`/battles?prompt=${battleByTopic[t.id]}`} size="sm" variant="outline">
                      <Swords className="h-4 w-4" /> Challenge
                    </ButtonLink>
                  ) : (
                    <ButtonLink href={`/coach?topic=${t.id}`} size="sm" variant="outline" title="Practice this topic as a speaking exercise with the coach">
                      <GraduationCap className="h-4 w-4" /> Speaking exercise
                    </ButtonLink>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
