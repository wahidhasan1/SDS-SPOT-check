import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { CALL_TOPICS, TARGET_BANDS } from '../../shared/config.ts'
import { db, json } from '../db/index.ts'
import { SESSION_COOKIE, requireUser, verifyPassword } from '../lib/auth.ts'
import { newAnonIdentity } from '../lib/identity.ts'
import { entitlements } from '../lib/plans.ts'
import { audit, streak } from '../lib/events.ts'
import { HttpError, now } from '../lib/util.ts'

type ProfileRow = {
  display_name: string
  anon_name: string
  avatar_color: string
  avatar_icon: string
  birth_year: number | null
  gender: string | null
  native_language: string | null
  goal: string | null
  test_type: string | null
  target_band: number | null
  daily_minutes: number | null
  interests: string
  cefr_level: string | null
  cefr_score: number | null
  onboarding_step: string
  show_level_to_partners: number
  show_on_leaderboard: number
  reminder_hour: number | null
  reminders_enabled: number
  timezone_offset: number
  ai_consent: number
  voice_consent: number
  speech_consent: number
  push_enabled: number
}

export const isAdult = (birthYear: number | null) => !!birthYear && new Date().getFullYear() - birthYear >= 18

export function meView(userId: string) {
  const u = db().one<{ id: string; email: string; role: string; status: string; created_at: number }>('SELECT id, email, role, status, created_at FROM users WHERE id = ?', userId)!
  const p = db().one<ProfileRow>('SELECT * FROM profiles WHERE user_id = ?', userId)!
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
    profile: {
      displayName: p.display_name,
      anonName: p.anon_name,
      avatarColor: p.avatar_color,
      avatarIcon: p.avatar_icon,
      birthYear: p.birth_year,
      gender: p.gender,
      nativeLanguage: p.native_language,
      goal: p.goal,
      testType: p.test_type,
      targetBand: p.target_band,
      dailyMinutes: p.daily_minutes,
      interests: json<string[]>(p.interests, []),
      cefrLevel: p.cefr_level,
      cefrScore: p.cefr_score,
      onboardingStep: p.onboarding_step,
      showLevelToPartners: !!p.show_level_to_partners,
      showOnLeaderboard: !!p.show_on_leaderboard,
      remindersEnabled: !!p.reminders_enabled,
      reminderHour: p.reminder_hour,
      aiConsent: !!p.ai_consent,
      voiceConsent: !!p.voice_consent,
      speechConsent: !!p.speech_consent,
      pushEnabled: !!p.push_enabled,
    },
    adult: isAdult(p.birth_year),
    plan: entitlements(userId),
    streak: streak(userId),
    rating: db().one<{ rating: number; games: number; wins: number }>('SELECT rating, games, wins FROM ratings WHERE user_id = ?', userId) ?? { rating: 1000, games: 0, wins: 0 },
  }
}

const ONBOARDING_STEPS = ['goals', 'assessment', 'interests', 'done'] as const

const profilePatch = z
  .object({
    displayName: z.string().trim().min(2).max(40),
    goal: z.enum(['ielts', 'general', 'work']),
    testType: z.enum(['academic', 'general_training']).nullable(),
    targetBand: z.number().refine((b) => (TARGET_BANDS as readonly number[]).includes(b), 'Choose a band from the list').nullable(),
    dailyMinutes: z.number().int().min(5).max(240),
    interests: z.array(z.enum(CALL_TOPICS.map((t) => t.id) as [string, ...string[]])).max(12),
    nativeLanguage: z.string().trim().max(40).nullable(),
    gender: z.enum(['female', 'male', 'other']).nullable(),
    showLevelToPartners: z.boolean(),
    showOnLeaderboard: z.boolean(),
    remindersEnabled: z.boolean(),
    reminderHour: z.number().int().min(0).max(23).nullable(),
    timezoneOffset: z.number().int().min(-840).max(840),
    aiConsent: z.boolean(),
    voiceConsent: z.boolean(),
    speechConsent: z.boolean(),
    pushEnabled: z.boolean(),
    onboardingStep: z.enum(ONBOARDING_STEPS),
  })
  .partial()
  .strict() // unknown fields (e.g. "role", "plan", "cefrLevel") are rejected, not silently applied

