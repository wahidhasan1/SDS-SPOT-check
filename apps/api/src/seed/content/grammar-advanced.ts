import type { SeedLesson } from './types';

export const advancedLessons: SeedLesson[] = [
  {
    slug: 'punctuation',
    title: 'Punctuation for clear writing',
    track: 'grammar',
    pathLevel: 'advanced',
    cefrLevel: 'B2',
    category: 'writing-mechanics',
    summary: 'Use commas, semicolons, colons, apostrophes and capital letters correctly, and avoid comma splices and run-on sentences.',
    body: `Good punctuation makes your writing easy to follow and is part of **grammatical accuracy** in IELTS Writing.

## Full stops and comma splices
A **comma splice** joins two complete sentences with only a comma — this is an error.
- ~~The test was hard, I passed it.~~
- Fix it with a full stop, a conjunction, or a semicolon: *The test was hard. I passed it.* / *The test was hard, **but** I passed it.* / *The test was hard; however, I passed it.*

## Commas
- after an introductory word, phrase or clause: ***However,** costs rose. **In 2010,** sales fell. **Although it was late,** we continued.*
- in lists: *Spain, Italy**,** and Greece* (the last comma is optional in British English).
- around non-defining relative clauses: *Oslo, **which is the capital**, is expensive.*
- **not** between a subject and its verb: ~~The main reason for this change, is cost.~~

## Semicolons and colons
- **semicolon (;)** joins two closely related complete sentences: *Some people prefer cities; others prefer the countryside.* It often appears before *however, therefore, moreover*.
- **colon (:)** introduces a list, an explanation or an example: *There are two options: rent or buy.*

## Apostrophes
- possession: *the student**'s** book* (one student), *the students**'** books* (many), *children**'s** toys*.
- contractions: *it's = it is*. **Its** (no apostrophe) is possessive: *The company changed **its** logo.*
- Avoid contractions in formal IELTS essays: write *do not*, *it is*.

## Capital letters
Use capitals for names, nationalities, languages, days and months: *Monday, July, Japanese, the Internet* (or *internet*). Do not capitalise seasons: *summer*.`,
    examples: [
      { text: 'Car ownership has risen; however, public transport use has fallen.' },
      { text: 'There are three main causes: cost, convenience and habit.' },
      { text: 'The company announced it’s new strategy.', correct: false, note: 'Possessive "its" has no apostrophe.' },
      { text: 'The company announced its new strategy.', correct: true },
      { text: 'Many people work from home, this saves time.', correct: false, note: 'Comma splice — use a full stop, semicolon or conjunction.' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Which sentence is correctly punctuated?', options: ['Prices rose, sales fell.', 'Prices rose; consequently, sales fell.', 'Prices rose consequently, sales fell.', 'Prices rose, consequently sales fell.'], answers: ['Prices rose; consequently, sales fell.'], explanation: 'Two complete sentences linked by "consequently" need a semicolon (or full stop) before it and a comma after.' },
      { type: 'mcq', prompt: 'Choose the correct form: "The ___ uniforms are blue." (many players)', options: ["player's", "players'", 'players', "players's"], answers: ["players'"], explanation: 'Plural noun ending in -s: add the apostrophe after the s.' },
      { type: 'mcq', prompt: 'Choose the correct sentence.', options: ["It's important to recycle.", "Its important to recycle.", "It's' important to recycle.", "Its' important to recycle."], answers: ["It's important to recycle."], explanation: '"It\'s" is the contraction of "it is".' },
      { type: 'mcq', prompt: 'Where should the comma go? "Although the plan was expensive it was approved."', options: ['After "Although"', 'After "plan"', 'After "expensive"', 'After "was approved"'], answers: ['After "expensive"'], explanation: 'Put a comma after an introductory dependent clause.' },
      { type: 'mcq', prompt: 'Which punctuation mark best introduces a list? "You will need three things ___ a passport, a ticket and money."', options: [',', ';', ':', '.'], answers: [':'], explanation: 'A colon introduces a list after a complete clause.' },
      { type: 'mcq', prompt: 'Which sentence contains an error?', options: ['The main reason for this, is cost.', 'In 2015, the figure doubled.', 'Rome, which is very old, is beautiful.', 'However, the results were surprising.'], answers: ['The main reason for this, is cost.'], explanation: 'Do not put a comma between a subject and its verb.' },
    ],
  },
  {
    slug: 'linking-and-cohesion',
    title: 'Linking words and cohesion',
    track: 'grammar',
    pathLevel: 'advanced',
    cefrLevel: 'C1',
    category: 'writing-mechanics',
    summary: 'Connect ideas precisely with contrast, cause, result, addition and example linkers, and use reference words to avoid repetition.',
    body: `**Cohesion** is how sentences and paragraphs connect. It is one of the four IELTS Writing criteria ("Coherence and cohesion").

## Linkers by function
- **Addition**: *moreover, furthermore, in addition, also, besides*
- **Contrast**: *however, nevertheless, on the other hand, whereas, while, although, despite*
- **Cause**: *because, since, as, due to, owing to, because of*
- **Result**: *therefore, consequently, as a result, thus, so*
- **Example**: *for example, for instance, such as, in particular*
- **Conclusion**: *in conclusion, overall, to sum up*

## Grammar of linkers — the key to accuracy
- **although / even though / whereas / while** + clause: ***Although** it was expensive, many people bought it.*
- **despite / in spite of** + noun or -ing: ***Despite** the high price / **Despite** being expensive, …* (not ~~despite it was~~)
- **because** + clause; **because of / due to** + noun: *…**because** prices rose / **because of** rising prices*.
- **however / therefore / moreover** start a new sentence (or follow a semicolon) and take a comma: *Costs rose. **However,** profits increased.*

## Reference and substitution
Avoid repeating nouns by using *this, these, it, they, such, the former / the latter, do so*:
- *Many cities have introduced bike lanes. **This** has reduced traffic.*
- *Some prefer trains, others buses; **the former** are faster.*

## Avoid overuse
Examiners penalise mechanical linking (*Firstly… Secondly… Moreover… Furthermore…* in every sentence). Use linkers where the logical relationship needs to be clear, and vary them.`,
    examples: [
      { text: 'Despite the bad weather, the event was a success.' },
      { text: 'Although the bad weather, the event was a success.', correct: false, note: '"Although" needs a clause; use "despite" + noun.' },
      { text: 'Fuel prices rose sharply. As a result, more people used public transport.' },
      { text: 'Some students prefer online classes, whereas others need face-to-face contact.' },
    ],
    exercises: [
      { type: 'mcq', prompt: '___ the high cost, the project was approved.', options: ['Although', 'Despite', 'However', 'Because'], answers: ['Despite'], explanation: '"Despite" + noun phrase (the high cost).' },
      { type: 'mcq', prompt: 'The factory closed ___ falling demand.', options: ['because', 'due to', 'although', 'therefore'], answers: ['due to'], explanation: '"Due to" + noun phrase gives the cause.' },
      { type: 'mcq', prompt: 'Online shopping is convenient. ___, it can be harmful to local shops.', options: ['Moreover', 'Therefore', 'However', 'For example'], answers: ['However'], explanation: 'The second idea contrasts with the first, so we need a contrast linker.' },
      { type: 'mcq', prompt: 'Choose the correct sentence.', options: ['Despite it was raining, we went out.', 'Although it was raining, we went out.', 'Although raining, but we went out.', 'However it was raining, we went out.'], answers: ['Although it was raining, we went out.'], explanation: '"Although" + subject + verb.' },
      { type: 'mcq', prompt: 'Many people now work remotely. ___ trend has reduced office demand.', options: ['This', 'These', 'It', 'Those'], answers: ['This'], explanation: '"This" + singular noun (trend) refers back to the previous idea.' },
      { type: 'fill', prompt: 'Complete with a result linker (one word, starts with "t"): "Demand increased; ___, prices rose."', answers: ['therefore', 'thus'], explanation: '"Therefore" or "thus" introduces a result.' },
      { type: 'mcq', prompt: 'Some countries invest in solar power, ___ others rely on coal.', options: ['whereas', 'despite', 'because of', 'moreover'], answers: ['whereas'], explanation: '"Whereas" joins two contrasting clauses.' },
    ],
  },
  {
    slug: 'common-errors',
    title: 'Common grammatical errors to avoid',
    track: 'grammar',
    pathLevel: 'advanced',
    cefrLevel: 'C1',
    category: 'accuracy',
    summary: 'Fix the errors examiners see most often: countable/uncountable nouns, verb patterns, word forms, prepositions after verbs and more.',
    body: `These errors appear again and again in learner writing. Learning to spot them is one of the fastest ways to improve accuracy.

## 1. Uncountable nouns
These have no plural and take a singular verb: *information, advice, research, equipment, furniture, knowledge, evidence, traffic, homework, news*.
- ~~informations, advices, researches~~ → *information, pieces of advice, research*.
- ~~an advice~~ → *some advice / a piece of advice*.

## 2. Verb + -ing or to-infinitive
- **+ -ing**: *enjoy, avoid, suggest, consider, finish, mind, keep, admit, deny*: *I **suggest taking** the train.*
- **+ to**: *want, decide, hope, plan, agree, refuse, manage, afford, expect*: *They **decided to move**.*
- ~~I suggest you to go~~ → *I suggest (that) you go / I suggest going*.

## 3. Dependent prepositions
*depend **on**, consist **of**, interested **in**, good **at**, responsible **for**, result **in** (cause), result **from** (be caused by), discuss (no preposition!), emphasise (no preposition)*.
- ~~discuss about the problem~~ → *discuss the problem*.

## 4. Word form
- *The **economy** is growing.* (noun) / *an **economic** crisis* (adjective) / *an **economical** car* (saves money).
- *It **affects** us* (verb) / *It has an **effect** on us* (noun).

## 5. Confusing pairs
- *rise* (no object: prices rise) vs *raise* (object: raise prices).
- *lose* (verb) vs *loose* (adjective). *fewer* + countable vs *less* + uncountable: ***fewer** cars, **less** pollution*.

## 6. Missing or extra words
- ~~It is depend on~~ → *It **depends** on*.
- ~~Nowadays people is~~ → *people **are*** (people is plural).
- ~~Although…, but…~~ → use only one: *Although it was cheap, it broke.*`,
    examples: [
      { text: 'The teacher gave me some useful advice.', correct: true },
      { text: 'The teacher gave me some useful advices.', correct: false, note: '"Advice" is uncountable.' },
      { text: 'We discussed about the plan.', correct: false, note: '"Discuss" takes a direct object.' },
      { text: 'There are fewer cars and less noise in the city centre now.', correct: true },
      { text: 'The government should raise taxes on sugary drinks.', correct: true },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Choose the correct sentence.', options: ['She gave me many informations.', 'She gave me a lot of information.', 'She gave me an information.', 'She gave me much informations.'], answers: ['She gave me a lot of information.'], explanation: '"Information" is uncountable.' },
      { type: 'mcq', prompt: 'My doctor suggested ___ more exercise.', options: ['to do', 'doing', 'do', 'me to do'], answers: ['doing'], explanation: '"Suggest" is followed by -ing (or a that-clause).' },
      { type: 'mcq', prompt: 'The meeting will ___ the new budget.', options: ['discuss about', 'discuss', 'discuss on', 'discussion'], answers: ['discuss'], explanation: '"Discuss" takes a direct object with no preposition.' },
      { type: 'mcq', prompt: 'There were ___ accidents this year than last year.', options: ['less', 'fewer', 'lower', 'little'], answers: ['fewer'], explanation: '"Accidents" is countable, so use "fewer".' },
      { type: 'mcq', prompt: 'Smoking can ___ your health seriously.', options: ['effect', 'affect', 'effective', 'affection'], answers: ['affect'], explanation: '"Affect" is the verb; "effect" is usually a noun.' },
      { type: 'mcq', prompt: 'The government decided to ___ the minimum wage.', options: ['rise', 'raise', 'arise', 'rose'], answers: ['raise'], explanation: '"Raise" takes an object (the minimum wage); "rise" does not.' },
      { type: 'fill', prompt: 'Complete with the correct preposition: "The success of the plan depends ___ funding."', answers: ['on', 'upon'], explanation: '"Depend on" is a fixed verb + preposition combination.' },
      { type: 'fill', prompt: 'Correct the verb: "Nowadays, people ___ more time online." (spend)', answers: ['spend'], explanation: '"People" is plural, so "spend" (not "spends").' },
    ],
  },
  {
    slug: 'inversion-and-emphasis',
    title: 'Inversion, cleft sentences and emphasis',
    track: 'grammar',
    pathLevel: 'advanced',
    cefrLevel: 'C1',
    category: 'advanced-structures',
    summary: 'Use negative inversion, cleft sentences and fronting to add emphasis and variety to formal writing and speaking.',
    body: `Advanced structures can show grammatical range — but only use them when they are accurate and natural.

## Negative inversion
After certain negative or restrictive expressions at the **start** of a sentence, use **question word order** (auxiliary + subject):
- ***Never** **have I** seen such a beautiful view.*
- ***Rarely** **does** the city **experience** snow.*
- ***Not only** **did** prices rise, **but** wages also fell.*
- ***Under no circumstances should** you share your password.*
- ***No sooner had** we arrived **than** it started to rain.*
- ***Only after** the investigation **did** the truth emerge.*

## Inverted conditionals (formal)
- *If I had known* → ***Had I known**, I would have helped.*
- *If you should need help* → ***Should you need** help, call us.*
- *If I were* → ***Were I** in charge, I would change the policy.*

## Cleft sentences
Split a sentence to focus on one part:
- ***It was** the cost **that** worried people most.* (it-cleft)
- ***What** I need **is** more practice.* (what-cleft)
- ***The reason why** they failed **was** a lack of funding.*

## Fronting
Move information to the front for emphasis or contrast: ***Particularly significant** was the rise in renewable energy.*

## A warning
Overusing these forms sounds unnatural. In IELTS, one or two accurate examples in an essay are plenty.`,
    examples: [
      { text: 'Not only is public transport cheaper, but it is also better for the environment.' },
      { text: 'Had the government acted sooner, the crisis could have been avoided.' },
      { text: 'What surprised me most was the friendliness of the people.' },
      { text: 'Never I have eaten such delicious food.', correct: false, note: 'After "never" at the start, invert: Never have I eaten…' },
      { text: 'Never have I eaten such delicious food.', correct: true },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Rarely ___ such an exciting match.', options: ['I have seen', 'have I seen', 'I saw', 'did I saw'], answers: ['have I seen'], explanation: 'After "rarely" at the start, use inversion: have I seen.' },
      { type: 'mcq', prompt: '___ known about the delay, I would have taken a taxi.', options: ['If I', 'Had I', 'Have I', 'Did I'], answers: ['Had I'], explanation: 'Inverted third conditional: Had I known = If I had known.' },
      { type: 'mcq', prompt: 'Not only ___ late, but he also forgot the documents.', options: ['he arrived', 'did he arrive', 'he did arrive', 'arrived he'], answers: ['did he arrive'], explanation: '"Not only" at the start requires inversion.' },
      { type: 'mcq', prompt: 'Choose the correct cleft sentence.', options: ['It was the noise what annoyed me.', 'What annoyed me was the noise.', 'What annoyed me it was the noise.', 'The noise was what it annoyed me.'], answers: ['What annoyed me was the noise.'], explanation: 'What-cleft: What + clause + be + focus.' },
      { type: 'mcq', prompt: '___ you require further information, please contact us.', options: ['Should', 'Would', 'Had', 'Were'], answers: ['Should'], explanation: '"Should you require" = If you require (formal).' },
      { type: 'fill', prompt: 'Complete: "No sooner ___ we sat down than the fire alarm went off."', answers: ['had'], explanation: '"No sooner had + subject + past participle … than…"' },
    ],
  },
  {
    slug: 'academic-style',
    title: 'Academic style: nominalisation and hedging',
    track: 'grammar',
    pathLevel: 'advanced',
    cefrLevel: 'C1',
    category: 'advanced-structures',
    summary: 'Write like an academic: turn verbs into nouns, use impersonal structures and soften claims with hedging language.',
    body: `IELTS Academic Writing rewards a formal, objective style. Three techniques help most.

## 1. Nominalisation
Turn verbs and adjectives into **nouns** to make writing more concise and formal:
- *Prices increased sharply, which worried people.* → ***The sharp increase** in prices caused **concern**.*
- *If we reduce emissions…* → ***A reduction** in emissions…*
Common pairs: *develop → development, decide → decision, fail → failure, grow → growth, able → ability, important → importance*.

## 2. Impersonal structures
Avoid *I think / you* in formal essays; use impersonal forms:
- ***It is often argued that** technology isolates people.*
- ***There is evidence to suggest that** …*
- *Passive: **It is widely believed that** …*
In IELTS Task 2 you **may** give your own opinion — *I believe* is acceptable, but vary it with impersonal forms.

## 3. Hedging (softening claims)
Strong claims are easy to challenge. Hedge with:
- modal verbs: *may, might, could, can*
- adverbs: *possibly, probably, generally, arguably, to some extent*
- verbs: *tend to, appear to, seem to, suggest*
- quantifiers: *many, some, most* (instead of *all, everyone*)
*Everyone uses social media.* → ***Most young people appear to use** social media daily.*

## 4. Precise vocabulary
Replace informal words: *get → obtain/receive, a lot of → a considerable amount of / numerous, big → substantial, show → demonstrate, think about → consider*.`,
    examples: [
      { text: 'The introduction of the new law led to a decline in accidents.', note: 'nominalisation' },
      { text: 'It could be argued that online learning is less effective for younger children.', note: 'hedging + impersonal' },
      { text: 'Video games make all teenagers violent.', correct: false, note: 'Over-generalised claim.' },
      { text: 'Some studies suggest that violent video games may increase aggression in certain teenagers.', correct: true },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Choose the most academic version.', options: ['Lots of people think cars are bad.', 'It is widely believed that cars harm the environment.', 'I reckon cars are pretty bad.', 'Everybody knows cars are terrible.'], answers: ['It is widely believed that cars harm the environment.'], explanation: 'Impersonal passive structure and precise vocabulary.' },
      { type: 'mcq', prompt: 'Which is the noun form of "reduce"?', options: ['reducing', 'reductive', 'reduction', 'reduced'], answers: ['reduction'], explanation: '"Reduction" is the nominalised form.' },
      { type: 'mcq', prompt: 'Which sentence uses hedging?', options: ['This proves that diet causes disease.', 'This may suggest a link between diet and disease.', 'Diet always causes disease.', 'Everyone agrees diet causes disease.'], answers: ['This may suggest a link between diet and disease.'], explanation: '"May suggest" softens the claim.' },
      { type: 'mcq', prompt: 'Replace "get" with a more formal verb: "Students can ___ financial support."', options: ['obtain', 'grab', 'pick up', 'get hold'], answers: ['obtain'], explanation: '"Obtain" is a formal equivalent of "get".' },
      { type: 'fill', prompt: 'Nominalise: "The population grew rapidly." → "The rapid ___ of the population…"', answers: ['growth'], explanation: 'The noun form of "grow" is "growth".' },
      { type: 'fill', prompt: 'Hedge with a verb: "Young people ___ to spend more time online than older people." (one word)', answers: ['tend', 'appear', 'seem'], explanation: '"Tend to / appear to / seem to" soften a generalisation.' },
    ],
  },
];

export const generalLessons: SeedLesson[] = [
  {
    slug: 'introductions-small-talk',
    title: 'Introductions and small talk',
    track: 'general',
    pathLevel: 'beginner',
    cefrLevel: 'A2',
    category: 'everyday-english',
    summary: 'Introduce yourself, ask friendly questions and keep a casual conversation going — perfect preparation for voice practice calls.',
    body: `Small talk is short, friendly conversation about everyday topics. It helps you start conversations with new people — including your partners in FluentPath voice calls.

## Introducing yourself
- *Hi, I'm Sara. Nice to meet you.* — *Nice to meet you too.*
- *I'm from Brazil, but I live in Lisbon now.*
- *I'm a nurse / I'm studying engineering / I work in marketing.*

## Safe small-talk topics
weather, weekend plans, hobbies, food, travel, films and music, studies or work (in general). Avoid very personal topics (salary, religion, politics, age) with people you have just met.

## Asking open questions
Open questions (*what, how, why*) keep a conversation going better than yes/no questions:
- *What do you do in your free time?*
- *How long have you been learning English?*
- *What's the best place you've ever visited?*

## Showing interest
- *Really? That sounds amazing!* / *Oh, I didn't know that.* / *That's interesting — how did you get into that?*
- Answer and **return** the question: *I love hiking. **What about you?** / **How about you?***

## Ending politely
- *It was really nice talking to you.* / *I'd better go now, but let's talk again soon.*

## Privacy reminder
In anonymous voice calls, never share your full name, address, phone number or social media accounts.`,
    examples: [
      { text: 'A: What do you like doing at weekends? B: I usually go cycling. How about you?' },
      { text: 'That sounds fun! How did you start?' },
      { text: 'How much money do you earn?', correct: false, note: 'Too personal for small talk.' },
      { text: 'It was lovely chatting with you. Have a great day!' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Which is an open question that keeps the conversation going?', options: ['Do you like music?', 'What kind of music do you enjoy?', 'Is it raining?', 'Are you a student?'], answers: ['What kind of music do you enjoy?'], explanation: 'Open questions with "what/how/why" invite longer answers.' },
      { type: 'mcq', prompt: '“I’ve just come back from Japan.” Best response:', options: ['OK.', 'Oh, really? How was it?', 'I don’t care.', 'Japan is in Asia.'], answers: ['Oh, really? How was it?'], explanation: 'Show interest and ask a follow-up question.' },
      { type: 'mcq', prompt: 'Which topic is best for small talk with a stranger?', options: ['Their salary', 'Their religion', 'Their favourite films', 'Their home address'], answers: ['Their favourite films'], explanation: 'Films are a safe, friendly topic.' },
      { type: 'mcq', prompt: 'How do you return a question politely?', options: ['And you?', 'Why?', 'Whatever.', 'So what?'], answers: ['And you?'], explanation: '"And you?" / "What about you?" returns the question.' },
      { type: 'fill', prompt: 'Complete: "Nice to ___ you." (first meeting)', answers: ['meet'], explanation: '"Nice to meet you" is used when you meet someone for the first time.' },
    ],
  },
  {
    slug: 'polite-requests',
    title: 'Making polite requests and offers',
    track: 'general',
    pathLevel: 'beginner',
    cefrLevel: 'A2',
    category: 'everyday-english',
    summary: 'Ask for things politely in shops, at work and when travelling, and make and respond to offers.',
    body: `The way you ask for something changes how polite you sound. In English, indirect questions usually sound more polite.

## From direct to very polite
- *Give me the menu.* (sounds rude)
- *Can I have the menu, please?* (neutral, fine in most situations)
- *Could I have the menu, please?* (polite)
- *Would you mind passing me the menu?* (very polite)
- *I was wondering if you could help me.* (very polite, formal)

## Would you mind…?
*Would you mind* is followed by **-ing**: *Would you mind **opening** the window?*
To agree, say ***No, not at all*** (= I don't mind) or *Of course not.*

## Asking for permission
*Can I…? / Could I…? / May I…? / Do you mind if I…?*
*Do you mind if I sit here?* — *No, go ahead.*

## Making offers
*Can I help you? / Would you like some tea? / Shall I carry that for you? / Let me get the door.*
Responding: *Yes, please. That's very kind of you.* / *No, thanks. I'm fine.*

## Softening words
*please, just, a little, possibly*: *Could you **just** check this for me?* *Could you **possibly** speak a bit more slowly?*`,
    examples: [
      { text: 'Could you tell me where the station is, please?' },
      { text: 'Would you mind closing the door?' },
      { text: 'Would you mind to close the door?', correct: false, note: '"Would you mind" + -ing.' },
      { text: 'Shall I book a table for us?', note: 'offer' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Which request is the most polite?', options: ['Give me some water.', 'I want water.', 'Could I have some water, please?', 'Water!'], answers: ['Could I have some water, please?'], explanation: '"Could I have…, please?" is polite.' },
      { type: 'mcq', prompt: 'Would you mind ___ me with this box?', options: ['help', 'to help', 'helping', 'helped'], answers: ['helping'], explanation: '"Would you mind" is followed by -ing.' },
      { type: 'mcq', prompt: '“Do you mind if I open the window?” You agree. You say:', options: ['Yes, I do.', 'No, go ahead.', 'Yes, please mind.', 'I mind.'], answers: ['No, go ahead.'], explanation: '"No (I don\'t mind), go ahead" gives permission.' },
      { type: 'mcq', prompt: 'Which is an offer?', options: ['Shall I carry your bag?', 'Carry my bag.', 'Can you carry my bag?', 'You carried my bag.'], answers: ['Shall I carry your bag?'], explanation: '"Shall I…?" offers to do something.' },
      { type: 'fill', prompt: 'Complete: "I was ___ if you could help me." (very polite)', answers: ['wondering'], explanation: '"I was wondering if…" is a very polite way to ask.' },
    ],
  },
  {
    slug: 'opinions-agreeing',
    title: 'Giving opinions, agreeing and disagreeing',
    track: 'general',
    pathLevel: 'intermediate',
    cefrLevel: 'B1',
    category: 'everyday-english',
    summary: 'Express opinions with confidence, agree and disagree politely and support your ideas — useful for IELTS Speaking Part 3 and debates.',
    body: `## Giving your opinion
- *I think / I believe / In my opinion / From my point of view, …*
- Stronger: *I'm convinced that… / I strongly believe that…*
- Less sure: *I'm not sure, but I'd say… / I suppose… / It seems to me that…*

## Agreeing
- *I agree. / Exactly. / That's a good point. / I couldn't agree more.* (= I completely agree)
- Partly: *I agree up to a point, but… / That's true to some extent.*

## Disagreeing politely
Direct disagreement can sound rude. Soften it:
- *I'm not sure I agree. / I see what you mean, but… / That's an interesting point, but I think…*
- *I'm afraid I don't quite agree.*
Avoid: ~~You're wrong.~~ ~~That's stupid.~~

## Supporting your opinion
A good answer = **opinion + reason + example**:
*I think cities should have more parks **because** they improve mental health. **For example**, in my city a new park opened last year and it's always full of families.*

## Buying time
*That's a difficult question. / Let me think about that for a second. / Well, it depends.*
These phrases are natural and help fluency in IELTS Speaking.`,
    examples: [
      { text: 'I see what you mean, but I think public transport should be free.' },
      { text: 'I couldn’t agree more — exercise is essential for good health.' },
      { text: 'You are wrong.', correct: false, note: 'Too direct; soften it.' },
      { text: 'That’s a tricky question. Well, I’d say it depends on the person.' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Which phrase means you completely agree?', options: ['I couldn’t agree more.', 'I agree up to a point.', 'I’m not sure about that.', 'I see what you mean, but…'], answers: ['I couldn’t agree more.'], explanation: '"I couldn\'t agree more" = I agree 100%.' },
      { type: 'mcq', prompt: 'Which is the most polite way to disagree?', options: ['That’s nonsense.', 'You’re wrong.', 'I see your point, but I don’t think that’s always true.', 'No.'], answers: ['I see your point, but I don’t think that’s always true.'], explanation: 'Acknowledge the other view before giving yours.' },
      { type: 'mcq', prompt: 'A strong speaking answer includes:', options: ['only an opinion', 'an opinion, a reason and an example', 'a yes or no', 'a question back'], answers: ['an opinion, a reason and an example'], explanation: 'Support your opinion with reasons and examples.' },
      { type: 'mcq', prompt: 'Which phrase helps you buy time?', options: ['Let me think about that for a moment.', 'I don’t know.', 'Next question.', 'Yes.'], answers: ['Let me think about that for a moment.'], explanation: 'This sounds natural and gives you time to plan.' },
      { type: 'fill', prompt: 'Complete: "In my ___, schools should teach cooking."', answers: ['opinion', 'view'], explanation: '"In my opinion" / "In my view" introduce an opinion.' },
    ],
  },
  {
    slug: 'emails-and-phone',
    title: 'Emails and phone calls',
    track: 'general',
    pathLevel: 'intermediate',
    cefrLevel: 'B1',
    category: 'everyday-english',
    summary: 'Write clear formal and informal emails and handle phone calls — skills used in IELTS General Training Task 1 and at work.',
    body: `## Email structure
1. **Greeting** — formal: *Dear Mr Lee, / Dear Sir or Madam,* — informal: *Hi Tom,*
2. **Reason for writing** — *I am writing to enquire about… / I'm writing to let you know…*
3. **Details** — one paragraph per main point.
4. **Request or action** — *I would be grateful if you could… / Could you let me know…?*
5. **Closing** — formal: *I look forward to hearing from you.* — informal: *Speak soon!*
6. **Sign-off** — *Yours sincerely* (you know the name), *Yours faithfully* (Dear Sir/Madam), *Best wishes / Kind regards* (semi-formal), *Cheers / Love* (informal).

## Formal vs informal language
- *I would like to apologise for…* / *Sorry about…*
- *Please find attached…* / *I've attached…*
- *Unfortunately, I am unable to attend.* / *I'm afraid I can't make it.*
Formal emails avoid contractions and slang.

## Phone calls
- Answering: *Hello, FluentPath, Anna speaking. How can I help?*
- Asking for someone: *Could I speak to Mr Davies, please?*
- Holding: *Just a moment, please. / Hold on, I'll put you through.*
- Messages: *Can I take a message? / Could you ask her to call me back?*
- Checking: *Sorry, could you repeat that? / Could you spell that for me?*

## Spelling and numbers on the phone
Practise saying the alphabet, email addresses (*at*, *dot*) and phone numbers in groups — this also helps in IELTS Listening Section 1.`,
    examples: [
      { text: 'Dear Sir or Madam, I am writing to complain about the service I received…', note: 'formal' },
      { text: 'Hi Jo, Thanks so much for the invite! I’d love to come.', note: 'informal' },
      { text: 'Dear Sir or Madam, ... Yours sincerely,', correct: false, note: 'With "Dear Sir or Madam", use "Yours faithfully".' },
      { text: 'Could you spell your surname for me, please?' },
    ],
    exercises: [
      { type: 'mcq', prompt: 'Which opening is best for a formal complaint email?', options: ['Hey!', 'I am writing to complain about…', 'What’s up?', 'Guess what happened…'], answers: ['I am writing to complain about…'], explanation: 'State the reason for writing in formal language.' },
      { type: 'mcq', prompt: 'You start with "Dear Sir or Madam". How do you finish?', options: ['Yours faithfully', 'Cheers', 'Love', 'See ya'], answers: ['Yours faithfully'], explanation: 'British convention: "Dear Sir or Madam" → "Yours faithfully".' },
      { type: 'mcq', prompt: 'Which is more formal?', options: ['Sorry I can’t come.', 'Unfortunately, I am unable to attend.', 'Can’t make it, sorry!', 'Nope, busy.'], answers: ['Unfortunately, I am unable to attend.'], explanation: 'No contractions and more formal vocabulary.' },
      { type: 'mcq', prompt: 'On the phone, the person you want is busy. The receptionist says:', options: ['Can I take a message?', 'Go away.', 'Write an email.', 'What?'], answers: ['Can I take a message?'], explanation: 'This is the standard polite phrase.' },
      { type: 'fill', prompt: 'Complete: "I look forward to ___ from you."', answers: ['hearing'], explanation: '"Look forward to" is followed by -ing.' },
    ],
  },
];
