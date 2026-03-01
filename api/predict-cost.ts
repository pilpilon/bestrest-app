import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { VertexAI } from '@google-cloud/vertexai';
import { adminAuth } from './firebaseAdmin.js';
import { z } from 'zod';

export const maxDuration = 60;

const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const credentials = credentialsJson ? JSON.parse(credentialsJson) : {};
const vertex_ai = new VertexAI({ project: credentials.project_id || process.env.VITE_FIREBASE_PROJECT_ID, location: 'us-central1' });

const PredictCostSchema = z.object({
    cost: z.number(),
    matchedItem: z.string()
});

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0 && credentialsJson) {
    const cred = JSON.parse(credentialsJson);
    initializeApp({ credential: cert(cred) });
}
const adminDb = getApps().length > 0 ? getFirestore() : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { ingredientText, businessId } = req.body;

    if (!ingredientText) {
        return res.status(400).json({ error: 'Missing ingredientText' });
    }

    // --- Step 1: Check Firestore inventory for a matching item ---
    if (adminDb && businessId) {
        try {
            const inventoryRef = adminDb.collection('businesses').doc(businessId).collection('inventory');
            const snapshot = await inventoryRef.get();

            if (!snapshot.empty) {
                const searchTerms = ingredientText.toLowerCase().split(/\s+/).filter((t: string) => t.length > 1);

                let bestMatch: { name: string; lastPrice: number; unit: string; supplier: string; previousPrice: number } | null = null;
                let bestScore = 0;

                snapshot.docs.forEach(doc => {
                    const item = doc.data();
                    const itemName = (item.name || '').toLowerCase();
                    const itemAliases: string[] = (item.aliases || []).map((a: string) => a.toLowerCase());

                    // Calculate match score: check name and all aliases
                    const namesToCheck = [itemName, ...itemAliases];
                    let score = 0;
                    for (const term of searchTerms) {
                        if (namesToCheck.some(n => n.includes(term))) score++;
                    }
                    // Also check reverse: item name words in search text
                    const itemWords = itemName.split(/\s+/).filter((w: string) => w.length > 1);
                    for (const word of itemWords) {
                        if (ingredientText.toLowerCase().includes(word)) score++;
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = {
                            name: item.name,
                            lastPrice: item.lastPrice,
                            unit: item.unit,
                            supplier: item.supplier,
                            previousPrice: item.previousPrice
                        };
                    }
                });

                // If we found a good match (at least 1 word matches)
                if (bestMatch !== null && bestScore >= 1) {
                    const match = bestMatch as { name: string; lastPrice: number; unit: string; supplier: string; previousPrice: number };
                    const priceChange = match.previousPrice && match.previousPrice > 0
                        ? Math.round(((match.lastPrice - match.previousPrice) / match.previousPrice) * 100)
                        : 0;

                    return res.status(200).json({
                        success: true,
                        data: {
                            cost: match.lastPrice,
                            matchedItem: `${match.name} (${match.supplier})`,
                            source: 'inventory',
                            unit: match.unit,
                            priceChange: priceChange
                        }
                    });
                }
            }
        } catch (err) {
            console.error("Inventory lookup error:", err);
            // Fall through to AI prediction
        }
    }

    // --- Step 2: Fall back to AI prediction ---
    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
You are a kitchen master and food cost expert in Israel.
Given an ingredient and its quantity, predict its cost in Israeli Shekels (₪) based on average market prices for restaurants.

<item>
Ingredient: "${ingredientText.substring(0, 100)}"
</item>

Respond ONLY with valid JSON:
{
  "cost": 12.5,
  "matchedItem": "Description of the item matched"
}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        return res.status(200).json({
            success: true,
            data: {
                ...parsed,
                source: 'ai_estimate',
                priceChange: 0
            }
        });

    } catch (err) {
        console.error("Gemini cost prediction error:", err);
        return res.status(500).json({ error: 'Failed to predict cost: ' + (err as Error).message });
    }
}
