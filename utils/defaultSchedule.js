export const defaultSchedule = {
    1: [ // Monday
        { subject: 'Physique', startTime: '19:15', endTime: '23:00' },
    ],
    2: [ // Tuesday
        { subject: 'Analyse', startTime: '19:15', endTime: '23:00' },
    ],
    3: [ // Wednesday
        { subject: 'Algebre', startTime: '19:30', endTime: '21:30' },
        { subject: 'Chimie', startTime: '21:45', endTime: '23:00' },
    ],
    4: [ // Thursday
        { subject: 'Physique', startTime: '21:30', endTime: '23:00' } 
    ],
    5: [ // Friday
        { subject: 'CM', startTime: '14:00', endTime: '16:00' },
        { subject: 'FM', startTime: '16:00', endTime: '17:00' },
        { subject: 'MSI', startTime: '17:20', endTime: '19:20' },
        { subject: 'Analyse', startTime: '19:45', endTime: '22:45' },
    ],
    6: [ // Saturday
        { subject: 'Physique', startTime: '14:00', endTime: '17:00' },
        { subject: 'Inf', startTime: '17:20', endTime: '19:20' },
        { subject: 'Algebre', startTime: '19:45', endTime: '22:45' },
    ],
    0: [ // Sunday
        { subject: 'Physique', startTime: '08:00', endTime: '10:00' },
        { subject: 'Algebre', startTime: '10:20', endTime: '12:20' },
        { subject: 'Analyse', startTime: '14:00', endTime: '17:00' },
        { subject: 'CM', startTime: '17:20', endTime: '19:20' },
        { subject: 'Aut', startTime: '19:40', endTime: '21:40' },
        { subject: 'FM', startTime: '22:00', endTime: '23:00' },
    ]
};

const calculateTimeLimit = (startTime, endTime) => {
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

export const getDefaultGoalsForDay = (dayOfWeek) => {
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
