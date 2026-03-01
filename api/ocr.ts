import { VercelRequest, VercelResponse } from '@vercel/node';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { VertexAI } from '@google-cloud/vertexai';
import { adminAuth } from './firebaseAdmin';
import { z } from 'zod';

export const maxDuration = 60;

const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const credentials = credentialsJson ? JSON.parse(credentialsJson) : {};
const vertex_ai = new VertexAI({ project: credentials.project_id || process.env.VITE_FIREBASE_PROJECT_ID, location: 'us-central1' });

const HeaderSchema = z.object({
    supplier: z.string(),
    total: z.number(),
    date: z.string(),
    category: z.string(),
    math_reasoning: z.string().optional()
});

const LineItemSchema = z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
    pricePerUnit: z.number(),
    totalPrice: z.number(),
    math_reasoning: z.string().optional()
});
const LineItemsArraySchema = z.array(LineItemSchema);
// Location where the processor was created (set DOCUMENT_AI_LOCATION env var, e.g. 'eu' or 'us')
const processorLocation = process.env.DOCUMENT_AI_LOCATION || 'eu';

// Using the default (US) endpoint for an EU processor causes INVALID_ARGUMENT errors.
const docClient = new DocumentProcessorServiceClient({
    credentials: credentialsJson ? JSON.parse(credentialsJson) : undefined,
    apiEndpoint: processorLocation === 'us'
        ? 'documentai.googleapis.com'
        : `${processorLocation}-documentai.googleapis.com`,
});


/**
 * Safely parse JSON from a Gemini response.
 * Handles: (1) markdown code fences, (2) unescaped " inside Hebrew strings (e.g. בע"מ).
 */
function safeParseJson(raw: string): any {
    // Strip markdown code fences Gemini sometimes adds
    let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
        return JSON.parse(text);
    } catch {
        // Fix unescaped quotes inside string values — common in Hebrew company names like בע"מ
        // Strategy: replace any " that is NOT preceded by \ and is inside a string value
        // Simple heuristic: replace ' that appear mid-word in Hebrew context
        const fixed = text.replace(/(?<=[\u0590-\u05FF\w])"(?=[\u0590-\u05FF\w])/g, "''");
        return JSON.parse(fixed);
    }
}

// Helper: use Gemini to parse header fields (supplier, total, date, category) from rawText
async function parseHeadersWithGemini(rawText: string): Promise<{
    supplier: string; total: number; date: string; category: string;
}> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
You are an expert at parsing Israeli invoices and receipts (חשבוניות).
Extract ONLY the header fields from the text below. Be very precise with numbers and dates.

Instructions:
- "supplier": The business/company name issuing the invoice (e.g., "הסורטיה יצחקי דוד בע\"מ", "תנובה").
- "total": The final total amount to pay as a NUMBER (look for "סה\"כ לתשלום", "סה\"כ כולל מע\"מ", "סה\"כ"). Must be a number, no currency symbols.
- "date": The invoice/receipt date formatted as dd/mm/yyyy. Look for "תאריך" or similar. NOT a future due date.
- "category": Pick the best ONE based on the supplier name and content:
  חומרי גלם (food ingredients, produce, meat, dairy - e.g. תנובה, יטבתה, מחלבות, בשר, ירקות)
  שתייה (beverages - e.g. קוקה קולה, נביעות, טרה)
  אלכוהול (wine, beer, spirits)
  ציוד (kitchen equipment, utensils)
  תחזוקה (repairs, cleaning services, pest control)
  שכירות (rent, lease)
  עובדים (salary, manpower agencies)
  חשמל / מים / גז (utilities - e.g. חברת החשמל, תעש, גז, מקורות)
  כללי (anything else)

Respond ONLY with valid JSON, no markdown:
{"supplier": "string", "total": 1234.56, "date": "dd/mm/yyyy", "category": "string"}

