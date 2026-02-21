import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64' });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `You are looking at a photo of an Israeli supplier invoice (חשבונית מס / קבלה).
Your job: extract EVERY product line item from the TABLE in this image.

LOOK AT THE TABLE COLUMNS CAREFULLY. Israeli invoices have columns like:
שם פריט | כמות | מחיר ליח' | סכום
or: תאור | כמות יח' | ש"מ ליחידה | סה"כ

HOW TO READ EACH ROW:
1. Find the PRODUCT NAME (שם פריט / תאור פריט) — this is the longest text
2. Find the QUANTITY (כמות) — READ IT FROM THE QUANTITY COLUMN. It can be:
   - An integer like 2, 5, 10 (number of units/bottles/boxes)
   - A decimal like 24.60, 11.00, 3.00 (weight in kg or volume in liters)
   - Often shown as "X 2" or "2 יח'" or just a number in the qty column
3. Find the UNIT PRICE (מחיר ליחידה / ש"מ ליחידה) — price for ONE unit
4. Find the LINE TOTAL (סכום / סה"כ שורה) — the rightmost or leftmost number

VERIFICATION: quantity × pricePerUnit should approximately equal totalPrice.
If your math doesn't work out, re-read the columns more carefully.

For UNIT, infer from context:
- Beverages (bottles, cans) → יח'
- Meat, produce sold by weight → ק"ג
- Bulk items in cases → ארגז or מארז

Return ONLY a valid JSON array:
[{"name": "וודקה סמירנוף ליטר", "quantity": 2, "unit": "יח'", "pricePerUnit": 89.90, "totalPrice": 179.80}]
If no items found, return [].`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: mimeType || 'image/jpeg'
                }
            }
        ]);

        let responseText = result.response.text().trim();
        // Strip markdown code blocks if Gemini adds them
        responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        console.log("Vision items response (200 chars):", responseText.substring(0, 200));

        const parsed = JSON.parse(responseText);
        const items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.lineItems || []);
        console.log(`Vision endpoint extracted ${items.length} line items`);

        return res.status(200).json({
            success: true,
            items
        });

    } catch (err) {
        console.error("Vision line-item extraction error:", err);
        return res.status(500).json({
            error: 'Vision extraction failed: ' + (err as Error).message,
            items: []
        });
    }
}
