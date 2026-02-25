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
        // gemini-2.5-pro: upgraded for maximum accuracy on Hebrew invoice tables
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-pro',
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `You are an expert at reading Israeli supplier invoices (חשבוניות ספקים).
Carefully examine this invoice IMAGE and extract EVERY product line item from the table.

Israeli invoices are RTL (right-to-left). The table columns are typically ordered RIGHT to LEFT as:
  # (row number) | שם פריט (product name) | כמות (quantity) | מחיר ליחידה (unit price) | סה"כ / סכום (line total)

EXTRACTION RULES:
1. "name": The FULL product name in Hebrew exactly as written on the invoice.
   Include size/weight descriptors that are part of the name (e.g. "צ'יפס אמריקאי (10 קילו)").
2. "quantity": The value from the QUANTITY COLUMN (כמות). Can be decimal like 24.60 for kg.
   Do NOT confuse with product weight/size in the name.
3. "unit": One of these ASCII codes ONLY: unit, kg, gram, liter, ml, case, pack
   - If quantity > 5 and decimal, likely "kg". Small integer → "unit".
4. "pricePerUnit": Price PER SINGLE UNIT from the unit-price column BEFORE multiplication.
5. "totalPrice": LINE TOTAL from the total column AFTER multiplication.
6. VERIFY: quantity × pricePerUnit ≈ totalPrice (within 5%). If not, re-read.

Return ONLY a valid JSON array. No markdown, no explanation:
[{"name":"צ'יפס אמריקאי (10 קילו)","quantity":2,"unit":"unit","pricePerUnit":125.00,"totalPrice":250.00}]
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
