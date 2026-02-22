import { FileText, ArrowRight } from 'lucide-react';

export function TermsOfService({ onBack }: { onBack: () => void }) {
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
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/40">
                        <FileText className="w-6 h-6 text-purple-400" />
                    </div>
                    <h1 className="text-4xl font-black">תקנון ותנאי שימוש</h1>
                </div>

                <div className="prose prose-invert max-w-none space-y-8 text-[var(--color-text-muted)]">
                    <p className="text-lg">
                        עודכן לאחרונה: פברואר 2026
                    </p>
                    <p>
                        ברוכים הבאים ל-BestRest (להלן: ״המערכת״ או ״האפליקציה״). יובהר כי השימוש באפליקציה כפוף לתנאים המפורטים מטה.
                    </p>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">1. הגדרת השירות</h2>
                        <p>
                            BestRest היא פלטפורמת תוכנה כנגד שירות (SaaS) המיועדת לסיוע בניהול מסעדות ובתי עסק. המערכת מאפשרת סריקה, פענוח ידני ואוטומטי של חשבונות, מעקב אחר הוצאות, ניתוח נתונים, ושליחת דוחות לרואה החשבון.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">2. אחריות משתמש ודיוק נתונים</h2>
                        <ul className="list-disc pl-6 pr-6 space-y-2 mt-4">
                            <li>שירות ה-AI שמפענח נתונים מתוך חשבוניות (OCR) מהווה כלי עזר בלבד. <strong>חלה על המשתמש (בעל העסק) החובה המלאה לעבור, לבקר ולאמת את הנתונים בטרם השמירה במערכת או שליחתם לרואה החשבון.</strong></li>
                            <li>מובהר בזאת שאין יוצרי BestRest נושאים באחריות על הפסדים, שגיאות מס, קנסות, תביעות או נזקים ישירים/עקיפים שייגרמו מתלות במידע שמופק מהמערכת. המידע אינו מהווה תחליף לייעוץ מיסויי או פיננסי מקצועי.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">3. סליקה ומנויים (Paddle)</h2>
                        <p>
                            השירות ניתן בחינם באופן בסיסי (Freemium) ובהרשמה למנוי במסלולי Pro שונים לשם פתיחת תכונות מתקדמות.
                        </p>
                        <ul className="list-disc pl-6 pr-6 space-y-2 mt-4">
                            <li>התשלומים לאפליקציה מתבצעים באמצעות חברת <strong>Paddle.com</strong> אשר משמשת כ-Merchant of Record (מוכרת השירות הרשמית).</li>
                            <li>בעת תשלום, הנכם כפופים לחוקים, לתקנון ההחזרים, ולתנאי השימוש של Paddle.</li>
                            <li>תשלום מנוי Pro מקנה למשתמש גישה לתכונות (למשל סריקות AI ללא הגבלה, ייצוא לרו"ח) למשך תקופת התשלום הרלוונטית (חודש או שנה). המערכת מתחדשת אוטומטית אלא אם כן הופסקה על ידי המשתמש טרם תום התקופה.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">4. זמינות השירות</h2>
                        <p>
                            המערכת מופעלת בענן ברמת זמינות גבוהה. יחד עם זאת, אנו לא מתחייבים לפעולה רציפה ללא תקלות, השבתות שרת, או מניעת גישה עקב עדכונים ותחזוקת תוכנה.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">5. זכויות קניין רוחני</h2>
                        <p>
                            כל זכויות הקניין הרוחני על הקוד, העיצוב, הממשק, הרעיון, ההרחבות ואלגוריתמי החישוב שייכות ליוצרי BestRest. אין להעתיק, לשכפל, להנדס לאחור או להשתמש בנכסים הדיגיטליים שלנו למטרות מסחריות מתחרות.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">6. מדיניות ביטולים והחזרים (Refund Policy)</h2>
                        <p>
                            שימו לב: מכיוון שתהליך הסליקה עובר דרך שותפנו לקבלת התשלום (Paddle), הבקשות להחזרים מתנהלות דרכם.
                        </p>
                        <ul className="list-disc pl-6 pr-6 space-y-2 mt-4">
                            <li>המשתמש רשאי לבטל את מנוי הפרימיום בכל עת דרך תפריט הגדרות החשבון המפנה לפורטל הלקוחות של Paddle. הביטול ייכנס לתוקף בתום תקופת המנוי אשר שולמה (חודשית/שנתית).</li>
                            <li>החזר מלא יינתן רק בתנאי שנתבקש עד 14 יום מרגע רכישת המנוי הראשונית (על פי חוק הגנת הצרכן לעסקאות מכר מרחוק), ובתנאי שלא נעשה שימוש משמעותי בשירותים הנלווים באפליקציה בפרק זמן זה.</li>
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
}
