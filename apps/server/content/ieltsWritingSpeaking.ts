// Original IELTS-style writing and speaking prompts.
export interface WritingSeed {
  slug: string;
  testType: 'academic' | 'general' | 'both';
  task: 1 | 2;
  kind: string;
  title: string;
  prompt: string;
  instructions: string;
  visual?: any;
  minWords: number;
  timeLimitSec: number;
  isPremium?: boolean;
}

const T1_ACAD = 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.';
const T2 = 'Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.';
const GT_LETTER = 'Write at least 150 words. You do NOT need to write any addresses. Begin your letter as follows:';

export const WRITING_PROMPTS: WritingSeed[] = [
  {
    slug: 'acad-t1-bar-internet', testType: 'academic', task: 1, kind: 'bar_chart',
    title: 'Household internet access in four countries',
    prompt: 'The chart below shows the percentage of households with internet access in four countries in 2005, 2012 and 2020.',
    instructions: T1_ACAD, minWords: 150, timeLimitSec: 20 * 60,
    visual: {
      type: 'bar', unit: '%', max: 100,
      categories: ['Country A', 'Country B', 'Country C', 'Country D'],
      series: [
        { name: '2005', values: [62, 28, 45, 12] },
        { name: '2012', values: [81, 55, 68, 31] },
        { name: '2020', values: [94, 83, 79, 64] },
      ],
    },
  },
  {
    slug: 'acad-t1-line-museums', testType: 'academic', task: 1, kind: 'line_graph',
    title: 'Visitors to three museums',
    prompt: 'The graph below shows the number of visitors (in thousands) to three museums in a city between 2010 and 2020.',
    instructions: T1_ACAD, minWords: 150, timeLimitSec: 20 * 60,
    visual: {
      type: 'line', unit: 'thousand visitors', max: 600,
      categories: ['2010', '2012', '2014', '2016', '2018', '2020'],
      series: [
        { name: 'Science Museum', values: [420, 455, 470, 510, 560, 300] },
        { name: 'Art Gallery', values: [300, 290, 260, 240, 250, 140] },
        { name: 'History Museum', values: [150, 180, 230, 280, 330, 210] },
      ],
    },
  },
  {
    slug: 'acad-t1-table-spending', testType: 'academic', task: 1, kind: 'table',
    title: 'Household spending in 1990 and 2020',
    prompt: 'The table below shows the proportion of average household spending on six categories in one country in 1990 and 2020.',
    instructions: T1_ACAD, minWords: 150, timeLimitSec: 20 * 60,
    visual: {
      type: 'table',
      headers: ['Category', '1990 (%)', '2020 (%)'],
      rows: [['Housing', '22', '31'], ['Food', '26', '15'], ['Transport', '14', '13'], ['Clothing', '10', '5'], ['Leisure', '9', '14'], ['Communication', '2', '7']],
      note: 'Remaining spending (17% in 1990, 15% in 2020) is classified as “other”.',
    },
  },
  {
    slug: 'acad-t1-process-tea', testType: 'academic', task: 1, kind: 'process',
    title: 'How black tea is produced',
    prompt: 'The diagram below shows the stages in the production of black tea.',
    instructions: T1_ACAD, minWords: 150, timeLimitSec: 20 * 60,
    visual: {
      type: 'process',
      steps: [
        { label: 'Plucking', detail: 'Top two leaves and a bud picked by hand' },
        { label: 'Withering', detail: 'Leaves spread on racks for 12–18 hours to lose moisture' },
        { label: 'Rolling', detail: 'Leaves rolled by machine to break cell walls' },
        { label: 'Oxidation', detail: 'Leaves left in a humid room for 2–4 hours; turn copper-brown' },
        { label: 'Drying', detail: 'Hot air at about 120°C stops oxidation' },
        { label: 'Sorting', detail: 'Leaves graded by size through sieves' },
        { label: 'Packing', detail: 'Packed into bags or boxes and shipped' },
      ],
    },
  },
  {
    slug: 'acad-t1-map-village', testType: 'academic', task: 1, kind: 'map',
    title: 'Changes to Westbridge village',
    prompt: 'The maps below show the village of Westbridge in 2000 and today.',
    instructions: T1_ACAD, minWords: 150, timeLimitSec: 20 * 60, isPremium: false,
    visual: {
      type: 'maps',
      maps: [
        { title: '2000', items: [
          { label: 'Farmland', x: 10, y: 10, w: 40, h: 35 }, { label: 'Woodland', x: 55, y: 10, w: 35, h: 35 },
          { label: 'Shops', x: 10, y: 55, w: 18, h: 15 }, { label: 'School', x: 32, y: 55, w: 18, h: 15 },
          { label: 'Houses', x: 55, y: 55, w: 35, h: 15 }, { label: 'Main road', x: 0, y: 80, w: 100, h: 6, road: true },
        ] },
        { title: 'Today', items: [
          { label: 'Housing estate', x: 10, y: 10, w: 40, h: 35 }, { label: 'Woodland (smaller)', x: 65, y: 10, w: 25, h: 35 },
          { label: 'Car park', x: 52, y: 10, w: 11, h: 20 },
          { label: 'Supermarket', x: 10, y: 55, w: 18, h: 15 }, { label: 'School (extended)', x: 32, y: 55, w: 26, h: 15 },
          { label: 'Houses', x: 62, y: 55, w: 28, h: 15 }, { label: 'Main road', x: 0, y: 80, w: 100, h: 6, road: true },
          { label: 'Cycle path', x: 0, y: 90, w: 100, h: 3, road: true },
        ] },
      ],
    },
  },
  {
    slug: 'acad-t2-university-purpose', testType: 'both', task: 2, kind: 'essay',
    title: 'The purpose of university',
    prompt: 'Some people believe that universities should focus on preparing students for employment. Others think the main purpose of a university is to provide knowledge for its own sake. Discuss both views and give your own opinion.',
    instructions: T2, minWords: 250, timeLimitSec: 40 * 60,
  },
  {
    slug: 'acad-t2-traffic', testType: 'both', task: 2, kind: 'essay',
    title: 'Traffic congestion',
    prompt: 'In many cities, traffic congestion is a growing problem. What are the main causes of this problem, and what measures could be taken to reduce it?',
    instructions: T2, minWords: 250, timeLimitSec: 40 * 60,
  },
  {
    slug: 'acad-t2-arts-funding', testType: 'academic', task: 2, kind: 'essay',
    title: 'Public money for the arts',
    prompt: 'Some people think that governments should spend money on public services such as healthcare and education rather than on the arts. To what extent do you agree or disagree?',
    instructions: T2, minWords: 250, timeLimitSec: 40 * 60,
  },
  {
    slug: 'acad-t2-remote-work', testType: 'both', task: 2, kind: 'essay',
    title: 'Working from home',
    prompt: 'Working from home is becoming increasingly common. Do the advantages of this development outweigh the disadvantages?',
    instructions: T2, minWords: 250, timeLimitSec: 40 * 60, isPremium: true,
  },
  {
    slug: 'gt-t1-lost-luggage', testType: 'general', task: 1, kind: 'letter_formal',
    title: 'Complaint about lost luggage (formal)',
    prompt: 'You recently travelled by plane, and your suitcase did not arrive at your destination. Write a letter to the airline. In your letter: describe your journey and the suitcase; explain the problems this has caused you; say what you would like the airline to do.',
    instructions: `${GT_LETTER} Dear Sir or Madam,`, minWords: 150, timeLimitSec: 20 * 60,
  },
  {
    slug: 'gt-t1-time-off', testType: 'general', task: 1, kind: 'letter_semi',
    title: 'Asking your manager for time off (semi-formal)',
    prompt: 'You would like to attend a short training course that takes place during working hours. Write a letter to your manager. In your letter: describe the course; explain how it would benefit your work; suggest how your work could be covered while you are away.',
    instructions: `${GT_LETTER} Dear Mr Patel,`, minWords: 150, timeLimitSec: 20 * 60,
  },
  {
    slug: 'gt-t1-wedding', testType: 'general', task: 1, kind: 'letter_informal',
    title: 'Declining a wedding invitation (informal)',
    prompt: 'A friend has invited you to their wedding, but you cannot attend. Write a letter to your friend. In your letter: thank them for the invitation; explain why you cannot go; suggest another way to celebrate together.',
    instructions: `${GT_LETTER} Dear Sam,`, minWords: 150, timeLimitSec: 20 * 60,
  },
  {
    slug: 'gt-t2-house-apartment', testType: 'general', task: 2, kind: 'essay',
    title: 'Houses or apartments',
    prompt: 'Some people prefer to live in a house, while others prefer to live in an apartment. Discuss the advantages of both and give your own opinion.',
    instructions: T2, minWords: 250, timeLimitSec: 40 * 60,
  },
  {
    slug: 'gt-t2-social-media', testType: 'general', task: 2, kind: 'essay',
    title: 'Young people and social media',
    prompt: 'Many young people today spend several hours a day on social media. Is this a positive or a negative development?',
    instructions: T2, minWords: 250, timeLimitSec: 40 * 60,
  },
];

