import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { healthRoutes } from './health';
import { ieltsRoutes } from './ielts';
import { lessonRoutes } from './lessons';
import { mediaRoutes } from './media';
import { mockRoutes } from './mock';
import { profileRoutes } from './profile';
import { readerRoutes } from './reader';
import { socialRoutes } from './social';
import { accountRoutes } from './account';
import { billingRoutes } from './billing';
import { adminRoutes } from './admin';
import { realtimeRoutes } from '../realtime/hub';
import { registerCallHandlers } from '../realtime/calls';
import { registerBattleHandlers } from '../realtime/battles';
import { progressRoutes } from './progress';
import { speakingRoutes } from './speaking';
import { vocabRoutes } from './vocab';
import { writingRoutes } from './writing';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(mediaRoutes);
  await app.register(profileRoutes);
  await app.register(lessonRoutes);
  await app.register(vocabRoutes);
  await app.register(ieltsRoutes);
  await app.register(writingRoutes);
  await app.register(speakingRoutes);
  await app.register(mockRoutes);
  await app.register(progressRoutes);
  await app.register(readerRoutes);
  await app.register(socialRoutes);
  await app.register(accountRoutes);
  await app.register(billingRoutes);
  await app.register(adminRoutes);
  await app.register(realtimeRoutes);
  registerHandlersOnce();
}

let handlersRegistered = false;
function registerHandlersOnce() {
  if (handlersRegistered) return;
  handlersRegistered = true;
  registerCallHandlers();
  registerBattleHandlers();
}
