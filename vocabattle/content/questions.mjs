// Hand-written original questions.
//
// CONTEXT questions test the meaning of a word in a specific sentence
// (polysemy). The first option is always the correct one here; the generator
// shuffles options deterministically.
//
// GRAMMAR questions power the Grammar Battle mode and grammar practice.

const c = (level, word, sentence, options, explanation, topic = 'daily') =>
  ({ level, word, sentence, options, explanation, topic });

export const contextQuestions = [
  c('A1', 'watch', 'I looked at my watch to check the time.', ['a small clock worn on the wrist', 'to look at something for a period of time', 'to be careful about something', 'a period of guarding a place'], 'Here "watch" is a noun: the small clock you wear on your wrist.'),
  c('A1', 'kind', 'What kind of music do you like?', ['type or sort', 'friendly and helpful', 'generous with money', 'gentle with animals'], '"Kind" as a noun means "type": what type of music do you like?'),
  c('A1', 'right', 'Turn right at the traffic lights.', ['towards the right-hand side', 'correct', 'something you are legally allowed to do', 'suitable for a situation'], 'With "turn", "right" gives a direction.'),
  c('A2', 'light', 'Can you carry this box? It is very light.', ['not heavy', 'bright', 'pale in colour', 'not serious'], 'Something that is easy to carry is "light", meaning not heavy.'),
  c('A2', 'run', 'My aunt runs a small café in the town centre.', ['manages or owns', 'moves quickly on foot', 'flows like water', 'competes in an election'], 'To "run" a business means to manage it.', 'business'),
  c('A2', 'cool', 'Let us sit in the shade where it is cool.', ['slightly cold in a pleasant way', 'fashionable', 'calm and relaxed', 'unfriendly'], 'Shade makes a place pleasantly cold, so "cool" refers to temperature.'),
  c('A2', 'change', 'Have you got change for a twenty-pound note?', ['coins or smaller notes of the same total value', 'something that is different from before', 'a clean set of clothes', 'a move to a new job'], 'Asking for "change for" a note means smaller money of the same value.', 'travel'),
  c('B1', 'charge', 'The hotel will charge you for the extra night.', ['ask you to pay money', 'formally accuse you of a crime', 'fill you with electricity', 'rush towards you to attack'], 'A hotel "charges" a price: it asks you to pay.', 'travel'),
  c('B1', 'bank', 'We had a picnic on the bank of the river.', ['the land along the side of a river', 'a business that keeps money', 'a large store of something kept for later', 'a row of similar machines'], 'A river "bank" is the land at its edge.', 'environment'),
  c('B1', 'fair', 'It is not fair that he gets more money for the same work.', ['just and reasonable', 'light in colour', 'quite good but not excellent', 'an outdoor event with rides and games'], 'Equal pay for equal work is about justice, so "fair" means just.'),
  c('B1', 'present', 'All the students were present at the meeting.', ['there; in attendance', 'a gift', 'happening now', 'to show something formally'], '"Present at" a meeting means attending it.', 'education'),
  c('B1', 'match', 'These shoes do not match my dress.', ['look good together with', 'a competitive game', 'a small stick used to make fire', 'be equal to in ability'], 'Clothes that "match" look good together.'),
  c('B2', 'address', 'The government must address the housing crisis.', ['deal with a problem', 'write the location on a letter', 'give a formal speech to a crowd', 'call someone by a particular title'], 'To "address" a problem means to start dealing with it.', 'academic'),
  c('B2', 'issue', 'The library will issue new cards next week.', ['give out officially', 'an important problem', 'one edition of a magazine', 'flow or come out'], 'An organisation that "issues" cards gives them out officially.', 'education'),
  c('B2', 'settle', 'After years of travelling, they decided to settle in Canada.', ['make a permanent home', 'pay a bill', 'end an argument', 'sink slowly to the bottom'], 'After travelling, to "settle" somewhere is to make it your home.', 'travel'),
  c('B2', 'conduct', 'The researchers will conduct interviews with fifty teachers.', ['carry out', 'lead an orchestra', 'allow electricity to pass through', 'behave in a particular way'], 'Researchers "conduct" interviews: they carry them out.', 'science'),
  c('B2', 'figure', 'Sales figures for March were disappointing.', ['numbers or amounts', 'the shape of a person\'s body', 'an important person', 'a diagram in a book'], 'Sales "figures" are numbers.', 'business'),
  c('B2', 'draw', 'The exhibition is expected to draw large crowds.', ['attract', 'make a picture', 'finish a game with equal scores', 'pull something out'], 'An event that "draws" crowds attracts them.'),
  c('C1', 'bear', 'I cannot bear the noise from the building site.', ['tolerate', 'carry something heavy', 'give birth to', 'produce fruit or flowers'], '"Cannot bear" means cannot tolerate.'),
  c('C1', 'sound', 'The bridge is old but structurally sound.', ['strong and in good condition', 'producing a noise', 'deep and undisturbed', 'a narrow stretch of sea'], 'A "sound" structure is solid and safe.', 'science'),
  c('C1', 'scale', 'The company plans to scale back its operations in Europe.', ['reduce in size or amount', 'climb to the top of', 'weigh on a machine', 'remove the outer layer of'], 'To "scale back" means to reduce.', 'business'),
  c('C1', 'subject', 'All flights are subject to delay during the storm.', ['likely to be affected by', 'a topic being discussed', 'a person ruled by a monarch', 'an area of study'], '"Subject to" means likely to be affected by something.', 'travel'),
  c('C1', 'content', 'She seemed content with her quiet life in the village.', ['satisfied', 'the material contained in something', 'the amount of a substance in something', 'a list of chapters'], '"Content with" (stress on the second syllable) means satisfied.'),
  c('C2', 'minute', 'The scientist examined the minute differences between the samples.', ['extremely small', 'lasting sixty seconds', 'recorded in the notes of a meeting', 'very brief in time'], '"Minute" (pronounced my-NYOOT) as an adjective means extremely small.', 'science'),
  c('C2', 'object', 'Several residents object to the new building plans.', ['disagree with; oppose', 'a physical thing', 'a purpose or aim', 'the receiver of an action in grammar'], '"Object to" (stress on the second syllable) means to oppose.'),
  c('C2', 'temper', 'Diplomats tried to temper the minister\'s harsh remarks.', ['moderate or soften', 'become angry', 'harden metal by heating it', 'describe a person\'s mood'], 'To "temper" remarks is to make them less extreme.', 'academic'),
  c('C2', 'qualify', 'I would like to qualify my earlier statement — it is true only in some cases.', ['limit or add conditions to', 'pass the exams for a profession', 'reach the next stage of a competition', 'describe a noun'], 'To "qualify" a statement means to limit how far it applies.', 'academic'),
  c('C2', 'champion', 'She has long championed the rights of refugees.', ['actively supported', 'won a competition', 'fought physically', 'been the best at'], 'To "champion" a cause is to support and defend it publicly.', 'academic'),
];

