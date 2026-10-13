const ADJECTIVES = [
  'Fluent', 'Curious', 'Brave', 'Blue', 'Calm', 'Bright', 'Clever', 'Gentle', 'Happy', 'Kind', 'Lively',
  'Lucky', 'Mighty', 'Noble', 'Quick', 'Quiet', 'Sunny', 'Swift', 'Witty', 'Bold', 'Cheerful', 'Eager',
  'Golden', 'Jolly', 'Merry', 'Polite', 'Proud', 'Silver', 'Steady', 'Wise',
];
const NOUNS = [
  'Fox', 'Learner', 'Speaker', 'Penguin', 'Owl', 'Panda', 'Tiger', 'Falcon', 'Dolphin', 'Otter', 'Koala',
  'Robin', 'Lynx', 'Heron', 'Badger', 'Sparrow', 'Whale', 'Bear', 'Hawk', 'Turtle', 'Rabbit', 'Wolf',
  'Reader', 'Writer', 'Thinker', 'Explorer', 'Voyager', 'Pilot', 'Comet', 'Maple',
];
export const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#4f46e5'];
export const AVATAR_EMOJI = ['🦊', '🦉', '🐼', '🐯', '🐬', '🦦', '🐨', '🐧', '🦁', '🐢', '🐰', '🐺', '🐻', '🦅', '🐳', '🦜'];

export function randomAnonName(rand: () => number = Math.random): string {
  const a = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(rand() * NOUNS.length)];
  const num = Math.floor(rand() * 90) + 10;
  return `${a}${n}${num}`;
}

export function randomAvatar(rand: () => number = Math.random): string {
  const e = AVATAR_EMOJI[Math.floor(rand() * AVATAR_EMOJI.length)];
  const c = AVATAR_COLORS[Math.floor(rand() * AVATAR_COLORS.length)];
  return `${e}|${c}`;
}

export function parseAvatar(avatar: string | null | undefined): { emoji: string; color: string } {
  const [emoji, color] = (avatar ?? '').split('|');
  return { emoji: emoji || '🦊', color: color || AVATAR_COLORS[0] };
}
