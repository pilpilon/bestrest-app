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

                    unsubscribeProfile = onSnapshot(userDocRef, (snapshot) => {
                        if (snapshot.exists()) {
                            const data = snapshot.data();
                            console.log("Profile data updated:", data);
                            setRole(data.role || 'manager');
                            setBusinessId(data.businessId || 'main_branch');
                            setBusinessName(data.businessName || null);
                            setCompletedOnboarding(data.completedOnboarding ?? !!data.businessName);
                            setLoading(false);
                        } else {
                            // New user: create their own isolated business using their UID as the businessId
                            console.log("New user — creating isolated business...");
                            const newRole = currentUser.email === 'aorus.dev@gmail.com' ? 'admin' : 'admin';
                            // Use the user's own UID as their businessId — guarantees isolation
                            const newBusinessId = currentUser.uid;

                            setRole(newRole);
                            setBusinessId(newBusinessId);
                            setCompletedOnboarding(false);
                            setLoading(false);

                            // Create initial profile document
                            setDoc(userDocRef, {
                                uid: currentUser.uid,
                                email: currentUser.email,
                                displayName: currentUser.displayName,
                                photoURL: currentUser.photoURL,
                                role: newRole,
                                businessId: newBusinessId,
                                completedOnboarding: false,
                                createdAt: new Date().toISOString()
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
