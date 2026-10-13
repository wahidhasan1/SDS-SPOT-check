import { createHmac } from 'node:crypto';
import type { IceServer } from '@fluentpath/shared';
import { config } from '../config';

/**
 * STUN/TURN servers for WebRTC. TURN relays audio when two devices cannot connect directly
 * (e.g. strict mobile or corporate NATs). With TURN_SECRET (coturn "use-auth-secret"), short-lived
 * credentials are generated per user, so no long-term TURN password is ever sent to clients.
 */
export function iceServersFor(userId: string): IceServer[] {
  const servers: IceServer[] = [];
  if (config.stunUrls.length) servers.push({ urls: config.stunUrls });
  if (config.turnUrls.length) {
    if (config.turnSecret) {
      const username = `${Math.floor(Date.now() / 1000) + 6 * 3600}:${userId}`;
      const credential = createHmac('sha1', config.turnSecret).update(username).digest('base64');
      servers.push({ urls: config.turnUrls, username, credential });
    } else if (config.turnUsername && config.turnPassword) {
      servers.push({ urls: config.turnUrls, username: config.turnUsername, credential: config.turnPassword });
    }
  }
  return servers;
}
