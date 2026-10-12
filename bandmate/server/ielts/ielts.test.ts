import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { testApp, signup, type Agent } from '../test-helpers.ts'
import { db } from '../db/index.ts'
import { env } from '../env.ts'
import { readContent } from '../content/seed.ts'
import { LETTERS, ROMAN, answerKey, bandFor, mark, overallBand, questionNumbers, score, sections, type ObjectiveTest } from './tests.ts'
import { alignReadAloud } from './speaking-routes.ts'
import { encodeMp3, synth } from '../services/tts.ts'
import { asrReady } from '../services/features.ts'

let app: FastifyInstance
let u: Agent
before(async () => {
  app = await testApp()
  u = await signup(app, { level: 'B2' })
  db().run("UPDATE profiles SET test_type = 'academic', target_band = 7 WHERE user_id = ?", u.id)
})
after(() => app.close())

const tests = (): ObjectiveTest[] => [
  ...fs.readdirSync(path.join(env.root, 'content')).filter((f) => f.startsWith('reading-')).map((f) => readContent<ObjectiveTest>(f)),
  ...readContent<ObjectiveTest[]>('listening.json'),
]
const fullAnswers = (t: ObjectiveTest) => {
  const k = answerKey(t)
  const out: Record<string, string> = {}
  for (const [n, key] of k) out[n] = key.kind === 'multi' ? key.accepted[key.multi!.indexOf(n)] : key.accepted[0]
  return out
}

describe('content integrity', () => {
  for (const t of tests()) {
    it(`${t.id}: 40 questions numbered 1–40, all with answers and explanations`, () => {
      const nums = questionNumbers(t)
      assert.deepEqual(nums, Array.from({ length: 40 }, (_, i) => i + 1))
      const key = answerKey(t)
      for (const n of nums) {
        assert.ok(key.get(n), `missing key for ${n}`)
        assert.ok(key.get(n)!.why.length > 5, `missing explanation for ${n}`)
      }
    })
    it(`${t.id}: letter answers point to real options; reading gap answers appear in the passage`, () => {
      for (const s of sections(t)) {
        const passage = (s.paragraphs ?? []).map((p) => p.text).join(' ').toLowerCase()
        for (const g of s.groups) {
          if (g.type === 'mcq') for (const q of g.questions) assert.ok(LETTERS.indexOf(q.answer) < q.options.length, `${q.n}`)
          if (g.type === 'headings') for (const q of g.questions) assert.ok(ROMAN.indexOf(q.answer) >= 0 && ROMAN.indexOf(q.answer) < g.headings.length, `${q.n}`)
          if (g.type === 'match_features') for (const q of g.questions) assert.ok(LETTERS.indexOf(q.answer) < g.features.length, `${q.n}`)
          if (g.type === 'endings') for (const q of g.questions) assert.ok(LETTERS.indexOf(q.answer) < g.endings.length, `${q.n}`)
          if (g.type === 'gaps') {
            for (const [n, acc] of Object.entries(g.answers)) {
              if (g.bank) assert.ok(LETTERS.indexOf(acc[0]) < g.bank.length, `bank ${n}`)
              else if (t.passages) assert.ok(acc.some((a) => passage.includes(a.toLowerCase())), `answer “${acc[0]}” for ${n} not found in passage`)
              if (!g.bank && g.wordLimit) assert.ok(acc.some((a) => a.split(' ').filter((w) => !/^\d/.test(w) || !g.allowNumber).length <= g.wordLimit!), `answer ${n} exceeds word limit`)
            }
          }
        }
      }
    })
    if (t.parts)
      it(`${t.id}: every part has rendered audio`, () => {
        for (const p of t.parts!) assert.ok(fs.existsSync(path.join(env.root, 'public', 'audio', 'listening', `${p.id}.mp3`)), p.id!)
      })
  }
})

