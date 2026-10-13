import { DEFAULT_PLAN_LIMITS } from '../services/entitlements';
import { pool, q, tx } from './pool';
import { migrate } from './migrate';
import { VOCABULARY } from '../../content/vocabulary';
import { GRAMMAR } from '../../content/grammar';
import { ASSESSMENT_ITEMS } from '../../content/assessment';
import { READING_SETS } from '../../content/ieltsReading';
import { LISTENING_SETS } from '../../content/ieltsListening';
import { MOCK_TESTS, SPEAKING_PROMPTS, WRITING_PROMPTS } from '../../content/ieltsWritingSpeaking';

function countQuestions(content: any): number {
  return content.groups.reduce((n: number, g: any) => n + g.questions.length, 0);
}

/** Idempotent: safe to run on every deploy. Admin edits to plan limits are preserved. */
export async function seed(log = true) {
  await migrate(false);
  await tx(async (c) => {
    for (const id of ['free', 'premium'] as const) {
      await c.query(
        `INSERT INTO plans (id, name, limits, price_display) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [id, id === 'free' ? 'Free' : 'Premium', DEFAULT_PLAN_LIMITS[id], id === 'free' ? '£0' : 'Configure in billing provider'],
      );
    }
    for (const [word, ipa, pos, cefr, tags, meaning, examples, synonyms, antonyms, note] of VOCABULARY) {
      await c.query(
        `INSERT INTO vocabulary (word, ipa, part_of_speech, cefr, tags, meaning, examples, synonyms, antonyms, usage_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (lower(word), part_of_speech) DO UPDATE SET ipa=EXCLUDED.ipa, cefr=EXCLUDED.cefr, tags=EXCLUDED.tags,
           meaning=EXCLUDED.meaning, examples=EXCLUDED.examples, synonyms=EXCLUDED.synonyms, antonyms=EXCLUDED.antonyms, usage_note=EXCLUDED.usage_note`,
        [word, ipa, pos, cefr, tags, meaning, examples, synonyms, antonyms, note ?? null],
      );
    }
    let order = 0;
    for (const l of GRAMMAR) {
      const r = await c.query(
        `INSERT INTO grammar_lessons (slug, title, cefr, topic, summary, body, examples, order_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, cefr=EXCLUDED.cefr, topic=EXCLUDED.topic, summary=EXCLUDED.summary,
           body=EXCLUDED.body, examples=EXCLUDED.examples, order_index=EXCLUDED.order_index RETURNING id`,
        [l.slug, l.title, l.cefr, l.topic, l.summary, l.body, JSON.stringify(l.examples), order++],
      );
      const lessonId = r.rows[0].id;
      await c.query('DELETE FROM grammar_exercises WHERE lesson_id=$1', [lessonId]);
      let i = 0;
      for (const e of l.exercises) {
        await c.query(
          `INSERT INTO grammar_exercises (lesson_id, kind, prompt, options, answers, explanation, order_index) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [lessonId, e.kind, e.prompt, e.options ? JSON.stringify(e.options) : null, e.answers, e.explanation, i++],
        );
      }
    }
    for (const it of ASSESSMENT_ITEMS) {
      await c.query(
        `INSERT INTO assessment_items (external_key, skill, cefr, difficulty, prompt, passage, audio_url, options, answer, explanation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (external_key) DO UPDATE SET skill=EXCLUDED.skill, cefr=EXCLUDED.cefr, difficulty=EXCLUDED.difficulty,
           prompt=EXCLUDED.prompt, passage=EXCLUDED.passage, audio_url=EXCLUDED.audio_url, options=EXCLUDED.options,
           answer=EXCLUDED.answer, explanation=EXCLUDED.explanation`,
        [it.key, it.skill, it.cefr, it.difficulty, it.prompt, it.passage ?? null, it.script ? `/media/assessment/${it.key}.mp3` : null,
          JSON.stringify(it.options), it.answer, it.explanation ?? null],
      );
    }
    for (const s of [...READING_SETS, ...LISTENING_SETS]) {
      const content = { ...s.content };
      if ('script' in s) content.transcript = (s as any).script.map((l: [string, string]) => l[1]);
      await c.query(
        `INSERT INTO ielts_sets (slug, skill, test_type, title, description, difficulty, time_limit_sec, content, answer_key, question_count, is_premium)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (slug) DO UPDATE SET skill=EXCLUDED.skill, test_type=EXCLUDED.test_type, title=EXCLUDED.title,
           description=EXCLUDED.description, difficulty=EXCLUDED.difficulty, time_limit_sec=EXCLUDED.time_limit_sec,
           content=EXCLUDED.content, answer_key=EXCLUDED.answer_key, question_count=EXCLUDED.question_count, is_premium=EXCLUDED.is_premium`,
        [s.slug, s.skill, s.testType, s.title, s.description, s.difficulty, s.timeLimitSec, content, s.answers, countQuestions(s.content), !!s.isPremium],
      );
    }
    for (const w of WRITING_PROMPTS) {
      await c.query(
        `INSERT INTO writing_prompts (slug, test_type, task, kind, title, prompt, instructions, visual, min_words, time_limit_sec, is_premium)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (slug) DO UPDATE SET test_type=EXCLUDED.test_type, task=EXCLUDED.task, kind=EXCLUDED.kind, title=EXCLUDED.title,
           prompt=EXCLUDED.prompt, instructions=EXCLUDED.instructions, visual=EXCLUDED.visual, min_words=EXCLUDED.min_words,
           time_limit_sec=EXCLUDED.time_limit_sec, is_premium=EXCLUDED.is_premium`,
        [w.slug, w.testType, w.task, w.kind, w.title, w.prompt, w.instructions, w.visual ?? null, w.minWords, w.timeLimitSec, !!w.isPremium],
      );
    }
    for (const sp of SPEAKING_PROMPTS) {
      await c.query(
        `INSERT INTO speaking_prompts (slug, part, topic, text, bullets, questions, group_key) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (slug) DO UPDATE SET part=EXCLUDED.part, topic=EXCLUDED.topic, text=EXCLUDED.text, bullets=EXCLUDED.bullets,
           questions=EXCLUDED.questions, group_key=EXCLUDED.group_key`,
        [sp.slug, sp.part, sp.topic, sp.text, sp.bullets ?? [], sp.questions ?? [], sp.groupKey ?? null],
      );
    }
    for (const m of MOCK_TESTS) {
      await c.query(
        `INSERT INTO mock_tests (slug, title, test_type, description, sections, is_premium) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, test_type=EXCLUDED.test_type, description=EXCLUDED.description,
           sections=EXCLUDED.sections, is_premium=EXCLUDED.is_premium`,
        [m.slug, m.title, m.testType, m.description, JSON.stringify(m.sections), !!m.isPremium],
      );
    }
  });
  if (log) {
    const counts = await q(`SELECT
      (SELECT count(*) FROM vocabulary)::int AS vocabulary, (SELECT count(*) FROM grammar_lessons)::int AS grammar,
      (SELECT count(*) FROM grammar_exercises)::int AS grammar_exercises, (SELECT count(*) FROM assessment_items)::int AS assessment_items,
      (SELECT count(*) FROM ielts_sets)::int AS ielts_sets, (SELECT count(*) FROM writing_prompts)::int AS writing_prompts,
      (SELECT count(*) FROM speaking_prompts)::int AS speaking_prompts, (SELECT count(*) FROM mock_tests)::int AS mock_tests`);
    console.log('seeded', counts[0]);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const adminIdx = process.argv.indexOf('--admin');
  seed()
    .then(async () => {
      if (adminIdx > 0) {
        const email = process.argv[adminIdx + 1];
        const r = await q(`UPDATE users SET role='admin' WHERE lower(email)=lower($1) RETURNING id`, [email]);
        console.log(r.length ? `promoted ${email} to admin` : `no user ${email}`);
      }
      await pool.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
