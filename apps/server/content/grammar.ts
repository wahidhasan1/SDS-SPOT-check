// Original grammar lessons. Exercises: mcq (options, answers[0] correct) or gap (answers = accepted forms).
export interface GrammarExerciseSeed {
  kind: 'mcq' | 'gap';
  prompt: string;
  options?: string[];
  answers: string[];
  explanation: string;
}
export interface GrammarLessonSeed {
  slug: string;
  title: string;
  cefr: string;
  topic: string;
  summary: string;
  body: string; // simple markdown: paragraphs, "- " bullets, **bold**
  examples: { sentence: string; note: string }[];
  exercises: GrammarExerciseSeed[];
}

export const GRAMMAR: GrammarLessonSeed[] = [
  {
    slug: 'present-simple-vs-continuous',
    title: 'Present simple vs present continuous',
    cefr: 'A2',
    topic: 'Tenses',
    summary: 'Habits and facts vs actions happening now.',
    body: `Use the **present simple** for habits, routines, facts and permanent situations.
- I **work** in a bank. Water **boils** at 100°C.
Use the **present continuous** (am/is/are + -ing) for actions happening now or around now, and temporary situations.
- I**'m working** from home this week. Look — it**'s raining**.
**State verbs** (know, like, want, believe, own, need) are usually not used in the continuous form.
- I **know** the answer. (NOT I'm knowing)`,
    examples: [
      { sentence: 'She usually takes the bus, but today she is walking.', note: 'routine vs. today only' },
      { sentence: 'I don’t understand this question.', note: 'state verb: simple form' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'Every morning she ___ coffee before work.', options: ['drinks', 'is drinking', 'drink', 'drinking'], answers: ['drinks'], explanation: '“Every morning” shows a routine → present simple, with -s for she.' },
      { kind: 'mcq', prompt: 'Be quiet, please! The baby ___.', options: ['is sleeping', 'sleeps', 'sleep', 'slept'], answers: ['is sleeping'], explanation: 'The action is happening now → present continuous.' },
      { kind: 'mcq', prompt: 'I ___ what you mean.', options: ['understand', 'am understanding', 'understanding', 'am understand'], answers: ['understand'], explanation: '“Understand” is a state verb, so we use the simple form.' },
      { kind: 'mcq', prompt: 'This month Ali ___ at his uncle’s house while his flat is repaired.', options: ['is staying', 'stays', 'stay', 'has stay'], answers: ['is staying'], explanation: 'A temporary situation → present continuous.' },
      { kind: 'gap', prompt: 'Water ___ (freeze) at 0 degrees Celsius.', answers: ['freezes'], explanation: 'A scientific fact → present simple.' },
      { kind: 'gap', prompt: 'Why ___ you ___ (laugh)? Write both words: "are laughing".', answers: ['are laughing'], explanation: 'Happening now → are + laughing.' },
    ],
  },
  {
    slug: 'past-simple-vs-present-perfect',
    title: 'Past simple vs present perfect',
    cefr: 'B1',
    topic: 'Tenses',
    summary: 'Finished time vs. connection to now.',
    body: `Use the **past simple** for finished actions at a finished time (yesterday, in 2019, last week, ago).
- I **visited** Rome **in 2019**.
Use the **present perfect** (have/has + past participle) when the time is not stated or is unfinished (today, this year, ever, never, yet, already, since, for), or when the result matters now.
- I**'ve visited** Rome twice. She**'s lost** her keys (so she can't get in).
Do NOT use the present perfect with a finished time expression.
- ✗ I have seen him yesterday. ✓ I saw him yesterday.`,
    examples: [
      { sentence: 'Have you ever tried sushi? — Yes, I tried it last summer.', note: 'experience (present perfect) → specific time (past simple)' },
      { sentence: 'I have lived here since 2015.', note: 'unfinished period with since' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'We ___ the film last night.', options: ['watched', 'have watched', 'watch', 'have watch'], answers: ['watched'], explanation: '“Last night” is a finished time → past simple.' },
      { kind: 'mcq', prompt: 'I ___ my homework yet.', options: ["haven't finished", "didn't finish", "don't finish", "hasn't finished"], answers: ["haven't finished"], explanation: '“Yet” is used with the present perfect in negatives and questions.' },
      { kind: 'mcq', prompt: 'She ___ in Paris for three years, and she still lives there.', options: ['has lived', 'lived', 'lives', 'is living'], answers: ['has lived'], explanation: 'Situation started in the past and continues now → present perfect with “for”.' },
      { kind: 'mcq', prompt: 'When ___ you ___ your job?', options: ['did / start', 'have / started', 'do / start', 'have / start'], answers: ['did / start'], explanation: 'Questions with “when” ask about a finished time → past simple.' },
      { kind: 'gap', prompt: 'Shakespeare ___ (write) more than thirty plays.', answers: ['wrote'], explanation: 'Shakespeare is dead, so his life is a finished period → past simple.' },
      { kind: 'gap', prompt: 'Oh no! I ___ (break) my glasses. (Use the contraction or full form: “have broken”)', answers: ["have broken", "'ve broken", 've broken'], explanation: 'Recent action with a present result → present perfect.' },
    ],
  },
  {
    slug: 'articles',
    title: 'Articles: a, an, the and no article',
    cefr: 'B1',
    topic: 'Nouns',
    summary: 'Choosing the right article.',
    body: `Use **a/an** with singular countable nouns when you mention something for the first time or it is one of many. **an** comes before a vowel *sound*: an hour, a university.
Use **the** when both speaker and listener know which one: it was mentioned before, it is unique, or it is specified.
- I bought **a** laptop. **The** laptop is very light.
- **The** sun, **the** internet, **the** best student.
Use **no article** for general plural or uncountable nouns.
- **Children** need sleep. **Information** is power.`,
    examples: [
      { sentence: 'She is an engineer at a university in the north.', note: 'an + vowel sound, a + /j/ sound, the + specific region' },
      { sentence: 'Life in big cities can be expensive.', note: 'general ideas: no article' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'It took ___ hour to get there.', options: ['an', 'a', 'the', '—'], answers: ['an'], explanation: '“Hour” starts with a vowel sound (/aʊə/).' },
      { kind: 'mcq', prompt: '___ honesty is important in a relationship.', options: ['—', 'The', 'A', 'An'], answers: ['—'], explanation: 'General uncountable noun → no article.' },
      { kind: 'mcq', prompt: 'Is there ___ bank near here?', options: ['a', 'the', 'an', '—'], answers: ['a'], explanation: 'Any bank, mentioned for the first time → a.' },
      { kind: 'mcq', prompt: 'Mount Everest is ___ highest mountain in the world.', options: ['the', 'a', 'an', '—'], answers: ['the'], explanation: 'Superlatives take “the”.' },
      { kind: 'mcq', prompt: 'She studied at ___ university in Canada.', options: ['a', 'an', 'the', '—'], answers: ['a'], explanation: '“University” begins with a /j/ sound, so we use “a”.' },
      { kind: 'gap', prompt: 'I saw a dog and a cat. ___ dog was chasing the cat. (one word)', answers: ['the'], explanation: 'Second mention → the.' },
    ],
  },
  {
    slug: 'first-second-conditionals',
    title: 'First and second conditionals',
    cefr: 'B1',
    topic: 'Conditionals',
    summary: 'Real vs. imaginary situations.',
    body: `**First conditional** — real or likely future situations: *if* + present simple, *will* + verb.
- If it **rains**, we**'ll stay** at home.
**Second conditional** — imaginary or unlikely situations now or in the future: *if* + past simple, *would* + verb.
- If I **had** more time, I **would learn** the guitar.
- If I **were** you, I'd apply for the job. (*were* is used for all persons in formal English)
Do not use *will* or *would* in the *if* clause.`,
    examples: [
      { sentence: 'If you study every day, you will improve quickly.', note: 'likely' },
      { sentence: 'If I won the lottery, I would travel the world.', note: 'imaginary' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'If I ___ rich, I would buy a house by the sea.', options: ['were', 'am', 'will be', 'would be'], answers: ['were'], explanation: 'Imaginary present → second conditional: if + past (were).' },
      { kind: 'mcq', prompt: 'If you heat ice, it ___.', options: ['melts', 'would melt', 'melted', 'will melting'], answers: ['melts'], explanation: 'General truth → zero conditional (present + present).' },
      { kind: 'mcq', prompt: 'If she ___ the bus, she will be late.', options: ['misses', 'will miss', 'missed', 'would miss'], answers: ['misses'], explanation: 'First conditional: if + present simple.' },
      { kind: 'mcq', prompt: 'What ___ you do if you lost your passport abroad?', options: ['would', 'will', 'do', 'did'], answers: ['would'], explanation: 'Hypothetical situation → would.' },
      { kind: 'gap', prompt: 'If I ___ (know) his number, I would call him.', answers: ['knew'], explanation: 'Second conditional: if + past simple.' },
      { kind: 'gap', prompt: 'If we leave now, we ___ (catch) the train. (two words)', answers: ['will catch', "'ll catch"], explanation: 'First conditional result: will + verb.' },
    ],
  },
  {
    slug: 'passive-voice',
    title: 'The passive voice',
    cefr: 'B2',
    topic: 'Verb forms',
    summary: 'Focusing on the action, not the doer — essential for IELTS Task 1 processes.',
    body: `Form the passive with **be + past participle**. The tense is shown by *be*.
- Present: Paper **is made** from wood.
- Past: The bridge **was built** in 1890.
- Present perfect: Thousands of trees **have been planted**.
- Modal: The form **must be signed**.
Use the passive when the doer is unknown, obvious or unimportant — and in **process descriptions** (IELTS Academic Task 1).
- First, the beans **are harvested**. Then they **are dried** in the sun.
Add the doer with **by** only if it is useful information.`,
    examples: [
      { sentence: 'The results will be published next month.', note: 'future passive' },
      { sentence: 'After the grapes are crushed, the juice is stored in barrels.', note: 'process description' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'The new library ___ next year.', options: ['will be opened', 'will open by', 'is opening by', 'opens by'], answers: ['will be opened'], explanation: 'Future passive: will be + past participle.' },
      { kind: 'mcq', prompt: 'English ___ in many countries.', options: ['is spoken', 'speaks', 'is speaking', 'spoken'], answers: ['is spoken'], explanation: 'Present simple passive.' },
      { kind: 'mcq', prompt: 'The thief ___ by the police yesterday.', options: ['was caught', 'caught', 'is caught', 'has caught'], answers: ['was caught'], explanation: 'Past simple passive (yesterday).' },
      { kind: 'mcq', prompt: 'In the next stage, the clay ___ into bricks.', options: ['is shaped', 'shapes', 'shaped', 'is shaping'], answers: ['is shaped'], explanation: 'Process description → present simple passive.' },
      { kind: 'gap', prompt: 'My car ___ (steal) last night. (two words)', answers: ['was stolen'], explanation: 'Past passive: was + stolen.' },
      { kind: 'gap', prompt: 'All applications must ___ (submit) by Friday. (two words)', answers: ['be submitted'], explanation: 'Modal passive: must be + past participle.' },
    ],
  },
  {
    slug: 'relative-clauses',
    title: 'Relative clauses',
    cefr: 'B2',
    topic: 'Complex sentences',
    summary: 'who, which, that, whose, where — and when to use commas.',
    body: `Relative clauses give more information about a noun.
- **who** for people, **which** for things, **that** for people or things (defining clauses only), **whose** for possession, **where** for places, **when** for times.
**Defining** clauses identify which one (no commas): The student **who sits next to me** is from Brazil.
**Non-defining** clauses add extra information (with commas, never *that*): My brother, **who lives in Oslo**, is a doctor.
You can omit the relative pronoun when it is the object of a defining clause: The book (that) I'm reading is great.`,
    examples: [
      { sentence: 'Students whose parents speak English at home often progress faster.', note: 'whose = possession' },
      { sentence: 'Tokyo, which has over 13 million residents, is very safe.', note: 'non-defining: commas + which' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'The woman ___ car was stolen called the police.', options: ['whose', 'who', 'which', 'that'], answers: ['whose'], explanation: 'Possession → whose.' },
      { kind: 'mcq', prompt: 'Paris, ___ is the capital of France, attracts millions of tourists.', options: ['which', 'that', 'where', 'who'], answers: ['which'], explanation: 'Non-defining clause about a thing → which (never “that” after a comma).' },
      { kind: 'mcq', prompt: 'This is the café ___ we first met.', options: ['where', 'which', 'who', 'whose'], answers: ['where'], explanation: 'Place → where.' },
      { kind: 'mcq', prompt: 'People ___ exercise regularly tend to sleep better.', options: ['who', 'which', 'whose', 'where'], answers: ['who'], explanation: 'People → who (or that).' },
      { kind: 'gap', prompt: 'I still remember the day ___ I passed my driving test. (one word)', answers: ['when', 'that'], explanation: 'Time → when (that is also possible).' },
      { kind: 'mcq', prompt: 'Which sentence is correct?', options: ['My sister, who is a nurse, works nights.', 'My sister, that is a nurse, works nights.', 'My sister who is a nurse, works nights.', 'My sister, which is a nurse, works nights.'], answers: ['My sister, who is a nurse, works nights.'], explanation: 'Non-defining clause about a person needs commas and “who”.' },
    ],
  },
  {
    slug: 'comparatives-superlatives',
    title: 'Comparatives and superlatives',
    cefr: 'A2',
    topic: 'Adjectives',
    summary: 'Comparing things — and describing data in IELTS Task 1.',
    body: `Short adjectives: add **-er / -est** (cheap → cheaper → the cheapest). Double the final consonant after a short vowel (big → bigger).
Long adjectives: use **more / the most** (expensive → more expensive → the most expensive).
Irregular: good → better → the best; bad → worse → the worst; far → further → the furthest.
Useful patterns for data:
- **twice as high as**, **much/slightly higher than**, **not as popular as**
- **the second largest** proportion`,
    examples: [
      { sentence: 'Rail travel was slightly more popular than air travel in 2020.', note: 'modifier + comparative' },
      { sentence: 'Spending on rent was twice as high as spending on food.', note: 'as … as with multiplier' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'This is ___ book I have ever read.', options: ['the best', 'the better', 'the most good', 'best'], answers: ['the best'], explanation: '“Good” has the irregular superlative “the best”.' },
      { kind: 'mcq', prompt: 'Trains are ___ than buses.', options: ['faster', 'more fast', 'fastest', 'the faster'], answers: ['faster'], explanation: 'One-syllable adjective → -er.' },
      { kind: 'mcq', prompt: 'Her new job is ___ than the old one.', options: ['more interesting', 'interestinger', 'most interesting', 'the more interesting'], answers: ['more interesting'], explanation: 'Long adjective → more + adjective.' },
      { kind: 'mcq', prompt: 'Sales in June were ___ as sales in May.', options: ['twice as high', 'twice higher', 'two times as higher', 'twice more high'], answers: ['twice as high'], explanation: 'Pattern: twice as + adjective + as.' },
      { kind: 'gap', prompt: 'Yesterday was the ___ (hot) day of the year.', answers: ['hottest'], explanation: 'Short vowel + one consonant → double it: hottest.' },
      { kind: 'gap', prompt: 'My cold is getting ___ (bad), not better.', answers: ['worse'], explanation: 'Irregular comparative: bad → worse.' },
    ],
  },
  {
    slug: 'modal-verbs-advice-obligation',
    title: 'Modals for advice, obligation and possibility',
    cefr: 'B1',
    topic: 'Modal verbs',
    summary: 'must, have to, should, might, could — and their negatives.',
    body: `**must / have to** = obligation. **don't have to** = no obligation. **mustn't** = prohibition.
- You **don't have to** come (it's optional). You **mustn't** smoke here (it's forbidden).
**should / ought to** = advice: You **should** practise speaking every day.
**might / may / could** = possibility: It **might** rain later.
After a modal, use the base verb without *to*: She **can swim** (NOT can to swim).`,
    examples: [
      { sentence: 'Governments should invest more in public transport.', note: 'opinion/advice — common in IELTS Task 2' },
      { sentence: 'Students don’t have to wear a uniform.', note: 'no obligation' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'You ___ touch that wire — it’s dangerous!', options: ["mustn't", "don't have to", "needn't", "shouldn't to"], answers: ["mustn't"], explanation: 'Prohibition → mustn’t.' },
      { kind: 'mcq', prompt: 'It’s Sunday, so I ___ get up early.', options: ["don't have to", "mustn't", "can't", "should"], answers: ["don't have to"], explanation: 'No obligation → don’t have to.' },
      { kind: 'mcq', prompt: 'You look tired. You ___ go to bed earlier.', options: ['should', 'must to', 'have', 'might to'], answers: ['should'], explanation: 'Advice → should.' },
      { kind: 'mcq', prompt: 'Take an umbrella. It ___ rain this afternoon.', options: ['might', 'must', 'should to', 'has to'], answers: ['might'], explanation: 'Possibility → might.' },
      { kind: 'mcq', prompt: 'Which is correct?', options: ['She can speak three languages.', 'She can to speak three languages.', 'She cans speak three languages.', 'She can speaking three languages.'], answers: ['She can speak three languages.'], explanation: 'Modal + base verb, no -s, no “to”.' },
      { kind: 'gap', prompt: 'In many countries, drivers ___ (obligation) wear seat belts. (two words: have …)', answers: ['have to'], explanation: 'External obligation → have to.' },
    ],
  },
  {
    slug: 'linking-words-cohesion',
    title: 'Linking words for coherence',
    cefr: 'B2',
    topic: 'Writing skills',
    summary: 'Contrast, addition, cause and result — used accurately.',
    body: `Good linking improves *Coherence and Cohesion* in IELTS writing — but only when used accurately and not mechanically.
- **Contrast**: however, nevertheless, although, whereas, despite + noun/-ing
- **Addition**: moreover, furthermore, in addition, as well as
- **Cause/result**: because (of), due to + noun, therefore, as a result, consequently
- **Example**: for example, for instance, such as
Punctuation matters: *However*, at the start of a sentence takes a comma. *Although* joins two clauses in one sentence.
- **Although** it was cold, we went out. / It was cold. **However**, we went out.
- **Despite** the cold, we went out. (NOT despite it was cold)`,
    examples: [
      { sentence: 'Despite rising costs, more students are studying abroad.', note: 'despite + noun' },
      { sentence: 'Urban areas grew rapidly, whereas rural populations declined.', note: 'whereas for contrasting two facts' },
    ],
    exercises: [
      { kind: 'mcq', prompt: '___ the heavy rain, the match continued.', options: ['Despite', 'Although', 'However', 'Because'], answers: ['Despite'], explanation: '“Despite” + noun phrase.' },
      { kind: 'mcq', prompt: 'The flight was delayed ___ bad weather.', options: ['due to', 'because', 'therefore', 'although'], answers: ['due to'], explanation: '“Due to” + noun; “because” needs a clause.' },
      { kind: 'mcq', prompt: 'Prices rose sharply. ___, demand stayed high.', options: ['Nevertheless', 'Because', 'Despite', 'Whereas'], answers: ['Nevertheless'], explanation: 'Contrast between sentences → Nevertheless/However.' },
      { kind: 'mcq', prompt: 'The project was underfunded. ___, it was never completed.', options: ['As a result', 'Although', 'Despite', 'For instance'], answers: ['As a result'], explanation: 'Result → As a result / Therefore.' },
      { kind: 'mcq', prompt: '___ she was exhausted, she finished the report.', options: ['Although', 'Despite', 'However', 'In spite'], answers: ['Although'], explanation: '“Although” + clause.' },
      { kind: 'mcq', prompt: 'Some people prefer cities, ___ others prefer the countryside.', options: ['whereas', 'despite', 'moreover', 'because of'], answers: ['whereas'], explanation: '“Whereas” contrasts two facts in one sentence.' },
    ],
  },
  {
    slug: 'countable-uncountable',
    title: 'Countable and uncountable nouns',
    cefr: 'A2',
    topic: 'Nouns',
    summary: 'much/many, few/little, and common uncountable nouns.',
    body: `**Countable** nouns have plurals (a book → books). **Uncountable** nouns do not (information, advice, furniture, equipment, research, news, traffic, homework).
- **many / a few / fewer** + countable: many books, a few chairs
- **much / a little / less** + uncountable: much advice, a little time
- **a lot of / some / any** work with both.
To count uncountables, use units: **a piece of** advice, **an item of** news.`,
    examples: [
      { sentence: 'Can you give me some advice?', note: 'NOT advices' },
      { sentence: 'There were fewer cars and less traffic in 2020.', note: 'fewer + countable, less + uncountable' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'How ___ money do you need?', options: ['much', 'many', 'few', 'a few'], answers: ['much'], explanation: 'Money is uncountable → much.' },
      { kind: 'mcq', prompt: 'I have ___ questions about the course.', options: ['a few', 'a little', 'much', 'less'], answers: ['a few'], explanation: 'Questions are countable → a few.' },
      { kind: 'mcq', prompt: 'She gave me some useful ___.', options: ['information', 'informations', 'an information', 'information’s'], answers: ['information'], explanation: '“Information” is uncountable.' },
      { kind: 'mcq', prompt: 'There is ___ traffic today than yesterday.', options: ['less', 'fewer', 'many', 'few'], answers: ['less'], explanation: 'Traffic is uncountable → less.' },
      { kind: 'gap', prompt: 'Can you carry this piece of ___ (equipment)? (one word)', answers: ['equipment'], explanation: '“Equipment” has no plural form.' },
      { kind: 'mcq', prompt: 'We bought new ___ for the living room.', options: ['furniture', 'furnitures', 'a furniture', 'furniture pieces of'], answers: ['furniture'], explanation: '“Furniture” is uncountable.' },
    ],
  },
  {
    slug: 'reported-speech',
    title: 'Reported speech',
    cefr: 'B2',
    topic: 'Verb forms',
    summary: 'Reporting statements and questions.',
    body: `When the reporting verb is in the past (said, told, asked), the tense usually moves back:
- “I **am** tired.” → She said (that) she **was** tired.
- “We **will** call you.” → They said they **would** call me.
- “I **have finished**.” → He said he **had finished**.
**say** something; **tell** someone something.
Reported questions use statement word order and no question mark:
- “Where **do you live**?” → She asked me where **I lived**.
- “Are you ready?” → He asked **if/whether** I was ready.`,
    examples: [
      { sentence: 'The interviewer asked what my greatest strength was.', note: 'statement word order' },
      { sentence: 'My teacher told me to practise every day.', note: 'tell + object + to-infinitive for instructions' },
    ],
    exercises: [
      { kind: 'mcq', prompt: '“I like jazz,” he said. → He said that he ___ jazz.', options: ['liked', 'likes', 'has liked', 'is liking'], answers: ['liked'], explanation: 'Present simple → past simple.' },
      { kind: 'mcq', prompt: 'She ___ me that the meeting was cancelled.', options: ['told', 'said', 'asked', 'spoke'], answers: ['told'], explanation: 'tell + person.' },
      { kind: 'mcq', prompt: '“Where is the station?” → She asked me where ___.', options: ['the station was', 'was the station', 'is the station', 'the station is?'], answers: ['the station was'], explanation: 'Reported questions use statement order and backshift.' },
      { kind: 'mcq', prompt: '“Will you help me?” → He asked ___ I would help him.', options: ['if', 'that', 'what', 'did'], answers: ['if'], explanation: 'Yes/no questions → if or whether.' },
      { kind: 'gap', prompt: '“I have lost my wallet.” → She said she ___ her wallet. (two words)', answers: ['had lost'], explanation: 'Present perfect → past perfect.' },
      { kind: 'mcq', prompt: '“Don’t be late,” the manager said. → The manager told us ___ late.', options: ['not to be', 'to not being', "don't be", 'not be'], answers: ['not to be'], explanation: 'Negative instruction → tell + object + not to + verb.' },
    ],
  },
  {
    slug: 'third-mixed-conditionals',
    title: 'Third and mixed conditionals',
    cefr: 'C1',
    topic: 'Conditionals',
    summary: 'Talking about past regrets and imaginary past results.',
    body: `**Third conditional** — imaginary past: *if* + past perfect, *would have* + past participle.
- If I **had studied** harder, I **would have passed**.
**Mixed conditional** — imaginary past with a present result: *if* + past perfect, *would* + verb.
- If I **had taken** that job, I **would be** rich now.
Or a present situation with a past result: If I **spoke** French, I **would have understood** the film.
Inversion (formal): **Had** I known, I would have helped.`,
    examples: [
      { sentence: 'Had the government acted sooner, the crisis could have been avoided.', note: 'formal inversion — impressive in IELTS writing when accurate' },
      { sentence: 'If she hadn’t moved abroad, she wouldn’t speak English so well now.', note: 'mixed: past cause, present result' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'If we ___ earlier, we wouldn’t have missed the flight.', options: ['had left', 'left', 'would leave', 'have left'], answers: ['had left'], explanation: 'Third conditional: if + past perfect.' },
      { kind: 'mcq', prompt: 'If I had saved more money last year, I ___ a car now.', options: ['would have', 'would have had', 'will have', 'had'], answers: ['would have'], explanation: 'Mixed: past condition → present result (would + verb).' },
      { kind: 'mcq', prompt: '___ I known about the problem, I would have fixed it.', options: ['Had', 'If', 'Have', 'Would'], answers: ['Had'], explanation: 'Inverted third conditional: Had + subject + past participle.' },
      { kind: 'mcq', prompt: 'She would have won if she ___ so nervous.', options: ["hadn't been", "wasn't", "wouldn't be", "hasn't been"], answers: ["hadn't been"], explanation: 'Third conditional: past perfect in the if-clause.' },
      { kind: 'gap', prompt: 'If they had invested wisely, they ___ (not / lose) so much money. (three words)', answers: ["wouldn't have lost", 'would not have lost'], explanation: 'Third conditional result: would not have + past participle.' },
      { kind: 'mcq', prompt: 'If I were taller, I ___ for the basketball team last year.', options: ['would have been chosen', 'would be chosen', 'had been chosen', 'will be chosen'], answers: ['would have been chosen'], explanation: 'Mixed: present state → past result.' },
    ],
  },
];
