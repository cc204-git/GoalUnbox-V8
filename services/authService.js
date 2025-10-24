import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInAnonymously,
    signOut as firebaseSignOut,
    setPersistence,
    browserLocalPersistence,
    inMemoryPersistence
} from "firebase/auth";
import { auth } from './firebaseService.js';

export const signUp = async (email, password) => {
    await createUserWithEmailAndPassword(auth, email, password);
};

export const signIn = async (email, password, rememberMe) => {
    const persistence = rememberMe ? browserLocalPersistence : inMemoryPersistence;
    await setPersistence(auth, persistence);
    await signInWithEmailAndPassword(auth, email, password);
};

export const signInGuest = async () => {
    await setPersistence(auth, browserLocalPersistence); // Persist guests so they don't lose data on refresh
    await signInAnonymously(auth);
};

export const signOut = async () => {
    await firebaseSignOut(auth);
};
