import { Check, CreditCard, Sparkles, Lock, Settings } from 'lucide-react';
import { useAuth } from './AuthContext';
import { openPaddleCheckout, fetchManagementUrl } from './utils/paddle';
import { useState } from 'react';

export function Subscription() {
    const { user, subscriptionTier, paddleSubscriptionId } = useAuth();
    const [isLoadingPortal, setIsLoadingPortal] = useState(false);

    const handleManageSubscription = async () => {
        if (!paddleSubscriptionId) {
            alert("לא נמצא מזהה מנוי. אנא פנה לתמיכה.");
            return;
        }

        setIsLoadingPortal(true);
        try {
            const url = await fetchManagementUrl(paddleSubscriptionId);
            if (url) {
                window.open(url, '_blank');
            } else {
                alert("שגיאה ביצירת קישור לניהול המנוי. אנא נסה שוב מאוחר יותר.");
            }
        } catch (error) {
            console.error("Error managing subscription", error);
            alert("שגיאה ביצירת קישור לניהול המנוי.");
        } finally {
            setIsLoadingPortal(false);
        }
    };

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
            <div className="flex justify-center max-w-md mx-auto items-start">

                {/* PRO CARD */}
                <div className={`w-full bg-gradient-to-b from-[var(--color-primary)]/10 to-transparent backdrop-blur-xl border-2 rounded-2xl p-6 relative overflow-hidden transition-all border-[var(--color-primary)] shadow-[0_0_30px_rgba(13,242,128,0.3)]`}>
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--color-primary)]/20 rounded-full blur-2xl pointer-events-none"></div>

                    {subscriptionTier === 'pro' && (
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
                        <li className="flex items-center gap-3 text-sm font-bold text-[var(--color-primary)]">
                            <Sparkles className="w-5 h-5 shrink-0" />
                            <span>חודש התנסות חינם ללא התחייבות</span>
                        </li>
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
                        <li className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
                            <Check className="w-5 h-5 shrink-0" />
                            <span>תמיכה בעדיפות וליווי אישי להקמת המערכת</span>
                        </li>
                    </ul>

                    {subscriptionTier === 'pro' ? (
                        <button
                            onClick={handleManageSubscription}
                            disabled={isLoadingPortal}
                            className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl border border-[var(--color-primary)]/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Settings className="w-5 h-5" />
                            {isLoadingPortal ? 'טוען פנל ניהול...' : 'נהל מנוי / ביטול (פאדל)'}
                        </button>
                    ) : (
                        <button
                            onClick={() => openPaddleCheckout('pri_01kj272mce47gnpstjmgzed3m5', user?.email || undefined)}
                            className="w-full bg-[var(--color-primary)] hover:brightness-110 text-slate-900 font-black py-4 rounded-xl shadow-[0_0_20px_rgba(13,242,128,0.3)] transition-all flex items-center justify-center gap-2 animate-pulse"
                        >
                            <CreditCard className="w-5 h-5" />
                            התחל חודש ניסיון
                        </button>
                    )}
                </div>

            </div>

            <p className="text-[10px] text-center text-[var(--color-text-muted)] mt-4 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" />
                התשלום מבוצע בצורה מוצפנת ומאובטחת דרך Paddle, חיוב אוטומטי.
            </p>
        </div>
    );
}
