import { VercelRequest, VercelResponse } from '@vercel/node';

// Increase body size limit for base64 images
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb'
        }
    }
};

// Map ASCII unit codes back to Hebrew (avoids quote chars like ק"ג breaking JSON)
const UNIT_MAP: Record<string, string> = {
    'unit': "יח'",
    'kg': 'קג',
    'gram': 'גרם',
    'liter': 'ליטר',
    'ml': 'מל',
    'case': 'ארגז',
    'pack': 'מארז',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let { imageBase64, mimeType } = req.body;

    // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    if (imageBase64 && imageBase64.includes(',')) {
        imageBase64 = imageBase64.split(',')[1];
    }

    if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64' });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // gemini-2.5-flash-lite: confirmed multimodal (Vision/image) support
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        const prompt = `You are reading an Israeli supplier invoice image.
Extract EVERY product line from the TABLE. Israeli invoices have columns like:
  [Product Name] | [Qty] | [Unit Price] | [Total]
or (RTL): [Total] | [Unit Price] | [Qty] | [Product Name]

RULES:
1. quantity = the number in the QUANTITY column. Can be a decimal like 24.60 (weight in kg).
2. unit = one of these ASCII codes ONLY (no Hebrew, no quotes): unit, kg, gram, liter, ml, case, pack
3. Verify: quantity x pricePerUnit is approximately equal to totalPrice. If not, re-read.
4. Hint: if quantity > 5 and looks decimal, unit is probably "kg". Small integers -> "unit".
5. name = full product name exactly as written.

Return ONLY a valid JSON array. No markdown, no explanation, no Hebrew in the JSON keys or unit values:
[{"name":"Vodka Smirnoff 1L","quantity":2,"unit":"unit","pricePerUnit":89.90,"totalPrice":179.80}]
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
        // Strip markdown code blocks
        responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        console.log('Vision items raw response (300 chars):', responseText.substring(0, 300));

        let items: any[] = [];
        try {
            const parsed = JSON.parse(responseText);
            items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.lineItems || []);
        } catch (parseErr) {
            console.warn('JSON.parse failed, trying regex repair:', parseErr);
            const match = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (match) {
                try { items = JSON.parse(match[0]); } catch (_) { }
            }
        }

        // Map ASCII unit codes → Hebrew for the frontend
        items = items.map(item => ({
            ...item,
            unit: UNIT_MAP[item.unit?.toLowerCase()] ?? item.unit,
        }));

        console.log(`Vision endpoint extracted ${items.length} line items`);

        return res.status(200).json({ success: true, items });

    } catch (err) {
        console.error('Vision line-item extraction error:', err);
        return res.status(500).json({
            error: 'Vision extraction failed: ' + (err as Error).message,
            items: []
        });
    }
}
