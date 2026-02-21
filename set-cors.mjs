/**
 * Script to set CORS configuration on Firebase Storage bucket.
 * Run: node set-cors.mjs
 * Requires GOOGLE_APPLICATION_CREDENTIALS_JSON env var OR a service-account.json file.
 */

import { Storage } from '@google-cloud/storage';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to load service account from file if env var not set
let credentials;
try {
    const saPath = join(__dirname, 'service-account.json');
    credentials = JSON.parse(readFileSync(saPath, 'utf8'));
    console.log('✓ Loaded credentials from service-account.json');
} catch {
    const envJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!envJson) {
        console.error('❌ No credentials found!');
        console.error('   Place service-account.json in the project root, OR');
        console.error('   Set the GOOGLE_APPLICATION_CREDENTIALS_JSON env var.');
        process.exit(1);
    }
    credentials = JSON.parse(envJson);
    console.log('✓ Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON');
}

const storage = new Storage({ credentials });
const bucketName = 'bestrest-8f1a4.firebasestorage.app';

const corsConfig = [
    {
        origin: [
            'https://bestrest-app.vercel.app',
            'http://localhost:5173',
            'http://localhost:4173',
        ],
        method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
        maxAgeSeconds: 3600,
        responseHeader: [
            'Content-Type',
            'Content-MD5',
            'Content-Disposition',
            'Cache-Control',
            'Authorization',
            'x-goog-resumable',
        ],
    },
];

async function setCors() {
    try {
        await storage.bucket(bucketName).setCorsConfiguration(corsConfig);
        console.log(`✅ CORS configured successfully for gs://${bucketName}`);
        console.log('   Allowed origins:', corsConfig[0].origin.join(', '));
    } catch (err) {
        console.error('❌ Failed to set CORS:', err.message);
    }
}

setCors();
