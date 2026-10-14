// Small verb tables used by the transparent demo analyzer.

export const PAST_TENSE: Record<string, string> = {
  go: "went", come: "came", eat: "ate", see: "saw", buy: "bought", have: "had", do: "did",
  make: "made", take: "took", get: "got", meet: "met", visit: "visited", watch: "watched",
  play: "played", talk: "talked", work: "worked", study: "studied", live: "lived", feel: "felt",
  think: "thought", say: "said", tell: "told", give: "gave", find: "found", leave: "left",
  write: "wrote", read: "read", run: "ran", walk: "walked", cook: "cooked", travel: "traveled",
  start: "started", finish: "finished", stay: "stayed", enjoy: "enjoyed", want: "wanted",
  like: "liked", try: "tried", call: "called", move: "moved", learn: "learned", spend: "spent",
  sleep: "slept", wake: "woke", drink: "drank", swim: "swam", sing: "sang", begin: "began",
  bring: "brought", teach: "taught", catch: "caught", fly: "flew", drive: "drove", ride: "rode",
  lose: "lost", win: "won", forget: "forgot", know: "knew", become: "became", decide: "decided",
  open: "opened", close: "closed", help: "helped", ask: "asked", look: "looked", love: "loved",
  hate: "hated", arrive: "arrived", invite: "invited", plan: "planned", send: "sent", pay: "paid",
  sit: "sat", stand: "stood", hear: "heard", understand: "understood", choose: "chose", break: "broke",
};

export const PAST_PARTICIPLE: Record<string, string> = {
  live: "lived", work: "worked", know: "known", study: "studied", teach: "taught", be: "been",
  have: "had", play: "played", use: "used", learn: "learned", own: "owned", wait: "waited",
};

const THIRD_PERSON_IRREGULAR: Record<string, string> = { have: "has", do: "does", go: "goes", be: "is" };

export function thirdPerson(verb: string): string {
  const v = verb.toLowerCase();
  if (THIRD_PERSON_IRREGULAR[v]) return THIRD_PERSON_IRREGULAR[v];
  if (/(s|sh|ch|x|z|o)$/.test(v)) return v + "es";
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ies";
  return v + "s";
}

/** Maps a third-person present form back to its base form (goes -> go). */
export function baseFromThirdPerson(verb: string): string | null {
  const v = verb.toLowerCase();
  for (const [base, third] of Object.entries(THIRD_PERSON_IRREGULAR)) if (third === v) return base;
  if (v.endsWith("ies")) return v.slice(0, -3) + "y";
  if (/(ses|shes|ches|xes|zes|oes)$/.test(v)) return v.slice(0, -2);
  if (v.endsWith("s")) return v.slice(0, -1);
  return null;
}

export function gerund(verb: string): string {
  const v = verb.toLowerCase();
  if (v.endsWith("ie")) return v.slice(0, -2) + "ying";
  if (v.endsWith("e") && !v.endsWith("ee")) return v.slice(0, -1) + "ing";
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(v)) return v + v.slice(-1) + "ing";
  return v + "ing";
}

export const PRESENT_VERBS_FOR_AGREEMENT = [
  "like", "want", "need", "go", "work", "live", "have", "do", "say", "think", "know", "play",
  "watch", "study", "make", "take", "love", "enjoy", "speak", "come", "help", "give", "feel",
  "look", "seem", "mean", "use", "get", "try", "teach", "explain", "start", "cook", "eat",
  "drink", "read", "write", "run", "walk", "travel", "believe", "understand", "remember",
  "prefer", "hate", "hope", "become", "keep", "show", "bring", "open", "close", "buy", "pay",
  "spend", "sleep", "wake", "give", "allow", "create", "cost", "change", "depend", "include",
  "join", "visit", "call", "meet", "ask", "tell", "send", "wait", "finish", "leave", "sing", "dance", "drive",
];

export const SINGULAR_NOUN_SUBJECTS = [
  "friend", "mother", "father", "mom", "mum", "dad", "brother", "sister", "colleague", "boss",
  "teacher", "team", "company", "family", "manager", "partner", "son", "daughter", "husband",
  "wife", "city", "country", "government", "school", "grandmother", "grandfather", "neighbor",
  "neighbour", "child", "job", "app", "phone",
];
