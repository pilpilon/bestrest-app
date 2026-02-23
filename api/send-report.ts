import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// The "from" address
const FROM_EMAIL = 'hello@bestrestapp.com';
const FROM_NAME = 'BestRest Expense Reports';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

  // Beautiful Plain Text Template
  let textContent = `📊 חשבוניות שנשלחו מ-BestRest

מסעדה: ${businessName || 'מסעדה'}
חודש: ${monthYear}
נשלח מ: ${userName || userEmail}

=========================================
💰 סה״כ הוצאות לחודש: ₪${totalAmount.toLocaleString()}
📄 כמות חשבוניות מצורפות: ${expenses.length} חשבוניות
=========================================

פירוט חשבוניות:
`;

  expenses.forEach((exp: any, index: number) => {
    textContent += `
${index + 1}. ספק: ${exp.supplier}
   תאריך: ${exp.date} | קטגוריה: ${exp.category}
   סכום: ₪${(exp.total || 0).toLocaleString()}
   --------------------------------------`;
  });

  textContent += `

הודעה זו מיועדת לרואה החשבון.
החשבוניות מצורפות כקבצים למייל זה.

נשלח אוטומטית באמצעות BestRest - מערכת ניהול הוצאות למסעדות 🚀
`;

  try {
    if (!process.env.RESEND_API_KEY) {
      // Development fallback — no API key configured yet
      console.warn('RESEND_API_KEY not set. Simulating successful send.');
      return res.status(200).json({
        success: true,
        message: 'Report generated (Resend not yet configured)',
        preview: textContent,
      });
    }

    // Prepare Attachments for Resend
    const attachments = expenses
      .filter((exp: any) => exp.imageUrl && exp.imageUrl.startsWith('data:'))
      .map((exp: any, index: number) => {
        // Resend needs pure base64 without the data URI prefix
        const base64Data = exp.imageUrl.split(',')[1];

        // Extract content type to get extension
        const contentTypePart = exp.imageUrl.split(';')[0];
        const contentType = contentTypePart.split(':')[1] || 'image/jpeg';
        const extension = contentType.split('/')[1] || 'jpg';

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
      });

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [accountantEmail],
      replyTo: userEmail, // Accountant can reply directly to the restaurant owner
      subject: `📊 חשבוניות שנשלחו — ${businessName || 'מסעדה'} — ${monthYear}`,
      text: textContent, // ONLY sending text, NO html
      attachments: attachments.length > 0 ? attachments : undefined,
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
