import { db } from './db/index.ts'
import { seedPlans } from './lib/plans.ts'
import { seedSpeaking } from './content/seed.ts'
import { closeStaleSessions } from './realtime/calls.ts'
import { seedVocab } from './routes/vocab.ts'
import { seedGrammar } from './routes/grammar.ts'
import { seedObjective } from './ielts/objective-routes.ts'
import { seedWriting } from './ielts/writing-routes.ts'
import { seedMocks } from './ielts/mock-routes.ts'

/** One-time startup work: migrations (on first db() call), plan rules, content, leftover state. */
export function bootstrap() {
  db()
  seedPlans()
  seedSpeaking()
  seedVocab()
  seedGrammar()
  seedObjective()
  seedWriting()
  seedMocks()
  closeStaleSessions()
}
