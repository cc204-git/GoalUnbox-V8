import { PlannedGoal } from '../types';

type DefaultGoal = { subject: string, startTime: string, endTime: string };

export const defaultSchedule: Record<number, DefaultGoal[]> = {};

const calculateTimeLimit = (startTime: string, endTime: string): number | null => {
    try {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        
        const startDate = new Date();
        startDate.setHours(startH, startM, 0, 0);

        const endDate = new Date();
        endDate.setHours(endH, endM, 0, 0);

        if (endDate < startDate) {
            endDate.setDate(endDate.getDate() + 1);
        }

        const diffMs = endDate.getTime() - startDate.getTime();
        return diffMs > 0 ? diffMs : null;
    } catch (e) {
        console.error("Error calculating time limit:", e);
        return null;
    }
}

export const getDefaultGoalsForDay = (dayOfWeek: number): PlannedGoal[] => {
    const daySchedule = defaultSchedule[dayOfWeek] || [];
    return daySchedule.map((item, index) => ({
        id: `${Date.now()}-${dayOfWeek}-${index}`,
        goal: '', // Empty description for user to fill
        subject: item.subject,
        timeLimitInMs: calculateTimeLimit(item.startTime, item.endTime),
        consequence: '', // Empty consequence for user to fill
        startTime: item.startTime,
        endTime: item.endTime,
        status: 'pending'
    }));
};