describe('scoring rules', () => {
  const t = readContent<ObjectiveTest>('reading-academic-1.json')
  it('all correct answers give 40/40 and band 9', () => {
    const s = score(t, fullAnswers(t))
    assert.equal(s.raw, 40)
    assert.equal(bandFor('academic', s.raw, s.max), 9)
  })
  it('follows IELTS answer conventions', () => {
    const key = answerKey(t)
    assert.ok(mark(key.get(7)!, ' Flowering. ', {}), 'case and punctuation are ignored')
    assert.ok(!mark(key.get(7)!, 'flowring', {}), 'spelling must be correct')
    assert.ok(!mark(key.get(24)!, 'the evening light', {}), 'answers over the word limit are wrong')
    assert.ok(mark(key.get(25)!, 'the weekends', {}), 'accepted variants are allowed')
    assert.ok(mark(key.get(14)!, 'II', {}), 'roman numerals in any case')
    assert.ok(!mark(key.get(1)!, '', {}), 'blank is wrong')
  })
  it('choose-TWO questions accept either order but not the same letter twice', () => {
    const gt = readContent<ObjectiveTest>('reading-gt-1.json')
    const k = answerKey(gt)
    assert.ok(mark(k.get(25)!, 'D', { 25: 'D', 26: 'B' }) && mark(k.get(26)!, 'B', { 25: 'D', 26: 'B' }))
    assert.equal([mark(k.get(25)!, 'B', { 25: 'B', 26: 'B' }), mark(k.get(26)!, 'B', { 25: 'B', 26: 'B' })].filter(Boolean).length, 1)
  })
  it('converts raw scores to approximate bands and rounds the overall band like IELTS', () => {
    assert.equal(bandFor('listening', 30, 40), 7)
    assert.equal(bandFor('general_training', 30, 40), 6)
    assert.equal(bandFor('academic', 13, 13), null, 'partial tests get no band')
    assert.equal(overallBand([6.5, 6.5, 5, 7]), 6.5) // 6.25 → 6.5
    assert.equal(overallBand([4, 3.5, 4, 4]), 4) // 3.875 → 4
    assert.equal(overallBand([6, 6, 5.5, 5.5]), 6) // 5.75 → 6
    assert.equal(overallBand([7, 6.5, 6.5, 6.5]), 6.5) // 6.625 → 6.5
  })
})

describe('reading and listening attempts', () => {
  it('hides answers, persists answers, scores exactly what was submitted, and is idempotent', async () => {
    const a = await u.req<{ id: string; test: unknown; questionNumbers: number[] }>('POST', '/api/ielts/attempts', { contentId: 'read-ac-1', mode: 'practice', scope: 0 })
    assert.equal(a.status, 200)
    const blob = JSON.stringify(a.body.test)
    assert.ok(!blob.includes('"answer"') && !blob.includes('"why"') && !blob.includes('flowering"]'), 'no answers in the test view')
    assert.deepEqual(a.body.questionNumbers, Array.from({ length: 13 }, (_, i) => i + 1))
    await u.req('PATCH', `/api/ielts/attempts/${a.body.id}`, { answers: { 1: 'TRUE', 7: 'flowering' }, flagged: [3] })
    const resumed = await u.req<{ id: string; answers: Record<string, string>; flagged: number[] }>('POST', '/api/ielts/attempts', { contentId: 'read-ac-1', mode: 'practice', scope: 0 })
    assert.equal(resumed.body.id, a.body.id)
    assert.equal(resumed.body.answers['7'], 'flowering')
    assert.deepEqual(resumed.body.flagged, [3])
    const sub = await u.req<{ result: { score: number; max: number; band: number | null; items: { n: number; correct: boolean }[] } }>('POST', `/api/ielts/attempts/${a.body.id}/submit`, { answers: { 1: 'TRUE', 2: 'FALSE', 7: 'flowering' } })
    assert.equal(sub.body.result.score, 2) // 1 and 7 correct; 2 is TRUE in the key
    assert.equal(sub.body.result.max, 13)
    assert.equal(sub.body.result.band, null)
    assert.equal(sub.body.result.items.find((i) => i.n === 2)!.correct, false)
    const again = await u.req<{ result: { score: number } }>('POST', `/api/ielts/attempts/${a.body.id}/submit`, { answers: fullAnswers(readContent('reading-academic-1.json')) })
    assert.equal(again.body.result.score, 2, 'a second submit cannot change the result')
    const late = await u.req('PATCH', `/api/ielts/attempts/${a.body.id}`, { answers: { 3: 'TRUE' } })
    assert.equal(late.status, 409)
  })

  it('exam mode: full test gets a band; answers sent after the time limit are ignored', async () => {
    const a = await u.req<{ id: string; timeLimitS: number }>('POST', '/api/ielts/attempts', { contentId: 'listen-1', mode: 'exam', scope: null })
    assert.ok(a.body.timeLimitS > 480)
    await u.req('PATCH', `/api/ielts/attempts/${a.body.id}`, { answers: { 1: 'Jennings' } })
    // Pretend the attempt started long ago.
    db().run('UPDATE attempts SET started_at = ? WHERE id = ?', Date.now() - 3 * 3600_000, a.body.id)
    const sub = await u.req<{ result: { score: number; band: number; late: boolean } }>('POST', `/api/ielts/attempts/${a.body.id}/submit`, { answers: fullAnswers(readContent<ObjectiveTest[]>('listening.json')[0]) })
    assert.equal(sub.body.result.late, true)
    assert.equal(sub.body.result.score, 1, 'only the answer saved before the deadline counts')
    assert.equal(sub.body.result.band, 2)
  })

  it('exam mode: each listening part can be played only once', async () => {
    const a = await u.req<{ id: string }>('POST', '/api/ielts/attempts', { contentId: 'listen-1', mode: 'exam', scope: null })
    assert.equal((await u.req('POST', `/api/ielts/attempts/${a.body.id}/played`, { part: 0 })).status, 200)
    assert.equal((await u.req('POST', `/api/ielts/attempts/${a.body.id}/played`, { part: 0 })).status, 409)
    // Practice mode allows replays.
    const p = await u.req<{ id: string }>('POST', '/api/ielts/attempts', { contentId: 'listen-1', mode: 'practice', scope: 0 })
    await u.req('POST', `/api/ielts/attempts/${p.body.id}/played`, { part: 0 })
    assert.equal((await u.req('POST', `/api/ielts/attempts/${p.body.id}/played`, { part: 0 })).status, 200)
  })

  it('other users cannot read or modify my attempts', async () => {
    const mine = await u.req<{ id: string }>('POST', '/api/ielts/attempts', { contentId: 'read-ac-1', mode: 'practice', scope: 1 })
    const other = await signup(app, { level: 'B1' })
    assert.equal((await other.req('GET', `/api/ielts/attempts/${mine.body.id}`)).status, 404)
    assert.equal((await other.req('PATCH', `/api/ielts/attempts/${mine.body.id}`, { answers: { 14: 'i' } })).status, 404)
    assert.equal((await other.req('POST', `/api/ielts/attempts/${mine.body.id}/submit`, { answers: {} })).status, 404)
  })
})

