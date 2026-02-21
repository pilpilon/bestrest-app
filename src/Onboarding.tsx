import { useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export function Onboarding() {
    const { user } = useAuth();
    const [restaurantName, setRestaurantName] = useState('');
    const [isFinishing, setIsFinishing] = useState(false);

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
        } catch (error) {
            console.error("Error saving onboarding:", error);
            setIsFinishing(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-6 text-white" dir="rtl">
            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6">
                <h1 className="text-2xl font-bold">ברוכים הבאים ל-BestRest</h1>
                <p className="text-gray-400">אנא הכנס את שם המסעדה שלך כדי להתחיל:</p>
                <input
                    type="text"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="שם המסעדה"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-[var(--color-primary)] outline-none"
                />
                <button
                    onClick={handleFinish}
                    disabled={isFinishing || !restaurantName}
                    className="w-full py-3 bg-[var(--color-primary)] text-black font-bold rounded-lg hover:brightness-110 disabled:opacity-50"
                >
                    {isFinishing ? 'מייצר פרופיל...' : 'המשך לדשבורד'}
                </button>
            </div>
        </div>
    );
}
