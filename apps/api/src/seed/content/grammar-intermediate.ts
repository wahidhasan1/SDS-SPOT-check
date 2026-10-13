import type { SeedLesson } from './types';

export const intermediateLessons: SeedLesson[] = [
  {
    slug: 'present-perfect',
    title: 'Present perfect vs past simple',
    track: 'grammar',
    pathLevel: 'intermediate',
    cefrLevel: 'B1',
    category: 'tenses',
    summary: 'Use the present perfect for experiences, changes and unfinished time periods — and know when the past simple is required.',
    body: `The **present perfect** (*have/has + past participle*) connects the past with the present.

## Use the present perfect for
- **life experiences** (no specific time): *I **have visited** Japan twice.*
- **changes and results now**: *The city **has changed** a lot. I**'ve lost** my keys* (I don't have them now).
- **unfinished time periods**: *She **has worked** here **for** six years / **since** 2019.* (She still works here.)
- with **just, already, yet, ever, never, recently, so far**: *Have you **ever** tried sushi? I haven't finished **yet**.*

## Use the past simple for
- a **finished time** in the past: *I **visited** Japan **in 2019** / **last year** / **two weeks ago**.*
- a question with **when**: ***When did** you **arrive**?* (not ~~When have you arrived?~~)

## Compare
- *I **have lived** in Cairo for five years.* → I still live there.
- *I **lived** in Cairo for five years.* → I don't live there now.

## Present perfect continuous
*have/has been + -ing* emphasises duration of an activity that continues to now: *I**'ve been studying** for three hours.* Stative verbs (*know, like, own, believe*) are not normally continuous: *I've **known** her for years.*

## IELTS tip
In Writing Task 1, use the present perfect only when the data reaches the present (e.g. "*has risen since 2000*"). For charts about the past (e.g. 1990–2010), use the **past simple**.`,
    examples: [
      { text: 'Have you ever been to Australia?', note: 'experience' },
      { text: 'Unemployment has fallen since 2015.', note: 'change up to now' },
      { text: 'I have seen that film last week.', correct: false, note: 'Finished time (last week) needs the past simple.' },
      { text: 'I saw that film last week.', correct: true },
      { text: 'She has been learning Korean for two years.', note: 'present perfect continuous for duration' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'I ___ my passport. I can’t find it anywhere.', options: ['lost', 'have lost', 'am losing', 'had lost'], answers: ['have lost'], explanation: 'The result is important now (I can’t find it), so we use the present perfect.' },
      { type: 'mcq', prompt: 'We ___ to Spain in 2021.', options: ['have gone', 'went', 'have been', 'go'], answers: ['went'], explanation: '"In 2021" is a finished time, so the past simple is required.' },
      { type: 'mcq', prompt: 'She has lived in this flat ___ 2017.', options: ['for', 'since', 'during', 'ago'], answers: ['since'], explanation: '2017 is a starting point, so we use "since".' },
      { type: 'mcq', prompt: '___ you finished the report yet?', options: ['Did', 'Have', 'Do', 'Are'], answers: ['Have'], explanation: '"Yet" is used with the present perfect: Have you finished…yet?' },
      { type: 'mcq', prompt: 'When ___ you start learning English?', options: ['have', 'did', 'has', 'do'], answers: ['did'], explanation: 'Questions with "when" about a past moment use the past simple.' },
      { type: 'fill', prompt: 'Complete with the present perfect: "They ___ (never / see) snow."', answers: ['have never seen', "'ve never seen"], explanation: 'Present perfect with "never" for life experience: have never seen.' },
      { type: 'fill', prompt: 'Complete: "I’m tired. I ___ (work) all day." (present perfect continuous)', answers: ['have been working', "'ve been working"], explanation: 'Present perfect continuous emphasises the duration of an activity up to now.' },
      { type: 'mcq', prompt: 'Which sentence is correct for a chart showing data from 1990 to 2000?', options: ['Sales have increased between 1990 and 2000.', 'Sales increased between 1990 and 2000.', 'Sales are increasing between 1990 and 2000.', 'Sales has increased between 1990 and 2000.'], answers: ['Sales increased between 1990 and 2000.'], explanation: 'The period is finished, so use the past simple.' },
    ],
  },
  {
    slug: 'continuous-tenses',
    title: 'Present and past continuous',
    track: 'grammar',
    pathLevel: 'intermediate',
    cefrLevel: 'B1',
    category: 'tenses',
    summary: 'Describe actions in progress, temporary situations and background events, and learn which verbs are not used in continuous forms.',
    body: `## Present continuous (am/is/are + -ing)
- actions happening **now**: *She **is talking** on the phone.*
- **temporary** situations: *I**'m staying** with friends this week.*
- **changing trends**: *Prices **are rising**.*
- **future arrangements**: *We**'re meeting** the client on Friday.*

Compare with the present simple: *I **work** in a bank* (permanent) / *I**'m working** from home this month* (temporary).

## Past continuous (was/were + -ing)
- an action **in progress** at a past moment: *At 8 pm I **was cooking** dinner.*
- the **background** of a story, interrupted by a shorter past simple action: *I **was walking** home **when** it **started** to rain.*
- two actions in progress at the same time: ***While** he **was reading**, she **was watching** TV.*

## Stative verbs
Verbs describing states rather than actions are normally **not** used in continuous forms:
- thinking: *know, believe, understand, remember, mean*
- feelings: *like, love, hate, prefer, want, need*
- possession and senses: *have (= own), own, belong, seem, hear, smell*
*I **know** the answer* (not ~~I am knowing~~). But some have an action meaning: *I'm **having** lunch* (= eating), *I'm **thinking** about it* (= considering).`,
    examples: [
      { text: 'Look! It’s snowing.', note: 'happening now' },
      { text: 'More people are working from home these days.', note: 'changing trend' },
      { text: 'I was having a shower when the phone rang.', note: 'interrupted action' },
      { text: 'I am wanting a new bike.', correct: false, note: '"Want" is stative.' },
      { text: 'I want a new bike.', correct: true },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Be quiet! The baby ___.', options: ['sleeps', 'is sleeping', 'slept', 'has slept'], answers: ['is sleeping'], explanation: 'The action is happening now, so we use the present continuous.' },
      { type: 'mcq', prompt: 'While I ___ dinner, the lights went out.', options: ['cooked', 'was cooking', 'am cooking', 'cook'], answers: ['was cooking'], explanation: 'Past continuous for the longer background action interrupted by "went out".' },
      { type: 'mcq', prompt: 'This soup ___ delicious.', options: ['is tasting', 'tastes', 'tasting', 'was tasting'], answers: ['tastes'], explanation: '"Taste" describing a quality is stative, so use the present simple.' },
      { type: 'mcq', prompt: 'We ___ our grandparents next weekend. It’s all arranged.', options: ['visit', 'are visiting', 'visited', 'were visiting'], answers: ['are visiting'], explanation: 'Present continuous for fixed future arrangements.' },
      { type: 'fill', prompt: 'Complete: "What ___ you doing at 10 pm last night?" (be)', answers: ['were'], explanation: 'Past continuous question with "you": were you doing.' },
      { type: 'mcq', prompt: 'I ___ what you mean.', options: ['am understanding', 'understand', 'understanding', 'was understanding'], answers: ['understand'], explanation: '"Understand" is a stative verb.' },
      { type: 'fill', prompt: 'Complete: "The population of the city ___ (grow) rapidly at the moment."', answers: ['is growing'], explanation: 'A changing trend now: present continuous.' },
    ],
  },
  {
    slug: 'future-forms',
    title: 'Talking about the future',
    track: 'grammar',
    pathLevel: 'intermediate',
    cefrLevel: 'B1',
    category: 'tenses',
    summary: 'Choose between will, be going to, the present continuous and the present simple to talk about predictions, plans and schedules.',
    body: `English has no single future tense. We choose a form depending on what we mean.

## will + base verb
- **predictions** based on opinion: *I think it **will** rain tomorrow.*
- **instant decisions**: *The phone's ringing — I**'ll** get it.*
- **offers and promises**: *I**'ll** help you with your bags. I **won't** tell anyone.*

## be going to + base verb
- **plans and intentions** (decided before speaking): *I**'m going to** apply for a master's degree.*
- **predictions with present evidence**: *Look at those clouds — it**'s going to** rain.*

## Present continuous
**Fixed arrangements** with other people or a time and place: *I**'m seeing** the dentist at 4.*

## Present simple
**Timetables and schedules**: *The flight **leaves** at 06:40. The course **starts** next Monday.*

## Future continuous and future perfect
- *This time tomorrow I**'ll be flying** to Seoul.* (in progress at a future time)
- *By 2030, the city **will have built** a new metro line.* (completed before a future time)

## Time clauses
After *when, as soon as, before, after, until, if* use a **present** tense for the future: *I'll call you **when** I **arrive*** (not ~~when I will arrive~~).`,
    examples: [
      { text: 'I’m going to start a new job in September.', note: 'plan' },
      { text: 'Don’t worry, I’ll lend you some money.', note: 'offer' },
      { text: 'By the end of the year, I will have saved $2,000.', note: 'future perfect' },
      { text: 'I’ll text you when I will get home.', correct: false, note: 'Use the present after "when" in future time clauses.' },
      { text: 'I’ll text you when I get home.', correct: true },
    ],
    exercises: [
      { type: 'mcq', prompt: '“I’m thirsty.” “I ___ get you a glass of water.”', options: ['am going to', "'ll", 'am getting', 'get'], answers: ["'ll"], explanation: 'An instant decision/offer uses "will".' },
      { type: 'mcq', prompt: 'Be careful! You ___ drop those plates!', options: ["'ll", "'re going to", 'drop', "'re dropping"], answers: ["'re going to"], explanation: 'A prediction based on present evidence uses "be going to".' },
      { type: 'mcq', prompt: 'The train ___ at 9:15 tomorrow morning.', options: ['leaves', 'will be leaving', 'is going to leave', 'left'], answers: ['leaves'], explanation: 'Timetables use the present simple.' },
      { type: 'mcq', prompt: 'I’ll phone you as soon as I ___ the results.', options: ['will get', 'get', 'am going to get', 'got'], answers: ['get'], explanation: 'After "as soon as" we use a present tense for the future.' },
      { type: 'mcq', prompt: 'By 2040, scientists ___ a cure for this disease.', options: ['will find', 'will have found', 'are finding', 'find'], answers: ['will have found'], explanation: '"By + future time" for a completed action uses the future perfect.' },
      { type: 'fill', prompt: 'Complete with "be going to": "We bought the paint yesterday. We ___ paint the kitchen this weekend."', answers: ['are going to', "'re going to"], explanation: 'A plan decided before speaking uses "be going to": we are going to paint.' },
      { type: 'fill', prompt: 'Complete: "This time next week, I ___ (lie) on a beach." (future continuous: will be + -ing)', answers: ['will be lying', "'ll be lying"], explanation: 'An action in progress at a future moment: will be lying.' },
    ],
  },
  {
    slug: 'comparatives-superlatives',
    title: 'Comparatives and superlatives',
    track: 'grammar',
    pathLevel: 'intermediate',
    cefrLevel: 'B1',
    category: 'adjectives-adverbs',
    summary: 'Compare things accurately with -er/-est, more/most, as…as, and modifiers like much, slightly and significantly — essential for IELTS Task 1.',
    body: `## Forming comparatives and superlatives
- **one syllable**: add *-er / -est*: *cheap → cheaper → the cheapest*. Double final consonant: *big → bigger*.
- **two syllables ending in -y**: *-ier / -iest*: *easy → easier → the easiest*.
- **two or more syllables**: *more / the most*: *expensive → more expensive → the most expensive*.
- **irregular**: *good → better → the best; bad → worse → the worst; far → further → the furthest; little → less → the least; much/many → more → the most*.

## Other comparison structures
- **as + adjective + as** (equal): *Rome is **as busy as** Paris.* / *not as … as* (less): *Train tickets are **not as expensive as** flights.*
- **less / the least**: *This route is **less crowded**.*
- **the + comparative, the + comparative**: ***The more** you practise, **the better** you get.*

## Modifying comparisons (very useful in IELTS Task 1)
- big difference: ***much / far / significantly / considerably** higher*
- small difference: ***slightly / a little / marginally** lower*
- *Coal was **by far the most** important source of energy.*
- multiples: ***twice as** many people as / **three times** higher than*

## Common mistakes
- ~~more cheaper~~ → *cheaper*; ~~the most biggest~~ → *the biggest*.
- *than*, not ~~then~~: *taller **than** me*.`,
    examples: [
      { text: 'Online sales were significantly higher in 2022 than in 2018.' },
      { text: 'Women spent twice as much time on housework as men.' },
      { text: 'This is the more expensive hotel in the city.', correct: false, note: 'For more than two items use the superlative: the most expensive.' },
      { text: 'This is the most expensive hotel in the city.', correct: true },
      { text: 'The longer you wait, the harder it becomes.' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Living in the city is ___ than living in the countryside.', options: ['more expensive', 'expensiver', 'most expensive', 'more expensiver'], answers: ['more expensive'], explanation: 'Long adjectives form the comparative with "more".' },
      { type: 'mcq', prompt: 'That was the ___ film I have ever seen.', options: ['worse', 'baddest', 'worst', 'most bad'], answers: ['worst'], explanation: 'The superlative of "bad" is "the worst".' },
      { type: 'mcq', prompt: 'The number of cyclists was ___ higher in 2020 than in 2010 (a big difference).', options: ['slightly', 'considerably', 'marginally', 'a little'], answers: ['considerably'], explanation: '"Considerably" shows a large difference.' },
      { type: 'mcq', prompt: 'My brother is not as ___ as me.', options: ['tall', 'taller', 'tallest', 'more tall'], answers: ['tall'], explanation: 'The structure is "as + base adjective + as".' },
      { type: 'fill', prompt: 'Complete: "The more you read, the ___ (good) your vocabulary becomes."', answers: ['better'], explanation: '"The + comparative, the + comparative": the better.' },
      { type: 'fill', prompt: 'Complete: "Tokyo is one of the ___ (large) cities in the world."', answers: ['largest'], explanation: 'One of the + superlative: largest.' },
      { type: 'mcq', prompt: 'Choose the correct sentence.', options: ['She is more happier now.', 'She is happier now.', 'She is the happier now.', 'She is more happy than before now then.'], answers: ['She is happier now.'], explanation: 'Do not use "more" with the -er form.' },
    ],
  },
  {
    slug: 'conditionals',
    title: 'Conditionals: zero, first, second and third',
    track: 'grammar',
    pathLevel: 'intermediate',
    cefrLevel: 'B2',
    category: 'clauses',
    summary: 'Talk about real and imaginary situations in the present, future and past using the four main conditional patterns.',
    body: `Conditional sentences have an **if-clause** (the condition) and a **main clause** (the result). Either clause can come first; use a comma when the if-clause is first.

## Zero conditional — general truths
**If + present simple, present simple**
*If you **heat** ice, it **melts**.*

## First conditional — real future possibility
**If + present simple, will + base verb**
*If it **rains** tomorrow, we **will stay** at home.*
(Not ~~If it will rain~~.)

## Second conditional — imaginary or unlikely present/future
**If + past simple, would + base verb**
*If I **had** more time, I **would learn** to play the piano.* (I don't have time.)
*If I **were** you, I **would** accept the offer.* (*were* is preferred for all persons in formal English.)

## Third conditional — imaginary past
**If + past perfect, would have + past participle**
*If she **had studied** harder, she **would have passed** the exam.* (She didn't study, and she failed.)

## Other useful forms
- **unless** = if not: *You won't improve **unless** you practise.*
- **provided that / as long as**: *You can borrow my car **as long as** you drive carefully.*
- Modal verbs in the result: *If you're free, we **could** go out. If I'd known, I **might have** come.*

## Mixed conditionals (advanced)
Past condition → present result: *If I **had taken** that job, I **would be** rich now.*`,
    examples: [
      { text: 'If you mix red and white, you get pink.', note: 'zero conditional' },
      { text: 'If we leave now, we will catch the train.', note: 'first conditional' },
      { text: 'If I won the lottery, I would travel around the world.', note: 'second conditional' },
      { text: 'If I would have known, I would have helped.', correct: false, note: 'Do not use would in the if-clause.' },
      { text: 'If I had known, I would have helped.', correct: true, note: 'third conditional' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'If it ___ sunny tomorrow, we’ll have a picnic.', options: ['will be', 'is', 'would be', 'was'], answers: ['is'], explanation: 'First conditional: if + present simple.' },
      { type: 'mcq', prompt: 'If I ___ you, I would talk to the manager.', options: ['am', 'were', 'will be', 'had been'], answers: ['were'], explanation: 'Second conditional advice: If I were you…' },
      { type: 'mcq', prompt: 'If they had left earlier, they ___ the flight.', options: ['would catch', 'will catch', "wouldn't have missed", "didn't miss"], answers: ["wouldn't have missed"], explanation: 'Third conditional: would have + past participle.' },
      { type: 'mcq', prompt: 'If you heat water to 100°C, it ___.', options: ['boils', 'would boil', 'will have boiled', 'boiled'], answers: ['boils'], explanation: 'Zero conditional for scientific facts: present + present.' },
      { type: 'mcq', prompt: 'You won’t pass ___ you study.', options: ['if', 'unless', 'provided', 'when'], answers: ['unless'], explanation: '"Unless" means "if not".' },
      { type: 'fill', prompt: 'Complete (second conditional): "If I ___ (have) a car, I would drive to work."', answers: ['had'], explanation: 'Second conditional: if + past simple.' },
      { type: 'fill', prompt: 'Complete (third conditional): "If she had asked me, I ___ (help) her." (would have + past participle)', answers: ['would have helped', "would've helped", "'d have helped"], explanation: 'Third conditional result: would have helped.' },
      { type: 'mcq', prompt: 'If I had saved more money last year, I ___ able to buy a house now.', options: ['would have been', 'would be', 'will be', 'had been'], answers: ['would be'], explanation: 'Mixed conditional: past condition, present result → would be.' },
    ],
  },
  {
    slug: 'passive-voice',
    title: 'The passive voice',
    track: 'grammar',
    pathLevel: 'intermediate',
    cefrLevel: 'B2',
    category: 'verbs',
    summary: 'Form the passive in all main tenses and use it to focus on actions and results — essential for process diagrams and formal writing.',
    body: `In an **active** sentence the subject does the action. In a **passive** sentence the subject receives the action.
- Active: *Engineers **built** the bridge in 1990.*
- Passive: *The bridge **was built** (by engineers) in 1990.*

## Form: be + past participle
- Present simple: *The rooms **are cleaned** daily.*
- Present continuous: *The road **is being repaired**.*
- Past simple: *The letter **was sent** yesterday.*
- Present perfect: *Two new schools **have been opened**.*
- Future: *The results **will be announced** next week.*
- Modals: *The form **must be signed**. It **can be recycled**.*

## When to use the passive
- when the person doing the action is **unknown, obvious or unimportant**: *My bike **was stolen**.*
- to sound more **formal and objective** (academic writing): *It **is believed** that…*
- to describe **processes** (IELTS Writing Task 1): *First, the grapes **are harvested**. Then they **are crushed** and the juice **is stored** in tanks.*

## By + agent
Only include *by …* when it adds important information: *The novel was written **by Chinua Achebe**.*

## Common mistakes
- Forgetting *be*: ~~The data collected in 2020~~ → *The data **was** collected in 2020.*
- Using the passive with intransitive verbs: ~~The accident was happened~~ → *The accident **happened**.*`,
    examples: [
      { text: 'Millions of smartphones are sold every year.' },
      { text: 'The museum has been renovated recently.' },
      { text: 'After that, the bottles are filled and labelled.', note: 'process description' },
      { text: 'The meeting was took place in Room 4.', correct: false, note: '"Take place" is intransitive and cannot be passive.' },
      { text: 'The meeting took place in Room 4.', correct: true },
    ],
    exercises: [
      { type: 'mcq', prompt: 'English ___ in many countries.', options: ['speaks', 'is spoken', 'is speaking', 'spoken'], answers: ['is spoken'], explanation: 'Present simple passive: is + past participle.' },
      { type: 'mcq', prompt: 'The new hospital ___ next year.', options: ['will open', 'will be opened', 'is opening by', 'opened'], answers: ['will be opened'], explanation: 'Future passive: will be + past participle (someone will open it).' },
      { type: 'mcq', prompt: 'My car ___ at the moment, so I’m taking the bus.', options: ['is repairing', 'is being repaired', 'has repaired', 'repairs'], answers: ['is being repaired'], explanation: 'Present continuous passive: is being + past participle.' },
      { type: 'mcq', prompt: 'Which verb cannot be used in the passive?', options: ['build', 'happen', 'write', 'collect'], answers: ['happen'], explanation: '"Happen" is intransitive (it has no object), so it cannot be passive.' },
      { type: 'fill', prompt: 'Make it passive: "They have cancelled the flight." → "The flight ___ cancelled."', answers: ['has been'], explanation: 'Present perfect passive: has been + past participle.' },
      { type: 'fill', prompt: 'Process: "Next, the leaves ___ (dry) in the sun." (present simple passive)', answers: ['are dried'], explanation: 'Processes use the present simple passive: are dried.' },
      { type: 'mcq', prompt: 'The application form must ___ in black ink.', options: ['complete', 'be completed', 'completed', 'being completed'], answers: ['be completed'], explanation: 'Modal passive: must be + past participle.' },
    ],
  },
  {
    slug: 'reported-speech',
    title: 'Reported speech',
    track: 'grammar',
    pathLevel: 'intermediate',
    cefrLevel: 'B2',
    category: 'clauses',
    summary: 'Report statements, questions and requests accurately with tense backshift, changes to pronouns and time words, and reporting verbs.',
    body: `When we report what someone said, we usually move the tense **one step back** if the reporting verb is in the past (*said, told, asked*).

## Tense changes (backshift)
- present simple → past simple: *"I **work** here." → She said she **worked** there.*
- present continuous → past continuous: *"I'**m leaving**." → He said he **was leaving**.*
- past simple / present perfect → past perfect: *"I **saw** it." → She said she **had seen** it.*
- will → would, can → could, may → might, must → had to.
If the information is still true, backshift is optional: *He said the Earth **goes/went** round the Sun.*

## Pronouns, places and times
*I → he/she, my → his/her, here → there, today → that day, tomorrow → the next day, yesterday → the day before, now → then, ago → before*.

## Say vs tell
- **say** (something) (to someone): *She **said** (to me) that she was tired.*
- **tell** + person: *She **told me** that she was tired.* (not ~~told that~~, not ~~said me~~)

## Reported questions
Use **statement word order** and no question mark:
- *"Where **do you live**?" → He asked me where **I lived**.*
- Yes/no questions use **if / whether**: *"Are you ready?" → She asked **if I was** ready.*

## Requests and orders
**tell / ask + object + (not) to + infinitive**: *"Please sit down." → He **asked us to sit** down. "Don't be late." → She **told me not to be** late.*

## Reporting verbs
*suggest, recommend, admit, deny, explain, promise, warn, agree, refuse*: *He **admitted** taking the money. She **promised to** call.*`,
    examples: [
      { text: '"I am very busy." → She said she was very busy.' },
      { text: '"Have you finished?" → He asked if I had finished.' },
      { text: '"Don’t touch it." → She told the children not to touch it.' },
      { text: 'He asked me where did I work.', correct: false, note: 'Reported questions use statement word order.' },
      { text: 'He asked me where I worked.', correct: true },
    ],
    exercises: [
      { type: 'mcq', prompt: '"I’m tired." → She said she ___ tired.', options: ['is', 'was', 'has been', 'will be'], answers: ['was'], explanation: 'Present simple moves back to past simple.' },
      { type: 'mcq', prompt: 'He ___ me that the shop was closed.', options: ['said', 'told', 'asked', 'spoke'], answers: ['told'], explanation: '"Tell" is followed directly by the person: told me.' },
      { type: 'mcq', prompt: '"Where is the station?" → She asked me where ___.', options: ['is the station', 'was the station', 'the station was', 'the station is it'], answers: ['the station was'], explanation: 'Reported questions use statement word order with backshift.' },
      { type: 'mcq', prompt: '"Please close the door." → He asked me ___ the door.', options: ['close', 'to close', 'closing', 'that I close'], answers: ['to close'], explanation: 'Requests: ask + object + to-infinitive.' },
      { type: 'mcq', prompt: '"I will call you tomorrow." → She said she would call me ___.', options: ['tomorrow', 'the next day', 'yesterday', 'the day before'], answers: ['the next day'], explanation: '"Tomorrow" usually becomes "the next day" in reported speech.' },
      { type: 'fill', prompt: '"Do you like jazz?" → He asked me ___ I liked jazz.', answers: ['if', 'whether'], explanation: 'Yes/no questions are reported with "if" or "whether".' },
      { type: 'fill', prompt: '"I have lost my keys." → She said she ___ lost her keys.', answers: ['had'], explanation: 'Present perfect moves back to past perfect: had lost.' },
    ],
  },
  {
    slug: 'relative-clauses',
    title: 'Relative clauses',
    track: 'grammar',
    pathLevel: 'intermediate',
    cefrLevel: 'B2',
    category: 'clauses',
    summary: 'Add information about nouns with who, which, that, whose, where and when — and know when to use commas.',
    body: `A **relative clause** gives more information about a noun. It starts with a **relative pronoun**.

## Relative pronouns
- **who** — people: *The woman **who** lives next door is a pilot.*
- **which** — things and animals: *The laptop **which** I bought is fast.*
- **that** — people or things (only in defining clauses): *The book **that** you lent me was great.*
- **whose** — possession: *He's the man **whose** car was stolen.*
- **where** — places: *This is the café **where** we first met.*
- **when** — times: *2010 was the year **when** I graduated.*

## Defining vs non-defining
- **Defining** clauses identify *which* person or thing. No commas. *That* is possible.
  *Students **who** submit late lose marks.* (only those students)
- **Non-defining** clauses add extra information. Use **commas**. *That* is **not** possible.
  *My sister, **who** lives in Oslo, is a nurse.* (I have one sister; the clause is extra)

## Leaving out the pronoun
In defining clauses you can omit *who/which/that* when it is the **object**:
*The film (that) **we watched** was boring.* But not when it is the subject: *The man **who called** you* (not ~~The man called you~~ — that changes the meaning).

## IELTS tip
Relative clauses help you write longer, more complex sentences, which supports your grammatical range score: *Japan, **which** had the highest figure in 2000, saw a sharp fall over the next decade.*`,
    examples: [
      { text: 'The scientist who discovered penicillin was Alexander Fleming.' },
      { text: 'Paris, which is the capital of France, attracts millions of tourists.', note: 'non-defining: commas' },
      { text: 'That’s the student whose essay won the prize.' },
      { text: 'My father, that is a doctor, works long hours.', correct: false, note: 'Do not use "that" in non-defining clauses.' },
      { text: 'My father, who is a doctor, works long hours.', correct: true },
    ],
    exercises: [
      { type: 'mcq', prompt: 'The hotel ___ we stayed was near the beach.', options: ['which', 'where', 'who', 'whose'], answers: ['where'], explanation: '"Where" refers to a place and replaces "in which".' },
      { type: 'mcq', prompt: 'I have a friend ___ brother is a famous actor.', options: ['who', 'whose', 'which', "who's"], answers: ['whose'], explanation: '"Whose" shows possession.' },
      { type: 'mcq', prompt: 'London, ___ is the capital of the UK, has many museums.', options: ['that', 'which', 'where', 'what'], answers: ['which'], explanation: 'Non-defining clause about a thing: which (not that).' },
      { type: 'mcq', prompt: 'In which sentence can the relative pronoun be omitted?', options: ['The man who called you is here.', 'The cake that she baked was delicious.', 'The dog which bit me ran away.', 'My aunt, who lives in Lima, is visiting.'], answers: ['The cake that she baked was delicious.'], explanation: '"That" is the object of "baked", so it can be omitted in a defining clause.' },
      { type: 'fill', prompt: 'Complete: "2008 was the year ___ the financial crisis began."', answers: ['when', 'in which'], explanation: '"When" refers to a time.' },
      { type: 'fill', prompt: 'Complete: "The people ___ attended the course found it useful."', answers: ['who', 'that'], explanation: 'People + defining clause: who or that.' },
    ],
  },
  {
    slug: 'modal-verbs',
    title: 'Modal verbs: ability, obligation and possibility',
    track: 'grammar',
    pathLevel: 'intermediate',
    cefrLevel: 'B2',
    category: 'verbs',
    summary: 'Use can, could, must, have to, should, might and may correctly, including past deduction with must have and can’t have.',
    body: `Modal verbs (*can, could, may, might, must, shall, should, will, would*) are followed by the **base verb** without *to*: *She **can swim*** (not ~~can to swim~~ or ~~can swims~~).

## Ability
- *can / can't* (present), *could / couldn't* (general past ability): *I **could** read when I was four.*
- *be able to* for other tenses and one specific success: *I **was able to** fix it.* *I'**ll be able to** come.*

## Obligation and advice
- **must** — strong obligation from the speaker, rules: *You **must** wear a seatbelt.*
- **have to** — external obligation: *I **have to** wear a uniform at work.*
- **mustn't** = prohibited; **don't have to** = not necessary: *You **mustn't** smoke here. You **don't have to** come if you're busy.*
- **should / ought to** — advice: *You **should** see a doctor.*

## Possibility and deduction (present)
- **must** — I'm sure it's true: *She's been working all day. She **must** be tired.*
- **might / may / could** — possibly true: *He **might** be at home.*
- **can't** — I'm sure it's not true: *That **can't** be Tom; he's in Spain.*

## Deduction about the past: modal + have + past participle
- *The streets are wet. It **must have rained**.*
- *She **might have missed** the bus.*
- *He **can't have seen** us; he didn't wave.*
- Criticism / regret: *You **should have told** me!*

## IELTS tip
Modals help you **hedge** in academic writing: *This policy **could** reduce traffic. Governments **should** invest more in public transport.*`,
    examples: [
      { text: 'You don’t have to bring food; lunch is provided.', note: 'not necessary' },
      { text: 'You mustn’t use your phone during the exam.', note: 'prohibited' },
      { text: 'He must have forgotten about the meeting.', note: 'past deduction' },
      { text: 'She can to speak four languages.', correct: false, note: 'No "to" after modal verbs.' },
      { text: 'She can speak four languages.', correct: true },
    ],
    exercises: [
      { type: 'mcq', prompt: 'You ___ pay to enter the museum on Sundays — it’s free.', options: ["mustn't", "don't have to", "can't", "shouldn't"], answers: ["don't have to"], explanation: '"Don\'t have to" means it is not necessary.' },
      { type: 'mcq', prompt: 'Her light is on. She ___ be at home.', options: ['must', "can't", 'should', 'has to'], answers: ['must'], explanation: '"Must" expresses a strong logical deduction.' },
      { type: 'mcq', prompt: 'I can’t find my wallet. I ___ it at the restaurant.', options: ['must leave', 'might have left', 'should leave', 'can leave'], answers: ['might have left'], explanation: 'Possibility about the past: might have + past participle.' },
      { type: 'mcq', prompt: 'You look ill. You ___ see a doctor.', options: ['should', "mustn't", 'could have', 'might have'], answers: ['should'], explanation: '"Should" gives advice.' },
      { type: 'mcq', prompt: 'That ___ be the right answer — it doesn’t make sense.', options: ['must', "can't", 'might', 'should'], answers: ["can't"], explanation: '"Can\'t" means we are sure something is not true.' },
      { type: 'fill', prompt: 'Complete: "After the operation, he ___ able to walk again." (future)', answers: ['will be', "'ll be"], explanation: '"Can" has no future form, so we use "will be able to".' },
      { type: 'fill', prompt: 'Complete: "You ___ (should / tell) me earlier!" (criticism about the past)', answers: ['should have told', "should've told"], explanation: 'Criticism of a past action: should have + past participle.' },
    ],
  },
];
