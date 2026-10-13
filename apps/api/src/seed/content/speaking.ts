export interface SeedSpeakingPrompt {
  slug: string;
  part: 1 | 2 | 3;
  topic: string;
  questions: string[];
  cueCard?: string;
  prepSeconds: number;
  speakSeconds: number;
}

export const speakingPrompts: SeedSpeakingPrompt[] = [
  // Part 1 — 4–5 short questions, ~30 seconds each
  { slug: 'p1-home', part: 1, topic: 'Home and accommodation', prepSeconds: 0, speakSeconds: 45, questions: ['Do you live in a house or an apartment?', 'What is your favourite room in your home? Why?', 'Is there anything you would like to change about your home?', 'Would you like to live in a different area in the future?'] },
  { slug: 'p1-work-study', part: 1, topic: 'Work or studies', prepSeconds: 0, speakSeconds: 45, questions: ['Do you work or are you a student?', 'Why did you choose that job or subject?', 'What do you enjoy most about it?', 'What would you like to do in the future?'] },
  { slug: 'p1-free-time', part: 1, topic: 'Free time', prepSeconds: 0, speakSeconds: 45, questions: ['What do you usually do in your free time?', 'Do you prefer spending free time alone or with others?', 'Has the way you spend your free time changed since you were a child?', 'Is there a new hobby you would like to try?'] },
  { slug: 'p1-food', part: 1, topic: 'Food and cooking', prepSeconds: 0, speakSeconds: 45, questions: ['What kind of food do you like?', 'Do you often cook at home?', 'Is there any food you did not like as a child but enjoy now?', 'Do people in your country often eat out?'] },
  { slug: 'p1-weather', part: 1, topic: 'Weather and seasons', prepSeconds: 0, speakSeconds: 45, questions: ['What is the weather usually like where you live?', 'Which season do you like best? Why?', 'Does the weather affect your mood?', 'Do you check the weather forecast often?'] },
  { slug: 'p1-technology', part: 1, topic: 'Mobile phones', prepSeconds: 0, speakSeconds: 45, questions: ['How often do you use your mobile phone?', 'What do you mainly use it for?', 'Could you live without a mobile phone for a week?', 'At what age should children have their own phone?'] },
  // Part 2 — cue card: 1 minute preparation, 1–2 minutes speaking
  { slug: 'p2-memorable-trip', part: 2, topic: 'A memorable journey', prepSeconds: 60, speakSeconds: 120, cueCard: 'Describe a journey you remember well.', questions: ['where you went', 'how you travelled', 'who you went with', 'and explain why you remember this journey so well.'] },
  { slug: 'p2-helpful-person', part: 2, topic: 'A person who helped you', prepSeconds: 60, speakSeconds: 120, cueCard: 'Describe a person who has helped you in an important way.', questions: ['who this person is', 'how you know them', 'what they did to help you', 'and explain how you felt about their help.'] },
  { slug: 'p2-skill-learned', part: 2, topic: 'A skill you learned', prepSeconds: 60, speakSeconds: 120, cueCard: 'Describe a skill you learned that you think is useful.', questions: ['what the skill is', 'when and how you learned it', 'how difficult it was to learn', 'and explain why you think it is useful.'] },
  { slug: 'p2-favourite-place', part: 2, topic: 'A place you like to relax', prepSeconds: 60, speakSeconds: 120, cueCard: 'Describe a place where you like to relax.', questions: ['where it is', 'how often you go there', 'what you do there', 'and explain why it is a good place to relax.'] },
  { slug: 'p2-book-film', part: 2, topic: 'A book or film', prepSeconds: 60, speakSeconds: 120, cueCard: 'Describe a book you have read or a film you have watched that made a strong impression on you.', questions: ['what it was', 'when you read or watched it', 'what it was about', 'and explain why it made a strong impression on you.'] },
  { slug: 'p2-environment-action', part: 2, topic: 'Helping the environment', prepSeconds: 60, speakSeconds: 120, cueCard: 'Describe something you do to help protect the environment.', questions: ['what you do', 'when you started doing it', 'how easy or difficult it is', 'and explain why you think it is important.'] },
  // Part 3 — discussion, longer answers
  { slug: 'p3-travel-tourism', part: 3, topic: 'Travel and tourism', prepSeconds: 0, speakSeconds: 75, questions: ['Why do you think people enjoy travelling to other countries?', 'What are the positive and negative effects of tourism on local communities?', 'How might the way people travel change in the future?'] },
  { slug: 'p3-education-skills', part: 3, topic: 'Education and skills', prepSeconds: 0, speakSeconds: 75, questions: ['Which skills do you think schools should teach that they do not teach now?', 'Is it better to learn practical skills or academic subjects?', 'How has technology changed the way people learn new skills?'] },
  { slug: 'p3-environment', part: 3, topic: 'The environment', prepSeconds: 0, speakSeconds: 75, questions: ['Who should be more responsible for protecting the environment: governments or individuals?', 'Why do some people not care about environmental problems?', 'Do you think international cooperation can solve climate change?'] },
  { slug: 'p3-community', part: 3, topic: 'Helping others and community', prepSeconds: 0, speakSeconds: 75, questions: ['Why do some people volunteer to help others?', 'Do people help their neighbours less than they did in the past?', 'Should companies encourage their employees to do volunteer work?'] },
  { slug: 'p3-media', part: 3, topic: 'Books, films and media', prepSeconds: 0, speakSeconds: 75, questions: ['Do you think reading books is still important in the age of the internet?', 'How do films influence the way people think?', 'Should governments control what is shown on television and online?'] },
];

