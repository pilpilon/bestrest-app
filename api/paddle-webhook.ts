import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const payload = req.body;

        // Ensure firebase admin is initialized
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
                })
            });
        }
        const db = admin.firestore();

        const eventType = payload.event_type;
        const data = payload.data;

        if (eventType === 'transaction.completed' || eventType === 'subscription.created' || eventType === 'subscription.updated') {
            const customData = data.custom_data;
            const customerId = data.customer_id;
            const subscriptionId = data.subscription_id || data.id; // Depending on event type

            if (customData && customData.userId) {
                const userId = customData.userId;
                console.log(`[Paddle Webhook] Upgrading user ${userId} to PRO...`);

                const updateData: any = {
                    subscriptionTier: 'pro'
                };

                if (customerId) updateData.paddleCustomerId = customerId;
                if (subscriptionId) updateData.paddleSubscriptionId = subscriptionId;

                await db.collection('users').doc(userId).update(updateData);
                console.log(`[Paddle Webhook] Successfully upgraded ${userId}`);
            }
        }
        else if (eventType === 'subscription.canceled' || eventType === 'subscription.past_due') {
            const customerId = data.customer_id;
            const subscriptionId = data.id || data.subscription_id;

            console.log(`[Paddle Webhook] Subscription canceled/past_due for customer ${customerId}`);

            if (customerId) {
                // Find all users with this customer ID (should theoretically be just one)
                const usersRef = await db.collection('users').where('paddleCustomerId', '==', customerId).get();

                const batch = db.batch();
                usersRef.docs.forEach(doc => {
                    batch.update(doc.ref, { subscriptionTier: 'free' });
                });

                await batch.commit();
                console.log(`[Paddle Webhook] Successfully downgraded users with customer ID ${customerId}`);
            }
        }

        return res.status(200).json({ received: true });

    } catch (error: any) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Webhook handler failed' });
    }
}
