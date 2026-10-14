import type { Difficulty, TopicCategory } from "@/lib/types";

export interface BattlePrompt {
  id: string;
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
