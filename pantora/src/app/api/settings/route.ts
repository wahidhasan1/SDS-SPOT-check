import { getDb, run, tx } from "@/server/db";
import { apiUser, handler, ok, parseBody } from "@/server/http";
import { getProfile, getSettings } from "@/server/services/users";
import { evaluateAchievements } from "@/server/services/gamification";
import { settingsSchema } from "@/lib/schemas";

export const PATCH = handler(async (request: Request) => {
  const user = await apiUser();
  const body = await parseBody(request, settingsSchema);
  const db = getDb();
  const now = new Date().toISOString();
  tx(db, () => {
    if (body.profile) {
      const p = body.profile;
      run(
        db,
        `UPDATE users SET display_name = ?, avatar = ?, proficiency = ?, goals = ?, daily_goal_minutes = ?, conversation_pref = ? WHERE id = ?`,
        p.displayName,
        p.avatar,
        p.proficiency,
        JSON.stringify(p.goals),
        p.dailyGoalMinutes,
        p.conversationPref,
        user.id,
      );
    }
    for (const key of ["matching", "notifications", "privacy", "accessibility"] as const) {
      const value = body[key];
      if (value) run(db, `UPDATE user_settings SET ${key} = ?, updated_at = ? WHERE user_id = ?`, JSON.stringify(value), now, user.id);
    }
  });
  // A lower daily goal can make past days eligible for the Goal Getter achievement.
  if (body.profile) evaluateAchievements(db, user.id, new Date());
  const profile = getProfile(db, user.id)!;
  return ok({ profile, settings: getSettings(db, user.id, profile), savedAt: now });
});
