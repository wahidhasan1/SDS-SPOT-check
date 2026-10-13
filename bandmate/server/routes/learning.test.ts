import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { testApp, signup, type Agent } from '../test-helpers.ts'
import { db } from '../db/index.ts'
import { SRS_INTERVALS_H, nextReview } from './vocab.ts'
import { updateTheta, finalResult } from './assessment.ts'
import { explainInContext } from '../services/dictionary.ts'

let app: FastifyInstance
let u: Agent
before(async () => {
  app = await testApp()
  u = await signup(app, { level: 'B1' })
})
after(() => app.close())

describe('placement assessment', () => {
  it('ability rises with correct answers and falls with wrong ones', () => {
    assert.ok(updateTheta(2, 2, true, 0) > 2)
    assert.ok(updateTheta(2, 2, false, 0) < 2)
    // A hard item answered correctly moves the estimate more than an easy one.
    assert.ok(updateTheta(2, 4, true, 3) - 2 > updateTheta(2, 0, true, 3) - 2)
  })

  it('runs end to end, one answer per item, and saves the level and history', async () => {
    const a = await signup(app)
    let r = await a.req<{ id: string; item: { id: string; options: string[] } }>('POST', '/api/assessment/start')
    assert.equal(r.status, 200)
    const id = r.body.id
    let item = r.body.item
    // Answering a different item than the one shown is refused.
    const wrong = await a.req('POST', '/api/assessment/answer', { assessmentId: id, itemId: 'v-c2-1', choice: 0 })
    assert.equal(wrong.status, item.id === 'v-c2-1' ? 200 : 409)
    let done = false
    let level = ''
    for (let i = 0; i < 30 && !done; i++) {
      const res = await a.req<{ done: boolean; item?: typeof item; result?: { level: string } }>('POST', '/api/assessment/answer', { assessmentId: id, itemId: item.id, choice: 0 })
      assert.equal(res.status, 200, JSON.stringify(res.body))
      done = res.body.done
      if (res.body.item) item = res.body.item
      if (res.body.result) level = res.body.result.level
    }
    assert.ok(done)
    assert.match(level, /^(A1|A2|B1|B2|C1|C2)$/)
    const me = await a.req<{ profile: { cefrLevel: string } }>('GET', '/api/me')
    assert.equal(me.body.profile.cefrLevel, level)
    const hist = await a.req<{ level: string; source: string }[]>('GET', '/api/me/proficiency-history')
    assert.equal(hist.body[0].source, 'placement')
    // Retaking immediately is not allowed (level can't be farmed).
    const again = await a.req('POST', '/api/assessment/start')
    assert.equal(again.status, 429)
  })

  it('users cannot set their own level through the profile API', async () => {
    const r = await u.req('PATCH', '/api/me/profile', { cefrLevel: 'C2' })
    assert.equal(r.status, 400)
  })

  it('maps the final ability estimate to a CEFR level', () => {
    assert.equal(finalResult({ theta: 3.4, asked: [], current: null }).level, 'B2')
    assert.equal(finalResult({ theta: -0.4, asked: [], current: null }).level, 'A1')
  })
})

