import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { onSnapshot, doc, setDoc } from 'firebase/firestore';

interface AuthContextType {
    user: User | null;
    role: 'admin' | 'manager' | 'accountant' | null;
    businessId: string | null;
    businessName: string | null;
    subscriptionTier: 'free' | 'pro';
    ocrScansToday: number;
    completedOnboarding: boolean;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    incrementOcrScan: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<'admin' | 'manager' | 'accountant' | null>(null);
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [businessName, setBusinessName] = useState<string | null>(null);
    const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro'>('free');
    const [ocrScansToday, setOcrScansToday] = useState<number>(0);
    const [completedOnboarding, setCompletedOnboarding] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeProfile: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            try {
                console.log("Auth State Changed:", currentUser?.uid);

                // Cleanup previous profile listener if it exists
                if (unsubscribeProfile) {
                    unsubscribeProfile();
                    unsubscribeProfile = null;
                }

                setUser(currentUser);

                if (currentUser) {
                    console.log("Setting up snapshot for user:", currentUser.uid);
                    const userDocRef = doc(db, 'users', currentUser.uid);

                    unsubscribeProfile = onSnapshot(userDocRef, async (snapshot) => {
                        if (snapshot.exists()) {
                            const data = snapshot.data();
                            console.log("Profile data updated:", data);
                            setRole(data.role || 'manager');
                            setBusinessId(data.businessId || 'main_branch');
                            setBusinessName(data.businessName || null);

                            // Initialize new fields with fallbacks
                            const tier = data.subscriptionTier || 'free';
                            setSubscriptionTier(tier);

                            // Check if a new day started and we need to reset the counter
                            const now = new Date();
                            const currentDate = `${now.getFullYear()}-${Math.floor(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(now.getDate()).toString().padStart(2, '0')}`;

                            if (data.ocrScanResetDate !== currentDate && tier === 'free') {
                                // Reset scan count for the new day
                                await setDoc(userDocRef, {
                                    ocrScansToday: 0,
                                    ocrScanResetDate: currentDate
                                }, { merge: true });
                                setOcrScansToday(0);
                            } else {
                                setOcrScansToday(data.ocrScansToday || 0);
                            }

                            setCompletedOnboarding(data.completedOnboarding ?? !!data.businessName);
                            setLoading(false);
                        } else {
                            // New user: Check if they used an invite link
                            const urlParams = new URLSearchParams(window.location.search);
                            const inviteBusinessId = urlParams.get('invite');

                            let newRole: 'admin' | 'manager' = 'manager';
                            let newBusinessId = currentUser.uid;

                            if (inviteBusinessId) {
                                console.log(`Joining existing business via invite: ${inviteBusinessId}`);
                                newBusinessId = inviteBusinessId;
                                // Automatically assign manager role for invited users
                                newRole = 'manager';

                                // Clean up URL
                                window.history.replaceState({}, document.title, window.location.pathname);
                            } else {
                                console.log("New user — creating isolated business...");
                                if (currentUser.email === 'aorus.dev@gmail.com') newRole = 'admin';
                                else newRole = 'admin'; // Owner of their new business
                            }

                            setRole(newRole);
                            setBusinessId(newBusinessId);
                            setSubscriptionTier('free');
                            setOcrScansToday(0);
                            setCompletedOnboarding(false);
                            setLoading(false);

                            const now = new Date();
                            const currentDate = `${now.getFullYear()}-${Math.floor(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(now.getDate()).toString().padStart(2, '0')}`;

                            // Create initial profile document
                            setDoc(userDocRef, {
                                uid: currentUser.uid,
                                email: currentUser.email,
                                displayName: currentUser.displayName,
                                photoURL: currentUser.photoURL,
                                role: newRole,
                                businessId: newBusinessId,
                                subscriptionTier: 'free',
                                ocrScansToday: 0,
                                ocrScanResetDate: currentDate,
                                completedOnboarding: false,
                                createdAt: now.toISOString()
                            }, { merge: true }).catch(e => console.error("Failed to persist initial user profile:", e));
                        }
                    }, (error) => {
                        console.error("Firestore profile snapshot error:", error);
                        setLoading(false);
                    });
                } else {
                    console.log("No user logged in");
                    setRole(null);
                    setBusinessId(null);
                    setBusinessName(null);
                    setSubscriptionTier('free');
                    setOcrScansToday(0);
                    setCompletedOnboarding(false);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Auth context initialization error:", error);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
        };
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Google:", error);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const incrementOcrScan = async () => {
        if (!user) return false;
        try {
            if (subscriptionTier === 'free' && ocrScansToday >= 1) {
                return false; // Deny if at limit
            }
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, {
                ocrScansToday: ocrScansToday + 1
            }, { merge: true });
            return true;
        } catch (err) {
            console.error('Error incrementing scan count:', err);
            return false;
        }
    };

    const value = {
        user,
        role,
        businessId,
        businessName,
        subscriptionTier,
        ocrScansToday,
        completedOnboarding,
        loading,
        signInWithGoogle,
        logout,
        incrementOcrScan
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