/** Prompts for timed speaking challenges (Battles > Speaking challenge). */
export const speakingChallenges: { prompt: string; targetWords: string[]; seconds: number; minWords: number }[] = [
  { prompt: 'Describe your perfect weekend.', targetWords: ['relax', 'usually', 'favourite'], seconds: 60, minWords: 80 },
  { prompt: 'Talk about a city you would like to visit and why.', targetWords: ['culture', 'experience', 'definitely'], seconds: 60, minWords: 80 },
  { prompt: 'Explain how technology has changed the way people communicate.', targetWords: ['instantly', 'however', 'convenient'], seconds: 60, minWords: 90 },
  { prompt: 'Describe a meal you enjoy cooking or eating.', targetWords: ['ingredients', 'delicious', 'recipe'], seconds: 60, minWords: 80 },
  { prompt: 'Should students wear school uniforms? Give your opinion.', targetWords: ['equality', 'although', 'express'], seconds: 60, minWords: 90 },
  { prompt: 'Talk about a goal you want to achieve this year.', targetWords: ['achieve', 'motivated', 'plan'], seconds: 60, minWords: 80 },
  { prompt: 'Describe the advantages of living in a big city.', targetWords: ['opportunities', 'transport', 'variety'], seconds: 60, minWords: 90 },
  { prompt: 'What makes a good friend? Explain your ideas.', targetWords: ['trust', 'support', 'honest'], seconds: 60, minWords: 80 },
  { prompt: 'Talk about how people can reduce plastic waste.', targetWords: ['recycle', 'reusable', 'environment'], seconds: 60, minWords: 90 },
  { prompt: 'Describe a teacher who influenced you.', targetWords: ['inspired', 'patient', 'encouraged'], seconds: 60, minWords: 80 },
  { prompt: 'Is it better to work for a large company or a small one?', targetWords: ['whereas', 'flexible', 'career'], seconds: 60, minWords: 90 },
  { prompt: 'Talk about a festival or celebration in your country.', targetWords: ['tradition', 'celebrate', 'family'], seconds: 60, minWords: 80 },
];

export interface SeedMockTest {
  slug: string;
  variant: 'academic' | 'general';
  title: string;
  description: string;
  isPremium?: boolean;
  sections: { module: 'listening' | 'reading' | 'writing' | 'speaking'; refs: string[]; timeLimitSec: number }[];
}

export const mockTests: SeedMockTest[] = [
  {
    slug: 'mock-academic-1',
    variant: 'academic',
    title: 'Academic practice mock test 1',
    description:
      'A shortened practice test in the IELTS Academic order: Listening (2 parts, 13 questions), Reading (1 passage, 12 questions), Writing (Task 1 and Task 2) and Speaking (Parts 1–3). Real IELTS papers have 40 listening and 40 reading questions; band estimates here are scaled and approximate.',
    sections: [
      { module: 'listening', refs: ['mock-listening-apartment-heat'], timeLimitSec: 20 * 60 },
      { module: 'reading', refs: ['mock-academic-bicycle'], timeLimitSec: 20 * 60 },
      { module: 'writing', refs: ['mock-acad-t1-commuting', 'mock-acad-t2-museums-free'], timeLimitSec: 60 * 60 },
      { module: 'speaking', refs: ['p1-free-time', 'p2-skill-learned', 'p3-education-skills'], timeLimitSec: 15 * 60 },
    ],
  },
  {
    slug: 'mock-general-1',
    variant: 'general',
    title: 'General Training practice mock test 1',
    description:
      'A shortened practice test in the IELTS General Training order: Listening (2 parts, 13 questions), Reading (1 text, 10 questions), Writing (letter and essay) and Speaking (Parts 1–3). Band estimates are scaled and approximate.',
    sections: [
      { module: 'listening', refs: ['mock-listening-apartment-heat'], timeLimitSec: 20 * 60 },
      { module: 'reading', refs: ['mock-general-volunteering'], timeLimitSec: 20 * 60 },
      { module: 'writing', refs: ['mock-gen-t1-neighbour', 'mock-gen-t2-children-chores'], timeLimitSec: 60 * 60 },
      { module: 'speaking', refs: ['p1-home', 'p2-helpful-person', 'p3-community'], timeLimitSec: 15 * 60 },
    ],
  },
  {
    slug: 'mock-academic-2',
    variant: 'academic',
    title: 'Academic practice mock test 2 (Premium)',
    description:
      'A second Academic practice test built from practice-bank material: Listening (lecture), Reading (coral reefs passage), Writing (map task and essay) and Speaking. Band estimates are scaled and approximate.',
    isPremium: true,
    sections: [
      { module: 'listening', refs: ['listening-history-of-tea'], timeLimitSec: 15 * 60 },
      { module: 'reading', refs: ['academic-coral-reefs'], timeLimitSec: 20 * 60 },
      { module: 'writing', refs: ['acad-t1-town-centre-map', 't2-technology-children'], timeLimitSec: 60 * 60 },
      { module: 'speaking', refs: ['p1-technology', 'p2-book-film', 'p3-media'], timeLimitSec: 15 * 60 },
    ],
  },
];
