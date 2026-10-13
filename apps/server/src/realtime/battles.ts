import {
  BATTLE_TYPES,
  eloDelta,
  isAnswerCorrect,
  type BattleQuestionPublic,
  type BattleType,
  type ServerMessage,
} from '@app/shared';
import { one, q, tx } from '../db/pool';
import { HttpError } from '../lib/errors';
import { recordActivity } from '../services/activity';
import { consumeDaily, refundDaily } from '../services/entitlements';
import { deliverToUser } from './hub';

/**
 * Server-authoritative quiz battles. Questions (with answers) never leave the server
 * until the reveal; answers are validated and scored here, and each (battle, seat, question)
 * can be answered once thanks to the battle_answers primary key.
 * Note: the waiting queue is per server instance (documented limitation).
 */
interface StoredQuestion {
  kind: 'mcq' | 'text';
  prompt: string;
  hint?: string;
  options?: string[];
  answer: string;
  accepted?: string[];
  explanation?: string;
}

interface Waiting {
  userId: string;
  battleType: BattleType;
  rating: number;
  joinedAt: number;
}

interface LiveBattle {
  id: string;
  type: BattleType;
  ranked: boolean;
  seats: { userId: string; seat: number; left: boolean; rating: number; games: number }[];
  questions: StoredQuestion[];
  index: number;
  deadline: number;
  answered: Set<number>;
  advanceTimer: NodeJS.Timeout | null;
  ended: boolean;
  secondsPerQuestion: number;
}

const QUESTION_COUNT = 7;
const queue: Waiting[] = [];
const live = new Map<string, LiveBattle>();
const userBattle = new Map<string, string>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function secondsFor(type: BattleType) {
  return type === 'spelling' ? 20 : type === 'sentence_formation' ? 25 : 15;
}

async function meaningQuestions(n: number, tagFilter: string | null): Promise<StoredQuestion[]> {
  const words = await q<any>(
    `SELECT word, part_of_speech, meaning FROM vocabulary WHERE status='published' ${tagFilter ? `AND $2 = ANY(tags)` : ''}
     ORDER BY random() LIMIT $1`,
    tagFilter ? [n, tagFilter] : [n],
  );
  const pool = await q<any>(`SELECT word, part_of_speech, meaning FROM vocabulary WHERE status='published' ORDER BY random() LIMIT 200`);
  return words.map((w) => {
    const distract = shuffle(pool.filter((p) => p.word !== w.word && p.part_of_speech === w.part_of_speech)).slice(0, 3);
    const extra = distract.length < 3 ? shuffle(pool.filter((p) => p.word !== w.word)).slice(0, 3 - distract.length) : [];
    const options = shuffle([w.meaning, ...[...distract, ...extra].map((d) => d.meaning)]);
    return {
      kind: 'mcq' as const,
      prompt: `What does "${w.word}" (${w.part_of_speech}) mean?`,
      options,
      answer: w.meaning,
    };
  });
}

async function synonymQuestions(n: number): Promise<StoredQuestion[]> {
  const words = await q<any>(
    `SELECT word, synonyms, antonyms FROM vocabulary WHERE status='published' AND cardinality(synonyms) > 0 ORDER BY random() LIMIT $1`,
    [n],
  );
  const pool = await q<any>(`SELECT word FROM vocabulary WHERE status='published' ORDER BY random() LIMIT 200`);
  return words.map((w) => {
    const syn = w.synonyms[Math.floor(Math.random() * w.synonyms.length)];
    const bad = new Set([w.word, ...w.synonyms].map((s: string) => s.toLowerCase()));
    const distract = shuffle(pool.map((p) => p.word).filter((x: string) => !bad.has(x.toLowerCase()))).slice(0, 2);
    const anti = w.antonyms[0] && !bad.has(w.antonyms[0]) ? [w.antonyms[0]] : shuffle(pool.map((p) => p.word).filter((x: string) => !bad.has(x.toLowerCase()) && !distract.includes(x))).slice(0, 1);
    return {
      kind: 'mcq' as const,
      prompt: `Choose the word closest in meaning to "${w.word}".`,
      options: shuffle([syn, ...distract, ...anti]),
      answer: syn,
    };
  });
}

