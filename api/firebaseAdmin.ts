import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
        } catch (e) {
            console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON", e);
        }
    }

    admin.initializeApp({
        credential: credential || admin.credential.applicationDefault()
    });
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
