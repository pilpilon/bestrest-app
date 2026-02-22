import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
// Since this is a serverless function, we need admin privileges to rewrite `subscriptionTier`

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 1. In a truly secure implementation, you'd use @paddle/paddle-node-sdk
        // to verify the signature (req.headers['paddle-signature']) 
        // using your Webhook Secret Key.
        // For example:
        // const signature = req.headers['paddle-signature'] as string;
        // const secret = process.env.PADDLE_WEBHOOK_SECRET;

        // 2. Parse payload
        const payload = req.body;

        // Let's assume the event is transaction.completed or subscription.updated
        if (payload.event_type === 'transaction.completed' || payload.event_type === 'subscription.created') {
            const data = payload.data;
            const customData = data.custom_data;

            if (customData && customData.userId) {
                const userId = customData.userId;
                console.log(`[Paddle Webhook] Upgrading user ${userId} to PRO...`);

                // 3. Update Firestore via Firebase Admin SDK
                // NOTE: Requires firebase-admin to be set up securely
                if (!admin.apps.length) {
                    admin.initializeApp({
                        credential: admin.credential.cert({
                            projectId: process.env.FIREBASE_PROJECT_ID,
                            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                            // Replace escaped newlines from env var
                            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
                        })
                    });
                }
                const db = admin.firestore();
                await db.collection('users').doc(userId).update({
                    subscriptionTier: 'pro'
                });

                console.log(`[Paddle Webhook] Successfully upgraded ${userId}`);
            }
        }

        // Always return 200 so Paddle knows we received it
        return res.status(200).json({ received: true });

    } catch (error: any) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Webhook handler failed' });
    }
}
