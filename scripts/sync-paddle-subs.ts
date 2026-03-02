import * as admin from 'firebase-admin';
import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });


const paddleApiKey = process.env.PADDLE_API_KEY;

if (!paddleApiKey) {
    console.error("Missing PADDLE_API_KEY in .env");
    process.exit(1);
}

const paddle = new Paddle(paddleApiKey, {
    environment: Environment.production
});

async function main() {
    try {
        console.log("Initializing Firebase Admin...");

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.log("Using GOOGLE_APPLICATION_CREDENTIALS for Firebase admin.");
            admin.initializeApp({
                credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
            });
        } else {
            console.log("Using Environment Variables for Firebase admin.");
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
                })
            });
        }

        const db = admin.firestore();
        console.log("Fetching PRO users...");

        const usersSnapshot = await db.collection('users').where('subscriptionTier', '==', 'pro').get();

        if (usersSnapshot.empty) {
            console.log("No PRO users found.");
            process.exit(0);
        }

        console.log(`Found ${usersSnapshot.size} PRO users. Syncing with Paddle...`);

        let updatedCount = 0;

        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const email = userData.email;

            if (!email) {
                console.log(`Skipping user ${doc.id} (No email found)`);
                continue;
            }

            if (userData.paddleSubscriptionId) {
                console.log(`Skipping user ${email} (Already has paddleSubscriptionId)`);
                continue;
            }

            console.log(`Checking Paddle for customer: ${email} ...`);

            // 1. Find Customer by email
            const customerCollection = await paddle.customers.list({ email: [email] });
            const customers: any[] = [];
            for await (const customer of customerCollection) {
                customers.push(customer);
            }

            if (customers.length === 0) {
                console.log(`⚠️ No Paddle customer found for ${email}`);
                continue;
            }

            const customer = customers[0];

            // 2. Find Active Subscriptions for this customer
            const subCollection = await paddle.subscriptions.list({
                customerId: [customer.id],
                status: ['active', 'trialing', 'past_due']
            });

            const subscriptions: any[] = [];
            for await (const sub of subCollection) {
                subscriptions.push(sub);
            }

            if (subscriptions.length === 0) {
                console.log(`⚠️ No active subscriptions found for ${email}`);
                continue;
            }

            // Take the most recent active subscription
            const subscription = subscriptions[0];

            // 3. Update Firestore
            await db.collection('users').doc(doc.id).update({
                paddleCustomerId: customer.id,
                paddleSubscriptionId: subscription.id
            });

            console.log(`✅ Successfully synced ${email}: Customer ${customer.id}, Sub ${subscription.id}`);
            updatedCount++;
        }

        console.log(`\n🎉 Sync complete! Updated ${updatedCount} users.`);
        process.exit(0);

    } catch (error) {
        console.error("Error during sync:", error);
        process.exit(1);
    }
}

main();
