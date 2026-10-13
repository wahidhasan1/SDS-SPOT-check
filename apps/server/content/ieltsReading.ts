// Original IELTS-style reading material (written for this app; not taken from any official test).
// content.groups[].template uses {{qId}} markers for gap-fill inputs.
export interface SetSeed {
  slug: string;
  skill: 'reading' | 'listening';
  testType: 'academic' | 'general' | 'both';
  title: string;
  description: string;
  difficulty: string;
  timeLimitSec: number;
  isPremium?: boolean;
  content: any;
  answers: Record<string, { accepted: string[]; explanation: string; maxWords?: number }>;
}

const TFNG = ['TRUE', 'FALSE', 'NOT GIVEN'];
const YNNG = ['YES', 'NO', 'NOT GIVEN'];

export const READING_SETS: SetSeed[] = [
  {
    slug: 'academic-reading-urban-bees',
    skill: 'reading',
    testType: 'academic',
    title: 'The Return of the Urban Beekeeper',
    description: 'Academic Reading Passage · True/False/Not Given, sentence completion, multiple choice',
    difficulty: 'Band 5.5–7',
    timeLimitSec: 20 * 60,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'The Return of the Urban Beekeeper',
          paragraphs: [
            { label: 'A', text: 'Twenty years ago, the idea of keeping bees on the roof of an office block would have struck most city planners as eccentric. Today, hives can be found on top of hotels, railway stations and even government buildings in cities from London to Tokyo. In Paris alone, more than 2,000 hives were registered in 2022, roughly ten times the number recorded in 2010.' },
            { label: 'B', text: 'Supporters of urban beekeeping point to several advantages. Cities are often warmer than the surrounding countryside, so bees may begin foraging earlier in spring. Parks, gardens and tree-lined streets provide a wide variety of flowers over a long season, and urban bees are generally exposed to fewer agricultural pesticides than their rural counterparts. Honey produced in cities has even won national competitions, a fact that its producers are keen to advertise.' },
            { label: 'C', text: 'However, some ecologists have begun to question whether the boom is as beneficial as it appears. Their concern is not the honeybee itself, but the many species of wild bee that share the same food sources. Unlike the honeybee, which lives in colonies of up to 50,000 individuals, most wild bees are solitary, nesting alone in the ground or in hollow stems. A study in Paris found that as hive numbers rose, visits by wild pollinators to urban flowers fell, suggesting that the two groups were competing for limited supplies of nectar and pollen.' },
            { label: 'D', text: 'The density of hives appears to be the critical factor. Researchers in Montreal estimated that a single honeybee colony may require the flowers of several hectares to support itself. Where dozens of hives are concentrated in a small district, there may simply not be enough flowers to go round. The researchers recommended that cities collect data on how many flowering plants an area contains before approving new hives, rather than issuing permits on request.' },
            { label: 'E', text: 'Disease is a second concern. Honeybees can carry viruses and parasites that spread to wild species when they visit the same flowers. Beekeepers in rural areas are usually required to inspect their colonies regularly, but in many cities hobbyists face no such obligation, and a number of urban hives are installed by companies as a marketing gesture and then managed only occasionally by outside contractors.' },
            { label: 'F', text: 'None of this means that urban beekeeping should be abandoned. Instead, many experts argue that cities would do more for pollinators by planting a greater variety of native flowers and leaving areas of bare soil and dead wood where solitary bees can nest. Some councils have already responded. In 2021, one London borough agreed to stop issuing new permits for rooftop hives in its centre and to spend the money it had earmarked for promotional events on wildflower planting instead. As one ecologist put it, ‘If you want to help bees, plant flowers, not hives.’' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1', passageId: 'p1', type: 'tfng', title: 'Questions 1–5',
          instructions: 'Do the following statements agree with the information given in the passage? Choose TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.',
          options: TFNG,
          questions: [
            { id: 'q1', number: 1, text: 'In 2010, there were approximately 200 registered hives in Paris.' },
            { id: 'q2', number: 2, text: 'Bees in cities may start searching for food earlier in spring than bees in the countryside.' },
            { id: 'q3', number: 3, text: 'Honey from urban hives usually sells for a higher price than rural honey.' },
            { id: 'q4', number: 4, text: 'Most species of wild bee live in large colonies.' },
            { id: 'q5', number: 5, text: 'In many cities, amateur beekeepers are required to inspect their hives regularly.' },
          ],
        },
        {
          id: 'g2', passageId: 'p1', type: 'sentence_completion', title: 'Questions 6–9',
          instructions: 'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
          maxWords: 2,
          template: [
            'Most wild bees nest either in the ground or in {{q6}}.',
            'According to researchers in Montreal, the most important factor is the {{q7}} of hives.',
            'The Montreal researchers advised cities to count the {{q8}} in an area before approving hives.',
            'Some companies install hives as a {{q9}} and rarely manage them themselves.',
          ],
          questions: [
            { id: 'q6', number: 6 }, { id: 'q7', number: 7 }, { id: 'q8', number: 8 }, { id: 'q9', number: 9 },
          ],
        },
        {
          id: 'g3', passageId: 'p1', type: 'mcq', title: 'Questions 10–13',
          instructions: 'Choose the correct letter, A, B, C or D.',
          questions: [
            { id: 'q10', number: 10, text: 'What point is made in paragraph B?', options: ['A  Urban honey has won national awards.', 'B  City bees produce more honey than rural bees.', 'C  Pesticides have been banned in cities.', 'D  Bees prefer trees to garden flowers.'] },
            { id: 'q11', number: 11, text: 'The ecologists’ main concern about urban beekeeping is that', options: ['A  honeybees are becoming more aggressive.', 'B  wild bees may not have enough food.', 'C  hives are too expensive to maintain.', 'D  honeybee colonies are shrinking.'] },
            { id: 'q12', number: 12, text: 'What did one London borough decide to do in 2021?', options: ['A  ban all hives across the borough', 'B  hold more promotional events about bees', 'C  spend money on wildflowers instead', 'D  inspect every rooftop hive'] },
            { id: 'q13', number: 13, text: 'Which statement best summarises the writer’s view?', options: ['A  Urban beekeeping should be banned.', 'B  Urban beekeeping causes no harm.', 'C  Cities should focus more on habitats for wild pollinators.', 'D  Honeybees matter more than wild bees.'] },
          ],
        },
      ],
    },
    answers: {
      q1: { accepted: ['TRUE'], explanation: 'Paragraph A: 2,000 hives in 2022 was “roughly ten times” the 2010 figure, so about 200.' },
      q2: { accepted: ['TRUE'], explanation: 'Paragraph B: cities are warmer, “so bees may begin foraging earlier in spring”.' },
      q3: { accepted: ['NOT GIVEN'], explanation: 'Paragraph B mentions competitions but says nothing about prices.' },
      q4: { accepted: ['FALSE'], explanation: 'Paragraph C: “most wild bees are solitary, nesting alone”.' },
      q5: { accepted: ['FALSE'], explanation: 'Paragraph E: in many cities “hobbyists face no such obligation”.' },
      q6: { accepted: ['hollow stems'], explanation: 'Paragraph C: “nesting alone in the ground or in hollow stems”.', maxWords: 2 },
      q7: { accepted: ['density'], explanation: 'Paragraph D: “The density of hives appears to be the critical factor.”', maxWords: 2 },
      q8: { accepted: ['flowering plants'], explanation: 'Paragraph D: collect data on “how many flowering plants an area contains”.', maxWords: 2 },
      q9: { accepted: ['marketing gesture'], explanation: 'Paragraph E: installed “as a marketing gesture”.', maxWords: 2 },
      q10: { accepted: ['A'], explanation: 'Paragraph B: “Honey produced in cities has even won national competitions.”' },
      q11: { accepted: ['B'], explanation: 'Paragraph C: wild bees compete for “limited supplies of nectar and pollen”.' },
      q12: { accepted: ['C'], explanation: 'Paragraph F: money earmarked for events was spent on wildflower planting.' },
      q13: { accepted: ['C'], explanation: 'Paragraph F: experts argue cities should plant native flowers and leave nesting areas.' },
    },
  },
  {
    slug: 'reading-fog-harvesting',
    skill: 'reading',
    testType: 'both',
    title: 'Harvesting the Fog',
    description: 'Matching headings, summary completion with a word box, matching features',
    difficulty: 'Band 6–7.5',
    timeLimitSec: 20 * 60,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Harvesting the Fog',
          paragraphs: [
            { label: 'A', text: 'On the coast of the Atacama Desert in Chile, one of the driest places on Earth, rain may not fall for years at a time. Yet on many mornings, dense banks of fog drift in from the Pacific Ocean and roll over the coastal hills. For centuries this moisture passed by largely unused. Since the 1980s, however, communities in the region have experimented with a strikingly simple technology to capture it: the fog collector.' },
            { label: 'B', text: 'A standard fog collector consists of a rectangular mesh net, typically about 40 square metres in area, stretched between two posts and positioned at right angles to the prevailing wind. As fog passes through the net, tiny droplets of water collide with the fibres and merge into larger drops. These run down the mesh into a gutter at the bottom, from which a pipe carries the water to a storage tank. No power source is needed, and the materials are cheap and widely available.' },
            { label: 'C', text: 'The amount of water collected varies enormously. On a good site, a single large collector may yield 200 litres or more on a foggy day, but output can drop to almost nothing during clear spells. Location is therefore critical. Engineers survey potential sites for months using small test collectors before building full-scale arrays, looking for ridges where fog is frequent and winds are steady but not so strong that they damage the nets.' },
            { label: 'D', text: 'Early projects produced encouraging results, but several were later abandoned. In one well-known case in northern Chile, a village received water from fog collectors for more than a decade, but when the government extended a conventional water pipeline to the area, residents stopped maintaining the nets, which gradually fell into disrepair. Analysts concluded that technical success alone was not enough: projects needed local people to have a sense of ownership and clear responsibility for upkeep.' },
            { label: 'E', text: 'Recent designs have aimed to improve efficiency. Researchers at the Massachusetts Institute of Technology found that the polypropylene mesh used in most early collectors captured only around two per cent of the water in the fog passing through it. By altering the size of the holes and coating the fibres with a material that helps droplets slide off quickly, they reported capture rates up to five times higher in laboratory tests.' },
            { label: 'F', text: 'Fog collection is unlikely ever to supply a large city. Its value lies instead in small-scale applications: providing drinking water for remote villages, irrigating tree nurseries, or supporting reforestation on bare hillsides, where young trees can eventually capture fog with their own leaves. In Morocco, a project established in 2006 now supplies several hundred people across a number of mountain villages, and has been widely cited as a model of community involvement.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1', passageId: 'p1', type: 'matching_headings', title: 'Questions 1–6',
          instructions: 'The passage has six paragraphs, A–F. Choose the correct heading for each paragraph from the list of headings below.',
          headings: [
            { key: 'i', text: 'A low-cost method requiring no electricity' },
            { key: 'ii', text: 'Why choosing the right place matters' },
            { key: 'iii', text: 'The limits and best uses of the technology' },
            { key: 'iv', text: 'A source of water in an extremely dry region' },
            { key: 'v', text: 'Making the nets catch more water' },
            { key: 'vi', text: 'When people stop caring for the equipment' },
            { key: 'vii', text: 'The high cost of building pipelines' },
            { key: 'viii', text: 'Fog as a danger to coastal shipping' },
          ],
          questions: [
            { id: 'q1', number: 1, text: 'Paragraph A' }, { id: 'q2', number: 2, text: 'Paragraph B' }, { id: 'q3', number: 3, text: 'Paragraph C' },
            { id: 'q4', number: 4, text: 'Paragraph D' }, { id: 'q5', number: 5, text: 'Paragraph E' }, { id: 'q6', number: 6, text: 'Paragraph F' },
          ],
        },
        {
          id: 'g2', passageId: 'p1', type: 'summary_completion', title: 'Questions 7–10',
          instructions: 'Complete the summary using the list of words, A–H, below. Write the correct letter.',
          wordBox: [
            { key: 'A', text: 'net' }, { key: 'B', text: 'gutter' }, { key: 'C', text: 'coating' }, { key: 'D', text: 'small' },
            { key: 'E', text: 'pump' }, { key: 'F', text: 'large' }, { key: 'G', text: 'roof' }, { key: 'H', text: 'filter' },
          ],
          template: [
            'A fog collector is made from a large {{q7}} held between two posts. Droplets join together and flow into a {{q8}}, then through a pipe to a storage tank. Before building, engineers spend months testing sites with {{q9}} collectors. Researchers at MIT improved performance by changing the size of the holes and adding a {{q10}} to the fibres.',
          ],
          questions: [{ id: 'q7', number: 7 }, { id: 'q8', number: 8 }, { id: 'q9', number: 9 }, { id: 'q10', number: 10 }],
        },
        {
          id: 'g3', passageId: 'p1', type: 'matching_features', title: 'Questions 11–13',
          instructions: 'Match each statement with the correct place, A, B or C.',
          features: [
            { key: 'A', text: 'Chile' }, { key: 'B', text: 'Massachusetts (MIT)' }, { key: 'C', text: 'Morocco' },
          ],
          questions: [
            { id: 'q11', number: 11, text: 'a scheme serving several hundred people in mountain villages' },
            { id: 'q12', number: 12, text: 'laboratory tests showing much higher capture rates' },
            { id: 'q13', number: 13, text: 'a village that stopped using fog water after a pipeline arrived' },
          ],
        },
      ],
    },
    answers: {
      q1: { accepted: ['iv'], explanation: 'A describes the Atacama, “one of the driest places on Earth”, and its fog.' },
      q2: { accepted: ['i'], explanation: 'B: “No power source is needed, and the materials are cheap.”' },
      q3: { accepted: ['ii'], explanation: 'C: “Location is therefore critical.”' },
      q4: { accepted: ['vi'], explanation: 'D: residents “stopped maintaining the nets”.' },
      q5: { accepted: ['v'], explanation: 'E: changes gave capture rates “up to five times higher”.' },
      q6: { accepted: ['iii'], explanation: 'F: “unlikely ever to supply a large city … value lies instead in small-scale applications”.' },
      q7: { accepted: ['A'], explanation: 'B: “a rectangular mesh net”.' },
      q8: { accepted: ['B'], explanation: 'B: drops “run down the mesh into a gutter”.' },
      q9: { accepted: ['D'], explanation: 'C: “using small test collectors”.' },
      q10: { accepted: ['C'], explanation: 'E: “coating the fibres with a material”.' },
      q11: { accepted: ['C'], explanation: 'F: the Moroccan project supplies several hundred people.' },
      q12: { accepted: ['B'], explanation: 'E: MIT reported higher rates “in laboratory tests”.' },
      q13: { accepted: ['A'], explanation: 'D: a village in northern Chile stopped maintaining the nets after a pipeline.' },
    },
  },
  {
    slug: 'academic-reading-sleep-memory',
    skill: 'reading',
    testType: 'academic',
    title: 'Sleep and the Making of Memories',
    description: 'Yes/No/Not Given, matching sentence endings, table and flow-chart completion',
    difficulty: 'Band 6.5–8',
    timeLimitSec: 20 * 60,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Sleep and the Making of Memories',
          paragraphs: [
            { label: 'A', text: 'For much of the twentieth century, sleep was regarded by many scientists as a passive state — a period in which the brain simply switched off to rest. That view now looks mistaken. Over the past three decades, a large body of research has shown that the sleeping brain is highly active, and that one of its most important tasks is to strengthen and reorganise memories formed during the day.' },
            { label: 'B', text: 'The process, known as memory consolidation, appears to depend on different stages of sleep. During deep or ‘slow-wave’ sleep, which dominates the first half of the night, the hippocampus — a structure that briefly stores new information — appears to replay recent experiences. These replays are thought to transfer information gradually to the cortex, where it can be kept for the long term. Rapid eye movement (REM) sleep, which becomes more frequent towards morning, seems to play a different role, helping the brain to find connections between memories and to process emotional experiences.' },
            { label: 'C', text: 'Evidence for these claims comes from a variety of experiments. In one classic design, volunteers learn a list of word pairs in the evening and are tested twelve hours later, either after a night’s sleep or after a day awake. Those who sleep typically remember significantly more. In another, participants are trained on a finger-tapping sequence on a keyboard; after sleep their speed improves even though they have not practised further. It is a striking finding, and I believe it has been underappreciated by educators.' },
            { label: 'D', text: 'Perhaps the most intriguing studies involve ‘targeted memory reactivation’. Participants learn the locations of objects on a screen while a particular sound or smell is present. If the same cue is presented again while they are in slow-wave sleep, their later recall of those specific locations improves, while other memories are unaffected. Such results suggest that memories can be selectively strengthened during sleep, although the effects so far are modest and have mostly been demonstrated in laboratories.' },
            { label: 'E', text: 'The practical implications are considerable. Students who stay up all night before an examination may be undermining the very learning they are trying to secure. Shift workers and new parents, whose sleep is frequently disrupted, may find it harder to retain new skills. In my view, the evidence is now strong enough that schools should consider it when setting timetables and homework deadlines, though it would be premature to promise that better sleep alone will transform results.' },
            { label: 'F', text: 'Many questions remain. Researchers do not yet fully understand why some memories are consolidated while others fade, nor how ageing alters the process — older adults tend to have less slow-wave sleep, which may partly explain why memory often declines with age. Nor is it clear whether short daytime naps offer the same benefits as a full night’s sleep, although some studies suggest that a nap of around an hour containing slow-wave sleep can help.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1', passageId: 'p1', type: 'ynng', title: 'Questions 1–5',
          instructions: 'Do the following statements agree with the views of the writer? Choose YES if the statement agrees with the views of the writer, NO if the statement contradicts the views of the writer, or NOT GIVEN if it is impossible to say what the writer thinks about this.',
          options: YNNG,
          questions: [
            { id: 'q1', number: 1, text: 'Scientists who regarded sleep as a passive state were wrong.' },
            { id: 'q2', number: 2, text: 'Educators have paid too little attention to the finger-tapping findings.' },
            { id: 'q3', number: 3, text: 'Targeted memory reactivation has produced large effects outside laboratories.' },
            { id: 'q4', number: 4, text: 'Schools should take sleep research into account when planning timetables.' },
            { id: 'q5', number: 5, text: 'Better sleep is certain to transform students’ examination results.' },
          ],
        },
        {
          id: 'g2', passageId: 'p1', type: 'matching_endings', title: 'Questions 6–9',
          instructions: 'Complete each sentence with the correct ending, A–G.',
          endings: [
            { key: 'A', text: 'usually recalled more than those who stayed awake.' },
            { key: 'B', text: 'never improved their typing speed.' },
            { key: 'C', text: 'appears to replay recent experiences.' },
            { key: 'D', text: 'is the stage that dominates the start of the night.' },
            { key: 'E', text: 'may help the brain link memories and process emotions.' },
            { key: 'F', text: 'tend to get less slow-wave sleep.' },
            { key: 'G', text: 'stores information permanently.' },
          ],
          questions: [
            { id: 'q6', number: 6, text: 'During slow-wave sleep, the hippocampus' },
            { id: 'q7', number: 7, text: 'REM sleep' },
            { id: 'q8', number: 8, text: 'Volunteers who slept after learning word pairs' },
            { id: 'q9', number: 9, text: 'Older adults' },
          ],
        },
        {
          id: 'g3', passageId: 'p1', type: 'table_completion', title: 'Questions 10–12',
          instructions: 'Complete the table below. Choose ONE WORD ONLY from the passage for each answer.',
          maxWords: 1,
          table: {
            headers: ['Experiment', 'What participants did', 'Result'],
            rows: [
              ['Word pairs', 'learned a list in the {{q10}}', 'better recall after sleep'],
              ['Finger tapping', 'practised a sequence on a {{q11}}', 'faster after sleep without extra practice'],
              ['Targeted reactivation', 'learned object locations with a sound or {{q12}} present', 'recall of those locations improved'],
            ],
          },
          questions: [{ id: 'q10', number: 10 }, { id: 'q11', number: 11 }, { id: 'q12', number: 12 }],
        },
        {
          id: 'g4', passageId: 'p1', type: 'flowchart_completion', title: 'Questions 13–14',
          instructions: 'Complete the flow-chart below. Choose ONE WORD ONLY from the passage for each answer.',
          maxWords: 1,
          steps: [
            'A new experience is encoded',
            'Information is held briefly in the {{q13}}',
            'Recent experiences are replayed during slow-wave sleep',
            'Information is transferred to the {{q14}} for long-term storage',
          ],
          questions: [{ id: 'q13', number: 13 }, { id: 'q14', number: 14 }],
        },
      ],
    },
    answers: {
      q1: { accepted: ['YES'], explanation: 'A: “That view now looks mistaken.”' },
      q2: { accepted: ['YES'], explanation: 'C: “I believe it has been underappreciated by educators.”' },
      q3: { accepted: ['NO'], explanation: 'D: effects “are modest and have mostly been demonstrated in laboratories”.' },
      q4: { accepted: ['YES'], explanation: 'E: “schools should consider it when setting timetables”.' },
      q5: { accepted: ['NO'], explanation: 'E: “premature to promise that better sleep alone will transform results”.' },
      q6: { accepted: ['C'], explanation: 'B: the hippocampus “appears to replay recent experiences”.' },
      q7: { accepted: ['E'], explanation: 'B: REM helps “find connections between memories and … process emotional experiences”.' },
      q8: { accepted: ['A'], explanation: 'C: “Those who sleep typically remember significantly more.”' },
      q9: { accepted: ['F'], explanation: 'F: “older adults tend to have less slow-wave sleep”.' },
      q10: { accepted: ['evening'], explanation: 'C: “learn a list of word pairs in the evening”.', maxWords: 1 },
      q11: { accepted: ['keyboard'], explanation: 'C: “a finger-tapping sequence on a keyboard”.', maxWords: 1 },
      q12: { accepted: ['smell'], explanation: 'D: “while a particular sound or smell is present”.', maxWords: 1 },
      q13: { accepted: ['hippocampus'], explanation: 'B: “the hippocampus — a structure that briefly stores new information”.', maxWords: 1 },
      q14: { accepted: ['cortex'], explanation: 'B: information is transferred “to the cortex, where it can be kept for the long term”.', maxWords: 1 },
    },
  },
  {
    slug: 'gt-reading-evening-classes',
    skill: 'reading',
    testType: 'general',
    title: 'Evening Classes at Northgate College',
    description: 'General Training Section 1 · Matching information, True/False/Not Given, short answers',
    difficulty: 'Band 4.5–6',
    timeLimitSec: 20 * 60,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Northgate Community College — Autumn Evening Classes',
          paragraphs: [
            { label: 'A', text: 'Conversational Spanish. Tuesdays 7–9 pm, 10 weeks, starting 12 September. For complete beginners. Fee £95; concessions £60 for students and people aged over 65. Textbook included.' },
            { label: 'B', text: 'Digital Photography. Wednesdays 6.30–8.30 pm, 8 weeks. Bring your own camera (smartphones are not suitable). Fee £120. Includes two Saturday field trips; travel costs are not included.' },
            { label: 'C', text: 'Introduction to Bookkeeping. Mondays 6–8 pm, 12 weeks. Ideal for small business owners. Successful students receive a certificate recognised by local employers. Fee £150, which may be paid in three instalments.' },
            { label: 'D', text: 'Pottery for All. Thursdays 7–9.30 pm, 6 weeks. All materials and kiln firing are included in the fee of £110. Maximum of 8 students per class, so early booking is advised. Please wear old clothes.' },
            { label: 'E', text: 'Creative Writing Workshop. Fridays 6–8 pm, 10 weeks. Share your work in a friendly group. Fee £80. An online option is available for those who cannot attend in person.' },
            { label: '', text: 'Enrolment information. Enrolment opens on 1 August. You can enrol online, by phone or in person at the main reception, which is open from 9 am to 5 pm on weekdays. If a class has fewer than six students one week before the start date, it may be cancelled, in which case you will receive a full refund. Refunds are not available once a course has started, except for medical reasons. Free parking is available after 6 pm in the college car park; a permit must be displayed.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1', passageId: 'p1', type: 'matching_info', title: 'Questions 1–6',
          instructions: 'Look at the five class descriptions, A–E. For which class are the following statements true? You may use any letter more than once.',
          options: ['A', 'B', 'C', 'D', 'E'],
          questions: [
            { id: 'q1', number: 1, text: 'Students can take part without coming to the college.' },
            { id: 'q2', number: 2, text: 'A qualification is awarded at the end.' },
            { id: 'q3', number: 3, text: 'Reduced fees are available for some people.' },
            { id: 'q4', number: 4, text: 'Students may have to pay extra for travel.' },
            { id: 'q5', number: 5, text: 'The number of students in each class is limited.' },
            { id: 'q6', number: 6, text: 'The fee can be paid in parts.' },
          ],
        },
        {
          id: 'g2', passageId: 'p1', type: 'tfng', title: 'Questions 7–10',
          instructions: 'Do the following statements agree with the enrolment information? Choose TRUE, FALSE or NOT GIVEN.',
          options: TFNG,
          questions: [
            { id: 'q7', number: 7, text: 'It is possible to enrol by telephone.' },
            { id: 'q8', number: 8, text: 'The main reception is open at weekends.' },
            { id: 'q9', number: 9, text: 'Students will get their money back if their class is cancelled.' },
            { id: 'q10', number: 10, text: 'Parking in the college car park is free all day.' },
          ],
        },
        {
          id: 'g3', passageId: 'p1', type: 'short_answer', title: 'Questions 11–13',
          instructions: 'Answer the questions below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
          maxWords: 2,
          template: [
            'On which day of the week does the photography class meet? {{q11}}',
            'What must be displayed in a car parked in the college car park? {{q12}}',
            'How many weeks does the pottery course last? {{q13}}',
          ],
          questions: [{ id: 'q11', number: 11 }, { id: 'q12', number: 12 }, { id: 'q13', number: 13 }],
        },
      ],
    },
    answers: {
      q1: { accepted: ['E'], explanation: 'E: “An online option is available”.' },
      q2: { accepted: ['C'], explanation: 'C: “receive a certificate recognised by local employers”.' },
      q3: { accepted: ['A'], explanation: 'A: “concessions £60 for students and people aged over 65”.' },
      q4: { accepted: ['B'], explanation: 'B: “travel costs are not included”.' },
      q5: { accepted: ['D'], explanation: 'D: “Maximum of 8 students per class”.' },
      q6: { accepted: ['C'], explanation: 'C: “may be paid in three instalments”.' },
      q7: { accepted: ['TRUE'], explanation: '“You can enrol online, by phone or in person”.' },
      q8: { accepted: ['FALSE'], explanation: 'Reception is open “on weekdays”.' },
      q9: { accepted: ['TRUE'], explanation: '“it may be cancelled, in which case you will receive a full refund”.' },
      q10: { accepted: ['FALSE'], explanation: 'Parking is free only “after 6 pm”.' },
      q11: { accepted: ['Wednesday|Wednesdays|on Wednesdays|on Wednesday'], explanation: 'B: “Wednesdays 6.30–8.30 pm”.', maxWords: 2 },
      q12: { accepted: ['[a] permit|[a] parking permit'], explanation: '“a permit must be displayed”.', maxWords: 2 },
      q13: { accepted: ['6|six|6 weeks|six weeks'], explanation: 'D: “Thursdays 7–9.30 pm, 6 weeks”.', maxWords: 2 },
    },
  },
  {
    slug: 'gt-reading-hotel-safety',
    skill: 'reading',
    testType: 'general',
    title: 'Harbourside Hotel: New Staff Safety Guide',
    description: 'General Training Section 2 (workplace) · Note completion, multiple choice, matching names',
    difficulty: 'Band 5–6.5',
    timeLimitSec: 20 * 60,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Harbourside Hotel — New Staff Guide: Health and Safety',
          paragraphs: [
            { label: '', text: 'Welcome to the Harbourside team. Your safety and that of our guests is everyone’s responsibility. Please read this guide carefully before your first shift.' },
            { label: '', text: 'Reporting accidents. All accidents, however minor, must be recorded in the accident book kept at the front desk. If a guest is injured, inform the duty manager immediately; do not attempt to move anyone who may have a back or neck injury. Our trained first aiders are listed on the noticeboard in the staff room.' },
            { label: '', text: 'Fire safety. Fire alarms are tested every Monday at 10 a.m.; you do not need to leave the building during the test unless the alarm sounds for more than one minute. On hearing a continuous alarm at any other time, stop work, guide any guests near you to the nearest exit and go to the assembly point in the front car park. Do not use the lifts. Kitchen staff must switch off gas supplies before leaving if it is safe to do so.' },
            { label: '', text: 'Manual handling. Many injuries in hotels are caused by lifting heavy or awkward loads. Use the trolleys provided for luggage and linen. Never lift anything heavier than 20 kilograms alone — ask a colleague for help. All new staff attend a one-hour manual handling session during their first week; check the training schedule with Human Resources.' },
            { label: '', text: 'Chemicals. Cleaning products must be stored in the locked cupboard on each floor and never transferred into unlabelled bottles. Gloves are provided and must be worn when using any product marked with a hazard symbol.' },
            { label: '', text: 'Uniform and footwear. Non-slip shoes are compulsory for kitchen and housekeeping staff. The hotel will refund up to £40 towards the cost of one pair per year on presentation of a receipt.' },
            { label: '', text: 'Who to contact. Duty manager — guest injuries and emergencies. Maria Lopez, Human Resources — training dates and uniform refunds. Tom Becker, Head of Maintenance — damaged equipment and faulty lighting. Aisha Khan, Head Housekeeper — chemical supplies and cupboard keys.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1', passageId: 'p1', type: 'note_completion', title: 'Questions 1–5',
          instructions: 'Complete the notes below. Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from the text for each answer.',
          maxWords: 2,
          template: [
            'Record every accident in the accident {{q1}} at the front desk.',
            'Fire alarm test: every Monday at {{q2}} a.m.',
            'Assembly point: in the front {{q3}}',
            'Maximum weight to lift alone: {{q4}} kilograms',
            'Refund for non-slip shoes: up to £{{q5}} per year',
          ],
          questions: [{ id: 'q1', number: 1 }, { id: 'q2', number: 2 }, { id: 'q3', number: 3 }, { id: 'q4', number: 4 }, { id: 'q5', number: 5 }],
        },
        {
          id: 'g2', passageId: 'p1', type: 'mcq', title: 'Questions 6–9',
          instructions: 'Choose the correct letter, A, B, C or D.',
          questions: [
            { id: 'q6', number: 6, text: 'During the weekly fire alarm test, staff should', options: ['A  leave the building immediately.', 'B  continue working unless the alarm lasts more than a minute.', 'C  switch off the gas supply.', 'D  take guests to the car park.'] },
            { id: 'q7', number: 7, text: 'Cleaning products must', options: ['A  be poured into smaller bottles.', 'B  be kept in a locked cupboard.', 'C  only be used by kitchen staff.', 'D  be returned to Human Resources.'] },
            { id: 'q8', number: 8, text: 'Gloves must be worn', options: ['A  at all times in the kitchen.', 'B  when a product shows a hazard symbol.', 'C  when lifting luggage.', 'D  during fire drills.'] },
            { id: 'q9', number: 9, text: 'New staff attend manual handling training', options: ['A  before they are offered the job.', 'B  during their first week.', 'C  once a year.', 'D  only if they work in housekeeping.'] },
          ],
        },
        {
          id: 'g3', passageId: 'p1', type: 'matching_names', title: 'Questions 10–14',
          instructions: 'Who should staff contact in each situation? Choose the correct letter, A–D. You may use any letter more than once.',
          features: [
            { key: 'A', text: 'Duty manager' }, { key: 'B', text: 'Maria Lopez' }, { key: 'C', text: 'Tom Becker' }, { key: 'D', text: 'Aisha Khan' },
          ],
          questions: [
            { id: 'q10', number: 10, text: 'a broken light in a guest corridor' },
            { id: 'q11', number: 11, text: 'claiming money back for work shoes' },
            { id: 'q12', number: 12, text: 'a guest who has fallen on the stairs' },
            { id: 'q13', number: 13, text: 'getting a key for the chemicals cupboard' },
            { id: 'q14', number: 14, text: 'booking a place on manual handling training' },
          ],
        },
      ],
    },
    answers: {
      q1: { accepted: ['book'], explanation: '“recorded in the accident book kept at the front desk”.', maxWords: 2 },
      q2: { accepted: ['10|ten'], explanation: '“tested every Monday at 10 a.m.”', maxWords: 2 },
      q3: { accepted: ['car park|carpark'], explanation: '“the assembly point in the front car park”.', maxWords: 2 },
      q4: { accepted: ['20|twenty'], explanation: '“Never lift anything heavier than 20 kilograms alone”.', maxWords: 2 },
      q5: { accepted: ['40|forty'], explanation: '“refund up to £40”.', maxWords: 2 },
      q6: { accepted: ['B'], explanation: '“you do not need to leave … unless the alarm sounds for more than one minute”.' },
      q7: { accepted: ['B'], explanation: '“must be stored in the locked cupboard on each floor”.' },
      q8: { accepted: ['B'], explanation: '“must be worn when using any product marked with a hazard symbol”.' },
      q9: { accepted: ['B'], explanation: '“All new staff attend a one-hour manual handling session during their first week”.' },
      q10: { accepted: ['C'], explanation: 'Tom Becker handles “faulty lighting”.' },
      q11: { accepted: ['B'], explanation: 'Maria Lopez handles “uniform refunds”.' },
      q12: { accepted: ['A'], explanation: 'The duty manager handles “guest injuries”.' },
      q13: { accepted: ['D'], explanation: 'Aisha Khan handles “cupboard keys”.' },
      q14: { accepted: ['B'], explanation: 'Maria Lopez handles “training dates”.' },
    },
  },
];
