import type { FastifyInstance } from 'fastify';
import { CEFR_LEVELS, NOTICE_UNOFFICIAL, overallBand, roundToHalf } from '@app/shared';
import { one, q } from '../db/pool';
import { requireAuth } from '../lib/auth';
import { getEntitlements } from '../services/entitlements';
import { loadProfile } from '../services/users';

interface Recommendation {
  id: string;
  title: string;
  reason: string;
  href: string;
  icon: string;
}

/** Aggregates real learning data; skills without evidence are reported as null, never invented. */
async function skillSnapshot(userId: string) {
  const reading = await one<any>(
    `SELECT avg(band)::float AS band, count(*)::int AS n FROM (SELECT band FROM practice_attempts a JOIN ielts_sets s ON s.id=a.set_id
       WHERE a.user_id=$1 AND s.skill='reading' AND a.status='submitted' AND a.band IS NOT NULL ORDER BY a.submitted_at DESC LIMIT 5) x`,
    [userId],
  );
  const listening = await one<any>(
    `SELECT avg(band)::float AS band, count(*)::int AS n FROM (SELECT band FROM practice_attempts a JOIN ielts_sets s ON s.id=a.set_id
       WHERE a.user_id=$1 AND s.skill='listening' AND a.status='submitted' AND a.band IS NOT NULL ORDER BY a.submitted_at DESC LIMIT 5) x`,
    [userId],
  );
  const writing = await one<any>(
    `SELECT avg(band_estimate)::float AS band, count(*)::int AS n FROM (SELECT band_estimate FROM writing_submissions
       WHERE user_id=$1 AND band_estimate IS NOT NULL ORDER BY submitted_at DESC LIMIT 3) x`,
    [userId],
  );
  const writingCount = await one<any>(`SELECT count(*)::int AS n FROM writing_submissions WHERE user_id=$1 AND status='evaluated'`, [userId]);
  const speaking = await one<any>(
    `SELECT avg(band_estimate)::float AS band, count(*)::int AS n FROM (SELECT band_estimate FROM speaking_sessions
       WHERE user_id=$1 AND band_estimate IS NOT NULL ORDER BY created_at DESC LIMIT 5) x`,
    [userId],
  );
  const speakingCount = await one<any>(`SELECT count(*)::int AS n FROM speaking_sessions WHERE user_id=$1`, [userId]);
  const fmt = (r: any, count?: number) => ({ band: r?.band != null ? roundToHalf(r.band) : null, scoredSamples: r?.n ?? 0, practiceCount: count ?? r?.n ?? 0 });
  const skills = {
    reading: fmt(reading),
    listening: fmt(listening),
    writing: fmt(writing, writingCount?.n),
    speaking: fmt(speaking, speakingCount?.n),
  };
  const bands = Object.values(skills).map((s) => s.band);
  const estimate = bands.every((b) => b != null) ? overallBand(bands as number[]) : null;
  return { skills, estimatedOverall: estimate };
}

