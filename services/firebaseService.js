import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration from user
const firebaseConfig = {
  apiKey: "AIzaSyB7DqGY4SwczmYqkUP4jwzdcwVefoK_qpc",
  authDomain: "goalunboxapp.firebaseapp.com",
  projectId: "goalunboxapp",
  storageBucket: "goalunboxapp.firebasestorage.app",
  messagingSenderId: "260357310353",
  appId: "1:260357310353:web:cf02e2ffc433e441917c30",
  measurementId: "G-H7CF14FRTX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable Firestore offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled
        // in one tab at a time.
        console.warn('Firestore persistence failed: multiple tabs open.', err);
    } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence
        console.warn('Firestore persistence not supported in this browser.', err);
    }
});

// Initialize Analytics
try {
  getAnalytics(app);
} catch (e) {
  console.error("Firebase Analytics failed to initialize", e);
}

export { app, auth, db };