import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
    let credential;
    // Try to load from either env variable used in the project
    const credString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (credString) {
        try {
            credential = cert(JSON.parse(credString));
        } catch (e) {
            console.error("Failed to parse Firebase Admin credentials", e);
        }
    }

    initializeApp({
        credential: credential || applicationDefault()
    });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
