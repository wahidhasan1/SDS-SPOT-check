import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db, json } from '../db/index.ts'
import { env } from '../env.ts'
import { requireUser } from '../lib/auth.ts'
import { consume, hasFlag, refund } from '../lib/plans.ts'
import { HttpError, newId, notFound, now, wordsOf } from '../lib/util.ts'
import { recordActivity } from '../lib/events.ts'
import { decodeAudio, transcribe, type SpeechSegment } from '../services/asr.ts'
import { languageToolUp } from '../services/features.ts'
import { llmJson } from '../services/llm.ts'

/** Sentences for the read-aloud check (original). Grouped by difficulty. */
export const READ_ALOUD = [
  { id: 'ra-1', level: 'A2', text: 'I usually walk to work because the office is close to my flat.' },
  { id: 'ra-2', level: 'A2', text: 'My favourite season is autumn, when the leaves turn red and yellow.' },
  { id: 'ra-3', level: 'B1', text: 'The museum was crowded, so we decided to visit the park instead.' },
  { id: 'ra-4', level: 'B1', text: 'Learning a language takes patience, practice and a little courage.' },
  { id: 'ra-5', level: 'B2', text: 'Researchers have discovered that regular exercise significantly improves concentration.' },
  { id: 'ra-6', level: 'B2', text: 'Although the weather was terrible, thousands of people attended the festival.' },
  { id: 'ra-7', level: 'C1', text: 'The government’s environmental policy has been widely criticised for lacking ambition.' },
  { id: 'ra-8', level: 'C1', text: 'Particularly in rural areas, access to reliable healthcare remains a significant challenge.' },
]

const FILLERS = ['um', 'uh', 'er', 'erm', 'hmm', 'you know', 'i mean', 'kind of', 'sort of', 'basically', 'like']

/** Aligns the expected sentence with what the recogniser heard (longest common subsequence on words). */
export function alignReadAloud(target: string, heard: string) {
  const t = wordsOf(target.toLowerCase().replace(/’/g, "'"))
  const h = wordsOf(heard.toLowerCase().replace(/’/g, "'"))
  const dp = Array.from({ length: t.length + 1 }, () => new Array<number>(h.length + 1).fill(0))
  for (let i = t.length - 1; i >= 0; i--) for (let j = h.length - 1; j >= 0; j--) dp[i][j] = t[i] === h[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const words: { word: string; heard: boolean }[] = []
  let i = 0
  let j = 0
  while (i < t.length) {
    if (j < h.length && t[i] === h[j]) {
      words.push({ word: t[i], heard: true })
      i++
      j++
    } else if (j < h.length && dp[i][j + 1] >= dp[i + 1][j]) j++
    else {
      words.push({ word: t[i], heard: false })
      i++
    }
  }
  return { words, matched: words.filter((w) => w.heard).length, total: t.length }
}

export function speakingMetrics(text: string, segments: SpeechSegment[], duration: number) {
  const words = wordsOf(text)
  const lower = ` ${text.toLowerCase()} `
  const speech = segments.reduce((n, s) => n + (s.end - s.start), 0)
  const gaps = segments.slice(1).map((s, i) => s.start - segments[i].end).filter((g) => g > 0)
  const longPauses = gaps.filter((g) => g >= 1.5)
  const fillers = FILLERS.map((f) => ({ f, n: (lower.match(new RegExp(`[^a-z]${f}[^a-z]`, 'g')) ?? []).length })).filter((x) => x.n)
  const content = words.map((w) => w.toLowerCase()).filter((w) => w.length > 3)
  const bank = db().all<{ word: string; level: string }>("SELECT word, level FROM vocab_words WHERE level IN ('B2','C1','C2')")
  const advanced = bank.filter((b) => new RegExp(`\\b${b.word}`, 'i').test(text)).map((b) => b.word)
  return {
    durationS: +duration.toFixed(1),
    speechS: +speech.toFixed(1),
    words: words.length,
    wordsPerMinute: duration > 0 ? Math.round(words.length / (duration / 60)) : 0,
    articulationRate: speech > 0 ? Math.round(words.length / (speech / 60)) : 0,
    pauses: gaps.length,
    longPauses: longPauses.length,
    longestPauseS: +(Math.max(0, ...gaps)).toFixed(1),
    fillers: fillers.map((x) => ({ word: x.f, count: x.n })),
    uniqueWordRatio: content.length ? +(new Set(content).size / content.length).toFixed(2) : 0,
    advancedWords: advanced,
  }
}

type Note = { level: 'good' | 'warn' | 'tip'; text: string }

async function grammarOnTranscript(text: string) {
  if (!(await languageToolUp())) return null
  try {
    const r = await fetch(`${env.languageToolUrl}/v2/check`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ text, language: 'en-GB' }), signal: AbortSignal.timeout(10_000) })
    const d = (await r.json()) as { matches: { message: string; offset: number; length: number; replacements: { value: string }[]; rule: { issueType: string; category: { id: string } } }[] }
    // Spoken transcripts have no reliable punctuation or capitals: keep only grammar issues.
    return d.matches
      .filter((m) => m.rule.issueType === 'grammar' && !['PUNCTUATION', 'CASING', 'TYPOGRAPHY', 'TYPOS'].includes(m.rule.category.id))
      .slice(0, 8)
      .map((m) => ({ message: m.message, text: text.slice(m.offset, m.offset + m.length), replacements: m.replacements.slice(0, 2).map((x) => x.value) }))
  } catch {
    return null
  }
}

