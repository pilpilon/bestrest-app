import { X, Sparkles, Lock, CreditCard } from 'lucide-react';
import { useAuth } from './AuthContext';
import { openPaddleCheckout } from './utils/paddle';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    featureName?: string;
}

export function UpgradeModal({
    isOpen,
    onClose,
    title = "תכונה זו זמינה במנוי פרו",
    message = "כדי להשתמש בתכונה זו, יש לשדרג את החשבון למסלול ה-Pro ולקבל גישה חופשית לכל כלי ה-AI של BestRest.",
    featureName
}: UpgradeModalProps) {
    const { user } = useAuth();

    if (!isOpen) return null;

    const handleUpgradeClick = () => {
        openPaddleCheckout('pri_01kj272mce47gnpstjmgzed3m5', user?.email || undefined, user?.uid);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-[#1A2235] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Glow effect */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-[var(--color-primary)]/20 rounded-full blur-3xl pointer-events-none"></div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 left-4 p-1 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 text-center space-y-4 pt-10">

                    <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/30 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(13,242,128,0.2)]">
                        {featureName ? <Lock className="w-8 h-8 text-[var(--color-primary)]" /> : <Sparkles className="w-8 h-8 text-[var(--color-primary)]" />}
                    </div>

                    <h3 className="text-xl font-black text-white px-2">
                        {title}
                    </h3>

                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed pb-4">
                        {message}
                    </p>

                    <div className="bg-black/30 rounded-xl p-4 border border-white/5 mb-6 text-right">
                        <h4 className="text-xs font-bold text-white mb-2">מה מקבלים בפרו?</h4>
                        <ul className="space-y-2 text-xs text-[var(--color-text-muted)]">
                            <li className="flex items-center gap-2 font-medium text-[var(--color-primary)]">
                                <Sparkles className="w-3 h-3" />
                                סריקת חשבוניות ללא הגבלה
                            </li>
                            <li className="flex items-center gap-2">
                                <Lock className="w-3 h-3" />
                                בוט זיהוי התייקרויות מחירים
                            </li>
                            <li className="flex items-center gap-2">
                                <Lock className="w-3 h-3" />
                                ייצוא נתונים מלא לרו״ח
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={handleUpgradeClick}
                            className="w-full bg-[var(--color-primary)] hover:brightness-110 text-slate-900 font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(13,242,128,0.4)] transition-all active:scale-95"
                        >
                            <CreditCard className="w-5 h-5" />
                            שדרג לפרו — 299₪
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full text-xs font-bold text-[var(--color-text-muted)] hover:text-white py-2 transition-colors"
                        >
                            אולי מאוחר יותר
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
