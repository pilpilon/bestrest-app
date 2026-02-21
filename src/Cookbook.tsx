import { useState } from 'react';
import { Plus, Search, ChevronLeft, ChefHat, Info } from 'lucide-react';
import { RecipeBuilder } from './RecipeBuilder';

interface Recipe {
    id: string;
    name: string;
    targetPrice: number;
    calculatedCost: number;
    ingredientsCount: number;
    lastUpdated: string;
}

// Temporary Mock Data
const MOCK_RECIPES: Recipe[] = [
    { id: '1', name: 'סלמון נורבגי במיסו', targetPrice: 120, calculatedCost: 35.5, ingredientsCount: 6, lastUpdated: '12/10/2023' },
    { id: '2', name: 'קרפצ׳יו בקר', targetPrice: 65, calculatedCost: 18.2, ingredientsCount: 5, lastUpdated: '10/10/2023' },
    { id: '3', name: 'סלט קיסר עוף', targetPrice: 55, calculatedCost: 12.0, ingredientsCount: 8, lastUpdated: '15/10/2023' },
];

export function Cookbook() {
    const [isBuilding, setIsBuilding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRecipes = MOCK_RECIPES.filter(r => r.name.includes(searchQuery));

    if (isBuilding) {
        return <RecipeBuilder onBack={() => setIsBuilding(false)} />;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <section className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/20 flex items-center justify-center border border-[var(--color-primary)]/40 text-[var(--color-primary)]">
                            <ChefHat className="w-6 h-6" />
                        </div>
                        ספר מתכונים ועלויות (Food Cost)
                    </h2>
                    <p className="text-[var(--color-text-muted)] text-sm mt-2">
                        נהל את המנות שלך. המערכת תחשב אוטומטית את העלות האמיתית לפי הקבלות שנסרקו.
                    </p>
                </div>
                <button
                    onClick={() => setIsBuilding(true)}
                    className="bg-[var(--color-primary)] text-slate-900 py-2.5 px-6 rounded-xl font-bold text-sm flex items-center gap-2 shadow-[0_0_15px_rgba(13,242,128,0.4)] hover:brightness-110 transition-all shrink-0"
                >
                    <Plus className="w-5 h-5" />
                    מתכון חדש לחמישי
                </button>
            </section>

            {/* KPI / Info Bar */}
            <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-full text-blue-400">
                    <Info className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-sm">איך זה עובד?</h4>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        עלויות המרכיבים מתעדכנות בזמן אמת מסריקת החשבוניות (OCR). ה-Food Cost המוצג כאן מבוסס תמיד על המחיר האחרון ששילמת.
                    </p>
                </div>
            </section>

            {/* Search and Filter */}
            <div className="relative w-full md:w-96">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                    type="text"
                    placeholder="חיפוש מנה..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-12 pl-4 text-sm focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
                />
            </div>

            {/* Recipes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRecipes.map((recipe) => {
                    const foodCostPercent = (recipe.calculatedCost / recipe.targetPrice) * 100;
                    let statusColor = 'text-[var(--color-primary)]'; // Good (< 30%)
                    let statusBg = 'bg-[var(--color-primary)]/10';

                    if (foodCostPercent > 35) {
                        statusColor = 'text-[var(--color-danger)]'; // Bad (> 35%)
                        statusBg = 'bg-[var(--color-danger)]/10';
                    } else if (foodCostPercent > 30) {
                        statusColor = 'text-yellow-400'; // Warning
                        statusBg = 'bg-yellow-400/10';
                    }

                    return (
                        <div key={recipe.id} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer group flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold group-hover:text-[var(--color-primary)] transition-colors">{recipe.name}</h3>
                                <ChevronLeft className="w-5 h-5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </div>

                            <div className="mt-auto space-y-4">
                                <div className="flex justify-between items-end border-b border-white/5 pb-3">
                                    <div>
                                        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-1">מחיר מכירה</p>
                                        <p className="font-bold">₪{recipe.targetPrice}</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-1">עלות מרכיבים</p>
                                        <p className="font-bold text-[var(--color-text-muted)]">₪{recipe.calculatedCost.toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center">
                                    <div className="text-xs text-[var(--color-text-muted)]">
                                        {recipe.ingredientsCount} מרכיבים
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-lg flex flex-col items-center ${statusBg}`}>
                                        <span className="text-[8px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] opacity-80">Food Cost</span>
                                        <span className={`font-black text-sm ${statusColor}`}>{foodCostPercent.toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Empty State / Add New Card */}
                <button
                    onClick={() => setIsBuilding(true)}
                    className="border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:bg-white/5 hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)] transition-all h-full min-h-[200px]"
                >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                        <Plus className="w-6 h-6" />
                    </div>
                    <span className="font-bold">בניית מנה חדשה</span>
                </button>
            </div>
        </div>
    );
}
