import { db } from './firebaseService.js';
import {
    doc,
    collection,
    getDoc,
    setDoc,
    deleteDoc,
    Timestamp,
    addDoc,
    onSnapshot,
    query,
    orderBy
} from 'firebase/firestore';
import { getISODateString } from '../utils/timeUtils.js';

// Helper to get document references
const getRefs = (userId) => {
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
export const saveActiveGoal = (userId, state) => {
    const { activeGoalRef } = getRefs(userId);
    return setDoc(activeGoalRef, state);
};

export const clearActiveGoal = (userId) => {
    const { activeGoalRef } = getRefs(userId);
    return deleteDoc(activeGoalRef);
};

export const listenToActiveGoal = (userId, callback) => {
    const { activeGoalRef } = getRefs(userId);
    return onSnapshot(activeGoalRef, (docSnap) => {
        callback(docSnap.exists() ? docSnap.data() : null);
    });
};


// Plans
export const savePlan = (userId, plan) => {
    const { plansCollectionRef } = getRefs(userId);
    const planDocRef = doc(plansCollectionRef, plan.date);
    return setDoc(planDocRef, plan);
};

export const listenToPlan = (userId, date, callback) => {
    const dateString = getISODateString(date);
    const { plansCollectionRef } = getRefs(userId);
    const planDocRef = doc(plansCollectionRef, dateString);
    return onSnapshot(planDocRef, (docSnap) => {
        callback(docSnap.exists() ? docSnap.data() : null);
    });
};

export const loadPlan = async (userId, date) => {
    const dateString = getISODateString(date);
    const { plansCollectionRef } = getRefs(userId);
    const planDocRef = doc(plansCollectionRef, dateString);
    const docSnap = await getDoc(planDocRef);
    return docSnap.exists() ? docSnap.data() : null;
};

// Streak Data
export const saveStreakData = (userId, data) => {
    const { streakDataRef } = getRefs(userId);
    return setDoc(streakDataRef, data);
};

export const getStreakData = async (userId) => {
    const { streakDataRef } = getRefs(userId);
    const docSnap = await getDoc(streakDataRef);
    return docSnap.exists() ? docSnap.data() : null;
};

// History
export const addHistoryItem = (userId, item) => {
    const { historyCollectionRef } = getRefs(userId);
    const itemWithTimestamp = {
        ...item,
        startTime: Timestamp.fromMillis(item.startTime),
        endTime: Timestamp.fromMillis(item.endTime),
    };
    return addDoc(historyCollectionRef, itemWithTimestamp);
};

export const deleteHistoryItem = (userId, firestoreDocId) => {
    const { historyCollectionRef } = getRefs(userId);
    const itemDocRef = doc(historyCollectionRef, firestoreDocId);
    return deleteDoc(itemDocRef);
};

export const listenToHistory = (userId, callback) => {
    const { historyCollectionRef } = getRefs(userId);
    const q = query(historyCollectionRef, orderBy('endTime', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
        const historyList = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const item = {
                ...data,
                firestoreId: doc.id,
                startTime: data.startTime.toMillis(),
                endTime: data.endTime.toMillis(),
            };
            historyList.push(item);
        });
        callback(historyList);
    });
};
