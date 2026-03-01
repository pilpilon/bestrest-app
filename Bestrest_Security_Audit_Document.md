# BestRest Security Audit Document

## 1. Context & Overview
**BestRest** is a multi-tenant SaaS application tailored for the Israeli restaurant and catering industry. Its core purpose is to provide restaurant managers with tools to manage expenses, analyze food costs, and monitor market pricing using AI capabilities (Document AI, Target Vertex AI models).
This document outlines the architecture, toolchain, and security boundaries.

## 2. Toolchain & Tech Stack
- **Frontend Framework**: React 19 + Vite + TypeScript
- **Styling**: Tailwind CSS v4 (PostCSS)
- **State Management & Data**: Custom React Hooks interfacing directly with Firebase Web SDK
- **Backend Infrastructure**: Vercel Serverless Functions (`/api/*`) for heavy AI/ML OCR abstractions.
- **Database & Auth**: Firebase Authentication & Firestore
  - *Client-side*: Direct interactions via the Firebase JS SDK (`firebase/firestore`).
  - *Server-side (Vercel API)*: Interactions via the Firebase Admin SDK for Node.js.

## 3. Database Schema (Firestore)
The application uses a multi-tenant structure organized predominantly around `businessId` to map users and resources to specific organizations.

### Collections:
- **`users/{userId}`** 
  - Represents the authenticated user's profile.
  - Fields: `role` ('admin', 'manager', 'accountant'), `businessId`, `subscriptionTier`, `ocrScanResetDate`.
- **`expenses/{expenseId}`**
  - Represents logged expenses/invoices.
  - Fields: `businessId` (used for tenant isolation), and invoice details (supplier, total, date, category, line items).
- **`businesses/{businessId}/*` (WIP Migration)** 
  - Subcollections for `staff`, `availability`, `published_schedules`, and `negotiation_logs` are currently being migrated here to enforce stricter multi-tenant segregation.
- **`market_price_cache/{itemName}`**
  - Caches AI-generated market insights (TTL: 7 days) to limit unnecessary API calls to Google Search Grounding.

## 4. Security Architecture

### 4.1. Authentication
- BestRest uses Firebase Authentication for all user identity management. 
- The client-side application securely manages active session tokens.

### 4.2. Database Access Controls (Firestore Security Rules)
Direct client-side access to Firestore is governed by precise Security Rules evaluating the `request.auth` token and matching the user's `role` and `businessId`.

**User Profiles Rules:**
```javascript
match /users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && (
    // Users can update their own document, BUT cannot change their subscription tier or reset date
    (request.auth.uid == userId && (
      !request.resource.data.diff(resource.data).affectedKeys().hasAny(['subscriptionTier', 'ocrScanResetDate'])
      || resource == null // Allow initial creation
    )) ||
    // Admins can do anything
    getRole() == 'admin'
  );
}
```

**Expenses Rules (Multi-Tenant & RBAC enforced):**
```javascript
match /expenses/{expenseId} {
  function sameBusiness() {
    return resource.data.businessId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.businessId;
  }
  
  allow read: if request.auth != null && sameBusiness() && (getRole() in ['admin', 'manager', 'accountant']);
  allow create: if request.auth != null && request.resource.data.businessId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.businessId && (getRole() in ['admin', 'manager']);
  allow update: if request.auth != null && sameBusiness() && (getRole() in ['admin', 'manager']);
  allow delete: if request.auth != null && sameBusiness() && (getRole() == 'admin');
}
```

### 4.3. Backend API Security (Vercel Serverless)
Heavy compute tasks (like AI OCR) are offloaded to Vercel Serverless Functions (`api/ocr.ts`, `api/market-insights.ts`). 

- **Bearer Token Verification**: All requests to secure Vercel API routes require a valid Firebase ID token passed in the Authorization header.
- The Admin SDK `verifyIdToken` method validates the token before executing any internal logic.

```typescript
// From api/ocr.ts
const authHeader = req.headers.authorization;
if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
}
try {
    const token = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(token); // Stops execution if invalid
} catch (error: any) {
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
}
```

### 4.4. Cross-Origin Resource Sharing (CORS)
CORS is explicitly configured for the Vercel API endpoints and Google Cloud Storage buckets (if applicable) to only accept requests from recognized origins:
- `https://bestrest-app.vercel.app`
- `http://localhost:5173`
- `http://localhost:4173`

Allowed methods are strictly scoped, and headers include standard auth/disposition flags.

## 5. Audit Objective
Please review the system and identify optimization points around:
1. **Multi-tenant Data Leaks**: Are there potential vectors in the Firestore rules where a user could traverse `businessId` boundaries?
2. **Privilege Escalation**: Are the diff/affectedKeys rules on `users` robust enough to prevent a user from self-promoting to "admin"?
3. **API Auth Bypassing**: Ensure token verification across the internal Vercel/Firebase boundary is correctly implemented.
