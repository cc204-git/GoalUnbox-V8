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


// --- New Functions for scheduling ahead ---
export const savePlan = (email: string | null, plan: TodaysPlan): void => {
    try {
        const key = `goalUnboxPlan_${email || 'guest'}_${plan.date}`;
        localStorage.setItem(key, JSON.stringify(plan));
    } catch (e) {
        console.error(`Failed to save plan for ${plan.date}:`, e);
    }
};

export const loadPlan = (email: string | null, date: Date): TodaysPlan | null => {
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
