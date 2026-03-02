import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Environment, Paddle } from '@paddle/paddle-node-sdk';

const paddle = new Paddle(process.env.PADDLE_API_KEY || '', {
    // If you are using sandbox, change this to Environment.sandbox
    environment: Environment.production
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { customerId } = req.body;

        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required' });
        }

        // Generate the customer portal transaction URL
        // In Paddle v2, the Customer Portal allows users to manage their subscription.
        const customData = await paddle.customers.get(customerId);

        // Ensure customer exists
        if (!customData) {
            return res.status(404).json({ error: 'Customer not found in Paddle' });
        }

        // To generate a proper portal link, we typically redirect to the Paddle Customer Portal
        // For Paddle Billing (v2), we can get a portal session or link if supported.
        // Wait, paddle-node-sdk might not have a direct "generate portal link" if it's handled via the transactions or subscriptions API.
        // Actually, in Paddle Billing, you often use the API or dashboard to get a portal link, or you can retrieve a subscription and get its management_urls.

        // Let's assume the user has a subscription ID, which is better for getting the management URL.
        const { subscriptionId } = req.body;

        if (subscriptionId) {
            const subscription = await paddle.subscriptions.get(subscriptionId);
            if (subscription && subscription.managementUrls) {
                return res.status(200).json({
                    url: subscription.managementUrls.updatePaymentMethod || subscription.managementUrls.cancel
                });
            }
        }

        // Fallback or if there's no direct URL easily available via customerID alone
        // Paddle Billing provides `management_urls` on the Subscription object.
        return res.status(400).json({ error: 'Could not generate management URL. Ensure subscriptionId is provided.' });

    } catch (error: any) {
        console.error('Paddle Portal error:', error);
        return res.status(500).json({ error: 'Failed to generate portal URL' });
    }
}
