import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInAnonymously,
    signOut as firebaseSignOut,
    setPersistence,
    browserLocalPersistence,
    inMemoryPersistence
} from "firebase/auth";
import { auth } from './firebaseService';

export const signUp = async (email: string, password: string): Promise<void> => {
    await createUserWithEmailAndPassword(auth, email, password);
};

export const signIn = async (email: string, password: string, rememberMe: boolean): Promise<void> => {
    const persistence = rememberMe ? browserLocalPersistence : inMemoryPersistence;
    await setPersistence(auth, persistence);
    await signInWithEmailAndPassword(auth, email, password);
};

export const signInGuest = async (): Promise<void> => {
    await setPersistence(auth, browserLocalPersistence); // Persist guests so they don't lose data on refresh
    await signInAnonymously(auth);
};

export const signOut = async (): Promise<void> => {
    await firebaseSignOut(auth);
};
