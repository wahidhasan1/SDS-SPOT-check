import { randomInt } from 'node:crypto';

const ADJ = ['Brave', 'Calm', 'Clever', 'Cosmic', 'Curious', 'Eager', 'Gentle', 'Golden', 'Happy', 'Jolly', 'Kind', 'Lucky', 'Mellow', 'Mighty', 'Nimble', 'Quiet', 'Rapid', 'Sunny', 'Swift', 'Witty', 'Bright', 'Bold', 'Cheerful', 'Silver'];
const NOUN = ['Falcon', 'Otter', 'Panda', 'Koala', 'Dolphin', 'Fox', 'Owl', 'Tiger', 'Lynx', 'Heron', 'Badger', 'Comet', 'Maple', 'River', 'Cedar', 'Willow', 'Robin', 'Sparrow', 'Penguin', 'Orca', 'Bison', 'Gecko'];

/** Random anonymous display name used in calls and battles. Never derived from the account. */
export function randomAlias(): string {
  return `${ADJ[randomInt(ADJ.length)]} ${NOUN[randomInt(NOUN.length)]} ${randomInt(10, 100)}`;
}
