import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// Note: These will be configured in Vercel environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const ACCOUNTANT_EMAIL = process.env.ACCOUNTANT_EMAIL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { expenses, userEmail, userName } = req.body;

    if (!expenses || !Array.isArray(expenses)) {
        return res.status(400).json({ error: 'Missing expenses data' });
    }

    // Generate HTML Report
    const totalAmount = expenses.reduce((sum, exp) => sum + (exp.total || 0), 0);
    const rows = expenses.map(exp => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${exp.date}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${exp.supplier}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${exp.category}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">₪${exp.total?.toLocaleString()}</td>
    </tr>
  `).join('');

    const htmlContent = `
    <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0df280;">דו״ח הוצאות חודשי - מסעדת פרו</h2>
      <p>שלום,</p>
      <p>מצורף ריכוז הוצאות עבור חודש ${new Date().toLocaleString('he-IL', { month: 'long', year: 'numeric' })}.</p>
      <p>שולח: <strong>${userName}</strong> (${userEmail})</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 8px; text-align: right;">תאריך</th>
            <th style="padding: 8px; text-align: right;">ספק</th>
            <th style="padding: 8px; text-align: right;">קטגוריה</th>
            <th style="padding: 8px; text-align: right;">סכום</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8f9fa; font-size: 1.1em;">
            <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold;">סה״כ לתשלום:</td>
            <td style="padding: 12px; text-align: right; font-weight: bold; color: #0df280;">₪${totalAmount.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      
      <p style="margin-top: 30px; font-size: 0.8em; color: #666;">הופק באמצעות Antigravity Expense Manager</p>
    </div>
  `;

    try {
        // If no SMTP configured, return success but log warning (for development)
        if (!SMTP_USER || !SMTP_PASS) {
            console.warn('SMTP not configured. Report generated but not sent.');
            return res.status(200).json({
                success: true,
                message: 'Report generated successfully (Simulated - SMTP not configured)',
                preview: htmlContent
            });
        }

        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });

        await transporter.sendMail({
            from: `"Antigravity POS" <${SMTP_USER}>`,
            to: ACCOUNTANT_EMAIL,
            cc: userEmail,
            subject: `דו״ח הוצאות - מסעדת פרו - ${new Date().toLocaleDateString('he-IL')}`,
            html: htmlContent,
        });

        return res.status(200).json({ success: true, message: 'Report sent successfully' });
    } catch (error) {
        console.error('Email Error:', error);
        return res.status(500).json({ error: 'Failed to send email: ' + (error as Error).message });
    }
}
