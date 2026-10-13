/**
 * Integration code paths for external services, exercised against LOCAL TEST DOUBLES:
 * - a fake Anthropic Messages API server (no real AI is called),
 * - Stripe webhook events signed locally with the Stripe SDK (no Stripe network calls),
 * - a local SMTP server (no real email is sent).
 * These prove our request/response handling, not the behaviour of the real services.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import Stripe from 'stripe';
import { SMTPServer } from 'smtp-server';
import { eq } from 'drizzle-orm';
import { config } from '../src/config';
import { db, pool, schema } from '../src/db';
import { call, getApp, registerUser } from './helpers';

let aiServer: http.Server;
const aiRequests: { body: Record<string, unknown>; headers: http.IncomingHttpHeaders }[] = [];
let smtp: SMTPServer;
const mails: string[] = [];

function fakeReply(body: Record<string, unknown>) {
  const prompt = JSON.stringify(body.messages);
  let payload: unknown;
  if (prompt.includes('Writing Task')) {
    payload = {
      criteria: [
        { id: 'task', band: 6, comment: 'Covers the main features.', suggestions: ['Add an overview.'] },
        { id: 'coherence', band: 6.5, comment: 'Logical order.', suggestions: ['Vary linkers.'] },
        { id: 'lexical', band: 6, comment: 'Adequate range.', suggestions: ['Use more precise verbs.'] },
        { id: 'grammar', band: 5.5, comment: 'Some errors.', suggestions: ['Check articles.'] },
      ],
      overallBand: 6,
      summary: 'A solid answer with room to improve accuracy.',
      strengths: ['Clear structure'],
      improvements: ['Grammar accuracy'],
      corrections: [{ original: 'a informations', corrected: 'information', explanation: 'Uncountable noun.' }],
      improvedVersion: null,
    };
  } else if (prompt.includes('Speaking')) {
    payload = { fluency: { band: 6, comment: 'Mostly fluent.' }, lexical: { band: 6, comment: 'Good range.' }, grammar: { band: 5.5, comment: 'Some errors.' }, overallBand: 6, summary: 'Good effort.', tips: ['Use linking words.'], betterPhrases: [{ original: 'very good', better: 'excellent' }] };
  } else {
    payload = { lemma: 'bank', partOfSpeech: 'noun', meaningInContext: 'The land beside a river.', simpleDefinition: 'Sloping land next to water.', translation: 'orilla', exampleSentence: 'We had a picnic on the river bank.' };
  }
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

beforeAll(async () => {
  aiServer = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      aiRequests.push({ body, headers: req.headers });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(fakeReply(body)));
    });
  });
  await new Promise<void>((r) => aiServer.listen(0, '127.0.0.1', () => r()));
  config.anthropicApiKey = 'test-key';
  config.anthropicBaseUrl = `http://127.0.0.1:${(aiServer.address() as { port: number }).port}`;

  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS'],
    onData(stream, _session, cb) {
      let data = '';
      stream.on('data', (c) => (data += c));
      stream.on('end', () => {
        mails.push(data);
        cb();
      });
    },
  });
  await new Promise<void>((r) => smtp.listen(0, '127.0.0.1', () => r()));
  config.smtpUrl = `smtp://127.0.0.1:${(smtp.server.address() as { port: number }).port}`;
});

afterAll(async () => {
  config.anthropicApiKey = '';
  config.smtpUrl = '';
  aiServer.close();
  smtp.close();
  await (await getApp()).close();
  await pool.end();
});

async function waitFor<T>(fn: () => Promise<T | undefined | null | false>, ms = 10000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v as T;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('timed out');
}

describe('AI feedback (fake Anthropic server)', () => {
  it('evaluates a writing submission in the background and stores criteria, band and a notification', async () => {
    const u = await registerUser();
    const tasks = await call(u, 'GET', '/api/writing/tasks?variant=academic&task=1');
    expect(tasks.json.aiConfigured).toBe(true);
    const task = tasks.json.tasks.find((t: { locked: boolean }) => !t.locked);
    const sub = await call(u, 'POST', '/api/writing/submissions', { taskId: task.id });
    const text = 'The chart shows internet access in four countries. Overall, access increased everywhere. Canada had the highest figures, while Nigeria had the lowest. Brazil grew fastest over the period.';
    const r = await call(u, 'POST', `/api/writing/submissions/${sub.json.submission.id}/submit`, { text });
    expect(r.json.status).toBe('evaluating');
    const done = await waitFor(async () => {
      const v = await call(u, 'GET', `/api/writing/submissions/${sub.json.submission.id}`);
      return v.json.submission.status === 'evaluated' ? v.json.submission : null;
    });
    // Band = mean of criteria (6, 6.5, 6, 5.5) = 6.0
    expect(done.bandEstimate).toBe(6);
    expect(done.feedback.ai.corrections[0].corrected).toBe('information');
    const req = aiRequests.find((x) => JSON.stringify(x.body.messages).includes('Writing Task'))!;
    expect(req.headers['x-api-key']).toBe('test-key');
    expect(req.body.model).toBe(config.anthropicModel);
    expect(JSON.stringify(req.body.messages)).toContain('Data shown in the visual');
    const notes = await call(u, 'GET', '/api/notifications');
    expect(notes.json.notifications.some((n: { type: string }) => n.type === 'feedback')).toBe(true);
    // Feedback email went through SMTP (user has email notifications on by default).
    await waitFor(async () => mails.some((m) => m.includes('Your writing feedback is ready')));
  });

  it('explains a word in context with a translation', async () => {
    const u = await registerUser();
    const r = await call(u, 'POST', '/api/reader/explain', { word: 'bank', sentence: 'We sat on the bank of the river.', language: 'Spanish' });
    expect(r.status).toBe(200);
    expect(r.json.explanation.translation).toBe('orilla');
    expect(JSON.stringify(aiRequests.at(-1)!.body.messages)).toContain('Spanish');
  });

  it('evaluates a speaking answer from its transcript without commenting on pronunciation', async () => {
    const u = await registerUser();
    const prompts = await call(u, 'GET', '/api/speaking/prompts?part=1');
    const p = prompts.json.prompts[0];
    const a = await getApp();
    const boundary = 'XBOUNDARY';
    const fields: Record<string, string> = { mode: 'ielts', promptId: p.id, question: p.questions[0], transcript: 'I live in a small flat near the centre of the city with my sister and our cat, and I really like it because it is convenient.', transcriptSource: 'browser', durationSec: '15' };
    const wav = Buffer.concat([Buffer.from('RIFF\0\0\0\0WAVEfmt '), Buffer.alloc(64)]);
    const parts = Object.entries(fields).map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`).join('');
    const payload = Buffer.concat([Buffer.from(parts + `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n`), wav, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const res = await a.inject({ method: 'POST', url: '/api/speaking/attempts', headers: { cookie: u.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload });
    expect(res.statusCode).toBe(201);
    const id = res.json().attempt.id;
    expect(res.json().attempt.metrics.wordsPerMinute).toBe(Math.round(27 / 0.25));
    const done = await waitFor(async () => {
      const v = await call(u, 'GET', `/api/speaking/attempts/${id}`);
      return v.json.attempt.feedback?.aiStatus === 'done' ? v.json.attempt : null;
    });
    expect(done.feedback.ai.overallBand).toBe(6);
    expect(JSON.stringify(aiRequests.at(-1)!.body.messages)).toContain('CANNOT assess pronunciation');
    // The audio is private: other users cannot download it.
    const other = await registerUser();
    expect((await call(other, 'GET', `/api/media/${done.audioFileId}`)).status).toBe(403);
    expect((await call(u, 'GET', `/api/media/${done.audioFileId}`)).status).toBe(200);
  });
});

describe('Stripe webhooks (locally signed events)', () => {
  it('rejects bad signatures and applies a signed subscription event to the entitlement', async () => {
    const saved = { key: config.stripeSecretKey, price: config.stripePriceId, wh: config.stripeWebhookSecret };
    config.stripeSecretKey = 'sk_test_local';
    config.stripePriceId = 'price_local';
    config.stripeWebhookSecret = 'whsec_local_test';
    try {
      const u = await registerUser();
      const a = await getApp();
      const event = {
        id: 'evt_test',
        object: 'event',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test', object: 'subscription', customer: 'cus_test', status: 'active', cancel_at_period_end: false, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, metadata: { userId: u.id }, items: { data: [] } } },
      };
      const payload = JSON.stringify(event);
      const bad = await a.inject({ method: 'POST', url: '/api/billing/webhook', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=bad' }, payload });
      expect(bad.statusCode).toBe(400);
      const header = new Stripe('sk_test_local').webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_test' });
      const ok = await a.inject({ method: 'POST', url: '/api/billing/webhook', headers: { 'content-type': 'application/json', 'stripe-signature': header }, payload });
      expect(ok.statusCode).toBe(200);
      const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, u.id));
      expect(sub.plan).toBe('premium');
      expect(sub.provider).toBe('stripe');
      expect((await call(u, 'GET', '/api/auth/me')).json.me.plan).toBe('premium');
      // Development mode is disabled when real payments are configured.
      expect((await call(u, 'POST', '/api/billing/dev/activate')).status).toBe(403);
      // Cancellation event removes Premium.
      const cancelled = JSON.stringify({ ...event, id: 'evt_test2', type: 'customer.subscription.deleted', data: { object: { ...event.data.object, status: 'canceled' } } });
      const h2 = new Stripe('sk_test_local').webhooks.generateTestHeaderString({ payload: cancelled, secret: 'whsec_local_test' });
      await a.inject({ method: 'POST', url: '/api/billing/webhook', headers: { 'content-type': 'application/json', 'stripe-signature': h2 }, payload: cancelled });
      expect((await call(u, 'GET', '/api/auth/me')).json.me.plan).toBe('free');
    } finally {
      config.stripeSecretKey = saved.key;
      config.stripePriceId = saved.price;
      config.stripeWebhookSecret = saved.wh;
    }
  });
});

describe('Email (local SMTP server)', () => {
  it('delivers password reset emails through SMTP when configured', async () => {
    const u = await registerUser();
    await call(null, 'POST', '/api/auth/forgot-password', { email: u.email });
    await waitFor(async () => mails.some((m) => m.includes(u.email) && m.includes('reset-password?token=')));
    const [row] = await db.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, u.email));
    expect(row.status).toBe('sent');
  });
});
