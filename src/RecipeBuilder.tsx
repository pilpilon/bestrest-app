import { useState } from 'react';
import { ChevronRight, Save, Utensils, Beaker, Plus, X } from 'lucide-react';

interface Ingredient {
    id: string;
    rawText: string;
    matchedItem?: string; // What the AI matched it to in inventory
    cost?: number;
}

export function RecipeBuilder({ onBack }: { onBack: () => void }) {
    const [name, setName] = useState('');
    const [targetPrice, setTargetPrice] = useState('');
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [newIngredient, setNewIngredient] = useState('');

    const addIngredient = () => {
        if (!newIngredient.trim()) return;
        setIngredients([...ingredients, { id: Date.now().toString(), rawText: newIngredient }]);
        setNewIngredient('');
    };

    const removeIngredient = (id: string) => {
        setIngredients(ingredients.filter(i => i.id !== id));
    };

    const calculatedCost = ingredients.reduce((sum, item) => sum + (item.cost || 0), 0);
    const target = parseFloat(targetPrice) || 0;
    const foodCostPercent = target > 0 ? (calculatedCost / target) * 100 : 0;

    return (
        <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-8 duration-300">
            <button
                onClick={onBack}
                className="text-[var(--color-primary)] font-bold text-sm flex items-center gap-2 hover:underline mb-2"
            >
                <ChevronRight className="w-4 h-4" />
                חזרה לספר המתכונים
            </button>

            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black flex items-center gap-3">
                    <Utensils className="w-6 h-6 text-[var(--color-primary)]" />
                    בניית מנה חדשה
                </h2>
                <button className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/20 px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors">
                    <Save className="w-4 h-4" />
                    שמור מתכון
                </button>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">

                {/* Name & Target Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">שם המנה</label>
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

                <hr className="border-white/5" />

                {/* Ingredients List */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
                        <div>
                            <h3 className="font-bold flex items-center gap-2">
                                <Beaker className="w-4 h-4 text-purple-400" />
                                מרכיבים וחישוב עלות
                            </h3>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                הוסף מרכיבים בשפה חופשית (כמויות, סוגים). ה-AI יידע לשדך אותם למלאי המוצרים שלך לפי רכישות אחרונות.
                            </p>
                        </div>

                        {/* Live Cost Summary */}
                        <div className="bg-slate-900/50 border border-white/5 px-4 py-2 rounded-xl flex items-center gap-4 shrink-0 mt-4 md:mt-0 w-full md:w-auto">
                            <div className="text-right">
                                <span className="text-[10px] text-[var(--color-text-muted)] block">עלות מנה נוכחית</span>
                                <span className="font-bold">₪{calculatedCost.toFixed(2)}</span>
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

                    <div className="space-y-2 mt-4">
                        {ingredients.map(ing => (
                            <div key={ing.id} className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-lg group">
                                <div className="flex-1 ml-4">
                                    <p className="font-medium text-sm">{ing.rawText}</p>
                                    {ing.matchedItem ? (
                                        <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">✨ זוהה מהמלאי (₪{ing.cost})</p>
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
                            placeholder="למשל: 150 גרם סלמון או 30 מ״ל חלב שקדים תנובה..."
                            value={newIngredient}
                            onChange={e => setNewIngredient(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addIngredient()}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pr-4 pl-12 text-sm focus:border-purple-500/50 outline-none transition-colors placeholder:text-gray-600"
                        />
                        <button
                            onClick={addIngredient}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-[var(--color-primary)] hover:text-slate-900 p-1.5 rounded-lg transition-all"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-[10px] text-center text-[var(--color-primary)] opacity-70">
                        * הוסף מרכיב מרכיב כדי שה-AI יזהה אותם במדויק
                    </p>

                </div>
            </div>
        </div >
    );
}
