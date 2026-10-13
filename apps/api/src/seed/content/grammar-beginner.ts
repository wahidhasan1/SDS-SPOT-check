import type { SeedLesson } from './types';

export const beginnerLessons: SeedLesson[] = [
  {
    slug: 'parts-of-speech',
    title: 'Parts of speech',
    track: 'grammar',
    pathLevel: 'beginner',
    cefrLevel: 'A1',
    category: 'foundations',
    summary: 'Learn the eight word classes — nouns, verbs, adjectives, adverbs and more — and how they work together in a sentence.',
    body: `Every English word belongs to a **part of speech** (a word class). Knowing the class of a word helps you put it in the right place in a sentence and choose the correct form.

## The main word classes
- **Noun** — a person, place, thing or idea: *teacher, London, book, happiness*.
- **Pronoun** — replaces a noun: *I, you, she, it, they, this, someone*.
- **Verb** — an action or state: *run, think, be, have*.
- **Adjective** — describes a noun: *a **tall** building, the water is **cold***.
- **Adverb** — describes a verb, adjective or other adverb: *speak **slowly**, **very** big*.
- **Preposition** — shows position, time or relationship: *in, on, at, under, before, with*.
- **Conjunction** — joins words or clauses: *and, but, or, because, although*.
- **Determiner** — comes before a noun to show which or how many: *a, the, my, some, every*.

## Word families
Many words change form to move between classes. For example: *success* (noun), *succeed* (verb), *successful* (adjective), *successfully* (adverb). Common endings help you recognise the class:
- Nouns often end in **-tion, -ment, -ness, -ity**: *information, development, kindness, ability*.
- Adjectives often end in **-ful, -less, -ous, -ive, -able**: *careful, useless, dangerous, active, comfortable*.
- Adverbs often end in **-ly**: *quickly, carefully*. (But *friendly* and *lovely* are adjectives.)

## Why it matters for IELTS
In completion tasks you must write a word that fits the grammar of the gap. Ask yourself: *does the gap need a noun, a verb, an adjective or an adverb?* This removes many wrong answers before you even read the text.`,
    examples: [
      { text: 'The young doctor spoke calmly to her patients.', note: 'young = adjective, doctor = noun, spoke = verb, calmly = adverb, to = preposition' },
      { text: 'She is happy because she passed the exam.', note: 'because = conjunction joining two clauses' },
      { text: 'Their decision surprised everyone.', note: 'decision = noun (from the verb decide)' },
      { text: 'He drives careful.', correct: false, note: 'We need an adverb to describe how he drives: carefully.' },
      { text: 'He drives carefully.', correct: true },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Which word is an adjective? "The quiet library opens early."', options: ['quiet', 'library', 'opens', 'early'], answers: ['quiet'], explanation: '"Quiet" describes the noun "library", so it is an adjective. "Early" is an adverb describing when it opens.' },
      { type: 'mcq', prompt: 'Which word is a conjunction? "I wanted to go out, but it was raining."', options: ['wanted', 'out', 'but', 'raining'], answers: ['but'], explanation: '"But" joins two clauses and shows contrast, so it is a conjunction.' },
      { type: 'mcq', prompt: 'Choose the correct word: "She sings very ___."', options: ['beautiful', 'beauty', 'beautifully', 'beautify'], answers: ['beautifully'], explanation: 'We need an adverb to describe the verb "sings". Adverbs often end in -ly: beautifully.' },
      { type: 'mcq', prompt: 'Choose the noun: "The ___ of the new bridge took three years."', options: ['construct', 'construction', 'constructive', 'constructively'], answers: ['construction'], explanation: 'After "the" and before "of" we need a noun. "-tion" is a common noun ending.' },
      { type: 'fill', prompt: 'Complete with the adjective form of "danger": "Swimming here is ___."', answers: ['dangerous'], explanation: 'The adjective from "danger" is "dangerous" (-ous is an adjective ending).' },
      { type: 'fill', prompt: 'Complete with the noun form of "happy": "Money cannot buy ___."', answers: ['happiness'], explanation: 'The noun from "happy" is "happiness" (y changes to i before -ness).' },
      { type: 'mcq', prompt: 'Which word is a pronoun? "Maria called her brother and asked him for help."', options: ['Maria', 'called', 'him', 'help'], answers: ['him'], explanation: '"Him" replaces "her brother", so it is a pronoun.' },
    ],
  },
  {
    slug: 'present-simple',
    title: 'Present simple',
    track: 'grammar',
    pathLevel: 'beginner',
    cefrLevel: 'A1',
    category: 'tenses',
    summary: 'Use the present simple for habits, routines, facts and timetables. Learn the third-person -s and how to make questions and negatives.',
    body: `We use the **present simple** for:
- **habits and routines**: *I **drink** coffee every morning.*
- **facts and general truths**: *Water **boils** at 100°C.*
- **permanent situations**: *She **lives** in Toronto.*
- **timetables**: *The train **leaves** at 7:15.*

## Form
With **I / you / we / they** use the base verb: *I work, they play*.
With **he / she / it** add **-s** or **-es**: *she works, he watches, it goes*.
- Verbs ending in **-ch, -sh, -ss, -x, -o** add **-es**: *teaches, washes, misses, fixes, does*.
- Consonant + **y** becomes **-ies**: *study → studies*. (But vowel + y: *play → plays*.)
- **have** becomes **has**.

## Negatives and questions
Use **do / does** + base verb:
- *I **don't** like fish. She **doesn't** like fish.* (not ~~doesn't likes~~)
- ***Do** you speak French? **Does** he work here?*
- *Where **do** they live? What time **does** the shop open?*

## Adverbs of frequency
*always, usually, often, sometimes, rarely, never* go **before** the main verb but **after** the verb *be*: *She **often** reads. He is **never** late.*`,
    examples: [
      { text: 'My brother works in a hospital.', note: 'third person singular: works' },
      { text: 'The sun rises in the east.', note: 'general truth' },
      { text: 'Does your sister study medicine?', note: 'question with does + base verb' },
      { text: 'He don’t like coffee.', correct: false, note: 'With he/she/it use doesn’t.' },
      { text: 'He doesn’t like coffee.', correct: true },
      { text: 'I usually walk to work.', note: 'frequency adverb before the main verb' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'She ___ to the gym three times a week.', options: ['go', 'goes', 'going', 'is go'], answers: ['goes'], explanation: 'With "she" in the present simple we add -es to "go": goes.' },
      { type: 'mcq', prompt: '___ your parents live near you?', options: ['Do', 'Does', 'Are', 'Is'], answers: ['Do'], explanation: '"Parents" is plural (they), so the question uses "do".' },
      { type: 'mcq', prompt: 'My friend ___ eat meat.', options: ["don't", "doesn't", 'not', "isn't"], answers: ["doesn't"], explanation: 'For he/she/it negatives we use "doesn\'t" + base verb.' },
      { type: 'fill', prompt: 'Complete: "He ___ (study) English every evening."', answers: ['studies'], explanation: 'Consonant + y changes to -ies with he/she/it: studies.' },
      { type: 'fill', prompt: 'Complete: "Water ___ (freeze) at 0°C."', answers: ['freezes'], explanation: 'A scientific fact uses the present simple; "water" is singular, so "freezes".' },
      { type: 'mcq', prompt: 'Choose the correct word order.', options: ['She is always late.', 'She always is late.', 'Always she is late.', 'She is late always never.'], answers: ['She is always late.'], explanation: 'Frequency adverbs go after the verb "be".' },
      { type: 'mcq', prompt: 'What time ___ the museum open?', options: ['do', 'does', 'is', 'are'], answers: ['does'], explanation: '"The museum" is singular (it), so we use "does".' },
      { type: 'fill', prompt: 'Complete: "My father ___ (watch) the news every night."', answers: ['watches'], explanation: 'Verbs ending in -ch add -es: watches.' },
    ],
  },
  {
    slug: 'articles',
    title: 'Articles: a, an and the',
    track: 'grammar',
    pathLevel: 'beginner',
    cefrLevel: 'A2',
    category: 'nouns-and-determiners',
    summary: 'Choose between a, an, the and no article with countable, uncountable, singular and plural nouns.',
    body: `English has two kinds of article: the **indefinite** article (*a / an*) and the **definite** article (*the*). Sometimes we use **no article** at all.

## A / an
Use *a/an* with a **singular countable** noun when you mention something for the first time or when it is one of many:
- *I bought **a** new phone.* *She is **an** engineer.*
- Use **an** before a vowel **sound**: *an apple, an hour* (silent h), but *a university* (sounds like "you").

## The
Use *the* when the listener knows which thing you mean:
- because you mentioned it before: *I bought a phone. **The** phone was expensive.*
- because there is only one: ***the** sun, **the** internet, **the** capital of Japan*.
- with superlatives and ordinals: ***the** best student, **the** first time*.
- with some place names: rivers, oceans, plural countries and mountain ranges — ***the** Nile, **the** Pacific, **the** United States, **the** Alps*.

## No article
Do not use an article:
- with plural or uncountable nouns used in general: ***Dogs** are loyal. **Information** is power.*
- with most countries, cities, languages and meals: *I live in Canada. She speaks Arabic. We had lunch.*
- in common phrases: *go to school / work / bed, by bus, at home*.

## IELTS tip
Article mistakes are among the most common errors in IELTS writing. Check every singular countable noun: it almost always needs *a, an, the* or another determiner (*my, this, every*).`,
    examples: [
      { text: 'She is an honest person.', note: 'honest starts with a vowel sound /ɒ/' },
      { text: 'He wants to study at a university in Europe.', note: 'university starts with a consonant sound /j/' },
      { text: 'The moon looks beautiful tonight.', note: 'there is only one moon' },
      { text: 'I love the music.', correct: false, note: 'In general statements about uncountable nouns, use no article.' },
      { text: 'I love music.', correct: true },
      { text: 'This is the most interesting book I have read.', note: 'superlative' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'I waited for ___ hour at the station.', options: ['a', 'an', 'the', '— (no article)'], answers: ['an'], explanation: 'The h in "hour" is silent, so it starts with a vowel sound: an hour.' },
      { type: 'mcq', prompt: '___ Amazon is the largest rainforest in the world.', options: ['A', 'An', 'The', '— (no article)'], answers: ['The'], explanation: 'We use "the" with the names of rivers and famous geographical features like the Amazon.' },
      { type: 'mcq', prompt: 'She goes to ___ work by train.', options: ['a', 'the', '— (no article)', 'an'], answers: ['— (no article)'], explanation: '"Go to work" is a fixed phrase without an article.' },
      { type: 'mcq', prompt: 'I saw a film yesterday. ___ film was about climate change.', options: ['A', 'The', 'An', '— (no article)'], answers: ['The'], explanation: 'The film has already been mentioned, so we use "the".' },
      { type: 'mcq', prompt: '___ vegetables are good for your health.', options: ['The', 'A', '— (no article)', 'An'], answers: ['— (no article)'], explanation: 'We are talking about vegetables in general (plural), so no article.' },
      { type: 'fill', prompt: 'Complete with a or an: "He is ___ European citizen."', answers: ['a'], explanation: '"European" starts with a /j/ (consonant) sound, so we use "a".' },
      { type: 'fill', prompt: 'Complete: "Mount Everest is ___ highest mountain on Earth."', answers: ['the'], explanation: 'Superlatives (highest) take "the".' },
    ],
  },
  {
    slug: 'prepositions-time-place',
    title: 'Prepositions of time and place',
    track: 'grammar',
    pathLevel: 'beginner',
    cefrLevel: 'A2',
    category: 'prepositions',
    summary: 'Master in, on and at for time and place, plus common prepositions like during, for, since, between and opposite.',
    body: `## Time: at, on, in
- **at** + exact times and some holidays: *at 6 o'clock, at noon, at night, at the weekend (British), at Christmas*.
- **on** + days and dates: *on Monday, on 4 July, on my birthday, on weekdays*.
- **in** + longer periods: *in May, in 2020, in the summer, in the 21st century, in the morning*.

## Place: at, on, in
- **at** + a point or specific place: *at the bus stop, at the door, at home, at work*.
- **on** + a surface or a line: *on the table, on the wall, on the second floor, on the coast*.
- **in** + an enclosed space or area: *in the box, in the kitchen, in London, in the car*.

## Other useful prepositions
- **for** + a period of time: *for three years*. **since** + a starting point: *since 2019*.
- **during** + a noun (when something happens): *during the meeting*.
- **between** two things, **among** a group: *between the bank and the café; among friends*.
- **opposite** (facing), **next to** (beside), **behind**, **in front of**.

## IELTS tip
In Listening form completion you often hear prepositions before the answer: "*It's **on** the third floor*" or "*We meet **at** 7:30*". Listen for them — they tell you what kind of information is coming.`,
    examples: [
      { text: 'The meeting starts at 9:30 on Tuesday.', note: 'at + time, on + day' },
      { text: 'She was born in 1998, in a small town in Kenya.', note: 'in + year, in + town/country' },
      { text: 'I have lived here since 2015.', note: 'since + starting point' },
      { text: 'We will meet in Friday.', correct: false, note: 'Days take on.' },
      { text: 'We will meet on Friday.', correct: true },
      { text: 'The pharmacy is between the bank and the post office.' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'The concert begins ___ 8 pm.', options: ['in', 'on', 'at', 'by'], answers: ['at'], explanation: 'Use "at" with exact clock times.' },
      { type: 'mcq', prompt: 'My grandmother was born ___ 1950.', options: ['in', 'on', 'at', 'since'], answers: ['in'], explanation: 'Use "in" with years.' },
      { type: 'mcq', prompt: 'There is a beautiful painting ___ the wall.', options: ['in', 'on', 'at', 'between'], answers: ['on'], explanation: 'A wall is a surface, so we use "on".' },
      { type: 'mcq', prompt: 'He has worked here ___ five years.', options: ['since', 'for', 'during', 'in'], answers: ['for'], explanation: '"Five years" is a period of time, so we use "for".' },
      { type: 'mcq', prompt: 'Please switch off your phones ___ the exam.', options: ['for', 'during', 'since', 'while'], answers: ['during'], explanation: '"During" + noun tells us when something happens.' },
      { type: 'fill', prompt: 'Complete: "I usually stay ___ home on Sundays."', answers: ['at'], explanation: '"At home" is a fixed expression.' },
      { type: 'fill', prompt: 'Complete: "Her birthday is ___ 12 March."', answers: ['on'], explanation: 'Use "on" with dates.' },
    ],
  },
  {
    slug: 'subject-verb-agreement',
    title: 'Subject–verb agreement',
    track: 'grammar',
    pathLevel: 'beginner',
    cefrLevel: 'A2',
    category: 'sentence-grammar',
    summary: 'Make verbs agree with their subjects, including tricky cases such as "each", "a number of", collective nouns and long subjects.',
    body: `A verb must **agree** with its subject in number: a singular subject takes a singular verb, a plural subject takes a plural verb.
- *The student **is** ready.* / *The students **are** ready.*

## Find the real subject
Words between the subject and the verb do not change the agreement:
- *The **list** of names **is** on the desk.* (not ~~are~~ — the subject is *list*)
- *The **price** of houses in big cities **has** risen.*

## Tricky singular subjects
- **each, every, everyone, nobody, somebody, anything** → singular: *Everyone **wants** to win.*
- **uncountable nouns** → singular: *The information **was** useful. The news **is** bad.*
- **one of the + plural noun** → singular verb: *One of my friends **lives** in Rome.*
- **gerund subjects** → singular: *Learning languages **takes** time.*

## Tricky plural subjects
- **a number of** + plural → plural verb: *A number of students **were** absent.*
- **(both) A and B** → plural: *My brother and sister **are** doctors.*
- **the + adjective** for groups → plural: *The rich **are** getting richer.*

## Compare
- ***The number** of cars **has** increased.* (singular — the subject is *number*)
- ***A number** of cars **have** been stolen.* (plural — means *many cars*)
This difference is very useful in IELTS Writing Task 1.`,
    examples: [
      { text: 'The number of tourists has doubled since 2010.', note: '"the number" is singular' },
      { text: 'A number of tourists have complained.', note: '"a number of" means many → plural' },
      { text: 'Each of the rooms has a balcony.' },
      { text: 'The results of the survey shows a clear trend.', correct: false, note: 'The subject is "results" (plural): show.' },
      { text: 'The results of the survey show a clear trend.', correct: true },
      { text: 'Reading novels improves your vocabulary.', note: 'gerund subject → singular' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'The quality of these products ___ improved.', options: ['have', 'has', 'are', 'were'], answers: ['has'], explanation: 'The subject is "quality" (singular), not "products".' },
      { type: 'mcq', prompt: 'Everyone in my class ___ a laptop.', options: ['have', 'has', 'are having', 'own'], answers: ['has'], explanation: '"Everyone" is grammatically singular.' },
      { type: 'mcq', prompt: 'A number of people ___ waiting outside.', options: ['is', 'was', 'were', 'has'], answers: ['were'], explanation: '"A number of" + plural noun takes a plural verb.' },
      { type: 'mcq', prompt: 'The news ___ very surprising.', options: ['were', 'are', 'was', 'have been'], answers: ['was'], explanation: '"News" is uncountable and takes a singular verb.' },
      { type: 'mcq', prompt: 'One of my neighbours ___ three cats.', options: ['have', 'has', 'are having', 'own'], answers: ['has'], explanation: '"One of + plural noun" takes a singular verb because the subject is "one".' },
      { type: 'fill', prompt: 'Complete with is or are: "My mother and father ___ teachers."', answers: ['are'], explanation: 'Two subjects joined by "and" take a plural verb.' },
      { type: 'fill', prompt: 'Complete with has or have: "The number of students ___ fallen this year."', answers: ['has'], explanation: '"The number" is singular.' },
    ],
  },
  {
    slug: 'past-simple',
    title: 'Past simple',
    track: 'grammar',
    pathLevel: 'beginner',
    cefrLevel: 'A2',
    category: 'tenses',
    summary: 'Talk about finished actions in the past with regular and irregular verbs, questions with did, and time expressions like ago and last.',
    body: `We use the **past simple** for actions and situations that **finished** at a time in the past.
- *I **visited** Paris **last year**.* *She **moved** to Dubai **in 2018**.*

## Regular verbs
Add **-ed**: *work → worked, play → played*.
- ending in **-e** add **-d**: *live → lived*.
- consonant + **y** → **-ied**: *study → studied*.
- short verbs with consonant–vowel–consonant double the last letter: *stop → stopped, plan → planned*.

## Irregular verbs
Many common verbs are irregular and must be learned: *go → went, see → saw, have → had, make → made, take → took, write → wrote, buy → bought, think → thought*.
**Be** has two forms: *I/he/she/it **was**, you/we/they **were***.

## Negatives and questions
Use **did / didn't** + base verb (for all persons):
- *I **didn't go** to the party.* (not ~~didn't went~~)
- ***Did** you **see** the match? Where **did** they **stay**?*

## Time expressions
*yesterday, last week/month/year, two days ago, in 2010, when I was a child*.`,
    examples: [
      { text: 'We watched a documentary last night.', note: 'regular verb' },
      { text: 'She wrote three emails before lunch.', note: 'irregular: write → wrote' },
      { text: 'Did you finish your homework?' },
      { text: 'I didn’t saw him yesterday.', correct: false, note: 'After didn’t use the base verb.' },
      { text: 'I didn’t see him yesterday.', correct: true },
      { text: 'They were very tired after the trip.' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'We ___ to the beach last Saturday.', options: ['go', 'goes', 'went', 'gone'], answers: ['went'], explanation: '"Last Saturday" is finished past time; the past of "go" is "went".' },
      { type: 'mcq', prompt: '___ you enjoy the concert?', options: ['Do', 'Did', 'Were', 'Was'], answers: ['Did'], explanation: 'Past simple questions use "did" + base verb.' },
      { type: 'mcq', prompt: 'She ___ like the food at the restaurant.', options: ["didn't", "doesn't", "wasn't", "don't"], answers: ["didn't"], explanation: 'Past negative: didn\'t + base verb.' },
      { type: 'fill', prompt: 'Complete: "They ___ (stop) for coffee on the way."', answers: ['stopped'], explanation: 'Double the final consonant: stop → stopped.' },
      { type: 'fill', prompt: 'Complete: "I ___ (buy) a new jacket yesterday."', answers: ['bought'], explanation: '"Buy" is irregular: bought.' },
      { type: 'mcq', prompt: 'The weather ___ terrible during our holiday.', options: ['were', 'was', 'is', 'did'], answers: ['was'], explanation: '"The weather" is singular, so the past of "be" is "was".' },
      { type: 'fill', prompt: 'Complete: "He ___ (study) law at university."', answers: ['studied'], explanation: 'Consonant + y → -ied: studied.' },
    ],
  },
  {
    slug: 'sentence-structure',
    title: 'Sentence structure and word order',
    track: 'grammar',
    pathLevel: 'beginner',
    cefrLevel: 'A2',
    category: 'sentence-grammar',
    summary: 'Build clear English sentences with subject–verb–object order, correct question order and the position of adverbs and adjectives.',
    body: `English word order is fixed much more than in many other languages. The basic order is:

**Subject → Verb → Object → (Place) → (Time)**
- *She **reads** the newspaper in the café every morning.*

## Every sentence needs a subject and a verb
- ~~Is raining.~~ → ***It** is raining.*
- ~~Because I was tired.~~ (not a complete sentence) → *I went home because I was tired.*

## Questions
Put the auxiliary verb (*do, does, did, is, are, have, can, will*…) before the subject:
- *You are ready.* → ***Are you** ready?*
- *She lives here.* → ***Does she** live here?*
- With question words: ***Where do** you **work**? **Why did** he **leave**?*

## Adjectives and adverbs
- Adjectives usually go **before** the noun: *a **red** car* (not ~~a car red~~).
- Several adjectives: opinion → size → age → colour → origin → material: *a **lovely small old** Italian table*.
- Adverbs of manner usually go after the object: *She speaks English **fluently*** (not ~~speaks fluently English~~).

## Compound and complex sentences
Join ideas with conjunctions:
- **and, but, so, or** (compound): *I was hungry, **so** I made a sandwich.*
- **because, although, when, if, while** (complex): ***Although** it was late, we continued working.*`,
    examples: [
      { text: 'My sister bought a new laptop yesterday.', note: 'S + V + O + time' },
      { text: 'Where did you spend your holiday?', note: 'question word + auxiliary + subject + verb' },
      { text: 'He speaks very well English.', correct: false, note: 'The object comes before the adverb.' },
      { text: 'He speaks English very well.', correct: true },
      { text: 'Although the test was difficult, most students passed.' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Choose the correct sentence.', options: ['I like very much chocolate.', 'I very much like chocolate much.', 'I like chocolate very much.', 'Very much I like chocolate.'], answers: ['I like chocolate very much.'], explanation: 'The object (chocolate) comes directly after the verb; "very much" goes at the end.' },
      { type: 'mcq', prompt: 'Choose the correct question.', options: ['Where you live?', 'Where do you live?', 'Where you do live?', 'Do where you live?'], answers: ['Where do you live?'], explanation: 'Question word + auxiliary (do) + subject + verb.' },
      { type: 'mcq', prompt: 'Choose the correct order of adjectives.', options: ['a wooden beautiful old box', 'a beautiful old wooden box', 'an old wooden beautiful box', 'a box beautiful old wooden'], answers: ['a beautiful old wooden box'], explanation: 'Opinion (beautiful) → age (old) → material (wooden).' },
      { type: 'mcq', prompt: 'Which is a complete sentence?', options: ['Because the bus was late.', 'Is very cold today.', 'It is very cold today.', 'When we arrived at the hotel.'], answers: ['It is very cold today.'], explanation: 'A complete sentence needs a subject and a verb and must not be only a dependent clause.' },
      { type: 'mcq', prompt: 'Choose the correct sentence.', options: ['She every day walks to work.', 'She walks to work every day.', 'She walks every day to work.', 'Every day walks she to work.'], answers: ['She walks to work every day.'], explanation: 'Subject + verb + place + time.' },
      { type: 'fill', prompt: 'Put the auxiliary in the gap: "___ she finish the report yesterday?"', answers: ['did', 'Did'], explanation: 'Past simple question: Did + subject + base verb.' },
    ],
  },
];
