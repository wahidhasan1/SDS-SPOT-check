import type { Difficulty, TopicCategory } from "@/lib/types";
import { getBattleMode, type BattleMode, type BattleModeId, type PromptModeId } from "./battle-modes";

export interface BattlePrompt {
  id: string;
  /** The battle type this prompt belongs to. */
  mode: PromptModeId;
  topicId: string | null;
  category: TopicCategory;
  difficulty: Difficulty;
  prompt: string;
  /** Short instruction shown with the prompt. */
  guidance: string;
  /** Pre-written sample answer used by the demo opponent. Clearly labeled as a sample in the UI. */
  sampleResponse: { partnerId: string; text: string };
}

export const BATTLE_PROMPTS: BattlePrompt[] = [
  {
    id: "bp-ideal-weekend",
    mode: "quick-fire",
    topicId: "ideal-weekend",
    category: "everyday-life",
    difficulty: "easy",
    prompt: "Explain your ideal weekend in 30 seconds.",
    guidance: "Say what you would do, who you would be with, and why you would enjoy it.",
    sampleResponse: {
      partnerId: "demo-amara",
      text: "My ideal weekend start with a slow breakfast with my family. After that I go to the market and buy fresh vegetables, because I love cooking. In the afternoon I would meet my friends in the park and we take a lot of photos. In the evening I cook a big dinner. It is very relaxing and it give me energy for the next week.",
    },
  },
  {
    id: "bp-best-advice",
    mode: "story-sprint",
    topicId: "life-advice",
    category: "personal-development",
    difficulty: "medium",
    prompt: "What is the best piece of advice you have ever received?",
    guidance: "Share the advice, who gave it to you, and how it changed what you do.",
    sampleResponse: {
      partnerId: "demo-kenji",
      text: "The best advice I ever received came from my first manager. She told me that asking questions is not a weakness. Before that, I was afraid to look stupid in meetings, so I stayed quiet. Now I ask questions early, which saves time for the whole team. For example, last month a quick question helped us find a serious bug before the release.",
    },
  },
  {
    id: "bp-city-country",
    mode: "opinion-clash",
    topicId: "city-vs-country",
    category: "opinions-debate",
    difficulty: "medium",
    prompt: "Is it better to live in a big city or in the countryside? Defend your choice.",
    guidance: "Pick a side, give two reasons, and support one reason with an example.",
    sampleResponse: {
      partnerId: "demo-mateo",
      text: "I think living in a big city is better, especially for young people. First, there are more job opportunities and you can meet people from many backgrounds. Second, public transport makes life easier, so you don't need a car. For example, when I moved to the city I find a job in two weeks. Of course the countryside is more peaceful, but I prefer energy and variety.",
    },
  },
  {
    id: "bp-favorite-place",
    mode: "describe-it",
    topicId: "neighborhood",
    category: "everyday-life",
    difficulty: "easy",
    prompt: "Describe your favorite place in your town.",
    guidance: "Describe what it looks like, what you do there, and why you like it.",
    sampleResponse: {
      partnerId: "demo-sofia",
      text: "My favorite place is a small cafe near my house. It have big windows and many plants. I go there every saturday with my sister. We drink tea and we talk about our week. The people there is very kind. I like it because it is quiet and very nice.",
    },
  },
  {
    id: "bp-technology-change",
    mode: "big-question",
    topicId: "ai-everyday",
    category: "technology",
    difficulty: "medium",
    prompt: "Which piece of technology has changed your life the most?",
    guidance: "Name it, explain what changed, and mention one downside.",
    sampleResponse: {
      partnerId: "demo-priya",
      text: "For me, the smartphone has changed my life the most. I use it for work emails, for navigation and for learning English with podcasts. It make my day more organized. However, sometimes I spend too much time on social media, and I sleep late. Now I am trying to put my phone in another room at night, and it really helps me.",
    },
  },
  {
    id: "bp-teacher",
    mode: "story-sprint",
    topicId: "favorite-teacher",
    category: "education",
    difficulty: "easy",
    prompt: "Talk about a teacher who made a difference to you.",
    guidance: "Who were they, what did they do differently, and what did you learn?",
    sampleResponse: {
      partnerId: "demo-omar",
      text: "My chemistry teacher in secondary school made a big difference to me. Before her class I was thinking science was boring. She explained difficult ideas with simple experiments, for example she made a volcano with baking soda. Because of her, I decided to become a teacher too. I learned that a good teacher make students curious, not only memorize.",
    },
  },
  {
    id: "bp-four-day-week",
    mode: "opinion-clash",
    topicId: "four-day-week",
    category: "opinions-debate",
    difficulty: "challenging",
    prompt: "Should every company adopt a four-day work week?",
    guidance: "Take a clear position, consider one counter-argument, and finish with a conclusion.",
    sampleResponse: {
      partnerId: "demo-daniel",
      text: "I believe most companies should at least experiment with a four-day week. Several trials have suggested that rested employees are more focused, which can balance the lost hours. Admittedly, it would not suit every industry; hospitals and shops need people every day. However, those businesses could rotate schedules instead. Overall, the goal should be productivity and wellbeing, not simply hours at a desk.",
    },
  },
  {
    id: "bp-memorable-meal",
    mode: "describe-it",
    topicId: "favorite-dish",
    category: "food-lifestyle",
    difficulty: "easy",
    prompt: "Describe a meal you will never forget.",
    guidance: "Where were you, what did you eat, and why was it special?",
    sampleResponse: {
      partnerId: "demo-hana",
      text: "I never forget the soup my grandmother make when I was sick. It was hot and very good. She cut the vegetables very small. I eat it in my bed and I feel better. It is special because my grandmother love me.",
    },
  },
  {
    id: "bp-trip-problem",
    mode: "story-sprint",
    topicId: "memorable-trip",
    category: "travel-culture",
    difficulty: "medium",
    prompt: "Tell the story of a travel plan that went wrong.",
    guidance: "Set the scene, explain the problem, and describe how it ended.",
    sampleResponse: {
      partnerId: "demo-mateo",
      text: "Two years ago I planned a weekend trip to the mountains with my brother. When we arrived at the station, we realized our train was cancelled because of snow. We were very disappointed, but a local family invited us to their guesthouse. We stayed there, played cards, and ate amazing food. In the end, it became one of my favorite trips, even though we never saw the mountains.",
    },
  },
  {
    id: "bp-new-skill",
    mode: "quick-fire",
    topicId: "new-hobby",
    category: "hobbies",
    difficulty: "easy",
    prompt: "What new skill would you like to learn this year, and why?",
    guidance: "Name the skill, explain your reason, and say how you would start.",
    sampleResponse: {
      partnerId: "demo-amara",
      text: "This year I want to learn photography properly. I take many photos of food but they are not very good. I would like to understand light and composition. I will start with an online course and practice every weekend in my kitchen. Maybe in the future I can make a small cooking blog with my own pictures.",
    },
  },
  {
    id: "bp-social-media-age",
    mode: "opinion-clash",
    topicId: "social-media",
    category: "technology",
    difficulty: "challenging",
    prompt: "Should there be a minimum age for using social media?",
    guidance: "State your view, give a reason, and suggest how it could work in practice.",
    sampleResponse: {
      partnerId: "demo-kenji",
      text: "Yes, I think a minimum age makes sense, maybe around fifteen. Young children can't always recognize manipulation or protect their privacy. On the other hand, a strict ban is difficult to enforce, because kids can lie about their age. So I would combine an age limit with better parental tools and education at school about how algorithms work.",
    },
  },
  {
    id: "bp-success",
    mode: "big-question",
    topicId: "success-meaning",
    category: "personal-development",
    difficulty: "challenging",
    prompt: "What does success mean to you?",
    guidance: "Give your definition and support it with a personal example.",
    sampleResponse: {
      partnerId: "demo-daniel",
      text: "To me, success means having enough freedom to spend my time on things that matter. Money is part of that, but it is not the goal itself. For instance, my uncle earns less than his former colleagues, yet he coaches a youth team every evening and seems genuinely content. That balance between purpose and stability is what I would call success.",
    },
  },
  {
    id: "bp-morning-person",
    mode: "quick-fire",
    topicId: "morning-routine",
    category: "everyday-life",
    difficulty: "easy",
    prompt: "Morning person or night owl? Tell us which one you are.",
    guidance: "Pick one, give a reason, and describe a typical moment from your day.",
    sampleResponse: {
      partnerId: "demo-sofia",
      text: "I am a night owl. In the morning I am very slow and I need two coffee. But in the night I have many energy. I like to read and listen music when everybody is sleeping. Sometimes I go to bed at two o'clock, and it is not good for my work.",
    },
  },
  {
    id: "bp-superpower",
    mode: "quick-fire",
    topicId: "superpower",
    category: "storytelling",
    difficulty: "easy",
    prompt: "You get one superpower for a day. What do you choose?",
    guidance: "Name the power, say what you would do with it, and why.",
    sampleResponse: {
      partnerId: "demo-omar",
      text: "I would choose teleportation, for sure. In the morning I would visit my family in another country and have breakfast with them. After that I would go to see the pyramids and then swim in a beach in Thailand. I choose it because I hate long flights and I miss my family a lot.",
    },
  },
  {
    id: "bp-dream-destination",
    mode: "describe-it",
    topicId: "dream-destination",
    category: "travel-culture",
    difficulty: "easy",
    prompt: "Describe a place you dream of visiting.",
    guidance: "Describe what you would see, hear, and do there.",
    sampleResponse: {
      partnerId: "demo-priya",
      text: "I dream of visiting Iceland in winter. I imagine black beaches, huge waterfalls and snowy mountains everywhere. At night the sky would be full of green northern lights. I would stay in a small wooden cabin, drink hot chocolate and listen to the wind outside. It sounds peaceful and a little bit magical.",
    },
  },
  {
    id: "bp-phone-screen",
    mode: "describe-it",
    topicId: "phone-habits",
    category: "technology",
    difficulty: "easy",
    prompt: "Describe your phone's home screen. What does it say about you?",
    guidance: "Describe the background, the apps you see first, and what they show about your life.",
    sampleResponse: {
      partnerId: "demo-hana",
      text: "My home screen have a picture of my cat. She is white and very fat. I have music app, a dictionary and a game with candies. I think it say that I like animals and I am learning English. And maybe I play too much games.",
    },
  },
  {
    id: "bp-homework",
    mode: "opinion-clash",
    topicId: "homework-debate",
    category: "opinions-debate",
    difficulty: "medium",
    prompt: "Should homework be banned? Pick a side.",
    guidance: "Choose yes or no, give two reasons, and answer one argument from the other side.",
    sampleResponse: {
      partnerId: "demo-priya",
      text: "I don't think homework should be banned, but there should be much less of it. Short practice at home helps students remember what they learned. Also, it teaches them to organize their time. Some people say homework causes stress, and that's true when teachers give too much. So my answer is: keep it, but limit it to around thirty minutes a day.",
    },
  },
  {
    id: "bp-nervous-moment",
    mode: "story-sprint",
    topicId: "overcoming-fear",
    category: "personal-development",
    difficulty: "medium",
    prompt: "Tell the story of a time you felt really nervous.",
    guidance: "Set the scene, explain why you were nervous, and say how it turned out.",
    sampleResponse: {
      partnerId: "demo-kenji",
      text: "The most nervous I've ever felt was before my first presentation in English at work. My hands were shaking and I had practiced the first sentence about fifty times. When I started, my voice was very quiet, but then a colleague smiled and nodded. That small gesture calmed me down. In the end, the presentation went well, and my manager asked me to present again the next month.",
    },
  },
  {
    id: "bp-future-life",
    mode: "big-question",
    topicId: "future-tech",
    category: "technology",
    difficulty: "challenging",
    prompt: "How will technology change everyday life by 2050?",
    guidance: "Make one clear prediction, explain why, and mention one risk.",
    sampleResponse: {
      partnerId: "demo-daniel",
      text: "By 2050, I expect most routine tasks, like shopping, driving, and paperwork, to be handled by automated assistants. That would free up a lot of time, which people could spend on relationships or creative work. The main risk, in my view, is dependency: if systems fail or are controlled by a few companies, ordinary people could lose both skills and independence. So the technology itself is promising, but regulation will matter enormously.",
    },
  },
  {
    id: "bp-time-travel",
    mode: "big-question",
    topicId: "time-travel",
    category: "storytelling",
    difficulty: "challenging",
    prompt: "If you could witness any moment in history, which would you choose and why?",
    guidance: "Choose the moment, explain why it matters, and say what you would hope to learn.",
    sampleResponse: {
      partnerId: "demo-mateo",
      text: "I would choose the moment when the first people landed on the moon in 1969. I think it was one of the few times when the whole world was watching the same thing together. I would like to see how people reacted in the streets, because today we are so divided. I hope I would learn what makes humans cooperate on something so difficult.",
    },
  },
];

export function getBattlePrompt(id: string | null | undefined) {
  if (!id) return undefined;
  return BATTLE_PROMPTS.find((p) => p.id === id);
}

/** Deterministic daily challenge: the same prompt for everyone on a given date. */
export function dailyChallengeFor(dateKey: string): BattlePrompt {
  let hash = 0;
  for (const ch of dateKey) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return BATTLE_PROMPTS[hash % BATTLE_PROMPTS.length];
}

export function promptsForMode(mode: BattleModeId): BattlePrompt[] {
  return mode === "free-play" ? BATTLE_PROMPTS : BATTLE_PROMPTS.filter((p) => p.mode === mode);
}

/** The battle type that owns a prompt (used for XP and per-type stats). */
export function modeOfPrompt(prompt: Pick<BattlePrompt, "mode">): BattleMode {
  return getBattleMode(prompt.mode)!;
}

export function modeOfPromptId(promptId: string): BattleMode | undefined {
  const prompt = getBattlePrompt(promptId);
  return prompt ? modeOfPrompt(prompt) : undefined;
}
