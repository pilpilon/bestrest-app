import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// The "from" address — requires domain verification in Resend dashboard.
// For local/staging, Resend allows sending unverified from onboarding@resend.dev
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
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

  const rows = expenses
    .map(
      (exp: any) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px; text-align: right; vertical-align: middle;">${exp.date}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-size: 13px; font-weight: 600; text-align: right; vertical-align: middle;">${exp.supplier}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px; text-align: right; vertical-align: middle;">${exp.category}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #1e293b; color: #0df280; font-size: 14px; font-weight: 700; text-align: left; vertical-align: middle; direction: ltr;">₪${(exp.total || 0).toLocaleString()}</td>
    </tr>
  `
    )
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>דוח הוצאות BestRest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: 'Helvetica Neue', Arial, sans-serif;">
  
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b1120; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f1f14 0%, #0b1120 100%); border: 1px solid #0df28030; border-radius: 16px 16px 0 0; padding: 32px 36px; text-align: center;">
              <div style="display: inline-block; background: #0df28015; border: 1px solid #0df28040; border-radius: 12px; padding: 8px 20px; margin-bottom: 16px;">
                <span style="color: #0df280; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">BestRest</span>
              </div>
              <h1 style="color: #f1f5f9; font-size: 24px; font-weight: 800; margin: 0 0 8px 0;">
                דוח הוצאות חודשי
              </h1>
              <p style="color: #64748b; font-size: 15px; margin: 0;">
                ${businessName || 'מסעדה'} — ${monthYear}
              </p>
            </td>
          </tr>

          <!-- TOTAL HIGHLIGHT BANNER -->
          <tr>
            <td style="background: #0df28015; border-right: 1px solid #0df28030; border-left: 1px solid #0df28030; padding: 28px 36px; text-align: center;">
              <p style="color: #94a3b8; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">סה״כ הוצאות לחודש</p>
              <div style="color: #0df280; font-size: 36px; font-weight: 900; margin: 0 0 16px 0; letter-spacing: -0.5px; direction: ltr; display: inline-block;">
                ₪${totalAmount.toLocaleString()}
              </div>
              <p style="color: #64748b; font-size: 13px; margin: 0;">
                נשלח ע"י <strong style="color: #94a3b8;">${userName || userEmail}</strong> &nbsp;|&nbsp; סה"כ ${expenses.length} חשבוניות
              </p>
            </td>
          </tr>

          <!-- TABLE -->
          <tr>
            <td style="background-color: #0f172a; border-right: 1px solid #1e293b; border-left: 1px solid #1e293b; padding: 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <thead>
                  <tr style="background-color: #1e293b;">
                    <th width="20%" style="padding: 14px 16px; color: #64748b; font-size: 12px; font-weight: 700; text-align: right;">תאריך</th>
                    <th width="40%" style="padding: 14px 16px; color: #64748b; font-size: 12px; font-weight: 700; text-align: right;">ספק</th>
                    <th width="25%" style="padding: 14px 16px; color: #64748b; font-size: 12px; font-weight: 700; text-align: right;">קטגוריה</th>
                    <th width="15%" style="padding: 14px 16px; color: #64748b; font-size: 12px; font-weight: 700; text-align: left;">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
                <tfoot>
                  <tr style="background-color: #1e293b;">
                    <td colspan="3" style="padding: 16px; color: #f1f5f9; font-weight: 700; font-size: 15px; text-align: right;">סה״כ הוצאות חודשיות</td>
                    <td style="padding: 16px; color: #0df280; font-weight: 900; font-size: 17px; text-align: left; direction: ltr;">₪${totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #080e1a; border: 1px solid #1e293b; border-top: none; border-radius: 0 0 16px 16px; padding: 24px 36px; text-align: center;">
              <p style="color: #334155; font-size: 12px; margin: 0 0 8px 0;">
                דוח זה הופק אוטומטית על ידי
              </p>
              <p style="margin: 0;">
                <span style="color: #0df280; font-size: 13px; font-weight: 700;">BestRest</span>
                <span style="color: #475569; font-size: 12px;"> — מערכת ניהול הוצאות למסעדות</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
`;

  try {
    if (!process.env.RESEND_API_KEY) {
      // Development fallback — no API key configured yet
      console.warn('RESEND_API_KEY not set. Simulating successful send.');
      return res.status(200).json({
        success: true,
        message: 'Report generated (Resend not yet configured)',
        preview: htmlContent,
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
      subject: `📊 דוח הוצאות — ${businessName || 'מסעדה'} — ${monthYear}`,
      html: htmlContent,
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