async function spellingQuestions(n: number): Promise<StoredQuestion[]> {
  const words = await q<any>(
    `SELECT word, meaning, part_of_speech FROM vocabulary WHERE status='published' AND length(word) BETWEEN 5 AND 14 AND word !~ ' '
     ORDER BY random() LIMIT $1`,
    [n],
  );
  return words.map((w) => ({
    kind: 'text' as const,
    prompt: `Type the ${w.part_of_speech} that means: "${w.meaning}"`,
    hint: `${w.word.length} letters, starts with "${w.word[0]}"`,
    answer: w.word,
    accepted: [w.word],
  }));
}

async function grammarQuestions(n: number): Promise<StoredQuestion[]> {
  const rows = await q<any>(
    `SELECT prompt, options, answers, explanation FROM grammar_exercises WHERE kind='mcq' ORDER BY random() LIMIT $1`,
    [n],
  );
  return rows.map((r) => ({ kind: 'mcq' as const, prompt: r.prompt, options: shuffle(r.options), answer: r.answers[0], explanation: r.explanation }));
}

function perturb(words: string[]): string[] {
  const w = [...words];
  const i = 1 + Math.floor(Math.random() * Math.max(1, w.length - 2));
  const j = Math.min(w.length - 1, i + 1 + Math.floor(Math.random() * 2));
  [w[i], w[j]] = [w[j], w[i]];
  return w;
}

async function sentenceQuestions(n: number): Promise<StoredQuestion[]> {
  const rows = await q<any>(
    `SELECT ex FROM (SELECT unnest(examples) AS ex FROM vocabulary WHERE status='published') t
     WHERE array_length(regexp_split_to_array(ex, '\\s+'), 1) BETWEEN 6 AND 12 ORDER BY random() LIMIT $1`,
    [n],
  );
  const out: StoredQuestion[] = [];
  for (const r of rows) {
    const sentence = String(r.ex).replace(/\s+/g, ' ').trim();
    const words = sentence.replace(/[.!?]$/, '').split(' ');
    const opts = new Set<string>([words.join(' ')]);
    let guard = 0;
    while (opts.size < 4 && guard++ < 40) opts.add(perturb(words).join(' '));
    if (opts.size < 4) continue;
    out.push({
      kind: 'mcq',
      prompt: `Which word order is correct? (${shuffle(words.map((x) => x.toLowerCase().replace(/[,]/g, ''))).join(' / ')})`,
      options: shuffle([...opts]),
      answer: words.join(' '),
    });
  }
  return out;
}

export async function generateQuestions(type: BattleType, n = QUESTION_COUNT): Promise<StoredQuestion[]> {
  switch (type) {
    case 'vocabulary':
    case 'word_meaning':
      return meaningQuestions(n, null);
    case 'ielts_vocabulary':
      return meaningQuestions(n, 'ielts');
    case 'synonym':
      return synonymQuestions(n);
    case 'spelling':
      return spellingQuestions(n);
    case 'grammar':
      return grammarQuestions(n);
    case 'sentence_formation':
      return sentenceQuestions(n);
    case 'quick_quiz': {
      const parts = await Promise.all([meaningQuestions(3, null), grammarQuestions(2), synonymQuestions(2)]);
      return shuffle(parts.flat()).slice(0, n);
    }
  }
}

function publicQuestion(qs: StoredQuestion, index: number): BattleQuestionPublic {
  return { index, kind: qs.kind, prompt: qs.prompt, hint: qs.hint, options: qs.options };
}

function send(b: LiveBattle, msg: ServerMessage) {
  for (const s of b.seats) if (!s.left) deliverToUser(s.userId, msg);
}

export async function joinBattle(userId: string, battleType: BattleType, ranked: boolean): Promise<void> {
  if (!BATTLE_TYPES.includes(battleType)) throw new HttpError(400, 'invalid_battle', 'Unknown battle type.');
  if (userBattle.has(userId)) throw new HttpError(409, 'already_in_battle', 'You are already in a battle.');
  cancelBattleQueue(userId, false);
  const prof = await one<any>('SELECT battle_rating, battle_games FROM user_profiles WHERE user_id=$1', [userId]);
  if (!ranked) {
    await startBattle(battleType, false, [{ userId, rating: prof.battle_rating, games: prof.battle_games }]);
    return;
  }
  await consumeDaily(userId, 'rankedBattles');
  queue.push({ userId, battleType, rating: prof.battle_rating, joinedAt: Date.now() });
  deliverToUser(userId, { t: 'battle.status', status: 'queued' });
  await matchBattles();
}