Text:
${rawText.substring(0, 3000)}
`;

    const result = await model.generateContent(prompt);
    const parsed = safeParseJson(result.response.text());
    return {
        supplier: parsed.supplier || "לא זוהה",
        total: Number(parsed.total) || 0,
        date: parsed.date || new Date().toLocaleDateString('he-IL'),
        category: parsed.category || "כללי",
    };
}

// Hebrew unit mapping for normalizing Vision output
const UNIT_NORMALIZE: Record<string, string> = {
    'unit': "יח'",
    'units': "יח'",
    'kg': 'ק"ג',
    'gram': 'גרם',
    'grams': 'גרם',
    'liter': 'ליטר',
    'liters': 'ליטר',
    'ml': 'מ"ל',
    'case': 'ארגז',
    'pack': 'מארז',
    'box': 'ארגז',
    // Already-Hebrew units pass through
    "יח'": "יח'",
    'ק"ג': 'ק"ג',
    'גרם': 'גרם',
    'ליטר': 'ליטר',
    'מ"ל': 'מ"ל',
    'ארגז': 'ארגז',
    'מארז': 'מארז',
    'קילו': 'ק"ג',
    'קג': 'ק"ג',
};

/**
 * Post-processing: detect and fix cases where Vision swapped qty and pricePerUnit.
 *
 * Problem: qty*price = total = price*qty (commutative), so Vision can't always tell which
 * column is qty and which is price. Example:
 *   Real:    qty=150, price=2.50, total=375
 *   Vision:  qty=2.5, price=150, total=375   <- swapped
 *
 * Heuristic: if qty is a small fractional number (<10, non-integer) AND
 * pricePerUnit is a large round integer (>=10, integer), they are likely swapped.
 */
function fixSwappedQtyPrice(items: any[]): any[] {
    return items.map(item => {
        const qty = Number(item.quantity);
        const price = Number(item.pricePerUnit);
        const total = Number(item.totalPrice);

        // Only attempt swap when math holds either way
        if (total <= 0 || Math.abs(qty * price - total) / total > 0.02) return item;

        // Swap heuristic: qty looks like a price (small decimal) and price looks like a qty (large integer)
        const qtyLooksLikePrice = !Number.isInteger(qty) && qty < 10;
        const priceLooksLikeQty = Number.isInteger(price) && price >= 10;

        if (qtyLooksLikePrice && priceLooksLikeQty) {
            console.log(`  SwapFix "${item.name}": qty ${qty}<->${price}, price ${price}<->${qty}`);
            return { ...item, quantity: price, pricePerUnit: qty };
        }

        return item;
    });
}

/**
 * Extract line items directly from the invoice IMAGE using Gemini 2.5 Flash Vision.
 * This is much more accurate than text-based parsing because the model can see
 * the actual table structure and read Hebrew RTL columns correctly.
 */
async function extractLineItemsFromImage(imageBase64: string, imageMimeType: string, rawTextHint?: string): Promise<any[]> {
    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-pro", // Pro for max accuracy on Hebrew invoice image tables
            generationConfig: { responseMimeType: "application/json" }
        });

        // Provide raw text as a hint to help Vision disambiguate blurry areas
        const textHint = rawTextHint
            ? `\n\nOCR text hint (use ONLY if image is unclear):\n${rawTextHint.substring(0, 1500)}`
            : '';

        const prompt = `You are an expert at reading Israeli supplier invoices (חשבוניות ספקים).
Carefully examine this invoice IMAGE and extract EVERY product line item from the table.

Israeli invoices are RTL (right-to-left). The table columns are typically ordered RIGHT to LEFT as:
  # (row number) | שם פריט (product name) | כמות (quantity) | מחיר ליחידה / ש"ח ליחידה (unit price) | סה"כ / סכום (line total)

Some invoices may also have columns like:
  מס' פריט | פריט | כמות | יחידה | ש"מ ליחידה | סה"כ ש"כ

EXTRACTION RULES:
1. "name": The FULL product name in Hebrew exactly as written on the invoice.
   Include size/weight descriptors that are part of the name (e.g. "צ'יפס אמריקאי (10 קילו)", "המבורגר פרימיום 200").

2. "quantity": The value from the QUANTITY COLUMN (כמות).
   - This is how many units were ordered/delivered.
   - CAN BE a decimal (e.g., 24.60 for kg of meat).
   - Do NOT confuse with the product's weight/size in the name.

