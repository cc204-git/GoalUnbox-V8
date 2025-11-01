export const AppState = {
  TODAYS_PLAN: 1,
  AWAITING_CODE: 2,
  GOAL_SET: 3,
  VERIFYING_PROOF: 4,
  GOAL_COMPLETED: 5,
  HISTORY_VIEW: 6,
  AWAITING_BREAK: 7,
  BREAK_ACTIVE: 8,
  WEEKLY_PLAN_VIEW: 9,
};
Object.freeze(AppState);

// No explicit TodoItem or TodaysPlan interface in JS,
// but the structure will be:
// TodaysPlan: { date: string, goals: PlannedGoal[], todos?: TodoItem[] }
// TodoItem: { id: string, text: string, completed: boolean }
