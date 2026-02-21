import { VercelRequest, VercelResponse } from '@vercel/node';
import vision from '@google-cloud/vision';

// Initialize the Vision client
// In production, GOOGLE_APPLICATION_CREDENTIALS should be set in Vercel environment variables
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
        // Perform text detection on the image URL
        const [result] = await client.textDetection(imageUrl);
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
                    model: "gemini-2.5-flash",
                    generationConfig: { responseMimeType: "application/json" }
                });

                const prompt = `
Extract the following details from this Israeli restaurant receipt text. 
Respond ONLY with a valid JSON object matching exactly this schema:
{
  "supplier": "Name of the business/supplier (usually at the top)",
  "total": 123.45, // Number, the final total amount to pay
  "date": "dd/mm/yyyy", // Extract the date. Use today if missing.
  "category": "One of: חומרי גלם, שתייה, אלכוהול, ציוד, תחזוקה, שכירות, עובדים, כללי"
}

Receipt text:
${rawText}
`;
                const geminiResult = await model.generateContent(prompt);
                const responseText = geminiResult.response.text();
                const extractedJson = JSON.parse(responseText);

                parsedData = {
                    supplier: extractedJson.supplier || "לא זוהה",
                    total: extractedJson.total || 0,
                    date: extractedJson.date || new Date().toLocaleDateString('he-IL'),
                    category: extractedJson.category || "כללי"
                };
            } catch (geminiError) {
                console.error('Gemini Parsing Error - falling back to basic parsing:', geminiError);
                // Fallback implemented below
            }
        }

        // Fallback or if Gemini not configured yet
        if (parsedData.total === 0 && parsedData.supplier === "לא זוהה") {
            const lines = rawText.split('\n');
            parsedData.supplier = lines[0] || "לא זוהה";

            const totalMatch = rawText.match(/(?:סה["״]כ|Total|סכום)\s*[:]?\s*(\d+(?:\.\d{1,2})?)/i);
            parsedData.total = totalMatch ? parseFloat(totalMatch[1]) : 0;

            const dateMatch = rawText.match(/(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4})/);
            parsedData.date = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('he-IL');
            parsedData.category = "בתהליך...";
        }

        return res.status(200).json({
            success: true,
            data: {
                ...parsedData,
                rawText
            }
        });

    } catch (error) {
        console.error('OCR Error:', error);
        return res.status(500).json({ error: 'Failed to process image: ' + (error as Error).message });
    }
}
