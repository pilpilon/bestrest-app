import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─── Firebase Admin Init ──────────────────────────────────────────────────────
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (getApps().length === 0 && credentialsJson) {
    const cred = JSON.parse(credentialsJson);
    initializeApp({ credential: cert(cred) });
}
const adminDb = getApps().length > 0 ? getFirestore() : null;

// ─── Cache TTL: 7 days in ms ──────────────────────────────────────────────────
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Safe JSON parser ─────────────────────────────────────────────────────────
function safeParseJson(raw: string): any {
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
        return JSON.parse(text);
    } catch {
        const fixed = text.replace(/(?<=[\u0590-\u05FF\w])"(?=[\u0590-\u05FF\w])/g, "''");
        return JSON.parse(fixed);
    }
}

// ─── Create a stable cache key from item name ─────────────────────────────────
function toCacheKey(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9\u0590-\u05FF]/g, '_').slice(0, 80);
}

// ─── Fetch market price from Gemini with Google Search Grounding ──────────────
async function fetchMarketPriceFromAI(itemName: string, itemPrice: number, itemUnit: string) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        // Enable Google Search Grounding for real-time prices
        tools: [{ googleSearch: {} } as any],
    });

    const prompt = `
אתה מומחה לעלויות מזון ורכש בתחום הקייטרינג והמסעדנות בישראל.

חפש ברשת את המחיר הסיטונאי הנוכחי בשוק הישראלי עבור המוצר הבא:
שם: "${itemName}"
מחיר שהמסעדן שילם: ₪${itemPrice} ל-${itemUnit}

חוקים חשובים:
1. חפש מחירים ב-2024-2025 ממקורות ישראלים (ספקים סיטונאיים, מחירוני מזון, אתרי B2B).
2. שים לב לגודל האריזה — אם השם מכיל "10 ק\"ג" החזר מחיר לאותה אריזה, לא ל-1 ק\"ג.
3. מחירים סיטונאיים בלבד — לא סופרמרקט, לא קמעונאי.
4. החזר JSON בלבד — ללא markdown, ללא הסברים.

פורמט תשובה:
{
  "marketPrice": <number>,
  "recommendedUnit": "<תיאור האריזה, לדוגמה: מארז 10 ק\"ג>",
  "confidence": "<high|medium|low>"
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log(`[market-insights] Gemini raw for "${itemName}":`, text.slice(0, 300));
    return safeParseJson(text);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { items } = req.body; // [{ name, price, unit }]

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Missing or invalid items array' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ success: false, error: 'Server configuration error' });
        }

        const insights = await Promise.all(
            items.map(async (inputItem: { name: string; price: number; unit: string }) => {
                const cacheKey = toCacheKey(inputItem.name);
                let marketData: { marketPrice: number; recommendedUnit: string } | null = null;
                let fromCache = false;

                // ── Step 1: Check Firestore cache ─────────────────────────────
                if (adminDb) {
                    try {
                        const cacheRef = adminDb.collection('market_price_cache').doc(cacheKey);
                        const cached = await cacheRef.get();

                        if (cached.exists) {
                            const data = cached.data()!;
                            const age = Date.now() - data.cachedAt;

                            if (age < CACHE_TTL_MS) {
                                console.log(`[market-insights] Cache HIT for "${inputItem.name}" (age: ${Math.round(age / 3600000)}h)`);
                                marketData = { marketPrice: data.marketPrice, recommendedUnit: data.recommendedUnit };
                                fromCache = true;
                            } else {
                                console.log(`[market-insights] Cache EXPIRED for "${inputItem.name}"`);
                            }
                        } else {
                            console.log(`[market-insights] Cache MISS for "${inputItem.name}"`);
                        }
                    } catch (err) {
                        console.error('[market-insights] Cache read error:', err);
                        // Fall through to Gemini
                    }
                }

                // ── Step 2: Cache miss → call Gemini with Search Grounding ────
                if (!marketData) {
                    try {
                        const aiResult = await fetchMarketPriceFromAI(inputItem.name, inputItem.price, inputItem.unit);

                        if (aiResult && typeof aiResult.marketPrice === 'number') {
                            marketData = {
                                marketPrice: parseFloat(aiResult.marketPrice.toFixed(2)),
                                recommendedUnit: aiResult.recommendedUnit || inputItem.unit,
                            };

                            // ── Step 3: Save to Firestore cache ───────────────
                            if (adminDb) {
                                try {
                                    await adminDb.collection('market_price_cache').doc(cacheKey).set({
                                        itemName: inputItem.name,
                                        marketPrice: marketData.marketPrice,
                                        recommendedUnit: marketData.recommendedUnit,
                                        confidence: aiResult.confidence || 'medium',
                                        cachedAt: Date.now(),
                                    });
                                } catch (err) {
                                    console.error('[market-insights] Cache write error:', err);
                                    // Non-fatal — we still have the result
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`[market-insights] Gemini error for "${inputItem.name}":`, err);
                        // Fall through: marketData stays null
                    }
                }

                // ── Step 4: Build insight object ──────────────────────────────
                const finalMarketPrice = marketData?.marketPrice ?? inputItem.price;
                let savingsPct = 0;
                if (inputItem.price > finalMarketPrice && finalMarketPrice > 0) {
                    savingsPct = ((inputItem.price - finalMarketPrice) / inputItem.price) * 100;
                }

                // Clean up "ל" prefix if present (avoid "ללמארז")
                let finalUnit = marketData?.recommendedUnit || inputItem.unit;
                if (finalUnit.startsWith('ל')) finalUnit = finalUnit.substring(1);

                return {
                    itemName: inputItem.name,
                    userPrice: inputItem.price,
                    marketPrice: finalMarketPrice,
                    savingsPct: parseFloat(savingsPct.toFixed(1)),
                    unit: finalUnit,
                    _fromCache: fromCache, // For debugging
                };
            })
        );

        // Return only items where user actually pays more than market
        const relevantInsights = insights.filter(i => i.savingsPct > 0);

        res.status(200).json({ success: true, insights: relevantInsights });

    } catch (error: any) {
        console.error('[market-insights] Handler error:', error);
        res.status(500).json({ success: false, error: error?.message || 'Internal server error' });
    }
}
