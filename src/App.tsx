import { LayoutDashboard, Receipt, LogOut, Plus, Search, Download, Users, Settings, Trash2 } from 'lucide-react';
import './index.css';
import { AuthProvider, useAuth } from './AuthContext';
import { Login } from './Login';
import { Onboarding } from './Onboarding';
import { Cookbook } from './Cookbook';
import { useRef, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

// Firebase Storage import removed — uploads now go directly to OCR API as base64
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

function Dashboard() {
  const { user, role, businessId, businessName, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [ocrResult, setOcrResult] = useState<any>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedExpenseForPreview, setSelectedExpenseForPreview] = useState<any | null>(null);

  // Custom Categories and Business Settings
  const defaultCategories = ["חומרי גלם", "שתייה", "אלכוהול", "ציוד", "תחזוקה", "שכירות", "עובדים", "חשמל / מים / גז", "כללי"];
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const allCategories = Array.from(new Set([...defaultCategories, ...customCategories]));
  const [accountantEmail, setAccountantEmail] = useState<string>('');

  // View State
  const [currentView, setCurrentView] = useState<'dashboard' | 'cookbook' | 'users'>('dashboard');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // New Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('הכל');

  useEffect(() => {
    if (!user || !businessId) return;

    const q = query(
      collection(db, 'expenses'),
      where('businessId', '==', businessId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(docs);
      setLoadingExpenses(false);
    }, (error) => {
      console.error("Firestore expenses snapshot error:", error);
      setLoadingExpenses(false);
      setNotification({ type: 'error', message: 'שגיאה בטעינת נתונים. בדוק את ה-Console לצורך יצירת אינדקס.' });
    });

    return () => unsubscribe();
  }, [user, businessId]);

  // Load Business Settings (custom categories + accountant email)
  useEffect(() => {
    if (!businessId) return;
    const unsub = onSnapshot(doc(db, 'businesses', businessId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCustomCategories(data.customCategories || []);
        setAccountantEmail(data.accountantEmail || '');
      }
    });
    return () => unsub();
  }, [businessId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Show 0% progress while encoding
    setUploadProgress(0);

    let base64Image = '';

    try {
      // Read file as base64 and send directly to OCR API — no CORS issues
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data URL prefix (e.g. "data:image/jpeg;base64,")
          const b64 = result.split(',')[1];
          base64Image = result; // Keep full data URL for display
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setUploadProgress(50);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type || 'image/jpeg',
        })
      });

      setUploadProgress(100);
      const result = await response.json();

      if (result.success) {
        // Auto-assign category based on history if AI failed or returned 'כללי'
        let finalCategory = result.data.category;
        if (finalCategory === "כללי") {
          const pastExpense = expenses.find(e => e.supplier === result.data.supplier);
          if (pastExpense) {
            finalCategory = pastExpense.category;
          }
        }

        // Result from /api/ocr (main pipe with pure-code triplet parser)
        const lineItems = result.data.lineItems || [];

        setOcrResult({
          ...result.data,
          category: finalCategory,
          lineItems,
          imageUrl: base64Image // Store full base64 data URL
        });
        setIsReviewing(true);
      } else {
        console.error('OCR API error:', result.error);
      }
    } catch (err) {
      console.error('OCR processing failed:', err);
    } finally {
      setUploadProgress(null);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const saveExpense = async (finalData: any) => {
    if (!user || !businessId) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        ...finalData,
        userId: user.uid,
        userName: user.displayName,
        businessId: businessId,
        createdAt: serverTimestamp(),
      });

      // Save line items to inventory collection
      if (finalData.lineItems && finalData.lineItems.length > 0) {
        for (const item of finalData.lineItems) {
          if (!item.name || !item.pricePerUnit) continue;

          // Use canonical name as the document key
          const itemId = item.name.trim().replace(/\s+/g, '_').toLowerCase();
          const itemRef = doc(db, 'businesses', businessId, 'inventory', itemId);

          // Read existing to capture previousPrice and existing aliases
          const existingSnap = await getDoc(itemRef);
          const existingData = existingSnap.exists() ? existingSnap.data() : null;

          // Build aliases: merge existing ones with rawName (original OCR name) if different
          const existingAliases: string[] = existingData?.aliases || [];
          const rawName = item.rawName || item.name; // rawName = original OCR output before user edit
          const newAliases = Array.from(new Set([
            ...existingAliases,
            ...(rawName !== item.name ? [rawName.trim().toLowerCase()] : [])
          ]));

          await setDoc(itemRef, {
            name: item.name,
            aliases: newAliases,
            lastPrice: item.pricePerUnit,
            previousPrice: existingData?.lastPrice || item.pricePerUnit,
            unit: item.unit || 'unit',
            supplier: finalData.supplier || '',
            lastDate: finalData.date || new Date().toLocaleDateString('he-IL'),
            quantity: item.quantity || 1,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      }

      setIsReviewing(false);
      setOcrResult(null);
      setNotification({ type: 'success', message: 'החשבונית נשמרה בהצלחה! ✓' });
    } catch (error) {
      console.error("Error saving expense", error);
      setNotification({ type: 'error', message: 'שגיאה בשמירת החשבונית. נסה שוב.' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
      setDeleteConfirmId(null);
      setNotification({ type: 'success', message: 'החשבונית נמחקה בהצלחה.' });
    } catch (error) {
      console.error('Error deleting expense:', error);
      setNotification({ type: 'error', message: 'שגיאה במחיקת החשבונית.' });
    }
  };

  const addCustomCategory = async (newCategory: string) => {
    if (!businessId) return;
    try {
      const bizRef = doc(db, 'businesses', businessId);
      const updatedCategories = Array.from(new Set([...customCategories, newCategory]));
      await setDoc(bizRef, { customCategories: updatedCategories }, { merge: true });
    } catch (error) {
      console.error("Error adding custom category:", error);
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'הכל' || exp.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleExport = () => {
    if (filteredExpenses.length === 0) {
      setNotification({ type: 'error', message: 'אין נתונים לייצוא' });
      return;
    }
    try {
      // Use a hidden iframe to receive the download — avoids SPA interference
      const iframeName = 'export_frame_' + Date.now();
      const iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/export';
      form.target = iframeName; // submit into the iframe
      form.style.display = 'none';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'expenses';
      input.value = JSON.stringify(filteredExpenses);
      form.appendChild(input);

      document.body.appendChild(form);
      form.submit();

      // Cleanup after download starts
      setTimeout(() => {
        document.body.removeChild(form);
        document.body.removeChild(iframe);
      }, 5000);

      setNotification({ type: 'success', message: 'קובץ CSV נוצר בהצלחה ✓' });
    } catch (err) {
      console.error('Export error:', err);
      setNotification({ type: 'error', message: 'שגיאה בייצוא. נסה שוב.' });
    }
  };



  const sendReportToAccountant = async () => {
    // Only send expenses that haven't been sent yet
    const unsentExpenses = filteredExpenses.filter(exp => !exp.isSent);

    if (unsentExpenses.length === 0) {
      setNotification({ type: 'error', message: 'אין חשבוניות חדשות לשליחה' });
      return;
    }
    if (!accountantEmail) {
      setNotification({ type: 'error', message: 'לא הוגדר אימייל רואה חשבון. עדכן בהגדרות.' });
      return;
    }
    // Show the approval preview modal first
    setShowReportPreview(true);
  };

  const confirmSendReport = async () => {
    const unsentExpenses = filteredExpenses.filter(exp => !exp.isSent);
    setShowReportPreview(false);
    setIsSendingReport(true);
    try {
      const response = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses: unsentExpenses,
          userEmail: user?.email,
          userName: user?.displayName,
          accountantEmail,
          businessName,
        }),
      });
      const result = await response.json();
      if (result.success) {
        // Mark only the newly sent expenses as isSent: true in Firestore
        const markSentPromises = unsentExpenses.map(exp =>
          setDoc(doc(db, 'expenses', exp.id), { isSent: true }, { merge: true })
        );
        await Promise.all(markSentPromises);
        setNotification({ type: 'success', message: 'הדו״ח נשלח בהצלחה לרואה החשבון!' });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error sending report", error);
      setNotification({ type: 'error', message: 'שגיאה בשליחת הדו״ח. נסה שוב מאוחר יותר.' });
    } finally {
      setIsSendingReport(false);
    }
  };

  const monthlyTotal = expenses.reduce((sum, exp) => sum + (exp.total || 0), 0);
  const invoiceCount = expenses.length;
  const unsentCount = expenses.filter(exp => !exp.isSent).length;

  // Month-over-month comparison
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentMonthTotal = expenses
    .filter(exp => {
      if (!exp.createdAt?.toDate) return false;
      const d = exp.createdAt.toDate();
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, exp) => sum + (exp.total || 0), 0);
  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthTotal = expenses
    .filter(exp => {
      if (!exp.createdAt?.toDate) return false;
      const d = exp.createdAt.toDate();
      return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
    })
    .reduce((sum, exp) => sum + (exp.total || 0), 0);
  const monthlyChange = lastMonthTotal > 0
    ? (((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1)
    : null;

  // Top supplier by total spend
  const supplierTotals = expenses.reduce((acc, exp) => {
    if (exp.supplier) acc[exp.supplier] = (acc[exp.supplier] || 0) + (exp.total || 0);
    return acc;
  }, {} as Record<string, number>);
  const topSupplier = (Object.entries(supplierTotals) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  const topSupplierPct = topSupplier && monthlyTotal > 0
    ? Math.round((topSupplier[1] / monthlyTotal) * 100)
    : 0;

  // Price Rise Detector: compare average per-supplier cost this month vs last month
  const priceRiseAlerts = (Object.entries(supplierTotals) as [string, number][])
    .map(([supplier]) => {
      const thisMonth = expenses
        .filter(exp => {
          if (!exp.createdAt?.toDate) return false;
          const d = exp.createdAt.toDate();
          return exp.supplier === supplier && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
      const lastMonth = expenses
        .filter(exp => {
          if (!exp.createdAt?.toDate) return false;
          const d = exp.createdAt.toDate();
          return exp.supplier === supplier && d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
        });
      const avgThis = thisMonth.length > 0 ? thisMonth.reduce((s, e) => s + (e.total || 0), 0) / thisMonth.length : 0;
      const avgLast = lastMonth.length > 0 ? lastMonth.reduce((s, e) => s + (e.total || 0), 0) / lastMonth.length : 0;
      const pct = avgLast > 0 ? ((avgThis - avgLast) / avgLast) * 100 : 0;
      return { supplier, pct: Math.round(pct), avgThis, avgLast };
    })
    .filter(a => a.pct >= 10 && a.avgThis > 0 && a.avgLast > 0)
    .sort((a, b) => b.pct - a.pct);

  // Analytics Data Preparation
  const categoryData = Object.entries(
    filteredExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.total;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value: value as number })).sort((a, b) => b.value - a.value);

  const timeData = Object.entries(
    filteredExpenses.reduce((acc, exp) => {
      const dateParts = typeof exp.date === 'string' ? exp.date.split(/[/\.-]/) : [];
      const dateStr = dateParts.length >= 2 ? `${dateParts[0]}/${dateParts[1]}` : (exp.date || 'לא ידוע');
      acc[dateStr] = (acc[dateStr] || 0) + exp.total;
      return acc;
    }, {} as Record<string, number>)
  ).map(([date, total]) => ({ date, total }));

  const PIE_COLORS = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

  return (
    <div className="bg-[var(--color-background)] text-[var(--color-text-main)] min-h-screen relative overflow-x-hidden font-display" dir="rtl">
      {/* Notifications */}
      {notification && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full border backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 flex items-center gap-3 ${notification.type === 'success'
          ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/50 text-[var(--color-primary)]'
          : 'bg-[var(--color-danger)]/10 border-[var(--color-danger)]/50 text-[var(--color-danger)]'
          }`}>
          <div className={`w-2 h-2 rounded-full ${notification.type === 'success' ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-danger)]'} animate-pulse`}></div>
          <span className="text-sm font-bold">{notification.message}</span>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,application/pdf"
        onChange={handleFileUpload}
      />

      {/* Upload Progress Indicator */}
      {uploadProgress !== null && (
        <div className="fixed top-0 left-0 w-full h-1 z-[100] bg-white/10">
          <div
            className="h-full bg-[var(--color-primary)] transition-all duration-300 shadow-[0_0_10px_var(--color-primary)]"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}

      {/* Cyberpunk Background Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[linear-gradient(to_right,rgba(13,242,128,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(13,242,128,0.05)_1px,transparent_1px)] bg-[size:30px_30px]"></div>
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--color-primary)]/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header / Top Bar */}
        <header className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center border border-[var(--color-primary)]/40 overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Receipt className="w-6 h-6 text-[var(--color-primary)]" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-medium text-[var(--color-text-muted)]">{businessName || 'בסטרסט BestRest'}</h1>
              <h2 className="text-lg font-bold leading-none">שלום, {user?.displayName?.split(' ')[0] || 'מנהל משמרת'}</h2>
            </div>
          </div>
          {role !== 'accountant' && (
            <button
              onClick={triggerUpload}
              className="bg-[var(--color-primary)] text-[var(--color-background)] py-2 px-3 md:px-4 rounded-lg font-bold text-sm flex items-center gap-2 shadow-[0_0_15px_rgba(13,242,128,0.4)] hover:brightness-110 transition-all"
            >
              <Plus className="w-5 h-5 hidden md:block" />
              <Plus className="w-5 h-5 md:hidden" />
              <span className="hidden md:inline">הוסף חשבונית</span>
            </button>
          )}
        </header>

        <main className="flex-1 p-4 pb-24 space-y-6 max-w-7xl mx-auto w-full">
          {currentView === 'dashboard' ? (
            <>
              {/* KPI Cards Section */}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Card 1: Monthly Total */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-primary)]"></div>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">הוצאות החודש</p>
                  <h3 className="text-2xl font-black">₪{monthlyTotal.toLocaleString()}</h3>
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-bold">
                    {monthlyChange !== null ? (
                      <span className={`px-1.5 py-0.5 rounded ${parseFloat(monthlyChange) > 0
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        }`}>
                        {parseFloat(monthlyChange) > 0 ? '+' : ''}{monthlyChange}% מחודש שעבר
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">אין נתון השוואתי</span>
                    )}
                  </div>
                </div>

                {/* Card 2: Invoice Count */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
                  <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">חשבוניות שנסרקו</p>
                  <h3 className="text-2xl font-black">{invoiceCount}</h3>
                  <p className="text-[10px] mt-2">
                    {unsentCount > 0 ? (
                      <span className="text-orange-400">{unsentCount} ממתינות לרו״ח</span>
                    ) : (
                      <span className="text-[var(--color-primary)]">הכל נשלח ✓</span>
                    )}
                  </p>
                </div>

                {/* Card 3: Top Supplier (real data) */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
                  <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">ספק מוביל</p>
                  {topSupplier ? (
                    <>
                      <h3 className="text-lg font-bold truncate">{topSupplier[0]}</h3>
                      <p className="text-[10px] text-[var(--color-primary)] mt-1">₪{topSupplier[1].toLocaleString()} ({topSupplierPct}%)</p>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">אין נתונים</p>
                  )}
                </div>

                {/* Card 4: Price Rise Detector */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl relative">
                  <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider mb-1">מגמת מחירים ⚡</p>
                  {priceRiseAlerts.length > 0 ? (
                    <div className="space-y-1.5 mt-1">
                      {priceRiseAlerts.slice(0, 2).map(alert => (
                        <div key={alert.supplier} className="flex items-center justify-between">
                          <span className="text-[10px] text-white truncate max-w-[100px]">{alert.supplier}</span>
                          <span className="text-[10px] font-bold text-red-400 flex-shrink-0">+{alert.pct}%</span>
                        </div>
                      ))}
                      {priceRiseAlerts.length > 2 && (
                        <p className="text-[9px] text-[var(--color-text-muted)]">+{priceRiseAlerts.length - 2} ספקים נוספים</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse"></div>
                      <p className="text-xs text-[var(--color-primary)] font-bold">מחירים יציבים</p>
                    </div>
                  )}
                  {priceRiseAlerts.length > 0 && (
                    <button
                      onClick={sendReportToAccountant}
                      disabled={isSendingReport}
                      className="mt-2 w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-1 rounded-lg text-[9px] font-bold transition-all"
                    >
                      שלח התראה לרו״ח
                    </button>
                  )}
                </div>
              </section>

              {/* Analytics Charts Section */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl h-80 flex flex-col">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]"></span>
                    התפלגות הוצאות
                  </h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {categoryData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number | undefined) => `₪${(value || 0).toLocaleString()}`}
                          contentStyle={{ backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl h-80 flex flex-col">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-secondary)]"></span>
                    מגמת הוצאות
                  </h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₪${value}`} width={50} />
                        <RechartsTooltip
                          formatter={(value: number | undefined) => `₪${(value || 0).toLocaleString()}`}
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                        />
                        <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              {/* Filters & Actions Bar */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
                <div className="relative w-full md:w-96">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    placeholder="חיפוש ספק או קטגוריה..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pr-10 pl-4 text-sm focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                  {['הכל', ...allCategories].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeCategory === cat
                        ? 'bg-[var(--color-primary)] text-slate-900 shadow-[0_0_10px_rgba(13,242,128,0.3)]'
                        : 'bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10'
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl text-sm font-bold transition-all w-full md:w-auto justify-center"
                >
                  <Download className="w-4 h-4 text-[var(--color-primary)]" />
                  ייצוא לאקסל
                </button>
              </div>

              {/* Recent Activity Table Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[var(--color-primary)]" />
                    חשבוניות {searchQuery || activeCategory !== 'הכל' ? 'מסוננות' : 'אחרונות'}
                  </h3>
                  <button className="text-[var(--color-primary)] text-sm font-medium hover:underline cursor-pointer">הצג הכל</button>
                </div>

                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead className="bg-white/5 text-[var(--color-text-muted)] text-xs uppercase">
                        <tr>
                          <th className="p-4 font-semibold whitespace-nowrap">ספק</th>
                          <th className="p-4 font-semibold whitespace-nowrap">קטגוריה</th>
                          <th className="p-4 font-semibold whitespace-nowrap">סכום</th>
                          <th className="p-4 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {loadingExpenses ? (
                          <tr>
                            <td colSpan={3} className="p-8 text-center">
                              <div className="inline-block w-6 h-6 border-2 border-white/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                            </td>
                          </tr>
                        ) : filteredExpenses.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-8 text-center text-[var(--color-text-muted)] text-sm italic">
                              {expenses.length === 0 ? 'טרם נוספו חשבוניות' : 'לא נמצאו תוצאות לסינון הנוכחי'}
                            </td>
                          </tr>
                        ) : (
                          filteredExpenses.map((expense) => (
                            <tr
                              key={expense.id}
                              onClick={() => expense.imageUrl && setSelectedExpenseForPreview(expense)}
                              className={`transition-colors group ${expense.imageUrl ? 'hover:bg-white/10 cursor-pointer' : 'hover:bg-white/5'}`}
                            >
                              <td className="p-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-white group-hover:text-[var(--color-primary)] transition-colors">{expense.supplier}</span>
                                    {expense.isSent && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">נשלח</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-[var(--color-text-muted)]">{expense.date}</span>
                                </div>
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                <span className="px-2 py-1 rounded bg-[var(--color-surface)] text-[10px] text-gray-300">{expense.category}</span>
                              </td>
                              <td className="p-4 font-bold text-[var(--color-primary)] whitespace-nowrap">₪{expense.total?.toLocaleString()}</td>
                              <td className="p-4 whitespace-nowrap">
                                {(role === 'admin' || role === 'manager') && (
                                  deleteConfirmId === expense.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteExpense(expense.id); }}
                                        className="text-[10px] font-bold px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                      >מחק</button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                                        className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                                      >בטל</button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(expense.id); }}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300"
                                      title="מחק חשבונית"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          ) : currentView === 'cookbook' ? (
            <Cookbook />
          ) : (
            <UsersManagement />
          )}
        </main>

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 inset-x-0 bg-white/5 backdrop-blur-md border-t border-white/10 px-6 py-3 z-50 rounded-t-2xl">
          <div className="flex items-center justify-between max-w-md mx-auto relative">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'dashboard' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
            >
              <LayoutDashboard className="w-6 h-6" />
              <span className="text-[10px] font-bold">דשבורד</span>
            </button>
            <button
              onClick={() => setCurrentView('cookbook')}
              className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'cookbook' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
            >
              <Receipt className="w-6 h-6" />
              <span className="text-[10px] font-medium">מתכונים</span>
            </button>

            {role !== 'accountant' && (
              <button
                onClick={triggerUpload}
                className="bg-[var(--color-primary)] text-slate-900 p-3 rounded-full absolute -top-10 left-1/2 -translate-x-1/2 shadow-[0_0_15px_rgba(13,242,128,0.4)] hover:scale-110 transition-transform active:scale-95"
              >
                <Plus className="w-6 h-6" />
              </button>
            )}

            <button
              onClick={() => setCurrentView('users')}
              className={`flex flex-col items-center gap-1 transition-colors ml-12 ${currentView === 'users' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
            >
              <Settings className="w-6 h-6" />
              <span className="text-[10px] font-medium">{role === 'admin' ? 'משתמשים' : 'הגדרות'}</span>
            </button>
            <button onClick={logout} className="flex flex-col items-center gap-1 text-[var(--color-text-muted)]">
              <LogOut className="w-6 h-6" />
              <span className="text-[10px] font-medium">התנתק</span>
            </button>
          </div>
        </nav>

        {/* Review Modal */}
        {isReviewing && ocrResult && (
          <ReviewModal
            data={ocrResult}
            isSaving={isSaving}
            allCategories={allCategories}
            onClose={() => setIsReviewing(false)}
            onSave={saveExpense}
            onAddCategory={addCustomCategory}
          />
        )}

        {/* Image Preview Modal */}
        {selectedExpenseForPreview && (
          <ImagePreviewModal
            expense={selectedExpenseForPreview}
            onClose={() => setSelectedExpenseForPreview(null)}
          />
        )}

        {/* Report Approval Modal */}
        {showReportPreview && (
          <ReportPreviewModal
            expenses={filteredExpenses.filter(exp => !exp.isSent)}
            accountantEmail={accountantEmail}
            isSending={isSendingReport}
            onConfirm={confirmSendReport}
            onClose={() => setShowReportPreview(false)}
          />
        )}
      </div>
    </div>
  );
}

function ImagePreviewModal({ expense, onClose }: { expense: any, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white">{expense.supplier}</h2>
            <p className="text-xs text-[var(--color-text-muted)]">{expense.date} • ₪{expense.total?.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 bg-white/5 rounded-lg">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/20">
          <img
            src={expense.imageUrl}
            alt="Invoice"
            className="max-w-full h-auto rounded-lg shadow-2xl border border-white/5"
          />
        </div>
      </div>
    </div>
  );
}

function ReportPreviewModal({
  expenses,
  accountantEmail,
  isSending,
  onConfirm,
  onClose,
}: {
  expenses: any[];
  accountantEmail: string;
  isSending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const totalAmount = expenses.reduce((sum, exp) => sum + (exp.total || 0), 0);
  const withImages = expenses.filter(exp => exp.imageUrl).length;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="w-6 h-6 text-[var(--color-primary)]" />
              אישור שליחה לרואה חשבון
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              נשלח אל: <span className="text-white font-mono">{accountantEmail}</span>
            </p>
          </div>
          <button onClick={onClose} disabled={isSending} className="text-gray-400 hover:text-white transition-colors p-1.5 bg-white/5 rounded-lg">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="px-5 pt-4 grid grid-cols-3 gap-3">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold mb-1">חשבוניות</p>
            <p className="text-2xl font-black text-white">{expenses.length}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold mb-1">סה״כ</p>
            <p className="text-lg font-black text-[var(--color-primary)]">₪{totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold mb-1">עם תמונות</p>
            <p className="text-2xl font-black text-white">{withImages}</p>
          </div>
        </div>

        {/* Expenses List */}
        <div className="flex-1 overflow-auto p-5 pt-3 space-y-2">
          {expenses.map((exp, i) => (
            <div key={exp.id || i} className="flex items-center justify-between bg-white/5 rounded-xl p-3 gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {exp.imageUrl ? (
                  <img src={exp.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-4 h-4 text-gray-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-sm text-white truncate">{exp.supplier}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{exp.date} · {exp.category}</p>
                </div>
              </div>
              <p className="font-bold text-[var(--color-primary)] text-sm flex-shrink-0">₪{exp.total?.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="p-5 pt-3 border-t border-white/10 flex gap-3">
          <button
            onClick={onConfirm}
            disabled={isSending}
            className="flex-1 bg-[var(--color-primary)] text-slate-900 font-bold py-3 rounded-xl hover:brightness-110 shadow-[0_0_20px_rgba(13,242,128,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSending ? (
              <><div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />שולח...</>
            ) : (
              <><Download className="w-4 h-4" />אשר ושלח</>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-6 py-3 border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersManagement() {
  const { role, businessId } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [localAccountantEmail, setLocalAccountantEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  if (role !== 'admin' && role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-white/5 rounded-2xl border border-white/10">
        <Settings className="w-12 h-12 text-orange-500 animate-pulse" />
        <h3 className="text-xl font-bold">גישה מוגבלת</h3>
        <p className="text-[var(--color-text-muted)] text-sm">רק מנהלים ובעלי הרשאות רשאים לנהל משתמשים.</p>
      </div>
    );
  }

  useEffect(() => {
    if (!businessId) return;
    const q = query(
      collection(db, 'users'),
      where('businessId', '==', businessId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(docs);
      setLoading(false);
    }, (error) => {
      console.error("Firestore users snapshot error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [businessId]);

  // Load current accountant email from businesses doc
  useEffect(() => {
    if (!businessId) return;
    const unsub = onSnapshot(doc(db, 'businesses', businessId), (snapshot) => {
      if (snapshot.exists()) {
        setLocalAccountantEmail(snapshot.data().accountantEmail || '');
      }
    });
    return () => unsub();
  }, [businessId]);

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { role: newRole }, { merge: true });
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const deleteUser = async (userId: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק משתמש זה?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    }
  };

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}?invite=${businessId}`;
    navigator.clipboard.writeText(inviteLink);
    alert('קישור ההזמנה הועתק ללוח!');
  };

  const saveAccountantEmail = async () => {
    if (!businessId) return;
    setSavingEmail(true);
    try {
      await setDoc(doc(db, 'businesses', businessId), { accountantEmail: localAccountantEmail.trim() }, { merge: true });
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 3000);
    } catch (error) {
      console.error("Error saving accountant email:", error);
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <section className="space-y-6">

      {/* Business Settings Card */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Settings className="w-5 h-5 text-[var(--color-primary)]" />
          הגדרות עסק
        </h3>
        <div className="space-y-2">
          <label className="text-xs text-[var(--color-text-muted)] font-medium">אימייל רואה חשבון</label>
          <p className="text-[11px] text-gray-500">לשליחת דו"חות הוצאות חודשיים</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={localAccountantEmail}
              onChange={(e) => setLocalAccountantEmail(e.target.value)}
              placeholder="accountant@example.com"
              dir="ltr"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] outline-none transition-colors"
            />
            <button
              onClick={saveAccountantEmail}
              disabled={savingEmail}
              className="bg-[var(--color-primary)] text-slate-900 px-4 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all whitespace-nowrap"
            >
              {emailSaved ? '✓ נשמר' : savingEmail ? '...' : 'שמור'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1 gap-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-[var(--color-primary)]" />
          ניהול משתמשים והרשאות
        </h3>
        <button
          onClick={copyInviteLink}
          className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          העתק קישור הזמנה
        </button>
      </div>

      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-white/5 text-[var(--color-text-muted)] text-xs uppercase">
              <tr>
                <th className="p-4 font-semibold">משתמש</th>
                <th className="p-4 font-semibold">אימייל</th>
                <th className="p-4 font-semibold">תפקיד</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-white/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full border border-white/10" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] uppercase">
                          {u.displayName?.substring(0, 2) || '??'}
                        </div>
                      )}
                      <span className="font-bold text-sm text-white">{u.displayName}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-[var(--color-text-muted)] whitespace-nowrap">{u.email}</td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <select
                        value={u.role}
                        onChange={(e) => updateUserRole(u.id, e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-[var(--color-primary)] transition-colors"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="accountant">Accountant</option>
                      </select>
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="מחק משתמש"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
        <p className="text-xs text-orange-400 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          שים לב: שינוי תפקיד משפיע על הרשאות הגישה של המשתמש מיידית.
        </p>
      </div>
    </section>
  );
}


export function ReviewModal({
  data,
  isSaving,
  allCategories,
  onClose,
  onSave,
  onAddCategory
}: {
  data: any,
  isSaving: boolean,
  allCategories: string[],
  onClose: () => void,
  onSave: (data: any) => void,
  onAddCategory: (category: string) => void
}) {
  const [editedData, setEditedData] = useState(data);
  const [lineItems, setLineItems] = useState<any[]>(
    (data.lineItems || []).map((item: any) => ({ ...item, rawName: item.name }))
  );
  const [newCategory, setNewCategory] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);

  const updateLineItem = (index: number, field: string, value: string | number) => {
    setLineItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({ ...editedData, lineItems });
  };

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      onAddCategory(newCategory.trim());
      setEditedData({ ...editedData, category: newCategory.trim() });
      setNewCategory('');
      setShowAddCategory(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl">

        {/* Left: Receipt Preview */}
        <div className="w-full md:w-1/2 bg-black/40 flex items-center justify-center p-4 overflow-auto">
          <img src={data.imageUrl} alt="Receipt Preview" className="max-w-full h-auto rounded shadow-lg" />
        </div>

        {/* Right: Data Entry Form */}
        <div className="w-full md:w-1/2 p-6 flex flex-col space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="w-6 h-6 text-[var(--color-primary)]" />
              אימות נתוני חשבונית
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>

          <div className="space-y-4 flex-1 overflow-auto px-1">
            <div className="space-y-2">
              <label className="text-xs text-[var(--color-text-muted)] font-medium">ספק / עסק</label>
              <input
                type="text"
                value={editedData.supplier}
                onChange={(e) => setEditedData({ ...editedData, supplier: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[var(--color-primary)] outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-[var(--color-text-muted)] font-medium">סכום כולל (₪)</label>
                <input
                  type="number"
                  value={editedData.total}
                  onChange={(e) => setEditedData({ ...editedData, total: parseFloat(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[var(--color-primary)] outline-none transition-colors font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[var(--color-text-muted)] font-medium">תאריך</label>
                <input
                  type="text"
                  value={editedData.date}
                  onChange={(e) => setEditedData({ ...editedData, date: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[var(--color-primary)] outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-[var(--color-text-muted)] font-medium">קטגוריה</label>
                {!showAddCategory && (
                  <button
                    onClick={() => setShowAddCategory(true)}
                    className="text-[10px] text-[var(--color-primary)] hover:underline"
                  >
                    + קטגוריה חדשה
                  </button>
                )}
              </div>

              {!showAddCategory ? (
                <select
                  value={editedData.category}
                  onChange={(e) => setEditedData({ ...editedData, category: e.target.value })}
                  className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white focus:border-[var(--color-primary)] outline-none transition-colors"
                >
                  {allCategories.map(cat => (
                    <option key={cat} value={cat} style={{ backgroundColor: '#0f172a', color: '#fff' }}>{cat}</option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="שם הקטגוריה..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[var(--color-primary)] outline-none transition-colors"
                    autoFocus
                  />
                  <button
                    onClick={handleAddCategory}
                    className="bg-[var(--color-primary)] text-slate-900 px-4 rounded-lg font-bold text-sm"
                  >
                    הוסף
                  </button>
                  <button
                    onClick={() => setShowAddCategory(false)}
                    className="px-4 border border-white/10 text-white rounded-lg text-sm"
                  >
                    ביטול
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/5">
              <p className="text-[10px] text-[var(--color-text-muted)] mb-2 font-mono uppercase tracking-[2px]">AI Raw Transcription</p>
              <div className="bg-black/20 rounded p-3 text-[10px] text-gray-500 max-h-32 overflow-auto font-mono leading-relaxed">
                {data.rawText}
              </div>
            </div>

            {/* Line Items Table — Editable */}
            {lineItems.length > 0 && (
              <div className="pt-4 border-t border-white/5">
                <p className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse"></span>
                  פירוט מוצרים — ערוך לפני שמירה ({lineItems.length})
                </p>
                <div className="max-h-52 overflow-auto rounded border border-white/10 bg-black/20">
                  <table className="w-full text-right text-[11px] border-collapse">
                    <thead className="bg-[#1a1f2e] text-[var(--color-text-muted)] sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="p-2 font-semibold text-right">שם מוצר</th>
                        <th className="p-2 font-semibold text-center w-20">כמות</th>
                        <th className="p-2 font-semibold text-center w-20">יחידה</th>
                        <th className="p-2 font-semibold text-left w-24">מחיר/יח' (₪)</th>
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {lineItems.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors group">
                          <td className="p-1 w-full relative">
                            <input
                              type="text"
                              value={item.name}
                              onChange={e => updateLineItem(i, 'name', e.target.value)}
                              className="w-full bg-white/5 border border-transparent focus:border-[var(--color-primary)]/50 rounded px-2 py-1.5 text-white outline-none transition-colors text-right"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity || ''}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                updateLineItem(i, 'quantity', isNaN(val) ? '' : val);
                              }}
                              className="w-full bg-white/5 border border-transparent focus:border-[var(--color-primary)]/50 rounded px-2 py-1.5 text-white outline-none transition-colors text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>
                          <td className="p-1">
                            <select
                              value={item.unit || ''}
                              onChange={e => updateLineItem(i, 'unit', e.target.value)}
                              className="w-full bg-white/5 border border-transparent focus:border-[var(--color-primary)]/50 rounded px-1 py-1.5 text-white outline-none transition-colors text-center appearance-none cursor-pointer"
                              dir="rtl"
                            >
                              <option value="" disabled className="bg-[#1a1f2e] text-gray-400">בחר</option>
                              <option value="יח'" className="bg-[#1a1f2e] text-white">יח'</option>
                              <option value="ק״ג" className="bg-[#1a1f2e] text-white">ק״ג</option>
                              <option value="גרם" className="bg-[#1a1f2e] text-white">גרם</option>
                              <option value="ליטר" className="bg-[#1a1f2e] text-white">ליטר</option>
                              <option value="מ״ל" className="bg-[#1a1f2e] text-white">מ״ל</option>
                              <option value="ארגז" className="bg-[#1a1f2e] text-white">ארגז</option>
                              <option value="מארז" className="bg-[#1a1f2e] text-white">מארז</option>
                            </select>
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.pricePerUnit || ''}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                updateLineItem(i, 'pricePerUnit', isNaN(val) ? '' : val);
                              }}
                              className="w-full bg-white/5 border border-transparent focus:border-[var(--color-primary)]/50 rounded px-2 py-1.5 text-[var(--color-primary)] font-bold outline-none transition-colors text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              dir="ltr"
                            />
                          </td>
                          <td className="p-1.5">
                            <button
                              onClick={() => removeLineItem(i)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-1 rounded"
                              title="הסר שורה"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[9px] text-[var(--color-text-muted)] mt-2 opacity-60">
                  💡 תיקון שם מוצר? השם הישן יישמר אוטומטית כ-alias לזיהוי עתידי.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-[var(--color-primary)] text-slate-900 font-bold py-3 rounded-lg hover:brightness-110 shadow-[0_0_20px_rgba(13,242,128,0.3)] transition-all disabled:opacity-50"
            >
              {isSaving ? 'שומר...' : 'אישור ושמירה'}
            </button>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-3 border border-white/10 text-white font-medium rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const { user, completedOnboarding, loading } = useAuth();
  console.log("MainApp Render:", { user: !!user, completedOnboarding, loading });

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return <Login />;
  if (!completedOnboarding) return <Onboarding />;

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
