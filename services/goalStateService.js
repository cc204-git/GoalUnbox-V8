
const getActiveStateKey = (email) => {
    return `goalUnboxActiveState_${email || 'guest'}`;
};

export const saveActiveGoal = (email, state) => {
    try {
        localStorage.setItem(getActiveStateKey(email), JSON.stringify(state));
    } catch (e) {
        console.error("Failed to save active goal state:", e);
    }
};

export const loadActiveGoal = (email) => {
    try {
        const stateJSON = localStorage.getItem(getActiveStateKey(email));
        return stateJSON ? JSON.parse(stateJSON) : null;
    } catch (e) {
        console.error("Failed to load active goal state:", e);
        return null;
    }
};

export const clearActiveGoal = (email) => {
    localStorage.removeItem(getActiveStateKey(email));
};