const COLUMN: Record<string, string> = {
  displayName: 'display_name',
  goal: 'goal',
  testType: 'test_type',
  targetBand: 'target_band',
  dailyMinutes: 'daily_minutes',
  interests: 'interests',
  nativeLanguage: 'native_language',
  gender: 'gender',
  showLevelToPartners: 'show_level_to_partners',
  showOnLeaderboard: 'show_on_leaderboard',
  remindersEnabled: 'reminders_enabled',
  reminderHour: 'reminder_hour',
  timezoneOffset: 'timezone_offset',
  aiConsent: 'ai_consent',
  voiceConsent: 'voice_consent',
  speechConsent: 'speech_consent',
  pushEnabled: 'push_enabled',
  onboardingStep: 'onboarding_step',
}

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => meView(requireUser(req).id))

  app.patch('/profile', async (req) => {
    const user = requireUser(req)
    const body = profilePatch.parse(req.body)
    if (body.onboardingStep === 'done') {
      const p = db().one<{ cefr_level: string | null }>('SELECT cefr_level FROM profiles WHERE user_id = ?', user.id)
      if (!p?.cefr_level) throw new HttpError(400, 'assessment_required', 'Please finish the level check first.')
    }
    const sets: string[] = []
    const vals: (string | number | null)[] = []
    for (const [k, v] of Object.entries(body)) {
      sets.push(`${COLUMN[k]} = ?`)
      vals.push(Array.isArray(v) ? JSON.stringify(v) : typeof v === 'boolean' ? Number(v) : (v as string | number | null))
    }
    if (sets.length) db().run(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = ?`, ...vals, user.id)
    return meView(user.id)
  })

  app.post('/anon-identity', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req)
    const a = newAnonIdentity()
    db().run('UPDATE profiles SET anon_name = ?, avatar_icon = ?, avatar_color = ? WHERE user_id = ?', a.anonName, a.avatarIcon, a.avatarColor, user.id)
    return meView(user.id)
  })

  app.get('/proficiency-history', async (req) => {
    const user = requireUser(req)
    return db().all('SELECT level, score, source, created_at AS createdAt FROM proficiency_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', user.id)
  })

  /** Everything we store about the user, for transparency (GDPR-style export). */
  app.get('/export', async (req, reply) => {
    const user = requireUser(req)
    const q = (sql: string) => db().all(sql, user.id)
    reply.header('Content-Disposition', 'attachment; filename="my-data.json"')
    return {
      account: meView(user.id),
      proficiency: q('SELECT * FROM proficiency_history WHERE user_id = ?'),
      attempts: q('SELECT id, content_id, kind, mode, status, score, max_score, band, started_at, submitted_at FROM attempts WHERE user_id = ?'),
      writing: q('SELECT id, prompt_id, text, word_count, status, created_at, submitted_at FROM writing_submissions WHERE user_id = ?'),
      speaking: q('SELECT id, question, transcript, duration_s, created_at FROM speaking_sessions WHERE user_id = ?'),
      savedWords: q('SELECT word, meaning, context, created_at FROM saved_words WHERE user_id = ?'),
      calls: q("SELECT id, mode, topic, status, created_at, duration_s, end_reason FROM call_sessions WHERE user_a = ?1 OR user_b = ?1"),
      reportsMade: q('SELECT reason, details, status, created_at FROM reports WHERE reporter_id = ?'),
      blocks: q('SELECT created_at FROM blocks WHERE blocker_id = ?'),
    }
  })

  app.delete('/', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req, reply) => {
    const user = requireUser(req)
    const body = z.object({ password: z.string().min(1) }).parse(req.body)
    const row = db().one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', user.id)!
    if (!(await verifyPassword(body.password, row.password_hash))) throw new HttpError(401, 'bad_credentials', 'Password is incorrect.')
    // Leave any live call or battle first so partners are told and microphones are released.
    const [{ endCallForUser }, { leaveBattle }] = await Promise.all([import('../realtime/calls.ts'), import('../realtime/battles.ts')])
    endCallForUser(user.id, 'partner_left')
    leaveBattle(user.id)
    db().tx(() => {
      // Cascades remove the profile, sessions, practice data, saved words, ratings and subscriptions.
      // Calls and reports keep a row with the user reference set to NULL so partners' history stays intact.
      db().run("UPDATE call_sessions SET status = 'ended', ended_at = COALESCE(ended_at, ?), end_reason = COALESCE(end_reason, 'account_deleted') WHERE (user_a = ?2 OR user_b = ?2) AND status <> 'ended'", now(), user.id)
      db().run('DELETE FROM users WHERE id = ?', user.id)
    })
    audit(null, 'account.deleted', null, {})
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  })
}
