import type { IeltsGroup } from '@fluentpath/shared';

/**
 * Listening transcripts. Each line is "Speaker: text". The audio files in apps/api/media/listening
 * are generated from exactly these transcripts by `npm run audio:generate -w apps/api`
 * (espeak-ng + MBROLA voices), so questions always match what is heard.
 */
export interface SeedListeningSection {
  id: string;
  title: string;
  context: string;
  /** speaker name -> TTS voice */
  voices: Record<string, string>;
  transcript: string;
}

export interface SeedListeningSet {
  slug: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimitSec: number;
  isPremium?: boolean;
  mockOnly?: boolean;
  sections: SeedListeningSection[];
  groups: IeltsGroup[];
}

const F = 'mb-us1'; // female (US)
const M = 'mb-us2'; // male (US)
const M2 = 'mb-us3'; // male (US)
const B = 'mb-en1'; // male (British)

export const listeningSets: SeedListeningSet[] = [
  {
    slug: 'listening-course-booking',
    title: 'Booking an evening course',
    description: 'Section 1 style: a phone conversation. Form completion and multiple choice.',
    difficulty: 'easy',
    timeLimitSec: 12 * 60,
    sections: [
      {
        id: 's1',
        title: 'Section 1 — Evening course enquiry',
        context: 'You will hear a man phoning a community college to book an evening course.',
        voices: { Receptionist: F, Daniel: B },
        transcript: `Receptionist: Good evening, Westbrook Community College. How can I help you?
Daniel: Hello. I'd like to book a place on one of your evening courses, please. I saw the photography course on your website.
Receptionist: Of course. Is that the beginners' course in digital photography?
Daniel: Yes, that's the one.
Receptionist: Lovely. Let me take some details. Can I have your name, please?
Daniel: Yes, it's Daniel Hartley.
Receptionist: Could you spell your surname for me?
Daniel: Sure. H, A, R, T, L, E, Y.
Receptionist: Thank you. And what's your address, Mr Hartley?
Daniel: It's forty-two Mill Road, in Westbrook.
Receptionist: Forty-two Mill Road. And a contact phone number?
Daniel: My mobile is oh seven nine one two, five five six, three eight four.
Receptionist: Thank you. Now, the course runs for eight weeks, every Wednesday evening, starting on the fourteenth of March.
Daniel: Wednesday is perfect. What time does it start?
Receptionist: Classes start at seven o'clock and finish at nine. The fee for the whole course is one hundred and twenty pounds, but if you're over sixty or a full-time student, there's a discount.
Daniel: No, I'm afraid I'm not either of those.
Receptionist: That's fine. You'll need to bring your own camera. Any digital camera is fine; a phone is not really suitable for this course.
Daniel: I have a camera, so that's no problem. Where are the classes held?
Receptionist: They're in the Arts Building, in room fifteen. It's on the second floor. When you come in the main entrance, the Arts Building is on your left, opposite the library.
Daniel: Great. Is there parking at the college?
Receptionist: There is a car park behind the sports hall, and it's free after six o'clock in the evening.
Daniel: Perfect. How would you like me to pay?
Receptionist: You can pay online with a card, or in person at reception. We don't accept cheques any more, I'm afraid.
Daniel: I'll pay online, then. Thank you very much.
Receptionist: You're welcome. We'll send you a confirmation email this evening.`,
      },
    ],
    groups: [
      {
        id: 'g1',
        type: 'form_completion',
        instructions: 'Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.',
        sectionId: 's1',
        title: 'Westbrook Community College — Course booking form',
        gapText: 'Course: Digital photography (beginners)\nName: Daniel {{1}}\nAddress: {{2}} Mill Road, Westbrook\nDay of classes: {{3}}\nStart time: {{4}} pm\nCourse fee: £{{5}}\nRoom: {{6}}, Arts Building',
        questions: [
          { n: 1, prompt: 'Surname', answer: ['Hartley'], explanation: 'He spells it: H-A-R-T-L-E-Y.' },
          { n: 2, prompt: 'House number', answer: ['42', 'forty-two', 'forty two'], explanation: '"It\'s forty-two Mill Road."' },
          { n: 3, prompt: 'Day', answer: ['Wednesday', 'Wednesdays'], explanation: '"every Wednesday evening".' },
          { n: 4, prompt: 'Start time', answer: ['7', 'seven', '7:00', '7.00'], explanation: '"Classes start at seven o\'clock".' },
          { n: 5, prompt: 'Fee', answer: ['120', '£120'], explanation: '"one hundred and twenty pounds".' },
          { n: 6, prompt: 'Room', answer: ['15', 'fifteen'], explanation: '"in room fifteen".' },
        ],
      },
      {
        id: 'g2',
        type: 'mcq',
        instructions: 'Choose the correct letter, A, B or C.',
        sectionId: 's1',
        questions: [
          { n: 7, prompt: 'Where is the free car park?', options: [{ key: 'A', text: 'next to the library' }, { key: 'B', text: 'behind the sports hall' }, { key: 'C', text: 'opposite the main entrance' }], answer: ['B'], explanation: '"There is a car park behind the sports hall".' },
          { n: 8, prompt: 'How will Daniel pay?', options: [{ key: 'A', text: 'by cheque' }, { key: 'B', text: 'in person at reception' }, { key: 'C', text: 'online' }], answer: ['C'], explanation: '"I\'ll pay online, then."' },
        ],
      },
    ],
  },
  {
    slug: 'listening-nature-reserve',
    title: 'Welcome to Greenhaven Nature Reserve',
    description: 'Section 2 style: a talk to visitors. Multiple choice and matching.',
    difficulty: 'medium',
    timeLimitSec: 12 * 60,
    sections: [
      {
        id: 's1',
        title: 'Section 2 — Nature reserve introduction',
        context: 'You will hear a guide welcoming visitors to a nature reserve.',
        voices: { Guide: M },
        transcript: `Guide: Good morning, everyone, and welcome to Greenhaven Nature Reserve. My name is Mark, and I'm one of the rangers here. Before you set off, I'd like to give you a short introduction to the reserve and explain a few rules.
Guide: Greenhaven covers about three hundred hectares of wetland, woodland and grassland. It was a farm until nineteen ninety-eight, when it was bought by a local wildlife trust. Since then, volunteers have planted more than fifty thousand trees and created four new lakes.
Guide: Now, let me tell you about the different areas you can visit. Starting from where we are now, at the visitor centre, the first place you'll come to is the Bird Hide. This is a small wooden building beside the largest lake, and it's the best place to watch herons and kingfishers. Please keep quiet inside, as the birds are easily disturbed.
Guide: If you continue past the lake, you'll reach Oak Wood. This is the oldest part of the reserve, and some of the trees are over four hundred years old. In spring, the ground is covered with bluebells. The path here can be muddy, so I recommend boots.
Guide: To the north of the wood is the Meadow. This was the main field when the land was a farm, and today it's full of wild flowers and butterflies in summer. It's also where we hold our outdoor events, such as guided walks for families.
Guide: Finally, near the car park you'll find the Discovery Garden. This is especially popular with younger visitors, because it has a pond where children can look for insects and frogs, and there are picnic tables too.
Guide: A few rules before you go. Dogs are welcome, but they must be kept on a lead at all times, because many birds nest on the ground. Please don't feed the wildlife, and take all your rubbish home with you, as there are no bins on the trails.
Guide: The café in the visitor centre is open until four thirty, and the reserve itself closes at six o'clock. If you'd like to join a guided walk, there's one at two o'clock this afternoon, starting from the Meadow. It's free, but you'll need to sign up at the information desk. Enjoy your visit!`,
      },
    ],
    groups: [
      {
        id: 'g1',
        type: 'mcq',
        instructions: 'Choose the correct letter, A, B or C.',
        sectionId: 's1',
        questions: [
          { n: 1, prompt: 'What was Greenhaven before it became a nature reserve?', options: [{ key: 'A', text: 'a farm' }, { key: 'B', text: 'a golf course' }, { key: 'C', text: 'a factory site' }], answer: ['A'], explanation: '"It was a farm until nineteen ninety-eight".' },
          { n: 2, prompt: 'Since the reserve opened, volunteers have', options: [{ key: 'A', text: 'built a new visitor centre.' }, { key: 'B', text: 'planted over fifty thousand trees.' }, { key: 'C', text: 'created three lakes.' }], answer: ['B'], explanation: '"volunteers have planted more than fifty thousand trees and created four new lakes".' },
          { n: 3, prompt: 'Why must dogs be kept on a lead?', options: [{ key: 'A', text: 'There are farm animals nearby.' }, { key: 'B', text: 'Many birds nest on the ground.' }, { key: 'C', text: 'The paths are narrow.' }], answer: ['B'], explanation: '"because many birds nest on the ground".' },
          { n: 4, prompt: 'What must visitors do to join the guided walk?', options: [{ key: 'A', text: 'pay at the café' }, { key: 'B', text: 'sign up at the information desk' }, { key: 'C', text: 'meet at the car park' }], answer: ['B'], explanation: '"you\'ll need to sign up at the information desk".' },
        ],
      },
      {
        id: 'g2',
        type: 'matching_features',
        instructions: 'What does the guide say about each area? Choose the correct letter, A–F, for questions 5–8.',
        sectionId: 's1',
        options: [
          { key: 'A', text: 'has very old trees' },
          { key: 'B', text: 'is good for watching birds' },
          { key: 'C', text: 'is closed in winter' },
          { key: 'D', text: 'is suitable for children' },
          { key: 'E', text: 'is used for outdoor events' },
          { key: 'F', text: 'has a gift shop' },
        ],
        questions: [
          { n: 5, prompt: 'Bird Hide', answer: ['B'], explanation: '"the best place to watch herons and kingfishers".' },
          { n: 6, prompt: 'Oak Wood', answer: ['A'], explanation: '"some of the trees are over four hundred years old".' },
          { n: 7, prompt: 'Meadow', answer: ['E'], explanation: '"it\'s also where we hold our outdoor events".' },
          { n: 8, prompt: 'Discovery Garden', answer: ['D'], explanation: '"especially popular with younger visitors" with a pond for children.' },
        ],
      },
      {
        id: 'g3',
        type: 'sentence_completion',
        instructions: 'Complete the sentences below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
        sectionId: 's1',
        questions: [
          { n: 9, prompt: 'The reserve closes at ______.', answer: ['6', 'six', "six o'clock", '6 pm', '6:00'], explanation: '"the reserve itself closes at six o\'clock".' },
          { n: 10, prompt: 'Today’s guided walk starts at ______ in the afternoon.', answer: ['2', 'two', "two o'clock", '2 pm', '2:00'], explanation: '"there\'s one at two o\'clock this afternoon".' },
        ],
      },
    ],
  },
  {
    slug: 'listening-research-project',
    title: 'Planning a research project',
    description: 'Section 3 style: two students and a tutor discuss a project. Multiple choice and matching.',
    difficulty: 'medium',
    timeLimitSec: 12 * 60,
    isPremium: false,
    sections: [
      {
        id: 's1',
        title: 'Section 3 — Project tutorial',
        context: 'You will hear two students, Emma and Raj, discussing their research project with their tutor, Dr Collins.',
        voices: { 'Dr Collins': B, Emma: F, Raj: M2 },
        transcript: `Dr Collins: Come in, both of you. So, you wanted to talk about your research project on how students use the university library.
Emma: Yes. We've done some initial reading, and we've decided to focus on whether students still use printed books, or whether they mostly use online resources now.
Dr Collins: That's a good, focused question. How are you planning to collect your data?
Raj: We thought about interviews at first, but they take a long time to arrange and analyse. So we're going to use an online questionnaire instead, and send it to all second-year students.
Dr Collins: That makes sense. But be careful with online surveys; the response rate can be quite low. What will you do about that?
Emma: We're planning to offer a small prize. Everyone who completes the questionnaire can enter a draw to win a book voucher.
Dr Collins: Good idea. Now, have you thought about observation? Simply counting how many people use the book shelves at different times could give you useful data that doesn't depend on what people say they do.
Raj: We hadn't thought of that. I suppose people might say they use books more than they actually do.
Dr Collins: Exactly. People often give the answer they think is expected. Observation would help you check your survey results.
Emma: Could we do the observation in the main reading room?
Dr Collins: I'd suggest the science section on the third floor, as it has both books and computers, so you can compare the two easily.
Raj: OK. And how should we divide the work between us?
Dr Collins: What are your strengths?
Raj: Well, I'm quite good with statistics, so I could analyse the questionnaire data.
Emma: And I enjoy writing, so I could write the literature review and do most of the final report. But I'd like to do some of the observation too.
Dr Collins: That sounds sensible. Raj, perhaps you could design the questionnaire as well, since you'll be analysing it.
Raj: Fine.
Dr Collins: One more thing. Your project proposal is due on the twentieth of October. It should be no longer than one thousand words, and remember to include a timetable showing when you'll complete each stage.
Emma: Thank you. That's really helpful.`,
      },
    ],
    groups: [
      {
        id: 'g1',
        type: 'mcq',
        instructions: 'Choose the correct letter, A, B or C.',
        sectionId: 's1',
        questions: [
          { n: 1, prompt: 'Why did the students decide not to use interviews?', options: [{ key: 'A', text: 'Students did not want to be interviewed.' }, { key: 'B', text: 'Interviews are slow to organise and analyse.' }, { key: 'C', text: 'Their tutor advised against them.' }], answer: ['B'], explanation: 'Raj: interviews "take a long time to arrange and analyse".' },
          { n: 2, prompt: 'How will they try to increase the number of responses?', options: [{ key: 'A', text: 'by sending reminders' }, { key: 'B', text: 'by making the questionnaire shorter' }, { key: 'C', text: 'by offering the chance to win a prize' }], answer: ['C'], explanation: '"Everyone who completes the questionnaire can enter a draw to win a book voucher."' },
          { n: 3, prompt: 'Why does Dr Collins recommend observation?', options: [{ key: 'A', text: 'It is quicker than a survey.' }, { key: 'B', text: 'People may not report their behaviour accurately.' }, { key: 'C', text: 'The library requires it.' }], answer: ['B'], explanation: '"People often give the answer they think is expected."' },
          { n: 4, prompt: 'Where does Dr Collins suggest doing the observation?', options: [{ key: 'A', text: 'the main reading room' }, { key: 'B', text: 'the science section' }, { key: 'C', text: 'the computer laboratory' }], answer: ['B'], explanation: '"I\'d suggest the science section on the third floor".' },
        ],
      },
      {
        id: 'g2',
        type: 'matching_features',
        instructions: 'Who will do each task? Choose A for Emma, B for Raj or C for both.',
        sectionId: 's1',
        options: [{ key: 'A', text: 'Emma' }, { key: 'B', text: 'Raj' }, { key: 'C', text: 'both Emma and Raj' }],
        questions: [
          { n: 5, prompt: 'analyse the questionnaire data', answer: ['B'], explanation: 'Raj: "I could analyse the questionnaire data."' },
          { n: 6, prompt: 'write the literature review', answer: ['A'], explanation: 'Emma: "I could write the literature review".' },
          { n: 7, prompt: 'design the questionnaire', answer: ['B'], explanation: 'Dr Collins suggests Raj designs it; Raj agrees.' },
        ],
      },
      {
        id: 'g3',
        type: 'note_completion',
        instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
        sectionId: 's1',
        title: 'Project proposal',
        gapText: '• Deadline: {{8}} October\n• Maximum length: {{9}} words\n• Must include a {{10}} for each stage',
        questions: [
          { n: 8, prompt: 'Gap 8', answer: ['20', '20th', 'twentieth'], explanation: '"due on the twentieth of October".' },
          { n: 9, prompt: 'Gap 9', answer: ['1000', '1,000', 'one thousand'], explanation: '"no longer than one thousand words".' },
          { n: 10, prompt: 'Gap 10', answer: ['timetable'], explanation: '"include a timetable showing when you\'ll complete each stage".' },
        ],
      },
    ],
  },
  {
    slug: 'listening-history-of-tea',
    title: 'Lecture: how tea conquered the world',
    description: 'Section 4 style: an academic lecture. Note completion.',
    difficulty: 'hard',
    timeLimitSec: 12 * 60,
    isPremium: true,
    sections: [
      {
        id: 's1',
        title: 'Section 4 — History lecture',
        context: 'You will hear part of a lecture about the history of tea.',
        voices: { Lecturer: F },
        transcript: `Lecturer: Good afternoon. Today I'm going to talk about one of the most widely consumed drinks in the world: tea. After water, it's thought to be the most popular drink on the planet.
Lecturer: Tea comes from the leaves of a single plant, Camellia sinensis, which originally grew in the region where China, India and Myanmar meet. According to a famous Chinese legend, tea was discovered almost five thousand years ago, when leaves blew into a pot of water being boiled for an emperor. Historians, of course, treat this story with caution. What we do know is that by the time of the Tang dynasty, around the eighth century, tea drinking had become an important part of Chinese culture, and a writer called Lu Yu produced the first book devoted entirely to tea.
Lecturer: Tea reached Japan through Buddhist monks, who used it to stay awake during long periods of meditation. Over time, this developed into the Japanese tea ceremony, which places great emphasis on calm and respect.
Lecturer: Europeans did not encounter tea until the sixteenth century, through Portuguese traders. It became fashionable in Britain in the sixteen sixties, partly because the Portuguese princess Catherine of Braganza, who married the English king, was a keen tea drinker. At first, tea was extremely expensive, and it was often kept in locked wooden boxes called tea caddies, so that servants could not take any.
Lecturer: High taxes on tea led to widespread smuggling. By the seventeen seventies, it's estimated that more tea was being brought into Britain illegally than legally. When the government reduced the tax dramatically in seventeen eighty-four, smuggling almost disappeared, and tea quickly became an everyday drink for ordinary people.
Lecturer: In the nineteenth century, Britain wanted to reduce its dependence on China, so it began growing tea on a large scale in India, particularly in the region of Assam. This had serious human costs, as many plantation workers lived and worked in very poor conditions.
Lecturer: Finally, a word about two more recent inventions. The tea bag was invented by accident in the United States in the early twentieth century, when a merchant sent samples in small silk bags and customers put the bags straight into hot water. And iced tea became popular after it was served at a world fair in St Louis in nineteen oh four, during a very hot summer.`,
      },
    ],
    groups: [
      {
        id: 'g1',
        type: 'note_completion',
        instructions: 'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.',
        sectionId: 's1',
        title: 'The history of tea',
        gapText: 'Origins\n• Legend: discovered nearly {{1}} years ago\n• Tang dynasty: Lu Yu wrote the first {{2}} about tea\n\nJapan\n• Introduced by Buddhist {{3}} to help them stay awake\n\nBritain\n• Became fashionable in the 1660s, helped by a Portuguese {{4}}\n• Kept in locked boxes so that {{5}} could not take it\n• High taxes caused {{6}}\n• Tax reduced in {{7}}\n\nIndia\n• Large-scale growing, especially in {{8}}\n\nModern inventions\n• Tea bag: samples were sent in small bags made of {{9}}\n• Iced tea: popular after a world fair during a hot {{10}}',
        questions: [
          { n: 1, prompt: 'Gap 1', answer: ['5000', '5,000', 'five thousand'], explanation: '"almost five thousand years ago".' },
          { n: 2, prompt: 'Gap 2', answer: ['book'], explanation: '"the first book devoted entirely to tea".' },
          { n: 3, prompt: 'Gap 3', answer: ['monks'], explanation: '"through Buddhist monks, who used it to stay awake".' },
          { n: 4, prompt: 'Gap 4', answer: ['princess'], explanation: '"the Portuguese princess Catherine of Braganza".' },
          { n: 5, prompt: 'Gap 5', answer: ['servants'], explanation: '"so that servants could not take any".' },
          { n: 6, prompt: 'Gap 6', answer: ['smuggling'], explanation: '"High taxes on tea led to widespread smuggling."' },
          { n: 7, prompt: 'Gap 7', answer: ['1784'], explanation: '"in seventeen eighty-four".' },
          { n: 8, prompt: 'Gap 8', answer: ['Assam'], explanation: '"particularly in the region of Assam".' },
          { n: 9, prompt: 'Gap 9', answer: ['silk'], explanation: '"in small silk bags".' },
          { n: 10, prompt: 'Gap 10', answer: ['summer'], explanation: '"during a very hot summer".' },
        ],
      },
    ],
  },
  {
    slug: 'mock-listening-apartment-heat',
    title: 'Mock listening: renting a flat / urban heat',
    description: 'Mock test listening (two sections).',
    difficulty: 'medium',
    timeLimitSec: 20 * 60,
    mockOnly: true,
    sections: [
      {
        id: 's1',
        title: 'Part 1 — Renting a flat',
        context: 'You will hear a woman asking a letting agent about a flat.',
        voices: { Agent: M, Sofia: F },
        transcript: `Agent: Good morning, City Homes letting agency. Peter speaking.
Sofia: Hi, I'm calling about the one-bedroom flat on Station Street that's advertised on your website.
Agent: Ah yes, number eighteen Station Street. It's still available. What would you like to know?
Sofia: First of all, how much is the rent?
Agent: It's eight hundred and fifty pounds a month. That includes water, but not electricity or internet.
Sofia: OK. And is it furnished?
Agent: It's partly furnished. There's a bed, a sofa and a dining table, and the kitchen has a fridge and a washing machine, but there's no dishwasher.
Sofia: That's fine. Which floor is it on?
Agent: It's on the fourth floor, and I should mention there's no lift in the building.
Sofia: Hmm, that's a lot of stairs. Is there anywhere to keep a bicycle?
Agent: Yes, there's a secure bike store in the basement, which tenants can use free of charge.
Sofia: Great. When could I move in?
Agent: The current tenant leaves at the end of this month, so it's available from the first of June. We ask for a deposit equal to six weeks' rent, and you'd need to sign a contract for at least twelve months.
Sofia: Could I arrange a viewing?
Agent: Certainly. How about Thursday at half past five?
Sofia: That works for me.
Agent: Can I take your name, please?
Sofia: Sofia Brennan. That's B, R, E, N, N, A, N.
Agent: Thank you, Ms Brennan. I'll see you on Thursday.`,
      },
      {
        id: 's2',
        title: 'Part 2 — Lecture on urban heat islands',
        context: 'You will hear part of a lecture about why cities are hotter than the countryside.',
        voices: { Lecturer: B },
        transcript: `Lecturer: In today's lecture, I'll be looking at a phenomenon known as the urban heat island effect. Put simply, cities are often significantly warmer than the surrounding countryside. On a summer evening, the difference can be as much as seven degrees Celsius.
Lecturer: There are several causes. The first is the materials we build with. Concrete, brick and asphalt absorb heat from the sun during the day and release it slowly at night, which is why the effect is usually strongest after dark.
Lecturer: The second cause is the lack of vegetation. Trees and plants cool the air through a process called evapotranspiration, in which water evaporates from their leaves. Where green space is replaced by buildings and roads, this natural cooling is lost.
Lecturer: Third, human activity itself produces heat. Vehicles, factories and, increasingly, air conditioning units all release waste heat into the street. This creates a cycle: hotter cities lead to more air conditioning, which in turn makes the streets hotter.
Lecturer: The consequences are serious. Higher temperatures increase energy use and can worsen air quality, and during heatwaves they are linked to higher rates of illness, especially among elderly people.
Lecturer: Fortunately, there are solutions. Painting roofs white or using reflective materials can reduce the amount of heat buildings absorb. Some cities, such as Singapore, require new developments to include green roofs or walls covered in plants. And simply planting more trees along streets can lower local temperatures by several degrees, while also providing shade for pedestrians.`,
      },
    ],
    groups: [
      {
        id: 'g1',
        type: 'form_completion',
        instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
        sectionId: 's1',
        title: 'Flat enquiry',
        gapText: 'Address: {{1}} Station Street\nRent: £{{2}} per month (includes water)\nKitchen: fridge and {{3}}\nFloor: {{4}} (no lift)\nAvailable from: 1st {{5}}\nViewing: Thursday at 5.30\nName: Sofia {{6}}',
        questions: [
          { n: 1, prompt: 'Number', answer: ['18', 'eighteen'], explanation: '"number eighteen Station Street".' },
          { n: 2, prompt: 'Rent', answer: ['850', '£850'], explanation: '"eight hundred and fifty pounds a month".' },
          { n: 3, prompt: 'Kitchen', answer: ['washing machine', 'washing-machine'], explanation: '"the kitchen has a fridge and a washing machine".' },
          { n: 4, prompt: 'Floor', answer: ['4th', 'fourth', '4'], explanation: '"It\'s on the fourth floor".' },
          { n: 5, prompt: 'Month', answer: ['June'], explanation: '"available from the first of June".' },
          { n: 6, prompt: 'Surname', answer: ['Brennan'], explanation: 'Spelled B-R-E-N-N-A-N.' },
        ],
      },
      {
        id: 'g2',
        type: 'mcq',
        instructions: 'Choose the correct letter, A, B or C.',
        sectionId: 's1',
        questions: [
          { n: 7, prompt: 'What is the minimum length of the contract?', options: [{ key: 'A', text: 'six months' }, { key: 'B', text: 'twelve months' }, { key: 'C', text: 'six weeks' }], answer: ['B'], explanation: '"a contract for at least twelve months".' },
        ],
      },
      {
        id: 'g3',
        type: 'note_completion',
        instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
        sectionId: 's2',
        title: 'Urban heat islands',
        gapText: '• Cities can be up to {{8}} degrees warmer on summer evenings\n• Building materials release heat slowly at {{9}}\n• Plants cool the air through evapotranspiration from their {{10}}\n• Increased use of {{11}} adds waste heat\n• Heatwaves especially affect {{12}} people\n• Solutions: white or reflective roofs, green roofs, planting {{13}}',
        questions: [
          { n: 8, prompt: 'Gap 8', answer: ['7', 'seven'], explanation: '"as much as seven degrees Celsius".' },
          { n: 9, prompt: 'Gap 9', answer: ['night'], explanation: '"release it slowly at night".' },
          { n: 10, prompt: 'Gap 10', answer: ['leaves'], explanation: '"water evaporates from their leaves".' },
          { n: 11, prompt: 'Gap 11', answer: ['air conditioning', 'air-conditioning'], explanation: '"air conditioning units all release waste heat".' },
          { n: 12, prompt: 'Gap 12', answer: ['elderly', 'older'], explanation: '"especially among elderly people".' },
          { n: 13, prompt: 'Gap 13', answer: ['trees'], explanation: '"simply planting more trees along streets".' },
        ],
      },
    ],
  },
];
