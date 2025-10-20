
import { ActiveGoalState } from '../types';

const getActiveStateKey = (email: string | null): string => {
    return `goalUnboxActiveState_${email || 'guest'}`;
};

export const saveActiveGoal = (email: string | null, state: ActiveGoalState): void => {
    try {
        localStorage.setItem(getActiveStateKey(email), JSON.stringify(state));
    } catch (e) {
        console.error("Failed to save active goal state:", e);
    }
};

export const loadActiveGoal = (email: string | null): ActiveGoalState | null => {
    try {
        const stateJSON = localStorage.getItem(getActiveStateKey(email));
        return stateJSON ? JSON.parse(stateJSON) : null;
    } catch (e) {
        console.error("Failed to load active goal state:", e);
        return null;
    }
};

export const clearActiveGoal = (email: string | null): void => {
    localStorage.removeItem(getActiveStateKey(email));
};
