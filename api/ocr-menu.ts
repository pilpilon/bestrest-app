import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64' });
    }

    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash", // Using a faster model for menu extraction
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
You are an expert at extracting menus from photos.
Extract a list of dishes and their prices from the provided image.
Be precise with the names in Hebrew and the prices in numbers (ILS).

Respond ONLY with valid JSON:
{
  "dishes": [
    { "name": "Dish Name", "price": 89.0 },
    ...
  ]
}
`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: mimeType || 'image/jpeg'
                }
            }
        ]);

        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        return res.status(200).json({
            success: true,
            data: parsed
        });

    } catch (err) {
        console.error("Gemini menu parse error:", err);
        return res.status(500).json({ error: 'Failed to process menu: ' + (err as Error).message });
    }
}
