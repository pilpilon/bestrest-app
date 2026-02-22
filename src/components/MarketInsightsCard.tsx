import { TrendingDown, Lock, ChevronLeft, Lightbulb } from 'lucide-react';
import type { MarketInsight } from '../utils/marketInsights';

interface MarketInsightsCardProps {
    insights: MarketInsight[];
    subscriptionTier: 'free' | 'pro';
    onRequireUpgrade: () => void;
}

export function MarketInsightsCard({ insights, subscriptionTier, onRequireUpgrade }: MarketInsightsCardProps) {
    const isFree = subscriptionTier === 'free';
    const hasData = insights.length > 0;

    const totalMonthlySavingsEst = hasData ? insights.reduce((acc, curr) => {
        // very rough mockup for total monthly savings assuming they buy ~50 units of these expensive items a month
        return acc + ((curr.userPrice - curr.marketPrice) * 50);
    }, 0) : 0;


    return (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden relative group">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[var(--color-secondary)]/10 to-transparent">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-secondary)]/20 flex items-center justify-center">
                        <Lightbulb className="w-4 h-4 text-[var(--color-secondary)]" />
                    </div>
                    <h3 className="font-bold text-sm">הזדמנויות חיסכון חכמות (AI)</h3>
                </div>
                {!isFree && (
                    <span className="text-[10px] font-bold bg-[var(--color-secondary)]/20 text-[var(--color-secondary)] px-2 py-1 rounded">
                        עודכן היום
                    </span>
                )}
            </div>

            <div className="relative p-4 md:p-5">

                {/* PAYWALL BLUR OVERLAY FOR FREE TIER */}
                {isFree && hasData && (
                    <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/60 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors hover:bg-black/70" onClick={onRequireUpgrade}>
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-3">
                            <Lock className="w-5 h-5 text-white/80" />
                        </div>
                        <h4 className="text-sm font-bold text-white mb-2">
                            זיהינו שאתה משלם {insights[0].savingsPct}% יותר מממוצע השוק
                        </h4>
                        <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-xs">
                            מערכת ה-AI שלנו מצאה 3 מוצרי חומר גלם יקרים שאתה קונה קבוע מעל מחיר השוק.
                        </p>
                        <button className="bg-[var(--color-primary)] text-slate-900 px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 hover:brightness-110 transition-all shadow-[0_0_15px_rgba(13,242,128,0.3)]">
                            גלה איפה לחסוך <ChevronLeft className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Content (Blurred if free, clear if pro) */}
                <div className={`space-y-4 ${(isFree && hasData) ? 'opacity-30 pointer-events-none select-none filter blur-[2px]' : ''}`}>

                    {!hasData ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-white/5 animate-pulse">
                                <Lightbulb className="w-5 h-5 text-[var(--color-text-muted)] opacity-50" />
                            </div>
                            <h4 className="font-bold text-white text-sm">המערכת אוספת נתוני שוק</h4>
                            <p className="text-xs text-[var(--color-text-muted)] max-w-xs text-balance">
                                אנחנו עוקבים אחרי החשבוניות שלך. ברגע שנזהה פריטים יקרים שאתה קונה קבוע (מינימום 3 פריטים), ה-AI יציג כאן הזדמנויות חיסכון המבוססות על נתוני שוק קיימים.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">פוטנציאל חיסכון חודשי</p>
                                    <h4 className="text-2xl font-black text-[var(--color-secondary)] border-b-2 border-[var(--color-secondary)]/30 inline-block pb-1">
                                        ~₪{Math.round(totalMonthlySavingsEst).toLocaleString()}
                                    </h4>
                                </div>
                                {totalMonthlySavingsEst > 500 && (
                                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                        <TrendingDown className="w-5 h-5 text-green-400" />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                {insights.map((insight, idx) => (
                                    <div key={idx} className="bg-black/20 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-sm text-white">{insight.itemName}</p>
                                            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                                                אתה משלם <span className="text-red-400">₪{insight.userPrice}</span> ל{insight.unit}
                                            </p>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-[var(--color-secondary)] text-sm mb-1">
                                                ממוצע בשוק: ₪{insight.marketPrice}
                                            </p>
                                            <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                                {insight.savingsPct}% זול יותר
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}
