import { Shield, ArrowRight } from 'lucide-react';

export function PrivacyPolicy({ onBack }: { onBack: () => void }) {
    return (
        <div className="bg-[var(--color-background)] min-h-screen text-white font-display" dir="rtl">
            {/* Background Decor */}
            <div className="fixed inset-0 pointer-events-none opacity-40 bg-[linear-gradient(to_right,rgba(13,242,128,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(13,242,128,0.05)_1px,transparent_1px)] bg-[size:30px_30px]"></div>

            <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-white transition-colors mb-12"
                >
                    <ArrowRight className="w-5 h-5" />
                    חזרה
                </button>

                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/20 flex items-center justify-center border border-[var(--color-primary)]/40">
                        <Shield className="w-6 h-6 text-[var(--color-primary)]" />
                    </div>
                    <h1 className="text-4xl font-black">מדיניות פרטיות</h1>
                </div>

                <div className="prose prose-invert max-w-none space-y-8 text-[var(--color-text-muted)]">
                    <p className="text-lg">
                        עודכן לאחרונה: פברואר 2026
                    </p>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">1. איסוף מידע</h2>
                        <p>
                            אנו אוספים את המידע הבא בעת השימוש במערכת BestRest:
                        </p>
                        <ul className="list-disc pl-6 pr-6 space-y-2 mt-4">
                            <li>מידע בסיסי אודות המשתמש (שם, אימייל, פרטי התחברות) שמסופק על ידי Google Auth.</li>
                            <li>פרטי העסק והגדרות מערכת (כגון קטגוריות, כתובת אימייל של רואה החשבון).</li>
                            <li>נתוני חשבוניות המועלים למערכת, כולל הצילומים, הפענוח באמצעות AI, היקפי ההוצאות ופרטי ספקים.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">2. שימוש במידע</h2>
                        <p>
                            המידע נאסף ומשמש לצרכים הבאים:
                        </p>
                        <ul className="list-disc pl-6 pr-6 space-y-2 mt-4">
                            <li>מתן שירותי ניהול ומעקב אחר הוצאות העסק בצורה תקינה ורציפה.</li>
                            <li>שימוש בכלים טכנולוגיים (AI ו-OCR) לפענוח יעיל של הנתונים הפיננסיים בחשבוניות.</li>
                            <li>שליחת נתונים בצורה מרוכזת לרואה החשבון לבקשת הלקוח.</li>
                            <li>שיפור חווית המשתמש ופיתוח תכונות חדשות בפלטפורמה (כגון Market Insights בעילום שם).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">3. שיתוף מידע עם צדדים שלישיים</h2>
                        <p>
                            איננו מוכרים את המידע האישי או העסקי שלכם. המידע משותף עם צדדים שלישיים רק בנסיבות הבאות:
                        </p>
                        <ul className="list-disc pl-6 pr-6 space-y-2 mt-4">
                            <li><strong>ספקי שירותים טכניים:</strong> כגון שירותי ענן (Firebase), שליחת אימיילים (Resend) ושירותי AI - אשר מחויבים לשמירה על סודיות ואבטחת המידע.</li>
                            <li><strong>סליקה:</strong> נתוני תשלומים מעובדים מאובטחת על ידי חברת Paddle (Merchant of Record). נתוני אשראי אינם נשמרים בשרתי BestRest.</li>
                            <li>על פי דרישה חוקית מרשויות מוסמכות.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">4. אבטחת מידע</h2>
                        <p>
                            אנו מטמיעים אמצעים חדישים לאבטחת המידע שלכם. שרתי האפליקציה (Google Firebase ו-Vercel) עומדים בתקני האבטחה הגבוהים ביותר המקובלים בתעשייה כדי להגן על נתונים אישיים ועסקיים מפני גישה או דליפה לא מורשית.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">5. יצירת קשר</h2>
                        <p>
                            לכל שאלה, בקשה להסרת מידע, או בירור בנושא פרטיות, ניתן לפנות אלינו בכתובת:
                            <br />
                            <strong>hello@bestrestapp.com</strong>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
