import type { Href } from 'expo-router';

import type { Recommendation } from './types';

/** Maps a server recommendation to the screen that fulfils it. */
export function recommendationHref(r: Recommendation): Href {
  if (r.kind === 'review') return '/review';
  if (r.kind === 'battle') return '/battle';
  if (r.kind === 'topics') return '/vocab';
  if (r.kind === 'assessment') return '/assessment/run';
  return { pathname: '/quiz', params: { types: r.types?.join(',') ?? '', topic: r.topic_id ?? '', title: r.title } };
}
