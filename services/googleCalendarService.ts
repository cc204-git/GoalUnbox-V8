import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID } from '../config';
import { GoogleCalendarEvent } from '../types';

// The discovery document for the Google Calendar API
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
// The scope for reading calendar events
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let gapi: any = null;
let google: any = null;
let tokenClient: any = null;
let initPromise: Promise<void> | null = null;

/**
 * Waits for both GAPI and GIS scripts to load and become available on the window object.
 */
const initializeClients = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            if ((window as any).gapi && (window as any).google) {
                clearInterval(interval);
                gapi = (window as any).gapi;
                google = (window as any).google;
                // Once gapi is available, load the 'client' library.
                gapi.load('client', resolve);
            }
        }, 100);

        // Fail after 10 seconds
        setTimeout(() => {
            clearInterval(interval);
            reject(new Error('Google API clients failed to load in time.'));
        }, 10000);
    });
};

/**
 * Initializes the GAPI client and the token client for OAuth2.
 * This function is idempotent and can be called multiple times.
 * @param updateSigninStatus A callback function to update the sign-in status in the app state.
 */
export const initGapiClient = async (updateSigninStatus: (isSignedIn: boolean) => void): Promise<void> => {
    // Check if the credentials in the config file are still the placeholder values.
    if (GOOGLE_API_KEY === "YOUR_GOOGLE_API_KEY" || GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") {
        // Reject with a specific, user-friendly error message.
        return Promise.reject(new Error("Google Calendar not configured. Please follow the instructions in config.ts to add your API Key and Client ID."));
    }

    // If initialization is already in progress or completed, return the existing promise.
    if (initPromise) {
        return initPromise;
    }

    initPromise = initializeClients().then(async () => {
        await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse: any) => {
                const hasToken = tokenResponse && tokenResponse.access_token;
                updateSigninStatus(!!hasToken);
            },
        });
    }).catch(err => {
        // Reset promise on failure to allow retries.
        initPromise = null;
        // Re-throw the error to be handled by the caller.
        throw err;
    });

    return initPromise;
};


/**
 * Initiates the Google Sign-In flow.
 */
export const signIn = async () => {
    if (!initPromise) {
        throw new Error("Google Calendar service is not initialized. Please refresh the page.");
    }
    // Await the initialization promise to ensure clients are ready.
    await initPromise;
    
    if (!tokenClient) {
        // This case should ideally not be reached if initPromise resolves successfully.
        throw new Error("Google Token Client failed to initialize. Please try again.");
    }
    // Prompt the user to select a Google Account and ask for consent to share their data
    tokenClient.requestAccessToken({prompt: 'consent'});
};

/**
 * Signs the user out of the application.
 */
export const signOut = () => {
    if (gapi && gapi.client.getToken()) {
        gapi.client.setToken(null);
        // Additional cleanup if needed
    }
};

/**
 * Lists the user's events for today from their primary calendar.
 * @returns A promise that resolves with an array of calendar events.
 */
export const listTodaysEvents = async (): Promise<GoogleCalendarEvent[]> => {
    if (!initPromise) {
        throw new Error("Google Calendar service is not initialized. Please refresh the page.");
    }
    // Await the initialization promise to ensure clients are ready.
    await initPromise;

    if (!gapi || !gapi.client.getToken()) {
        throw new Error("User not signed in or GAPI not initialized.");
    }
    try {
        const now = new Date();
        const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
        const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': timeMin,
            'timeMax': timeMax,
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 20,
            'orderBy': 'startTime'
        });

        return response.result.items as GoogleCalendarEvent[];
    } catch (err) {
        console.error('Execute error', err);
        throw new Error('Failed to fetch calendar events.');
    }
};