describe('vocabulary', () => {
  it('spaced repetition: correct answers lengthen the interval, a miss resets it', () => {
    const t = 0
    assert.equal(nextReview(0, true, t).box, 1)
    assert.equal(nextReview(1, true, t).dueAt, SRS_INTERVALS_H[2] * 3600_000)
    assert.equal(nextReview(4, false, t).box, 0)
  })

  it('quiz answers are checked on the server and each question can only be answered once', async () => {
    const q = await u.req<{ id: string; items: { index: number; options: string[] | null; type: string }[] }>('POST', '/api/vocab/quiz', { kind: 'vocab', topic: 'environment' })
    assert.equal(q.status, 200)
    assert.equal(q.body.items.length, 10)
    assert.ok(q.body.items.every((i) => !('answer' in i)), 'answers must not be sent to the client')
    const first = q.body.items[0]
    const a1 = await u.req<{ correct: boolean; answer: string }>('POST', `/api/vocab/quiz/${q.body.id}/answer`, { index: 0, answer: first.options?.[0] ?? 'x' })
    assert.equal(a1.status, 200)
    const dup = await u.req('POST', `/api/vocab/quiz/${q.body.id}/answer`, { index: 0, answer: a1.body.answer })
    assert.equal(dup.status, 409)
    // Another user can't answer my quiz.
    const other = await signup(app, { level: 'B1' })
    const steal = await other.req('POST', `/api/vocab/quiz/${q.body.id}/answer`, { index: 1, answer: 'x' })
    assert.equal(steal.status, 404)
    // Score counts only correct answers.
    let correct = a1.body.correct ? 1 : 0
    for (let i = 1; i < 10; i++) {
      const r = await u.req<{ correct: boolean; answer: string; score: number; done: boolean }>('POST', `/api/vocab/quiz/${q.body.id}/answer`, { index: i, answer: i % 2 ? 'definitely wrong' : (await peekAnswer(q.body.id, i)) })
      if (r.body.correct) correct++
      assert.equal(r.body.score, correct)
      if (i === 9) assert.ok(r.body.done)
    }
    const progress = db().one<{ n: number }>('SELECT COUNT(*) AS n FROM word_progress WHERE user_id = ?', u.id)!.n
    assert.equal(progress, 10)
  })

  it('the daily challenge is one fixed set per day', async () => {
    const a = await u.req<{ id: string }>('POST', '/api/vocab/quiz', { kind: 'daily' })
    const b = await u.req<{ id: string }>('POST', '/api/vocab/quiz', { kind: 'daily' })
    assert.equal(a.body.id, b.body.id)
  })

  it('saving words fills in a meaning, and reviews follow the schedule', async () => {
    const s = await u.req<{ word: string; meaning: string }>('POST', '/api/vocab/saved', { word: 'Sustainable', source: 'manual' })
    assert.equal(s.body.word, 'sustainable')
    assert.match(s.body.meaning, /without harming/)
    const ctx = await u.req<{ meaning: string }>('POST', '/api/vocab/saved', { word: 'bank', context: 'We had a picnic on the bank of the river.', source: 'reading' })
    assert.match(ctx.body.meaning, /slop|land|river|water/i)
    const bad = await u.req('POST', '/api/vocab/saved', { word: 'qwxzzv', source: 'manual' })
    assert.equal(bad.status, 404)
    const review = await u.req<{ word: string }[]>('GET', '/api/vocab/review')
    assert.ok(review.body.some((c) => c.word === 'sustainable'))
    const r1 = await u.req<{ box: number }>('POST', '/api/vocab/review', { word: 'sustainable', knew: true })
    assert.equal(r1.body.box, 1)
    const early = await u.req('POST', '/api/vocab/review', { word: 'sustainable', knew: true })
    assert.equal(early.status, 409, 'cannot farm reviews before the word is due')
  })
})

describe('grammar', () => {
  it('lessons hide answers; checking scores on the server', async () => {
    const list = await u.req<{ lessons: { id: string }[]; recommended: string }>('GET', '/api/grammar/lessons')
    assert.ok(list.body.lessons.length >= 10)
    assert.ok(list.body.recommended)
    const l = await u.req<{ exercises: Record<string, unknown>[] }>('GET', '/api/grammar/lessons/g-present-perfect')
    assert.ok(l.body.exercises.every((e) => !('answer' in e) && !('explanation' in e)))
    const res = await u.req<{ score: number; total: number; results: { correct: boolean }[] }>('POST', '/api/grammar/lessons/g-present-perfect/check', { answers: [1, 2, 'for', ' Since ', 1, 1] })
    assert.equal(res.body.total, 6)
    assert.equal(res.body.score, 6)
    const res2 = await u.req<{ score: number }>('POST', '/api/grammar/lessons/g-present-perfect/check', { answers: [0, 0, 'since', 'for', 0, 0] })
    assert.equal(res2.body.score, 0)
  })
})

describe('dictionary', () => {
  const at = (s: string, w: string) => explainInContext(s, (s.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? []).findIndex((x) => x.toLowerCase() === w))!
  it('chooses the sense that fits the sentence', () => {
    assert.match(at('She sat on the bank of the river.', 'bank').best!.definition, /slop|land/)
    assert.match(at('I deposited my salary at the bank.', 'bank').best!.definition, /financial/)
    assert.match(at('Our team won the football match.', 'match').best!.definition, /contest/)
  })
  it('recognises phrasal verbs and idioms, including inflected and possessive forms', () => {
    assert.equal(at('He finally gave up smoking.', 'gave').lemma, 'give up')
    assert.equal(at('That joke really broke the ice.', 'ice').lemma, 'break the ice')
    assert.equal(at('Stop pulling my leg!', 'leg').lemma, "pull someone's leg")
  })
})

async function peekAnswer(quizId: string, index: number) {
  const row = db().one<{ items: string }>('SELECT items FROM quiz_sessions WHERE id = ?', quizId)!
  return (JSON.parse(row.items) as { answer: string }[])[index].answer
}
