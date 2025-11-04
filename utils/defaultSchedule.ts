import { PlannedGoal } from '../types';

// Helper to calculate timeLimitInMs from start and end times
const calculateTimeLimit = (startTime: string, endTime: string): number | null => {
    try {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(startH, startM, 0, 0);
        const endDate = new Date();
        endDate.setHours(endH, endM, 0, 0);

        if (endDate <= startDate) { // Handles overnight goals like 23:00 to 00:00
            endDate.setDate(endDate.getDate() + 1);
        }

        return endDate.getTime() - startDate.getTime();
    } catch {
        return null;
    }
};

const crmTemplate = `I will submit my homework on separate, numbered papers.
Each paper will have the date DD/MM/YY written at the top.
I will also send a screenshot of timer showing the time approximately equal to the time spent on goal (uncertainty 10 mins +- 10 mins)
My homework will include:
Repeat 1 and Repeat 2 that are copies of the pdf attached below.
I will make sure that all exercises Repeat and questions are clearly highlighted on each paper.`;

const createGoal = (subject: string, startTime: string, endTime: string): Omit<PlannedGoal, 'id' | 'status'> => {
    const correctedEndTime = endTime === '24:00' || endTime === '00:00' ? '23:59' : endTime;
    const isCrmGoal = subject.toLowerCase().includes('crm');

    return {
        goal: isCrmGoal ? crmTemplate : '', // Use template for CrM goals, otherwise empty
        subject: subject,
        timeLimitInMs: calculateTimeLimit(startTime, correctedEndTime),
        startTime: startTime,
        endTime: correctedEndTime,
    };
};

export const defaultWeeklyPlan: { goals: Omit<PlannedGoal, 'id' | 'status'>[] }[] = [
    // Monday (weekday 0)
    {
        goals: [
            createGoal('Analyse', '19:30', '22:00'),
            createGoal('CrM Analyse', '22:00', '23:30'),
        ]
    },
    // Tuesday (weekday 1)
    {
        goals: [
            createGoal('Physique', '17:00', '19:15'),
            createGoal('CrM Physique', '19:15', '20:00'),
            createGoal('CM', '20:15', '21:45'),
            createGoal('CrM CM', '21:45', '22:15'),
            createGoal('MSI', '22:30', '23:15'),
            createGoal('CrM MSI', '23:15', '00:00'),
        ]
    },
    // Wednesday (weekday 2)
    {
        goals: [
            createGoal('Algèbre', '19:30', '21:00'),
            createGoal('CrM Algèbre', '21:00', '21:30'),
            createGoal('Chimie', '21:45', '23:00'),
            createGoal('CrM Chimie', '23:00', '00:00'),
        ]
    },
    // Thursday (weekday 3)
    {
        goals: [
            createGoal('Informatique', '21:30', '23:00'),
            createGoal('CrM Informatique', '23:00', '00:00'),
        ]
    },
    // Friday (weekday 4)
    {
        goals: [
            createGoal('Physique', '13:30', '15:45'),
            createGoal('CrM Physique', '15:45', '16:30'),
            createGoal('Algèbre', '16:45', '19:00'),
            createGoal('CrM Algèbre', '19:00', '19:45'),
            createGoal('Chimie', '20:00', '21:15'),
            createGoal('Français', '21:30', '22:30'),
            createGoal('Anglais', '22:45', '23:30'),
            createGoal('CrM', '23:30', '00:00'),
        ]
    },
    // Saturday (weekday 5)
    {
        goals: [
            createGoal('Analyse', '13:30', '15:45'),
            createGoal('CrM Analyse', '15:45', '16:30'),
            createGoal('Physique', '16:45', '19:00'),
            createGoal('CrM Physique', '19:00', '19:45'),
            createGoal('Informatique', '20:00', '21:00'),
            createGoal('CrM Informatique', '21:00', '21:30'),
            createGoal('FM', '21:45', '23:00'),
            createGoal('CrM FM', '23:00', '23:45'),
        ]
    },
    // Sunday (weekday 6)
    {
        goals: [
            createGoal('Physique', '08:30', '10:45'),
            createGoal('CrM Physique', '10:45', '11:30'),
            createGoal('Analyse', '11:45', '13:45'),
            createGoal('CrM Analyse', '13:45', '14:45'),
            createGoal('Algèbre', '15:45', '17:45'),
            createGoal('CrM Algèbre', '17:45', '19:15'),
            createGoal('Auto', '19:30', '20:30'),
            createGoal('CrM Auto', '20:30', '21:00'),
            createGoal('RevG', '21:15', '23:00'),
        ]
    },
];