export function cancelBattleQueue(userId: string, notify = true) {
  const idx = queue.findIndex((w) => w.userId === userId);
  if (idx >= 0) {
    queue.splice(idx, 1);
    void refundDaily(userId, 'rankedBattles');
    if (notify) deliverToUser(userId, { t: 'battle.status', status: 'cancelled' });
  }
}

async function blockedPair(a: string, b: string): Promise<boolean> {
  const r = await one(
    'SELECT 1 FROM user_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',
    [a, b],
  );
  return !!r;
}

let matching = false;
export async function matchBattles() {
  if (matching) return;
  matching = true;
  try {
    const now = Date.now();
    for (let i = 0; i < queue.length; i++) {
      const a = queue[i];
      for (let j = i + 1; j < queue.length; j++) {
        const b = queue[j];
        if (a.battleType !== b.battleType || a.userId === b.userId) continue;
        const wait = Math.max(now - a.joinedAt, now - b.joinedAt) / 1000;
        const window = 150 + wait * 20;
        if (Math.abs(a.rating - b.rating) > window) continue;
        if (await blockedPair(a.userId, b.userId)) continue;
        queue.splice(j, 1);
        queue.splice(i, 1);
        const profs = await q<any>('SELECT user_id, battle_rating, battle_games FROM user_profiles WHERE user_id = ANY($1)', [[a.userId, b.userId]]);
        const pa = profs.find((p) => p.user_id === a.userId);
        const pb = profs.find((p) => p.user_id === b.userId);
        await startBattle(a.battleType, true, [
          { userId: a.userId, rating: pa.battle_rating, games: pa.battle_games },
          { userId: b.userId, rating: pb.battle_rating, games: pb.battle_games },
        ]);
        i = -1;
        break;
      }
    }
  } finally {
    matching = false;
  }
}

async function startBattle(type: BattleType, ranked: boolean, players: { userId: string; rating: number; games: number }[]) {
  const questions = await generateQuestions(type);
  if (questions.length < 3) {
    players.forEach((p) => deliverToUser(p.userId, { t: 'error', code: 'no_content', message: 'Not enough content is available for this battle type yet.' }));
    return;
  }
  const seconds = secondsFor(type);
  const battleId = await tx(async (c) => {
    const b = await one<{ id: string }>(
      `INSERT INTO battle_sessions (battle_type, ranked, questions, seconds_per_question) VALUES ($1,$2,$3,$4) RETURNING id`,
      [type, ranked, JSON.stringify(questions), seconds],
      c,
    );
    for (let i = 0; i < players.length; i++) {
      const u = await one<any>('SELECT anon_name, avatar FROM users WHERE id=$1', [players[i].userId], c);
      await c.query(
        `INSERT INTO battle_participants (battle_id, user_id, seat, anon_name, avatar, rating_before) VALUES ($1,$2,$3,$4,$5,$6)`,
        [b!.id, players[i].userId, i, u.anon_name, u.avatar, ranked ? players[i].rating : null],
      );
    }
    return b!.id;
  });
  const battle: LiveBattle = {
    id: battleId,
    type,
    ranked,
    seats: players.map((p, i) => ({ userId: p.userId, seat: i, left: false, rating: p.rating, games: p.games })),
    questions,
    index: -1,
    deadline: 0,
    answered: new Set(),
    advanceTimer: null,
    ended: false,
    secondsPerQuestion: seconds,
  };
  live.set(battleId, battle);
  const names = await q<any>('SELECT user_id, anon_name, avatar FROM battle_participants WHERE battle_id=$1', [battleId]);
  for (const s of battle.seats) {
    userBattle.set(s.userId, battleId);
    const opp = battle.seats.find((x) => x.userId !== s.userId);
    const oppInfo = opp ? names.find((n) => n.user_id === opp.userId) : null;
    deliverToUser(s.userId, {
      t: 'battle.start',
      battleId,
      battleType: type,
      ranked,
      questionCount: questions.length,
      secondsPerQuestion: seconds,
      opponent: oppInfo ? { anonName: oppInfo.anon_name, avatar: oppInfo.avatar, rating: ranked ? opp!.rating : null } : null,
    });
  }
  setTimeout(() => nextQuestion(battle), 3000);
}

