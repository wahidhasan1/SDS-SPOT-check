import type { FastifyInstance, InjectOptions } from 'fastify'
import { Db, db, setDb } from './db/index.ts'
import { buildApp } from './app.ts'
import { seedPlans } from './lib/plans.ts'
import { seedSpeaking } from './content/seed.ts'
import { seedVocab } from './routes/vocab.ts'
import { seedGrammar } from './routes/grammar.ts'

/** Builds an app on a fresh in-memory database with all seed content. */
export async function testApp(): Promise<FastifyInstance> {
  setDb(new Db(':memory:'))
  seedPlans()
  seedSpeaking()
  seedVocab()
  seedGrammar()
  const extra = (globalThis as { __extraSeeds?: (() => void)[] }).__extraSeeds ?? []
  extra.forEach((f) => f())
  return buildApp()
}

let n = 0
export type Agent = { id: string; cookie: string; req: <T = Record<string, unknown>>(method: string, url: string, body?: unknown) => Promise<{ status: number; body: T }> }

/** Signs up a real user through the API and returns a request helper carrying their session cookie. */
export async function signup(app: FastifyInstance, opts: { level?: string; birthYear?: number; email?: string } = {}): Promise<Agent> {
  const email = opts.email ?? `user${++n}.${Date.now()}@test.dev`
  const res = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email, password: 'secret123', displayName: 'Tester', birthYear: opts.birthYear ?? 1990, acceptTerms: true } })
  if (res.statusCode !== 200) throw new Error(res.body)
  const cookie = String(res.headers['set-cookie']).split(';')[0]
  const id = db().one<{ id: string }>('SELECT id FROM users WHERE email = ?', email)!.id
  if (opts.level !== undefined) db().run("UPDATE profiles SET cefr_level = ?, onboarding_step = 'done', voice_consent = 1 WHERE user_id = ?", opts.level, id)
  const req = async <T,>(method: string, url: string, body?: unknown) => {
    const r = await app.inject({ method: method as InjectOptions['method'], url, headers: { cookie }, payload: body as InjectOptions['payload'] })
    return { status: r.statusCode, body: (r.body ? JSON.parse(r.body) : null) as T }
  }
  return { id, cookie, req }
}
