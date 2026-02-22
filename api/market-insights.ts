import { VercelRequest, VercelResponse } from '@vercel/node';

// Function to safely parse JSON from Gemini's response, handling markdown fences and potentially malformed quotes.
function safeParseJson(raw: string): any {
    let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
        return JSON.parse(text);
    } catch {
        const fixed = text.replace(/(?<=[\u0590-\u05FF\w])"(?=[\u0590-\u05FF\w])/g, "''");
        return JSON.parse(fixed);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { items } = req.body; // Expecting array of { name, price, unit }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Missing or invalid items array' });
        }

        // Dynamically import to ensure it works correctly in serverless environment
        const { GoogleGenerativeAI } = await import('@google/generative-ai');

        if (!process.env.GEMINI_API_KEY) {
            console.error("Missing GEMINI_API_KEY");
            return res.status(500).json({ success: false, error: 'Server configuration error' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                // Ensure Gemini returns a JSON object according to the prompt
                responseMimeType: "application/json",
            }
        });

        const prompt = `
You are an expert economic consultant for the restaurant and hospitality industry in Israel. 
You possess deep knowledge of current wholesale B2B pricing, food costs, and supplier rates in NIS (Shekels).

The user is providing you with a JSON array of ingredients they recently purchased, including the name they used, the price they paid per unit, and the unit type.
Your task is to analyze each item and provide a realistic, objective "Market Average" wholesale price for it in Israel today, taking into account the unit specified.

Input JSON:
${JSON.stringify(items, null, 2)}

Instructions:
1. For each item in the input array, give your best estimate for the "marketPrice" (number) in NIS based on standard Israeli restaurant supplier rates.
2. If the user's price is extremely high or unusual, ignore it and provide the true market average. If the item is too vague, give a generalized average for that category.
3. Return ONLY a JSON array of objects. 
4. Each object MUST have the following structure exactly:
{
  "itemName": "string (the exact name from the input)",
  "marketPrice": number (your estimated market average in NIS)
}
No other text, no markdown formatting outside the JSON array. Return exactly an array of objects.
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        console.log("Raw Gemini Response for Market Insights:", text);
        const parsedData = safeParseJson(text);

        if (!Array.isArray(parsedData)) {
            throw new Error("Gemini did not return an array as requested.");
        }

        // Merge the market prices back with the user's original data
        const insights = items.map((inputItem: any) => {
            const geminiEst = parsedData.find((g: any) => g.itemName === inputItem.name);
            const marketPrice = geminiEst && typeof geminiEst.marketPrice === 'number'
                ? parseFloat(geminiEst.marketPrice.toFixed(2))
                : inputItem.price; // Fallback to user price if Gemini fails to provide one

            // Calculate savings percentage
            let savingsPct = 0;
            if (inputItem.price > marketPrice && marketPrice > 0) {
                savingsPct = ((inputItem.price - marketPrice) / inputItem.price) * 100;
            } else if (marketPrice > inputItem.price) {
                // If the user's price is *better* than the market average, the savings potential is 0 regarding "buying at market".
                // They are already beating the market.
                savingsPct = 0;
            }

            return {
                itemName: inputItem.name,
                userPrice: inputItem.price,
                marketPrice: marketPrice,
                savingsPct: parseFloat(savingsPct.toFixed(1)),
                unit: inputItem.unit || 'יח\''
            };
        });

        res.status(200).json({ success: true, insights });
    } catch (error: any) {
        console.error('Market Insights Endpoint Error:', error);
        res.status(500).json({ success: false, error: error?.message || 'Internal server error processing insights' });
    }
}