function nextQuestion(b: LiveBattle) {
  if (b.ended) return;
  b.index += 1;
  if (b.index >= b.questions.length) {
    void finishBattle(b, 'completed');
    return;
  }
  b.answered = new Set();
  b.deadline = Date.now() + b.secondsPerQuestion * 1000;
  void q('UPDATE battle_sessions SET current_index=$2 WHERE id=$1', [b.id, b.index]);
  send(b, {
    t: 'battle.question',
    battleId: b.id,
    question: publicQuestion(b.questions[b.index], b.index),
    deadline: b.deadline,
    serverNow: Date.now(),
  });
  b.advanceTimer = setTimeout(() => void reveal(b), b.secondsPerQuestion * 1000 + 400);
}

async function reveal(b: LiveBattle) {
  if (b.ended) return;
  if (b.advanceTimer) clearTimeout(b.advanceTimer);
  b.advanceTimer = null;
  const idx = b.index;
  const qs = b.questions[idx];
  const answers = await q<any>('SELECT seat, answer, correct, points FROM battle_answers WHERE battle_id=$1 AND q_index=$2', [b.id, idx]);
  const scores = await q<any>('SELECT seat, score FROM battle_participants WHERE battle_id=$1', [b.id]);
  for (const s of b.seats) {
    if (s.left) continue;
    const mine = answers.find((a) => a.seat === s.seat);
    const opp = b.seats.find((x) => x.seat !== s.seat);
    const theirs = opp ? answers.find((a) => a.seat === opp.seat) : null;
    deliverToUser(s.userId, {
      t: 'battle.reveal',
      battleId: b.id,
      index: idx,
      correctAnswer: qs.answer,
      explanation: qs.explanation,
      you: { answer: mine?.answer ?? null, correct: !!mine?.correct, points: mine?.points ?? 0 },
      opponent: opp ? { answered: !!theirs, correct: !!theirs?.correct, points: theirs?.points ?? 0 } : null,
      scores: {
        me: scores.find((x) => x.seat === s.seat)?.score ?? 0,
        opponent: opp ? (scores.find((x) => x.seat === opp.seat)?.score ?? 0) : null,
      },
    });
  }
  setTimeout(() => nextQuestion(b), 2500);
}

export async function submitBattleAnswer(userId: string, battleId: string, index: number, answer: string) {
  const b = live.get(battleId);
  if (!b || b.ended) return;
  const seat = b.seats.find((s) => s.userId === userId && !s.left);
  if (!seat || index !== b.index) return;
  const now = Date.now();
  if (now > b.deadline + 750) return; // late answers are ignored (small allowance for network latency)
  if (b.answered.has(seat.seat)) return;
  const qs = b.questions[index];
  const clean = String(answer).slice(0, 200);
  const correct = qs.kind === 'mcq' ? clean === qs.answer : isAnswerCorrect(clean, qs.accepted ?? [qs.answer]);
  const remaining = Math.max(0, b.deadline - now) / (b.secondsPerQuestion * 1000);
  const points = correct ? 100 + Math.round(50 * remaining) : 0;
  const inserted = await q(
    `INSERT INTO battle_answers (battle_id, seat, q_index, answer, correct, points) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT DO NOTHING RETURNING seat`,
    [battleId, seat.seat, index, clean, correct, points],
  );
  if (inserted.length === 0) return; // duplicate submission
  b.answered.add(seat.seat);
  await q(
    'UPDATE battle_participants SET score=score+$3, correct_count=correct_count+$4 WHERE battle_id=$1 AND seat=$2',
    [battleId, seat.seat, points, correct ? 1 : 0],
  );
  for (const s of b.seats) if (s.seat !== seat.seat && !s.left) deliverToUser(s.userId, { t: 'battle.opponent_answered', battleId, index });
  const activeSeats = b.seats.filter((s) => !s.left);
  if (activeSeats.every((s) => b.answered.has(s.seat))) void reveal(b);
}

export async function leaveBattle(userId: string, battleId: string) {
  const b = live.get(battleId);
  if (!b || b.ended) return;
  const seat = b.seats.find((s) => s.userId === userId);
  if (!seat || seat.left) return;
  seat.left = true;
  await q('UPDATE battle_participants SET left_at=now() WHERE battle_id=$1 AND seat=$2', [battleId, seat.seat]);
  userBattle.delete(userId);
  deliverToUser(userId, {
    t: 'battle.end',
    battleId,
    result: b.ranked ? 'loss' : 'practice',
    reason: 'you_left',
    scores: { me: 0, opponent: null },
    ratingBefore: null,
    ratingAfter: null,
  });
  if (b.seats.every((s) => s.left)) await finishBattle(b, 'opponent_left');
  else if (b.ranked) await finishBattle(b, 'opponent_left', seat.seat);
}

