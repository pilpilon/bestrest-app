import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
    user: User | null;
    role: 'admin' | 'manager' | 'accountant' | null;
    businessId: string | null;
    businessName: string | null;
    completedOnboarding: boolean;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<'admin' | 'manager' | 'accountant' | null>(null);
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [businessName, setBusinessName] = useState<string | null>(null);
    const [completedOnboarding, setCompletedOnboarding] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            try {
                console.log("Auth State Changed:", currentUser?.uid);
                setUser(currentUser);
                if (currentUser) {
                    console.log("Checking Firestore for user:", currentUser.uid);
                    const userDocRef = doc(db, 'users', currentUser.uid);
                    let data = null;
                    try {
                        const userDoc = await getDoc(userDocRef);
                        data = userDoc.exists() ? userDoc.data() : null;
                    } catch (e) {
                        console.warn("Firestore access error, using defaults:", e);
                    }

                    if (data) {
                        setRole(data.role || 'manager');
                        setBusinessId(data.businessId || 'main_branch');
                        setBusinessName(data.businessName || null);
                        setCompletedOnboarding(data.completedOnboarding ?? !!data.businessName);
                    } else {
                        // New user or offline fallback
                        console.log("No user data found, using defaults");
                        const newRole = currentUser.email === 'aorus.dev@gmail.com' ? 'admin' : 'manager';
                        const newBusinessId = 'main_branch';
                        setRole(newRole);
                        setBusinessId(newBusinessId);
                        setCompletedOnboarding(false);

                        // Try to persist new user if it was a missing document (non-blocking)
                        setTimeout(async () => {
                            try {
                                await setDoc(userDocRef, {
                                    uid: currentUser.uid,
                                    email: currentUser.email,
                                    displayName: currentUser.displayName,
                                    photoURL: currentUser.photoURL,
                                    role: newRole,
                                    businessId: newBusinessId,
                                    completedOnboarding: false,
                                    createdAt: new Date().toISOString()
                                }, { merge: true });
                            } catch (e) {
                                console.error("Failed to persist user profile (offline?):", e);
                            }
                        }, 0);
                    }
                } else {
                    console.log("No user logged in");
                    setRole(null);
                    setBusinessId(null);
                    setBusinessName(null);
                    setCompletedOnboarding(false);
                }
            } catch (error) {
                console.error("Auth context initialization error:", error);
            } finally {
                console.log("Auth loading finished");
                setLoading(false);
            }
        });

        return () => unsubscribe();
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

    const value = {
        user,
        role,
        businessId,
        businessName,
        completedOnboarding,
        loading,
        signInWithGoogle,
        logout
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
