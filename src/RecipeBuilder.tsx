import { useState, useRef } from 'react';
import { ChevronRight, Save, Utensils, Beaker, Plus, X, Camera, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';

export interface Ingredient {
    id: string;
    rawText: string;
    matchedItem?: string;
    cost?: number;
}

export interface Recipe {
    id: string;
    name: string;
    targetPrice: number;
    calculatedCost: number;
    ingredients: Ingredient[];
    ingredientsCount: number;
    lastUpdated: string;
}

interface RecipeBuilderProps {
    initialData?: Recipe | null;
    onBack: () => void;
    onSave: (recipe: any) => Promise<void>;
}

export function RecipeBuilder({ initialData, onBack, onSave }: RecipeBuilderProps) {
    const { businessId } = useAuth();
    const [name, setName] = useState(initialData?.name || '');
    const [targetPrice, setTargetPrice] = useState(initialData?.targetPrice?.toString() || '');
    const [ingredients, setIngredients] = useState<Ingredient[]>(initialData?.ingredients || []);
    const [newIngredient, setNewIngredient] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // AI Menu Scan States
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scannedDishes, setScannedDishes] = useState<{ name: string, price: number }[]>([]);

    const predictCost = async (ingredientId: string, text: string) => {
        try {
            const response = await fetch('/api/predict-cost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingredientText: text, businessId })
            });
            const result = await response.json();
            if (result.success) {
                setIngredients(prev => prev.map(ing =>
                    ing.id === ingredientId
                        ? { ...ing, cost: result.data.cost, matchedItem: result.data.matchedItem }
                        : ing
                ));
            }
        } catch (err) {
            console.error("Prediction failed:", err);
        }
    };

    const addIngredient = () => {
        if (!newIngredient.trim()) return;
        const id = Date.now().toString();
        const text = newIngredient.trim();
        setIngredients([...ingredients, { id, rawText: text }]);
        setNewIngredient('');
        predictCost(id, text);
    };

    const removeIngredient = (id: string) => {
        setIngredients(ingredients.filter(i => i.id !== id));
    };

    const calculatedCost = ingredients.reduce((sum, item) => sum + (item.cost || 0), 0);
    const target = parseFloat(targetPrice) || 0;
    const foodCostPercent = target > 0 ? (calculatedCost / target) * 100 : 0;

    const handleSave = async () => {
        if (!name || !targetPrice) return;
        setIsSaving(true);
        try {
            await onSave({
                id: initialData?.id,
                name,
                targetPrice: parseFloat(targetPrice),
                calculatedCost,
                ingredients,
                ingredientsCount: ingredients.length,
                lastUpdated: new Date().toLocaleDateString('he-IL')
            });
            onBack();
        } catch (error) {
            console.error("Failed to save recipe:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMenuScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
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
                setScannedDishes(result.data.dishes);
            }
        } catch (err) {
            console.error("Scan failed:", err);
        } finally {
            setIsScanning(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const pickDish = (dish: { name: string, price: number }) => {
        setName(dish.name);
        setTargetPrice(dish.price.toString());
        setScannedDishes([]);
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-8 duration-300" dir="rtl">
            <button
                onClick={onBack}
                className="text-[var(--color-primary)] font-bold text-sm flex items-center gap-2 hover:underline mb-2"
            >
                <ChevronRight className="w-4 h-4" />
                חזרה לספר המתכונים
            </button>

            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black flex items-center gap-3 text-white">
                    <Utensils className="w-6 h-6 text-[var(--color-primary)]" />
                    {initialData ? 'עריכת מנה' : 'בניית מנה חדשה'}
                </h2>
                <button
                    onClick={handleSave}
                    disabled={isSaving || !name || !targetPrice}
                    className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/20 px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    שמור מנה
                </button>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">

                {/* Name & Target Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">שם המנה</label>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-[10px] text-[var(--color-primary)] font-bold flex items-center gap-1 hover:brightness-110 transition-all bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-full"
                            >
                                <Camera className="w-3 h-3" />
                                סרוק מהתפריט
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleMenuScan} />
                        </div>
                        <input
                            type="text"
                            placeholder="לדוגמה: פסטה כמהין"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[var(--color-primary)] outline-none transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">מחיר מכירה בתפריט (₪)</label>
                        <input
                            type="number"
                            placeholder="0.00"
                            value={targetPrice}
                            onChange={e => setTargetPrice(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--color-primary)] font-black text-lg focus:border-[var(--color-primary)] outline-none transition-colors text-left"
                            dir="ltr"
                        />
                    </div>
                </div>

                {/* AI Scanned Results chips */}
                {isScanning && (
                    <div className="p-4 bg-[var(--color-primary)]/5 border border-dashed border-[var(--color-primary)]/30 rounded-xl flex items-center justify-center gap-3 animate-pulse">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                        <span className="text-sm font-bold text-[var(--color-primary)]">ה-AI קורא את התפריט שלך...</span>
                    </div>
                )}

                {scannedDishes.length > 0 && (
                    <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase">כלים שזוהו בתפריט (לחץ לבחירה):</p>
                        <div className="flex flex-wrap gap-2">
                            {scannedDishes.map((dish, i) => (
                                <button
                                    key={i}
                                    onClick={() => pickDish(dish)}
                                    className="bg-white/10 hover:bg-[var(--color-primary)]/20 hover:text-[var(--color-primary)] transition-all px-3 py-1.5 rounded-lg text-xs font-bold border border-white/5"
                                >
                                    {dish.name} - ₪{dish.price}
                                </button>
                            ))}
                            <button onClick={() => setScannedDishes([])} className="bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/10">ביטול</button>
                        </div>
                    </div>
                )}

                <hr className="border-white/5" />

                {/* Ingredients List */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
                        <div>
                            <h3 className="font-bold flex items-center gap-2 text-white">
                                <Beaker className="w-4 h-4 text-purple-400" />
                                מרכיבים וחישוב עלות
                            </h3>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                הוסף מרכיבים בשפה חופשית. ה-AI יידע לשדך אותם למלאי המוצרים שלך.
                            </p>
                        </div>

                        {/* Live Cost Summary */}
                        <div className="bg-slate-900/50 border border-white/5 px-4 py-2 rounded-xl flex items-center gap-4 shrink-0 mt-4 md:mt-0 w-full md:w-auto">
                            <div className="text-right">
                                <span className="text-[10px] text-[var(--color-text-muted)] block">עלות מנה נוכחית</span>
                                <span className="font-bold text-white">₪{calculatedCost.toFixed(2)}</span>
                            </div>
                            <div className="h-8 w-px bg-white/10"></div>
                            <div className="text-right">
                                <span className="text-[10px] text-[var(--color-text-muted)] block">Food Cost</span>
                                <span className={`font-black ${foodCostPercent > 30 ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'}`}>
                                    {target > 0 ? foodCostPercent.toFixed(1) : 0}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 mt-4 text-right">
                        {ingredients.map(ing => (
                            <div key={ing.id} className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-lg group">
                                <div className="flex-1 ml-4 text-right">
                                    <p className="font-medium text-sm text-white">{ing.rawText}</p>
                                    {ing.matchedItem || ing.cost ? (
                                        <div className="flex flex-col mt-1">
                                            <p className="text-[10px] text-green-400 flex items-center gap-1">✨ {ing.matchedItem || 'זוהה מהמלאי'}</p>
                                            <p className="text-[10px] text-[var(--color-primary)] font-bold">₪{ing.cost}</p>
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-yellow-500 mt-1 flex items-center gap-1 opacity-60">ה-AI עדיין מחשב עלות...</p>
                                    )}
                                </div>
                                <button onClick={() => removeIngredient(ing.id)} className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors p-2">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add Input */}
                    <div className="flex gap-2 relative">
                        <input
                            type="text"
                            placeholder="למשל: 150 גרם סלמון..."
                            value={newIngredient}
                            onChange={e => setNewIngredient(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addIngredient()}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pr-4 pl-12 text-sm focus:border-purple-500/50 outline-none transition-colors placeholder:text-gray-600 text-white"
                        />
                        <button
                            onClick={addIngredient}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-[var(--color-primary)] hover:text-slate-900 p-1.5 rounded-lg transition-all"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
}