export function speakingNotes(m: ReturnType<typeof speakingMetrics>, part: number, grammarIssues: { message: string }[] | null) {
  const fluency: Note[] = []
  const lexical: Note[] = []
  const grammar: Note[] = []
  const target = part === 2 ? 100 : part === 1 ? 20 : 45
  if (m.durationS < target * 0.5) fluency.push({ level: 'warn', text: part === 2 ? 'Try to keep talking for the full two minutes. Use the cue card points to plan more ideas.' : 'Your answer was quite short. Extend it with a reason and an example.' })
  if (m.articulationRate < 90) fluency.push({ level: 'warn', text: `You spoke slowly (${m.articulationRate} words per minute while speaking). Practise to speak more smoothly; around 120–160 is typical for fluent speakers.` })
  else if (m.articulationRate > 190) fluency.push({ level: 'tip', text: `You spoke very fast (${m.articulationRate} words per minute). Slow down slightly so every word is clear.` })
  else fluency.push({ level: 'good', text: `Comfortable speaking speed (${m.articulationRate} words per minute while speaking).` })
  if (m.longPauses >= 3) fluency.push({ level: 'warn', text: `${m.longPauses} long pauses (over 1.5 s, longest ${m.longestPauseS} s). Use phrases like “That’s an interesting question…” to keep going while you think.` })
  else if (m.durationS > 15) fluency.push({ level: 'good', text: 'Few long pauses — good flow.' })
  const fillerTotal = m.fillers.reduce((n, f) => n + f.count, 0)
  if (fillerTotal >= 4) fluency.push({ level: 'tip', text: `Filler words detected ${fillerTotal} times (${m.fillers.map((f) => f.word).join(', ')}). The recogniser may miss some “um/uh” sounds.` })

  if (m.words >= 25 && m.uniqueWordRatio < 0.5) lexical.push({ level: 'tip', text: 'You repeated many words. Try paraphrasing and using synonyms.' })
  if (m.advancedWords.length) lexical.push({ level: 'good', text: `Less common vocabulary used: ${m.advancedWords.slice(0, 6).join(', ')}.` })
  else if (m.words >= 25) lexical.push({ level: 'tip', text: 'Add a few topic-specific or less common words to show range (see the Vocabulary topics).' })

  if (grammarIssues === null) grammar.push({ level: 'tip', text: 'Automatic grammar checking is not available on this server right now.' })
  else if (grammarIssues.length) grammar.push({ level: 'warn', text: `${grammarIssues.length} possible grammar ${grammarIssues.length === 1 ? 'error' : 'errors'} in the transcript (see below). Note: recognition mistakes can look like grammar errors.` })
  else if (m.words >= 15) grammar.push({ level: 'good', text: 'No grammar errors were detected in the transcript.' })
  return { fluency, lexical, grammar }
}

