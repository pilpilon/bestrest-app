import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { adminAuth } from './firebaseAdmin.js';

const resend = new Resend(process.env.RESEND_API_KEY);

// The "from" address
const FROM_EMAIL = 'hello@bestrestapp.com';
const FROM_NAME = 'BestRest Expense Reports';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }
    const token = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(token);
  } catch (error: any) {
    console.error("Token verification error:", error);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed', details: error.message });
  }

  const { expenses, userEmail, userName, accountantEmail, businessName } = req.body;

  if (!expenses || !Array.isArray(expenses)) {
    return res.status(400).json({ error: 'Missing expenses data' });
  }

  if (!accountantEmail) {
    return res.status(400).json({
      error: 'לא הוגדר אימייל רואה חשבון. יש לעדכן אותו בהגדרות.',
    });
  }

  const totalAmount = expenses.reduce(
    (sum: number, exp: any) => sum + (exp.total || 0),
    0
  );

  const monthYear = new Date().toLocaleString('he-IL', {
    month: 'long',
    year: 'numeric',
  });

  // No text/html body — Rivhit and similar accounting software incorrectly display
  // the email body as a phantom ATTACHMENT. Sending attachments-only avoids this.

  try {
    if (!process.env.RESEND_API_KEY) {
      // Development fallback — no API key configured yet
      console.warn('RESEND_API_KEY not set. Simulating successful send.');
      return res.status(200).json({
        success: true,
        message: 'Report generated (Resend not yet configured)',
      });
    }

    // Prepare Attachments for Resend
    const attachments = await Promise.all(
      expenses
        .filter((exp: any) => exp.imageUrl) // keep anything that has an imageUrl
        .map(async (exp: any, index: number) => {
          let base64Data = '';
          let extension = 'jpg';

          try {
            if (exp.imageUrl.startsWith('data:')) {
              // Handle legacy or direct base64 uploads
              base64Data = exp.imageUrl.split(',')[1];
              const contentTypePart = exp.imageUrl.split(';')[0];
              const contentType = contentTypePart.split(':')[1] || 'image/jpeg';
              extension = contentType.split('/')[1] || 'jpg';
            } else {
              // Handle normal URLs (like Cloudinary)
              const response = await fetch(exp.imageUrl);
              if (!response.ok) {
                console.error(`Failed to fetch image ${exp.imageUrl}`);
                return null;
              }
              const arrayBuffer = await response.arrayBuffer();
              base64Data = Buffer.from(arrayBuffer).toString('base64');

              // Try to guess extension from content-type or URL
              const contentType = response.headers.get('content-type') || 'image/jpeg';
              extension = contentType.split('/')[1] || 'jpg';
            }
          } catch (e) {
            console.error(`Error processing attachment ${index}:`, e);
            return null;
          }

          // Sanitize supplier name for safe filename
          const safeSupplier = (exp.supplier || 'invoice')
            .replace(/[^a-z0-9א-ת]/gi, '_')
            .substring(0, 20);
          const safeDate = (exp.date || new Date().toISOString().split('T')[0])
            .replace(/[^0-9]/g, '-');

          return {
            filename: `${safeSupplier}_${safeDate}_${index + 1}.${extension}`,
            content: base64Data,
          };
        })
    );

    // Filter out any failed attachments
    const validAttachments = attachments.filter(Boolean);

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [accountantEmail],
      replyTo: userEmail,
      subject: `דוח חשבוניות - ${businessName || 'מסעדה'} - ${monthYear}`,
      // Single-space text body: Resend requires text or html, but a blank body
      // won't appear as a phantom attachment in Rivhit / accounting software.
      text: ' ',
      attachments: validAttachments.length > 0 ? validAttachments as any[] : undefined,
    });

    if (error) {
      console.error('Resend API error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (error) {
    console.error('Email send error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to send email: ' + (error as Error).message });
  }
}
