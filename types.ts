
export enum AppState {
  AUTH,
  AWAITING_CODE,
  AWAITING_GOAL,
  GOAL_SET,
  VERIFYING_PROOF,
  GOAL_COMPLETED,
  EMERGENCY_TEST,
  HISTORY_VIEW,
}

export interface CompletedGoal {
  id: number;
  goalSummary: string;
  fullGoal: string;
  subject: string;
  startTime: number;
  endTime: number;
  duration: number;
  completionReason: 'verified' | 'must-leave' | 'emergency';
}

export interface ActiveGoalState {
    secretCode: string;
    secretCodeImage: string;
    goal: string;
    subject: string;
    goalSetTime: number;
    timeLimitInMs: number | null;
    consequence: string | null;
    mustLeaveTime: number | null;
}