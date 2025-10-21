import { CompletedGoal, StreakData } from '../types';

// IMPORTANT: This is a simulated backend using localStorage.
// The password hashing is NOT secure and for demonstration purposes only.
// Do NOT use this in a production environment.

interface User {
    passwordHash: string;
    history: CompletedGoal[];
    streakData?: StreakData;
}

interface UserStore {
    [email: string]: User;
}

const USERS_STORAGE_KEY = 'goalUnboxUsers';

const simpleHash = (password: string): string => btoa(password);
const checkPassword = (password: string, hash: string): boolean => btoa(password) === hash;

const getUsers = (): UserStore => {
    try {
        const usersJSON = localStorage.getItem(USERS_STORAGE_KEY);
        return usersJSON ? JSON.parse(usersJSON) : {};
    } catch (e) {
        console.error("Could not parse user store from localStorage", e);
        return {};
    }
};

const saveUsers = (users: UserStore): void => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

export const createUser = (email: string, password: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => { // Simulate network delay
            const users = getUsers();
            if (users[email]) {
                return reject(new Error("An account with this email already exists."));
            }
            users[email] = {
                passwordHash: simpleHash(password),
                history: [],
                streakData: {
                    currentStreak: 0,
                    lastCompletionDate: '',
                    commitment: null,
                }
            };
            saveUsers(users);
            resolve();
        }, 500);
    });
};

export const loginUser = (email: string, password: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => { // Simulate network delay
            const users = getUsers();
            const user = users[email];
            if (!user) {
                return reject(new Error("No account found with this email."));
            }
            if (!checkPassword(password, user.passwordHash)) {
                return reject(new Error("Incorrect password."));
            }
            resolve();
        }, 500);
    });
};

export const getUserHistory = (email: string): CompletedGoal[] => {
    const users = getUsers();
    return users[email]?.history || [];
};

export const saveUserHistory = (email: string, history: CompletedGoal[]): void => {
    const users = getUsers();
    if (users[email]) {
        users[email].history = history;
        saveUsers(users);
    }
};

export const getStreakData = (email: string): StreakData | null => {
    const users = getUsers();
    return users[email]?.streakData || null;
};

export const saveStreakData = (email: string, data: StreakData): void => {
    const users = getUsers();
    if (users[email]) {
        users[email].streakData = data;
        saveUsers(users);
    }
};
