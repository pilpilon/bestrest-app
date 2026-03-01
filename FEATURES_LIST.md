# Features List

- **Smart Dashboard**: Monthly performance tracking, KPI cards, AI-driven market insights and alerts.
- **Reports & Analytics**: Deep-dive reports on expenses and suppliers with interactive charts, time filtering, supplier-level drill-down, and category comparison.
- **Client-Side Document AI Camera Compression**: Enforces downscaling (via JS Canvas) of massive native camera photos prior to Serverless Uploads.
- **Recipe Builder**: AI-assisted tool for calculating food cost, margins, and establishing prep instructions from ingredients.
- **Real-time Price Rise Tracker**: Compares active vendor invoices to previous billing cycles and tags inflating products automatically.
- **Multi-Role Security**: Admins, Managers, and Accountants have segregated views of operations.
- **Backend API Security Layer**: Firebase Admin SDK `verifyIdToken` guards on all endpoints to prevent unauthenticated consumption and DoW limit breaching.
- **Data Validation Guardrails**: Zod structures to safely map, test math accuracy (via internal LLM Chain of Thought reasoning elements), and flag low confidence OCR scans requiring manual review upon failing checks.
- **Enterprise AI Infrastructure**: Seamless Vertex AI integration with cost-saving fallback waterfalls (from gemini-flash up to gemini-pro upon validation failures).
- **Daily OCR Scan Paywall**: 1 free scan per day gate that auto-resets based on the date strings, pushing the 299 NIS limit breaker.
- **Invite Links**: Secure URL params to onboard team members without leaking overall branch settings.
- **Scan Queue System**: Background processing of multiple receipts simultaneously with real-time Firestore status tracking and non-blocking UI.
- **Inventory Management**: Full stock management screen (bottom tab) with product cards by category, quantity/unit tracking, aliases (OCR nicknames), low-stock alerts, estimated inventory value KPI, CRUD modal, CSV import/export, and live inventory picker integrated into the Recipe Builder for ingredient selection with real-time quantity and price display.
