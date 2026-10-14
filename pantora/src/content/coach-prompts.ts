import type { Difficulty } from "@/lib/types";

export interface CoachPrompt {
  id: string;
  prompt: string;
  difficulty: Difficulty;
  focus: string;
  sampleAnswer: string;
}

// Practice prompts for the AI Speaking Coach. Sample answers intentionally contain
// common learner mistakes so people can see how the feedback works.
export const COACH_PROMPTS: CoachPrompt[] = [
  {
    id: "cp-job",
    prompt: "Introduce yourself and describe your current job or studies.",
    difficulty: "easy",
    focus: "Present perfect and duration (for / since)",
    sampleAnswer:
      "Hello, my name is Alex. I am working here since two years as a designer. I like my job because I can create things and I work with a very good team.",
  },
  {
    id: "cp-yesterday",
    prompt: "What did you do yesterday? Describe your day from morning to evening.",
    difficulty: "easy",
    focus: "Past simple for finished actions",
    sampleAnswer:
      "Yesterday I go to market in the morning. Then I meet my friend and we eat lunch together. In the evening I watch a film and I sleep early.",
  },
  {
    id: "cp-opinion",
    prompt: "Do you think it is important to learn a second language? Why?",
    difficulty: "medium",
    focus: "Giving opinions with reasons and examples",
    sampleAnswer:
      "I am agree that learning a second language is very important. It help you to discuss about different ideas with people from other countries. For example, my colleague speak three languages and he has many opportunities.",
  },
  {
    id: "cp-problem",
    prompt: "Describe a problem you solved recently and how you solved it.",
    difficulty: "medium",
    focus: "Sequencing words and past tenses",
    sampleAnswer:
      "Last week my laptop stopped working before an important meeting. First, I restarted it, but nothing happened. Then I borrowed a laptop from a colleague and I joined the meeting on time. After that, I took my computer to a repair shop.",
  },
  {
    id: "cp-future",
    prompt: "Where would you like to be in five years?",
    difficulty: "medium",
    focus: "Future forms and conditionals",
    sampleAnswer:
      "In five years I would like to live in a bigger city and work for an international company. I want to improve my English because it will help me to get a better job. If I will have time, I will also learn to play the guitar.",
  },
  {
    id: "cp-recommend",
    prompt: "Recommend a place in your town to a visitor.",
    difficulty: "easy",
    focus: "Descriptive adjectives and articles",
    sampleAnswer:
      "You should visit the old harbor. There is a lot of nice restaurants and you can see boats. It is very nice in the evening because the sunset is very beautiful.",
  },
  {
    id: "cp-debate",
    prompt: "Should cities ban cars from their centers? Give your opinion.",
    difficulty: "challenging",
    focus: "Balanced arguments and linking words",
    sampleAnswer:
      "In my opinion, cities should reduce cars in the center but not ban them completely. Fewer cars would mean cleaner air and safer streets for children. However, older people and delivery workers still need access, so the city must offer good alternatives first.",
  },
  {
    id: "cp-meeting",
    prompt: "Explain to a colleague why a project deadline needs to move.",
    difficulty: "challenging",
    focus: "Polite, clear workplace language",
    sampleAnswer:
      "I wanted to talk with you about the deadline. We have found some problems in testing and the team need more time. I suggest to move the release one week later, so we can deliver a better product.",
  },
];

export function getCoachPrompt(id: string | null | undefined) {
  if (!id) return undefined;
  return COACH_PROMPTS.find((p) => p.id === id);
}