export interface SpeakingSeed {
  slug: string;
  part: 1 | 2 | 3;
  topic: string;
  text: string;
  bullets?: string[];
  questions?: string[];
  groupKey?: string;
}

export const SPEAKING_PROMPTS: SpeakingSeed[] = [
  // Part 1
  { slug: 'p1-work-study', part: 1, topic: 'Work or study', text: 'Work or study', questions: ['Do you work or are you a student?', 'What do you like most about your work or studies?', 'Is there anything you would like to change about it?', 'Do you plan to continue in the same field in the future?'] },
  { slug: 'p1-hometown', part: 1, topic: 'Hometown', text: 'Your hometown', questions: ['Where is your hometown?', 'What do you like about living there?', 'Has your hometown changed much in recent years?', 'Would you recommend it to visitors? Why?'] },
  { slug: 'p1-home', part: 1, topic: 'Home', text: 'Your home', questions: ['Do you live in a house or an apartment?', 'Which room do you spend the most time in?', 'What would you like to change about your home?', 'Do you think you will live there for a long time?'] },
  { slug: 'p1-hobbies', part: 1, topic: 'Free time', text: 'Free time and hobbies', questions: ['What do you usually do in your free time?', 'Did you have the same hobbies when you were a child?', 'Do you prefer spending free time alone or with others?', 'Is there a new hobby you would like to try?'] },
  { slug: 'p1-food', part: 1, topic: 'Food', text: 'Food and cooking', questions: ['What kind of food do you enjoy most?', 'Do you often cook at home?', 'Is there any food you disliked as a child but enjoy now?', 'How important is it to eat meals with family?'] },
  { slug: 'p1-weather', part: 1, topic: 'Weather', text: 'Weather', questions: ['What is the weather usually like where you live?', 'What is your favourite season? Why?', 'Does the weather affect your mood?', 'Do you check the weather forecast often?'] },
  { slug: 'p1-technology', part: 1, topic: 'Technology', text: 'Technology', questions: ['How often do you use your phone each day?', 'Which app do you use most?', 'Do you think you spend too much time online?', 'What technology would you find hard to live without?'] },
  { slug: 'p1-reading', part: 1, topic: 'Reading', text: 'Reading', questions: ['Do you enjoy reading?', 'What kind of things do you read?', 'Do you prefer printed books or e-books?', 'Did you read a lot as a child?'] },
  // Part 2 cue cards (grouped with Part 3)
  { slug: 'p2-helpful-person', part: 2, topic: 'People', groupKey: 'helping', text: 'Describe a person who has helped you to achieve something.', bullets: ['who this person is', 'what you wanted to achieve', 'how they helped you', 'and explain how you felt about their help'] },
  { slug: 'p2-memorable-trip', part: 2, topic: 'Travel', groupKey: 'travel', text: 'Describe a journey you remember well.', bullets: ['where you went', 'how you travelled', 'who you were with', 'and explain why you remember this journey'] },
  { slug: 'p2-useful-skill', part: 2, topic: 'Skills', groupKey: 'skills', text: 'Describe a skill you learned that you think is very useful.', bullets: ['what the skill is', 'when and how you learned it', 'how often you use it', 'and explain why you think it is useful'] },
  { slug: 'p2-favourite-place', part: 2, topic: 'Places', groupKey: 'places', text: 'Describe a place in your city where you like to spend time.', bullets: ['where it is', 'what it looks like', 'what you do there', 'and explain why you like spending time there'] },
  { slug: 'p2-technology-item', part: 2, topic: 'Technology', groupKey: 'tech', text: 'Describe a piece of technology you find useful.', bullets: ['what it is', 'when you got it', 'what you use it for', 'and explain why it is useful to you'] },
  { slug: 'p2-celebration', part: 2, topic: 'Events', groupKey: 'celebrations', text: 'Describe a celebration you enjoyed.', bullets: ['what the celebration was', 'where and when it took place', 'what people did', 'and explain why you enjoyed it'] },
  { slug: 'p2-book-film', part: 2, topic: 'Media', groupKey: 'media', text: 'Describe a book or film that made you think.', bullets: ['what it was', 'when you read or watched it', 'what it was about', 'and explain why it made you think'] },
  { slug: 'p2-goal', part: 2, topic: 'Goals', groupKey: 'goals', text: 'Describe a goal you would like to achieve in the future.', bullets: ['what the goal is', 'when you decided on it', 'what you need to do to achieve it', 'and explain why it is important to you'] },
  // Part 3
  { slug: 'p3-helping', part: 3, topic: 'Helping others', groupKey: 'helping', text: 'Helping others', questions: ['Why do some people find it difficult to ask for help?', 'Should schools teach children to help others? How?', 'Do people help their neighbours less than in the past?', 'What role should governments play in supporting volunteers?'] },
  { slug: 'p3-travel', part: 3, topic: 'Travel and tourism', groupKey: 'travel', text: 'Travel and tourism', questions: ['Why do people travel more now than in the past?', 'What are the negative effects of tourism on local communities?', 'Will people travel less in the future because of the environment?', 'Is it better to travel alone or in a group?'] },
  { slug: 'p3-skills', part: 3, topic: 'Learning skills', groupKey: 'skills', text: 'Learning skills', questions: ['Which skills will be most important for young people in the future?', 'Is it better to learn skills from a teacher or online?', 'Why do some adults stop learning new things?', 'Should employers pay for their staff to learn new skills?'] },
  { slug: 'p3-places', part: 3, topic: 'Public spaces', groupKey: 'places', text: 'Public spaces', questions: ['Why are parks important in cities?', 'How could city centres be made more attractive?', 'Should public spaces be free for everyone to use?', 'How have public places changed in your country?'] },
  { slug: 'p3-tech', part: 3, topic: 'Technology and society', groupKey: 'tech', text: 'Technology and society', questions: ['Has technology made people more or less sociable?', 'Do older people find it harder to adapt to new technology? Why?', 'Should there be limits on how much time children spend on screens?', 'What jobs might disappear because of technology?'] },
  { slug: 'p3-celebrations', part: 3, topic: 'Celebrations', groupKey: 'celebrations', text: 'Celebrations and traditions', questions: ['Why are traditional celebrations important?', 'Are celebrations becoming too commercial?', 'How do celebrations differ between generations?', 'Should national holidays be kept or changed?'] },
  { slug: 'p3-media', part: 3, topic: 'Books and films', groupKey: 'media', text: 'Books and films', questions: ['Do people read less than they used to?', 'Why are films based on books so popular?', 'Should schools make students read classic literature?', 'What makes a story stay with people for a long time?'] },
  { slug: 'p3-goals', part: 3, topic: 'Ambition', groupKey: 'goals', text: 'Ambition and success', questions: ['Is it important to set goals in life?', 'Do young people today have different goals from their parents?', 'How do people define success in your culture?', 'Can too much ambition be a bad thing?'] },
];

