"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Migration Script: Auto-Categorize Inventory
 * Reads all inventory items across all businesses and attempts to assign them
 * to logical categories (חומרי גלם, שתייה, אלכוהול, ציוד, תחזוקה) based on their names.
 */
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const dotenv = __importStar(require("dotenv"));
const path_1 = require("path");
// Using standard __dirname available in CommonJS
dotenv.config({ path: (0, path_1.resolve)(__dirname, '../.env') });
const serviceAccountStr = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (!serviceAccountStr) {
    console.error("Missing GOOGLE_APPLICATION_CREDENTIALS_JSON in .env");
    process.exit(1);
}
(0, app_1.initializeApp)({ credential: (0, app_1.cert)(JSON.parse(serviceAccountStr)) });
const db = (0, firestore_1.getFirestore)();
const RULES = [
    { cat: 'שתייה', keywords: ['קוקה קולה', 'קולה', 'זירו', 'ספרייט', 'פאנטה', 'מיץ', 'מים', 'נביעות', 'סודה', 'טרופית', 'פיוז טי', 'משקה', 'נסטי', 'קינלי', 'שוופס'] },
    { cat: 'אלכוהול', keywords: ['בירה', 'יין', 'וודקה', 'וויסקי', 'ערק', 'גולדסטאר', 'מכבי', 'היינקן', 'קורונה', 'סטלה', 'טובורג', 'קמפרי', 'רום', 'קברנה', 'מרלו'] },
    { cat: 'ציוד', keywords: ['כוס', 'כוסות', 'צלחת', 'מזלג', 'סכין', 'כף', 'כפיות', 'מפית', 'מפיות', 'מפה', 'קופסה', 'קופסאות', 'שקית', 'שקיות', 'נייר', 'רדיד', 'ניילון נצמד', 'מגבון', 'מגבונים', 'קש', 'קשים', 'תבנית'] },
    { cat: 'תחזוקה', keywords: ['אקונומיקה', 'סבון', 'נוזל כלים', 'מסיר שומנים', 'מטאטא', 'מגב', 'סמרטוט', 'כפפות', 'פח', 'שקית זבל', 'ניקוי', 'חומר', 'מרכך', 'מנקה', 'אשפה', 'שקיות זבל'] },
    { cat: 'חומרי גלם', keywords: ['עגבני', 'מלפפון', 'בצל', 'שום', 'חסה', 'תפוח', 'תפוז', 'לימון', 'גזר', 'פלפל', 'כרוב', 'פטרוזיליה', 'כוסברה', 'נענע', 'פטרי', 'בשר', 'עוף', 'בקר', 'אנטריקוט', 'המבורגר', 'חזה', 'שוקיים', 'דג', 'סלמון', 'לחמני', 'פית', 'לחם', 'קמח', 'שמן', 'סוכר', 'מלח', 'פלפל שחור', 'פפריקה', 'כמון', 'תבלין', 'רוטב', 'קטשופ', 'מיונז', 'חרדל', 'טריאקי', 'סויה', 'צ\'ילי', 'חלב', 'גבינ', 'חמאה', 'שמנת', 'ביצ', 'טופו', 'אורז', 'פסטה', 'פתיתים', 'צ\'יפס', 'זיתים', 'שימורים', 'רסק'] }
];
function guessCategory(name) {
    if (!name)
        return null;
    const lowerName = name.toLowerCase();
    for (const rule of RULES) {
        for (const kw of rule.keywords) {
            if (lowerName.includes(kw)) {
                return rule.cat;
            }
        }
    }
    return null;
}
async function run() {
    console.log("Starting categorization migration...");
    const businessesSnap = await db.collection('businesses').get();
    let updatedCount = 0;
    let skippedCount = 0;
    for (const biz of businessesSnap.docs) {
        console.log(`Processing business: ${biz.id}`);
        const invRef = db.collection('businesses').doc(biz.id).collection('inventory');
        const invSnap = await invRef.get();
        const batch = db.batch();
        let batchCount = 0;
        for (const itemDoc of invSnap.docs) {
            const item = itemDoc.data();
            const name = item.name || '';
            const currCat = item.category || '';
            // Even if it's currently 'כללי', we try to find a better one
            if (currCat === 'כללי' || !currCat) {
                const newCat = guessCategory(name);
                if (newCat) {
                    batch.update(itemDoc.ref, { category: newCat });
                    batchCount++;
                    updatedCount++;
                    console.log(`   [Update] "${name}": ${currCat || 'none'} -> ${newCat}`);
                }
                else {
                    skippedCount++;
                }
            }
            else {
                skippedCount++;
            }
            if (batchCount >= 400) {
                await batch.commit();
                batchCount = 0;
            }
        }
        if (batchCount > 0) {
            await batch.commit();
        }
    }
    console.log("Migration complete!");
    console.log(`Items updated: ${updatedCount}`);
    console.log(`Items skipped/unchanged: ${skippedCount}`);
    process.exit(0);
}
run().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
