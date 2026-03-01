import { useState, useMemo, useEffect } from 'react';
import {
    BarChart3,
    Store,
    TrendingUp,
    PieChart as PieChartIcon,
    Calendar,
    Receipt,
    ChevronRight,
    Filter,
    Calculator
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    AreaChart,
    Area
} from 'recharts';

interface LineItem {
    name: string;
    pricePerUnit: number;
    quantity: number;
    total: number;
}

interface Expense {
    id: string;
    supplier: string;
    category: string;
    total: number;
    date: string;
    lineItems?: LineItem[];
    imageUrl?: string;
    isSent?: boolean;
    createdAt: any;
}

interface ReportsProps {
    expenses: Expense[];
    initialSection?: 'expenses' | 'suppliers' | null;
}

const PIE_COLORS = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export function Reports({ expenses, initialSection }: ReportsProps) {
    const [activeTab, setActiveTab] = useState<'expenses' | 'suppliers' | 'prime-cost'>(initialSection || 'expenses');
    const [timeFilter, setTimeFilter] = useState<'month' | 'quarter' | 'year' | 'all'>('all');
    const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);



    // Sync initialSection prop to state when it changes
    useEffect(() => {
        if (initialSection) {
            setActiveTab(initialSection);
            setSelectedSupplier(null); // Reset drill-down when tab changes via prop
        }
    }, [initialSection]);

    // Filter expenses by time
    const filteredExpenses = useMemo(() => {
        if (timeFilter === 'all') return expenses;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return expenses.filter(exp => {
            if (!exp.createdAt?.toDate) return true; // Fallback if no date 
            const d = exp.createdAt.toDate();

            switch (timeFilter) {
                case 'month':
                    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                case 'quarter':
                    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
                    return d.getMonth() >= quarterStartMonth && d.getMonth() < quarterStartMonth + 3 && d.getFullYear() === currentYear;
                case 'year':
                    return d.getFullYear() === currentYear;
                default:
                    return true;
            }
        });
    }, [expenses, timeFilter]);

    // Prime Cost State
    const [primeRevenue, setPrimeRevenue] = useState<string>('');
    const [primeLabor, setPrimeLabor] = useState<string>('');
    const [foodCostInput, setFoodCostInput] = useState<string>('0');

    // Default food cost is sum of expenses
    const currentTotalExpenses = useMemo(() => {
        return filteredExpenses.reduce((sum, e) => sum + (e.total || 0), 0);
    }, [filteredExpenses]);

    // Initialize/Sync foodCostInput when expenses change
    useEffect(() => {
        setFoodCostInput(currentTotalExpenses.toString());
    }, [currentTotalExpenses]);

    const rev = parseFloat(primeRevenue) || 0;
    const fc = parseFloat(foodCostInput) || 0;
    const lc = parseFloat(primeLabor) || 0;
    const totalPc = fc + lc;
    const primeCostPercent = rev > 0 ? (totalPc / rev) * 100 : 0;
    const isCalculated = rev > 0 && totalPc > 0;

    // --- Expenses Analytics Data ---

    // 1. Category Breakdown
    const categoryData = useMemo(() => {
        const totals = filteredExpenses.reduce((acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + (exp.total || 0);
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(totals)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredExpenses]);

    // 2. Trend over time (group by month-year)
    const trendData = useMemo(() => {
        const monthlyTotals = filteredExpenses.reduce((acc, exp) => {
            if (!exp.createdAt?.toDate) return acc;
            const d = exp.createdAt.toDate();
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            acc[key] = (acc[key] || 0) + (exp.total || 0);
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(monthlyTotals)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([date, total]) => {
                const [year, month] = date.split('-');
                return { date: `${month}/${year.slice(2)}`, total };
            });
    }, [filteredExpenses]);

    // 3. Supplier Comparison
    const supplierComparisonData = useMemo(() => {
        const totals = filteredExpenses.reduce((acc, exp) => {
            if (!exp.supplier) return acc;
            acc[exp.supplier] = (acc[exp.supplier] || 0) + (exp.total || 0);
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(totals)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10); // Top 10
    }, [filteredExpenses]);

    // 4. Top Items
    const topItems = useMemo(() => {
        // Use normalized (lowercase trim) name as map key to merge OCR variants of the same item
        const itemsMapByKey = new Map<string, { displayName: string; quantity: number; amount: number; supplier: string }>();
        filteredExpenses.forEach(exp => {
            if (exp.lineItems) {
                exp.lineItems.forEach(item => {
                    if (!item.name) return;
                    const key = item.name.trim().toLowerCase();
                    const current = itemsMapByKey.get(key) || { displayName: item.name.trim(), quantity: 0, amount: 0, supplier: exp.supplier };
                    itemsMapByKey.set(key, {
                        displayName: current.displayName, // keep first observed display name
                        quantity: current.quantity + (item.quantity || 1),
                        amount: current.amount + (item.total || (item.pricePerUnit * (item.quantity || 1)) || 0),
                        supplier: current.supplier
                    });
                });
            }
        });

        return Array.from(itemsMapByKey.values())
            .map(({ displayName, quantity, amount, supplier }) => ({ name: displayName, quantity, amount, supplier }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5); // Top 5 items
    }, [filteredExpenses]);


    // --- Suppliers Analytics Data ---

    const suppliersList = useMemo(() => {
        const suppliersMap = new Map<string, {
            name: string;
            totalSpent: number;
            receiptCount: number;
            categories: Set<string>;
            lastReceiptDate: Date | null;
            expenses: Expense[];
        }>();

        filteredExpenses.forEach(exp => {
            if (!exp.supplier) return;
            const current = suppliersMap.get(exp.supplier) || {
                name: exp.supplier,
                totalSpent: 0,
                receiptCount: 0,
                categories: new Set(),
                lastReceiptDate: null,
                expenses: []
            };

            const expDate = exp.createdAt?.toDate ? exp.createdAt.toDate() : null;
            const isNewerDate = expDate && (!current.lastReceiptDate || expDate > current.lastReceiptDate);

            current.totalSpent += (exp.total || 0);
            current.receiptCount += 1;
            if (exp.category) current.categories.add(exp.category);
            if (isNewerDate) current.lastReceiptDate = expDate;
            current.expenses.push(exp);

            suppliersMap.set(exp.supplier, current);
        });

        return Array.from(suppliersMap.values())
            .sort((a, b) => b.totalSpent - a.totalSpent);
    }, [filteredExpenses]);

    const selectedSupplierData = useMemo(() => {
        if (!selectedSupplier) return null;
        return suppliersList.find(s => s.name === selectedSupplier) || null;
    }, [selectedSupplier, suppliersList]);


    // Custom Tooltip for charts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#1E293B] border border-white/10 p-3 rounded-xl shadow-xl">
                    <p className="font-bold text-white mb-1">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm" style={{ color: entry.color || entry.fill }}>
                            {entry.name}: ₪{entry.value.toLocaleString()}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">

            {/* Header Tabs */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-6 backdrop-blur-md">
                <button
                    onClick={() => { setActiveTab('expenses'); setSelectedSupplier(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'expenses'
                        ? 'bg-[var(--color-primary)] text-slate-900 shadow-[0_0_15px_rgba(13,242,128,0.3)]'
                        : 'text-[var(--color-text-muted)] hover:bg-white/5 hover:text-white'
                        }`}
                >
                    <BarChart3 className="w-5 h-5" />
                    הוצאות
                </button>
                <button
                    onClick={() => setActiveTab('suppliers')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'suppliers'
                        ? 'bg-[var(--color-primary)] text-slate-900 shadow-[0_0_15px_rgba(13,242,128,0.3)]'
                        : 'text-[var(--color-text-muted)] hover:bg-white/5 hover:text-white'
                        }`}
                >
                    <Store className="w-5 h-5" />
                    ספקים
                </button>
                <button
                    onClick={() => { setActiveTab('prime-cost'); setSelectedSupplier(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'prime-cost'
                        ? 'bg-[var(--color-primary)] text-slate-900 shadow-[0_0_15px_rgba(13,242,128,0.3)]'
                        : 'text-[var(--color-text-muted)] hover:bg-white/5 hover:text-white'
                        }`}
                >
                    <Calculator className="w-5 h-5" />
                    Prime Cost
                </button>
            </div>

            {/* Global Time Filter */}
            {!selectedSupplier && activeTab !== 'prime-cost' && (
                <div className="flex items-center justify-between mb-6 bg-white/5 p-2 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 px-2 text-[var(--color-text-muted)] text-sm font-bold flex-shrink-0">
                        <Filter className="w-4 h-4" /> סינון:
                    </div>
                    <div className="flex flex-nowrap gap-2">
                        {[
                            { id: 'all', label: 'כל הזמן' },
                            { id: 'year', label: 'השנה' },
                            { id: 'quarter', label: 'רבעון נוכחי' },
                            { id: 'month', label: 'חודש נוכחי' }
                        ].map(filter => (
                            <button
                                key={filter.id}
                                onClick={() => setTimeFilter(filter.id as any)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${timeFilter === filter.id
                                    ? 'bg-white/20 text-white'
                                    : 'text-[var(--color-text-muted)] hover:bg-white/10'
                                    }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* --- EXPENSES TAB --- */}
            {activeTab === 'expenses' && (
                <div className="space-y-6 pb-20">

                    {/* Top Level KPIs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold mb-1">סה״כ הוצאות</p>
                            <h3 className="text-2xl font-black text-white">
                                ₪{filteredExpenses.reduce((s, e) => s + (e.total || 0), 0).toLocaleString()}
                            </h3>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold mb-1">כמות חשבוניות</p>
                            <h3 className="text-2xl font-black text-white">
                                {filteredExpenses.length}
                            </h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Trend Chart */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 h-80 flex flex-col">
                            <h3 className="font-bold flex items-center gap-2 mb-4">
                                <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" /> מגמת הוצאות (חודשית)
                            </h3>
                            <div className="flex-1 min-h-0">
                                {trendData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData}>
                                            <defs>
                                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} axisLine={false} tickLine={false} />
                                            <YAxis stroke="#94A3B8" fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => `₪${v}`} width={50} />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Area type="monotone" dataKey="total" name="סה״כ" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-muted)]">אין נתונים לתקופה זו</div>
                                )}
                            </div>
                        </div>

                        {/* Category Chart */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 h-80 flex flex-col">
                            <h3 className="font-bold flex items-center gap-2 mb-4">
                                <PieChartIcon className="w-5 h-5 text-[var(--color-secondary)]" /> התפלגות קטגוריות
                            </h3>
                            <div className="flex-1 min-h-0">
                                {categoryData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryData}
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {categoryData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-muted)]">אין נתונים לתקופה זו</div>
                                )}
                            </div>
                        </div>

                        {/* Supplier Comparison Chart */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 h-[400px] flex flex-col col-span-1 md:col-span-2">
                            <h3 className="font-bold flex items-center gap-2 mb-4">
                                <Store className="w-5 h-5 text-purple-400" /> השוואת ספקים (טופ 10)
                            </h3>
                            <div className="flex-1 min-h-0" dir="ltr">
                                {supplierComparisonData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={supplierComparisonData} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                                            <XAxis type="number" reversed={true} stroke="#94A3B8" fontSize={10} tickFormatter={v => `₪${v}`} axisLine={false} tickLine={false} />
                                            <YAxis dataKey="name" type="category" orientation="right" stroke="#94A3B8" fontSize={10} width={120} axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, textAnchor: 'start', dx: 5 }} />
                                            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                            <Bar dataKey="total" name="סה״כ" fill="var(--color-secondary)" radius={[4, 0, 0, 4]} barSize={20}>
                                                {supplierComparisonData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={`hsl(217, 91%, ${60 - (index * 2)}%)`} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-muted)]">אין נתונים לתקופה זו</div>
                                )}
                            </div>
                        </div>

                        {/* Top Purchased Items Table */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 col-span-1 md:col-span-2 overflow-hidden flex flex-col">
                            <h3 className="font-bold flex items-center gap-2 mb-4">
                                <Receipt className="w-5 h-5 text-orange-400" /> מוצרים מובילים
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-right border-collapse text-sm">
                                    <thead className="bg-white/5 text-[var(--color-text-muted)] text-xs uppercase">
                                        <tr>
                                            <th className="p-3 font-semibold rounded-r-xl">שם פריט</th>
                                            <th className="p-3 font-semibold">ספק עיקרי</th>
                                            <th className="p-3 font-semibold text-center">כמות כוללת</th>
                                            <th className="p-3 font-semibold rounded-l-xl">סה״כ הוצאה</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {topItems.length > 0 ? topItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-medium text-white">{item.name}</td>
                                                <td className="p-3 text-[var(--color-text-muted)]">{item.supplier || '-'}</td>
                                                <td className="p-3 text-center text-blue-300 bg-blue-500/10 rounded">{parseFloat(item.quantity.toFixed(3))}</td>
                                                <td className="p-3 font-bold text-[var(--color-primary)]">₪{item.amount.toLocaleString()}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-[var(--color-text-muted)]">לא נמצאו פריטים לתקופה זו. אולי החשבוניות נסרקו ללא פירוט שורות?</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* --- SUPPLIERS TAB --- */}
            {activeTab === 'suppliers' && (
                <div className="pb-20">

                    {/* Main Suppliers Grid (when no supplier is selected for drill-down) */}
                    {!selectedSupplier ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-bottom-4 duration-300">
                            {suppliersList.length > 0 ? suppliersList.map(supp => (
                                <div
                                    key={supp.name}
                                    onClick={() => setSelectedSupplier(supp.name)}
                                    className="bg-white/5 border border-white/10 rounded-2xl p-4 cursor-pointer hover:bg-white/10 transition-all hover:border-[var(--color-primary)]/50 group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="text-lg font-bold text-white group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">{supp.name}</h3>
                                        <span className="bg-white/10 text-xs px-2 py-1 rounded-lg text-[var(--color-text-muted)]">{supp.receiptCount} קבלות</span>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-2xl font-black text-white">₪{supp.totalSpent.toLocaleString()}</p>
                                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">סה״כ הוצאה בתקופה נבחרת</p>
                                    </div>

                                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                                        {Array.from(supp.categories).map((cat, i) => (
                                            <span key={i} className="text-[9px] bg-[var(--color-background)] px-2 py-1 rounded text-gray-400">
                                                {cat}
                                            </span>
                                        ))}
                                        {supp.lastReceiptDate && (
                                            <span className="mr-auto text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {supp.lastReceiptDate.toLocaleDateString('he-IL')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full py-12 text-center text-[var(--color-text-muted)]">לא נמצאו ספקים בחשבוניות לתקופה זו.</div>
                            )}
                        </div>
                    ) : (

                        /* Specific Supplier Drill-down View */
                        <div className="animate-in slide-in-from-right-8 duration-300">
                            <button
                                onClick={() => setSelectedSupplier(null)}
                                className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-white mb-6 font-bold bg-white/5 px-4 py-2 rounded-xl transition-colors w-max"
                            >
                                <ChevronRight className="w-5 h-5" />
                                חזור לרשימת ספקים
                            </button>

                            {selectedSupplierData && (
                                <div className="space-y-6">
                                    {/* Supplier Header */}
                                    <div className="bg-gradient-to-l from-white/10 to-transparent p-6 rounded-2xl border border-white/10 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-3xl"></div>
                                        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                                            <div>
                                                <h2 className="text-3xl font-black text-white mb-2">{selectedSupplierData.name}</h2>
                                                <div className="flex gap-2">
                                                    {Array.from(selectedSupplierData.categories).map((cat, i) => (
                                                        <span key={i} className="text-xs bg-[var(--color-primary)]/20 text-[var(--color-primary)] px-2 py-1 rounded-md border border-[var(--color-primary)]/30 font-bold">
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-[var(--color-text-muted)] font-bold mb-1 uppercase tracking-wider">סה״כ הוצאה מצטברת</p>
                                                <p className="text-4xl font-black text-white">₪{selectedSupplierData.totalSpent.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-lg border-b border-white/10 pb-2">קבלות מספק זה</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {selectedSupplierData.expenses.sort((a, b) => {
                                            const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                                            const db = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                                            return db - da; // newest first
                                        }).map(exp => (
                                            <div key={exp.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col gap-3 group hover:border-[var(--color-secondary)]/50 transition-colors">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-[var(--color-secondary)]">{exp.date}</span>
                                                    <span className="font-black text-white text-lg">₪{exp.total?.toLocaleString()}</span>
                                                </div>
                                                {exp.imageUrl ? (
                                                    <div className="w-full h-32 rounded-lg bg-black/50 border border-white/5 overflow-hidden flex items-center justify-center relative group-hover:bg-black/20 transition-colors">
                                                        <img src={exp.imageUrl} className="max-h-full object-contain opacity-50 group-hover:opacity-100 transition-opacity" alt="קבלה" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-100 group-hover:opacity-0 transition-opacity"></div>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-12 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                                                        אין תמונה
                                                    </div>
                                                )}
                                                {/* Summary of items if any */}
                                                {exp.lineItems && exp.lineItems.length > 0 && (
                                                    <div className="text-xs text-[var(--color-text-muted)] bg-black/20 p-2 rounded">
                                                        {exp.lineItems.length} פריטים נסרקו (לדוגמה: {exp.lineItems[0].name})
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                </div>
                            )}
                        </div>
                    )}

                </div>
            )}

            {/* --- PRIME COST TAB --- */}
            {activeTab === 'prime-cost' && (
                <div className="pb-20 space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                        <div className="w-12 h-12 bg-[var(--color-primary)]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--color-primary)]/30">
                            <Calculator className="w-6 h-6 text-[var(--color-primary)]" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">מחשבון Prime Cost</h2>
                        <p className="text-[var(--color-text-muted)] text-sm max-w-md mx-auto">
                            חשב את עלות המזון + העבודה ביחס למחזור שלך — המדד שמכריע אם המסעדה שלך רווחית
                        </p>
                    </div>

                    {/* Calculator Inputs */}
                    <div className="bg-[#1E293B]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 relative">
                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-transparent to-black/20 pointer-events-none rounded-2xl"></div>
                        <h3 className="font-bold flex items-center gap-2 mb-6 text-xl relative z-10 text-white">
                            <span className="bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-sm w-6 h-6 rounded-full flex items-center justify-center font-black">1</span>
                            הכנס נתונים חודשיים
                        </h3>

                        <div className="grid gap-6 relative z-10">
                            {/* Revenue */}
                            <div>
                                <label className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-white">מחזור כולל (הכנסות)</span>
                                    <span className="text-xl">💰</span>
                                </label>
                                <p className="text-xs text-[var(--color-text-muted)] mb-3">סך כל ההכנסות של המסעדה בחודש</p>
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="100000"
                                        value={primeRevenue}
                                        onChange={e => setPrimeRevenue(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-4 text-white text-xl focus:border-[var(--color-primary)] outline-none transition-colors text-right"
                                        dir="ltr"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-bold">₪</span>
                                </div>
                            </div>

                            {/* Food Cost (COGS) */}
                            <div>
                                <label className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-white">עלות מזון</span>
                                    <span className="text-xl">🥩</span>
                                </label>
                                <p className="text-xs text-[var(--color-text-muted)] mb-3">חומרי גלם, קניות, ספקים (עודכן אוטומטית לפי ההוצאות)</p>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={foodCostInput}
                                        onChange={e => setFoodCostInput(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-4 text-white text-xl focus:border-[var(--color-primary)] outline-none transition-colors text-right"
                                        dir="ltr"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-bold">₪</span>
                                </div>
                            </div>

                            {/* Labor Cost */}
                            <div>
                                <label className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-white">עלות עבודה</span>
                                    <span className="text-xl">👨‍🍳</span>
                                </label>
                                <p className="text-xs text-[var(--color-text-muted)] mb-3">משכורות, שעות נוספות, ביטוח לאומי</p>
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="28000"
                                        value={primeLabor}
                                        onChange={e => setPrimeLabor(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-4 text-white text-xl focus:border-[var(--color-primary)] outline-none transition-colors text-right"
                                        dir="ltr"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-bold">₪</span>
                                </div>
                            </div>

                            {/* Result Section */}
                            <div className="md:col-span-1 mt-6">
                                <div className="bg-[#1E293B]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
                                    <h3 className="font-bold flex items-center gap-2 mb-8 text-xl text-white">
                                        <span className="bg-[var(--color-secondary)]/20 text-[var(--color-secondary)] text-sm w-6 h-6 rounded-full flex items-center justify-center font-black">2</span>
                                        תוצאה
                                    </h3>

                                    <div className="text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <span className={`text-5xl md:text-7xl font-black mb-2 transition-colors break-all ${isCalculated ? (primeCostPercent <= 55 ? 'text-[var(--color-primary)]' : primeCostPercent <= 60 ? 'text-yellow-400' : 'text-[var(--color-danger)]') : 'text-slate-700'}`}>
                                                {isCalculated ? (primeCostPercent > 999 ? '>999' : primeCostPercent.toFixed(1)) : '--'}%
                                            </span>
                                            <p className="text-[var(--color-text-muted)] font-medium flex items-center gap-2 text-lg">
                                                {isCalculated ? (
                                                    <>סה״כ Prime Cost</>
                                                ) : (
                                                    <>הכנס נתונים <span className="text-xl animate-pulse">📊</span></>
                                                )}
                                            </p>
                                        </div>

                                        {!isCalculated && (
                                            <p className="text-xs text-slate-500 mt-4">מלא את השדות כדי לחשב</p>
                                        )}

                                        {isCalculated && (
                                            <div className="mt-8 relative w-full h-4 bg-white/5 rounded-full overflow-hidden border border-white/10" dir="ltr">
                                                <div
                                                    className={`absolute left-0 top-0 h-full transition-all duration-1000 ${primeCostPercent <= 55 ? 'bg-[var(--color-primary)]' : primeCostPercent <= 60 ? 'bg-yellow-400' : 'bg-[var(--color-danger)]'}`}
                                                    style={{ width: `${Math.min(primeCostPercent, 100)}%` }}
                                                ></div>
                                                {/* Markers */}
                                                <div className="absolute top-0 left-1/2 h-full w-px bg-black/40 z-10"></div>
                                                <div className="absolute top-0 left-[60%] h-full w-px bg-black/40 z-10"></div>
                                            </div>
                                        )}
                                        {isCalculated && (
                                            <div className="relative w-full h-6 mt-2 text-[10px] font-bold" dir="ltr">
                                                <span className="absolute left-0 text-[var(--color-text-muted)]">0%</span>
                                                <span className="absolute left-1/2 -translate-x-1/2 text-[var(--color-primary)]">50%</span>
                                                <span className="absolute left-[60%] -translate-x-1/2 text-yellow-400">60%</span>
                                                <span className="absolute right-0 text-[var(--color-danger)]">100%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Educational Context */}
                                <div className="bg-black/40 border border-white/5 rounded-2xl p-6 mt-4">
                                    <h4 className="font-bold flex items-center gap-2 mb-3 text-white">
                                        <span className="text-lg">📖</span> מה זה Prime Cost?
                                    </h4>
                                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                                        <strong className="text-white">Prime Cost</strong> הוא הסכום של עלות המזון + עלות העבודה, מחולק בסך ההכנסות. זהו המדד החשוב ביותר לרווחיות מסעדה.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3 text-center">
                                            <p className="font-black text-green-400 text-sm mb-1">מתחת ל-50%</p>
                                            <p className="text-[11px] font-bold text-white mb-1">מצוין</p>
                                            <p className="text-[10px] text-[var(--color-text-muted)]">יעילות גבוהה</p>
                                        </div>
                                        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-center">
                                            <p className="font-black text-yellow-400 text-sm mb-1">50%-60%</p>
                                            <p className="text-[11px] font-bold text-white mb-1">תקין</p>
                                            <p className="text-[10px] text-[var(--color-text-muted)]">הטווח הבריא</p>
                                        </div>
                                        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-center">
                                            <p className="font-black text-red-500 text-sm mb-1">מעל 60%</p>
                                            <p className="text-[11px] font-bold text-white mb-1">סכנה</p>
                                            <p className="text-[10px] text-[var(--color-text-muted)]">קשה לשרוד</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