const g = (level, topic, sentence, options, explanation) => ({ level, topic, sentence, options, explanation });

export const grammarQuestions = [
  // A1
  g('A1', 'present simple', 'She ____ to school by bus every day.', ['goes', 'go', 'going', 'is go'], 'With he/she/it, the present simple adds -s or -es: she goes.'),
  g('A1', 'articles', 'I saw ____ elephant at the zoo.', ['an', 'a', 'some', 'many'], 'Use "an" before a vowel sound: an elephant.'),
  g('A1', 'verb to be', 'They ____ my best friends.', ['are', 'is', 'am', 'be'], '"They" takes "are".'),
  g('A1', 'prepositions of time', 'The meeting is ____ Monday.', ['on', 'in', 'at', 'to'], 'Use "on" with days of the week.'),
  g('A1', 'plurals', 'There are three ____ on the table.', ['apples', 'apple', 'an apple', 'apple\'s'], 'After "three", use a plural noun.'),
  g('A1', 'possessive pronouns', 'This book is ____.', ['mine', 'my', 'me', 'I'], 'At the end of a sentence, use the possessive pronoun "mine".'),
  g('A1', 'modal verbs', 'She can ____ three languages.', ['speak', 'speaks', 'speaking', 'to speak'], 'After "can", use the base form of the verb.'),
  g('A1', 'question words', '"____ do you live?" "In London."', ['Where', 'What', 'Who', 'When'], 'The answer is a place, so the question uses "Where".'),
  // A2
  g('A2', 'past simple', 'We ____ to Spain last summer.', ['went', 'go', 'have gone', 'were go'], '"Last summer" is a finished time, so use the past simple: went.'),
  g('A2', 'comparatives', 'This exercise is ____ than the last one.', ['easier', 'more easy', 'easiest', 'easy'], 'Two-syllable adjectives ending in -y form the comparative with -ier.'),
  g('A2', 'present continuous', 'Be quiet! The baby ____.', ['is sleeping', 'sleeps', 'sleep', 'slept'], 'For an action happening now, use the present continuous.'),
  g('A2', 'prepositions of time', 'The shop opens ____ 9 a.m.', ['at', 'on', 'in', 'during'], 'Use "at" with clock times.'),
  g('A2', 'countable and uncountable nouns', 'How ____ water do you drink every day?', ['much', 'many', 'few', 'lot'], '"Water" is uncountable, so use "how much".'),
  g('A2', 'future with going to', 'Look at those dark clouds. It ____ rain.', ['is going to', 'going to', 'goes to', 'will to'], 'Use "be going to" for predictions based on present evidence.'),
  g('A2', 'superlatives', 'It was the ____ day of the year.', ['hottest', 'hotter', 'most hot', 'hot'], 'After "the", one-syllable adjectives take -est: the hottest.'),
  g('A2', 'past continuous', 'I ____ TV when the phone rang.', ['was watching', 'watched', 'am watching', 'were watching'], 'Use the past continuous for an action in progress when another action interrupted it.'),
  // B1
  g('B1', 'present perfect', 'I ____ in this city since 2019.', ['have lived', 'lived', 'am living', 'live'], '"Since" with a starting point needs the present perfect.'),
  g('B1', 'first conditional', 'If it rains tomorrow, we ____ the picnic.', ['will cancel', 'would cancel', 'cancelled', 'had cancelled'], 'First conditional: if + present simple, will + base verb.'),
  g('B1', 'passive voice', 'English ____ in many countries.', ['is spoken', 'speaks', 'is speaking', 'spoke'], 'The language receives the action, so use the present simple passive.'),
  g('B1', 'gerunds and infinitives', 'She enjoys ____ in the mountains.', ['hiking', 'to hike', 'hike', 'hiked'], '"Enjoy" is followed by the -ing form.'),
  g('B1', 'relative clauses', 'The woman ____ lives next door is a doctor.', ['who', 'which', 'whose', 'whom'], 'Use "who" for people when the relative pronoun is the subject.'),
  g('B1', 'modal verbs', 'You ____ wear a seatbelt in the car. It is the law.', ['must', 'mustn\'t', 'needn\'t', 'might'], 'A legal obligation is expressed with "must".'),
  g('B1', 'subject-verb agreement', 'Everyone in the class ____ the answer.', ['knows', 'know', 'are knowing', 'were know'], '"Everyone" is grammatically singular.'),
  g('B1', 'used to', 'When I was a child, I ____ play football every weekend.', ['used to', 'use to', 'was used to', 'am used to'], '"Used to + base verb" describes past habits.'),
  // B2
  g('B2', 'second conditional', 'If I ____ more time, I would learn to play the piano.', ['had', 'have', 'would have', 'will have'], 'Second conditional: if + past simple, would + base verb.'),
  g('B2', 'reported speech', 'He told me he ____ the film the day before.', ['had seen', 'has seen', 'sees', 'will see'], 'Reported speech moves the past back to the past perfect ("the day before").'),
  g('B2', 'passive voice', 'By the time we arrived, all the tickets ____.', ['had been sold', 'had sold', 'were selling', 'have been sold'], 'An earlier completed action in the passive uses "had been + past participle".'),
  g('B2', 'articles', '____ honesty is the best policy.', ['(no article)', 'The', 'A', 'An'], 'Abstract nouns used in a general sense take no article.'),
  g('B2', 'dependent prepositions', 'She is very good ____ solving problems.', ['at', 'in', 'on', 'for'], 'The adjective "good" takes "at" for skills.'),
  g('B2', 'non-defining relative clauses', 'My brother, ____ lives in Canada, is visiting next month.', ['who', 'that', 'which', 'whom'], '"That" cannot introduce a non-defining clause; use "who" for people.'),
  g('B2', 'wishes and regrets', 'I wish I ____ to the party last night.', ['had gone', 'went', 'have gone', 'would go'], 'Regrets about the past use wish + past perfect.'),
  g('B2', 'subject-verb agreement', 'Neither the manager nor the employees ____ happy with the decision.', ['were', 'was', 'is', 'has been'], 'With "neither … nor", the verb agrees with the nearer subject (employees).'),
  // C1
  g('C1', 'inversion', 'Not only ____ late, but he also forgot his notes.', ['was he', 'he was', 'he is', 'did he be'], 'After a negative adverbial at the start, invert the subject and auxiliary.'),
  g('C1', 'third conditional', 'If they had left earlier, they ____ the train.', ['would have caught', 'would catch', 'had caught', 'will have caught'], 'Third conditional: if + past perfect, would have + past participle.'),
  g('C1', 'mixed conditionals', 'If I had studied medicine, I ____ a doctor now.', ['would be', 'would have been', 'will be', 'had been'], 'A past condition with a present result: would + base verb.'),
  g('C1', 'participle clauses', '____ the report, she realised there was a serious error.', ['Having read', 'Had read', 'Have read', 'To have read'], '"Having + past participle" shows the first action was completed before the second.'),
  g('C1', 'subjunctive', 'The committee recommended that he ____ immediately.', ['resign', 'resigns', 'resigned', 'will resign'], 'After "recommend that", formal English uses the base-form subjunctive.'),
  g('C1', 'cleft sentences', '____ I need is a long holiday.', ['What', 'That', 'Which', 'It'], 'A "what"-cleft emphasises the thing needed.'),
  g('C1', 'unreal past', 'It is high time we ____ a decision.', ['made', 'make', 'will make', 'have made'], '"It is high time" is followed by the past simple.'),
  g('C1', 'dependent prepositions', 'The new policy is aimed ____ reducing traffic.', ['at', 'to', 'for', 'on'], 'The phrase is "aimed at".'),
  // C2
  g('C2', 'inverted conditionals', '____ you require further assistance, please contact reception.', ['Should', 'Would', 'Were', 'Had'], '"Should you…" is a formal inverted form of "If you…".'),
  g('C2', 'inversion', 'Little ____ that his life was about to change.', ['did he know', 'he knew', 'he did know', 'knew he'], 'Negative adverbs like "little" trigger auxiliary inversion.'),
  g('C2', 'inverted conditionals', '____ it not been for her help, we would have failed.', ['Had', 'Were', 'Should', 'If'], '"Had it not been for…" replaces "If it had not been for…".'),
  g('C2', 'inversion', 'Rarely ____ such a remarkable performance.', ['have I seen', 'I have seen', 'I saw', 'saw I'], '"Rarely" at the start requires inversion with the auxiliary.'),
  g('C2', 'emphatic structures', 'So ____ was the storm that all flights were cancelled.', ['severe', 'severely', 'severity', 'more severe'], '"So + adjective + be + subject + that" emphasises degree.'),
  g('C2', 'correlative structures', 'Scarcely had we sat down ____ the fire alarm went off.', ['when', 'than', 'then', 'that'], '"Scarcely … when" is the fixed pairing.'),
  g('C2', 'correlative structures', 'No sooner had she arrived ____ it started to rain.', ['than', 'when', 'then', 'as'], '"No sooner … than" is the fixed pairing.'),
  g('C2', 'inverted conditionals', 'Were the government ____ taxes, there would be protests.', ['to raise', 'raise', 'raising', 'raised'], '"Were + subject + to-infinitive" is a formal hypothetical.'),
  g('C2', 'perfect infinitives', 'She is said ____ the company in 1998.', ['to have founded', 'to found', 'having founded', 'that she founded'], 'For a past action after "is said", use the perfect infinitive.'),
];

