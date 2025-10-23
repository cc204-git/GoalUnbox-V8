import { getISODateString } from '../utils/timeUtils.js';

const getPlanKey = (email) => {
    const today = getISODateString(new Date());
    return `goalUnboxPlan_${email || 'guest'}_${today}`;
};

export const saveTodaysPlan = (email, plan) => {
    try {
        localStorage.setItem(getPlanKey(email), JSON.stringify(plan));
    } catch (e) {
        console.error("Failed to save today's plan:", e);
    }
};

export const loadTodaysPlan = (email) => {
    try {
        const planKey = getPlanKey(email);
        const planJSON = localStorage.getItem(planKey);
        
        if (planJSON) {
            const plan = JSON.parse(planJSON);
            const today = getISODateString(new Date());
            if (plan.date === today) {
                return plan;
            }
        }
        return null;
    } catch (e) {
        console.error("Failed to load today's plan:", e);
        return null;
    }
};

// --- New Functions for scheduling ahead ---
export const savePlan = (email, plan) => {
    try {
        const key = `goalUnboxPlan_${email || 'guest'}_${plan.date}`;
        localStorage.setItem(key, JSON.stringify(plan));
    } catch (e) {
        console.error(`Failed to save plan for ${plan.date}:`, e);
    }
};

export const loadPlan = (email, date) => {
    try {
        const dateString = getISODateString(date);
        const planKey = `goalUnboxPlan_${email || 'guest'}_${dateString}`;
        const planJSON = localStorage.getItem(planKey);
        return planJSON ? JSON.parse(planJSON) : null;
    } catch (e) {
        console.error(`Failed to load plan for date ${date.toISOString()}:`, e);
        return null;
    }
};
