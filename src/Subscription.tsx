import { Check, X, CreditCard, Sparkles, AlertCircle, Lock } from 'lucide-react';
import { useAuth } from './AuthContext';
import { openPaddleCheckout } from './utils/paddle';

export function Subscription() {
    const { user, subscriptionTier, ocrScansToday } = useAuth();

    const isFree = subscriptionTier === 'free';
    const scansRemaining = Math.max(0, 1 - (ocrScansToday || 0));
    const scanPercentage = Math.min(100, ((ocrScansToday || 0) / 1) * 100);
    const isDangerZone = isFree && (ocrScansToday || 0) >= 1;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

            {/* Header Section */}
            <div className="text-center space-y-2 mt-4">
                <h2 className="text-3xl font-black bg-gradient-to-r from-[var(--color-primary)] to-teal-300 bg-clip-text text-transparent inline-flex items-center gap-2">
                    <Sparkles className="w-8 h-8 text-[var(--color-primary)]" />
                    שדרג את המסעדה שלך
                </h2>
                <p className="text-[var(--color-text-muted)] max-w-md mx-auto">
                    חסוך שעות של קלדנות, עקוב אחר התייקרויות אצל הספקים בזמן אמת, וקבל שליטה מלאה על ה-Food Cost.
                </p>
            </div>

            {/* Pricing Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-start">

                {/* FREE CARD */}
                <div className={`bg-white/5 backdrop-blur-md border rounded-2xl p-6 relative overflow-hidden transition-all ${isFree ? 'border-[var(--color-primary)]/50 shadow-[0_0_20px_rgba(13,242,128,0.1)]' : 'border-white/10 opacity-70'}`}>
                    {isFree && (
                        <div className="absolute top-0 right-0 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                            התוכנית הנוכחית
                        </div>
                    )}
                    <h3 className="text-xl font-bold mb-1">חינם</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6">למסעדות שעושות את הצעדים הראשונים בבקרה</p>
                    <div className="text-3xl font-black mb-6">₪0 <span className="text-sm font-normal text-[var(--color-text-muted)]">/ לחודש</span></div>

                    <ul className="space-y-4 mb-8">
                        <li className="flex items-center gap-3 text-sm">
                            <Check className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                            <span>ניהול מתכונים מלא (Recipe Builder)</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm">
                            <Check className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                            <span>משתמש יחיד במערכת</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                            <AlertCircle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                            <div>
                                <strong>סריקת חשבונית 1 ביום (AI)</strong>

                                {/* Usage Meter */}
                                {isFree && (
                                    <div className="mt-3 bg-black/20 rounded-xl p-3 border border-white/5">
                                        <div className="flex justify-between text-[10px] font-bold mb-1.5">
                                            <span className={isDangerZone ? 'text-red-400' : 'text-[var(--color-text-muted)]'}>
                                                {ocrScansToday || 0} נוצלו
                                            </span>
                                            <span className="text-[var(--color-primary)]">{scansRemaining} נותרו להיום</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${isDangerZone ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-[var(--color-primary)] shadow-[0_0_10px_rgba(13,242,128,0.5)]'}`}
                                                style={{ width: `${scanPercentage}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </li>
                        <li className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
                            <X className="w-5 h-5 shrink-0" />
                            <span>התראות אוטומטיות על התייקרות מחירים</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
                            <X className="w-5 h-5 shrink-0" />
                            <span>ייצוא לאקסל ולרואה החשבון</span>
                        </li>
                    </ul>
                </div>

                {/* PRO CARD */}
                <div className={`bg-gradient-to-b from-[var(--color-primary)]/10 to-transparent backdrop-blur-xl border-2 rounded-2xl p-6 relative overflow-hidden transition-all transform md:-translate-y-4 ${!isFree ? 'border-[var(--color-primary)] shadow-[0_0_30px_rgba(13,242,128,0.3)]' : 'border-[var(--color-primary)]/50 hover:border-[var(--color-primary)] hover:shadow-[0_0_30px_rgba(13,242,128,0.2)]'}`}>
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--color-primary)]/20 rounded-full blur-2xl pointer-events-none"></div>

                    {!isFree && (
                        <div className="absolute top-0 right-0 bg-[var(--color-primary)] text-slate-900 text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                            פעיל ✓
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xl font-black text-[var(--color-primary)]">Pro ⭐</h3>
                        <div className="bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] px-2 py-0.5 rounded-full font-bold">
                            המומלץ ביותר
                        </div>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6">לקבלת שליטה מלאה וחיסכון ענק בזמן קלדנות</p>
                    <div className="text-3xl font-black mb-6 flex items-baseline gap-2">
                        ₪299
                        <span className="text-sm font-normal text-[var(--color-text-muted)]">/ לחודש</span>
                    </div>

                    <ul className="space-y-4 mb-8">
                        <li className="flex items-center gap-3 text-sm font-bold text-white">
                            <Check className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                            <span>סריקת חשבוניות וזיהוי אוטומטי (OCR) — ללא הגבלה</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm text-white">
                            <Check className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                            <span>בוט התראות AI על התייקרויות מחירים מספקים</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm text-white">
                            <Check className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                            <span>יצוא לאקסל ושליחת קבצי פקודות יומן (CSV) לרו״ח</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm">
                            <Check className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                            <span>סריקת תפריטים להקמת מתכונים מהירה</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm text-white">
                            <Check className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                            <span>משתמשים ועובדים ללא הגבלה</span>
                        </li>
                    </ul>

                    {isFree ? (
                        <button
                            onClick={() => openPaddleCheckout('pri_01kj272mce47gnpstjmgzed3m5', user?.email || undefined, user?.uid)}
                            className="w-full bg-[var(--color-primary)] hover:brightness-110 text-slate-900 font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(13,242,128,0.4)] transition-all transform hover:scale-[1.02] active:scale-95"
                        >
                            <CreditCard className="w-5 h-5" />
                            תשלום מאובטח ב-Paddle
                        </button>
                    ) : (
                        <div className="w-full bg-white/5 border border-white/10 text-[var(--color-primary)] font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-default">
                            <Check className="w-5 h-5" />
                            המנוי פעיל לחשבון זה
                        </div>
                    )}

                    <p className="text-[10px] text-center text-[var(--color-text-muted)] mt-4 flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3" />
                        התשלום מבוצע בצורה מוצפנת ומאובטחת דרך Paddle, חיוב אוטומטי.
                    </p>
                </div>
            </div>

        </div>
    );
}
