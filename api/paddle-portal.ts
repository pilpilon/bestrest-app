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
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({ error: 'Subscription ID is required' });
        }

        // Paddle Billing provides `management_urls` directly on the Subscription object.
        const subscription = await paddle.subscriptions.get(subscriptionId);

        if (subscription && subscription.managementUrls) {
            return res.status(200).json({
                url: subscription.managementUrls.updatePaymentMethod || subscription.managementUrls.cancel
            });
        }

        return res.status(400).json({ error: 'Could not generate management URL from the provided subscription ID.' });

    } catch (error: any) {
        console.error('Paddle Portal error:', error);
        return res.status(500).json({ error: 'Failed to generate portal URL' });
    }
}
