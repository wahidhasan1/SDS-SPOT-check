import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { healthRoutes } from './health';
import { ieltsRoutes } from './ielts';
import { lessonRoutes } from './lessons';
import { mediaRoutes } from './media';
import { mockRoutes } from './mock';
import { profileRoutes } from './profile';
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
}
