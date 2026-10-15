import { getDb, run, tx } from "@/server/db";
import { HttpError, apiUser, handler, ok, parseBody } from "@/server/http";
import { getProfile, getSettings } from "@/server/services/users";
import { evaluateAchievements, totalXp } from "@/server/services/gamification";
import { isAvatarUnlocked } from "@/lib/avatars";
import { levelForXp } from "@/lib/game-rules";
import { settingsSchema } from "@/lib/schemas";

export const PATCH = handler(async (request: Request) => {
  const user = await apiUser();
  const body = await parseBody(request, settingsSchema);
  const db = getDb();
  const now = new Date().toISOString();
  if (body.profile && body.profile.avatar !== user.avatar && !isAvatarUnlocked(body.profile.avatar, levelForXp(totalXp(db, user.id)).current.index)) {
    throw new HttpError(400, "That avatar is a reward you haven't unlocked yet.");
  }
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
