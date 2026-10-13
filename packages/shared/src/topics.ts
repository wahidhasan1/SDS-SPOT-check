import type { PracticeMode } from './config';

export interface ConversationTopic {
  id: string;
  label: string;
  /** Topics only available on paid plans are decided by the server (plan.limits.premiumTopics). */
  mode: PracticeMode | 'any';
  prompts: string[];
}

export const CONVERSATION_TOPICS: ConversationTopic[] = [
  {
    id: 'random',
    label: 'Random Conversation',
    mode: 'any',
    prompts: [
      'What is something small that made you happy this week?',
      'If you could learn any skill instantly, what would it be?',
      'What does a perfect weekend look like for you?',
      'Describe a place you would love to visit and why.',
      'What is a habit you are trying to build?',
    ],
  },
  {
    id: 'daily_life',
    label: 'Daily Life',
    mode: 'free_talk',
    prompts: [
      'Walk your partner through your typical morning.',
      'How do you usually relax after a busy day?',
      'Do you prefer cooking at home or eating out? Why?',
      'What chores do you enjoy, and which do you avoid?',
      'How has your daily routine changed in the last few years?',
    ],
  },
  {
    id: 'education',
    label: 'Education',
    mode: 'free_talk',
    prompts: [
      'Which subject did you enjoy most at school, and why?',
      'Should university education be free for everyone?',
      'What makes a teacher memorable?',
      'Online classes or classroom learning: which works better for you?',
      'What is the most useful thing you learned outside school?',
    ],
  },
  {
    id: 'technology',
    label: 'Technology',
    mode: 'free_talk',
    prompts: [
      'Which app could you not live without?',
      'Is social media making people more or less connected?',
      'How do you think AI will change jobs in your country?',
      'Should children have smartphones? At what age?',
      'Describe a piece of technology that disappointed you.',
    ],
  },
  {
    id: 'travel',
    label: 'Travel',
    mode: 'free_talk',
    prompts: [
      'Tell your partner about the best trip you have taken.',
      'Do you prefer planned trips or spontaneous travel?',
      'What should every visitor to your hometown see?',
      'Have you ever had a travel problem? How did you solve it?',
      'Would you rather travel alone or with friends?',
    ],
  },
  {
    id: 'food',
    label: 'Food',
    mode: 'free_talk',
    prompts: [
      'Describe a traditional dish from your region.',
      'What food do you miss when you are away from home?',
      'Is fast food a problem in your country?',
      'Have you ever tried a dish you really disliked?',
      'Who taught you to cook, if anyone?',
    ],
  },
  {
    id: 'hobbies',
    label: 'Hobbies',
    mode: 'free_talk',
    prompts: [
      'What hobby have you kept the longest?',
      'Is there a hobby you gave up? Why?',
      'Do you think hobbies should be productive?',
      'Which hobby would you recommend to a stressed student?',
      'How do you find time for your interests?',
    ],
  },
  {
    id: 'career',
    label: 'Career and Interviews',
    mode: 'free_talk',
    prompts: [
      'Practise answering: "Tell me about yourself."',
      'What is your greatest strength at work or study?',
      'Describe a challenge you overcame in a team.',
      'Where do you see yourself in five years?',
      'What would your ideal job look like?',
    ],
  },
  {
    id: 'business',
    label: 'Business',
    mode: 'free_talk',
    prompts: [
      'If you started a business, what would it be?',
      'What makes customer service excellent?',
      'Are small local shops still important?',
      'How should a company respond to a public mistake?',
      'Is working from home good for productivity?',
    ],
  },
  {
    id: 'current_affairs',
    label: 'Current Affairs',
    mode: 'free_talk',
    prompts: [
      'What local issue matters most to you right now?',
      'How do you decide which news sources to trust?',
      'What change would most improve your city?',
      'Should governments do more about climate change?',
      'How do you stay informed without feeling overwhelmed?',
    ],
  },
  {
    id: 'ielts_part1',
    label: 'IELTS Speaking Part 1',
    mode: 'ielts_speaking',
    prompts: [],
  },
  {
    id: 'ielts_part2',
    label: 'IELTS Speaking Part 2',
    mode: 'ielts_speaking',
    prompts: [],
  },
  {
    id: 'ielts_part3',
    label: 'IELTS Speaking Part 3',
    mode: 'ielts_speaking',
    prompts: [],
  },
];

export function findTopic(id: string | null | undefined): ConversationTopic | undefined {
  return CONVERSATION_TOPICS.find((t) => t.id === id);
}

export function topicsForMode(mode: PracticeMode): ConversationTopic[] {
  return CONVERSATION_TOPICS.filter((t) => t.mode === 'any' || t.mode === mode);
}
