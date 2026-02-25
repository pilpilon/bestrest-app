import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure we load from the project root .env
dotenv.config({ path: resolve(__dirname, '../.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const RULES = [
    { cat: 'שתייה', keywords: ['קוקה קולה', 'קולה', 'זירו', 'ספרייט', 'פאנטה', 'מיץ', 'מים', 'נביעות', 'סודה', 'טרופית', 'פיוז טי', 'משקה', 'נסטי', 'קינלי', 'שוופס'] },
    { cat: 'אלכוהול', keywords: ['בירה', 'יין', 'וודקה', 'וויסקי', 'ערק', 'גולדסטאר', 'מכבי', 'היינקן', 'קורונה', 'סטלה', 'טובורג', 'קמפרי', 'רום', 'קברנה', 'מרלו'] },
    { cat: 'ציוד', keywords: ['כוס', 'כוסות', 'צלחת', 'מזלג', 'סכין', 'כף', 'כפיות', 'מפית', 'מפיות', 'מפה', 'קופסה', 'קופסאות', 'שקית', 'שקיות', 'נייר', 'רדיד', 'ניילון נצמד', 'מגבון', 'מגבונים', 'קש', 'קשים', 'תבנית'] },
    { cat: 'תחזוקה', keywords: ['אקונומיקה', 'סבון', 'נוזל כלים', 'מסיר שומנים', 'מטאטא', 'מגב', 'סמרטוט', 'כפפות', 'פח', 'שקית זבל', 'ניקוי', 'חומר', 'מרכך', 'מנקה', 'אשפה', 'שקיות זבל'] },
    { cat: 'חומרי גלם', keywords: ['עגבני', 'מלפפון', 'בצל', 'שום', 'חסה', 'תפוח', 'תפוז', 'לימון', 'גזר', 'פלפל', 'כרוב', 'פטרוזיליה', 'כוסברה', 'נענע', 'פטרי', 'בשר', 'עוף', 'בקר', 'אנטריקוט', 'המבורגר', 'חזה', 'שוקיים', 'דג', 'סלמון', 'לחמני', 'פית', 'לחם', 'קמח', 'שמן', 'סוכר', 'מלח', 'פלפל שחור', 'פפריקה', 'כמון', 'תבלין', 'רוטב', 'קטשופ', 'מיונז', 'חרדל', 'טריאקי', 'סויה', 'צ\'ילי', 'חלב', 'גבינ', 'חמאה', 'שמנת', 'ביצ', 'טופו', 'אורז', 'פסטה', 'פתיתים', 'צ\'יפס', 'זיתים', 'שימורים', 'רסק'] }
];

function guessCategory(name) {
    if (!name) return null;
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
    const businessesSnap = await getDocs(collection(db, 'businesses'));
    let updatedCount = 0;
    let skippedCount = 0;

    for (const biz of businessesSnap.docs) {
        console.log(`Processing business: ${biz.id}`);
        const invRef = collection(db, 'businesses', biz.id, 'inventory');
        const invSnap = await getDocs(invRef);

        let batch = writeBatch(db);
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
                } else {
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }

            if (batchCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
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