describe('writing', () => {
  it('autosaves with draft history, submits, and returns criterion-based checks', async () => {
    const s = await u.req<{ id: string }>('POST', '/api/writing/submissions', { promptId: 'w-t2-technology' })
    await u.req('PATCH', `/api/writing/submissions/${s.body.id}`, { text: 'Technology is good.' })
    const same = await u.req<{ id: string; text: string }>('POST', '/api/writing/submissions', { promptId: 'w-t2-technology' })
    assert.equal(same.body.id, s.body.id)
    assert.equal(same.body.text, 'Technology is good.')
    const essay = 'Some people says technology make people more isolated. However, I believe it has made communication much easier.\n\nFirstly, video calls allow families to stay in touch. For example, my cousin talks to her parents every day although she lives abroad.\n\nOn the other hand, some teenagers spend too much time online and they meet friends less often.\n\nIn conclusion, technology helps people communicate when it is used sensibly.'
    const sub = await u.req<{ status: string; checks: { stats: { wordCount: number }; criteria: Record<string, { level: string; text: string }[]> } }>('POST', `/api/writing/submissions/${s.body.id}/submit`, { text: essay })
    assert.equal(sub.body.status, 'submitted')
    assert.ok(sub.body.checks.criteria.task.some((n) => n.level === 'warn' && /minimum is 250/.test(n.text)), 'short essays are flagged')
    assert.ok(sub.body.checks.criteria.coherence.length > 0 && sub.body.checks.criteria.lexical.length > 0 && sub.body.checks.criteria.grammar.length > 0)
    const drafts = await u.req<unknown[]>('GET', `/api/writing/submissions/${s.body.id}/drafts`)
    assert.ok(drafts.body.length >= 1)
  })

  it('AI feedback needs consent and a configured provider; failures do not use up the allowance', async () => {
    const s = await u.req<{ id: string }>('POST', '/api/writing/submissions', { promptId: 'w-t2-cities', fresh: true })
    await u.req('POST', `/api/writing/submissions/${s.body.id}/submit`, { text: 'Traffic is a big problem in many cities because there are too many cars on the roads and public transport is often slow.' })
    const noConsent = await u.req<{ error: { code: string } }>('POST', `/api/writing/submissions/${s.body.id}/ai-feedback`)
    assert.equal(noConsent.body.error.code, 'consent_required')
    await u.req('PATCH', '/api/me/profile', { aiConsent: true })
    const r = await u.req<{ error: { code: string } }>('POST', `/api/writing/submissions/${s.body.id}/ai-feedback`)
    if (!env.anthropicKey) {
      assert.equal(r.status, 503)
      assert.equal(r.body.error.code, 'not_configured')
      const used = db().one<{ count: number }>("SELECT count FROM usage_counters WHERE user_id = ? AND metric = 'writingFeedbackPerDay'", u.id)?.count ?? 0
      assert.equal(used, 0, 'allowance refunded')
    }
  })
})

