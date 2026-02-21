import { VercelRequest, VercelResponse } from '@vercel/node';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Parse credentials and config from env
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
// Location where the processor was created (set DOCUMENT_AI_LOCATION env var if different from 'eu')
const processorLocation = process.env.DOCUMENT_AI_LOCATION || 'eu';

const docClient = new DocumentProcessorServiceClient({
    credentials: credentialsJson ? JSON.parse(credentialsJson) : undefined,
});

// Helper: use Gemini to parse all fields from rawText
async function parseWithGemini(rawText: string): Promise<{
    supplier: string; total: number; date: string; category: string;
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
  "category": "string"
}

Text:
${rawText.substring(0, 3000)}
`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    return {
        supplier: parsed.supplier || "לא זוהה",
        total: Number(parsed.total) || 0,
        date: parsed.date || new Date().toLocaleDateString('he-IL'),
        category: parsed.category || "כללי"
    };
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
        return res.status(200).json({ success: true, data: { supplier: "לא זוהה", total: 0, date: new Date().toLocaleDateString('he-IL'), category: "כללי", rawText: "" } });
    }

    // --- Step 2: Use Gemini to parse fields if Document AI didn't return them ---
    try {
        // If structured fields are complete, only ask Gemini for category
        const hasStructured =
            structuredFields.supplier && structuredFields.total && structuredFields.date;

        let parsed: { supplier: string; total: number; date: string; category: string };

        if (hasStructured) {
            console.log("Document AI entities OK, asking Gemini for category only");
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!).getGenerativeModel({
                model: "gemini-2.0-flash",
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
                category: catJson.category || "כללי"
            };
        } else {
            // Full parse with Gemini
            console.log("Document AI entities missing, using Gemini full parse");
            parsed = await parseWithGemini(rawText);
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