async function finishBattle(b: LiveBattle, reason: 'completed' | 'opponent_left', leaverSeat?: number) {
  if (b.ended) return;
  b.ended = true;
  if (b.advanceTimer) clearTimeout(b.advanceTimer);
  live.delete(b.id);
  const parts = await q<any>('SELECT * FROM battle_participants WHERE battle_id=$1 ORDER BY seat', [b.id]);
  const results = await tx(async (c) => {
    const s = await one<any>('SELECT status FROM battle_sessions WHERE id=$1 FOR UPDATE', [b.id], c);
    if (s.status !== 'active') return null;
    await c.query(`UPDATE battle_sessions SET status=$2, ended_at=now() WHERE id=$1`, [b.id, reason === 'completed' ? 'completed' : 'abandoned']);
    const out = new Map<number, { result: 'win' | 'loss' | 'draw' | 'practice'; before: number | null; after: number | null }>();
    if (!b.ranked || parts.length < 2) {
      for (const p of parts) out.set(p.seat, { result: 'practice', before: null, after: null });
    } else {
      const [p0, p1] = parts;
      let r0: number;
      if (leaverSeat !== undefined) r0 = leaverSeat === 0 ? 0 : 1;
      else r0 = p0.score > p1.score ? 1 : p0.score < p1.score ? 0 : 0.5;
      const seats = b.seats;
      const d0 = eloDelta(seats[0].rating, seats[1].rating, r0, seats[0].games);
      const d1 = eloDelta(seats[1].rating, seats[0].rating, 1 - r0, seats[1].games);
      const label = (r: number) => (r === 1 ? 'win' : r === 0 ? 'loss' : 'draw') as 'win' | 'loss' | 'draw';
      for (const [seat, delta, r] of [
        [seats[0], d0, r0],
        [seats[1], d1, 1 - r0],
      ] as const) {
        const after = Math.max(100, seat.rating + delta);
        await c.query('UPDATE user_profiles SET battle_rating=$2, battle_games=battle_games+1 WHERE user_id=$1', [seat.userId, after]);
        await c.query('UPDATE battle_participants SET rating_after=$3, result=$4 WHERE battle_id=$1 AND seat=$2', [b.id, seat.seat, after, label(r)]);
        out.set(seat.seat, { result: label(r), before: seat.rating, after });
      }
    }
    for (const p of parts) if (!b.ranked) await c.query(`UPDATE battle_participants SET result='practice' WHERE battle_id=$1 AND seat=$2`, [b.id, p.seat]);
    return out;
  });
  if (!results) return;
  for (const s of b.seats) {
    userBattle.delete(s.userId);
    if (s.left) continue;
    const me = parts.find((p) => p.seat === s.seat);
    const opp = parts.find((p) => p.seat !== s.seat);
    const r = results.get(s.seat)!;
    deliverToUser(s.userId, {
      t: 'battle.end',
      battleId: b.id,
      result: r.result,
      reason: reason === 'opponent_left' ? 'opponent_left' : 'completed',
      scores: { me: me?.score ?? 0, opponent: opp ? opp.score : null },
      ratingBefore: r.before,
      ratingAfter: r.after,
    });
    await recordActivity(s.userId, 'battle', b.id, { type: b.type, ranked: b.ranked, score: me?.score ?? 0 }).catch(() => undefined);
  }
}

export function onBattleUserDisconnected(userId: string) {
  cancelBattleQueue(userId, false);
  const battleId = userBattle.get(userId);
  if (!battleId) return;
  const t = setTimeout(() => {
    disconnectTimers.delete(userId);
    void leaveBattle(userId, battleId);
  }, 10_000);
  disconnectTimers.set(userId, t);
}

export function onBattleUserConnected(userId: string) {
  const t = disconnectTimers.get(userId);
  if (t) {
    clearTimeout(t);
    disconnectTimers.delete(userId);
  }
}

export function battleQueueTick() {
  if (queue.length > 1) void matchBattles();
}
