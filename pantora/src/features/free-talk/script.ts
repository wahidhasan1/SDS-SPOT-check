import type { Topic } from "@/lib/types";

// Scripted lines for demo partners. They are shown as text (and optionally read
// by the browser's voice) and are always labeled as scripted.

const REACTIONS = ["That's interesting!", "I see.", "Oh, nice.", "Thanks for sharing that.", "That makes sense.", "I like that answer."];

export const GENERIC_TOPIC: Pick<Topic, "title" | "openingQuestion" | "followUps"> = {
  title: "Getting to know each other",
  openingQuestion: "What have you been up to this week?",
  followUps: [
    "What do you usually do to relax?",
    "What's something you're looking forward to?",
    "Is there a skill you'd like to learn this year?",
    "What's the best thing that happened to you recently?",
  ],
};

export function buildPartnerScript(partnerName: string, topic: Pick<Topic, "title" | "openingQuestion" | "followUps">, seed: number): string[] {
  const lines = [`Hi, I'm ${partnerName}! Nice to meet you. Shall we talk about "${topic.title}"?`, topic.openingQuestion];
  topic.followUps.forEach((q, i) => lines.push(`${REACTIONS[(seed + i) % REACTIONS.length]} ${q}`));
  lines.push("I've really enjoyed this. Is there anything you'd like to ask me?");
  lines.push("Thanks for the conversation! You can end the call whenever you're ready.");
  return lines;
}
