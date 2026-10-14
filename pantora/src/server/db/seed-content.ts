// Fictional sample history for the preconfigured demo account. Everything here
// is clearly labeled as sample data in the product.

export const DEMO_USER_ID = "demo-user";

export interface SeedConversation {
  daysAgo: number;
  topicId: string;
  partnerId: string;
  minutes: number;
  /** Alternating lines: partner prompts are scripted, user lines are sample speech. */
  script?: { speaker: "partner" | "user"; text: string }[];
  incomplete?: boolean;
}

export const SEED_CONVERSATIONS: SeedConversation[] = [
  {
    daysAgo: 1,
    topicId: "ideal-weekend",
    partnerId: "demo-amara",
    minutes: 5,
    script: [
      { speaker: "partner", text: "What does your ideal weekend look like?" },
      { speaker: "user", text: "My ideal weekend is very relaxing. On saturday I wake up late and I go to park with my dog." },
      { speaker: "partner", text: "That sounds lovely! Why do you enjoy those activities?" },
      { speaker: "user", text: "Because I am working very hard during the week. My brother live near the park so sometimes he join us." },
      { speaker: "partner", text: "Would you prefer a quiet weekend or an adventurous one?" },
      { speaker: "user", text: "I think a quiet weekend is more better for me, but sometimes I like to try new restaurants with my friends." },
    ],
  },
  { daysAgo: 2, topicId: "job-interview", partnerId: "demo-priya", minutes: 4 },
  {
    daysAgo: 3,
    topicId: "memorable-trip",
    partnerId: "demo-mateo",
    minutes: 4,
    script: [
      { speaker: "partner", text: "Tell me about a trip that you still remember clearly." },
      { speaker: "user", text: "Two years ago I travel to the mountains with my family. We stay in a small hotel near a lake." },
      { speaker: "partner", text: "What surprised you the most about that place?" },
      { speaker: "user", text: "The people was very friendly and the food was very good. We eat fresh fish from the lake." },
      { speaker: "partner", text: "Did anything go wrong during the trip?" },
      { speaker: "user", text: "Yes, my sister lose her phone on the second day, but a kind man found it and he give it back." },
    ],
  },
  { daysAgo: 4, topicId: "phone-habits", partnerId: "demo-kenji", minutes: 5 },
  { daysAgo: 5, topicId: "favorite-dish", partnerId: "demo-hana", minutes: 3 },
  {
    daysAgo: 6,
    topicId: "learning-english",
    partnerId: "demo-omar",
    minutes: 5,
    script: [
      { speaker: "partner", text: "How did you start learning English?" },
      { speaker: "user", text: "I started at school, but I am studying English seriously since five years." },
      { speaker: "partner", text: "What has helped you improve the most?" },
      { speaker: "user", text: "Podcasts and films. I listen podcasts every morning when I go to work." },
      { speaker: "partner", text: "Which part of speaking feels hardest for you?" },
      { speaker: "user", text: "I am afraid to do mistakes in front of other people, and sometimes I can't find the right word." },
    ],
  },
  { daysAgo: 8, topicId: "superpower", partnerId: "demo-daniel", minutes: 0.7, incomplete: true },
  { daysAgo: 9, topicId: "remote-work", partnerId: "demo-kenji", minutes: 4 },
  { daysAgo: 10, topicId: "city-vs-country", partnerId: "demo-daniel", minutes: 5 },
  { daysAgo: 12, topicId: "morning-routine", partnerId: "demo-sofia", minutes: 3 },
  { daysAgo: 14, topicId: "habit-change", partnerId: "demo-priya", minutes: 4 },
  { daysAgo: 15, topicId: "favorite-music", partnerId: "demo-sofia", minutes: 3 },
  { daysAgo: 17, topicId: "neighborhood", partnerId: "demo-amara", minutes: 3 },
];

export interface SeedBattle {
  daysAgo: number;
  promptId: string;
  mode: "typed" | "spoken";
  speakSeconds: number;
  /** Seconds of recorded speech (0 for typed answers). */
  recordedSeconds: number;
  response: string;
}

export const SEED_BATTLES: SeedBattle[] = [
  {
    daysAgo: 16,
    promptId: "bp-ideal-weekend",
    mode: "typed",
    speakSeconds: 30,
    recordedSeconds: 0,
    response: "My ideal weekend is simple. I sleep late, I cook a big breakfast and I call my parents. In the afternoon I play football with friends.",
  },
  {
    daysAgo: 10,
    promptId: "bp-city-country",
    mode: "spoken",
    speakSeconds: 30,
    recordedSeconds: 30,
    response:
      "I prefer the countryside because life is slower and the air is cleaner. In the city everyone are always in a hurry. For example, my cousin moved to a village last year and she is happier now. But I agree the city has more jobs.",
  },
  {
    daysAgo: 5,
    promptId: "bp-favorite-place",
    mode: "typed",
    speakSeconds: 30,
    recordedSeconds: 0,
    response:
      "My favorite place in my town is the river park, because it is peaceful and green. There is a lot of trees and a small cafe next to the water. I usually go there on sunday mornings to walk, think and plan my week. For example, last month I decided to change my job while I was sitting on a bench there. It always helps me feel calm.",
  },
  {
    daysAgo: 2,
    promptId: "bp-best-advice",
    mode: "spoken",
    speakSeconds: 45,
    recordedSeconds: 45,
    response:
      "The best advice I received was from my father. He told me to never stop learning. When I was young I don't like reading, but he give me interesting books. Now I read every week and it help me a lot in my job, because I learn new ideas.",
  },
];

export interface SeedCoach {
  daysAgo: number;
  promptId: string;
  mode: "typed" | "spoken";
  recordedSeconds: number;
}

export const SEED_COACH: SeedCoach[] = [
  { daysAgo: 15, promptId: "cp-opinion", mode: "typed", recordedSeconds: 0 },
  { daysAgo: 9, promptId: "cp-yesterday", mode: "spoken", recordedSeconds: 35 },
  { daysAgo: 3, promptId: "cp-job", mode: "typed", recordedSeconds: 0 },
];