3. "unit": One of: unit, kg, gram, liter, ml, case, pack
   - If quantity is a large decimal (>5), likely "kg"
   - If quantity is a small integer (1-5), likely "unit"
   - Use context from the invoice (e.g. "יח'", "ק"ג") to determine

4. "pricePerUnit": The price PER SINGLE UNIT from the unit-price column BEFORE multiplication.

5. "totalPrice": The LINE TOTAL from the total column AFTER multiplication.

6. VERIFICATION: For each item, check that quantity × pricePerUnit ≈ totalPrice (within 5%).
   If it doesn't match, re-read the numbers from the image.

Return ONLY a valid JSON array, no markdown, no explanation:
[{"name": "צ'יפס אמריקאי (10 קילו)", "quantity": 2, "unit": "unit", "pricePerUnit": 125.00, "totalPrice": 250.00}]
Include a "math_reasoning" field per item showing quantity * pricePerUnit = totalPrice.
If no line items found, return [].${textHint}`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: imageMimeType } }
        ]);

        let responseText = result.response.text().trim();
        // Strip markdown code blocks Gemini sometimes adds
        responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        console.log("Vision line-items response (300 chars):", responseText.substring(0, 300));

        const parsed = safeParseJson(responseText);
        let items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.lineItems || []);

        // Normalize units from English to Hebrew
        items = items.map((item: any) => ({
            ...item,
            unit: UNIT_NORMALIZE[item.unit?.toLowerCase()] ?? item.unit ?? "יח'",
        }));

        console.log(`Vision extracted ${items.length} line items from image`);
        return items;
    } catch (err) {
        console.error("Vision extraction failed, falling back to text:", err);
        if (rawTextHint) return extractLineItemsFromText(rawTextHint);
        return [];
    }
}

// Text-based fallback — less accurate but used when image-based extraction fails
async function extractLineItemsFromText(rawText: string): Promise<any[]> {
    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(
            `Extract line items from this Israeli invoice text. Return ONLY JSON array (no markdown):
[{"name":"Product","quantity":2,"unit":"unit","pricePerUnit":50,"totalPrice":100}]
IMPORTANT: quantity = units ordered (from the quantity column), NOT product weight in name.
Units: unit, kg, gram, liter, ml, case, pack
Verify: quantity × pricePerUnit ≈ totalPrice.
If none found return [].
Text:\n${rawText.substring(0, 3000)}`
        );
        const rawTextObj = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let text = rawTextObj.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        const parsed = safeParseJson(text);
        let items = Array.isArray(parsed) ? parsed : [];
        // Normalize units
        items = items.map((item: any) => ({
            ...item,
            unit: UNIT_NORMALIZE[item.unit?.toLowerCase()] ?? item.unit ?? "יח'",
        }));
        return items;
    } catch (err) {
        console.error("Text fallback extraction also failed:", err);
        return [];
    }
}

/**
 * Deterministic math cross-validation (Section 4.1 of architecture spec)
 * Returns 'VALID', 'LINE_ITEM_ERROR', or 'TOTAL_MISMATCH'
 */
function validateExtraction(lineItems: any[], extractedTotal: number): {
    status: 'VALID' | 'LINE_ITEM_ERROR' | 'TOTAL_MISMATCH';
    computedSubtotal: number;
    failedItems: number[];
} {
    let computedSubtotal = 0;
    const failedItems: number[] = [];

    // Gate 1: qty × price = line total for each row
    lineItems.forEach((item, i) => {
        const expected = Number(item.quantity) * Number(item.pricePerUnit);
        const actual = Number(item.totalPrice);
        if (actual > 0 && Math.abs(expected - actual) / actual > 0.05) {
            failedItems.push(i);
        }
        computedSubtotal += actual;
    });

    if (failedItems.length > 0) return { status: 'LINE_ITEM_ERROR', computedSubtotal, failedItems };

    // Gate 2: sum of lines ≈ invoice total (within 10% — tax/discounts may differ)
    if (extractedTotal > 0 && Math.abs(computedSubtotal - extractedTotal) / extractedTotal > 0.10) {
        return { status: 'TOTAL_MISMATCH', computedSubtotal, failedItems: [] };
    }

    return { status: 'VALID', computedSubtotal, failedItems: [] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }
    try {
        const token = authHeader.split('Bearer ')[1];
        await adminAuth.verifyIdToken(token);
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
    }

    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64' });
    }

    // --- Step 1: Get high-quality OCR text via Document AI ---
    let rawText = "";
    let structuredFields: { supplier?: string; total?: number; date?: string } = {};

    // Parse credentials and config from env
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
    // Location where the processor was created (set DOCUMENT_AI_LOCATION env var, e.g. 'eu' or 'us')
    const processorLocation = process.env.DOCUMENT_AI_LOCATION || 'eu';

    if (credentialsJson && processorId) {
        try {
            const credentials = JSON.parse(credentialsJson);
            const projectId = credentials.project_id;

            // IMPORTANT: For non-US processors, we MUST use the regional API endpoint.
            const name = `projects/${projectId}/locations/${processorLocation}/processors/${processorId}`;

            const [result] = await docClient.processDocument({
                name,
                rawDocument: {
                    content: imageBase64,
                    mimeType: mimeType || 'image/jpeg',
                },
            });

            rawText = result.document?.text || "";

            // Try to extract structured entities if Document AI returned them
            const entities = result.document?.entities || [];
            console.log(`Document AI returned ${entities.length} entities and ${rawText.length} chars of text`);

            if (entities.length > 0) {
                const getVal = (type: string) => {
                    const e = entities.find(e => e.type === type);
                    return e?.normalizedValue?.text || e?.mentionText || null;
                };
                const totalEntity = entities.find(e => e.type === 'total_amount');
                let total = 0;
                if (totalEntity) {
                    const mv = totalEntity.normalizedValue?.moneyValue;
                    if (mv) {
                        total = Number(mv.units || 0) + (Number(mv.nanos || 0) / 1e9);
                    } else {
                        total = parseFloat((totalEntity.normalizedValue?.text || "0").replace(/[^\d.]/g, ''));
                    }
                }
                structuredFields = {
                    supplier: getVal('supplier_name') || undefined,
                    total: total || undefined,
                    date: getVal('invoice_date') || undefined,
                };
            }
        } catch (err) {
            console.error("Document AI error:", err);
        }
    }

    // If Document AI got no text at all, fall back to Vision (only for images, not PDFs)
    const isPdfMimeType = (mimeType || '').toLowerCase() === 'application/pdf';
    if (!rawText && credentialsJson && !isPdfMimeType) {
        try {
            const vision = await import('@google-cloud/vision');
            const visionClient = new vision.default.ImageAnnotatorClient({
                credentials: JSON.parse(credentialsJson),
            });
            const [visionResult] = await visionClient.textDetection({ image: { content: imageBase64 } });
            rawText = visionResult.textAnnotations?.[0]?.description || "";
            console.log("Fell back to Vision API for OCR text");
        } catch (err) {
            console.error("Vision fallback error:", err);
        }
    }

    if (!rawText) {
        return res.status(200).json({ success: true, data: { supplier: "לא זוהה", total: 0, date: new Date().toLocaleDateString('he-IL'), category: "כללי", lineItems: [], rawText: "" } });
    }

    // --- Step 2: Parse header fields + extract line items ---
    try {
        // If structured fields are complete, only ask Gemini for category
        const hasStructured =
            structuredFields.supplier && structuredFields.total && structuredFields.date;

        let parsed: { supplier: string; total: number; date: string; category: string; lineItems: any[] };

        if (hasStructured) {
            console.log("Document AI entities OK, asking Gemini for category only");
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!).getGenerativeModel({
                model: "gemini-2.5-flash-lite", // Lite is sufficient for simple category classification
                generationConfig: { responseMimeType: "application/json" }
            });
            const catResult = await model.generateContent(
                `Supplier: ${structuredFields.supplier}. Receipt snippet: ${rawText.substring(0, 300)}\nRespond ONLY with JSON: {"category":"One of: חומרי גלם, שתייה, אלכוהול, ציוד, תחזוקה, שכירות, חשמל, עובדים, כללי"}`
            );
            const catJson = safeParseJson(catResult.response.text());
            parsed = {
                supplier: structuredFields.supplier!,
                total: structuredFields.total!,
                date: structuredFields.date!,
                category: catJson.category || "כללי",
                lineItems: []
            };
        } else {
            // Full parse with Gemini for header fields
            console.log("Document AI entities missing, using Gemini full parse for headers");
            const headers = await parseHeadersWithGemini(rawText);
            parsed = { ...headers, lineItems: [] };
        }

        // --- Step 3: Extract line items from IMAGE using Vision (primary) ---
        // Utility/non-itemized categories have no real line item table — skip Vision for these
        // and return a single summary item to avoid garbage extraction.
        const NO_ITEMS_CATEGORIES = ['חשמל / מים / גז', 'שכירות', 'עובדים', 'תחזוקה'];
        const isUtilityInvoice = NO_ITEMS_CATEGORIES.some(cat => parsed.category?.includes(cat.split(' ')[0]));

        if (isUtilityInvoice) {
            console.log(`Utility category "${parsed.category}" — skipping Vision, using summary item`);
            parsed.lineItems = [{
                name: parsed.supplier || parsed.category,
                quantity: 1,
                unit: "יח'",
                pricePerUnit: parsed.total,
                totalPrice: parsed.total,
            }];
        } else {
            try {
                if (isPdfMimeType) {
                    // PDFs can't be sent as inlineData to Gemini Vision — use text-based extraction
                    console.log("PDF detected — using text-based line item extraction...");
                    parsed.lineItems = await extractLineItemsFromText(rawText);
                } else {
                    console.log("Extracting line items via Gemini Vision (image-based)...");
                    parsed.lineItems = await extractLineItemsFromImage(imageBase64, mimeType || 'image/jpeg', rawText);
                }
                // Fix swapped qty/price where math is ambiguous (e.g. 2.5x150=375 and 150x2.5=375)
                parsed.lineItems = fixSwappedQtyPrice(parsed.lineItems);
                console.log(`Extracted ${parsed.lineItems.length} line items`);
            } catch (itemsErr) {
                console.error("Line items extraction failed:", itemsErr);
            }
        }

        const validation = validateExtraction(parsed.lineItems, parsed.total);
        console.log(`Validation: ${validation.status}, computed: ${validation.computedSubtotal}, extracted: ${parsed.total}`);

        return res.status(200).json({
            success: true,
            data: {
                ...parsed,
                validation,
                rawText: rawText.substring(0, 1500)
            }
        });

    } catch (err) {
        console.error("Gemini parse error:", err);
        return res.status(500).json({ error: 'Failed to process: ' + (err as Error).message });
    }
}
