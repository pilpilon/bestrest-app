import { VercelRequest, VercelResponse } from '@vercel/node';
import vision from '@google-cloud/vision';

const client = new vision.ImageAnnotatorClient({
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
        ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        : undefined,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { imageUrl } = req.body;

    if (!imageUrl) {
        return res.status(400).json({ error: 'Missing imageUrl' });
    }

    try {
        const [result] = await client.textDetection(imageUrl);
        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            return res.status(200).json({ success: true, data: { items: [], rawText: "" } });
        }

        const rawText = detections[0].description || "";
        let itemsData: any[] = [];

        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.5-flash",
                    generationConfig: { responseMimeType: "application/json" }
                });

                const prompt = `
Extract the individual line items (purchased goods/ingredients) from this Israeli restaurant receipt text. 
Respond ONLY with a valid JSON array of objects matching exactly this schema:
[
  {
    "name": "The name of the item (e.g., 'עגבניות חממה', 'פחית קולה')",
    "quantity": 1.5, // Total quantity purchased (number)
    "unit": "kg", // The unit of measurement (e.g., 'kg', 'unit', 'liter', 'box', 'gram')
    "price_per_unit": 5.90, // The price for ONE unit (number)
    "total_price": 8.85 // The total price for this line item (number)
  }
]

If you cannot confidently extract an item's details, skip it. If no items are found, return an empty array [].
Receipt text:
${rawText}
`;
                const geminiResult = await model.generateContent(prompt);
                const responseText = geminiResult.response.text();
                itemsData = JSON.parse(responseText);

                // Safety check to ensure it's an array
                if (!Array.isArray(itemsData)) {
                    if (itemsData && (itemsData as any).items && Array.isArray((itemsData as any).items)) {
                        itemsData = (itemsData as any).items;
                    } else {
                        itemsData = [];
                    }
                }

            } catch (geminiError) {
                console.error('Gemini Line Items Parsing Error:', geminiError);
                return res.status(500).json({ error: 'AI failed to parse items', rawText });
            }
        } else {
            return res.status(400).json({ error: 'GEMINI_API_KEY is missing' });
        }

        return res.status(200).json({
            success: true,
            data: {
                items: itemsData,
                rawText
            }
        });

    } catch (error) {
        console.error('Vision API Error:', error);
        return res.status(500).json({ error: 'Failed to process image' });
    }
}