// Near-synonym clusters: words in the same cluster are never used as each
// other's distractors (avoids two defensible answers).
export const relatedClusters = [
  ['tired', 'exhausted'],
  ['big', 'abundant', 'significant', 'comprehensive'],
  ['buy', 'purchase'],
  ['postpone', 'put off', 'cancel', 'phase out', 'give up'],
  ['improve', 'ameliorate', 'alleviate', 'mitigate', 'help', 'thrive', 'stave off'],
  ['deteriorate', 'exacerbate', 'undermine', 'affect'],
  ['dangerous', 'detrimental', 'pernicious'],
  ['ambiguous', 'equivocal', 'obfuscate', 'gloss over'],
  ['intransigent', 'recalcitrant', 'reluctant', 'ambivalent'],
  ['ubiquitous', 'global'],
  ['scrutinise', 'compare', 'diagnose', 'juxtapose'],
  ['ancient', 'obsolete'],
  ['pragmatic', 'feasible'],
  ['lucrative', 'generous', 'magnanimous'],
  ['revenue', 'salary'],
  ['proliferation', 'innovation', 'come up with'],
  ['evidence', 'empirical', 'hypothesis', 'experiment', 'paradigm'],
  ['confident', 'resilient', 'brave'],
  ['meticulous', 'careful', 'conscientious'],
  ['consequence', 'affect'],
  ['symptom', 'diagnose', 'medicine', 'doctor'],
  ['find out', 'learn'],
  ['look after', 'help'],
  ['a blessing in disguise', 'a double-edged sword'],
  ['emission', 'pollution'],
  ['device', 'computer'],
  ['bring about', 'carry out'],
  ['undermine', 'advocate'],
];
