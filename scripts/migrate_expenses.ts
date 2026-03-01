import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// Initialize Firebase Admin using the same credential file as Vercel
const serviceAccount = JSON.parse(fs.readFileSync('./firebase-admin-key.json', 'utf8'));

initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id
});

const db = getFirestore();

async function migrateExpenses() {
    console.log('Starting expenses migration to multi-tenant paths...');
    const expensesRef = db.collection('expenses');
    const snapshot = await expensesRef.get();

    if (snapshot.empty) {
        console.log('No expenses found in the root collection.');
        return;
    }

    console.log(`Found ${snapshot.size} expenses to migrate.`);

    let migratedCount = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data.businessId) {
            console.warn(`Skipping document ${doc.id} as it has no businessId.`);
            continue;
        }

        const tenantExpenseRef = db.collection('businesses').doc(data.businessId).collection('expenses').doc(doc.id);
        batch.set(tenantExpenseRef, data);
        migratedCount++;

        // Optionally delete from root:
        // batch.delete(doc.ref);

        // Commit every 400 docs to stay within Firestore 500 max writes
        if (migratedCount % 400 === 0) {
            await batch.commit();
            console.log(`Committed ${migratedCount} documents...`);
        }
    }

    if (migratedCount % 400 !== 0) {
        await batch.commit();
    }

    console.log(`Migration complete! Successfully copied ${migratedCount} expenses.`);
}

migrateExpenses().catch(console.error);
