/**
 * Seeds learning content (lessons, exercises, vocabulary, placement test, IELTS sets, writing tasks,
 * speaking prompts and mock tests). This is product content, not user data.
 *
 *   npm run db:seed            # insert missing content only (safe to re-run, keeps admin edits)
 *   npm run db:seed -- --update  # overwrite seeded items with the versions in this repository
 */
import { eq, sql } from 'drizzle-orm';
import { listeningContentSchema, readingContentSchema } from '@fluentpath/shared';
import { db, pool, schema } from '../db';
import { runMigrations } from '../db/migrate';
import { advancedLessons, generalLessons } from './content/grammar-advanced';
import { beginnerLessons } from './content/grammar-beginner';
import { intermediateLessons } from './content/grammar-intermediate';
import { listeningSets } from './content/ielts-listening';
import { readingSets } from './content/ielts-reading';
import { writingTasks } from './content/ielts-writing';
import { placementQuestions } from './content/placement';
import { mockTests, speakingPrompts } from './content/speaking';
import { VOCAB_CATEGORIES, vocabulary } from './content/vocabulary';

const UPDATE = process.argv.includes('--update');

const GRAMMAR_CATEGORIES: Record<string, string> = {
  foundations: 'Foundations',
  tenses: 'Tenses',
  'nouns-and-determiners': 'Nouns and articles',
  prepositions: 'Prepositions',
  'sentence-grammar': 'Sentence grammar',
  'adjectives-adverbs': 'Adjectives and adverbs',
  clauses: 'Clauses and conditionals',
  verbs: 'Verb forms',
  'writing-mechanics': 'Punctuation and cohesion',
  accuracy: 'Accuracy',
  'advanced-structures': 'Advanced structures',
  'everyday-english': 'Everyday English',
};

export function wordAudioUrl(word: string) {
  return `/media/words/${word.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp3`;
}

