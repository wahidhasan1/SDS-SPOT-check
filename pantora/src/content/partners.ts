import type { DemoPartner } from "@/lib/types";

// Fictional practice partners used by demo mode. None of these are real people.
export const DEMO_PARTNERS: DemoPartner[] = [
  {
    id: "demo-amara",
    displayName: "Amara",
    avatar: "coral",
    proficiency: "intermediate",
    interests: ["cooking", "photography", "travel"],
    bio: "Loves trying recipes from different places and talking about food.",
  },
  {
    id: "demo-kenji",
    displayName: "Kenji",
    avatar: "sky",
    proficiency: "upper-intermediate",
    interests: ["technology", "cycling", "films"],
    bio: "Software tester who practices English for team meetings.",
  },
  {
    id: "demo-sofia",
    displayName: "Sofia",
    avatar: "violet",
    proficiency: "elementary",
    interests: ["music", "family", "everyday life"],
    bio: "Just started speaking practice and enjoys slow, friendly chats.",
  },
  {
    id: "demo-daniel",
    displayName: "Daniel",
    avatar: "emerald",
    proficiency: "advanced",
    interests: ["debate", "history", "books"],
    bio: "Enjoys debating big ideas and helping others find the right word.",
  },
  {
    id: "demo-priya",
    displayName: "Priya",
    avatar: "amber",
    proficiency: "intermediate",
    interests: ["career", "fitness", "podcasts"],
    bio: "Preparing to lead presentations in English at work.",
  },
  {
    id: "demo-mateo",
    displayName: "Mateo",
    avatar: "teal",
    proficiency: "upper-intermediate",
    interests: ["football", "travel", "storytelling"],
    bio: "Tells great stories and always asks follow-up questions.",
  },
  {
    id: "demo-hana",
    displayName: "Hana",
    avatar: "rose",
    proficiency: "beginner",
    interests: ["drawing", "animals", "food"],
    bio: "New to speaking practice and happy to go at a gentle pace.",
  },
  {
    id: "demo-omar",
    displayName: "Omar",
    avatar: "indigo",
    proficiency: "intermediate",
    interests: ["education", "science", "chess"],
    bio: "Teacher in training who practices explaining ideas clearly.",
  },
];

export function getDemoPartner(id: string | null | undefined): DemoPartner | undefined {
  if (!id) return undefined;
  return DEMO_PARTNERS.find((p) => p.id === id);
}
