'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Firebase client SDK, used ONLY by the admin console.
 *
 * Public pages never touch Firestore from the browser — they read through
 * cached API routes so Firestore reads stay flat regardless of traffic. This
 * exists purely for authentication: the admin signs in here, and every
 * privileged action is then re-checked server-side against the ID token.
 *
 * The config values below are public by design; they ship in the browser
 * bundle for every Firebase web app. Access is controlled by security rules
 * and by server-side verification, never by hiding these.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cachedApp: FirebaseApp | null = null;

export function firebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  cachedApp = getApps()[0] ?? initializeApp(config);
  return cachedApp;
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}
