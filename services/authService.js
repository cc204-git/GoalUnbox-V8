// IMPORTANT: This is a simulated backend using localStorage.
// The password hashing is NOT secure and for demonstration purposes only.
// Do NOT use this in a production environment.

const USERS_STORAGE_KEY = 'goalUnboxUsers';

const simpleHash = (password) => btoa(password);
const checkPassword = (password, hash) => btoa(password) === hash;

const getUsers = () => {
    try {
        const usersJSON = localStorage.getItem(USERS_STORAGE_KEY);
        return usersJSON ? JSON.parse(usersJSON) : {};
    } catch (e) {
        console.error("Could not parse user store from localStorage", e);
        return {};
    }
};

const saveUsers = (users) => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

export const createUser = (email, password) => {
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

export const loginUser = (email, password) => {
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

export const getUserHistory = (email) => {
    const users = getUsers();
    return users[email]?.history || [];
};

export const saveUserHistory = (email, history) => {
    const users = getUsers();
    if (users[email]) {
        users[email].history = history;
        saveUsers(users);
    }
};

export const getStreakData = (email) => {
    const users = getUsers();
    return users[email]?.streakData || null;
};

export const saveStreakData = (email, data) => {
    const users = getUsers();
    if (users[email]) {
        users[email].streakData = data;
        saveUsers(users);
    }
};
