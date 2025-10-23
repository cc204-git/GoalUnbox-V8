
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
