import { VercelRequest, VercelResponse } from '@vercel/node';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Parse credentials and config from env
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
// Location where the processor was created (set DOCUMENT_AI_LOCATION env var, e.g. 'eu' or 'us')
const processorLocation = process.env.DOCUMENT_AI_LOCATION || 'eu';

// IMPORTANT: For non-US processors, we MUST use the regional API endpoint.
// Using the default (US) endpoint for an EU processor causes INVALID_ARGUMENT errors.
const docClient = new DocumentProcessorServiceClient({
    credentials: credentialsJson ? JSON.parse(credentialsJson) : undefined,
    apiEndpoint: processorLocation === 'us'
        ? 'documentai.googleapis.com'
        : `${processorLocation}-documentai.googleapis.com`,
});

// Helper: use Gemini to parse all fields from rawText
async function parseWithGemini(rawText: string): Promise<{
    supplier: string; total: number; date: string; category: string;
    lineItems: { name: string; quantity: number; unit: string; pricePerUnit: number; totalPrice: number }[];
}> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
You are an expert at parsing Israeli invoices and receipts.
Extract the following from the text below. Be very precise with numbers and dates.

Instructions:
- "supplier": The business/company name issuing the invoice (e.g., "חברת החשמל לישראל", "תנובה").
- "total": The final total amount to pay as a NUMBER (look for "סה\"כ לתשלום", "סה\"כ כולל מע\"מ"). Must be a number, no currency symbols.
- "date": The invoice/receipt date formatted as dd/mm/yyyy. Look for "תאריך עריכת החשבון" or similar. NOT a future due date.
- "category": Pick the best ONE based on the supplier name and content:
  חומרי גלם (food ingredients, produce, meat, dairy - e.g. תנובה, יטבתה, מחלבות)
  שתייה (beverages - e.g. קוקה קולה, נביעות, טרה)
  אלכוהול (wine, beer, spirits)
  ציוד (kitchen equipment, utensils)
  תחזוקה (repairs, cleaning services, pest control)
  שכירות (rent, lease)
  עובדים (salary, manpower agencies)
  חשמל / מים / גז (utilities - e.g. חברת החשמל, תעש, גז, מקורות)
  כללי (anything else)

Respond ONLY with valid JSON, no markdown:
{
  "supplier": "string",
  "total": 1234.56,
  "date": "dd/mm/yyyy",
  "category": "string",
  "lineItems": [
    { "name": "Item name in Hebrew", "quantity": 1.5, "unit": "kg", "pricePerUnit": 5.90, "totalPrice": 8.85 }
  ]
}

