import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/server/db/memory";
import { SqliteStore } from "../src/server/db/sqlite";
import type { Store } from "../src/server/db/store";
import type { Tables } from "../src/server/db/schema";

const now = "2026-09-24T10:00:00.000Z";

function user(id: string, extra: Partial<Tables["users"]> = {}): Tables["users"] {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    password_hash: null,
    role: "qa_analyst",
    team_id: null,
    title: null,
    avatar_color: "blue",
    active: true,
    notification_prefs: { progress: true, discussion: true },
    created_at: now,
    updated_at: now,
    last_seen_at: null,
    deactivated_at: null,
    ...extra,
  };
}

function project(id: string): Tables["projects"] {
  return { id, key: id.toUpperCase(), name: id, description: null, qa_lead_id: null, pm_id: null, archived: false, created_at: now, updated_at: now };
}

const stores: [string, () => Store][] = [
  ["memory", () => new MemoryStore()],
  ["sqlite", () => new SqliteStore(":memory:")],
];

describe.each(stores)("%s store", (_name, make) => {
  it("inserts and reads rows with typed columns", () => {
    const s = make();
    s.insert("users", user("u1", { active: false }));
    const u = s.get("users", "u1")!;
    expect(u.active).toBe(false);
    expect(u.notification_prefs).toEqual({ progress: true, discussion: true });
    expect(u.team_id).toBeNull();
    expect(s.get("users", "missing")).toBeUndefined();
  });

  it("filters, sorts and paginates consistently", () => {
    const s = make();
    s.insert("users", user("a", { role: "engineer", name: "Anna", last_seen_at: "2026-09-01T00:00:00.000Z" }));
    s.insert("users", user("b", { role: "qa_analyst", name: "Bjørn", active: false }));
    s.insert("users", user("c", { role: "qa_lead", name: "Carla", last_seen_at: "2026-09-20T00:00:00.000Z" }));
    s.insert("users", user("d", { role: "engineer", name: "Dev" }));

    expect(s.find("users", { where: { role: "engineer" } }).map((u) => u.id).sort()).toEqual(["a", "d"]);
    expect(s.find("users", { where: { active: false } }).map((u) => u.id)).toEqual(["b"]);
    expect(s.find("users", { where: { role: { in: ["qa_analyst", "qa_lead"] } } }).map((u) => u.id).sort()).toEqual(["b", "c"]);
    expect(s.find("users", { where: { role: { nin: ["engineer"] } } }).map((u) => u.id).sort()).toEqual(["b", "c"]);
    expect(s.find("users", { where: { last_seen_at: { isNull: true } } }).map((u) => u.id).sort()).toEqual(["b", "d"]);
    expect(s.find("users", { where: { last_seen_at: { gte: "2026-09-10T00:00:00.000Z" } } }).map((u) => u.id)).toEqual(["c"]);
    expect(s.find("users", { where: { name: { like: "ARL" } } }).map((u) => u.id)).toEqual(["c"]);
    expect(
      s.find("users", { where: { $or: [{ role: "qa_lead" }, { name: { like: "dev" } }] } }).map((u) => u.id).sort(),
    ).toEqual(["c", "d"]);

    const sorted = s.find("users", { orderBy: [{ column: "last_seen_at", dir: "desc" }, { column: "id" }] }).map((u) => u.id);
    expect(sorted).toEqual(["c", "a", "b", "d"]);
    expect(s.find("users", { orderBy: [{ column: "id" }], limit: 2, offset: 1 }).map((u) => u.id)).toEqual(["b", "c"]);
    expect(s.count("users", { role: "engineer" })).toBe(2);
    expect(s.count("users")).toBe(4);
  });

  it("queries JSON array columns", () => {
    const s = make();
    s.insert("users", user("u1"));
    s.insert("projects", project("p1"));
    s.insert("modules", { id: "m1", project_id: "p1", name: "Members", description: null, owner_id: null, sort_order: 1, archived: false, created_at: now });
    s.insert("events", { id: "e1", bug_id: null, actor_id: "u1", type: "x", entity_type: "t", entity_id: null, data: { tags: ["a"] }, created_at: now });
    const e = s.get("events", "e1")!;
    expect(e.data).toEqual({ tags: ["a"] });
    s.insert("notifications", { id: "n1", user_id: "u1", type: "t", category: "action", bug_id: null, actor_id: null, title: "Hello", body: null, created_at: now, read_at: null });
    expect(s.count("notifications", { user_id: "u1", read_at: null })).toBe(1);
  });

  it("updates and removes rows", () => {
    const s = make();
    s.insert("users", user("u1"));
    const updated = s.update("users", "u1", { name: "Renamed", active: false, title: undefined });
    expect(updated.name).toBe("Renamed");
    expect(updated.active).toBe(false);
    expect(() => s.update("users", "nope", { name: "x" })).toThrow(/not found/);
    s.remove("users", "u1");
    expect(s.get("users", "u1")).toBeUndefined();
  });

  it("enforces unique columns", () => {
    const s = make();
    s.insert("users", user("u1"));
    expect(() => s.insert("users", user("u2", { email: "u1@example.com" }))).toThrow(/UNIQUE/);
  });

  it("rolls back failed transactions, including nested ones", () => {
    const s = make();
    s.insert("users", user("u1"));
    expect(() =>
      s.transaction(() => {
        s.insert("users", user("u2"));
        s.update("users", "u1", { name: "Changed" });
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(s.get("users", "u2")).toBeUndefined();
    expect(s.get("users", "u1")!.name).toBe("User u1");

    s.transaction(() => {
      s.insert("users", user("u3"));
      try {
        s.transaction(() => {
          s.insert("users", user("u4"));
          throw new Error("inner");
        });
      } catch {
        // swallowed: the outer transaction continues
      }
    });
    expect(s.get("users", "u3")).toBeDefined();
    expect(s.get("users", "u4")).toBeUndefined();
  });

  it("hands out monotonic sequence numbers", () => {
    const s = make();
    expect(s.nextSequence("bug", 100)).toBe(100);
    expect(s.nextSequence("bug", 100)).toBe(101);
    expect(s.nextSequence("other")).toBe(1);
  });

  it("returns copies that cannot mutate stored rows", () => {
    const s = make();
    s.insert("users", user("u1"));
    const u = s.get("users", "u1")!;
    u.notification_prefs.progress = false;
    expect(s.get("users", "u1")!.notification_prefs.progress).toBe(true);
  });
});

describe("memory store snapshots", () => {
  it("round-trips through a snapshot", () => {
    const a = new MemoryStore();
    a.insert("users", user("u1"));
    a.nextSequence("bug");
    const b = new MemoryStore(JSON.parse(JSON.stringify(a.snapshot())));
    expect(b.get("users", "u1")!.email).toBe("u1@example.com");
    expect(b.nextSequence("bug")).toBe(2);
  });
});