export async function seed(log = console.log) {
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);

  // Categories
  let order = 0;
  for (const c of VOCAB_CATEGORIES) {
    await db
      .insert(schema.categories)
      .values({ kind: 'vocabulary', slug: c.slug, name: c.name, description: c.description, sortOrder: order++ })
      .onConflictDoNothing();
  }
  order = 0;
  for (const [slug, name] of Object.entries(GRAMMAR_CATEGORIES)) {
    await db.insert(schema.categories).values({ kind: 'grammar', slug, name, sortOrder: order++ }).onConflictDoNothing();
  }

  // Lessons + exercises
  const allLessons = [...beginnerLessons, ...intermediateLessons, ...advancedLessons, ...generalLessons];
  for (const [i, l] of allLessons.entries()) {
    const values = {
      slug: l.slug,
      title: l.title,
      track: l.track,
      pathLevel: l.pathLevel,
      cefrLevel: l.cefrLevel,
      categorySlug: l.category,
      summary: l.summary,
      body: l.body,
      examples: l.examples,
      sortOrder: i,
      status: 'published' as const,
    };
    const [existing] = await db.select({ id: schema.lessons.id }).from(schema.lessons).where(eq(schema.lessons.slug, l.slug));
    let lessonId = existing?.id;
    if (!existing) {
      [{ id: lessonId }] = await db.insert(schema.lessons).values(values).returning({ id: schema.lessons.id });
      bump('lessons');
    } else if (UPDATE) {
      await db.update(schema.lessons).set({ ...values, updatedAt: new Date() }).where(eq(schema.lessons.id, existing.id));
      await db.delete(schema.exercises).where(eq(schema.exercises.lessonId, existing.id));
      bump('lessons updated');
    } else continue;
    await db.insert(schema.exercises).values(
      l.exercises.map((e, j) => ({
        lessonId: lessonId!,
        purpose: 'lesson',
        type: e.type,
        cefrLevel: l.cefrLevel,
        prompt: e.prompt,
        options: e.options ?? [],
        answers: e.answers,
        explanation: e.explanation,
        sortOrder: j,
      })),
    );
    counts.exercises = (counts.exercises ?? 0) + l.exercises.length;
  }

  // Placement questions (replace the whole set when updating)
  const [{ n: placementCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.exercises).where(eq(schema.exercises.purpose, 'placement'));
  if (placementCount === 0 || UPDATE) {
    if (UPDATE) await db.delete(schema.exercises).where(eq(schema.exercises.purpose, 'placement'));
    await db.insert(schema.exercises).values(
      placementQuestions.map((q, i) => ({
        purpose: 'placement',
        type: 'mcq',
        skill: q.skill,
        cefrLevel: q.level,
        prompt: q.prompt,
        passage: q.passage ?? null,
        options: q.options,
        answers: [q.answer],
        explanation: q.explanation,
        sortOrder: i,
      })),
    );
    counts.placement = placementQuestions.length;
  }

  // Vocabulary
  for (const w of vocabulary) {
    const values = {
      word: w.word,
      partOfSpeech: w.pos,
      phonetic: w.phonetic ?? null,
      definition: w.definition,
      example: w.example,
      synonyms: w.synonyms ?? [],
      antonyms: w.antonyms ?? [],
      cefrLevel: w.level,
      categorySlug: w.category,
      audioUrl: wordAudioUrl(w.word),
      status: 'published' as const,
    };
    const [existing] = await db
      .select({ id: schema.words.id })
      .from(schema.words)
      .where(sql`lower(${schema.words.word}) = ${w.word.toLowerCase()} and ${schema.words.partOfSpeech} = ${w.pos}`);
    if (!existing) {
      await db.insert(schema.words).values(values);
      bump('words');
    } else if (UPDATE) {
      await db.update(schema.words).set(values).where(eq(schema.words.id, existing.id));
    }
  }

  // IELTS reading
  for (const s of readingSets) {
    const content = readingContentSchema.parse(s.content);
    const questionCount = content.groups.reduce((a, g) => a + g.questions.length, 0);
    await upsertSet({
      slug: s.slug,
      module: 'reading',
      variant: s.variant,
      title: s.title,
      description: s.description,
      difficulty: s.difficulty,
      timeLimitSec: s.timeLimitSec,
      content,
      questionCount,
      isPremium: s.isPremium ?? false,
      mockOnly: s.mockOnly ?? false,
      status: 'published',
    });
  }

  // IELTS listening (same for Academic and General Training)
  for (const s of listeningSets) {
    const content = listeningContentSchema.parse({
      sections: s.sections.map((sec) => ({
        id: sec.id,
        title: sec.title,
        context: sec.context,
        transcript: sec.transcript,
        audioUrl: `/media/listening/${s.slug}-${sec.id}.mp3`,
      })),
      groups: s.groups,
    });
    const questionCount = content.groups.reduce((a, g) => a + g.questions.length, 0);
    await upsertSet({
      slug: s.slug,
      module: 'listening',
      variant: 'both',
      title: s.title,
      description: s.description,
      difficulty: s.difficulty,
      timeLimitSec: s.timeLimitSec,
      content,
      questionCount,
      isPremium: s.isPremium ?? false,
      mockOnly: s.mockOnly ?? false,
      status: 'published',
    });
  }

  async function upsertSet(values: typeof schema.ieltsSets.$inferInsert) {
    const [existing] = await db.select({ id: schema.ieltsSets.id }).from(schema.ieltsSets).where(eq(schema.ieltsSets.slug, values.slug));
    if (!existing) {
      await db.insert(schema.ieltsSets).values(values);
      bump(`ielts ${values.module}`);
    } else if (UPDATE) {
      await db.update(schema.ieltsSets).set({ ...values, updatedAt: new Date() }).where(eq(schema.ieltsSets.id, existing.id));
    }
  }

  // Writing tasks
  for (const t of writingTasks) {
    const values = {
      slug: t.slug,
      variant: t.variant,
      taskNumber: t.taskNumber,
      taskType: t.taskType,
      title: t.title,
      prompt: t.prompt,
      instructions: t.instructions,
      visual: t.visual ?? null,
      minWords: t.taskNumber === 1 ? 150 : 250,
      timeMinutes: t.taskNumber === 1 ? 20 : 40,
      modelOutline: t.modelOutline,
      isPremium: t.isPremium ?? false,
      mockOnly: t.mockOnly ?? false,
      status: 'published' as const,
    };
    const [existing] = await db.select({ id: schema.writingTasks.id }).from(schema.writingTasks).where(eq(schema.writingTasks.slug, t.slug));
    if (!existing) {
      await db.insert(schema.writingTasks).values(values);
      bump('writing tasks');
    } else if (UPDATE) await db.update(schema.writingTasks).set({ ...values, updatedAt: new Date() }).where(eq(schema.writingTasks.id, existing.id));
  }

  // Speaking prompts
  for (const p of speakingPrompts) {
    const values = { slug: p.slug, part: p.part, topic: p.topic, questions: p.questions, cueCard: p.cueCard ?? null, prepSeconds: p.prepSeconds, speakSeconds: p.speakSeconds, status: 'published' as const };
    const [existing] = await db.select({ id: schema.speakingPrompts.id }).from(schema.speakingPrompts).where(eq(schema.speakingPrompts.slug, p.slug));
    if (!existing) {
      await db.insert(schema.speakingPrompts).values(values);
      bump('speaking prompts');
    } else if (UPDATE) await db.update(schema.speakingPrompts).set(values).where(eq(schema.speakingPrompts.id, existing.id));
  }

  // Mock tests
  for (const m of mockTests) {
    const values = { slug: m.slug, variant: m.variant, title: m.title, description: m.description, sections: m.sections, isPremium: m.isPremium ?? false, status: 'published' as const };
    const [existing] = await db.select({ id: schema.mockTests.id }).from(schema.mockTests).where(eq(schema.mockTests.slug, m.slug));
    if (!existing) {
      await db.insert(schema.mockTests).values(values);
      bump('mock tests');
    } else if (UPDATE) await db.update(schema.mockTests).set(values).where(eq(schema.mockTests.id, existing.id));
  }

  log(`Seed complete${UPDATE ? ' (update mode)' : ''}:`, Object.keys(counts).length ? counts : 'nothing new to add');
  return counts;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => seed())
    .then(() => pool.end())
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
