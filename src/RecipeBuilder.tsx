import { useState, useRef } from 'react';
import { ChevronRight, Save, Utensils, Beaker, Plus, X, Camera, Loader2, Info, Trash2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { InventoryPicker, type InventoryPickerItem } from './Inventory';

// ─── Unit conversion helpers ──────────────────────────────────────────────────

const RECIPE_UNITS = ['גרם', 'ק"ג', 'מ"ל', 'ליטר', 'יחידה', 'כוס', 'כף', 'כפית'];

/**
 * Strip all types of quotes and apostrophes from a string for reliable matching.
 */
function stripQuotes(s: string): string {
    return s.replace(/["״׳'`'"]/g, '').trim();
}

/**
 * Try to extract quantity + unit from an item name.
 * e.g. "טבעות בצל (10 ק"ג)" → { qty: 10, unit: 'ק"ג' }
 * e.g. "ביצים 12 יח / ל" → { qty: 12, unit: 'יחידה' }
 */
function parseQtyFromName(name: string): { qty: number; unit: string } | null {
    // Normalize all quote variants before matching
    const normalized = stripQuotes(name);

    // Try each pattern against the normalized name
    const patterns: [RegExp, string][] = [
        [/(\d+(?:\.\d+)?)\s*קג/, 'ק"ג'],
        [/(\d+(?:\.\d+)?)\s*(?:גרם|גר)/, 'גרם'],
        [/(\d+(?:\.\d+)?)\s*(?:ליטר)/, 'ליטר'],
        [/(\d+(?:\.\d+)?)\s*(?:מל)/, 'מ"ל'],
        [/(\d+(?:\.\d+)?)\s*(?:יחידות|יחידה|יח)/, 'יחידה'],
    ];

    for (const [pattern, unit] of patterns) {
        const match = normalized.match(pattern);
        if (match) {
            return { qty: parseFloat(match[1]), unit };
        }
    }
    return null;
}

/**
 * Normalize a unit string for comparison: strip all quotes/apostrophes.
 */
function normalizeUnit(unit: string): string {
    return stripQuotes(unit);
}

/**
 * Check if a unit is a "generic" container unit (not weight/volume).
 * These units trigger name-parsing to find actual weight/volume.
 */
function isGenericUnit(unit: string): boolean {
    const generic = ['יחידה', 'יח', 'קופסה', 'שקית', 'חבילה', 'בקבוק', 'כוס'];
    return generic.includes(normalizeUnit(unit));
}

/**
 * Convert a quantity from one unit to a base unit (grams / ml / units).
 * Returns the value in the same "family" base unit so we can compare apples to apples.
 */
function toBaseUnit(qty: number, unit: string): { value: number; family: string } {
    const u = normalizeUnit(unit);
    switch (u) {
        case 'קג':
            return { value: qty * 1000, family: 'weight' };
        case 'גרם':
            return { value: qty, family: 'weight' };
        case 'ליטר':
            return { value: qty * 1000, family: 'volume' };
        case 'מל':
            return { value: qty, family: 'volume' };
        default:
            return { value: qty, family: 'unit' };
    }
}

/**
 * Calculate the proportional cost:
 *   (usedQty converted to base) / (inventoryQty converted to base) × price
 * If unit families don't match, returns 0 (cannot calculate).
 */
function calcProportionalCost(
    usedQty: number,
    usedUnit: string,
    invQty: number,
    invUnit: string,
    totalPrice: number
): number {
    if (!usedQty || !invQty || !totalPrice) return 0;
    const used = toBaseUnit(usedQty, usedUnit);
    const inv = toBaseUnit(invQty, invUnit);
    // If families don't match, we can't calculate → return 0
    if (used.family !== inv.family) return 0;
    const ratio = used.value / inv.value;
    return Math.round(ratio * totalPrice * 100) / 100;
}

export interface Ingredient {
    id: string;
    rawText: string;
    matchedItem?: string;
    cost?: number;
    source?: 'inventory' | 'ai_estimate';
    priceChange?: number;
    // Quantity-aware fields
    usedQuantity?: number;
    usedUnit?: string;
    inventoryQuantity?: number;  // package size used for cost math
    inventoryUnit?: string;
    inventoryPrice?: number;
    actualStockQty?: number;     // real units in the warehouse (display only)
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
    onDelete?: (id: string) => void | Promise<void>;
}

export function RecipeBuilder({ initialData, onBack, onSave, onDelete }: RecipeBuilderProps) {
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
                        ? { ...ing, cost: result.data.cost, matchedItem: result.data.matchedItem, source: result.data.source, priceChange: result.data.priceChange }
                        : ing
                ));
            }
        } catch (err) {
            console.error("Prediction failed:", err);
        }
    };

    const addIngredient = (fromInventory?: InventoryPickerItem) => {
        if (fromInventory) {
            const id = Date.now().toString();
            let invUnit = fromInventory.unit || 'יחידה';
            // The actual stock count (e.g. 150 units in the warehouse)
            const actualStockQty = fromInventory.quantity;

            // invQty is the "package size" used for proportional cost calculation.
            // For weight/volume units (ק"ג, ליטר etc.) it equals actualStockQty.
            // For generic units (יחידה, שקית, קופסה etc.) we try to parse a
            // package-size from the item name (e.g. "לחמניות 30 יח'" → 30 per pack),
            // so that the price-per-unit is correct.  The actual stock count is kept
            // separately and shown to the user for reference only.
            let invQty = actualStockQty;

            if (isGenericUnit(invUnit)) {
                const parsed = parseQtyFromName(fromInventory.name);
                if (parsed && parsed.unit !== 'יחידה') {
                    // Only override when name reveals a real weight/volume,
                    // e.g. "טבעות בצל (10 ק"ג)" → treat as 10 ק"ג per unit.
                    // If the name just says "30 יח'" the unit is already יחידה
                    // and the price is already per-unit — no override needed.
                    invQty = parsed.qty;
                    invUnit = parsed.unit;
                }
            }

            // Smart defaults: kg→100g, liters→100ml, otherwise 1 unit
            let defaultUsedQty = 1;
            let defaultUsedUnit = invUnit;
            const normUnit = normalizeUnit(invUnit);
            if (normUnit === 'קג') {
                defaultUsedQty = 100;
                defaultUsedUnit = 'גרם';
            } else if (normUnit === 'ליטר') {
                defaultUsedQty = 100;
                defaultUsedUnit = 'מ"ל';
            }

            const cost = calcProportionalCost(
                defaultUsedQty, defaultUsedUnit,
                invQty, invUnit,
                fromInventory.lastPrice
            );

            setIngredients(prev => [...prev, {
                id,
                rawText: fromInventory.name,
                matchedItem: fromInventory.name,
                cost,
                source: 'inventory' as const,
                usedQuantity: defaultUsedQty,
                usedUnit: defaultUsedUnit,
                // inventoryQuantity = package size (used for cost math)
                inventoryQuantity: invQty,
                inventoryUnit: invUnit,
                inventoryPrice: fromInventory.lastPrice,
                // actual stock count shown to user as reference
                actualStockQty,
            }]);
            return;
        }
        // Free-text: add + send to AI
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

    const updateIngredientQuantity = (id: string, qty: number, unit: string) => {
        setIngredients(prev => prev.map(ing => {
            if (ing.id !== id) return ing;
            const newCost = ing.inventoryPrice && ing.inventoryQuantity && ing.inventoryUnit
                ? calcProportionalCost(qty, unit, ing.inventoryQuantity, ing.inventoryUnit, ing.inventoryPrice)
                : ing.cost;
            return { ...ing, usedQuantity: qty, usedUnit: unit, cost: newCost };
        }));
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
                <div className="flex items-center gap-2">
                    {initialData && onDelete && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDelete(initialData.id);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors relative z-50 pointer-events-auto cursor-pointer"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">מחק מנה</span>
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !name || !targetPrice}
                        className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/20 px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span className="hidden sm:inline">שמור מנה</span>
                    </button>
                </div>
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
                            <div className="text-right flex flex-col items-start relative group/tooltip">
                                <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1 cursor-help">
                                    Food Cost
                                    <Info className="w-3 h-3 text-[var(--color-text-muted)]" />
                                </span>
                                <span className={`font-black ${foodCostPercent > 30 ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'}`}>
                                    {target > 0 ? foodCostPercent.toFixed(1) : 0}%
                                </span>
                                {/* Tooltip Content */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-black/95 text-white text-[10px] p-2 rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all shadow-xl border border-white/10 z-10 font-medium pointer-events-none text-right">
                                    Food Cost הוא אחוז עלות חומרי הגלם מתוך מחיר המכירה. ככל שהאחוז נמוך יותר, המנה רווחית יותר. (יעד מומלץ: 25%-35%)
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/95"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 mt-4 text-right">
                        {ingredients.map(ing => (
                            <div key={ing.id} className="bg-white/5 border border-white/10 p-3 rounded-lg group">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 ml-4 text-right">
                                        <p className="font-medium text-sm text-white">{ing.rawText}</p>
                                        {ing.matchedItem || ing.cost !== undefined ? (
                                            <div className="flex flex-col mt-1">
                                                <div className="flex items-center gap-2">
                                                    {ing.source === 'inventory' ? (
                                                        <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">מהמלאי</span>
                                                    ) : (
                                                        <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-bold">הערכת AI</span>
                                                    )}
                                                    <p className="text-[10px] text-gray-400">{ing.matchedItem || 'זוהה'}</p>
                                                    {ing.priceChange && ing.priceChange !== 0 ? (
                                                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${ing.priceChange > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                            {ing.priceChange > 0 ? '▲' : '▼'}{Math.abs(ing.priceChange)}%
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <p className="text-[10px] text-[var(--color-primary)] font-bold">₪{(ing.cost || 0).toFixed(2)}</p>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-yellow-500 mt-1 flex items-center gap-1 opacity-60">ה-AI עדיין מחשב עלות...</p>
                                        )}
                                    </div>
                                    <button onClick={() => removeIngredient(ing.id)} className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors p-2">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Quantity & Unit editor for inventory items */}
                                {ing.source === 'inventory' && ing.inventoryPrice && (
                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                                        <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">כמות למנה:</span>
                                        <input
                                            type="number"
                                            value={ing.usedQuantity || ''}
                                            onChange={e => updateIngredientQuantity(ing.id, parseFloat(e.target.value) || 0, ing.usedUnit || 'יחידה')}
                                            className="w-20 bg-slate-900/70 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:border-[var(--color-primary)] outline-none"
                                            dir="ltr"
                                            min="0"
                                            step="1"
                                        />
                                        <select
                                            value={ing.usedUnit || 'יחידה'}
                                            onChange={e => updateIngredientQuantity(ing.id, ing.usedQuantity || 0, e.target.value)}
                                            className="bg-slate-900/70 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-[var(--color-primary)] outline-none"
                                        >
                                            {RECIPE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                        <span className="text-[9px] text-[var(--color-text-muted)] flex-shrink-0">
                                            (במלאי: {ing.actualStockQty ?? ing.inventoryQuantity} {ing.inventoryUnit} ב-₪{ing.inventoryPrice})
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add Input — Inventory Picker */}
                    <div className="flex gap-2 relative" dir="rtl">
                        <InventoryPicker
                            businessId={businessId}
                            value={newIngredient}
                            onChange={setNewIngredient}
                            onSelect={(item) => addIngredient(item)}
                            onAdd={() => addIngredient()}
                            placeholder="חפש מוצר מהמלאי או הקלד בשפה חופשית..."
                        />
                        <button
                            onClick={() => addIngredient()}
                            disabled={!newIngredient.trim()}
                            className="bg-white/10 hover:bg-[var(--color-primary)] hover:text-slate-900 p-3 rounded-xl transition-all flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/10 disabled:hover:text-white"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
}
