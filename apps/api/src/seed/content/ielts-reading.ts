import type { ReadingContent } from '@fluentpath/shared';

export interface SeedReadingSet {
  slug: string;
  variant: 'academic' | 'general';
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimitSec: number;
  isPremium?: boolean;
  mockOnly?: boolean;
  content: ReadingContent;
}

const TFNG_INSTR = 'Do the following statements agree with the information given in the passage? Choose TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.';
const YNNG_INSTR = 'Do the following statements agree with the claims of the writer? Choose YES if the statement agrees with the claims of the writer, NO if the statement contradicts the claims of the writer, or NOT GIVEN if it is impossible to say what the writer thinks about this.';
const TFNG = [{ key: 'TRUE', text: 'TRUE' }, { key: 'FALSE', text: 'FALSE' }, { key: 'NOT GIVEN', text: 'NOT GIVEN' }];
const YNNG = [{ key: 'YES', text: 'YES' }, { key: 'NO', text: 'NO' }, { key: 'NOT GIVEN', text: 'NOT GIVEN' }];
const PARAS = (labels: string) => labels.split('').map((l) => ({ key: l, text: `Paragraph ${l}` }));

export const readingSets: SeedReadingSet[] = [
  {
    slug: 'academic-vertical-farming',
    variant: 'academic',
    title: 'Growing upwards: the rise of vertical farming',
    description: 'Academic passage about indoor agriculture. Matching headings, True/False/Not Given and sentence completion.',
    difficulty: 'medium',
    timeLimitSec: 20 * 60,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Growing upwards: the rise of vertical farming',
          paragraphs: [
            { label: 'A', text: 'By 2050, roughly two-thirds of the world’s population is expected to live in cities. Feeding these urban populations will place enormous pressure on farmland, much of which is already degraded by intensive use. One proposed solution is vertical farming: growing crops indoors in stacked layers, often inside converted warehouses or purpose-built towers, where light, temperature, humidity and nutrients are controlled precisely.' },
            { label: 'B', text: 'The idea is not entirely new. Greenhouses have allowed growers to extend seasons for centuries, and hydroponics — growing plants in nutrient-rich water rather than soil — was studied seriously in the 1930s. What distinguishes modern vertical farms is the use of energy-efficient LED lighting, which can be tuned to the exact wavelengths plants use for photosynthesis, together with sensors and software that adjust conditions minute by minute.' },
            { label: 'C', text: 'Supporters point to striking efficiencies. Because water in a closed hydroponic system is recirculated, vertical farms typically use around 90 per cent less water than field agriculture for the same crop. Pests are largely excluded, so pesticides are rarely needed, and crops can be harvested all year round regardless of weather. Since farms can be located inside cities, produce can reach shops within hours of being picked, reducing both transport emissions and food waste.' },
            { label: 'D', text: 'The greatest obstacle is energy. Sunlight is free; electric light is not. Lighting and climate control can account for more than half of a vertical farm’s operating costs, and if that electricity comes from fossil fuels, the environmental benefits are significantly reduced. Several high-profile companies have closed in recent years after failing to make a profit, particularly when energy prices rose sharply.' },
            { label: 'E', text: 'Not every crop is suitable. Leafy greens such as lettuce, spinach and herbs grow quickly, are compact and sell at relatively high prices, which makes them ideal. Staple crops such as wheat, rice and maize, by contrast, need a great deal of space and light to produce grain of comparatively low value. Researchers estimate that growing wheat indoors would currently cost many times more than growing it in fields, so vertical farming is unlikely to replace conventional agriculture for the foods that supply most of our calories.' },
            { label: 'F', text: 'Some of the most promising projects combine vertical farming with other systems. In parts of Scandinavia, farms capture waste heat from nearby data centres to warm their growing rooms. Elsewhere, designers have proposed placing farms on the roofs of supermarkets, so that vegetables are sold metres from where they are grown. In regions with extreme climates or little fertile land, such as parts of the Middle East, indoor farms may offer a degree of food security that imports alone cannot provide.' },
            { label: 'G', text: 'For now, most experts see vertical farming as a complement to traditional agriculture rather than a replacement. Its future will depend largely on the cost of renewable electricity and on whether plant breeders can develop varieties that grow faster and more compactly under artificial light. If both trends continue, the sight of lettuces growing on the twentieth floor of an office block may become far less unusual.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1',
          type: 'matching_headings',
          instructions: 'The passage has seven paragraphs, A–G. Choose the correct heading for paragraphs B–F from the list of headings below.',
          passageId: 'p1',
          options: [
            { key: 'i', text: 'An old idea with new technology' },
            { key: 'ii', text: 'The cost of artificial sunlight' },
            { key: 'iii', text: 'Why cities are running out of food' },
            { key: 'iv', text: 'Clear advantages over traditional farming' },
            { key: 'v', text: 'Crops that make economic sense' },
            { key: 'vi', text: 'Government support for urban farms' },
            { key: 'vii', text: 'Partnerships with other industries and places' },
          ],
          questions: [
            { n: 1, prompt: 'Paragraph B', answer: ['i'], explanation: 'Paragraph B explains that greenhouses and hydroponics are old, but LEDs, sensors and software are new: "an old idea with new technology".' },
            { n: 2, prompt: 'Paragraph C', answer: ['iv'], explanation: 'Paragraph C lists efficiencies: less water, no pesticides, year-round harvests, less transport — clear advantages.' },
            { n: 3, prompt: 'Paragraph D', answer: ['ii'], explanation: 'Paragraph D focuses on energy: "Sunlight is free; electric light is not."' },
            { n: 4, prompt: 'Paragraph E', answer: ['v'], explanation: 'Paragraph E explains that leafy greens are profitable while staple crops are too expensive to grow indoors.' },
            { n: 5, prompt: 'Paragraph F', answer: ['vii'], explanation: 'Paragraph F describes combining farms with data centres, supermarkets and use in extreme climates.' },
          ],
        },
        {
          id: 'g2',
          type: 'tfng',
          instructions: TFNG_INSTR,
          passageId: 'p1',
          options: TFNG,
          questions: [
            { n: 6, prompt: 'Hydroponics was first investigated in the twentieth century.', answer: ['NOT GIVEN'], explanation: 'The passage says hydroponics "was studied seriously in the 1930s", but it does not say this was the first time it was investigated.' },
            { n: 7, prompt: 'Vertical farms generally need much less water than fields to grow the same crop.', answer: ['TRUE'], explanation: 'Paragraph C: they use "around 90 per cent less water than field agriculture for the same crop".' },
            { n: 8, prompt: 'Rising energy prices have contributed to some vertical farming businesses closing.', answer: ['TRUE'], explanation: 'Paragraph D: companies closed "particularly when energy prices rose sharply".' },
            { n: 9, prompt: 'Wheat can now be grown indoors at a similar cost to field-grown wheat.', answer: ['FALSE'], explanation: 'Paragraph E: growing wheat indoors "would currently cost many times more".' },
          ],
        },
        {
          id: 'g3',
          type: 'sentence_completion',
          instructions: 'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
          passageId: 'p1',
          questions: [
            { n: 10, prompt: 'Modern vertical farms use ______ that can be adjusted to the wavelengths plants need.', answer: ['LED lighting', 'LED lights', 'LEDs', 'LED'], explanation: 'Paragraph B: "energy-efficient LED lighting, which can be tuned to the exact wavelengths".' },
            { n: 11, prompt: 'Because pests are kept out, farmers rarely need to use ______.', answer: ['pesticides'], explanation: 'Paragraph C: "Pests are largely excluded, so pesticides are rarely needed".' },
            { n: 12, prompt: 'In Scandinavia, some farms are heated using waste heat from ______.', answer: ['data centres', 'data centers'], explanation: 'Paragraph F: "farms capture waste heat from nearby data centres".' },
            { n: 13, prompt: 'The future of vertical farming depends partly on the price of ______.', answer: ['renewable electricity'], explanation: 'Paragraph G: "Its future will depend largely on the cost of renewable electricity".' },
          ],
        },
      ],
    },
  },
  {
    slug: 'academic-sleep-memory',
    variant: 'academic',
    title: 'Sleep and the memory machine',
    description: 'Academic passage about sleep research. Multiple choice, Yes/No/Not Given and summary completion with a word bank.',
    difficulty: 'medium',
    timeLimitSec: 20 * 60,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Sleep and the memory machine',
          paragraphs: [
            { text: 'For much of the twentieth century, sleep was regarded by many scientists as a period of inactivity — a necessary pause during which the brain simply rested. That view has been overturned. We now know that the sleeping brain is remarkably busy, and that one of its most important tasks is the processing and storage of memories.' },
            { text: 'Sleep is not uniform. Over a typical night, a person passes through several cycles, each lasting roughly ninety minutes and consisting of lighter stages, deep slow-wave sleep and rapid eye movement (REM) sleep, the stage most associated with vivid dreaming. Early in the night, slow-wave sleep dominates; towards morning, REM periods become longer.' },
            { text: 'Experiments suggest that these stages contribute to memory in different ways. In one well-known type of study, participants learn a list of word pairs in the evening and are tested the following morning. Those who sleep normally recall significantly more pairs than those kept awake for the same period. Crucially, the benefit appears to be linked to the amount of slow-wave sleep participants obtain, which seems especially important for consolidating facts and events. REM sleep, by contrast, has been associated with emotional memories and with the kind of creative problem-solving that involves finding hidden connections.' },
            { text: 'How does consolidation work? A leading theory holds that during slow-wave sleep the hippocampus — a structure deep in the brain that records new experiences — "replays" the day’s events, gradually transferring them to the cortex for long-term storage. Recordings from the brains of rats running through mazes have shown patterns of neural activity during sleep that closely mirror those produced while the animals were exploring, as if the maze were being rehearsed.' },
            { text: 'In my view, the practical implications of this research have not been taken seriously enough, particularly in education. Students commonly sacrifice sleep before examinations in order to revise for longer, yet the evidence suggests that a night of poor sleep may undo much of the benefit of the extra study. Schools that start very early in the morning may also be working against the natural sleep patterns of teenagers, whose body clocks shift later during adolescence.' },
            { text: 'Nevertheless, it would be a mistake to treat sleep as a shortcut to learning. Claims that people can absorb new information — a foreign language, for instance — by listening to recordings while asleep are not supported by convincing evidence. Sleep seems to strengthen what we have already learned while awake; it does not replace the effort of learning in the first place.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1',
          type: 'mcq',
          instructions: 'Choose the correct letter, A, B, C or D.',
          passageId: 'p1',
          questions: [
            { n: 1, prompt: 'According to the passage, what did many twentieth-century scientists believe about sleep?', options: [{ key: 'A', text: 'It was mainly a time for dreaming.' }, { key: 'B', text: 'It was a time when the brain was largely inactive.' }, { key: 'C', text: 'It was essential for storing memories.' }, { key: 'D', text: 'It lasted around ninety minutes.' }], answer: ['B'], explanation: 'Paragraph 1: sleep was regarded "as a period of inactivity".' },
            { n: 2, prompt: 'What happens to sleep stages as the night goes on?', options: [{ key: 'A', text: 'Slow-wave sleep increases.' }, { key: 'B', text: 'Cycles become shorter than ninety minutes.' }, { key: 'C', text: 'REM periods become longer.' }, { key: 'D', text: 'Lighter stages disappear.' }], answer: ['C'], explanation: 'Paragraph 2: "towards morning, REM periods become longer".' },
            { n: 3, prompt: 'In the word-pair studies, better recall was linked to', options: [{ key: 'A', text: 'the total time spent in REM sleep.' }, { key: 'B', text: 'the amount of slow-wave sleep.' }, { key: 'C', text: 'studying in the morning.' }, { key: 'D', text: 'how many dreams participants remembered.' }], answer: ['B'], explanation: 'Paragraph 3: the benefit "appears to be linked to the amount of slow-wave sleep".' },
            { n: 4, prompt: 'Why does the writer mention rats running through mazes?', options: [{ key: 'A', text: 'To show that animals dream more than humans.' }, { key: 'B', text: 'To support the idea that the brain replays experiences during sleep.' }, { key: 'C', text: 'To explain why rats need less sleep.' }, { key: 'D', text: 'To criticise the replay theory.' }], answer: ['B'], explanation: 'Paragraph 4: neural patterns during sleep mirror those during exploration, "as if the maze were being rehearsed" — evidence for replay.' },
          ],
        },
        {
          id: 'g2',
          type: 'ynng',
          instructions: YNNG_INSTR,
          passageId: 'p1',
          options: YNNG,
          questions: [
            { n: 5, prompt: 'Educators have given too little attention to research on sleep and memory.', answer: ['YES'], explanation: 'Paragraph 5: "the practical implications of this research have not been taken seriously enough, particularly in education".' },
            { n: 6, prompt: 'Staying up late to revise is an effective exam strategy.', answer: ['NO'], explanation: 'The writer says a night of poor sleep "may undo much of the benefit of the extra study".' },
            { n: 7, prompt: 'Schools should be legally required to start after 10 am.', answer: ['NOT GIVEN'], explanation: 'The writer says early starts may work against teenagers’ sleep, but gives no view on a legal requirement or a specific time.' },
            { n: 8, prompt: 'People can learn a new language effectively while they are asleep.', answer: ['NO'], explanation: 'Paragraph 6: such claims "are not supported by convincing evidence".' },
          ],
        },
        {
          id: 'g3',
          type: 'summary_completion',
          instructions: 'Complete the summary using the list of words, A–H, below.',
          passageId: 'p1',
          options: [
            { key: 'A', text: 'cortex' }, { key: 'B', text: 'emotional' }, { key: 'C', text: 'hippocampus' }, { key: 'D', text: 'replace' },
            { key: 'E', text: 'strengthen' }, { key: 'F', text: 'teenagers' }, { key: 'G', text: 'adults' }, { key: 'H', text: 'visual' },
          ],
          gapText: 'Research suggests that REM sleep is connected with {{9}} memories and creative thinking. According to one theory, the {{10}} replays recent events during slow-wave sleep and moves them to the {{11}} for long-term storage. Early school start times may be a problem for {{12}}, whose body clocks change. However, sleep can only {{13}} learning that has already happened.',
          questions: [
            { n: 9, prompt: 'Gap 9', answer: ['B'], explanation: 'REM sleep "has been associated with emotional memories".' },
            { n: 10, prompt: 'Gap 10', answer: ['C'], explanation: 'The hippocampus "replays" the day’s events.' },
            { n: 11, prompt: 'Gap 11', answer: ['A'], explanation: 'Memories are transferred "to the cortex for long-term storage".' },
            { n: 12, prompt: 'Gap 12', answer: ['F'], explanation: 'Teenagers’ "body clocks shift later during adolescence".' },
            { n: 13, prompt: 'Gap 13', answer: ['E'], explanation: 'Sleep "seems to strengthen what we have already learned".' },
          ],
        },
      ],
    },
  },
  {
    slug: 'academic-coral-reefs',
    variant: 'academic',
    title: 'Saving the rainforests of the sea',
    description: 'Academic passage about coral reef research. Matching information, matching features and short-answer questions.',
    difficulty: 'hard',
    timeLimitSec: 20 * 60,
    isPremium: true,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Saving the rainforests of the sea',
          paragraphs: [
            { label: 'A', text: 'Coral reefs cover less than one per cent of the ocean floor, yet they support around a quarter of all marine species. They protect coastlines from storms, provide food for hundreds of millions of people and generate billions of dollars each year through tourism. Despite this, scientists estimate that the world has already lost roughly half of its living coral since the 1950s.' },
            { label: 'B', text: 'The single greatest threat is rising sea temperature. Corals depend on tiny algae living inside their tissues, which provide them with food through photosynthesis and give them their colour. When water becomes too warm for too long, the relationship breaks down and the coral expels the algae, turning white — a process known as bleaching. Bleached corals are not dead, but unless temperatures fall within a few weeks, many will starve.' },
            { label: 'C', text: 'Marine biologist Dr Hannah Okafor has spent a decade studying corals that survive heatwaves which kill their neighbours. Her work suggests that some colonies carry algae that are naturally more heat-tolerant, and that these partnerships can be passed on to young corals. "The variation is already there in nature," she argues. "Our task is to find it and help it spread."' },
            { label: 'D', text: 'Others are taking a more hands-on approach. In laboratories in Australia, a team led by Professor Luis Medina has bred corals from parents that survived bleaching events and exposed the offspring to gradually increasing temperatures. Medina calls this "assisted evolution". Early results show that some laboratory-raised corals tolerate temperatures about one degree higher than their wild relatives, although critics warn that releasing them could have unexpected effects on reef ecosystems.' },
            { label: 'E', text: 'Restoration on a practical scale often looks more like gardening than genetics. Fragments of healthy coral are grown on underwater frames, sometimes called nurseries, and then attached to damaged reefs. Ecologist Dr Mei Lin Tan, who has measured the results of more than two hundred such projects, found that survival rates varied enormously and that projects with long-term local involvement performed best. "Planting coral is easy," she says. "Keeping it alive for ten years is the real test."' },
            { label: 'F', text: 'All of these researchers agree on one point: restoration cannot keep pace with destruction unless the underlying cause is addressed. Reducing greenhouse gas emissions remains essential. In the meantime, reducing local pressures — such as overfishing and pollution from farms — can give reefs a better chance of recovering between heatwaves.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1',
          type: 'matching_information',
          instructions: 'Which paragraph contains the following information? Choose the correct letter, A–F. You may use any letter more than once.',
          passageId: 'p1',
          options: PARAS('ABCDEF'),
          questions: [
            { n: 1, prompt: 'an explanation of why corals lose their colour', answer: ['B'], explanation: 'Paragraph B explains that corals expel their algae and turn white.' },
            { n: 2, prompt: 'a comparison between the size of reefs and the number of species they support', answer: ['A'], explanation: 'Paragraph A: less than 1% of the ocean floor, yet a quarter of marine species.' },
            { n: 3, prompt: 'a reference to local problems that can be reduced while emissions remain high', answer: ['F'], explanation: 'Paragraph F mentions overfishing and farm pollution.' },
            { n: 4, prompt: 'a concern about releasing laboratory-raised organisms', answer: ['D'], explanation: 'Paragraph D: "critics warn that releasing them could have unexpected effects".' },
          ],
        },
        {
          id: 'g2',
          type: 'matching_features',
          instructions: 'Match each statement with the correct researcher, A–C. You may use any letter more than once.',
          passageId: 'p1',
          options: [{ key: 'A', text: 'Dr Hannah Okafor' }, { key: 'B', text: 'Professor Luis Medina' }, { key: 'C', text: 'Dr Mei Lin Tan' }],
          questions: [
            { n: 5, prompt: 'Community participation over many years improves results.', answer: ['C'], explanation: 'Tan found projects with long-term local involvement performed best.' },
            { n: 6, prompt: 'Heat tolerance can be increased through controlled breeding.', answer: ['B'], explanation: 'Medina breeds corals and exposes offspring to rising temperatures — "assisted evolution".' },
            { n: 7, prompt: 'Useful genetic differences already exist in wild coral populations.', answer: ['A'], explanation: 'Okafor: "The variation is already there in nature."' },
            { n: 8, prompt: 'Long-term survival is a better measure of success than initial planting.', answer: ['C'], explanation: 'Tan: "Keeping it alive for ten years is the real test."' },
          ],
        },
        {
          id: 'g3',
          type: 'short_answer',
          instructions: 'Answer the questions below. Choose NO MORE THAN THREE WORDS AND/OR A NUMBER from the passage for each answer.',
          passageId: 'p1',
          questions: [
            { n: 9, prompt: 'What proportion of marine species do coral reefs support?', answer: ['a quarter', 'around a quarter', 'one quarter', '25%', '25 per cent'], explanation: 'Paragraph A: "around a quarter of all marine species".' },
            { n: 10, prompt: 'What do the algae inside corals provide them with?', answer: ['food', 'food and colour', 'colour and food'], explanation: 'Paragraph B: algae "provide them with food through photosynthesis and give them their colour".' },
            { n: 11, prompt: 'What term does Professor Medina use for his method?', answer: ['assisted evolution'], explanation: 'Paragraph D: "Medina calls this \'assisted evolution\'".' },
            { n: 12, prompt: 'On what are coral fragments grown before being moved to reefs?', answer: ['underwater frames', 'frames', 'nurseries'], explanation: 'Paragraph E: fragments "are grown on underwater frames, sometimes called nurseries".' },
          ],
        },
      ],
    },
  },
  {
    slug: 'general-leisure-centre',
    variant: 'general',
    title: 'Riverside Leisure Centre: membership guide',
    description: 'General Training Section 1 style. Everyday information text with True/False/Not Given and short answers.',
    difficulty: 'easy',
    timeLimitSec: 15 * 60,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Riverside Leisure Centre — Membership options',
          paragraphs: [
            { text: 'Riverside Leisure Centre offers three types of membership. All members can use the main swimming pool, the gym and the changing rooms. Membership cards must be shown at reception on every visit.' },
            { label: 'Standard', text: 'Standard membership costs £32 per month and gives access between 9 am and 5 pm on weekdays, and at any time at weekends. Standard members may book fitness classes up to two days in advance, at an extra charge of £4 per class.' },
            { label: 'Premium', text: 'Premium membership costs £45 per month and gives access at all opening times (6 am to 10 pm, seven days a week). Fitness classes are included at no extra cost and can be booked up to seven days in advance. Premium members may also bring one guest per month free of charge.' },
            { label: 'Student', text: 'Student membership is available to full-time students aged 16 and over who show a valid student card. It costs £20 per month and has the same opening hours as Standard membership. Students must renew their membership at the start of each academic year.' },
            { label: 'Joining', text: 'New members pay a one-off joining fee of £25, which is waived if you join online. All new members must attend a free 30-minute induction session before using the gym. The children’s pool is available only during family sessions on Saturday and Sunday mornings.' },
            { label: 'Cancelling', text: 'You may cancel your membership at any time by giving one month’s notice in writing. Memberships can be frozen for up to three months in the case of illness or injury; a doctor’s letter is required.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1',
          type: 'tfng',
          instructions: TFNG_INSTR,
          passageId: 'p1',
          options: TFNG,
          questions: [
            { n: 1, prompt: 'Standard members can use the centre on Saturday evenings.', answer: ['TRUE'], explanation: 'Standard members have access "at any time at weekends".' },
            { n: 2, prompt: 'Premium members pay £4 for each fitness class.', answer: ['FALSE'], explanation: 'For Premium members, classes are "included at no extra cost".' },
            { n: 3, prompt: 'The centre has a sauna for Premium members.', answer: ['NOT GIVEN'], explanation: 'A sauna is not mentioned.' },
            { n: 4, prompt: 'Students under 16 can get student membership.', answer: ['FALSE'], explanation: 'Student membership is for full-time students "aged 16 and over".' },
            { n: 5, prompt: 'People who join online do not pay a joining fee.', answer: ['TRUE'], explanation: 'The £25 fee "is waived if you join online".' },
          ],
        },
        {
          id: 'g2',
          type: 'short_answer',
          instructions: 'Answer the questions below. Choose NO MORE THAN THREE WORDS AND/OR A NUMBER from the text for each answer.',
          passageId: 'p1',
          questions: [
            { n: 6, prompt: 'How much does Premium membership cost per month?', answer: ['£45', '45', '45 pounds'], explanation: '"Premium membership costs £45 per month".' },
            { n: 7, prompt: 'How long is the induction session?', answer: ['30 minutes', '30-minute', 'thirty minutes'], explanation: '"a free 30-minute induction session".' },
            { n: 8, prompt: 'When can the children’s pool be used?', answer: ['family sessions', 'during family sessions', 'Saturday and Sunday mornings', 'weekend mornings'], explanation: 'Only "during family sessions on Saturday and Sunday mornings".' },
            { n: 9, prompt: 'What document is needed to freeze a membership?', answer: ['a doctor’s letter', "a doctor's letter", 'doctor’s letter', "doctor's letter"], explanation: '"a doctor’s letter is required".' },
            { n: 10, prompt: 'How much notice must you give to cancel?', answer: ['one month', 'one month’s notice', "one month's notice", '1 month'], explanation: '"by giving one month’s notice in writing".' },
          ],
        },
      ],
    },
  },
  {
    slug: 'general-remote-work-guide',
    variant: 'general',
    title: 'Staff guide: working from home',
    description: 'General Training Section 2 style. Workplace document with matching headings, multiple choice and note completion.',
    difficulty: 'medium',
    timeLimitSec: 20 * 60,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Hartwell & Co. — A guide to working from home',
          paragraphs: [
            { label: 'A', text: 'Employees who have completed their six-month probation period may apply to work from home for up to three days a week. Applications should be made through your line manager, who will consider the needs of your team before giving approval. Some roles, such as reception and warehouse positions, are not suitable for home working.' },
            { label: 'B', text: 'The company will provide a laptop, a headset and a second screen for each approved home worker. You may also claim up to £150 towards an office chair or desk. Receipts must be submitted to the finance department within thirty days of purchase. Equipment remains company property and must be returned if you leave Hartwell & Co.' },
            { label: 'C', text: 'Home workers must be available during the core hours of 10 am to 3 pm. Outside these hours you may arrange your working time flexibly, provided that you complete your contracted hours each week. Please keep your online calendar up to date so that colleagues know when you can be contacted.' },
            { label: 'D', text: 'Confidential documents must never be printed at home. Always connect to the company network using the secure VPN, and lock your screen whenever you leave your computer. Report any lost or stolen equipment to the IT helpdesk immediately — the helpdesk is open 24 hours a day on extension 4400.' },
            { label: 'E', text: 'Working alone can be isolating. We encourage home workers to attend the office at least once a week and to join the optional online coffee mornings held every Friday. If you are experiencing stress or difficulties, our employee support line offers free, confidential advice.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1',
          type: 'matching_headings',
          instructions: 'Choose the correct heading for each section, A–E, from the list below.',
          passageId: 'p1',
          options: [
            { key: 'i', text: 'Staying connected with colleagues' },
            { key: 'ii', text: 'Who can work from home' },
            { key: 'iii', text: 'Keeping information safe' },
            { key: 'iv', text: 'Equipment and expenses' },
            { key: 'v', text: 'Overtime payments' },
            { key: 'vi', text: 'Working hours' },
          ],
          questions: [
            { n: 1, prompt: 'Section A', answer: ['ii'], explanation: 'Section A explains eligibility: after probation, with manager approval, not for some roles.' },
            { n: 2, prompt: 'Section B', answer: ['iv'], explanation: 'Section B covers the laptop, screen and the £150 allowance.' },
            { n: 3, prompt: 'Section C', answer: ['vi'], explanation: 'Section C describes core hours and flexible time.' },
            { n: 4, prompt: 'Section D', answer: ['iii'], explanation: 'Section D is about confidential documents, VPN and locking screens.' },
            { n: 5, prompt: 'Section E', answer: ['i'], explanation: 'Section E encourages office visits and online coffee mornings.' },
          ],
        },
        {
          id: 'g2',
          type: 'mcq',
          instructions: 'Choose the correct letter, A, B or C.',
          passageId: 'p1',
          questions: [
            { n: 6, prompt: 'Who decides whether an employee may work from home?', options: [{ key: 'A', text: 'the finance department' }, { key: 'B', text: 'the employee’s line manager' }, { key: 'C', text: 'the IT helpdesk' }], answer: ['B'], explanation: 'Applications go "through your line manager, who will consider the needs of your team before giving approval".' },
            { n: 7, prompt: 'What must home workers do between 10 am and 3 pm?', options: [{ key: 'A', text: 'be available to colleagues' }, { key: 'B', text: 'attend the office' }, { key: 'C', text: 'take their lunch break' }], answer: ['A'], explanation: '"Home workers must be available during the core hours of 10 am to 3 pm."' },
          ],
        },
        {
          id: 'g3',
          type: 'note_completion',
          instructions: 'Complete the notes below. Choose ONE WORD AND/OR A NUMBER from the text for each answer.',
          passageId: 'p1',
          title: 'Working from home — key points',
          gapText: '• Maximum home working: {{8}} days per week\n• Furniture allowance: up to £{{9}}\n• Submit receipts within {{10}} days\n• Never {{11}} confidential documents at home\n• IT helpdesk: extension {{12}}',
          questions: [
            { n: 8, prompt: 'Gap 8', answer: ['3', 'three'], explanation: '"for up to three days a week".' },
            { n: 9, prompt: 'Gap 9', answer: ['150'], explanation: '"You may also claim up to £150".' },
            { n: 10, prompt: 'Gap 10', answer: ['30', 'thirty'], explanation: '"within thirty days of purchase".' },
            { n: 11, prompt: 'Gap 11', answer: ['print'], explanation: '"Confidential documents must never be printed at home."' },
            { n: 12, prompt: 'Gap 12', answer: ['4400'], explanation: '"extension 4400".' },
          ],
        },
      ],
    },
  },
  // ------------------------------------------------------------- mock-only sets
  {
    slug: 'mock-academic-bicycle',
    variant: 'academic',
    title: 'Two wheels: a short history of the bicycle',
    description: 'Mock test reading passage (Academic).',
    difficulty: 'medium',
    timeLimitSec: 20 * 60,
    mockOnly: true,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Two wheels: a short history of the bicycle',
          paragraphs: [
            { text: 'The first machine that we might recognise as a bicycle appeared in Germany in 1817. Invented by Karl von Drais, the "running machine" had two wheels in a line and a steerable front wheel, but no pedals: riders pushed themselves along with their feet. Some historians have suggested that Drais was searching for an alternative to the horse after a volcanic eruption in Indonesia caused crop failures across Europe and made horses expensive to feed, although this explanation remains debated.' },
            { text: 'Pedals arrived in the 1860s, attached directly to the front wheel. Because each turn of the pedals produced one turn of the wheel, manufacturers soon realised that a larger front wheel meant greater speed. The result was the "high-wheeler", whose front wheel could be well over a metre in diameter. These machines were fast but dangerous; a sudden stop could throw the rider head-first over the handlebars, and they were largely ridden by young, wealthy men.' },
            { text: 'The breakthrough came in the 1880s with the "safety bicycle". It had two wheels of similar size and a chain that transferred power from the pedals to the rear wheel, allowing gears to provide speed without an enormous front wheel. When John Dunlop’s air-filled tyres were added shortly afterwards, riding became far more comfortable. The basic design has changed surprisingly little since.' },
            { text: 'The social effects were considerable. Bicycles gave ordinary working people a cheap means of travelling beyond their own towns, and some researchers argue that this widened the range of possible marriage partners in rural areas. For women in particular, the bicycle became a symbol of independence: it encouraged changes in clothing, as long skirts were impractical for cycling, and it featured prominently in campaigns for women’s rights.' },
            { text: 'In the twentieth century, the car replaced the bicycle as the main form of private transport in many wealthy countries. Today, however, cycling is enjoying a revival. Cities from Copenhagen to Bogotá have built networks of protected cycle lanes, and electric bicycles have made longer and hillier journeys possible for people who would not otherwise cycle. Whether this revival will last depends largely on how much space city planners are willing to take away from cars.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1',
          type: 'tfng',
          instructions: TFNG_INSTR,
          passageId: 'p1',
          options: TFNG,
          questions: [
            { n: 1, prompt: 'Drais’s running machine was powered by the rider’s feet pushing on the ground.', answer: ['TRUE'], explanation: '"riders pushed themselves along with their feet".' },
            { n: 2, prompt: 'Historians agree that a volcanic eruption led directly to the invention of the bicycle.', answer: ['FALSE'], explanation: '"this explanation remains debated" — historians do not agree.' },
            { n: 3, prompt: 'High-wheelers were mainly used by older people.', answer: ['FALSE'], explanation: 'They were "largely ridden by young, wealthy men".' },
            { n: 4, prompt: 'The safety bicycle was more expensive than the high-wheeler.', answer: ['NOT GIVEN'], explanation: 'Prices are not compared.' },
          ],
        },
        {
          id: 'g2',
          type: 'mcq',
          instructions: 'Choose the correct letter, A, B, C or D.',
          passageId: 'p1',
          questions: [
            { n: 5, prompt: 'Why did early pedal bicycles have very large front wheels?', options: [{ key: 'A', text: 'to make them safer' }, { key: 'B', text: 'to increase their speed' }, { key: 'C', text: 'to make them cheaper' }, { key: 'D', text: 'to carry luggage' }], answer: ['B'], explanation: '"a larger front wheel meant greater speed".' },
            { n: 6, prompt: 'What was the key feature of the safety bicycle?', options: [{ key: 'A', text: 'a chain driving the rear wheel' }, { key: 'B', text: 'a steerable front wheel' }, { key: 'C', text: 'an electric motor' }, { key: 'D', text: 'a very large rear wheel' }], answer: ['A'], explanation: '"a chain that transferred power from the pedals to the rear wheel".' },
            { n: 7, prompt: 'According to the writer, the future of the cycling revival depends mainly on', options: [{ key: 'A', text: 'the price of electric bicycles' }, { key: 'B', text: 'improvements in tyres' }, { key: 'C', text: 'decisions about road space in cities' }, { key: 'D', text: 'the weather in northern Europe' }], answer: ['C'], explanation: '"depends largely on how much space city planners are willing to take away from cars".' },
          ],
        },
        {
          id: 'g3',
          type: 'summary_completion',
          instructions: 'Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
          passageId: 'p1',
          gapText: 'Bicycles had important social effects. They gave working people {{8}} transport beyond their towns, and may have increased the choice of {{9}} in the countryside. For women, cycling represented {{10}} and led to changes in {{11}}. Recently, {{12}} have helped people make longer journeys by bike.',
          questions: [
            { n: 8, prompt: 'Gap 8', answer: ['cheap'], explanation: '"a cheap means of travelling".' },
            { n: 9, prompt: 'Gap 9', answer: ['marriage partners'], explanation: '"widened the range of possible marriage partners in rural areas".' },
            { n: 10, prompt: 'Gap 10', answer: ['independence'], explanation: '"a symbol of independence".' },
            { n: 11, prompt: 'Gap 11', answer: ['clothing'], explanation: '"it encouraged changes in clothing".' },
            { n: 12, prompt: 'Gap 12', answer: ['electric bicycles', 'electric bikes'], explanation: '"electric bicycles have made longer and hillier journeys possible".' },
          ],
        },
      ],
    },
  },
  {
    slug: 'mock-general-volunteering',
    variant: 'general',
    title: 'Volunteering at the City Food Bank',
    description: 'Mock test reading passage (General Training).',
    difficulty: 'easy',
    timeLimitSec: 20 * 60,
    mockOnly: true,
    content: {
      passages: [
        {
          id: 'p1',
          title: 'Volunteering at the City Food Bank',
          paragraphs: [
            { text: 'The City Food Bank collects donated food and distributes it to families in need. We rely entirely on volunteers, and we welcome anyone aged 18 or over. Volunteers aged 16 and 17 may help at weekend collection points if accompanied by a parent or guardian.' },
            { label: 'Roles', text: 'Warehouse volunteers sort donations, check use-by dates and pack food parcels. Drivers deliver parcels to people who cannot visit our centres; they must hold a full driving licence and have at least two years’ driving experience. Centre volunteers welcome visitors, make hot drinks and help people find other support services.' },
            { label: 'Commitment', text: 'We ask volunteers to commit to at least one three-hour shift per fortnight for a minimum of three months. Shifts run from 9 am to 12 pm and from 1 pm to 4 pm, Monday to Saturday. If you cannot attend a shift, please tell your team leader at least 24 hours in advance.' },
            { label: 'Training', text: 'All new volunteers attend a two-hour introduction on a Tuesday evening, covering health and safety and how to talk sensitively to visitors. Warehouse volunteers also receive training in safe lifting. Drivers must complete a short online course before their first delivery.' },
            { label: 'Expenses', text: 'Volunteers can claim travel costs of up to £8 per shift. Drivers are paid 45p per mile for fuel. A free lunch is provided for anyone who works both a morning and an afternoon shift on the same day.' },
          ],
        },
      ],
      groups: [
        {
          id: 'g1',
          type: 'tfng',
          instructions: TFNG_INSTR,
          passageId: 'p1',
          options: TFNG,
          questions: [
            { n: 1, prompt: 'Sixteen-year-olds can volunteer alone at the warehouse.', answer: ['FALSE'], explanation: '16–17-year-olds may only help at weekend collection points with a parent or guardian.' },
            { n: 2, prompt: 'Drivers need at least two years of driving experience.', answer: ['TRUE'], explanation: '"at least two years’ driving experience".' },
            { n: 3, prompt: 'The food bank receives money from the local council.', answer: ['NOT GIVEN'], explanation: 'Funding from the council is not mentioned.' },
            { n: 4, prompt: 'Shifts are available on Sundays.', answer: ['FALSE'], explanation: 'Shifts run "Monday to Saturday".' },
          ],
        },
        {
          id: 'g2',
          type: 'sentence_completion',
          instructions: 'Complete the sentences below. Choose NO MORE THAN TWO WORDS AND/OR A NUMBER from the text for each answer.',
          passageId: 'p1',
          questions: [
            { n: 5, prompt: 'Warehouse volunteers check the ______ on donated food.', answer: ['use-by dates', 'use by dates'], explanation: '"check use-by dates".' },
            { n: 6, prompt: 'Volunteers should commit for at least ______.', answer: ['three months', '3 months'], explanation: '"for a minimum of three months".' },
            { n: 7, prompt: 'If you cannot attend, inform your team leader ______ in advance.', answer: ['24 hours'], explanation: '"at least 24 hours in advance".' },
            { n: 8, prompt: 'The introduction session takes place on a ______.', answer: ['Tuesday evening', 'Tuesday'], explanation: '"a two-hour introduction on a Tuesday evening".' },
            { n: 9, prompt: 'Before their first delivery, drivers complete a short ______.', answer: ['online course'], explanation: '"a short online course".' },
          ],
        },
        {
          id: 'g3',
          type: 'mcq',
          instructions: 'Choose the correct letter, A, B or C.',
          passageId: 'p1',
          questions: [
            { n: 10, prompt: 'Who receives a free lunch?', options: [{ key: 'A', text: 'all drivers' }, { key: 'B', text: 'volunteers working two shifts in one day' }, { key: 'C', text: 'new volunteers on their first day' }], answer: ['B'], explanation: '"for anyone who works both a morning and an afternoon shift on the same day".' },
          ],
        },
      ],
    },
  },
];