export async function progressRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/me/dashboard', async (req) => {
    const uid = req.userId;
    const [profile, ent, ielts, vocab, grammar, calls, battles, recent, mocks, assessments] = await Promise.all([
      loadProfile(uid),
      getEntitlements(uid),
      skillSnapshot(uid),
      one<any>(
        `SELECT count(*)::int AS saved, count(*) FILTER (WHERE interval_days >= 21)::int AS mastered, count(*) FILTER (WHERE due_at <= now())::int AS due
         FROM saved_words WHERE user_id=$1`,
        [uid],
      ),
      one<any>(
        `SELECT count(DISTINCT lesson_id)::int AS attempted,
                count(DISTINCT lesson_id) FILTER (WHERE score::float / NULLIF(total,0) >= 0.8)::int AS mastered,
                (SELECT count(*)::int FROM grammar_lessons WHERE status='published') AS total,
                avg(score::float / NULLIF(total,0)) AS avg_score
         FROM grammar_attempts WHERE user_id=$1`,
        [uid],
      ),
      one<any>(
        `SELECT count(*) FILTER (WHERE s.connected_at IS NOT NULL)::int AS completed, COALESCE(sum(s.duration_sec),0)::int AS seconds
         FROM call_participants p JOIN call_sessions s ON s.id=p.call_id WHERE p.user_id=$1`,
        [uid],
      ),
      one<any>(`SELECT count(*)::int AS played, count(*) FILTER (WHERE result='win')::int AS wins FROM battle_participants WHERE user_id=$1`, [uid]),
      q(`SELECT kind, meta, created_at FROM activity_log WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10`, [uid]),
      q(
        `SELECT a.id, a.status, a.overall_band, a.results, a.completed_at, t.title FROM mock_attempts a JOIN mock_tests t ON t.id=a.mock_test_id
         WHERE a.user_id=$1 ORDER BY a.started_at DESC LIMIT 5`,
        [uid],
      ),
      q(`SELECT level, created_at FROM proficiency_history WHERE user_id=$1 ORDER BY created_at`, [uid]),
    ]);
    const weekly = await q<any>(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day, (SELECT count(*)::int FROM activity_log a WHERE a.user_id=$1 AND a.created_at::date = d) AS activities
       FROM generate_series(current_date - 6, current_date, interval '1 day') d`,
      [uid],
    );
    const recommendations = buildRecommendations(profile, ielts.skills, vocab, grammar, calls);
    return {
      profile,
      entitlements: ent,
      ielts: { ...ielts, targetBand: profile.targetBand, notice: NOTICE_UNOFFICIAL },
      vocabulary: vocab,
      grammar: { ...grammar, avgScore: grammar?.avg_score != null ? Math.round(grammar.avg_score * 100) : null },
      calls,
      battles: { ...battles, rating: profile.battleRating },
      recentActivity: recent,
      mockTests: mocks,
      levelHistory: assessments,
      weeklyActivity: weekly,
      recommendations,
    };
  });

  app.get('/me/study-plan', async (req) => {
    const uid = req.userId;
    const profile = await loadProfile(uid);
    const { skills } = await skillSnapshot(uid);
    const vocab = await one<any>(`SELECT count(*) FILTER (WHERE due_at <= now())::int AS due FROM saved_words WHERE user_id=$1`, [uid]);
    const grammar = await one<any>(`SELECT count(*)::int AS attempted FROM grammar_attempts WHERE user_id=$1`, [uid]);
    const calls = await one<any>(`SELECT count(*)::int AS completed FROM call_participants p JOIN call_sessions s ON s.id=p.call_id WHERE p.user_id=$1 AND s.connected_at IS NOT NULL`, [uid]);
    const recs = buildRecommendations(profile, skills, vocab, grammar, calls);
    const target = profile.targetBand;
    const focus = (Object.entries(skills) as [string, { band: number | null; practiceCount: number }][])
      .map(([k, v]) => ({ skill: k, band: v.band, gap: target && v.band != null ? Math.max(0, target - v.band) : null, practiceCount: v.practiceCount }))
      .sort((a, b) => (b.gap ?? (b.practiceCount === 0 ? 9 : 0)) - (a.gap ?? (a.practiceCount === 0 ? 9 : 0)));
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const rotation = [...focus.map((f) => f.skill), 'vocabulary', 'speaking_partner', 'grammar'];
    const week = days.map((d, i) => {
      const area = rotation[i % rotation.length];
      return { day: d, focus: area, minutes: 25 };
    });
    return { generatedAt: new Date().toISOString(), level: profile.cefrLevel, targetBand: target, focus, week, recommendations: recs, note: 'Plan adapts automatically as you complete practice.' };
  });
}

function buildRecommendations(profile: any, skills: any, vocab: any, grammar: any, calls: any): Recommendation[] {
  const recs: Recommendation[] = [];
  if (!profile.cefrLevel) recs.push({ id: 'assess', icon: '🧭', title: 'Take the placement test', reason: 'We need your level to personalise practice and match speaking partners fairly.', href: '/assessment' });
  if ((vocab?.due ?? 0) > 0) recs.push({ id: 'review', icon: '🔁', title: `Review ${vocab.due} saved word${vocab.due === 1 ? '' : 's'}`, reason: 'These words are due for spaced repetition today.', href: '/vocabulary/review' });
  const isIelts = profile.testType !== 'none';
  if (isIelts) {
    const order = Object.entries(skills as Record<string, any>).sort((a, b) => {
      const av = a[1].band ?? (a[1].practiceCount === 0 ? -1 : 10);
      const bv = b[1].band ?? (b[1].practiceCount === 0 ? -1 : 10);
      return av - bv;
    });
    const [weakest, info] = order[0];
    const href = weakest === 'writing' ? '/ielts/writing' : weakest === 'speaking' ? '/ielts/speaking' : `/ielts/${weakest}`;
    recs.push({
      id: 'weak-skill',
      icon: '🎯',
      title: `Practise IELTS ${weakest[0].toUpperCase() + weakest.slice(1)}`,
      reason: info.practiceCount === 0 ? 'You have not practised this skill yet.' : `This is currently your lowest estimated skill (${info.band ?? 'not scored'}).`,
      href,
    });
  }
  if ((grammar?.attempted ?? 0) < 3) recs.push({ id: 'grammar', icon: '✍️', title: 'Complete a grammar lesson', reason: 'Accurate grammar supports every IELTS skill.', href: '/grammar' });
  if ((calls?.completed ?? 0) < 3) recs.push({ id: 'call', icon: '🎙️', title: 'Have a speaking call', reason: 'Real conversation builds fluency and confidence.', href: '/speaking' });
  const levelIdx = profile.cefrLevel ? CEFR_LEVELS.indexOf(profile.cefrLevel) : 2;
  if (levelIdx >= 3) recs.push({ id: 'mock', icon: '📝', title: 'Try a full mock test', reason: 'See how your skills combine under timed conditions.', href: '/ielts/mock' });
  recs.push({ id: 'battle', icon: '⚔️', title: 'Play a vocabulary battle', reason: 'A quick, fun way to recall words under time pressure.', href: '/battles' });
  return recs.slice(0, 5);
}
