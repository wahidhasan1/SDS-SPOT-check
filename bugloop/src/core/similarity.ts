// Duplicate detection: TF-IDF cosine similarity with light stemming, a bug-concept lexicon,
// title trigram overlap and module/feature context. Deterministic and explainable.

import type { SimilarityLevel } from "./types";
import { conceptLabel, concepts, jaccard, tokenize, trigrams } from "./text";

export interface SimilarityInput {
  id?: string;
  title: string;
  description?: string | null;
  actual_result?: string | null;
  expected_result?: string | null;
  steps?: string[] | null;
  module_id?: string | null;
  feature_id?: string | null;
  affected_module_ids?: string[] | null;
}

export interface SimilarityMatch {
  id: string;
  score: number;
  level: SimilarityLevel;
  sharedTerms: string[];
  sameModule: boolean;
  sameFeature: boolean;
}

interface DocVector {
  id: string;
  input: SimilarityInput;
  tf: Map<string, number>;
  surface: Map<string, string>;
  title3: Set<string>;
  norm?: number;
}

const FIELD_WEIGHTS = {
  title: 2.5,
  actual: 1.5,
  description: 1,
  steps: 0.7,
  expected: 0.5,
  concept: 1.6,
};

export const LEVEL_THRESHOLDS: Record<SimilarityLevel, number> = {
  high: 0.5,
  medium: 0.3,
  low: 0.2,
};

export function levelFor(score: number): SimilarityLevel | null {
  if (score >= LEVEL_THRESHOLDS.high) return "high";
  if (score >= LEVEL_THRESHOLDS.medium) return "medium";
  if (score >= LEVEL_THRESHOLDS.low) return "low";
  return null;
}

function vectorize(input: SimilarityInput, id: string): DocVector {
  const tf = new Map<string, number>();
  const surface = new Map<string, string>();
  const add = (text: string | null | undefined, weight: number) => {
    if (!text) return;
    for (const t of tokenize(text)) {
      tf.set(t.stem, (tf.get(t.stem) ?? 0) + weight);
      if (!surface.has(t.stem)) surface.set(t.stem, t.surface);
    }
  };
  add(input.title, FIELD_WEIGHTS.title);
  add(input.actual_result, FIELD_WEIGHTS.actual);
  add(input.description, FIELD_WEIGHTS.description);
  add((input.steps ?? []).join("\n"), FIELD_WEIGHTS.steps);
  add(input.expected_result, FIELD_WEIGHTS.expected);

  const symptomText = [input.title, input.actual_result, input.description].filter(Boolean).join(" \n ");
  for (const c of concepts(symptomText)) {
    const key = `~${c}`;
    tf.set(key, (tf.get(key) ?? 0) + FIELD_WEIGHTS.concept);
    surface.set(key, conceptLabel(c));
  }
  // Dampen repeated terms.
  for (const [k, v] of tf) tf.set(k, 1 + Math.log(v));
  return { id, input, tf, surface, title3: trigrams(input.title) };
}

export class SimilarityIndex {
  private readonly docs: DocVector[];
  private readonly df = new Map<string, number>();

  constructor(docs: (SimilarityInput & { id: string })[]) {
    this.docs = docs.map((d) => vectorize(d, d.id));
    for (const d of this.docs) for (const term of d.tf.keys()) this.df.set(term, (this.df.get(term) ?? 0) + 1);
  }

  get size(): number {
    return this.docs.length;
  }

  private idf(term: string): number {
    const n = this.docs.length + 1;
    const df = (this.df.get(term) ?? 0) + 1;
    return Math.log(1 + n / df);
  }

  private weights(v: DocVector): Map<string, number> {
    const w = new Map<string, number>();
    for (const [term, tf] of v.tf) w.set(term, tf * this.idf(term));
    return w;
  }

  private readonly docCache = new Map<string, { w: Map<string, number>; norm: number }>();

  private docWeights(d: DocVector): { w: Map<string, number>; norm: number } {
    let hit = this.docCache.get(d.id);
    if (!hit) {
      const w = this.weights(d);
      hit = { w, norm: Math.sqrt([...w.values()].reduce((s, x) => s + x * x, 0)) };
      this.docCache.set(d.id, hit);
    }
    return hit;
  }

  query(
    input: SimilarityInput,
    opts: { limit?: number; minLevel?: SimilarityLevel; excludeIds?: string[] } = {},
  ): SimilarityMatch[] {
    const limit = opts.limit ?? 5;
    const min = LEVEL_THRESHOLDS[opts.minLevel ?? "low"];
    const exclude = new Set(opts.excludeIds ?? []);
    if (input.id) exclude.add(input.id);

    const q = vectorize(input, input.id ?? "__query__");
    if (q.tf.size === 0) return [];
    const qw = this.weights(q);
    const qNorm = Math.sqrt([...qw.values()].reduce((s, x) => s + x * x, 0));

    const matches: SimilarityMatch[] = [];
    for (const d of this.docs) {
      if (exclude.has(d.id)) continue;
      const { w: dw, norm: dNorm } = this.docWeights(d);
      let dot = 0;
      const shared: { term: string; weight: number }[] = [];
      for (const [term, w] of qw) {
        const other = dw.get(term);
        if (other) {
          dot += w * other;
          shared.push({ term, weight: w * other });
        }
      }
      if (dot === 0) continue;
      const cosine = dot / (qNorm * dNorm);
      const titleOverlap = jaccard(q.title3, d.title3);

      const sameModule =
        !!input.module_id &&
        (input.module_id === d.input.module_id || (d.input.affected_module_ids ?? []).includes(input.module_id));
      const sameFeature = !!input.feature_id && input.feature_id === d.input.feature_id;

      let score = 0.74 * cosine + 0.2 * titleOverlap;
      if (cosine > 0.12) {
        if (sameModule) score += 0.07;
        if (sameFeature) score += 0.06;
      }
      score = Math.min(1, score);
      if (score < min) continue;
      const level = levelFor(score);
      if (!level) continue;

      shared.sort((a, b) => b.weight - a.weight);
      matches.push({
        id: d.id,
        score: Math.round(score * 1000) / 1000,
        level,
        sharedTerms: shared.slice(0, 6).map((s) => q.surface.get(s.term) ?? d.surface.get(s.term) ?? s.term),
        sameModule,
        sameFeature,
      });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit);
  }
}

/** One-off comparison of two reports (used by tests and the post-submit scan). */
export function compareReports(a: SimilarityInput & { id: string }, b: SimilarityInput & { id: string }, corpus: (SimilarityInput & { id: string })[] = []): SimilarityMatch | null {
  const index = new SimilarityIndex([b, ...corpus.filter((c) => c.id !== b.id && c.id !== a.id)]);
  return index.query(a, { limit: 50 }).find((m) => m.id === b.id) ?? null;
}
