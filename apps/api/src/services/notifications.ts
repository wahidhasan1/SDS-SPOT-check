import { db, schema } from '../db';

export async function notify(userId: string, n: { type: string; title: string; body: string; link?: string }) {
  await db.insert(schema.notifications).values({ userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null });
}
