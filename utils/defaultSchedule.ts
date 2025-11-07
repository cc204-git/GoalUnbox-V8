import { PlannedGoal } from '../types';

export const defaultWeeklyPlan: { goals: Omit<PlannedGoal, 'id' | 'status'>[] }[] = [
    // Monday (weekday 0)
    {
        goals: []
    },
    // Tuesday (weekday 1)
    {
        goals: []
    },
    // Wednesday (weekday 2)
    {
        goals: []
    },
    // Thursday (weekday 3)
    {
        goals: []
    },
    // Friday (weekday 4)
    {
        goals: []
    },
    // Saturday (weekday 5)
    {
        goals: []
    },
    // Sunday (weekday 6)
    {
        goals: []
    },
];
