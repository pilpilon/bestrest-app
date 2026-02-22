// Paddle Payment Integration Utility

// Paddle Client-side Token from Dashboard > Developer Tools > Authentication
export const PADDLE_CLIENT_TOKEN = "live_3bf3c6931cb5e4af8f0b7300c6a";

// Initialize Paddle (v2)
export const initializePaddle = () => {
    if (typeof window !== 'undefined' && (window as any).Paddle) {
        (window as any).Paddle.Initialize({
            token: PADDLE_CLIENT_TOKEN,
            // environment: 'sandbox' // We are using a live token as per user request
        });
    }
};

export const openPaddleCheckout = (priceId: string, email?: string, uid?: string) => {
    if (!(window as any).Paddle) {
        alert("שגיאה בטעינת מערכת התשלומים. אנא נסה שוב מאוחר יותר או כבה חוסמי פרסומות.");
        return;
    }

    (window as any).Paddle.Checkout.open({
        settings: {
            displayMode: 'overlay',
            theme: 'dark',
            locale: 'he', // BestRest is Hebrew-first
        },
        items: [
            {
                priceId: priceId,
                quantity: 1
            }
        ],
        customer: email ? { email } : undefined,
        customData: {
            // VERY IMPORTANT: Passed to the webhook so we know which user paid
            userId: uid || 'anonymous'
        }
    });
};
