import { PROFICIENCY_LEVELS, type Proficiency, type Topic } from "./types";

// Partner selection shared by the demo matcher and the live matcher. It
// filters by proficiency range and block list, then ranks by shared interests.
// It never uses nationality, location, or accent.

export interface MatchCandidate {
  id: string;
  displayName: string;
  proficiency: Proficiency;
  interests: string[];
}

export interface MatchRequest {
  proficiencyRange: [Proficiency, Proficiency];
  topic?: Pick<Topic, "category" | "tags" | "title"> | null;
  blockedIds: string[];
  recentPartnerIds?: string[];
  random?: () => number;
}

export interface MatchResult<C extends MatchCandidate> {
  partner: C;
  reasons: string[];
  widenedRange: boolean;
}

export function proficiencyIndex(p: Proficiency) {
  return PROFICIENCY_LEVELS.indexOf(p);
}

export function inRange(p: Proficiency, range: [Proficiency, Proficiency]) {
  const [lo, hi] = [proficiencyIndex(range[0]), proficiencyIndex(range[1])].sort((a, b) => a - b);
  const i = proficiencyIndex(p);
  return i >= lo && i <= hi;
}

function interestScore(c: MatchCandidate, topic: MatchRequest["topic"]) {
  if (!topic) return 0;
  const words = new Set(
    [topic.category, ...topic.tags, ...topic.title.split(/\s+/)].flatMap((w) => w.toLowerCase().split(/[\s-]+/)),
  );
  return c.interests.filter((i) => i.toLowerCase().split(/\s+/).some((w) => words.has(w))).length;
}

export function selectPartner<C extends MatchCandidate>(candidates: C[], req: MatchRequest): MatchResult<C> | null {
  const random = req.random ?? Math.random;
  const notBlocked = candidates.filter((c) => !req.blockedIds.includes(c.id));
  if (notBlocked.length === 0) return null;
  let pool = notBlocked.filter((c) => inRange(c.proficiency, req.proficiencyRange));
  let widenedRange = false;
  if (pool.length === 0) {
    pool = notBlocked;
    widenedRange = true;
  }
  const recent = new Set(req.recentPartnerIds ?? []);
  const fresh = pool.filter((c) => !recent.has(c.id));
  if (fresh.length > 0) pool = fresh;

  const scored = pool.map((c) => ({ c, score: interestScore(c, req.topic) + random() * 0.9 }));
  scored.sort((a, b) => b.score - a.score);
  const partner = scored[0].c;
  const reasons = [
    widenedRange ? "No one in your preferred level range was available, so the range was widened." : "Within your preferred proficiency range.",
  ];
  const shared = interestScore(partner, req.topic);
  if (shared > 0) reasons.push("Shares an interest related to this topic.");
  return { partner, reasons, widenedRange };
}
