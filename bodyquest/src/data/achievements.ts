import type { Achievement, Mission, WeeklyChallenge } from '../domain/types';

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-workout', name: 'First Workout', description: 'Complete your first planned workout.', icon: '🏁', xp: 50, category: 'training' },
  { id: 'three-day', name: 'Three-Day Consistency', description: 'Keep 3 planned sessions in a row.', icon: '🔥', xp: 50, category: 'consistency' },
  { id: 'first-full-week', name: 'First Full Week', description: 'Keep every planned session in a calendar week.', icon: '📅', xp: 100, category: 'consistency' },
  { id: 'ten-workouts', name: 'Ten Completed Workouts', description: 'Complete 10 planned workouts.', icon: '💪', xp: 150, category: 'training' },
  { id: 'pushup-progress', name: 'Push-Up Progress', description: 'Accept a progression on any push exercise.', icon: '⬆️', xp: 75, category: 'training' },
  { id: 'mobility-master', name: 'Mobility Master', description: 'Complete 5 mobility or recovery sessions.', icon: '🧘', xp: 75, category: 'recovery' },
  { id: 'comeback-champion', name: 'Comeback Champion', description: 'Complete an approved comeback session after a missed workout.', icon: '🔁', xp: 75, category: 'recovery' },
  { id: 'monthly-consistency', name: 'Monthly Consistency', description: 'Keep 12 planned sessions within 30 days.', icon: '🗓️', xp: 200, category: 'consistency' },
  { id: 'personal-record', name: 'Personal Record', description: 'Set a new personal record in a performance test or exercise.', icon: '🏆', xp: 75, category: 'training' },
  { id: 'warmup-pro', name: 'Warm-Up Pro', description: 'Complete the full warm-up in 5 workouts.', icon: '🌡️', xp: 50, category: 'habits' },
  { id: 'hydration-habit', name: 'Hydration Habit', description: 'Reach your hydration target on 5 days.', icon: '💧', xp: 50, category: 'habits' },
  { id: 'food-logger', name: 'Mindful Eater', description: 'Log your meals on 5 days.', icon: '🥗', xp: 50, category: 'habits' },
  { id: 'first-battle', name: 'Into the Arena', description: 'Start your first fitness battle.', icon: '⚔️', xp: 50, category: 'battles' },
  { id: 'battle-winner', name: 'Battle Winner', description: 'Win (or tie) a fitness battle.', icon: '🥇', xp: 100, category: 'battles' },
  { id: 'listen-to-body', name: 'Listen to Your Body', description: 'Report how you feel after a workout. Self-awareness is a strength.', icon: '❤️', xp: 25, category: 'recovery' },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export const DAILY_MISSIONS: Record<'training' | 'rest', Mission[]> = {
  training: [
    { id: 'd-warmup', scope: 'daily', title: 'Warm up properly', description: 'Complete every warm-up item in today’s workout.', xp: 10, target: 1 },
    { id: 'd-workout', scope: 'daily', title: 'Complete today’s session', description: 'Finish today’s planned workout.', xp: 15, target: 1 },
    { id: 'd-hydration', scope: 'daily', title: 'Hydrate', description: 'Reach your daily drinks target.', xp: 10, target: 1 },
  ],
  rest: [
    { id: 'd-rest-mobility', scope: 'daily', title: 'Optional: move gently', description: 'A short mobility session (optional — rest is fine too).', xp: 10, target: 1 },
    { id: 'd-sleep', scope: 'daily', title: 'Log your sleep', description: 'Record last night’s sleep in Progress.', xp: 5, target: 1 },
    { id: 'd-food', scope: 'daily', title: 'Log your meals', description: 'Log at least 2 meals today.', xp: 10, target: 2 },
  ],
};

export const WEEKLY_MISSIONS: Mission[] = [
  { id: 'w-sessions', scope: 'weekly', title: 'Keep your plan', description: 'Keep 3 planned sessions this week (or all of them if fewer are scheduled).', xp: 50, target: 3 },
  { id: 'w-food', scope: 'weekly', title: 'Fuel well', description: 'Log meals on 4 days this week.', xp: 30, target: 4 },
  { id: 'w-hydration', scope: 'weekly', title: 'Hydration habit', description: 'Reach your drinks target on 4 days.', xp: 30, target: 4 },
];

/** Approved weekly battle challenges — verified automatically from your logs. */
export const WEEKLY_CHALLENGES: WeeklyChallenge[] = [
  { id: 'c-warmups', title: 'Warm-Up Week', description: 'Complete the full warm-up in 3 workouts.', check: 'warmups-3' },
  { id: 'c-mobility', title: 'Mobility Boost', description: 'Complete 2 mobility or recovery sessions.', check: 'mobility-2' },
  { id: 'c-allplanned', title: 'Plan Keeper', description: 'Keep every planned session this battle week.', check: 'all-planned' },
  { id: 'c-hydration', title: 'Hydration Hero', description: 'Reach your drinks target on 4 days.', check: 'hydration-4' },
  { id: 'c-food', title: 'Fuel Tracker', description: 'Log meals on 4 days.', check: 'food-log-4' },
  { id: 'c-technique', title: 'Technique Focus', description: 'Complete a session rating every main set (honest feedback).', check: 'technique-1' },
];
