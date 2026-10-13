import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { updateProfileSchema } from '@app/shared';
import { q } from '../db/pool';
import { requireAuth } from '../lib/auth';
import { parse } from '../lib/validate';
import { safeTz } from '../services/activity';
import { getEntitlements } from '../services/entitlements';
import { loadProfile } from '../services/users';

export async function meRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/me', async (req) => loadProfile(req.userId));

  app.patch('/me', async (req) => {
    const input = parse(updateProfileSchema, req.body);
    if (input.displayName !== undefined) await q('UPDATE users SET display_name=$2 WHERE id=$1', [req.userId, input.displayName]);
    if (input.avatar !== undefined) await q('UPDATE users SET avatar=$2 WHERE id=$1', [req.userId, input.avatar]);
    const sets: string[] = [];
    const vals: unknown[] = [req.userId];
    const add = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col}=$${vals.length}`);
    };
    if (input.goals) add('goals', input.goals);
    if (input.testType) add('test_type', input.testType);
    if (input.targetBand !== undefined) add('target_band', input.targetBand);
    if (input.interests) add('interests', input.interests);
    if (input.nativeLanguage !== undefined) add('native_language', input.nativeLanguage);
    if (input.translationLanguage !== undefined) add('translation_language', input.translationLanguage);
    if (input.timezone) add('timezone', safeTz(input.timezone));
    if (input.onboardingCompleted !== undefined) add('onboarding_completed', input.onboardingCompleted);
    if (input.privacy?.showLevelToPartners !== undefined) add('show_level_to_partners', input.privacy.showLevelToPartners);
    if (input.privacy?.showOnLeaderboard !== undefined) add('show_on_leaderboard', input.privacy.showOnLeaderboard);
    const np = input.notificationPrefs ?? {};
    if (np.dailyReminder !== undefined) add('notif_daily_reminder', np.dailyReminder);
    if (np.reminderHour !== undefined) add('notif_reminder_hour', np.reminderHour);
    if (np.vocabReview !== undefined) add('notif_vocab_review', np.vocabReview);
    if (np.battleInvites !== undefined) add('notif_battle_invites', np.battleInvites);
    if (np.streaks !== undefined) add('notif_streaks', np.streaks);
    if (sets.length) await q(`UPDATE user_profiles SET ${sets.join(', ')}, updated_at=now() WHERE user_id=$1`, vals);
    return loadProfile(req.userId);
  });

  app.post('/me/birth-year', async (req) => {
    const { birthYear } = parse(z.object({ birthYear: z.number().int().min(1900).max(new Date().getUTCFullYear()) }), req.body);
    // Birth year can be set once (it gates age-restricted features); changes go through support.
    await q('UPDATE users SET birth_year=$2 WHERE id=$1 AND birth_year IS NULL', [req.userId, birthYear]);
    return loadProfile(req.userId);
  });

  app.post('/me/anon-identity', async (req) => {
    // Lets users rotate their anonymous calling identity.
    const { randomAnonName, randomAvatar } = await import('@app/shared');
    await q('UPDATE users SET anon_name=$2, avatar=$3 WHERE id=$1', [req.userId, randomAnonName(), randomAvatar()]);
    return loadProfile(req.userId);
  });

  app.get('/me/entitlements', async (req) => getEntitlements(req.userId));

  app.get('/me/notifications', async (req) => {
    const rows = await q(
      `SELECT id, kind, title, body, data, read_at, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId],
    );
    const unread = rows.filter((r: any) => !r.read_at).length;
    return { items: rows, unread };
  });

  app.post('/me/notifications/read', async (req) => {
    const { ids } = parse(z.object({ ids: z.array(z.string().uuid()).max(100).optional() }), req.body);
    if (ids?.length) await q('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND id = ANY($2) AND read_at IS NULL', [req.userId, ids]);
    else await q('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL', [req.userId]);
    return { ok: true };
  });

  app.post('/me/push-token', async (req) => {
    const { token, platform } = parse(
      z.object({ token: z.string().min(10).max(300), platform: z.enum(['android', 'ios', 'web']) }),
      req.body,
    );
    await q(
      `INSERT INTO push_tokens (token, user_id, platform) VALUES ($1,$2,$3)
       ON CONFLICT (token) DO UPDATE SET user_id=EXCLUDED.user_id, platform=EXCLUDED.platform, last_seen_at=now()`,
      [token, req.userId, platform],
    );
    return { ok: true };
  });

  app.delete('/me/push-token', async (req) => {
    const { token } = parse(z.object({ token: z.string().min(10).max(300) }), req.body);
    await q('DELETE FROM push_tokens WHERE token=$1 AND user_id=$2', [token, req.userId]);
    return { ok: true };
  });

  /** Data export (privacy): returns the user's own stored records. */
  app.get('/me/export', async (req) => {
    const uid = req.userId;
    const [profile, saved, writing, speaking, practice, calls, reading] = await Promise.all([
      loadProfile(uid),
      q('SELECT word, meaning, example, source, created_at FROM saved_words WHERE user_id=$1', [uid]),
      q('SELECT prompt_id, status, text, word_count, feedback, created_at FROM writing_submissions WHERE user_id=$1', [uid]),
      q('SELECT part, question, transcript, metrics, feedback, created_at FROM speaking_sessions WHERE user_id=$1', [uid]),
      q('SELECT set_id, mode, status, score, total, band, started_at, submitted_at FROM practice_attempts WHERE user_id=$1', [uid]),
      q(
        `SELECT s.mode, s.topic_id, s.created_at, s.duration_sec, s.end_reason FROM call_participants p JOIN call_sessions s ON s.id=p.call_id WHERE p.user_id=$1`,
        [uid],
      ),
      q('SELECT title, ocr_text, corrected_text, created_at FROM ai_reading_sessions WHERE user_id=$1', [uid]),
    ]);
    return { exportedAt: new Date().toISOString(), profile, savedWords: saved, writing, speaking, practice, calls, aiReading: reading };
  });
}
