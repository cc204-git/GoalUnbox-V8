
import { TodaysPlan } from '../types';
import { getISODateString } from '../utils/timeUtils';

const getPlanKey = (email: string | null): string => {
    const today = getISODateString(new Date());
    return `goalUnboxPlan_${email || 'guest'}_${today}`;
};

export const saveTodaysPlan = (email: string | null, plan: TodaysPlan): void => {
    try {
        localStorage.setItem(getPlanKey(email), JSON.stringify(plan));
    } catch (e) {
        console.error("Failed to save today's plan:", e);
    }
};

export const loadTodaysPlan = (email: string | null): TodaysPlan | null => {
    try {
        const planKey = getPlanKey(email);
        const planJSON = localStorage.getItem(planKey);
        
        if (planJSON) {
            const plan: TodaysPlan = JSON.parse(planJSON);
            const today = getISODateString(new Date());
            // Double check the date just in case the user's clock changed
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
