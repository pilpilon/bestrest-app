import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
    let credential;
    // Always prioritize the explicit Firebase setup variable. 
    // If not found, fall back to the generic Google Application one 
    // (though the latter might point to the wrong GCP project).
    const credString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

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
