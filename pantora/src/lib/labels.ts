import type {
  ConversationPref,
  Difficulty,
  IssueCategory,
  LearningGoal,
  Proficiency,
  SessionType,
  TopicCategory,
} from "./types";

export const PROFICIENCY_LABELS: Record<Proficiency, string> = {
  beginner: "Beginner",
  elementary: "Elementary",
  intermediate: "Intermediate",
  "upper-intermediate": "Upper-intermediate",
  advanced: "Advanced",
};

export const PROFICIENCY_DESCRIPTIONS: Record<Proficiency, string> = {
  beginner: "I know some words and simple phrases.",
  elementary: "I can talk about familiar things in short sentences.",
  intermediate: "I can hold a conversation but often search for words.",
  "upper-intermediate": "I speak comfortably on most topics, with some mistakes.",
  advanced: "I speak fluently and want to polish my expression.",
};

export const GOAL_LABELS: Record<LearningGoal, string> = {
  confidence: "Speak more confidently",
  fluency: "Improve fluency",
  grammar: "Improve grammar",
  vocabulary: "Expand vocabulary",
  work: "Communicate for work",
  everyday: "Practice everyday conversation",
  pronunciation: "Improve pronunciation",
};

export const CONVERSATION_PREF_LABELS: Record<ConversationPref, string> = {
  free_talk: "Free Talk",
  battles: "Speaking Battles",
  both: "Both",
};

export const CATEGORY_LABELS: Record<TopicCategory, string> = {
  "everyday-life": "Everyday Life",
  hobbies: "Hobbies and Interests",
  "travel-culture": "Travel and Culture",
  education: "Education",
  career: "Career and Workplace",
  "personal-development": "Personal Development",
  technology: "Technology",
  "food-lifestyle": "Food and Lifestyle",
  "opinions-debate": "Opinions and Debate",
  storytelling: "Creative Storytelling",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  challenging: "Challenging",
};

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  free_talk: "Free Talk",
  battle: "Speaking Battle",
  coach: "AI Practice",
};

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  tense: "Verb tense",
  agreement: "Subject–verb agreement",
  articles: "Articles (a / an / the)",
  prepositions: "Prepositions",
  "word-choice": "Word choice",
  "word-form": "Word form",
  "sentence-structure": "Sentence structure",
  punctuation: "Punctuation",
};
