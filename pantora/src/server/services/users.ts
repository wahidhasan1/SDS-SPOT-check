import type { DB } from "../db/sql";
import { get, json, newId, run, tx } from "../db/sql";
import type {
  ConversationPref,
  LearningGoal,
  Proficiency,
  UserProfile,
  UserSettings,
} from "@/lib/types";
import { PROFICIENCY_LEVELS } from "@/lib/types";

export interface UserRow {
  id: string;
  display_name: string;
  avatar: string;
  proficiency: Proficiency;
  goals: string;
  conversation_pref: ConversationPref;
  daily_goal_minutes: number;
  timezone: string;
  is_demo_account: number;
  origin: string;
  created_at: string;
}

export function toProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatar: row.avatar,
    proficiency: row.proficiency,
    goals: json<LearningGoal[]>(row.goals, []),
    conversationPref: row.conversation_pref,
    dailyGoalMinutes: row.daily_goal_minutes,
    timezone: row.timezone,
    isDemoAccount: row.is_demo_account === 1,
    createdAt: row.created_at,
  };
}

export function defaultSettings(profile: Pick<UserProfile, "proficiency" | "conversationPref">): UserSettings {
  const idx = PROFICIENCY_LEVELS.indexOf(profile.proficiency);
  const low = PROFICIENCY_LEVELS[Math.max(0, idx - 1)];
  const high = PROFICIENCY_LEVELS[Math.min(PROFICIENCY_LEVELS.length - 1, idx + 1)];
  return {
    matching: {
      proficiencyRange: [low, high],
      topicCategories: [],
      durationMinutes: 10,
      globalMatching: true,
      englishOnly: true,
      suggestTopic: true,
      modePreference: profile.conversationPref,
    },
    notifications: { practiceReminders: true, streakReminders: true, achievementNotifications: true },
    privacy: { showDisplayName: true, showPartnerNamesInHistory: true, transcriptRetention: "keep" },
    accessibility: { reducedMotion: false, largerText: false },
  };
}

export interface NewUserInput {
  id?: string;
  displayName: string;
  avatar: string;
  proficiency: Proficiency;
  goals: LearningGoal[];
  conversationPref: ConversationPref;
  dailyGoalMinutes: number;
  timezone: string;
  isDemoAccount?: boolean;
  origin?: "seed" | "local";
  createdAt?: string;
  settings?: Partial<UserSettings>;
}

export function createUser(db: DB, input: NewUserInput): UserProfile {
  const id = input.id ?? newId();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const settings = { ...defaultSettings(input), ...input.settings };
  tx(db, () => {
    run(
      db,
      `INSERT INTO users (id, display_name, avatar, proficiency, goals, conversation_pref, daily_goal_minutes, timezone, is_demo_account, origin, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.displayName,
      input.avatar,
      input.proficiency,
      JSON.stringify(input.goals),
      input.conversationPref,
      input.dailyGoalMinutes,
      input.timezone,
      input.isDemoAccount ? 1 : 0,
      input.origin ?? "local",
      createdAt,
    );
    run(
      db,
      `INSERT INTO user_settings (user_id, matching, notifications, privacy, accessibility, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      JSON.stringify(settings.matching),
      JSON.stringify(settings.notifications),
      JSON.stringify(settings.privacy),
      JSON.stringify(settings.accessibility),
      createdAt,
    );
  });
  return getProfile(db, id)!;
}

export function getProfile(db: DB, userId: string): UserProfile | null {
  const row = get<UserRow>(db, "SELECT * FROM users WHERE id = ?", userId);
  return row ? toProfile(row) : null;
}

interface SettingsRow {
  matching: string;
  notifications: string;
  privacy: string;
  accessibility: string;
}

export function getSettings(db: DB, userId: string, profile?: UserProfile | null): UserSettings {
  const p = profile ?? getProfile(db, userId);
  const defaults = defaultSettings(p ?? { proficiency: "intermediate", conversationPref: "both" });
  const row = get<SettingsRow>(db, "SELECT matching, notifications, privacy, accessibility FROM user_settings WHERE user_id = ?", userId);
  if (!row) return defaults;
  return {
    matching: { ...defaults.matching, ...json(row.matching, {}) },
    notifications: { ...defaults.notifications, ...json(row.notifications, {}) },
    privacy: { ...defaults.privacy, ...json(row.privacy, {}) },
    accessibility: { ...defaults.accessibility, ...json(row.accessibility, {}) },
  };
}
