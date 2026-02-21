import { useState, useEffect } from 'react';
import {
    ScanLine,
    TrendingUp,
    BookOpen,
    FileSpreadsheet,
    Users,
    Zap,
    Check,
    ChevronDown,
    Star,
    ArrowLeft,
    ShieldCheck,
    MessageCircle,
    SendHorizonal,
} from 'lucide-react';
import './index.css';

// ──────────────────────────────────────────────
// DESIGN TOKENS (synced with index.css @theme)
// ──────────────────────────────────────────────
const C = {
    bg: '#0B1120',
    surface: '#1E293B',
    primary: '#10B981',
    primaryHover: '#059669',
    secondary: '#3B82F6',
    muted: '#94A3B8',
    border: '#334155',
};

// ──────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────

function GlowOrb({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <div
            className={`absolute rounded-full pointer-events-none blur-[120px] ${className}`}
            style={style}
        />
    );
}

function FeatureCard({
    icon: Icon,
    title,
    description,
    accent = C.primary,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
    accent?: string;
}) {
    return (
        <div className="group relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:border-white/20 hover:bg-white/8 transition-all duration-300 overflow-hidden">
            {/* Hover glow */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                    background: `radial-gradient(circle at 50% 0%, ${accent}18 0%, transparent 70%)`,
                }}
            />
            <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${accent}20`, border: `1px solid ${accent}40` }}
            >
                <Icon className="w-6 h-6" style={{ color: accent }} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{description}</p>
        </div>
    );
}

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <div className="text-center">
            <div className="text-4xl font-black text-white mb-1">{value}</div>
            <div className="text-sm" style={{ color: C.muted }}>{label}</div>
        </div>
    );
}

function PricingCard({
    plan,
    price,
    description,
    features,
    notIncluded,
    cta,
    highlighted,
    badge,
    onCta,
}: {
    plan: string;
    price: string;
    description: string;
    features: string[];
    notIncluded?: string[];
    cta: string;
    highlighted?: boolean;
    badge?: string;
    onCta?: () => void;
}) {
    return (
        <div
            className={`relative rounded-2xl p-8 flex flex-col transition-all duration-300 ${highlighted
                ? 'border-2 bg-gradient-to-b from-emerald-500/10 to-transparent shadow-[0_0_40px_rgba(16,185,129,0.25)]'
                : 'border bg-white/5 backdrop-blur-md border-white/10'
                }`}
            style={highlighted ? { borderColor: C.primary } : {}}
        >
            {badge && (
                <div
                    className="absolute -top-3 right-1/2 translate-x-1/2 text-xs font-black px-4 py-1 rounded-full"
                    style={{ backgroundColor: C.primary, color: '#0B1120' }}
                >
                    {badge}
                </div>
            )}
            <h3
                className="text-2xl font-black mb-1"
                style={{ color: highlighted ? C.primary : 'white' }}
            >
                {plan}
            </h3>
            <p className="text-sm mb-6" style={{ color: C.muted }}>{description}</p>
            <div className="text-4xl font-black text-white mb-8 flex items-baseline gap-2">
                {price}
                {price !== '₪0' && (
                    <span className="text-base font-normal" style={{ color: C.muted }}>
                        / חודש
                    </span>
                )}
                {price === '₪0' && (
                    <span className="text-base font-normal" style={{ color: C.muted }}>
                        לנצח
                    </span>
                )}
            </div>
            <ul className="space-y-3 mb-8 flex-1">
                {features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-white">
                        <Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: C.primary }} />
                        {f}
                    </li>
                ))}
                {notIncluded?.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm" style={{ color: C.muted }}>
                        <span className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center text-xs">✕</span>
                        {f}
                    </li>
                ))}
            </ul>
            <button
                onClick={onCta}
                className="w-full py-4 rounded-xl font-black text-sm transition-all duration-300 active:scale-95"
                style={
                    highlighted
                        ? {
                            backgroundColor: C.primary,
                            color: '#0B1120',
                            boxShadow: `0 0 20px ${C.primary}66`,
                        }
                        : {
                            backgroundColor: 'rgba(255,255,255,0.08)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.12)',
                        }
                }
            >
                {cta}
            </button>
        </div>
    );
}

function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div
            className="border border-white/10 rounded-2xl overflow-hidden cursor-pointer"
            onClick={() => setOpen((p) => !p)}
        >
            <div className="flex items-center justify-between p-5 bg-white/5 hover:bg-white/8 transition-colors">
                <span className="font-bold text-sm text-white">{q}</span>
                <ChevronDown
                    className="w-5 h-5 shrink-0 transition-transform duration-300"
                    style={{
                        color: C.primary,
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                />
            </div>
            {open && (
                <div className="px-5 pb-5 pt-3 bg-white/3 text-sm leading-relaxed" style={{ color: C.muted }}>
                    {a}
                </div>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────
// MAIN LANDING PAGE
// ──────────────────────────────────────────────

interface LandingPageProps {
    onLogin: () => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handler);
        return () => window.removeEventListener('scroll', handler);
    }, []);

    const handleUpgrade = () => {
        const phone = '972500000000';
        const text = 'היי, אני מעוניין להצטרף ל-BestRest Pro!';
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    };

    const features = [
        {
            icon: ScanLine,
            title: 'סריקת חשבוניות AI',
            description:
                'צלם את החשבונית מהספק — ה-AI מזהה ספק, סכום, פריטים וכל שורה בתוך שניות. לא עוד קלדנות ידנית.',
        },
        {
            icon: TrendingUp,
            title: 'התראות התייקרות מחירים',
            description:
                'המערכת עוקבת אחר כל ספק באופן אוטומטי ומתריעה מיידית כשמחיר פריט עולה — לפני שהרווח נפגע.',
            accent: C.secondary,
        },
        {
            icon: BookOpen,
            title: 'Recipe Builder — בניית מתכונים',
            description:
                'בנה מתכונים עם עלויות חכמות: המערכת מחשבת את ה-Food Cost לכל מנה באופן אוטומטי לפי מחירי הספקים.',
        },
        {
            icon: FileSpreadsheet,
            title: 'ייצוא ושליחה לרואה חשבון',
            description:
                'ייצא דוחות חשבוניות לאקסל או שלח ישירות לרו"ח בלחיצה אחת. תוך שניות, בלי אימיילים ידניים.',
            accent: '#8B5CF6',
        },
        {
            icon: Users,
            title: 'ניהול עובדים ומשתמשים',
            description:
                'הוסף מנהלי משמרת ועובדים למערכת עם הרשאות נפרדות. כל אחד רואה רק מה שצריך.',
            accent: '#F59E0B',
        },
        {
            icon: Zap,
            title: 'דשבורד בזמן אמת',
            description:
                'תמונה מיידית על כל ההוצאות, ספק מוביל, השוואה חודשית ומגמות — הכל בולט ומסודר.',
            accent: '#EC4899',
        },
    ];

    const faqs = [
        {
            q: 'כמה זמן לוקח להגדיר את המערכת?',
            a: 'הגדרה ראשונית אורכת פחות מ-3 דקות: נרשמים, מזינים שם המסעדה, ואפשר להתחיל לסרוק חשבוניות. לא נדרשת טכנאות.',
        },
        {
            q: 'האם הנתונים מאובטחים?',
            a: 'כן. הנתונים שמורים ב-Firestore של Google עם הפרדה מלאה בין עסקים שונים. לאף מסעדה אין גישה לנתוני מסעדה אחרת.',
        },
        {
            q: 'מה קורה כשמגיע לגבול 5 סריקות בחינם?',
            a: 'מוצגת הודעה ידידותית ואפשרות לשדרג. ניהול המתכונים, דשבורד ועובדים נשארים פתוחים גם בחינם — רק הסריקה מוגבלת.',
        },
        {
            q: 'האם יש חוזה? מה קורה אם רוצים לבטל?',
            a: 'אין שום התחייבות. המנוי חודשי ואפשר לבטל בכל עת. ביטול מיידי — ללא קנסות.',
        },
        {
            q: 'האם זה עובד על הטלפון?',
            a: 'כן, BestRest בנוי Mobile-First. צלם חשבונית ישירות מהטלפון, עם ממשק מותאם למסך קטן.',
        },
    ];

    return (
        <div
            className="min-h-screen font-sans overflow-x-hidden"
            style={{ backgroundColor: C.bg, color: 'white', direction: 'rtl' }}
        >
            {/* ── BACKGROUND ELEMENTS ── */}
            <GlowOrb className="top-0 right-0 w-[500px] h-[500px] opacity-20" style={{ background: C.primary }} />
            <GlowOrb className="top-1/3 left-0 w-[400px] h-[400px] opacity-10" style={{ background: C.secondary }} />
            <GlowOrb className="bottom-0 right-1/3 w-[600px] h-[400px] opacity-10" style={{ background: C.primary }} />
            {/* Grid overlay */}
            <div
                className="fixed inset-0 pointer-events-none opacity-30"
                style={{
                    backgroundImage: `linear-gradient(to right, ${C.primary}09 1px, transparent 1px), linear-gradient(to bottom, ${C.primary}09 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* ── NAVBAR ── */}
            <nav
                className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled
                    ? 'bg-[#0B1120]/80 backdrop-blur-lg border-b border-white/10 py-3'
                    : 'py-5'
                    }`}
            >
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${C.primary}20`, border: `1px solid ${C.primary}50` }}
                        >
                            <ScanLine className="w-5 h-5" style={{ color: C.primary }} />
                        </div>
                        <span className="text-lg font-black">
                            Best<span style={{ color: C.primary }}>Rest</span>
                        </span>
                    </div>

                    {/* Nav links – desktop */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: C.muted }}>
                        <a href="#features" className="hover:text-white transition-colors">יכולות</a>
                        <a href="#pricing" className="hover:text-white transition-colors">מחירים</a>
                        <a href="#faq" className="hover:text-white transition-colors">שאלות נפוצות</a>
                    </div>

                    {/* CTA */}
                    <button
                        onClick={onLogin}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:scale-95"
                        style={{ backgroundColor: C.primary, color: '#0B1120' }}
                    >
                        התחל בחינם
                    </button>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section className="relative pt-40 pb-28 px-6 max-w-6xl mx-auto">
                <div className="max-w-2xl">
                    {/* Badge */}
                    <div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-8 border"
                        style={{ backgroundColor: `${C.primary}12`, borderColor: `${C.primary}30`, color: C.primary }}
                    >
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: C.primary }} />
                        ✨ מנהל מסעדות חכם, מבוסס AI
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black leading-[1.1] tracking-tight mb-6">
                        נהל את{' '}
                        <span
                            className="inline-block"
                            style={{
                                background: `linear-gradient(135deg, ${C.primary}, #34D399)`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            הכסף
                        </span>{' '}
                        של המסעדה שלך
                    </h1>

                    <p className="text-lg leading-relaxed mb-10" style={{ color: C.muted }}>
                        סרוק חשבוניות בשניות עם AI, עקוב אחרי עלויות הספקים בזמן אמת,
                        ויצא דוחות לרואה חשבון — הכל ממסך אחד, בעברית מלאה.
                    </p>

                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            onClick={onLogin}
                            className="group flex items-center gap-2 px-8 py-4 rounded-xl font-black text-base transition-all hover:brightness-110 active:scale-95"
                            style={{
                                backgroundColor: C.primary,
                                color: '#0B1120',
                                boxShadow: `0 0 30px ${C.primary}55`,
                            }}
                        >
                            התחל בחינם — ללא כרטיס אשראי
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <a
                            href="#features"
                            className="flex items-center gap-2 px-6 py-4 rounded-xl font-bold text-sm border border-white/10 hover:bg-white/8 transition-all"
                            style={{ color: C.muted }}
                        >
                            גלה יותר
                        </a>
                    </div>

                    {/* Trust badges */}
                    <div className="flex flex-wrap items-center gap-6 mt-10 text-xs font-medium" style={{ color: C.muted }}>
                        <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" style={{ color: C.primary }} />
                            נתונים מאובטחים
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            ללא התחייבות
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Check className="w-4 h-4" style={{ color: C.primary }} />
                            5 סריקות AI חינם
                        </span>
                    </div>
                </div>

                {/* Dashboard preview card */}
                <div
                    className="hidden lg:block absolute left-6 top-1/2 -translate-y-1/2 w-[420px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
                    style={{ backgroundColor: C.surface }}
                >
                    {/* Mock header */}
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                        <span className="text-xs mr-2 font-bold" style={{ color: C.muted }}>BestRest Dashboard</span>
                    </div>
                    {/* Mock KPI row */}
                    <div className="p-4 grid grid-cols-2 gap-3">
                        {[
                            { label: 'הוצאות החודש', value: '₪48,320', color: C.primary },
                            { label: 'חשבוניות שנסרקו', value: '84', color: C.secondary },
                            { label: 'ספק מוביל', value: 'תמר בע"מ', color: '#F59E0B' },
                            { label: 'מגמת מחירים', value: '+8% ⚡', color: '#EF4444' },
                        ].map((kpi) => (
                            <div key={kpi.label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                                    {kpi.label}
                                </p>
                                <p className="text-lg font-black" style={{ color: kpi.color }}>{kpi.value}</p>
                            </div>
                        ))}
                    </div>
                    {/* Mock table rows */}
                    <div className="px-4 pb-4 space-y-2">
                        {[
                            { supplier: 'יוסף ייצוא', cat: 'חומרי גלם', total: '₪5,200' },
                            { supplier: 'ביח בשר', cat: 'חומרי גלם', total: '₪3,840' },
                            { supplier: 'ברנר שתייה', cat: 'שתייה', total: '₪1,120' },
                        ].map((row) => (
                            <div key={row.supplier} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-2">
                                <span className="font-bold text-white">{row.supplier}</span>
                                <span
                                    className="px-2 py-0.5 rounded"
                                    style={{ backgroundColor: C.surface, color: C.muted }}
                                >
                                    {row.cat}
                                </span>
                                <span className="font-black" style={{ color: C.primary }}>{row.total}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── STATS STRIP ── */}
            <section
                className="relative py-16 border-y border-white/5"
                style={{ background: `linear-gradient(to bottom, ${C.surface}40, transparent)` }}
            >
                <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
                    <Stat value="500+" label="מסעדות רשומות" />
                    <Stat value="12,000+" label="חשבוניות נסרקו" />
                    <Stat value="3 שנ׳" label="חיסכון ממוצע לחשבונית" />
                    <Stat value="₪299" label="פחות ממנהל חשבונות" />
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: C.primary }}>
                        יכולות המערכת
                    </p>
                    <h2 className="text-4xl md:text-5xl font-black">
                        הכלים שמסעדות{' '}
                        <span style={{ color: C.primary }}>רווחיות</span> משתמשות בהם
                    </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((f) => (
                        <FeatureCard key={f.title} {...f} />
                    ))}
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section
                className="py-24 px-6"
                style={{ background: `linear-gradient(to bottom, transparent, ${C.surface}30, transparent)` }}
            >
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: C.primary }}>
                            איך זה עובד
                        </p>
                        <h2 className="text-4xl font-black">3 צעדים פשוטים</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        {/* Connector line */}
                        <div className="hidden md:block absolute top-8 right-[16.5%] left-[16.5%] h-px border-t border-dashed border-white/15" />
                        {[
                            {
                                num: '01',
                                title: 'נרשמים',
                                desc: 'הרשמה ב-30 שניות. שם מסעדה, אימייל וסיסמה — ואפשר להתחיל.',
                            },
                            {
                                num: '02',
                                title: 'סורקים חשבונית',
                                desc: 'צלם בטלפון. ה-AI מושך ספק, סכום, ופריטים — ושואל לאישור.',
                            },
                            {
                                num: '03',
                                title: 'שולטים בעלויות',
                                desc: 'דשבורד חי, התראות התייקרות, ייצוא לרו"ח בלחיצה אחת.',
                            },
                        ].map((step) => (
                            <div key={step.num} className="flex flex-col items-center text-center relative z-10">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black mb-4"
                                    style={{
                                        backgroundColor: `${C.primary}18`,
                                        border: `2px solid ${C.primary}50`,
                                        color: C.primary,
                                    }}
                                >
                                    {step.num}
                                </div>
                                <h3 className="text-lg font-black text-white mb-2">{step.title}</h3>
                                <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── PRICING ── */}
            <section id="pricing" className="py-24 px-6 max-w-5xl mx-auto">
                <div className="text-center mb-16">
                    <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: C.primary }}>
                        מחירים
                    </p>
                    <h2 className="text-4xl md:text-5xl font-black">
                        מחיר שמתאים לכל מסעדה
                    </h2>
                    <p className="text-base mt-4 max-w-xl mx-auto" style={{ color: C.muted }}>
                        התחל בחינם ושדרג רק כשאתה מוכן. ללא חוזה, ללא הפתעות.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <PricingCard
                        plan="חינם"
                        price="₪0"
                        description="לניסיון ראשון ולמסעדות קטנות"
                        features={[
                            'ניהול מתכונים מלא (Recipe Builder)',
                            'ניהול עד 10 עובדים',
                            '5 סריקות AI לחודש',
                            'דשבורד הוצאות בסיסי',
                        ]}
                        notIncluded={[
                            'התראות אוטומטיות על התייקרויות',
                            'ייצוא לאקסל / CSV לרו"ח',
                            'סריקות ללא הגבלה',
                        ]}
                        cta="התחל בחינם"
                        onCta={onLogin}
                    />
                    <PricingCard
                        plan="Pro ⭐"
                        price="₪299"
                        description="לשליטה מלאה וחיסכון ענק בזמן"
                        features={[
                            'סריקת חשבוניות AI — ללא הגבלה',
                            'בוט התראות על התייקרות מחירים',
                            'ייצוא לאקסל + שליחה לרו"ח',
                            'סריקת תפריטים לבניית מתכונים',
                            'משתמשים ועובדים ללא הגבלה',
                            'תמיכה עסקית בוואטסאפ',
                        ]}
                        cta="שדרג עכשיו בוואטסאפ"
                        highlighted
                        badge="הכי פופולרי"
                        onCta={handleUpgrade}
                    />
                </div>
            </section>

            {/* ── TESTIMONIAL ── */}
            <section
                className="py-20 px-6"
                style={{ background: `linear-gradient(to bottom, transparent, ${C.surface}40, transparent)` }}
            >
                <div className="max-w-3xl mx-auto text-center space-y-8">
                    <p className="text-sm font-bold uppercase tracking-widest" style={{ color: C.primary }}>
                        אומרים עלינו
                    </p>
                    <blockquote className="text-2xl md:text-3xl font-bold leading-relaxed text-white">
                        "BestRest חסך לי שעות של קלדנות כל חודש. עכשיו אני יודע בדיוק כמה כל מנה עולה לי — ומתי ספק מעלה מחיר."
                    </blockquote>
                    <div className="flex items-center justify-center gap-3">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black"
                            style={{ backgroundColor: `${C.primary}20`, color: C.primary }}
                        >
                            א
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-white text-sm">אמיר כהן</p>
                            <p className="text-xs" style={{ color: C.muted }}>בעלים, מסעדת הגריל הגדול — תל אביב</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                        {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section id="faq" className="py-24 px-6 max-w-3xl mx-auto">
                <div className="text-center mb-12">
                    <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: C.primary }}>
                        שאלות נפוצות
                    </p>
                    <h2 className="text-4xl font-black">יש לך שאלות?</h2>
                </div>
                <div className="space-y-4">
                    {faqs.map((f) => (
                        <FaqItem key={f.q} {...f} />
                    ))}
                </div>
            </section>

            {/* ── FINAL CTA ── */}
            <section className="py-24 px-6">
                <div
                    className="max-w-4xl mx-auto rounded-3xl p-12 text-center relative overflow-hidden border border-white/10"
                    style={{ background: `linear-gradient(135deg, ${C.primary}18, ${C.secondary}10)` }}
                >
                    <GlowOrb className="top-0 right-0 w-64 h-64 opacity-30" style={{ background: C.primary }} />
                    <GlowOrb className="bottom-0 left-0 w-64 h-64 opacity-20" style={{ background: C.secondary }} />
                    <div className="relative z-10">
                        <h2 className="text-4xl md:text-5xl font-black mb-4">
                            מוכן לשלוט בעלויות?
                        </h2>
                        <p className="text-lg mb-10 max-w-lg mx-auto" style={{ color: C.muted }}>
                            הצטרף למאות מסעדות שכבר חוסכות זמן וכסף עם BestRest.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-4">
                            <button
                                onClick={onLogin}
                                className="flex items-center gap-2 px-10 py-4 rounded-xl font-black text-base transition-all hover:brightness-110 active:scale-95"
                                style={{
                                    backgroundColor: C.primary,
                                    color: '#0B1120',
                                    boxShadow: `0 0 40px ${C.primary}66`,
                                }}
                            >
                                <SendHorizonal className="w-5 h-5" />
                                התחל עכשיו — בחינם
                            </button>
                            <button
                                onClick={handleUpgrade}
                                className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm border border-white/15 hover:bg-white/8 transition-all"
                                style={{ color: 'white' }}
                            >
                                <MessageCircle className="w-5 h-5" style={{ color: C.primary }} />
                                שוחח איתנו בוואטסאפ
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="border-t border-white/10 py-10 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${C.primary}20` }}
                        >
                            <ScanLine className="w-4 h-4" style={{ color: C.primary }} />
                        </div>
                        <span className="font-black text-sm">
                            Best<span style={{ color: C.primary }}>Rest</span>
                        </span>
                    </div>
                    <p className="text-xs" style={{ color: C.muted }}>
                        © {new Date().getFullYear()} BestRest — מנהל המסעדה החכם
                    </p>
                    <div className="flex items-center gap-6 text-xs" style={{ color: C.muted }}>
                        <a href="#" className="hover:text-white transition-colors">פרטיות</a>
                        <a href="#" className="hover:text-white transition-colors">תנאי שימוש</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
