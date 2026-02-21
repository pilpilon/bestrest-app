import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { ingredientText } = req.body;

    if (!ingredientText) {
        return res.status(400).json({ error: 'Missing ingredientText' });
    }

    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
You are a kitchen master and food cost expert in Israel.
Given an ingredient and its quantity, predict its cost in Israeli Shekels (₪) based on average market prices for restaurants.

Ingredient: "${ingredientText}"

Respond ONLY with valid JSON:
{
  "cost": 12.5,
  "matchedItem": "Description of the item matched"
}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        return res.status(200).json({
            success: true,
            data: parsed
        });

    } catch (err) {
        console.error("Gemini cost prediction error:", err);
        return res.status(500).json({ error: 'Failed to predict cost: ' + (err as Error).message });
    }
}
