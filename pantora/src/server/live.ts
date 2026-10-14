import "server-only";
import { all, get, getDb, newId, run, tx } from "./db";
import { selectPartner } from "@/lib/matching";
import { PROFICIENCY_LEVELS, type Proficiency } from "@/lib/types";
import type { UserProfile } from "@/lib/types";
import { getSettings } from "./services/users";

// Same-server live matching. Queue rows expire when the browser stops sending
// heartbeats. Both block directions are respected.

const STALE_MS = 15_000;

export interface LiveRoom {
  id: string;
  role: "caller" | "callee";
  partner: { id: string; displayName: string; avatar: string; proficiency: Proficiency };
  topicId: string | null;
  durationMinutes: number;
  status: "pending" | "active" | "ended";
}

function roomFor(userId: string): LiveRoom | null {
  const db = getDb();
  const row = get<{ id: string; caller_id: string; callee_id: string; topic_id: string | null; duration_minutes: number; status: LiveRoom["status"] }>(
    db,
    "SELECT * FROM live_rooms WHERE (caller_id = ? OR callee_id = ?) AND status != 'ended' AND created_at > ? ORDER BY created_at DESC LIMIT 1",
    userId,
    userId,
    new Date(Date.now() - 60 * 60_000).toISOString(),
  );
  if (!row) return null;
  const partnerId = row.caller_id === userId ? row.callee_id : row.caller_id;
  const p = get<{ id: string; display_name: string; avatar: string; proficiency: Proficiency }>(db, "SELECT id, display_name, avatar, proficiency FROM users WHERE id = ?", partnerId);
  if (!p) return null;
  return {
    id: row.id,
    role: row.caller_id === userId ? "caller" : "callee",
    partner: {
      id: p.id,
      displayName: getSettings(db, p.id).privacy.showDisplayName ? p.display_name : "Pantora learner",
      avatar: p.avatar,
      proficiency: p.proficiency,
    },
    topicId: row.topic_id,
    durationMinutes: row.duration_minutes,
    status: row.status,
  };
}

export function joinQueue(user: UserProfile, opts: { topicId: string | null; durationMinutes: number }) {
  const db = getDb();
  const now = new Date().toISOString();
  return tx(db, () => {
    const existing = roomFor(user.id);
    if (existing) return { status: "matched" as const, room: existing };
    run(
      db,
      `INSERT INTO live_queue (user_id, proficiency, topic_id, duration_minutes, joined_at, heartbeat_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET topic_id = excluded.topic_id, duration_minutes = excluded.duration_minutes, heartbeat_at = excluded.heartbeat_at`,
      user.id,
      user.proficiency,
      opts.topicId,
      opts.durationMinutes,
      now,
      now,
    );
    run(db, "DELETE FROM live_queue WHERE heartbeat_at < ?", new Date(Date.now() - STALE_MS).toISOString());
    const settings = getSettings(db, user.id, user);
    const blocked = new Set([
      ...all<{ id: string }>(db, "SELECT blocked_id AS id FROM blocks WHERE blocker_user_id = ?", user.id).map((r) => r.id),
      ...all<{ id: string }>(db, "SELECT blocker_user_id AS id FROM blocks WHERE blocked_id = ?", user.id).map((r) => r.id),
    ]);
    const waiting = all<{ user_id: string; display_name: string; proficiency: Proficiency; topic_id: string | null; duration_minutes: number }>(
      db,
      `SELECT q.user_id, u.display_name, q.proficiency, q.topic_id, q.duration_minutes FROM live_queue q JOIN users u ON u.id = q.user_id
       WHERE q.user_id != ? ORDER BY q.joined_at`,
      user.id,
    );
    // The other person's preferred range must include this user too.
    const mutual = waiting.filter((w) => {
      const theirs = getSettings(db, w.user_id).matching.proficiencyRange;
      const idx = PROFICIENCY_LEVELS.indexOf(user.proficiency);
      return idx >= PROFICIENCY_LEVELS.indexOf(theirs[0]) && idx <= PROFICIENCY_LEVELS.indexOf(theirs[1]);
    });
    const match = selectPartner(
      mutual.map((w) => ({ id: w.user_id, displayName: w.display_name, proficiency: w.proficiency, interests: [] as string[], topicId: w.topic_id, duration: w.duration_minutes })),
      { proficiencyRange: settings.matching.proficiencyRange, blockedIds: [...blocked] },
    );
    if (!match || match.widenedRange) return { status: "waiting" as const, waitingCount: waiting.length };
    const roomId = newId();
    run(
      db,
      `INSERT INTO live_rooms (id, caller_id, callee_id, topic_id, duration_minutes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      roomId,
      user.id,
      match.partner.id,
      opts.topicId ?? match.partner.topicId,
      Math.min(opts.durationMinutes, match.partner.duration),
      now,
      now,
    );
    run(db, "DELETE FROM live_queue WHERE user_id IN (?, ?)", user.id, match.partner.id);
    return { status: "matched" as const, room: roomFor(user.id)! };
  });
}

export function pollQueue(userId: string) {
  const room = roomFor(userId);
  if (room) return { status: "matched" as const, room };
  const db = getDb();
  const updated = run(db, "UPDATE live_queue SET heartbeat_at = ? WHERE user_id = ?", new Date().toISOString(), userId);
  return { status: updated.changes ? ("waiting" as const) : ("idle" as const) };
}

export function leaveQueue(userId: string) {
  run(getDb(), "DELETE FROM live_queue WHERE user_id = ?", userId);
}

export function assertRoomMember(roomId: string, userId: string) {
  const row = get<{ caller_id: string; callee_id: string; status: string }>(getDb(), "SELECT caller_id, callee_id, status FROM live_rooms WHERE id = ?", roomId);
  if (!row || ![row.caller_id, row.callee_id].includes(userId)) return null;
  return row;
}

export function addSignal(roomId: string, userId: string, kind: "offer" | "answer" | "candidate" | "bye", payload: unknown) {
  const db = getDb();
  run(db, "INSERT INTO live_signals (room_id, from_user_id, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)", roomId, userId, kind, JSON.stringify(payload ?? null), new Date().toISOString());
  if (kind === "answer") run(db, "UPDATE live_rooms SET status = 'active', updated_at = ? WHERE id = ?", new Date().toISOString(), roomId);
  if (kind === "bye") run(db, "UPDATE live_rooms SET status = 'ended', ended_by = ?, updated_at = ? WHERE id = ?", userId, new Date().toISOString(), roomId);
}

export function readSignals(roomId: string, userId: string, afterId: number) {
  return all<{ id: number; kind: string; payload: string }>(
    getDb(),
    "SELECT id, kind, payload FROM live_signals WHERE room_id = ? AND from_user_id != ? AND id > ? ORDER BY id",
    roomId,
    userId,
    afterId,
  ).map((s) => ({ id: s.id, kind: s.kind, payload: JSON.parse(s.payload) as unknown }));
}
