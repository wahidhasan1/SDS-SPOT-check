import {
  AudioLines,
  Bookmark,
  CalendarCheck,
  CheckCheck,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  MessageCircle,
  MessagesSquare,
  Swords,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { ACHIEVEMENTS, type AchievementMetric } from "@/lib/game-rules";
import type { MedalColor } from "@/components/art/medal";

export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  "messages-square": MessagesSquare,
  "audio-lines": AudioLines,
  swords: Swords,
  trophy: Trophy,
  flame: Flame,
  "calendar-check": CalendarCheck,
  clock: Clock,
  timer: Timer,
  "check-check": CheckCheck,
  compass: Compass,
  bookmark: Bookmark,
  "graduation-cap": GraduationCap,
  target: Target,
};

const METRIC_COLORS: Record<AchievementMetric, MedalColor> = {
  conversations: "violet",
  battles: "pink",
  longestStreak: "orange",
  practiceMinutes: "sky",
  reviews: "mint",
  topicCategories: "sun",
  savedSentences: "sky",
  coachSessions: "mint",
  goalDays: "pink",
};

export function achievementVisual(id: string, icon: string) {
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  return { icon: ACHIEVEMENT_ICONS[icon] ?? Trophy, color: def ? METRIC_COLORS[def.metric] : ("violet" as MedalColor) };
}
