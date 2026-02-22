import { CreditCard, ArrowRight } from 'lucide-react';

export function RefundPolicy({ onBack }: { onBack: () => void }) {
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
                    <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/40">
                        <CreditCard className="w-6 h-6 text-orange-400" />
                    </div>
                    <h1 className="text-4xl font-black">מדיניות ביטולים והחזרים (Refund Policy)</h1>
                </div>

                <div className="prose prose-invert max-w-none space-y-8 text-[var(--color-text-muted)]">
                    <p className="text-lg text-white font-medium">
                        תשלומים עבור שירותי הפרימיום באפליקציית BestRest (תוכנית Pro / Enterprise) מתבצעים ומנוהלים על ידי ספקית הסליקה והרישיונות המורשית שלנו, חברת Paddle.com.
                    </p>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">1. אופן ביטול המנוי</h2>
                        <p>
                            משתמשים יכולים לבטל את המנוי שלהם בכל עת דרך כפתור "ניהול מנוי" בעמוד ההגדרות (Subscription) בתוך המערכת.
                            לחיצה על הכפתור תוביל ישירות לפורטל ניהול הלקוחות המאובטח של Paddle, שם ניתן לבטל את החידוש האוטומטי בלחיצת כפתור.
                            ביטול מינוי משמעו שהחיוב הבא (בחודש או בשנה הבאה) לא יתבצע, והמשתמש יוכל להמשיך להנות מתכונות הפרימיום עד תום התקופה שכבר שולמה.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">2. תנאים להחזר כספי (Refund)</h2>
                        <ul className="list-disc pl-6 pr-6 space-y-2 mt-4">
                            <li>
                                <strong>ביטול תוך 14 יום ממועד הרכישה המקורית:</strong> במידה והלקוח התחרט ומעוניין בביטול שירות הפרימיום (Subscription) שרכש, ניתן לבקש החזר מלא ולקבל את כספו חזרה עד 14 יום מתאריך פתיחת המנוי המקורית. בקשות שיגיעו לאחר מכן לא יזוכו בגין התקופה שכבר שולמה.
                            </li>
                            <li>
                                <strong>מנויים מתחדשים (חידוש חודשי / שנתי):</strong> החזרים עבור חידוש מנוי שכבר התבצע - לפי חוק, לא יינתנו החזרים קבועים על חידושים שבוצעו, למעט במקרה של שגיאה טכנית חמורה או כפוף לשיקולי שימור שירות הלקוחות בכתובת hello@bestrestapp.com.
                            </li>
                            <li>
                                על מנת לדרוש החזר, על המשתמש ליצור קשר בהקדם האפשרי עם התמיכה שלנו במייל <strong>hello@bestrestapp.com</strong> ו/או במקביל מול שירות הלקוחות של Paddle בקישור שזמין בחשבוניות המייל שמתקבלות מהם.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">3. עיבוד ההחזר</h2>
                        <p>
                            לאחר שאישרנו או ש-Paddle מקבלים ומאשרים את בקשת ההחזר במסגרת 14 הימים, ההחזר הכספי (Refund) יופק אל כרטיס האשראי שממנו בוצעה העסקה, ותוך 3-5 ימי עסקים בלבד, בהתאם לזמני חברות האשראי.
                            חשבון המשתמש באפליקציית BestRest יחזור אוטומטית למסלול ה-Free על כל הגבלותיו.
                        </p>
                    </section>

                </div>
            </div>
        </div>
    );
}
