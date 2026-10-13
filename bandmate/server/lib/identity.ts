import crypto from 'node:crypto'
import { db } from '../db/index.ts'

const ADJ = ['Brave', 'Calm', 'Clever', 'Curious', 'Bright', 'Gentle', 'Happy', 'Kind', 'Lucky', 'Quiet', 'Swift', 'Sunny', 'Witty', 'Bold', 'Cheerful', 'Eager', 'Fluent', 'Friendly', 'Keen', 'Steady', 'Smart', 'Polite', 'Jolly', 'Wise', 'Cosy', 'Breezy', 'Lively', 'Mellow', 'Nimble', 'Plucky']
const NOUN = ['Fox', 'Penguin', 'Owl', 'Panda', 'Otter', 'Falcon', 'Koala', 'Dolphin', 'Tiger', 'Robin', 'Badger', 'Heron', 'Lynx', 'Puffin', 'Rabbit', 'Squirrel', 'Turtle', 'Whale', 'Sparrow', 'Bear', 'Deer', 'Hedgehog', 'Kiwi', 'Llama', 'Moose', 'Seal', 'Swan', 'Wolf', 'Yak', 'Zebra', 'Learner', 'Speaker', 'Reader', 'Talker']
/** Icons that exist in lucide-react; the client maps these names to components. */
export const AVATAR_ICONS = ['bird', 'cat', 'dog', 'fish', 'rabbit', 'squirrel', 'turtle', 'snail', 'feather', 'leaf', 'flower', 'sun', 'moon', 'star', 'cloud', 'mountain'] as const
export const AVATAR_COLORS = ['#2563EB', '#0D9488', '#D97706', '#DC2626', '#7C3AED', '#059669', '#DB2777', '#4F46E5', '#0891B2', '#65A30D', '#EA580C', '#475569']

const pick = <T>(a: readonly T[]) => a[crypto.randomInt(a.length)]

/** A random, unique, non-identifying calling name such as "CuriousOtter" or "BraveSpeaker42". */
export function newAnonIdentity() {
  for (let i = 0; i < 50; i++) {
    const name = pick(ADJ) + pick(NOUN) + (i > 10 ? String(crypto.randomInt(10, 100)) : '')
    if (!db().one('SELECT 1 FROM profiles WHERE anon_name = ?', name)) {
      return { anonName: name, avatarIcon: pick(AVATAR_ICONS), avatarColor: pick(AVATAR_COLORS) }
    }
  }
  return { anonName: 'Learner' + crypto.randomInt(100000, 999999), avatarIcon: pick(AVATAR_ICONS), avatarColor: pick(AVATAR_COLORS) }
}
