import fs from 'node:fs'
import path from 'node:path'
import { db } from '../db/index.ts'
import { env } from '../env.ts'
import { now } from '../lib/util.ts'

export type SeedItem = {
  id: string
  kind: 'reading' | 'listening' | 'writing' | 'speaking' | 'grammar' | 'assessment' | 'mock'
  test_type?: 'academic' | 'general_training' | 'both' | null
  title: string
  level?: string | null
  premium?: boolean
  sort?: number
  data: unknown
}

const contentDir = () => path.join(env.root, 'content')
export const readContent = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(contentDir(), file), 'utf8')) as T

/**
 * Upserts seed content. Items an admin has edited (source = 'admin') are never overwritten,
 * so the CMS stays the source of truth once someone changes an item.
 */
export function upsertSeed(items: SeedItem[]) {
  db().tx(() => {
    for (const it of items) {
      const existing = db().one<{ source: string }>('SELECT source FROM content_items WHERE id = ?', it.id)
      const data = JSON.stringify(it.data)
      if (!existing) {
        db().run(
          'INSERT INTO content_items (id, kind, test_type, title, level, premium, status, source, data, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          it.id, it.kind, it.test_type ?? null, it.title, it.level ?? null, it.premium ? 1 : 0, 'published', 'seed', data, it.sort ?? 0, now(), now(),
        )
      } else if (existing.source === 'seed') {
        db().run('UPDATE content_items SET kind = ?, test_type = ?, title = ?, level = ?, premium = ?, data = ?, sort = ?, updated_at = ? WHERE id = ?', it.kind, it.test_type ?? null, it.title, it.level ?? null, it.premium ? 1 : 0, data, it.sort ?? 0, now(), it.id)
      }
    }
  })
}

type Speaking = {
  part1: { id: string; topic: string; questions: string[] }[]
  part2: { id: string; title: string; cue: string; points: string[]; explain: string; part3: string[] }[]
  casual: Record<string, string[]>
}

export function seedSpeaking() {
  const s = readContent<Speaking>('speaking.json')
  upsertSeed([
    ...s.part1.map((p, i) => ({ id: p.id, kind: 'speaking' as const, test_type: 'both' as const, title: p.topic, sort: i, data: { part: 1, ...p } })),
    ...s.part2.map((p, i) => ({ id: p.id, kind: 'speaking' as const, test_type: 'both' as const, title: p.title, sort: 100 + i, premium: i >= 8, data: { part: 2, ...p } })),
  ])
  refreshCallPrompts()
}

/** Call prompts are built from published speaking content plus the casual topic prompts. */
export function refreshCallPrompts() {
  const s = readContent<Speaking>('speaking.json')
  const items = db().all<{ data: string }>("SELECT data FROM content_items WHERE kind = 'speaking' AND status = 'published'").map((r) => JSON.parse(r.data))
  const existing = db().one<{ value: string }>("SELECT value FROM app_config WHERE key = 'call_prompts'")
  const casual = existing ? (JSON.parse(existing.value).casual as Record<string, string[]>) : s.casual
  const value = { part1: items.filter((d) => d.part === 1), part2: items.filter((d) => d.part === 2), casual }
  db().run("INSERT INTO app_config (key, value) VALUES ('call_prompts', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", JSON.stringify(value))
}
