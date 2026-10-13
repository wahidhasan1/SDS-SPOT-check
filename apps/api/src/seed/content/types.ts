export interface SeedExercise {
  type: 'mcq' | 'fill';
  prompt: string;
  options?: string[];
  answers: string[];
  explanation: string;
}

export interface SeedLesson {
  slug: string;
  title: string;
  track: 'grammar' | 'general';
  pathLevel: 'beginner' | 'intermediate' | 'advanced';
  cefrLevel: string;
  category: string;
  summary: string;
  body: string;
  examples: { text: string; note?: string; correct?: boolean }[];
  exercises: SeedExercise[];
}

export interface SeedWord {
  word: string;
  pos: string;
  phonetic?: string;
  definition: string;
  example: string;
  synonyms?: string[];
  antonyms?: string[];
  level: string;
  category: string;
}

export interface SeedPlacement {
  skill: 'grammar' | 'vocabulary' | 'reading';
  level: string;
  prompt: string;
  passage?: string;
  options: string[];
  answer: string;
  explanation: string;
}