For lineItems: Extract every individual product/ingredient line from the invoice.
CRITICAL RULES for line items:
- name: The full product name in Hebrew (include size/weight if it's part of the name, e.g. "צ'יפס אמריקאי (10 קילו)")
- quantity: ONLY the NUMBER OF UNITS ORDERED (how many items/boxes/bottles were purchased). This is typically shown as "X 2" or "2 יח'" on Israeli invoices. Do NOT confuse this with the product's weight/size. Example: If the line says "צ'יפס 10 ק"ג X 2" — the quantity is 2 (two bags), NOT 10.
- unit: Use ONLY one of these Hebrew values: יח', ק"ג, גרם, ליטר, מ"ל, ארגז, מארז
- pricePerUnit: price for ONE unit (number). This is the price BEFORE multiplication.
- totalPrice: The final line total AFTER multiplication (quantity × pricePerUnit).
If you cannot find line items, return an empty array.

Text:
${rawText.substring(0, 3000)}
`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    return {
        supplier: parsed.supplier || "לא זוהה",
        total: Number(parsed.total) || 0,
        date: parsed.date || new Date().toLocaleDateString('he-IL'),
        category: parsed.category || "כללי",
        lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : []
    };
}

/**
 * Pure-code RTL column parser.
 * Israeli OCR text dumps invoice numbers in RTL order per row: total, pricePerUnit, quantity.
 * We extract standalone numeric lines, find triplets satisfying (qty × price ≈ total),
 * then overwrite whatever Gemini extracted with these verified values.
 * Immune to product-name-number confusion (e.g. "\u05e7\u05e8\u05d8\u05d5\u05e0\u05d9\u05dd 5", "30 \u05d9\u05d7'").
 */
function fixLineItemsFromRawText(items: any[], rawText: string): any[] {
    if (!items.length) return items;

    // Extract standalone numeric lines (handles commas and leading $)
    const nums: number[] = rawText
        .split('\n')
        .map(l => l.trim().replace(/[$,]/g, ''))
        .filter(l => /^\d+\.?\d*$/.test(l))
        .map(l => parseFloat(l));

    // Find triplets [a, b, c] where c \u00d7 b \u2248 a (total, price, qty \u2014 RTL order)
    const triplets: Array<{ total: number; price: number; qty: number }> = [];
    let i = 0;
    while (i < nums.length - 2 && triplets.length < items.length) {
        const [a, b, c] = [nums[i], nums[i + 1], nums[i + 2]];
        if (b > 0 && c > 0) {
            const ratio = Math.abs(b * c - a) / (a || 1);
            if (ratio < 0.02) {
                triplets.push({ total: a, price: b, qty: c });
                i += 3;
                continue;
            }
        }
        i++;
    }

    if (triplets.length !== items.length) {
        console.log(`Column parser: ${triplets.length} triplets for ${items.length} items \u2014 skipping`);
        return items;
    }

    console.log(`Column parser: correcting ${items.length} items with raw-text column values`);
    return items.map((item, idx) => ({
        ...item,
        quantity: triplets[idx].qty,
        pricePerUnit: triplets[idx].price,
        totalPrice: triplets[idx].total,
    }));
}

// Helper: extract line items from the original invoice IMAGE using Vision
async function extractLineItemsFromImage(imageBase64: string, imageMimeType: string, rawTextFallback?: string): Promise<any[]> {
    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `You are reading an Israeli invoice/receipt IMAGE.
Extract every line item (product row) from the table in this invoice.

Look at the COLUMNS in the invoice table carefully:
- Find the product name column
- Find the quantity column (\u05db\u05de\u05d5\u05ea / \u05de\u05e1"\u05e4 / \u05d9\u05d7')
- Find the unit price column (\u05de\u05d7\u05d9\u05e8 / \u05de\u05d7\u05d9\u05e8 \u05dc\u05d9\u05d7\u05d9\u05d3\u05d4 / \u05e9"\u05de \u05dc\u05d9\u05d7\u05d9\u05d3\u05d4)
- Find the total column (\u05e1\u05db\u05d5\u05dd / \u05e1\u05d4"\u05db / \u05e9"\u05db)

CRITICAL: "quantity" = number of units ORDERED (the qty column, e.g. X 2 or 2 \u05d9\u05d7'), NOT the product size/weight in the name.
Units must be one of: \u05d9\u05d7', \u05e7"\u05d2, \u05d2\u05e8\u05dd, \u05dc\u05d9\u05d8\u05e8, \u05de"\u05dc, \u05d0\u05e8\u05d2\u05d6, \u05de\u05d0\u05e8\u05d6

Return ONLY valid JSON array (no markdown, no code blocks):
[{"name": "\u05d5\u05d5\u05d3\u05e7\u05d4 \u05e1\u05de\u05d9\u05e8\u05e0\u05d5\u05e3 \u05dc\u05d9\u05d8\u05e8", "quantity": 2, "unit": "\u05d9\u05d7'", "pricePerUnit": 89.90, "totalPrice": 179.80}]
If no items found, return [].`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: imageMimeType } }
        ]);

        let responseText = result.response.text().trim();
        // Strip markdown code blocks Gemini sometimes adds
        responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        console.log("Vision line-items response (200 chars):", responseText.substring(0, 200));

        const parsed = JSON.parse(responseText);
        const items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.lineItems || []);
        console.log(`Vision extracted ${items.length} line items`);
        return items;
    } catch (err) {
        console.error("Vision extraction failed, falling back to text:", err);
        if (rawTextFallback) return extractLineItemsFromText(rawTextFallback);
        return [];
    }
}

// Text-based fallback — less accurate but more robust
async function extractLineItemsFromText(rawText: string): Promise<any[]> {
    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(
            `Extract line items from this Israeli invoice text. Return ONLY JSON array (no markdown):
[{"name":"Product","quantity":2,"unit":"\u05d9\u05d7'","pricePerUnit":50,"totalPrice":100}]
IMPORTANT: quantity = units ordered (X 2 / 2 \u05d9\u05d7'), NOT product weight in name. Units: \u05d9\u05d7', \u05e7"\u05d2, \u05d2\u05e8\u05dd, \u05dc\u05d9\u05d8\u05e8, \u05de"\u05dc, \u05d0\u05e8\u05d2\u05d6, \u05de\u05d0\u05e8\u05d6
If none found return [].
Text:\n${rawText.substring(0, 3000)}`
        );
        let text = result.response.text().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error("Text fallback extraction also failed:", err);
        return [];
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64' });
    }

    // --- Step 1: Get high-quality OCR text via Document AI ---
    let rawText = "";
    let structuredFields: { supplier?: string; total?: number; date?: string } = {};

    if (credentialsJson && processorId) {
        try {
            const credentials = JSON.parse(credentialsJson);
            const projectId = credentials.project_id;
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

    // If Document AI got no text at all, fall back to Vision
    if (!rawText && credentialsJson) {
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

    // --- Step 2: Use Gemini to parse fields if Document AI didn't return them ---
    try {
        // If structured fields are complete, only ask Gemini for category
        const hasStructured =
            structuredFields.supplier && structuredFields.total && structuredFields.date;

        let parsed: { supplier: string; total: number; date: string; category: string; lineItems: any[] };

        if (hasStructured) {
            console.log("Document AI entities OK, asking Gemini for category only");
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!).getGenerativeModel({
                model: "gemini-2.5-flash-lite",
                generationConfig: { responseMimeType: "application/json" }
            });
            const catResult = await model.generateContent(
                `Supplier: ${structuredFields.supplier}. Receipt snippet: ${rawText.substring(0, 300)}\nRespond ONLY with JSON: {"category":"One of: חומרי גלם, שתייה, אלכוהול, ציוד, תחזוקה, שכירות, חשמל, עובדים, כללי"}`
            );
            const catJson = JSON.parse(catResult.response.text());
            parsed = {
                supplier: structuredFields.supplier!,
                total: structuredFields.total!,
                date: structuredFields.date!,
                category: catJson.category || "כללי",
                lineItems: []
            };

            // Extract line items directly with the same model (text-based, reliable)
            try {
                const ITEMS_PROMPT = `You are extracting line items from an Israeli supplier invoice (חשבונית ספק).

Israeli invoices typically have these columns (right to left):
# | שם פריט/מוצר | כמות יח' | ש"מ ליחידה | סכום
or: פריט | כמות | מחיר ליח' | סה"כ

Column meanings:
- שם פריט / מוצר = Product name
- כמות יח' / כמות = QUANTITY (how many ordered). CAN BE DECIMAL (e.g. 24.60 kg of chicken = quantity 24.60 unit kg)
- ש"מ ליחידה / מחיר ליחידה = PRICE PER UNIT (before multiplication)
- סכום / סה"כ / ש"כ = LINE TOTAL (quantity × price)

IMPORTANT RULES:
1. quantity comes from the QUANTITY COLUMN, not from the product name. It can be a decimal like 24.60.
2. Verify: quantity × pricePerUnit ≈ totalPrice. If not, you picked wrong numbers.
3. unit: guess from context — if quantity is a large decimal like 24.60, unit is likely ק"ג or גרם. If it's a small integer like 2 or 3, likely יח'.
4. Use ONLY these units: יח', ק"ג, גרם, ליטר, מ"ל, ארגז, מארז
5. name: full product name in Hebrew as written on the invoice

Return ONLY a valid JSON array, no markdown:
[{"name":"המבורגר פרימיום 200","quantity":24.60,"unit":"ק\"ג","pricePerUnit":44.00,"totalPrice":1082.40}]
If no items, return [].

Invoice text:
${rawText.substring(0, 3000)}`;
                const itemsResult = await model.generateContent(ITEMS_PROMPT);
                let itemsText = itemsResult.response.text().trim();
                itemsText = itemsText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
                console.log("Items response (200 chars):", itemsText.substring(0, 200));
                const itemsParsed = JSON.parse(itemsText);
                parsed.lineItems = Array.isArray(itemsParsed) ? itemsParsed : [];
                // Correct qty/price/total using raw-text column values (RTL triplet parser)
                parsed.lineItems = fixLineItemsFromRawText(parsed.lineItems, rawText);
                console.log(`Extracted ${parsed.lineItems.length} line items`);
            } catch (itemsErr) {
                console.error("Line items extraction failed:", itemsErr);
            }
        } else {
            // Full parse with Gemini (text-based for header fields)
            console.log("Document AI entities missing, using Gemini full parse");
            parsed = await parseWithGemini(rawText);
            // Override line items using text extraction
            try {
                const { GoogleGenerativeAI: GeminiAI } = await import('@google/generative-ai');
                const itemModel = new GeminiAI(process.env.GEMINI_API_KEY!).getGenerativeModel({
                    model: "gemini-2.5-flash-lite",
                    generationConfig: { responseMimeType: "application/json" }
                });
                const itemsResult = await itemModel.generateContent(
                    `You are extracting line items from an Israeli supplier invoice (חשבונית ספק).

Israeli invoices typically have these columns (right to left):
# | שם פריט/מוצר | כמות יח' | ש"מ ליחידה | סכום
or: פריט | כמות | מחיר ליח' | סה"כ

Column meanings:
- שם פריט / מוצר = Product name
- כמות יח' / כמות = QUANTITY ordered. CAN BE DECIMAL (e.g. 24.60 kg)
- ש"מ ליחידה / מחיר ליחידה = PRICE PER UNIT (before multiplication)
- סכום / סה"כ = LINE TOTAL (quantity × price)

IMPORTANT:
1. quantity from the QUANTITY COLUMN, can be decimal like 24.60
2. Verify: quantity × pricePerUnit ≈ totalPrice
3. If quantity is a large decimal (>5), unit is likely ק"ג or גרם. Small integer → יח'
4. units: יח', ק"ג, גרם, ליטר, מ"ל, ארגז, מארז

Return ONLY valid JSON array, no markdown:
[{"name":"המבורגר פרימיום 200","quantity":24.60,"unit":"ק\"ג","pricePerUnit":44.00,"totalPrice":1082.40}]
If none return [].
Text:\n${rawText.substring(0, 3000)}`
                );
                let itemsText = itemsResult.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
                const itemsParsed = JSON.parse(itemsText);
                parsed.lineItems = Array.isArray(itemsParsed) ? itemsParsed : [];
                // Correct qty/price/total using raw-text column values (RTL triplet parser)
                parsed.lineItems = fixLineItemsFromRawText(parsed.lineItems, rawText);
            } catch (e) { console.error("Items extraction failed:", e); }
        }

        return res.status(200).json({
            success: true,
            data: {
                ...parsed,
                rawText: rawText.substring(0, 1500)
            }
        });

    } catch (err) {
        console.error("Gemini parse error:", err);
        return res.status(500).json({ error: 'Failed to process: ' + (err as Error).message });
    }
}
