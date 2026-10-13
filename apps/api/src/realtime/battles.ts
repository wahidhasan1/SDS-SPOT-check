import { and, eq, sql } from 'drizzle-orm';
import type { BattleKind, ClientMessage } from '@fluentpath/shared';
import { db, schema } from '../db';
import { randomAlias } from '../lib/alias';
import { logActivity, userTimezone } from '../services/activity';
import { canUse, consume } from '../services/entitlements';
import { on, onClose, send, type Conn } from './hub';

export const QUESTIONS_PER_BATTLE = 10;
export const SECONDS_PER_QUESTION = 15;
const COUNTDOWN_MS = 3000;
const GRACE_MS = 1500;

/**
 * Scoring rule (shown to players): a correct answer earns 100 points plus a speed bonus of up to
 * 50 points (50 × remaining time ÷ 15 s). Wrong or unanswered questions earn 0. Both players get the
 * same questions, and time is measured on the server.
 */
export function pointsFor(correct: boolean, elapsedMs: number) {
  if (!correct) return 0;
  const remaining = Math.max(0, SECONDS_PER_QUESTION * 1000 - elapsedMs);
  return 100 + Math.floor((50 * remaining) / (SECONDS_PER_QUESTION * 1000));
}

interface Player { userId: string; alias: string; conn: Conn | null; index: number; questionStartedAt: number; score: number; correct: number; done: boolean; timer?: ReturnType<typeof setTimeout> }
interface Battle { id: string; kind: BattleKind; questions: { prompt: string; options: string[]; answer: string }[]; a: Player; b: Player; startsAt: number; finished: boolean }

const queues: Record<BattleKind, { conn: Conn; userId: string }[]> = { vocabulary: [], grammar: [] };
const battles = new Map<string, Battle>();
const userBattle = new Map<string, string>();

function shuffle<T>(a: T[]) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

export async function buildQuestions(kind: BattleKind) {
  if (kind === 'vocabulary') {
    const words = await db.select({ word: schema.words.word, definition: schema.words.definition }).from(schema.words).where(eq(schema.words.status, 'published')).orderBy(sql`random()`).limit(40);
    const picked = words.slice(0, QUESTIONS_PER_BATTLE);
    return picked.map((w) => {
      const distractors = shuffle(words.filter((x) => x.word !== w.word)).slice(0, 3).map((x) => x.word);
      return { prompt: `Which word means: “${w.definition}”`, options: shuffle([w.word, ...distractors]), answer: w.word };
    });
  }
  const rows = await db
    .select({ prompt: schema.exercises.prompt, options: schema.exercises.options, answers: schema.exercises.answers })
    .from(schema.exercises)
    .where(and(eq(schema.exercises.purpose, 'lesson'), eq(schema.exercises.type, 'mcq'), eq(schema.exercises.status, 'published')))
    .orderBy(sql`random()`)
    .limit(QUESTIONS_PER_BATTLE);
  return rows.map((r) => ({ prompt: r.prompt, options: shuffle(r.options), answer: r.answers[0] }));
}

function sides(b: Battle, userId: string) {
  return b.a.userId === userId ? { me: b.a, other: b.b } : b.b.userId === userId ? { me: b.b, other: b.a } : null;
}

function scheduleTimeout(b: Battle, p: Player) {
  clearTimeout(p.timer);
  const wait = p.questionStartedAt + SECONDS_PER_QUESTION * 1000 + GRACE_MS - Date.now();
  p.timer = setTimeout(() => answer(b, p, null), Math.max(0, wait));
}

function answer(b: Battle, p: Player, choice: string | null) {
  if (b.finished || p.done) return;
  const q = b.questions[p.index];
  const elapsed = Date.now() - p.questionStartedAt;
  const correct = choice != null && choice === q.answer && elapsed <= SECONDS_PER_QUESTION * 1000 + GRACE_MS;
  const points = pointsFor(correct, elapsed);
  p.score += points;
  if (correct) p.correct++;
  const other = p === b.a ? b.b : b.a;
  if (p.conn) send(p.conn, { type: 'battle.answer_result', battleId: b.id, index: p.index, correct, correctAnswer: q.answer, points, score: p.score });
  p.index++;
  if (other.conn) send(other.conn, { type: 'battle.opponent_progress', battleId: b.id, answered: p.index, score: p.score });
  if (p.index >= b.questions.length) {
    p.done = true;
    clearTimeout(p.timer);
    if (other.done) void finish(b, 'completed');
  } else {
    p.questionStartedAt = Date.now() + 800; // short pause to show the result
    scheduleTimeout(b, p);
  }
}