describe('speaking', () => {
  it('read-aloud alignment finds the words the recogniser missed', () => {
    const a = alignReadAloud('I usually walk to work because the office is close to my flat.', 'I usually walk to work because the office is close to my flight')
    assert.equal(a.total, 13)
    assert.equal(a.matched, 12)
    assert.deepEqual(a.words.filter((w) => !w.heard).map((w) => w.word), ['flat'])
  })

  it('transcribes a real recording and measures fluency (offline speech recognition)', { skip: !asrReady() && 'speech models not downloaded' }, async () => {
    await u.req('PATCH', '/api/me/profile', { speechConsent: true })
    const speech = synth('My hometown is a busy city near the coast. I like it because the people are friendly and there are many parks. However, the traffic can be terrible during rush hour.', 'gb_female', 0.95)
    const file = path.join(env.root, 'data', 'test-answer.mp3')
    await encodeMp3(speech.samples, speech.sampleRate, file)
    const boundary = '----bm' + Date.now()
    const parts: Buffer[] = []
    const field = (k: string, v: string) => parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`))
    field('part', '1')
    field('mode', 'answer')
    field('question', 'Where is your hometown?')
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`), fs.readFileSync(file), Buffer.from(`\r\n--${boundary}--\r\n`))
    const res = await app.inject({ method: 'POST', url: '/api/speaking/analyse', headers: { cookie: u.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(parts) })
    fs.rmSync(file)
    assert.equal(res.statusCode, 200, res.body)
    const body = JSON.parse(res.body) as { transcript: string; metrics: { words: number; articulationRate: number; durationS: number }; feedback: { notes: Record<string, unknown[]> } }
    assert.match(body.transcript.toLowerCase(), /hometown.*coast/)
    assert.match(body.transcript.toLowerCase(), /traffic/)
    assert.ok(body.metrics.words >= 25 && body.metrics.articulationRate > 80, JSON.stringify(body.metrics))
    assert.ok(body.feedback.notes.fluency.length > 0)
    assert.ok(!fs.readdirSync(path.join(env.root, 'data')).some((f) => f.endsWith('.webm')), 'audio is not stored')
  })
})

describe('mock tests', () => {
  it('runs sections in order, cannot skip, and reports results only from real data', async () => {
    const m = await u.req<{ id: string; section: string; status: string }>('POST', '/api/mock/start', { mockId: 'mock-ac-1' })
    assert.equal(m.body.section, 'listening')
    const again = await u.req<{ id: string }>('POST', '/api/mock/start', { mockId: 'mock-ac-1' })
    assert.equal(again.body.id, m.body.id, 'resumes instead of starting another')
    const skip = await u.req<{ section: string }>('POST', `/api/mock/attempts/${m.body.id}/complete`, { section: 'reading' })
    assert.equal(skip.body.section, 'listening', 'cannot complete a section that is not current')
    for (const section of ['listening', 'reading', 'writing', 'speaking']) {
      const b = await u.req<{ section: string; underlying: Record<string, unknown> }>('POST', `/api/mock/attempts/${m.body.id}/begin`)
      assert.equal(b.body.section, section)
      const c = await u.req<{ section: string | null }>('POST', `/api/mock/attempts/${m.body.id}/complete`, { section })
      assert.notEqual(c.body.section, section)
    }
    const done = await u.req<{ status: string; results: { bands: Record<string, number | null>; overall: number | null } }>('GET', `/api/mock/attempts/${m.body.id}`)
    assert.equal(done.body.status, 'completed')
    assert.equal(done.body.results.bands.listening, 2) // nothing answered
    assert.equal(done.body.results.bands.writing, null) // no AI estimate without feedback
    assert.equal(done.body.results.overall, null)
    // Free plan: one mock per week.
    const second = await u.req<{ error: { code: string } }>('POST', '/api/mock/start', { mockId: 'mock-ac-1' })
    assert.equal(second.body.error.code, 'limit_reached')
  })

  it('the dashboard reports only real data', async () => {
    const o = await u.req<{ skills: { reading: { attempts: number }; speaking: { recordings: number } }; estimate: number | null; next: { title: string } }>('GET', '/api/ielts/overview')
    assert.ok(o.body.skills.reading.attempts >= 1)
    assert.equal(o.body.estimate, null)
    assert.ok(o.body.next.title.length > 0)
  })
})
