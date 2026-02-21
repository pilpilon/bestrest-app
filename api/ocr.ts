import { VercelRequest, VercelResponse } from '@vercel/node';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Initialize the Document AI client
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

const client = new DocumentProcessorServiceClient({
    credentials: credentialsJson ? JSON.parse(credentialsJson) : undefined,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { imageUrl, imageBase64, mimeType } = req.body;

    if (!imageUrl && !imageBase64) {
        return res.status(400).json({ error: 'Missing imageUrl or imageBase64' });
    }

    // Try Document AI first if configured
    if (credentialsJson && processorId) {
        try {
            const credentials = JSON.parse(credentialsJson);
            const projectId = credentials.project_id;
            const location = 'eu'; // Recommended location for Israel
            const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

            const request = {
                name,
                rawDocument: {
                    content: imageBase64,
                    mimeType: mimeType || 'image/jpeg',
                },
            };

            console.log('Processing document with Document AI...');
            const [result] = await client.processDocument(request);
            const { document } = result;

            if (!document) {
                throw new Error('No document returned from Document AI');
            }

            const entities = document.entities || [];

            // Helper to get entity value
            const getEntityValue = (type: string) => {
                const entity = entities.find(e => e.type === type);
                if (!entity) return null;
                return entity.normalizedValue?.text || entity.mentionText;
            };

            const extractedSupplier = getEntityValue('supplier_name') || "לא זוהה";

            // Extract total amount as a number
            let extractedTotal = 0;
            const totalEntity = entities.find(e => e.type === 'total_amount');
            if (totalEntity) {
                if (totalEntity.normalizedValue?.moneyValue) {
                    const units = Number(totalEntity.normalizedValue.moneyValue.units) || 0;
                    const nanos = (totalEntity.normalizedValue.moneyValue.nanos || 0) / 1000000000;
                    extractedTotal = units + nanos;
                } else {
                    const textValue = totalEntity.normalizedValue?.text || totalEntity.mentionText || "0";
                    extractedTotal = parseFloat(textValue.replace(/[^\d.]/g, '')) || 0;
                }
            }

            const extractedDate = getEntityValue('invoice_date') || new Date().toLocaleDateString('he-IL');
            const rawText = document.text || "";

            let parsedData = {
                supplier: extractedSupplier,
                total: extractedTotal,
                date: extractedDate,
                category: "כללי"
            };

            // Use Gemini for categorization
            if (process.env.GEMINI_API_KEY) {
                try {
                    const { GoogleGenerativeAI } = await import('@google/generative-ai');
                    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                    const model = genAI.getGenerativeModel({
                        model: "gemini-2.0-flash", // Using 2.0 flash for speed and reliability
                        generationConfig: { responseMimeType: "application/json" }
                    });

                    const prompt = `
Based on the following supplier name and receipt text, determine the best expense category.
Supplier: ${extractedSupplier}
Full Text Snippet: ${rawText.substring(0, 500)}

Respond ONLY with this JSON:
{
  "category": "One of: חומרי גלם, שתייה, אלכוהול, ציוד, תחזוקה, שכירות, עובדים, כללי"
}
`;
                    const geminiResult = await model.generateContent(prompt);
                    const responseText = geminiResult.response.text();
                    const extractedJson = JSON.parse(responseText);
                    parsedData.category = extractedJson.category || "כללי";
                } catch (geminiError) {
                    console.error('Gemini Categorization Error:', geminiError);
                }
            }

            return res.status(200).json({
                success: true,
                data: {
                    ...parsedData,
                    rawText: rawText.substring(0, 1000) // Truncate for display
                }
            });

        } catch (docAIError) {
            console.error('Document AI Error, falling back to Vision:', docAIError);
        }
    }

    // Fallback to legacy Vision API if Document AI is not configured or fails
    try {
        const vision = await import('@google-cloud/vision');
        const visionClient = new vision.default.ImageAnnotatorClient({
            credentials: credentialsJson ? JSON.parse(credentialsJson) : undefined,
        });

        const imageInput = imageBase64
            ? { content: imageBase64 }
            : { source: { imageUri: imageUrl } };

        const [result] = await visionClient.textDetection({ image: imageInput });
        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    supplier: "לא זוהה",
                    total: 0,
                    date: new Date().toLocaleDateString('he-IL'),
                    category: "כללי",
                    rawText: ""
                }
            });
        }

        const rawText = detections[0].description || "";

        let parsedData = {
            supplier: "לא זוהה",
            total: 0,
            date: new Date().toLocaleDateString('he-IL'),
            category: "כללי"
        };

        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({
                    model: "gemini-1.5-flash",
                    generationConfig: { responseMimeType: "application/json" }
                });

                const prompt = `
Extract details from this Israeli receipt. Respond ONLY with JSON:
{
  "supplier": "string",
  "total": number,
  "date": "dd/mm/yyyy",
  "category": "One of: חומרי גלם, שתייה, אלכוהול, ציוד, תחזוקה, שכירות, עובדים, כללי"
}
Text: ${rawText}
`;
                const geminiResult = await model.generateContent(prompt);
                const extractedJson = JSON.parse(geminiResult.response.text());

                parsedData = {
                    supplier: extractedJson.supplier || "לא זוהה",
                    total: extractedJson.total || 0,
                    date: extractedJson.date || new Date().toLocaleDateString('he-IL'),
                    category: extractedJson.category || "כללי"
                };
            } catch (err) {
                console.error('Legacy Parse Error:', err);
            }
        }

        return res.status(200).json({
            success: true,
            data: { ...parsedData, rawText }
        });

    } catch (error) {
        console.error('General OCR Error:', error);
        return res.status(500).json({ error: 'Failed to process image: ' + (error as Error).message });
    }
}