async function finish(b: Battle, reason: string, forfeitedBy?: string) {
  if (b.finished) return;
  b.finished = true;
  clearTimeout(b.a.timer);
  clearTimeout(b.b.timer);
  battles.delete(b.id);
  userBattle.delete(b.a.userId);
  userBattle.delete(b.b.userId);
  let winner: string | null = null;
  if (forfeitedBy) winner = forfeitedBy === b.a.userId ? b.b.userId : b.a.userId;
  else if (b.a.score !== b.b.score) winner = b.a.score > b.b.score ? b.a.userId : b.b.userId;
  await db
    .update(schema.battles)
    .set({ scoreA: b.a.score, scoreB: b.b.score, correctA: b.a.correct, correctB: b.b.correct, winnerId: winner, status: forfeitedBy ? 'abandoned' : 'finished', endReason: reason, finishedAt: new Date() })
    .where(eq(schema.battles.id, b.id));
  for (const [me, other] of [[b.a, b.b], [b.b, b.a]] as const) {
    const outcome = winner == null ? 'draw' : winner === me.userId ? 'win' : 'loss';
    if (me.conn) send(me.conn, { type: 'battle.end', battleId: b.id, results: { you: me.score, opponent: other.score, outcome, reason } });
    if (me.userId !== forfeitedBy) {
      await logActivity(me.userId, { type: 'battle', title: `${b.kind === 'vocabulary' ? 'Vocabulary' : 'Grammar'} battle vs ${other.alias}: ${outcome} (${me.score}–${other.score})`, refId: b.id, xp: 10 + me.correct * 2 + (outcome === 'win' ? 10 : 0), minutes: Math.min(5, (Date.now() - b.startsAt) / 60000) });
    }
  }
}

export function registerBattleHandlers() {
  on('battle.', async (conn, msg: ClientMessage) => {
    const userId = conn.user.id;
    if (msg.type === 'battle.queue.join') {
      const kind = msg.kind === 'grammar' ? 'grammar' : 'vocabulary';
      if (userBattle.has(userId)) return send(conn, { type: 'error', code: 'already_in_battle', message: 'You are already in a battle.' });
      if (Object.values(queues).some((q) => q.some((e) => e.userId === userId))) return send(conn, { type: 'error', code: 'already_queued', message: 'You are already waiting for an opponent.' });
      const allowance = await canUse(userId, 'battle', await userTimezone(userId));
      if (!allowance.allowed) return send(conn, { type: 'error', code: 'limit_reached', message: `You have played today’s ${allowance.limit} free battles. Upgrade to Premium for unlimited battles.` });
      const blocked = await db.select({ a: schema.blocks.blockerId, b: schema.blocks.blockedId }).from(schema.blocks).where(sql`blocker_id = ${userId} or blocked_id = ${userId}`);
      const blockedIds = new Set(blocked.map((r) => (r.a === userId ? r.b : r.a)));
      const q = queues[kind];
      const oi = q.findIndex((e) => e.userId !== userId && !blockedIds.has(e.userId));
      if (oi < 0) {
        q.push({ conn, userId });
        return send(conn, { type: 'battle.queued', kind });
      }
      const [opp] = q.splice(oi, 1);
      const questions = await buildQuestions(kind);
      const aliasA = randomAlias();
      const aliasB = randomAlias();
      const [row] = await db.insert(schema.battles).values({ kind, userA: opp.userId, userB: userId, aliasA, aliasB, questions }).returning({ id: schema.battles.id });
      const startsAt = Date.now() + COUNTDOWN_MS;
      const mk = (uid: string, alias: string, c: Conn): Player => ({ userId: uid, alias, conn: c, index: 0, questionStartedAt: startsAt, score: 0, correct: 0, done: false });
      const b: Battle = { id: row.id, kind, questions, a: mk(opp.userId, aliasA, opp.conn), b: mk(userId, aliasB, conn), startsAt, finished: false };
      battles.set(b.id, b);
      userBattle.set(b.a.userId, b.id);
      userBattle.set(b.b.userId, b.id);
      for (const p of [b.a, b.b]) await consume(p.userId, 'battle', await userTimezone(p.userId)).catch(() => {});
      const pub = questions.map((x, i) => ({ index: i, prompt: x.prompt, options: x.options }));
      send(b.a.conn!, { type: 'battle.start', battleId: b.id, kind, opponentAlias: aliasB, questions: pub, secondsPerQuestion: SECONDS_PER_QUESTION, startsAt });
      send(b.b.conn!, { type: 'battle.start', battleId: b.id, kind, opponentAlias: aliasA, questions: pub, secondsPerQuestion: SECONDS_PER_QUESTION, startsAt });
      scheduleTimeout(b, b.a);
      scheduleTimeout(b, b.b);
      return;
    }
    if (msg.type === 'battle.queue.leave') {
      for (const q of Object.values(queues)) {
        const i = q.findIndex((e) => e.userId === userId);
        if (i >= 0) q.splice(i, 1);
      }
      return send(conn, { type: 'battle.queue.left' });
    }
    if (msg.type === 'battle.answer') {
      const b = battles.get(msg.battleId);
      const s = b && sides(b, userId);
      if (!b || !s) return;
      if (Date.now() < b.startsAt) return;
      if (msg.index !== s.me.index) return; // ignore duplicates / out-of-order answers
      answer(b, s.me, String(msg.choice).slice(0, 300));
      return;
    }
    if (msg.type === 'battle.forfeit') {
      const b = battles.get(msg.battleId);
      if (b && sides(b, userId)) await finish(b, 'forfeit', userId);
    }
  });

  onClose(async (conn) => {
    const userId = conn.user.id;
    for (const q of Object.values(queues)) {
      const i = q.findIndex((e) => e.conn === conn);
      if (i >= 0) q.splice(i, 1);
    }
    const id = userBattle.get(userId);
    const b = id ? battles.get(id) : undefined;
    const s = b && sides(b, userId);
    if (b && s && s.me.conn === conn) await finish(b, 'opponent_left', userId);
  });
}

export function battleStats() {
  return { waiting: { vocabulary: queues.vocabulary.length, grammar: queues.grammar.length }, active: battles.size };
}
