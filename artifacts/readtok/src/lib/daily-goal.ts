export const DAILY_QUESTION_GOAL = 20;

export function formatLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyGoalProgress(
  attemptedToday: number,
  goal = DAILY_QUESTION_GOAL,
) {
  const safeGoal = Math.max(1, goal);
  const safeAttempted = Math.max(0, Math.trunc(attemptedToday));
  const cappedAttempted = Math.min(safeAttempted, safeGoal);

  return {
    attemptedToday: safeAttempted,
    goal: safeGoal,
    remaining: Math.max(0, safeGoal - safeAttempted),
    progressPercent: Math.round((cappedAttempted / safeGoal) * 100),
    isComplete: safeAttempted >= safeGoal,
  };
}
