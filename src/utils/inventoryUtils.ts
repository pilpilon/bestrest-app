/**
 * inventoryUtils.ts
 * Utility functions for parsing/generating inventory CSV files.
 */

export interface InventoryCSVRow {
    name: string;
    category: string;
    quantity: number;
    unit: string;
    price: number;
    supplier: string;
}

/**
 * Parse a CSV string into InventoryCSVRow objects.
 * Expected headers (order-insensitive, case-insensitive):
 *   name, category, quantity, unit, price, supplier
 */
export function parseInventoryCSV(csvText: string): InventoryCSVRow[] {
    const lines = csvText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    if (lines.length < 2) return [];

    // Detect delimiter
    const delim = lines[0].includes('\t') ? '\t' : ',';

    const rawHeaders = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/"/g, ''));

    const colIndex = (names: string[]) => {
        for (const n of names) {
            const i = rawHeaders.indexOf(n);
            if (i !== -1) return i;
        }
        return -1;
    };

    const nameIdx = colIndex(['name', 'שם', 'מוצר']);
    const categoryIdx = colIndex(['category', 'קטגוריה']);
    const quantityIdx = colIndex(['quantity', 'כמות']);
    const unitIdx = colIndex(['unit', 'יחידה', 'יחידת מידה']);
    const priceIdx = colIndex(['price', 'מחיר', 'lastprice']);
    const supplierIdx = colIndex(['supplier', 'ספק']);

    if (nameIdx === -1) return []; // name is mandatory

    const results: InventoryCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = splitCSVLine(lines[i], delim);
        const name = cells[nameIdx]?.trim().replace(/"/g, '');
        if (!name) continue;

        results.push({
            name,
            category: cells[categoryIdx]?.trim().replace(/"/g, '') || 'כללי',
            quantity: parseFloat(cells[quantityIdx]?.replace(/"/g, '') || '0') || 0,
            unit: cells[unitIdx]?.trim().replace(/"/g, '') || 'יחידה',
            price: parseFloat(cells[priceIdx]?.replace(/"/g, '') || '0') || 0,
            supplier: cells[supplierIdx]?.trim().replace(/"/g, '') || '',
        });
    }

    return results;
}

/** Handle quoted cells that may contain the delimiter character */
function splitCSVLine(line: string, delim: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === delim && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

/**
 * Convert an array of inventory items to a CSV download string.
 */
export function exportInventoryToCSV(items: any[]): string {
    const headers = ['name', 'category', 'quantity', 'unit', 'price', 'supplier', 'aliases'];
    const rows = items.map(item => [
        csvEscape(item.name || ''),
        csvEscape(item.category || ''),
        item.quantity ?? 0,
        csvEscape(item.unit || ''),
        item.lastPrice ?? 0,
        csvEscape(item.supplier || ''),
        csvEscape((item.aliases || []).join('; ')),
    ]);

    const lines = [headers.join(','), ...rows.map(r => r.join(','))];
    return lines.join('\n');
}

function csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
