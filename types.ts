
export enum AppState {
  AUTH,
  TODAYS_PLAN,
  AWAITING_CODE,
  GOAL_SET,
  VERIFYING_PROOF,
  GOAL_COMPLETED,
  EMERGENCY_TEST,
  HISTORY_VIEW,
  AWAITING_BREAK,
  BREAK_ACTIVE,
  BREAK_FAILED,
}

export interface CompletedGoal {
  id: number;
  firestoreId?: string; // For Firestore document ID
  goalSummary: string;
  fullGoal: string;
  subject: string;
  startTime: number;
  endTime: number;
  duration: number;
  completionReason: 'verified' | 'emergency';
}

export interface ActiveGoalState {
    secretCode: string;
    secretCodeImage: string;
    goal: string;
    subject: string;
    goalSetTime: number;
    timeLimitInMs: number | null;
    consequence: string | null;
}

export interface StreakData {
    currentStreak: number;
    lastCompletionDate: string; // YYYY-MM-DD
    commitment: { date: string; text: string; completed: boolean; } | null;
}

export interface PlannedGoal {
  id: string;
  goal: string;
  subject: string;
  timeLimitInMs: number | null;
  consequence: string | null;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  completed: boolean;
}

export interface TodaysPlan {
    date: string; // "YYYY-MM-DD"
    goals: PlannedGoal[];
}