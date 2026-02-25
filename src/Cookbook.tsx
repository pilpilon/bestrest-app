import { useState, useEffect, useRef } from 'react';
import { Plus, Search, ChevronLeft, ChefHat, Info, Trash2, Target, TrendingUp, Camera, Loader2, Lock } from 'lucide-react';
import { RecipeBuilder } from './RecipeBuilder';
import type { Recipe } from './RecipeBuilder';
import { useAuth } from './AuthContext';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UpgradeModal } from './UpgradeModal';

export function Cookbook() {
    const { businessId, subscriptionTier } = useAuth();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [isBuilding, setIsBuilding] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const menuInputRef = useRef<HTMLInputElement>(null);
    const [isScanningMenu, setIsScanningMenu] = useState(false);

    // Profit Calculator State
    const [targetProfit, setTargetProfit] = useState<string>('');



    useEffect(() => {
        if (!businessId) return;

        const q = query(
            collection(db, 'businesses', businessId, 'recipes'),
            orderBy('name', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
            setRecipes(docs);
            setLoading(false);
        }, (error) => {
            console.error("Firestore recipes fetch error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [businessId]);

    const handleSaveRecipe = async (recipeData: any) => {
        if (!businessId) return;

        const { id, ...data } = recipeData;

        if (id) {
            // Update existing
            await setDoc(doc(db, 'businesses', businessId, 'recipes', id), data, { merge: true });
        } else {
            // Add new
            await addDoc(collection(db, 'businesses', businessId, 'recipes'), data);
        }
    };

    const handleDeleteRecipe = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!businessId || !window.confirm('האם אתה בטוח שברצונך למחוק מתכון זה?')) return;
        await deleteDoc(doc(db, 'businesses', businessId, 'recipes', id));
    };

    const handleBulkMenuScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !businessId) return;

        setIsScanningMenu(true);
        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(file);
            });

            const response = await fetch('/api/ocr-menu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64, mimeType: file.type })
            });
            const result = await response.json();

            if (result.success && result.data.dishes) {
                const dishes = result.data.dishes;
                // Add all dishes sequentially
                for (const dish of dishes) {
                    await handleSaveRecipe({
                        name: dish.name,
                        targetPrice: parseFloat(dish.price) || 0,
                        calculatedCost: 0,
                        ingredients: [],
                        ingredientsCount: 0,
                        lastUpdated: new Date().toLocaleDateString('he-IL')
                    });
                }
                alert(`נוספו ${dishes.length} מנות חדשות בהצלחה!`);
            } else {
                alert('לא הצלחנו לזהות מנות בתפריט. נסה תמונה ברורה יותר.');
            }
        } catch (err) {
            console.error("Menu scan failed:", err);
            alert('שגיאה בסריקת התפריט.');
        } finally {
            setIsScanningMenu(false);
            if (menuInputRef.current) menuInputRef.current.value = '';
        }
    };

    const filteredRecipes = recipes.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // Profit Calculation Logic
    const avgMargin = recipes.length > 0
        ? recipes.reduce((sum, r) => sum + (r.targetPrice - r.calculatedCost), 0) / recipes.length
        : 0;

    const targetValue = parseFloat(targetProfit) || 0;
    const dishesPerMonth = avgMargin > 0 ? targetValue / avgMargin : 0;
    const dishesPerDay = dishesPerMonth / 30;

    if (isBuilding || editingRecipe) {
        return (
            <RecipeBuilder
                initialData={editingRecipe}
                onBack={() => { setIsBuilding(false); setEditingRecipe(null); }}
                onSave={handleSaveRecipe}
            />
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <section className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-3 text-white">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/20 flex items-center justify-center border border-[var(--color-primary)]/40 text-[var(--color-primary)]">
                            <ChefHat className="w-6 h-6" />
                        </div>
                        ספר מתכונים ועלויות (Food Cost)
                    </h2>
                    <p className="text-[var(--color-text-muted)] text-sm mt-2">
                        נהל את המנות שלך. המערכת תחשב אוטומטית את העלות האמיתית לפי הקבלות שנסרקו.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                    <input type="file" ref={menuInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleBulkMenuScan} />

                    <div className="relative">
                        {subscriptionTier === 'free' && (
                            <div
                                className="absolute inset-0 z-10 backdrop-blur-[2px] bg-black/20 rounded-xl flex items-center justify-center cursor-pointer hover:bg-black/40 transition-colors"
                                onClick={() => setShowUpgradeModal(true)}
                            >
                                <Lock className="w-4 h-4 text-white/80 mr-1" />
                            </div>
                        )}
                        <button
                            onClick={() => menuInputRef.current?.click()}
                            disabled={isScanningMenu || subscriptionTier === 'free'}
                            className={`bg-purple-500/10 text-purple-400 border border-purple-500/30 py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-500/20 transition-all ${(isScanningMenu || subscriptionTier === 'free') ? 'opacity-50' : ''}`}
                        >
                            {isScanningMenu ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                            {isScanningMenu ? 'סורק...' : 'סרוק תפריט'}
                        </button>
                    </div>

                </div>
            </section>

            {/* KPI / Info Bar */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-full text-blue-400">
                        <Info className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-white">איך זה עובד?</h4>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                            עלויות המרכיבים מתעדכנות בזמן אמת מסריקת החשבוניות (OCR). ה-Food Cost המוצג כאן מבוסס תמיד על המחיר האחרון ששילמת.
                        </p>
                    </div>
                </div>

                {/* Surprise Feature: Profit Target Calculator */}
                <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-xs text-[var(--color-primary)] flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            יעד רווח חודשי (₪)
                        </h4>
                        <TrendingUp className="w-4 h-4 text-[var(--color-primary)] opacity-50" />
                    </div>
                    <div className="flex items-end gap-3">
                        <input
                            type="number"
                            placeholder="כמה תרצו להרוויח?"
                            value={targetProfit}
                            onChange={(e) => setTargetProfit(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-[var(--color-primary)] font-bold w-full focus:outline-none focus:border-[var(--color-primary)]/50 transition-all"
                        />
                        {targetValue > 0 && (
                            <div className="shrink-0 text-left">
                                <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">עליך למכור כ-</p>
                                <p className="text-sm font-black text-white">{Math.ceil(dishesPerDay)} מנות/יום</p>
                            </div>
                        )}
                    </div>
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
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-12 pl-4 text-sm focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors text-white"
                />
            </div>

            {/* Recipes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full py-20 text-center">
                        <div className="inline-block w-8 h-8 border-4 border-white/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                    </div>
                ) : filteredRecipes.map((recipe) => {
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
                        <div
                            key={recipe.id}
                            onClick={() => setEditingRecipe(recipe)}
                            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer group flex flex-col h-full relative"
                        >
                            <button
                                onClick={(e) => handleDeleteRecipe(e, recipe.id)}
                                className="absolute top-4 left-4 p-2 rounded-lg bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-white group-hover:text-[var(--color-primary)] transition-colors">{recipe.name}</h3>
                                <ChevronLeft className="w-5 h-5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </div>

                            <div className="mt-auto space-y-4">
                                <div className="flex justify-between items-end border-b border-white/5 pb-3">
                                    <div>
                                        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-1">מחיר מכירה</p>
                                        <p className="font-bold text-white">₪{recipe.targetPrice}</p>
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
                                    <div className={`px-2.5 py-1 rounded-lg flex flex-col items-center group/tooltip relative ${statusBg}`}>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[8px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] opacity-80">Food Cost</span>
                                            <Info className="w-2.5 h-2.5 text-[var(--color-text-muted)] cursor-help" />
                                        </div>
                                        <span className={`font-black text-sm ${statusColor}`}>{foodCostPercent.toFixed(1)}%</span>
                                        {/* Tooltip Content */}
                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-black/95 text-white text-[10px] p-2 rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all shadow-xl border border-white/10 z-10 font-medium pointer-events-none text-right">
                                            Food Cost הוא אחוז עלות חומרי הגלם מתוך מחיר המכירה. ככל שהאחוז נמוך יותר, המנה רווחית יותר. (יעד מומלץ: 25%-35%)
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/95"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Empty State / Add New Card */}
                {!loading && (
                    <button
                        onClick={() => setIsBuilding(true)}
                        className="border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:bg-white/5 hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)] transition-all h-full min-h-[200px]"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                            <Plus className="w-6 h-6" />
                        </div>
                        <span className="font-bold">בניית מנה חדשה</span>
                    </button>
                )}
            </div>

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                featureName="סריקת תפריט אוטומטית (AI)"
            />
        </div>
    );
}
