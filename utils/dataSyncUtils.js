// A utility to handle exporting and importing app data from localStorage.

const ACTIVE_STATE_PREFIX = 'goalUnboxActiveState_';
const USERS_KEY = 'goalUnboxUsers';

/**
 * Gathers all relevant app data from localStorage into a single object.
 * @returns An object containing all user accounts and active goal states.
 */
const gatherData = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key === USERS_KEY || key.startsWith(ACTIVE_STATE_PREFIX))) {
            const item = localStorage.getItem(key);
            if (item) {
                try {
                    data[key] = JSON.parse(item);
                } catch (e) {
                    console.error(`Could not parse localStorage item: ${key}`, e);
                }
            }
        }
    }
    return data;
};

/**
 * Exports all app data to a Base64 encoded string.
 * @returns A string containing the encoded data, or null if no data exists.
 */
export const exportDataToString = () => {
    const data = gatherData();
    if (Object.keys(data).length === 0) {
        return null;
    }
    const jsonString = JSON.stringify(data);
    // btoa is a browser function to Base64 encode a string
    return btoa(jsonString);
};

/**
 * Imports data from a Base64 encoded string, overwriting existing data.
 * @param dataString The Base64 encoded string from the user.
 * @returns A promise that resolves with a success message or rejects with an error.
 */
export const importDataFromString = (dataString) => {
    return new Promise((resolve, reject) => {
        try {
            // atob is a browser function to decode a Base64 string
            const json = atob(dataString);
            const data = JSON.parse(json);

            // Basic validation to ensure it's a valid backup file
            if (typeof data !== 'object' || data === null || (!data[USERS_KEY] && !Object.keys(data).some(k => k.startsWith(ACTIVE_STATE_PREFIX)))) {
                throw new Error('This does not appear to be a valid Goal Unbox sync code.');
            }

            // Clear existing app data before importing
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key === USERS_KEY || key.startsWith(ACTIVE_STATE_PREFIX))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Import the new data
            Object.keys(data).forEach(key => {
                if (key === USERS_KEY || key.startsWith(ACTIVE_STATE_PREFIX)) {
                    localStorage.setItem(key, JSON.stringify(data[key]));
                }
            });

            resolve('Data imported successfully! The application will now reload to apply the changes.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred.';
            reject(new Error(`Failed to parse or import code. It may be invalid or corrupted. ${message}`));
        }
    });
};