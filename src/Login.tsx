import { useAuth } from './AuthContext';

export function Login() {
    const { signInWithGoogle } = useAuth();

    return (
        <div className="bg-[var(--color-background)] text-[var(--color-text-main)] min-h-[max(884px,100dvh)] flex flex-col items-center justify-center overflow-hidden relative">
            {/* Background Layer with Cyberpunk Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(13,242,128,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(13,242,128,0.05)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none opacity-40"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-background)]/80 to-[var(--color-background)] pointer-events-none"></div>

            {/* Floating Gradient Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--color-primary)]/10 blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--color-primary)]/5 blur-[100px]"></div>

            {/* Main Content Container */}
            <main className="relative z-10 w-full max-w-md px-6 py-12 flex flex-col items-center" dir="rtl">


                {/* Central Login Card */}
                <div className="bg-[rgba(16,34,25,0.6)] backdrop-blur-xl border-t border-[var(--color-primary)]/30 shadow-[0_0_15px_rgba(13,242,128,0.3)] w-full p-8 rounded-xl flex flex-col items-center text-center">

                    {/* Title & Subtext */}
                    <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">בסטרסט</h1>
                    <p className="text-[var(--color-primary)] font-medium mb-10 opacity-90">ניהול הוצאות חכם למסעדות</p>

                    {/* Hero Image */}
                    <div className="w-full h-40 mb-10 overflow-hidden rounded-lg relative group">
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] to-transparent z-10"></div>
                        <img alt="Premium kitchen atmosphere" className="w-full h-full object-cover grayscale opacity-50 group-hover:scale-110 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdPElbM4w3Owle1BTUtd9opFb5Twuktdds459GruXa6WYp417gOWeXboJdAxW1Vj6USv2dnI6XPm-QmxEckUR-xarqiVQiGg_zRcQhyDbcNQ6sF_aZiQufw2goQitscEnzG-0PzwcXrnZvD9v7DLQGoCar8Z-iRpKHO5vNiZlt9zQXeVwH2Th5koEyyyqXU0mE5ZFRrMoebvA5qk9pcsAhBDR_AFHqdfzIHdfE_Pj5eBXs2zF5ufUm_QY5auSxrzDVdZrIC5j0gwOg" />
                        <div className="absolute bottom-4 right-4 z-20 text-right">
                            <p className="text-xs text-[var(--color-primary)]/70 font-mono tracking-widest uppercase">System Status</p>
                            <p className="text-sm text-white font-bold">ONLINE / SECURE</p>
                        </div>
                    </div>

                    {/* Login Actions */}
                    <div className="w-full space-y-4">
                        <button
                            onClick={signInWithGoogle}
                            className="w-full group relative flex items-center justify-center gap-3 px-6 py-4 bg-[var(--color-primary)] text-[var(--color-background)] font-bold rounded-lg hover:bg-white transition-all duration-300 shadow-[0_0_20px_rgba(13,242,128,0.4)]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                            </svg>
                            <span>התחבר באמצעות Google</span>
                        </button>
                    </div>

                    {/* Footer Links */}
                    <div className="mt-8 flex gap-4 text-xs text-[var(--color-text-muted)]">
                        <a className="hover:text-[var(--color-primary)] transition-colors" href="#">תנאי שימוש</a>
                        <span className="opacity-30">|</span>
                        <a className="hover:text-[var(--color-primary)] transition-colors" href="#">מדיניות פרטיות</a>
                        <span className="opacity-30">|</span>
                        <a className="hover:text-[var(--color-primary)] transition-colors" href="#">תמיכה</a>
                    </div>
                </div>

                {/* Decorative Info */}
                <div className="mt-8 text-center">
                    <p className="text-[var(--color-text-muted)] text-xs tracking-widest font-mono uppercase">
                        Enterprise Expense Management © 2026
                    </p>
                </div>
            </main>

            {/* Visual Accents */}
            <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-primary)]/30 to-transparent"></div>
            <div className="fixed bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--color-primary)]/20 to-transparent"></div>
        </div>
    );
}