const AiSpeaking = z.object({
  fluency_band: z.number(),
  lexical_band: z.number(),
  grammar_band: z.number(),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  better_phrases: z.array(z.object({ original: z.string(), better: z.string(), why: z.string() })),
})

type SessionRow = { id: string; user_id: string; prompt_id: string | null; part: number | null; question: string; transcript: string; duration_s: number; metrics: string; feedback: string; created_at: number; mode: string; ai_feedback: string | null; mock_attempt_id: string | null }
const view = (r: SessionRow) => ({ id: r.id, promptId: r.prompt_id, part: r.part, mode: r.mode, question: r.question, transcript: r.transcript, durationS: r.duration_s, metrics: json(r.metrics, {}), feedback: json(r.feedback, {}), aiFeedback: json(r.ai_feedback, null), createdAt: r.created_at, mockAttemptId: r.mock_attempt_id })

export const speakingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/prompts', async (req) => {
    requireUser(req)
    const rows = db().all<{ id: string; data: string; premium: number }>("SELECT id, data, premium FROM content_items WHERE kind = 'speaking' AND status = 'published' ORDER BY sort")
    const items: (Record<string, unknown> & { id: string; premium: boolean })[] = rows.map((r) => ({ ...(JSON.parse(r.data) as Record<string, unknown>), id: r.id, premium: !!r.premium }))
    return { part1: items.filter((i) => i.part === 1), part2: items.filter((i) => i.part === 2), readAloud: READ_ALOUD }
  })

  /** Transcribes and analyses one recorded answer. The audio is processed on our server and never stored. */
  app.post('/analyse', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req)
    const consent = db().one<{ speech_consent: number }>('SELECT speech_consent FROM profiles WHERE user_id = ?', user.id)!.speech_consent
    if (!consent) throw new HttpError(403, 'consent_required', 'Please allow speech analysis first.')
    const file = await req.file()
    if (!file) throw new HttpError(400, 'no_audio', 'No recording was received.')
    const fields = Object.fromEntries(Object.entries(file.fields).map(([k, v]) => [k, (v as { value?: string }).value])) as Record<string, string | undefined>
    const meta = z
      .object({ part: z.coerce.number().int().min(0).max(3), mode: z.enum(['answer', 'read-aloud']).default('answer'), question: z.string().max(500), promptId: z.string().max(60).optional(), mockAttemptId: z.string().max(60).optional() })
      .parse(fields)
    if (meta.promptId) {
      const pr = db().one<{ premium: number }>("SELECT premium FROM content_items WHERE id = ? AND kind = 'speaking'", meta.promptId)
      if (pr?.premium && !hasFlag(user.id, 'premiumContent')) throw new HttpError(402, 'premium_required', 'This topic is part of Premium.')
    }
    if (meta.mockAttemptId) {
      const m = db().one<{ status: string; section_index: number }>('SELECT status, section_index FROM mock_attempts WHERE id = ? AND user_id = ?', meta.mockAttemptId, user.id)
      if (!m || m.status !== 'in_progress' || m.section_index !== 3) throw new HttpError(409, 'mock_closed', 'The speaking section of this mock test is not open.')
    }
    if (!/^audio\//.test(file.mimetype) && file.mimetype !== 'application/octet-stream') throw new HttpError(400, 'bad_audio', 'Please upload an audio recording.')
    const buf = await file.toBuffer()
    consume(user.id, 'speakingAnalysesPerDay', 'speaking analyses')
    try {
      const pcm = await decodeAudio(buf, 200)
      const r = await transcribe(pcm)
      if (r.duration < 1.5 || !r.text.trim()) throw new HttpError(422, 'no_speech', 'We couldn’t hear any speech. Check your microphone and try again.')
      const metrics = speakingMetrics(r.text, r.segments, r.duration)
      let feedback: Record<string, unknown>
      if (meta.mode === 'read-aloud') {
        const target = READ_ALOUD.find((x) => x.text === meta.question)?.text ?? meta.question
        const a = alignReadAloud(target, r.text)
        feedback = { readAloud: { ...a, percent: Math.round((a.matched / Math.max(1, a.total)) * 100) } }
      } else {
        const g = await grammarOnTranscript(r.text)
        feedback = { notes: speakingNotes(metrics, meta.part, g), grammarIssues: g ?? [] }
      }
      const id = newId('sp_')
      db().run(
        'INSERT INTO speaking_sessions (id, user_id, prompt_id, part, question, transcript, duration_s, metrics, feedback, created_at, mode, mock_attempt_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, user.id, meta.promptId ?? null, meta.part, meta.question, r.text, r.duration, JSON.stringify(metrics), JSON.stringify(feedback), now(), meta.mode, meta.mockAttemptId ?? null,
      )
      recordActivity(user.id)
      return view(db().one<SessionRow>('SELECT * FROM speaking_sessions WHERE id = ?', id)!)
    } catch (e) {
      refund(user.id, 'speakingAnalysesPerDay')
      throw e
    }
  })

  app.post('/:id/ai-feedback', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req)
    const s = db().one<SessionRow>('SELECT * FROM speaking_sessions WHERE id = ? AND user_id = ?', (req.params as { id: string }).id, user.id)
    if (!s) throw notFound('Recording not found.')
    if (s.ai_feedback) return view(s)
    if (s.mode !== 'answer') throw new HttpError(400, 'bad_mode', 'AI feedback is for answers, not read-aloud checks.')
    if (!db().one<{ ai_consent: number }>('SELECT ai_consent FROM profiles WHERE user_id = ?', user.id)!.ai_consent) throw new HttpError(403, 'consent_required', 'Please agree to send your transcript to the AI provider first.')
    consume(user.id, 'writingFeedbackPerDay', 'AI feedback reviews')
    try {
      const m = json<ReturnType<typeof speakingMetrics>>(s.metrics, {} as never)
      const fb = await llmJson({
        system: 'You are an experienced IELTS speaking teacher. You receive an automatic transcript (not audio) of a learner’s answer plus timing measurements. Give unofficial practice estimates for Fluency and coherence, Lexical resource, and Grammatical range and accuracy only — you cannot assess pronunciation from text, so do not mention a pronunciation score. Be specific, encouraging and use simple English. Suggest better phrases using the learner’s own words.',
        prompt: `IELTS Speaking Part ${s.part}. Question: ${s.question}\n\nTranscript (automatic, may contain recognition errors):\n"""${s.transcript}"""\n\nMeasurements: ${m.durationS}s total, ${m.speechS}s of speech, ${m.wordsPerMinute} words per minute, ${m.longPauses} pauses longer than 1.5 seconds.`,
        schema: AiSpeaking,
        maxTokens: 3000,
        effort: 'low',
      })
      const r2 = (b: number) => Math.max(0, Math.min(9, Math.round(b * 2) / 2))
      const out = { ...fb, fluency_band: r2(fb.fluency_band), lexical_band: r2(fb.lexical_band), grammar_band: r2(fb.grammar_band), unofficial: true }
      db().run('UPDATE speaking_sessions SET ai_feedback = ? WHERE id = ?', JSON.stringify(out), s.id)
      return view(db().one<SessionRow>('SELECT * FROM speaking_sessions WHERE id = ?', s.id)!)
    } catch (e) {
      refund(user.id, 'writingFeedbackPerDay')
      throw e
    }
  })

  app.get('/history', async (req) => {
    const user = requireUser(req)
    return db().all<SessionRow>('SELECT * FROM speaking_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', user.id).map(view)
  })

  app.get('/:id', async (req) => {
    const user = requireUser(req)
    const s = db().one<SessionRow>('SELECT * FROM speaking_sessions WHERE id = ? AND user_id = ?', (req.params as { id: string }).id, user.id)
    if (!s) throw notFound('Recording not found.')
    return view(s)
  })
}
