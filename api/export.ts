import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Handle both JSON body and form-encoded body
    let expenses: any[] = [];
    try {
        if (typeof req.body === 'string') {
            expenses = JSON.parse(req.body);
        } else if (req.body?.expenses) {
            // form-encoded: expenses comes as a string
            expenses = typeof req.body.expenses === 'string'
                ? JSON.parse(req.body.expenses)
                : req.body.expenses;
        }
    } catch {
        return res.status(400).json({ error: 'Invalid expenses data' });
    }

    if (!Array.isArray(expenses) || expenses.length === 0) {
        return res.status(400).json({ error: 'No expenses data provided' });
    }

    // BOM for Excel Hebrew encoding
    const BOM = '\uFEFF';
    const headers = '\u05EA\u05D0\u05E8\u05D9\u05DA,\u05E1\u05E4\u05E7,\u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D4,\u05E1\u05DB\u05D5\u05DD,\u05E0\u05E9\u05DC\u05D7';

    const rows = expenses.map((exp: any) => {
        const date = `"${(exp.date || '').replace(/"/g, '""')}"`;
        const supplier = `"${(exp.supplier || '').replace(/"/g, '""')}"`;
        const category = `"${(exp.category || '').replace(/"/g, '""')}"`;
        const total = exp.total || 0;
        const sent = exp.isSent ? '\u05DB\u05DF' : '\u05DC\u05D0';
        return [date, supplier, category, total, sent].join(',');
    });

    const csvContent = BOM + [headers, ...rows].join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `BestRest_Report_${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.status(200).send(csvContent);
}
