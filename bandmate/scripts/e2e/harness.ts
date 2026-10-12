// Shared helpers for end-to-end tests: starts an isolated server (fresh database), creates real accounts
// through the public API, and launches separate Chromium instances that act as separate users/devices.
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

export const ROOT = path.resolve(import.meta.dirname, '..', '..')
export const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium'

export type Server = { url: string; dbPath: string; proc: ChildProcess; stop: () => Promise<void>; logs: string[] }

export async function startServer(opts: { port?: number; env?: Record<string, string> } = {}): Promise<Server> {
  const port = opts.port ?? 8800 + Math.floor(Math.random() * 100)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-e2e-'))
  const dbPath = path.join(dir, 'app.db')
  const logs: string[] = []
  const proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--import', 'tsx', 'server/index.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DB_PATH: dbPath, PUBLIC_URL: `http://localhost:${port}`, NODE_ENV: 'test', ...opts.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout!.on('data', (d) => logs.push(String(d)))
  proc.stderr!.on('data', (d) => logs.push(String(d)))
  const url = `http://localhost:${port}`
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${url}/api/config`)).ok) break
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200))
    if (i === 99) throw new Error('server did not start:\n' + logs.join(''))
  }
  return {
    url,
    dbPath,
    proc,
    logs,
    stop: async () => {
      proc.kill('SIGTERM')
      await new Promise((r) => proc.once('exit', r))
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

export async function launch(opts: { audioFile?: string; noFakeUi?: boolean } = {}): Promise<Browser> {
  const args = ['--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  if (!opts.noFakeUi) args.push('--use-fake-ui-for-media-stream')
  if (opts.audioFile) args.push(`--use-file-for-fake-audio-capture=${opts.audioFile}`)
  return chromium.launch({ executablePath: CHROME, args })
}

export type TestUser = { email: string; password: string; context: BrowserContext; page: Page; errors: string[] }

/** Creates a real account through the API and completes onboarding (goals, adaptive level check, interests). */
export async function createUser(browser: Browser, server: Server, opts: { name: string; birthYear?: number; answers?: 'first' | 'last'; viewport?: { width: number; height: number }; micPermission?: boolean }): Promise<TestUser> {
  const context = await browser.newContext({ baseURL: server.url, viewport: opts.viewport ?? { width: 420, height: 860 }, permissions: opts.micPermission === false ? [] : ['microphone'] })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const email = `${opts.name.toLowerCase()}.${Date.now()}${Math.floor(Math.random() * 1000)}@e2e.test`
  const password = 'practice123'
  const req = context.request
  const ok = async (p: Promise<{ ok(): boolean; text(): Promise<string>; url(): string }>) => {
    const r = await p
    if (!r.ok()) throw new Error(`${r.url()} → ${await r.text()}`)
    return r
  }
  await ok(req.post('/api/auth/signup', { data: { email, password, displayName: opts.name, birthYear: opts.birthYear ?? 1995, acceptTerms: true } }))
  await ok(req.patch('/api/me/profile', { data: { goal: 'ielts', testType: 'academic', targetBand: 7, dailyMinutes: 20, onboardingStep: 'assessment' } }))
  const start = (await (await ok(req.post('/api/assessment/start'))).json()) as { id: string; item: { id: string; options: string[] } }
  let item = start.item
  for (let i = 0; i < 40 && item; i++) {
    const r = (await (await ok(req.post('/api/assessment/answer', { data: { assessmentId: start.id, itemId: item.id, choice: opts.answers === 'last' ? item.options.length - 1 : 0 } }))).json()) as { done: boolean; item?: typeof item }
    if (r.done) break
    item = r.item!
  }
  await ok(req.patch('/api/me/profile', { data: { interests: ['travel'], onboardingStep: 'done' } }))
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('bm_debug_call', '1'))
  return { email, password, context, page, errors }
}

export const step = (s: string) => console.log(`  ✓ ${s}`)
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function until<T>(fn: () => Promise<T | null | undefined | false> | T | null | undefined | false, what: string, ms = 15_000): Promise<T> {
  const end = Date.now() + ms
  let last: unknown
  while (Date.now() < end) {
    try {
      const v = await fn()
      if (v) return v as T
    } catch (e) {
      last = e
    }
    await sleep(200)
  }
  throw new Error(`Timed out waiting for: ${what}${last ? ` (${(last as Error).message})` : ''}`)
}
