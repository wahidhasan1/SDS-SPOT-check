// Placement item bank. Difficulty is on the 1 (A1) … 6 (C2) scale used by the adaptive engine.
export interface AssessmentSeed {
  key: string;
  skill: 'vocabulary' | 'grammar' | 'reading' | 'listening';
  cefr: string;
  difficulty: number;
  prompt: string;
  passage?: string;
  script?: string; // listening: synthesised into /media/assessment/<key>.mp3
  voice?: string;
  options: string[];
  answer: string;
  explanation?: string;
}

const v = (key: string, cefr: string, difficulty: number, prompt: string, options: string[], answer: string, explanation?: string): AssessmentSeed => ({
  key, skill: 'vocabulary', cefr, difficulty, prompt, options, answer, explanation,
});
const g = (key: string, cefr: string, difficulty: number, prompt: string, options: string[], answer: string, explanation?: string): AssessmentSeed => ({
  key, skill: 'grammar', cefr, difficulty, prompt, options, answer, explanation,
});

export const ASSESSMENT_ITEMS: AssessmentSeed[] = [
  // Vocabulary
  v('v-a1-1', 'A1', 1.0, 'Choose the word that means the opposite of "hot".', ['cold', 'warm', 'big', 'fast'], 'cold'),
  v('v-a1-2', 'A1', 1.2, 'I eat breakfast in the ___.', ['morning', 'night', 'week', 'year'], 'morning'),
  v('v-a1-3', 'A1', 1.4, 'A person who teaches is a ___.', ['teacher', 'doctor', 'driver', 'farmer'], 'teacher'),
  v('v-a1-4', 'A1', 1.3, 'Which word is a colour?', ['green', 'chair', 'happy', 'run'], 'green'),
  v('v-a2-1', 'A2', 2.0, 'Can I ___ your pen? I’ll give it back in a minute.', ['borrow', 'lend', 'give', 'take away'], 'borrow'),
  v('v-a2-2', 'A2', 2.2, 'The shop was very ___ — there were people everywhere.', ['crowded', 'empty', 'quiet', 'cheap'], 'crowded'),
  v('v-a2-3', 'A2', 2.4, 'We took a long ___ by train across the country.', ['journey', 'travel', 'way', 'road'], 'journey'),
  v('v-a2-4', 'A2', 2.1, 'Something that costs a lot of money is ___.', ['expensive', 'cheap', 'free', 'tired'], 'expensive'),
  v('v-b1-1', 'B1', 3.0, 'I can’t ___ a new laptop at the moment; I don’t have enough money.', ['afford', 'achieve', 'allow', 'admit'], 'afford'),
  v('v-b1-2', 'B1', 3.2, 'The meeting time isn’t ___ for me. Could we do Thursday instead?', ['convenient', 'comfortable', 'confident', 'considerate'], 'convenient'),
  v('v-b1-3', 'B1', 3.1, 'She ___ me to apply for the job, and I’m glad she did.', ['encouraged', 'complained', 'ignored', 'prevented'], 'encouraged'),
  v('v-b1-4', 'B1', 3.4, 'Which word is closest in meaning to "reliable"?', ['dependable', 'available', 'flexible', 'remarkable'], 'dependable'),
  v('v-b2-1', 'B2', 4.0, 'The number of visitors ___ sharply after the bridge closed.', ['declined', 'deprived', 'denied', 'derived'], 'declined'),
  v('v-b2-2', 'B2', 4.2, 'Many people are ___ to change their habits, even when they know they should.', ['reluctant', 'relevant', 'reliant', 'resilient'], 'reluctant'),
  v('v-b2-3', 'B2', 4.3, 'Smartphone use is now ___ among teenagers — almost every one has one.', ['widespread', 'widened', 'worldly', 'wholesome'], 'widespread'),
  v('v-b2-4', 'B2', 4.5, 'Which word means "unavoidable"?', ['inevitable', 'invaluable', 'inedible', 'inaudible'], 'inevitable'),
  v('v-c1-1', 'C1', 5.0, 'Building more roads may actually ___ congestion rather than reduce it.', ['exacerbate', 'alleviate', 'exonerate', 'emulate'], 'exacerbate'),
  v('v-c1-2', 'C1', 5.2, 'The proposal is interesting, but is it financially ___?', ['viable', 'vivid', 'volatile', 'venerable'], 'viable'),
  v('v-c1-3', 'C1', 5.3, 'The policy has come under intense public ___.', ['scrutiny', 'scarcity', 'serenity', 'sincerity'], 'scrutiny'),
  v('v-c1-4', 'C1', 5.5, 'Which word means "make a bad situation less severe"?', ['mitigate', 'aggravate', 'instigate', 'navigate'], 'mitigate'),
  v('v-c2-1', 'C2', 6.0, 'Coffee shops have become ___ in the city centre; there is one on every corner.', ['ubiquitous', 'ambiguous', 'superfluous', 'innocuous'], 'ubiquitous'),
  v('v-c2-2', 'C2', 6.1, 'Later experiments ___ the original findings, confirming the theory.', ['corroborated', 'collaborated', 'confiscated', 'congregated'], 'corroborated'),
  v('v-c2-3', 'C2', 6.3, 'The link between the two events is ___ at best — there is little evidence for it.', ['tenuous', 'tenacious', 'tedious', 'tremendous'], 'tenuous'),
  // Grammar
  g('g-a1-1', 'A1', 1.0, 'She ___ a student.', ['is', 'are', 'am', 'be'], 'is'),
  g('g-a1-2', 'A1', 1.2, 'I ___ like coffee.', ["don't", "doesn't", "isn't", "not"], "don't"),
  g('g-a1-3', 'A1', 1.5, 'There ___ two cats in the garden.', ['are', 'is', 'be', 'am'], 'are'),
  g('g-a1-4', 'A1', 1.3, '___ you speak English?', ['Do', 'Does', 'Are', 'Is'], 'Do'),
  g('g-a2-1', 'A2', 2.0, 'Yesterday we ___ to the beach.', ['went', 'go', 'gone', 'have gone'], 'went'),
  g('g-a2-2', 'A2', 2.2, 'This book is ___ than that one.', ['more interesting', 'interestinger', 'most interesting', 'the more interesting'], 'more interesting'),
  g('g-a2-3', 'A2', 2.4, 'Look! It ___.', ['is snowing', 'snows', 'snow', 'snowed'], 'is snowing'),
  g('g-a2-4', 'A2', 2.3, 'How ___ water do you drink every day?', ['much', 'many', 'few', 'a few'], 'much'),
  g('g-b1-1', 'B1', 3.0, 'I ___ in this city since 2018.', ['have lived', 'live', 'lived', 'am living'], 'have lived'),
  g('g-b1-2', 'B1', 3.2, 'If it rains tomorrow, we ___ the picnic.', ['will cancel', 'would cancel', 'cancelled', 'cancel will'], 'will cancel'),
  g('g-b1-3', 'B1', 3.3, 'I’m looking forward to ___ you.', ['seeing', 'see', 'saw', 'have seen'], 'seeing'),
  g('g-b1-4', 'B1', 3.5, 'The man ___ lives next door is a pilot.', ['who', 'which', 'whose', 'where'], 'who'),
  g('g-b2-1', 'B2', 4.0, 'The bridge ___ in 1890.', ['was built', 'built', 'has built', 'is building'], 'was built'),
  g('g-b2-2', 'B2', 4.2, 'If I ___ you, I would accept the offer.', ['were', 'am', 'will be', 'had'], 'were'),
  g('g-b2-3', 'B2', 4.4, 'She asked me where ___.', ['I lived', 'did I live', 'do I live', 'I live?'], 'I lived'),
  g('g-b2-4', 'B2', 4.6, '___ the bad weather, the event was a success.', ['Despite', 'Although', 'However', 'Even'], 'Despite'),
  g('g-c1-1', 'C1', 5.0, 'If she had taken the job, she ___ in London now.', ['would be living', 'would have lived', 'will live', 'had lived'], 'would be living'),
  g('g-c1-2', 'C1', 5.2, '___ had I arrived than the phone rang.', ['No sooner', 'Hardly', 'As soon', 'Barely'], 'No sooner'),
  g('g-c1-3', 'C1', 5.4, 'It is essential that every student ___ the form.', ['complete', 'completes', 'will complete', 'completed'], 'complete', 'Subjunctive after "essential that".'),
  g('g-c1-4', 'C1', 5.5, 'The results, ___ were published last week, surprised everyone.', ['which', 'that', 'what', 'who'], 'which'),
  g('g-c2-1', 'C2', 6.0, 'Little ___ that the decision would change her life.', ['did she know', 'she knew', 'knew she', 'she did know'], 'did she know'),
  g('g-c2-2', 'C2', 6.2, 'Were the council ___ the plan, protests would follow.', ['to approve', 'approving', 'approved', 'approve'], 'to approve'),
  g('g-c2-3', 'C2', 6.3, 'Not until the final report was published ___ the full extent of the problem.', ['did we realise', 'we realised', 'we did realise', 'realised we'], 'did we realise'),
  // Reading
  {
    key: 'r-a1-1', skill: 'reading', cefr: 'A1', difficulty: 1.2,
    passage: 'Hi Sam, I am at the park with my sister. We are playing football. Come and join us! — Leo',
    prompt: 'Where is Leo?', options: ['At the park', 'At home', 'At school', 'At the shop'], answer: 'At the park',
  },
  {
    key: 'r-a2-1', skill: 'reading', cefr: 'A2', difficulty: 2.2,
    passage: 'The swimming pool is closed on Monday for cleaning. From Tuesday to Sunday it opens at 7 a.m. and closes at 9 p.m. Children under 8 must swim with an adult.',
    prompt: 'Which statement is true?', options: ['Young children need an adult with them.', 'The pool opens at 9 a.m.', 'The pool is open every day.', 'Cleaning happens on Sunday.'], answer: 'Young children need an adult with them.',
  },
  {
    key: 'r-b1-1', skill: 'reading', cefr: 'B1', difficulty: 3.2,
    passage: 'When Maria moved to Canada, she expected the cold winters to be the hardest part. In fact, she quickly got used to the snow. What she found more difficult was understanding people who spoke quickly, especially on the phone, where she could not see their faces.',
    prompt: 'What did Maria find most difficult?', options: ['Understanding fast speech on the phone', 'The cold winters', 'Making friends', 'Finding a job'], answer: 'Understanding fast speech on the phone',
  },
  {
    key: 'r-b1-2', skill: 'reading', cefr: 'B1', difficulty: 3.5,
    passage: 'Our café now offers a “pay-it-forward” scheme. Customers can pay for an extra coffee, which we keep for someone who cannot afford one. Since January, more than 400 coffees have been given away.',
    prompt: 'What is the purpose of the scheme?', options: ['To help people who cannot pay', 'To give regular customers discounts', 'To sell more coffee in January', 'To raise money for the café'], answer: 'To help people who cannot pay',
  },
  {
    key: 'r-b2-1', skill: 'reading', cefr: 'B2', difficulty: 4.3,
    passage: 'Although remote work was initially welcomed as a way to avoid long commutes, several surveys suggest that many employees now miss the informal conversations of office life. Managers, meanwhile, report that new staff take longer to learn unwritten workplace norms when they rarely meet colleagues in person.',
    prompt: 'According to the text, what is one disadvantage of remote work for new staff?', options: ['They learn workplace norms more slowly.', 'They have longer commutes.', 'They are paid less.', 'They have fewer formal meetings.'], answer: 'They learn workplace norms more slowly.',
  },
  {
    key: 'r-b2-2', skill: 'reading', cefr: 'B2', difficulty: 4.6,
    passage: 'The museum’s decision to charge an entrance fee has divided opinion. Supporters argue that the income is needed to protect fragile collections; critics counter that culture should be accessible to everyone, regardless of income, and point out that visitor numbers at similar museums fell by a third after fees were introduced.',
    prompt: 'What evidence do critics use?', options: ['Visitor numbers dropped elsewhere after fees started.', 'The collections are fragile.', 'The museum needs more income.', 'Culture is expensive to produce.'], answer: 'Visitor numbers dropped elsewhere after fees started.',
  },
  {
    key: 'r-c1-1', skill: 'reading', cefr: 'C1', difficulty: 5.3,
    passage: 'It would be tempting to attribute the town’s revival solely to the new rail link. Yet the station opened in 2009, while the most marked growth in local businesses predates it by several years, coinciding instead with the conversion of disused mills into affordable workshops. The rail link, in other words, may have accelerated a trend rather than initiated it.',
    prompt: 'What is the writer’s main point?', options: ['The rail link sped up growth that had already begun.', 'The rail link caused the town’s revival.', 'The mills prevented the town’s growth.', 'Growth started only after 2009.'], answer: 'The rail link sped up growth that had already begun.',
  },
  {
    key: 'r-c2-1', skill: 'reading', cefr: 'C2', difficulty: 6.1,
    passage: 'Critics who dismiss the novel as mere nostalgia overlook its quiet irony: the narrator’s lavish descriptions of the family estate are consistently undercut by passing references to the servants whose labour sustained it, references the narrator himself never seems to register.',
    prompt: 'What does the writer suggest about the novel?', options: ['It subtly criticises the narrator’s blindness to inequality.', 'It is a straightforward celebration of the past.', 'It focuses mainly on the servants’ lives.', 'Its descriptions are inaccurate.'], answer: 'It subtly criticises the narrator’s blindness to inequality.',
  },
  // Listening (audio generated from these scripts)
  {
    key: 'l-a1-1', skill: 'listening', cefr: 'A1', difficulty: 1.2, voice: 'en-gb-southern_english_female-low',
    script: 'Hello. My name is Anna. I am twenty-five years old and I live in Manchester with my two cats.',
    prompt: 'How many cats does Anna have?', options: ['Two', 'One', 'Three', 'None'], answer: 'Two',
  },
  {
    key: 'l-a2-1', skill: 'listening', cefr: 'A2', difficulty: 2.2, voice: 'en-us-amy-low',
    script: 'Attention, please. The train to Oxford will now leave from platform six, not platform four. We apologise for the change.',
    prompt: 'Which platform will the train leave from?', options: ['Platform six', 'Platform four', 'Platform two', 'Platform ten'], answer: 'Platform six',
  },
  {
    key: 'l-b1-1', skill: 'listening', cefr: 'B1', difficulty: 3.2, voice: 'en-gb-alan-low',
    script: 'I was going to drive to the conference, but my car is being repaired, so I have booked a seat on the early coach instead. It is cheaper than the train, although it takes about an hour longer.',
    prompt: 'How will the speaker travel to the conference?', options: ['By coach', 'By car', 'By train', 'By plane'], answer: 'By coach',
  },
  {
    key: 'l-b2-1', skill: 'listening', cefr: 'B2', difficulty: 4.3, voice: 'en-us-lessac-medium',
    script: 'The survey results were not what we expected. We assumed price would be the main reason customers left, but in fact most of them mentioned slow delivery. Price came a distant third, after poor customer service.',
    prompt: 'What was the main reason customers left?', options: ['Slow delivery', 'Price', 'Poor customer service', 'Product quality'], answer: 'Slow delivery',
  },
  {
    key: 'l-c1-1', skill: 'listening', cefr: 'C1', difficulty: 5.2, voice: 'en-gb-southern_english_female-low',
    script: 'While the committee welcomed the proposal in principle, members expressed reservations about its timescale, arguing that consulting local residents properly would take at least twice as long as the six months the developers had allowed.',
    prompt: 'What concern did the committee raise?', options: ['The schedule was too short for proper consultation.', 'The proposal was a bad idea.', 'The developers had not allowed any consultation.', 'Residents had rejected the plan.'], answer: 'The schedule was too short for proper consultation.',
  },
  {
    key: 'l-c2-1', skill: 'listening', cefr: 'C2', difficulty: 6.1, voice: 'en-us-lessac-medium',
    script: 'It is not that the original study was flawed, exactly. Its methods were sound for the time. The problem is that later researchers cited its tentative conclusions as though they were settled fact, and that misplaced certainty is what spread.',
    prompt: 'According to the speaker, what was the real problem?', options: ['Others treated tentative findings as certain.', 'The original study used poor methods.', 'The study was never published.', 'Later research disproved the study.'], answer: 'Others treated tentative findings as certain.',
  },
];