export interface MockSeed {
  slug: string;
  title: string;
  testType: 'academic' | 'general';
  description: string;
  isPremium?: boolean;
  sections: (
    | { skill: 'listening' | 'reading'; setSlugs: string[]; timeLimitSec: number }
    | { skill: 'writing'; promptSlugs: string[]; timeLimitSec: number }
    | { skill: 'speaking'; promptSlugs: string[]; timeLimitSec: number }
  )[];
}

const LISTENING_ALL = ['listening-s1-course-booking', 'listening-s2-nature-reserve', 'listening-s3-food-waste-project', 'listening-s4-urban-heat'];

export const MOCK_TESTS: MockSeed[] = [
  {
    slug: 'academic-mock-1',
    title: 'Academic Practice Test 1',
    testType: 'academic',
    description: 'Full Academic practice test: Listening (40 questions), Reading (3 passages, 40 questions), Writing (2 tasks) and Speaking (3 parts).',
    sections: [
      { skill: 'listening', setSlugs: LISTENING_ALL, timeLimitSec: 32 * 60 },
      { skill: 'reading', setSlugs: ['academic-reading-urban-bees', 'reading-fog-harvesting', 'academic-reading-sleep-memory'], timeLimitSec: 60 * 60 },
      { skill: 'writing', promptSlugs: ['acad-t1-bar-internet', 'acad-t2-university-purpose'], timeLimitSec: 60 * 60 },
      { skill: 'speaking', promptSlugs: ['p1-hometown', 'p2-useful-skill', 'p3-skills'], timeLimitSec: 15 * 60 },
    ],
  },
  {
    slug: 'general-mock-1',
    title: 'General Training Practice Test 1',
    testType: 'general',
    description: 'Full General Training practice test: Listening (40 questions), Reading (3 sections, 40 questions), Writing (letter + essay) and Speaking (3 parts).',
    sections: [
      { skill: 'listening', setSlugs: LISTENING_ALL, timeLimitSec: 32 * 60 },
      { skill: 'reading', setSlugs: ['gt-reading-evening-classes', 'gt-reading-hotel-safety', 'reading-fog-harvesting'], timeLimitSec: 60 * 60 },
      { skill: 'writing', promptSlugs: ['gt-t1-lost-luggage', 'gt-t2-social-media'], timeLimitSec: 60 * 60 },
      { skill: 'speaking', promptSlugs: ['p1-work-study', 'p2-memorable-trip', 'p3-travel'], timeLimitSec: 15 * 60 },
    ],
  },
];
