import { db } from './firebaseService';
import {
    doc,
    collection,
    getDoc,
    setDoc,
    deleteDoc,
    getDocs,
    Timestamp,
    addDoc,
    onSnapshot,
    Unsubscribe,
    query,
    orderBy
} from 'firebase/firestore';
import { ActiveGoalState, CompletedGoal, StreakData, TodaysPlan, PlannedGoal } from '../types';
import { getISODateString, getStartOfWeekISOString } from '../utils/timeUtils';
import { defaultWeeklyPlan } from '../utils/defaultSchedule';

// Helper to get document references
const getRefs = (userId: string) => {
    const userDocRef = doc(db, 'users', userId);
    return {
        userDocRef,
        activeGoalRef: doc(userDocRef, 'data', 'activeGoal'),
        streakDataRef: doc(userDocRef, 'data', 'streakData'),
        historyCollectionRef: collection(userDocRef, 'history'),
        plansCollectionRef: collection(userDocRef, 'plans'),
    };
};

// Active Goal
export const saveActiveGoal = (userId: string, state: ActiveGoalState) => {
    const { activeGoalRef } = getRefs(userId);
    return setDoc(activeGoalRef, state);
};

export const clearActiveGoal = (userId: string) => {
    const { activeGoalRef } = getRefs(userId);
    return deleteDoc(activeGoalRef);
};

export const listenToActiveGoal = (userId: string, callback: (state: ActiveGoalState | null) => void): Unsubscribe => {
    const { activeGoalRef } = getRefs(userId);
    return onSnapshot(activeGoalRef, (docSnap) => {
        callback(docSnap.exists() ? docSnap.data() as ActiveGoalState : null);
    });
};


// Plans
export const savePlan = (userId: string, plan: TodaysPlan) => {
    const { plansCollectionRef } = getRefs(userId);
    const planDocRef = doc(plansCollectionRef, plan.date);
    return setDoc(planDocRef, plan);
};

export const listenToPlan = (userId: string, date: Date, callback: (plan: TodaysPlan | null) => void): Unsubscribe => {
    const dateString = getISODateString(date);
    const { plansCollectionRef } = getRefs(userId);
    const planDocRef = doc(plansCollectionRef, dateString);
    return onSnapshot(planDocRef, (docSnap) => {
        callback(docSnap.exists() ? docSnap.data() as TodaysPlan : null);
    });
};

export const loadPlan = async (userId: string, date: Date): Promise<TodaysPlan | null> => {
    const dateString = getISODateString(date);
    const { plansCollectionRef } = getRefs(userId);
    const planDocRef = doc(plansCollectionRef, dateString);
    const docSnap = await getDoc(planDocRef);
    return docSnap.exists() ? docSnap.data() as TodaysPlan : null;
};

export const loadWeeklyPlans = async (userId: string, weekStartDate: Date): Promise<TodaysPlan[]> => {
    const plans: TodaysPlan[] = [];
    const promises: Promise<TodaysPlan | null>[] = [];

    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStartDate);
        date.setDate(weekStartDate.getDate() + i);
        promises.push(loadPlan(userId, date));
    }

    const results = await Promise.all(promises);
    const plansToSave: TodaysPlan[] = [];

    results.forEach((plan, i) => {
        const date = new Date(weekStartDate);
        date.setDate(weekStartDate.getDate() + i);
        const dateString = getISODateString(date);

        if (plan) {
            plans.push(plan);
        } else {
            // Create a default plan if one doesn't exist for a day in the week
            const dayIndex = (date.getDay() + 6) % 7; // Monday = 0
            const defaultDayPlanData = defaultWeeklyPlan[dayIndex];
            
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            const formattedDate = `${day}/${month}/${year}`;

            const newPlan: TodaysPlan = {
                date: dateString,
                goals: defaultDayPlanData.goals.map(goal => ({
                    ...goal,
                    goal: goal.subject.toLowerCase().includes('crm') ? goal.goal.replace(/DD\/MM\/YY/g, formattedDate) : goal.goal,
                    // FIX: Changed goal.startTime to goal.subject as startTime does not exist on this object type.
                    id: `${dateString}-${goal.subject}-${Math.random()}`,
                    status: 'pending',
                })),
                todos: [],
            };
            plans.push(newPlan);
            plansToSave.push(newPlan); // Mark for saving
        }
    });

    // Save the newly created default plans to Firestore so they persist
    if (plansToSave.length > 0) {
        await Promise.all(plansToSave.map(p => savePlan(userId, p)));
    }

    return plans;
};

// Streak Data
export const saveStreakData = (userId: string, data: StreakData) => {
    const { streakDataRef } = getRefs(userId);
    return setDoc(streakDataRef, data);
};

export const getStreakData = async (userId: string): Promise<StreakData | null> => {
    const { streakDataRef } = getRefs(userId);
    const docSnap = await getDoc(streakDataRef);
    return docSnap.exists() ? docSnap.data() as StreakData : null;
};

// History
export const addHistoryItem = (userId: string, item: Omit<CompletedGoal, 'firestoreId'>) => {
    const { historyCollectionRef } = getRefs(userId);
    const itemWithTimestamp = {
        ...item,
        startTime: Timestamp.fromMillis(item.startTime),
        endTime: Timestamp.fromMillis(item.endTime),
    };
    return addDoc(historyCollectionRef, itemWithTimestamp);
};

export const deleteHistoryItem = (userId: string, firestoreDocId: string) => {
    const { historyCollectionRef } = getRefs(userId);
    const itemDocRef = doc(historyCollectionRef, firestoreDocId);
    return deleteDoc(itemDocRef);
};

export const listenToHistory = (userId: string, callback: (history: CompletedGoal[]) => void): Unsubscribe => {
    const { historyCollectionRef } = getRefs(userId);
    const q = query(historyCollectionRef, orderBy('endTime', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
        const historyList: CompletedGoal[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const item: CompletedGoal = {
                id: data.id,
                goalSummary: data.goalSummary,
                fullGoal: data.fullGoal,
                subject: data.subject,
                duration: data.duration,
                completionReason: data.completionReason,
                firestoreId: doc.id,
                startTime: (data.startTime as Timestamp).toMillis(),
                endTime: (data.endTime as Timestamp).toMillis(),
            };
            historyList.push(item);
        });
        callback(historyList);
    });
};
