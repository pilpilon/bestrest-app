import { useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export function Onboarding() {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [restaurantName, setRestaurantName] = useState('');
    const [accountantEmail, setAccountantEmail] = useState('');
    const [isFinishing, setIsFinishing] = useState(false);

    const handleNextStep = () => {
        if (restaurantName.trim()) setStep(2);
    };

    const handleFinish = async () => {
        if (!user || !restaurantName) return;
        setIsFinishing(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                businessName: restaurantName,
                completedOnboarding: true,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // Save accountant email to business doc (businessId = user.uid for admin)
            const bizRef = doc(db, 'businesses', user.uid);
            await setDoc(bizRef, {
                accountantEmail: accountantEmail.trim() || null,
                businessName: restaurantName,
            }, { merge: true });
        } catch (error) {
            console.error("Error saving onboarding:", error);
            setIsFinishing(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-6 text-white" dir="rtl">
            <div className="w-full max-w-md space-y-6">
                {/* Progress indicator */}
                <div className="flex items-center gap-2 justify-center">
                    <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 1 ? 'bg-[var(--color-primary)]' : 'bg-white/10'}`} />
                    <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 2 ? 'bg-[var(--color-primary)]' : 'bg-white/10'}`} />
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6">
                    {step === 1 ? (
                        <>
                            <div>
                                <h1 className="text-2xl font-bold">ברוכים הבאים ל-BestRest 🍽️</h1>
                                <p className="text-gray-400 mt-1">שלב 1 מתוך 2 — פרטי המסעדה</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-400 font-medium">שם המסעדה</label>
                                <input
                                    type="text"
                                    value={restaurantName}
                                    onChange={(e) => setRestaurantName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleNextStep()}
                                    placeholder="למשל: מסעדת הים"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-[var(--color-primary)] outline-none transition-colors"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={handleNextStep}
                                disabled={!restaurantName.trim()}
                                className="w-full py-3 bg-[var(--color-primary)] text-black font-bold rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
                            >
                                הבא →
                            </button>
                        </>
                    ) : (
                        <>
                            <div>
                                <h1 className="text-2xl font-bold">פרטי רואה החשבון</h1>
                                <p className="text-gray-400 mt-1">שלב 2 מתוך 2 — אופציונלי</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-400 font-medium">אימייל רואה החשבון</label>
                                <input
                                    type="email"
                                    value={accountantEmail}
                                    onChange={(e) => setAccountantEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleFinish()}
                                    placeholder="accountant@example.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-[var(--color-primary)] outline-none transition-colors"
                                    autoFocus
                                    dir="ltr"
                                />
                                <p className="text-xs text-gray-500">אפשר להוסיף או לשנות מאוחר יותר בהגדרות.</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="py-3 px-5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    ← חזור
                                </button>
                                <button
                                    onClick={handleFinish}
                                    disabled={isFinishing}
                                    className="flex-1 py-3 bg-[var(--color-primary)] text-black font-bold rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
                                >
                                    {isFinishing ? 'מייצר פרופיל...' : 'התחל לעבוד 🚀'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
