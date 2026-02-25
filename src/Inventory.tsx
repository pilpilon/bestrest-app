import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Package, Plus, Search, Upload, Download, Trash2, Edit3, X, Save,
    AlertTriangle, TrendingUp, TrendingDown, Tag, Loader2, GitMerge,
} from 'lucide-react';
import {
    collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { parseInventoryCSV, exportInventoryToCSV } from './utils/inventoryUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InventoryItem {
    id: string;
    name: string;
    category: string;
    aliases: string[];
    quantity: number;
    unit: string;
    lastPrice: number;
    previousPrice: number;
    supplier: string;
    lastDate: string;
    minStock?: number;
    updatedAt?: any;
}

interface ItemModalProps {
    item: Partial<InventoryItem> | null;
    allCategories: string[];
    allSuppliers: string[];
    onClose: () => void;
    onSave: (data: Partial<InventoryItem>) => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
    'חומרי גלם', 'שתייה', 'אלכוהול', 'ציוד', 'תחזוקה', 'כללי',
];

const CATEGORY_COLORS: Record<string, string> = {
    'חומרי גלם': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'שתייה': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'אלכוהול': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'ציוד': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'תחזוקה': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'כללי': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const CATEGORY_DOT: Record<string, string> = {
    'חומרי גלם': '#10b981',
    'שתייה': '#3b82f6',
    'אלכוהול': '#a855f7',
    'ציוד': '#f97316',
    'תחזוקה': '#eab308',
    'כללי': '#64748b',
};

const UNITS = ['"ק"ג', 'גרם', 'ליטר', '"מ"ל', 'יחידה', 'קופסה', 'בקבוק', 'שקית', 'כוס', 'חבילה'];

function getCategoryColor(category: string) {
    return CATEGORY_COLORS[category] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

function getCategoryDot(category: string) {
    return CATEGORY_DOT[category] || '#64748b';
}

// ─── Item Modal ───────────────────────────────────────────────────────────────

function ItemModal({ item, allCategories, allSuppliers, onClose, onSave }: ItemModalProps) {
    const isNew = !item?.id;
    const [form, setForm] = useState({
        name: item?.name || '',
        category: item?.category || 'כללי',
        quantity: item?.quantity?.toString() || '0',
        unit: item?.unit || 'יחידה',
        lastPrice: item?.lastPrice?.toString() || '0',
        supplier: item?.supplier || '',
        minStock: item?.minStock?.toString() || '1',
        aliases: (item?.aliases || []).join(', '),
        newCategory: '',
    });
    const [saving, setSaving] = useState(false);
    const [showNewCat, setShowNewCat] = useState(false);

    const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [field]: e.target.value }));

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            const category = showNewCat && form.newCategory.trim() ? form.newCategory.trim() : form.category;
            const aliasArr = form.aliases
                .split(',')
                .map(a => a.trim().toLowerCase())
                .filter(Boolean);
            await onSave({
                ...item,
                name: form.name.trim(),
                category,
                quantity: parseFloat(form.quantity) || 0,
                unit: form.unit,
                lastPrice: parseFloat(form.lastPrice) || 0,
                supplier: form.supplier.trim(),
                minStock: parseFloat(form.minStock) || 1,
                aliases: aliasArr,
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const inputCls = "w-full bg-slate-900/70 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[var(--color-primary)] outline-none transition-colors text-sm";
    const labelCls = "text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5";

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4 font-display" onClick={onClose}>
            <div
                className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col"
                style={{ maxHeight: 'calc(100vh - 100px)' }}
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5 flex-shrink-0">
                    <h2 className="text-xl font-black flex items-center gap-3">
                        <Package className="w-5 h-5 text-[var(--color-primary)]" />
                        {isNew ? 'הוסף מוצר חדש' : 'עריכת מוצר'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {/* Name */}
                    <div>
                        <label className={labelCls}>שם המוצר *</label>
                        <input className={inputCls} value={form.name} onChange={set('name')} placeholder="לדוגמה: עגבניות טריות" autoFocus />
                    </div>

                    {/* Category */}
                    <div>
                        <label className={labelCls}>קטגוריה</label>
                        <div className="flex gap-2">
                            <select className={`flex-1 ${inputCls}`} value={form.category} onChange={set('category')}>
                                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowNewCat(p => !p)}
                                className="px-3 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-[var(--color-primary)] transition-colors whitespace-nowrap"
                            >
                                + חדש
                            </button>
                        </div>
                        {showNewCat && (
                            <input
                                className={`mt-2 ${inputCls}`}
                                value={form.newCategory}
                                onChange={set('newCategory')}
                                placeholder="שם קטגוריה חדשה..."
                            />
                        )}
                    </div>

                    {/* Quantity + Unit */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>כמות במלאי</label>
                            <input className={inputCls} type="number" value={form.quantity} onChange={set('quantity')} min="0" step="0.1" dir="ltr" />
                        </div>
                        <div>
                            <label className={labelCls}>יחידת מידה</label>
                            <select className={inputCls} value={form.unit} onChange={set('unit')}>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Price + Supplier */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>מחיר אחרון (₪) ל-{form.unit}</label>
                            <input className={inputCls} type="number" value={form.lastPrice} onChange={set('lastPrice')} min="0" step="0.01" dir="ltr" />
                        </div>
                        <div>
                            <label className={labelCls}>ספק</label>
                            <input className={inputCls} list="suppliers-list" value={form.supplier} onChange={set('supplier')} placeholder="שם הספק..." />
                            <datalist id="suppliers-list">
                                {allSuppliers.map(s => <option key={s} value={s} />)}
                            </datalist>
                        </div>
                    </div>

                    {/* Min stock threshold */}
                    <div>
                        <label className={labelCls}>רף מלאי מינימלי (התראה)</label>
                        <input className={inputCls} type="number" value={form.minStock} onChange={set('minStock')} min="0" step="1" dir="ltr" />
                    </div>

                    {/* Aliases */}
                    <div>
                        <label className={labelCls}>שמות נרדפים / Aliases (מופרדים בפסיקים)</label>
                        <input className={inputCls} value={form.aliases} onChange={set('aliases')} placeholder="עגבניה, tomatoes, עגבניות שרי..." />
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">ה-AI ישדך מרכיבי מתכון לפי שמות אלה</p>
                    </div>
                </div>

                {/* Save button - always visible, not scrolled away */}
                <div className="px-6 pb-6 pt-4 border-t border-white/5 flex-shrink-0 bg-[#0f172a]">
                    <button
                        onClick={handleSave}
                        disabled={saving || !form.name.trim()}
                        className="w-full bg-[var(--color-primary)] text-slate-900 font-black py-4 rounded-xl hover:brightness-110 shadow-[0_0_15px_rgba(13,242,128,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'שומר...' : 'שמור מוצר'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
// Fully clickable card that opens the edit modal on tap (mobile-friendly)

function ProductCard({
    item,
    onEdit,
    onDelete,
}: {
    item: InventoryItem;
    onEdit: (item: InventoryItem) => void;
    onDelete: (item: InventoryItem) => void;
}) {
    const minStock = item.minStock ?? 1;
    const isLowStock = item.quantity <= minStock;
    const priceDelta = item.lastPrice && item.previousPrice
        ? ((item.lastPrice - item.previousPrice) / (item.previousPrice || 1)) * 100
        : 0;
    const catColor = getCategoryColor(item.category);
    const dotColor = getCategoryDot(item.category);

    return (
        <div
            className={`relative bg-white/5 backdrop-blur-md border rounded-2xl p-4 transition-all active:scale-[0.97] cursor-pointer ${isLowStock ? 'border-red-500/40' : 'border-white/10'}`}
            onClick={() => onEdit(item)}
        >
            {/* Top row: category chip + delete button */}
            <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${catColor}`}>
                    {item.category}
                </span>
                <button
                    onClick={e => { e.stopPropagation(); onDelete(item); }}
                    className="p-1.5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all text-[var(--color-text-muted)]"
                    aria-label="מחק מוצר"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Low-stock badge */}
            {isLowStock && (
                <div className="flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse w-fit mb-2">
                    <AlertTriangle className="w-2.5 h-2.5" /> מלאי נמוך
                </div>
            )}

            {/* Product name */}
            <div className="flex items-start gap-2 mb-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: dotColor }} />
                <p className="font-bold text-white text-sm leading-tight break-words min-w-0">{item.name}</p>
            </div>

            {/* Quantity */}
            <div className="bg-slate-900/60 rounded-xl p-2.5 mb-2 flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-text-muted)]">כמות</span>
                <span className={`font-black text-base ${isLowStock ? 'text-red-400' : 'text-white'}`}>
                    {item.quantity} <span className="text-xs font-normal text-[var(--color-text-muted)]">{item.unit}</span>
                </span>
            </div>

            {/* Price row */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[80px]">
                    {item.supplier || item.lastDate || ''}
                </span>
                <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm font-bold text-[var(--color-primary)]">₪{item.lastPrice?.toFixed(2)}</span>
                    {Math.abs(priceDelta) >= 2 && (
                        <span className={`text-[9px] font-bold flex items-center gap-0.5 ${priceDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {priceDelta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            {Math.abs(priceDelta).toFixed(1)}%
                        </span>
                    )}
                </div>
            </div>

            {/* Edit hint */}
            <div className="flex items-center justify-center gap-1 mt-2 text-[9px] text-[var(--color-text-muted)] opacity-60">
                <Edit3 className="w-2.5 h-2.5" />
                לחץ לעריכה
            </div>
        </div>
    );
}

// ─── Main Inventory Screen ────────────────────────────────────────────────────

// ── Levenshtein distance for duplicate detection ────────────────────────────
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

export function Inventory() {
    const { businessId } = useAuth();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('הכל');
    const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [mergeTarget, setMergeTarget] = useState<{ keep: InventoryItem; remove: InventoryItem } | null>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);

    // ── Firestore subscription ──────────────────────────────────────────────────
    useEffect(() => {
        if (!businessId) return;
        const ref = collection(db, 'businesses', businessId, 'inventory');
        const unsub = onSnapshot(ref, snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
            setItems(docs.sort((a, b) => a.name.localeCompare(b.name, 'he')));
            setLoading(false);
        });
        return () => unsub();
    }, [businessId]);

    const notify = useCallback((type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 4000);
    }, []);

    const EXCLUDED_CATEGORIES = ['חשמל / מים / גז', 'שכירות', 'עובדים', 'חשבונות'];
    const EXCLUDED_KEYWORDS = [
        'חשמל', 'פזגז', 'סופרגז', 'אמישראגז', 'גז עמר', 'שכירות', 'ארנונה',
        'עיריית', 'תאגיד מים', 'מי אביבים', 'הגיחון', 'מי כרמל', 'מי שבע',
        'משכורת', 'ביטוח', 'רואה חשבון', 'מס הכנסה', 'מע"מ'
    ];

    const validItems = items.filter(i => {
        if (EXCLUDED_CATEGORIES.includes(i.category)) return false;
        const name = i.name || '';
        if (EXCLUDED_KEYWORDS.some(kw => name.includes(kw))) return false;
        return true;
    });

    // ── All categories (built from data + defaults) ─────────────────────────────
    const allCategories: string[] = Array.from(
        new Set([...DEFAULT_CATEGORIES, ...validItems.map(i => i.category)])
    );

    const allSuppliers: string[] = Array.from(
        new Set(validItems.map(i => i.supplier).filter(Boolean))
    );

    // ── Filtered items ──────────────────────────────────────────────────────────
    const filteredItems = validItems.filter(item => {
        const matchesSearch =
            !search ||
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            (item.aliases || []).some(a => a.includes(search.toLowerCase())) ||
            (item.supplier || '').toLowerCase().includes(search.toLowerCase());
        const matchesCat = activeCategory === 'הכל' || item.category === activeCategory;
        return matchesSearch && matchesCat;
    });

    // ── KPIs ───────────────────────────────────────────────────────────────────
    const totalSKU = validItems.length;
    const lowStockCount = validItems.filter(i => i.quantity <= (i.minStock ?? 1)).length;
    const inventoryValue = validItems.reduce((sum, i) => sum + (i.quantity || 0) * (i.lastPrice || 0), 0);

    // ── Duplicate detection (Levenshtein distance <= 3 on normalized names) ────
    const duplicateGroups: Array<[InventoryItem, InventoryItem]> = [];
    const seenPairs = new Set<string>();
    for (let i = 0; i < validItems.length; i++) {
        for (let j = i + 1; j < validItems.length; j++) {
            const a = validItems[i].name.trim().toLowerCase();
            const b = validItems[j].name.trim().toLowerCase();
            const pairKey = [validItems[i].id, validItems[j].id].sort().join('|');
            if (!seenPairs.has(pairKey) && levenshtein(a, b) <= 3 && Math.abs(a.length - b.length) <= 5) {
                duplicateGroups.push([validItems[i], validItems[j]]);
                seenPairs.add(pairKey);
            }
        }
    }

    // ── Merge: keep item A, delete item B, merge aliases ────────────────────
    const handleMerge = async (keep: InventoryItem, remove: InventoryItem) => {
        if (!businessId) return;
        try {
            const mergedAliases = Array.from(new Set([
                ...(keep.aliases || []),
                ...(remove.aliases || []),
                remove.name.toLowerCase().trim(),
            ]));
            const keepRef = doc(db, 'businesses', businessId, 'inventory', keep.id);
            await setDoc(keepRef, { aliases: mergedAliases }, { merge: true });
            await deleteDoc(doc(db, 'businesses', businessId, 'inventory', remove.id));
            setMergeTarget(null);
            notify('success', `מוזג: "${remove.name}" אל "${keep.name}"`);
        } catch {
            notify('error', 'שגיאה במיזוג המוצרים');
        }
    };

    // ── Save item ──────────────────────────────────────────────────────────────
    const handleSave = async (data: Partial<InventoryItem>) => {
        if (!businessId) return;
        try {
            const isNew = !data.id;
            let ref;
            if (isNew) {
                ref = doc(collection(db, 'businesses', businessId, 'inventory'));
            } else {
                ref = doc(db, 'businesses', businessId, 'inventory', data.id!);
            }
            await setDoc(ref, {
                ...data,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            setShowModal(false);
            setEditingItem(null);
            notify('success', isNew ? 'מוצר חדש נוסף למלאי' : 'המוצר עודכן בהצלחה');
        } catch {
            notify('error', 'שגיאה בשמירת המוצר');
        }
    };


    // ── Delete item ─────────────────────────────────────────────────────────────
    const handleDelete = async (item: InventoryItem) => {
        if (!businessId) return;
        try {
            await deleteDoc(doc(db, 'businesses', businessId, 'inventory', item.id));
            setDeleteConfirm(null);
            notify('success', 'המוצר נמחק מהמלאי');
        } catch {
            notify('error', 'שגיאה במחיקת המוצר');
        }
    };

    // ── Delete Custom Category ──────────────────────────────────────────────────
    const handleDeleteCategory = async (categoryToDelete: string) => {
        if (!businessId || !window.confirm(`האם אתה בטוח שברצונך למחוק את הקטגוריה "${categoryToDelete}"? כל המוצרים תחתיה יועברו ל"כללי".`)) return;

        try {
            const itemsToUpdate = items.filter(i => i.category === categoryToDelete);
            for (const item of itemsToUpdate) {
                const ref = doc(db, 'businesses', businessId, 'inventory', item.id);
                await setDoc(ref, { category: 'כללי' }, { merge: true });
            }
            setActiveCategory('הכל');
            notify('success', 'הקטגוריה נמחקה והמוצרים הועברו ל"כללי"');
        } catch (err) {
            notify('error', 'שגיאה במחיקת הקטגוריה');
        }
    };

    // ── CSV Import ─────────────────────────────────────────────────────────────
    const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !businessId) return;
        setImporting(true);
        try {
            const text = await file.text();
            const rows = parseInventoryCSV(text);
            if (rows.length === 0) { notify('error', 'לא נמצאו שורות תקינות בקובץ'); return; }
            let count = 0;
            for (const row of rows) {
                const itemId = row.name.trim().replace(/[\s/.\\]+/g, '_').toLowerCase();
                await setDoc(
                    doc(db, 'businesses', businessId, 'inventory', itemId),
                    { name: row.name, category: row.category, quantity: row.quantity, unit: row.unit, lastPrice: row.price, previousPrice: row.price, supplier: row.supplier, aliases: [], updatedAt: serverTimestamp() },
                    { merge: true }
                );
                count++;
            }
            notify('success', `יובאו ${count} מוצרים בהצלחה ✓`);
        } catch (err) {
            console.error('CSV import error:', err);
            notify('error', 'שגיאה בייבוא הקובץ. ודא שהפורמט תקין.');
        } finally {
            setImporting(false);
            if (csvInputRef.current) csvInputRef.current.value = '';
        }
    };

    // ── CSV Export ─────────────────────────────────────────────────────────────
    const handleCSVExport = () => {
        if (items.length === 0) { notify('error', 'אין מוצרים לייצוא'); return; }
        const csv = exportInventoryToCSV(items);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        notify('success', 'קובץ CSV יוצא בהצלחה ✓');
    };

    // ─── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6" dir="rtl">

            {/* Notification toast */}
            {notification && (
                <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full border backdrop-blur-md shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'success' ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/50 text-[var(--color-primary)]' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${notification.type === 'success' ? 'bg-[var(--color-primary)]' : 'bg-red-400'}`} />
                    <span className="text-sm font-bold">{notification.message}</span>
                </div>
            )}

            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-3">
                        <Package className="w-6 h-6 text-[var(--color-primary)]" />
                        ניהול מלאי
                    </h1>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">מוצרים, כמויות, ומחירים בזמן אמת</p>
                </div>
                <div className="flex items-center gap-2">
                    <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVImport} />
                    <button
                        onClick={() => csvInputRef.current?.click()}
                        disabled={importing}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-all"
                    >
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span className="hidden sm:inline">ייבא CSV</span>
                    </button>
                    <button
                        onClick={handleCSVExport}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-all"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">ייצא</span>
                    </button>
                    <button
                        onClick={() => { setEditingItem({}); setShowModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-slate-900 rounded-xl font-bold text-sm hover:brightness-110 shadow-[0_0_12px_rgba(13,242,128,0.3)] transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>מוצר</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">סה״כ מוצרים</p>
                    <p className="text-2xl font-black">{totalSKU}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">SKU פעילים</p>
                </div>
                <div className={`backdrop-blur-md border rounded-2xl p-4 ${lowStockCount > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">מלאי נמוך</p>
                    <p className={`text-2xl font-black ${lowStockCount > 0 ? 'text-red-400' : ''}`}>{lowStockCount}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">דורשים חידוש</p>
                </div>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">שווי מלאי</p>
                    <p className="text-xl font-black text-[var(--color-primary)]">₪{inventoryValue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">כמות × מחיר</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="חיפוש מוצר, ספק, שם נרדף..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pr-11 pl-4 text-sm focus:border-[var(--color-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)]"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {['הכל', ...allCategories].map(cat => {
                    const count = cat === 'הכל' ? validItems.length : validItems.filter(i => i.category === cat).length;
                    const isActive = activeCategory === cat;
                    return (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isActive
                                ? 'bg-[var(--color-primary)] text-slate-900 border-[var(--color-primary)] shadow-[0_0_10px_rgba(13,242,128,0.3)]'
                                : 'bg-white/5 text-[var(--color-text-muted)] border-white/10 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {cat !== 'הכל' && (
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: isActive ? '#0f172a' : getCategoryDot(cat) }}
                                />
                            )}
                            {cat}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${isActive ? 'bg-slate-900/30' : 'bg-white/10'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Delete Custom Category Action */}
            {activeCategory !== 'הכל' && !DEFAULT_CATEGORIES.includes(activeCategory) && (
                <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-2xl animate-in fade-in">
                    <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
                        <Tag className="w-4 h-4 text-[var(--color-primary)]" />
                        <span>קטגוריה מותאמת אישית: <strong className="text-white">{activeCategory}</strong></span>
                    </p>
                    <button
                        onClick={() => handleDeleteCategory(activeCategory)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[10px] font-bold transition-all"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        מחק קטגוריה
                    </button>
                </div>
            )}

            {/* Items Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10">
                        <Package className="w-10 h-10 text-[var(--color-text-muted)]" />
                    </div>
                    <div>
                        <p className="font-bold text-lg">{search ? 'לא נמצאו מוצרים' : 'המלאי ריק'}</p>
                        <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            {search ? 'נסה חיפוש אחר' : 'הוסף מוצר ראשון או ייבא CSV'}
                        </p>
                    </div>
                    {!search && (
                        <button
                            onClick={() => { setEditingItem({}); setShowModal(true); }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 rounded-xl font-bold text-sm hover:bg-[var(--color-primary)]/20 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            הוסף מוצר ראשון
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <p className="text-xs text-[var(--color-text-muted)]">{filteredItems.length} מוצרים</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredItems.map(item => (
                            deleteConfirm === item.id ? (
                                <div key={item.id} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 text-center min-h-[160px]">
                                    <p className="text-sm font-bold text-red-400">מחק את "{item.name}"?</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDelete(item)}
                                            className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold hover:bg-red-500/30 transition-colors"
                                        >
                                            אשר מחיקה
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(null)}
                                            className="px-3 py-1.5 bg-white/5 text-white border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors"
                                        >
                                            ביטול
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <ProductCard
                                    key={item.id}
                                    item={item}
                                    onEdit={(i) => { setEditingItem(i); setShowModal(true); }}
                                    onDelete={(i) => setDeleteConfirm(i.id)}
                                />
                            )
                        ))}
                    </div>
                </>
            )}
            {/* Duplicate Detection Panel */}
            {duplicateGroups.length > 0 && !search && activeCategory === 'הכל' && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <GitMerge className="w-4 h-4 text-yellow-400" />
                        <p className="text-xs font-bold text-yellow-400">זוהו {duplicateGroups.length} מוצרים דומים שאולי כפולים</p>
                    </div>
                    {duplicateGroups.map(([a, b], idx) => (
                        <div key={idx} className="bg-white/5 rounded-xl p-3 space-y-2">
                            <div className="flex flex-col gap-1">
                                <p className="text-xs text-[var(--color-text-muted)]">מוצרים דומים:</p>
                                <p className="text-sm font-bold text-white">{a.name}</p>
                                <p className="text-xs text-[var(--color-text-muted)]">↕</p>
                                <p className="text-sm font-bold text-white">{b.name}</p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setMergeTarget({ keep: a, remove: b })}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 rounded-lg text-[10px] font-bold hover:bg-[var(--color-primary)]/20 transition-all"
                                >
                                    <GitMerge className="w-3 h-3" />
                                    השאר "{a.name}", מחק "{b.name}"
                                </button>
                                <button
                                    onClick={() => setMergeTarget({ keep: b, remove: a })}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-white/5 text-[var(--color-text-muted)] border border-white/10 rounded-lg text-[10px] font-bold hover:bg-white/10 transition-all"
                                >
                                    <GitMerge className="w-3 h-3" />
                                    השאר "{b.name}", מחק "{a.name}"
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Merge Confirmation Modal */}
            {mergeTarget && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setMergeTarget(null)}>
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" dir="rtl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black flex items-center gap-2">
                            <GitMerge className="w-5 h-5 text-[var(--color-primary)]" />
                            אישור מיזוג
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            המוצר <strong className="text-white">"{mergeTarget.remove.name}"</strong> יימחק, ושמו יתווסף כ-alias למוצר <strong className="text-white">"{mergeTarget.keep.name}"</strong>.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleMerge(mergeTarget.keep, mergeTarget.remove)}
                                className="flex-1 bg-[var(--color-primary)] text-slate-900 font-black py-3 rounded-xl text-sm hover:brightness-110 transition-all"
                            >
                                אשר מיזוג
                            </button>
                            <button
                                onClick={() => setMergeTarget(null)}
                                className="flex-1 bg-white/5 text-white border border-white/10 font-bold py-3 rounded-xl text-sm hover:bg-white/10 transition-all"
                            >
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Item Modal */}
            {showModal && (
                <ItemModal
                    item={editingItem}
                    allCategories={allCategories}
                    allSuppliers={allSuppliers}
                    onClose={() => { setShowModal(false); setEditingItem(null); }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}

// ─── Inventory Picker (for RecipeBuilder) ─────────────────────────────────────

export interface InventoryPickerItem {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    lastPrice: number;
}

interface InventoryPickerProps {
    businessId: string | null;
    value: string;
    onChange: (val: string) => void;
    onSelect: (item: InventoryPickerItem) => void;
    onAdd: () => void;
    placeholder?: string;
}

export function InventoryPicker({
    businessId,
    value,
    onChange,
    onSelect,
    onAdd,
    placeholder = 'חפש מוצר מהמלאי...',
}: InventoryPickerProps) {
    const [allItems, setAllItems] = useState<InventoryPickerItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!businessId) return;
        const ref = collection(db, 'businesses', businessId, 'inventory');
        const unsub = onSnapshot(ref, snap => {
            setAllItems(snap.docs.map(d => {
                const data = d.data();
                return { id: d.id, name: data.name, unit: data.unit || 'יחידה', quantity: data.quantity || 0, lastPrice: data.lastPrice || 0 };
            }));
        });
        return () => unsub();
    }, [businessId]);

    const results = value.length >= 1
        ? allItems.filter(i =>
            i.name.toLowerCase().includes(value.toLowerCase()) ||
            i.id.includes(value.toLowerCase())
        ).slice(0, 8)
        : [];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (results.length === 1) {
                onSelect(results[0]);
                onChange('');
                setIsOpen(false);
            } else {
                onAdd();
                onChange('');
                setIsOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div ref={wrapperRef} className="relative flex-1">
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={e => { onChange(e.target.value); setIsOpen(true); }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pr-4 pl-12 text-sm focus:border-purple-500/50 outline-none transition-colors placeholder:text-gray-600 text-white"
            />

            {isOpen && value.length >= 1 && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {results.length > 0 ? (
                        <>
                            <div className="px-3 py-2 border-b border-white/5">
                                <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">מהמלאי שלך</p>
                            </div>
                            {results.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => { onSelect(item); onChange(''); setIsOpen(false); }}
                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 text-right transition-colors border-b border-white/5 last:border-0"
                                >
                                    <div>
                                        <p className="text-sm font-bold text-white">{item.name}</p>
                                        <p className="text-[9px] text-[var(--color-text-muted)]">
                                            במלאי: <span className={item.quantity <= 1 ? 'text-red-400' : 'text-[var(--color-primary)]'}>{item.quantity} {item.unit}</span>
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-[var(--color-primary)] ml-2 flex-shrink-0">₪{item.lastPrice?.toFixed(2)}</span>
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => { onAdd(); onChange(''); setIsOpen(false); }}
                                className="w-full px-3 py-2 text-xs text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 text-right transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-3 h-3" />
                                הוסף "{value}" עם הערכת AI
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { onAdd(); onChange(''); setIsOpen(false); }}
                            className="w-full px-3 py-3 text-sm text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 text-right transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-3 h-3 text-[var(--color-primary)]" />
                            <span>הוסף <strong className="text-white">"{value}"</strong> (הערכת AI)</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
