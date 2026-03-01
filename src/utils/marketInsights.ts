// Mock Market Insights Algorithm
// In a real production app, this would query a global database of prices.
// For the MVP, it analyzes the user's specific expenses, finds the 3 most expensive ingredients,
// and generates a simulated "Market Average" that is securely ~12-18% cheaper.

export interface MarketInsight {
    itemName: string;
    userPrice: number;
    marketPrice: number;
    savingsPct: number;
    unit: string;
}

export async function generateMarketInsights(expenses: any[]): Promise<MarketInsight[]> {
    // 1. Flatten all line items from all invoices
    const allItems: any[] = [];
    expenses.forEach(exp => {
        if (exp.lineItems && Array.isArray(exp.lineItems)) {
            exp.lineItems.forEach((item: any) => {
                if (item.name && item.pricePerUnit && !isNaN(parseFloat(item.pricePerUnit))) {
                    allItems.push({
                        name: item.name.trim(),
                        price: parseFloat(item.pricePerUnit),
                        unit: item.unit || 'יח\'',
                    });
                }
            });
        }
    });

    if (allItems.length < 3) {
        return []; // Not enough data to generate insights
    }

    // 2. Group by item name to find the *highest* price the user paid for each item types
    const highestPrices = new Map<string, { price: number, unit: string }>();

    allItems.forEach(item => {
        const currentHighest = highestPrices.get(item.name);
        // Only care about items that cost more than 10 shekels
        if (item.price > 10) {
            if (!currentHighest || item.price > currentHighest.price) {
                highestPrices.set(item.name, { price: item.price, unit: item.unit });
            }
        }
    });

    // Convert map back to array and sort by price descending
    const sortedExpenses = Array.from(highestPrices.entries())
        .map(([itemName, data]) => ({ name: itemName, ...data }))
        .sort((a, b) => b.price - a.price);

    // 3. Take top 10 most expensive items to send to the AI
    const topTen = sortedExpenses.slice(0, 10);

    // 4. Call the Market Insights API
    try {
        const { auth } = await import('../firebase');
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/market-insights', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ items: topTen })
        });

        if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.insights)) {
            // 5. Select the 3 items with highest savings percentage
            const sortedInsights = data.insights.sort((a: MarketInsight, b: MarketInsight) => b.savingsPct - a.savingsPct);

            // Return only those that actually have savings
            return sortedInsights.filter((i: MarketInsight) => i.savingsPct > 0).slice(0, 3);
        }

        return [];
    } catch (error) {
        console.error("Failed to fetch market insights from API:", error);
        return [];
    }
}
