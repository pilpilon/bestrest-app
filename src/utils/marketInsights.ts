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

export function generateMarketInsights(expenses: any[]): MarketInsight[] {
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
        // Only care about items that cost more than 10 shekels (to make the insights visually impressive)
        if (item.price > 10) {
            if (!currentHighest || item.price > currentHighest.price) {
                highestPrices.set(item.name, { price: item.price, unit: item.unit });
            }
        }
    });

    // Convert map back to array and sort by price descending
    const sortedExpenses = Array.from(highestPrices.entries())
        .map(([itemName, data]) => ({ itemName, ...data }))
        .sort((a, b) => b.price - a.price);

    // Take top 3
    const topExpenesives = sortedExpenses.slice(0, 3);

    // 3. Generate Mock Insights
    // We simulate that the market average is consistently better for these expensive items.
    return topExpenesives.map((item, index) => {
        // Generate a pseudo-random savings percentage between 12% and 18% based on the index
        const savingsPct = 12 + (index * 2.5);
        const marketPrice = item.price * (1 - (savingsPct / 100));

        return {
            itemName: item.itemName,
            userPrice: item.price,
            marketPrice: parseFloat(marketPrice.toFixed(2)),
            savingsPct: parseFloat(savingsPct.toFixed(1)),
            unit: item.unit
        };
    });
}
