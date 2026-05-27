"use client";
import { useState, useEffect } from "react";
import { 
  CalendarDays, BarChart, Target, TrendingUp, 
  TrendingDown, Activity, ShieldAlert, BadgeDollarSign, 
  PieChart, ChevronLeft, ChevronRight, ChevronDown
} from "lucide-react";
import { db } from "../../lib/firebase"; 
import { ref, onValue } from "firebase/database";

export default function AnalyticsPage() {
  const [allAccountsData, setAllAccountsData] = useState({});
  const [accountsList, setAccountsList] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date()); 

  useEffect(() => {
    const accountsRef = ref(db, 'account_data');
    const unsubscribe = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAllAccountsData(data);
        const accounts = Object.keys(data);
        setAccountsList(accounts);
        if (!selectedAccountId || !accounts.includes(selectedAccountId)) {
          setSelectedAccountId(accounts[0]);
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [selectedAccountId]);

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const monthName = viewDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  const goToPrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const goToNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

  // --- PEMROSESAN DATA SNAPSHOT (FIX DETIK VS MILIDETIK) ---
  const snapshots = allAccountsData[selectedAccountId]?.snapshots || {};
  const processedSnapshots = {};

  Object.keys(snapshots).forEach(tsKey => {
    let timeMs = parseInt(tsKey);
    
    // Jika EA mengirim format DETIK (10 digit angka), kalikan 1000 jadi MILIDETIK
    if (timeMs < 10000000000) {
      timeMs = timeMs * 1000;
    }

    // Tambah 8 jam (28.800.000 ms) untuk konversi ke WITA / GMT+8 Mutlak
    const exactDateWITA = new Date(timeMs + 28800000); 
    
    const y = exactDateWITA.getUTCFullYear();
    const m = exactDateWITA.getUTCMonth(); 
    const d = exactDateWITA.getUTCDate();
    
    processedSnapshots[`${y}-${m}-${d}`] = snapshots[tsKey];
  });

  // --- GENERATOR HARI ---
  const generateMonthlyData = () => {
    const days = [];
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); 
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ empty: true });
    }

    const today = new Date();
    const currentMonthToday = today.getMonth();
    const currentYearToday = today.getFullYear();

    for (let i = 1; i <= daysInMonth; i++) {
      const isFuture = (currentYear === currentYearToday && currentMonth === currentMonthToday && i > today.getDate()) 
                       || (currentYear > currentYearToday) 
                       || (currentYear === currentYearToday && currentMonth > currentMonthToday);

      const lookupKey = `${currentYear}-${currentMonth}-${i}`;
      const dayData = processedSnapshots[lookupKey];

      let profit = 0; let growth = 0; let lot = 0; let status = 'neutral';

      if (isFuture) {
        status = 'future';
      } else if (dayData) {
        // Fallback property keys (Mencegah error jika EA memakai nama variabel berbeda)
        profit = dayData.daily_profit || dayData.profit || 0;
        growth = dayData.daily_growth_percent || dayData.growth || dayData.growth_percent || 0;
        lot = dayData.daily_lots || dayData.lot || dayData.lots || 0;
        
        if (profit > 0) status = 'win';
        else if (profit < 0) status = 'loss';
      }

      days.push({ day: i, empty: false, status, profit, growth, lot });
    }

    while (days.length % 7 !== 0) days.push({ empty: true });
    return days;
  };

  const monthlyDays = generateMonthlyData();

  // --- KALKULASI FUND MANAGER METRICS ---
  let grossProfit = 0; let grossLoss = 0; let maxDailyProfit = 0; let maxDailyLoss = 0;
  let winDays = 0; let totalTradingDays = 0;

  monthlyDays.forEach(d => {
    if (!d.empty && d.status !== 'future' && (d.profit !== 0 || d.lot > 0)) {
      totalTradingDays++;
      if (d.profit > 0) {
        grossProfit += d.profit; winDays++;
        if (d.profit > maxDailyProfit) maxDailyProfit = d.profit;
      } else if (d.profit < 0) {
        const absLoss = Math.abs(d.profit);
        grossLoss += absLoss;
        if (absLoss > maxDailyLoss) maxDailyLoss = absLoss;
      }
    }
  });

  const netProfit = grossProfit - grossLoss;
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? "∞" : "0.00");
  const winRate = totalTradingDays > 0 ? ((winDays / totalTradingDays) * 100).toFixed(1) : 0;

  const formatCur = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  if (isLoading) return <div className="flex justify-center items-center h-screen font-bold text-[var(--primary)] animate-pulse">Menyiapkan Data Analitik...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans transition-colors duration-300">
      
      {/* HEADER & ACCOUNT SELECTOR */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
         <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="p-4 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] shadow-inner"><BarChart size={36}/></div>
            <div>
               <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">Performance Analytics</h1>
               <p className="text-sm text-[var(--muted-foreground)]">Analisis mendalam per akun dan histori bulanan.</p>
            </div>
         </div>

         <div className="w-full md:w-auto bg-[var(--muted)]/50 p-3.5 rounded-2xl border border-[var(--card-border)] flex flex-col gap-1.5 shadow-sm">
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-1">Pilih Akun Analisis</span>
            <div className="relative">
               <select 
                 value={selectedAccountId} 
                 onChange={(e) => setSelectedAccountId(e.target.value)}
                 className="appearance-none w-full md:w-64 bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] font-bold text-sm rounded-xl pl-4 pr-10 py-3 outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer shadow-sm transition-all hover:border-[var(--primary)]/50"
               >
                 {accountsList.map(acc => <option key={acc} value={acc}>Account: {acc}</option>)}
               </select>
               <ChevronDown size={16} className="absolute right-4 top-3.5 text-[var(--muted-foreground)] pointer-events-none" />
            </div>
         </div>
      </div>

      {/* NAVIGATOR BULAN */}
      <div className="flex justify-between items-center bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--card-border)] shadow-sm">
         <button onClick={goToPrevMonth} className="p-2 hover:bg-[var(--muted)] rounded-xl transition-colors text-[var(--foreground)] border border-[var(--card-border)] shadow-sm">
            <ChevronLeft size={20}/>
         </button>
         <div className="flex items-center gap-3">
            <CalendarDays size={20} className="text-[var(--primary)]"/>
            <h2 className="text-lg font-black text-[var(--foreground)] uppercase tracking-widest">{monthName}</h2>
         </div>
         <button onClick={goToNextMonth} disabled={currentYear === new Date().getFullYear() && currentMonth === new Date().getMonth()} className="p-2 hover:bg-[var(--muted)] disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-colors text-[var(--foreground)] border border-[var(--card-border)] shadow-sm">
            <ChevronRight size={20}/>
         </button>
      </div>

      {/* FUND MANAGER SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Net Profit", val: formatCur(netProfit), icon: BadgeDollarSign, c: "text-blue-500" },
          { label: "Gross Profit", val: formatCur(grossProfit), icon: TrendingUp, c: "text-green-500" },
          { label: "Gross Loss", val: `-${formatCur(grossLoss)}`, icon: TrendingDown, c: "text-red-500" },
          { label: "Profit Factor", val: profitFactor, icon: Activity, c: "text-purple-500" },
          { label: "Win Rate", val: `${winRate}%`, icon: PieChart, c: "text-orange-500" },
          { label: "Trades", val: `${totalTradingDays} Days`, icon: Target, c: "text-[var(--foreground)]" },
        ].map((item, i) => (
          <div key={i} className="bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--card-border)] shadow-sm hover:border-[var(--primary)] transition-all">
            <div className="flex items-center gap-2 mb-2">
              <item.icon size={14} className={item.c} />
              <span className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">{item.label}</span>
            </div>
            <div className={`text-lg font-black tracking-tight ${item.label === 'Gross Loss' ? 'text-red-500' : 'text-[var(--foreground)]'}`}>
              {item.val}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--card-bg)] p-5 rounded-2xl border border-[var(--card-border)] shadow-sm flex justify-between items-center hover:border-green-500/50 transition-colors">
          <div>
            <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase flex items-center gap-1.5"><TrendingUp size={14} className="text-green-500"/> Max Daily Profit</span>
            <span className="text-2xl font-black text-green-500 mt-1 block">{formatCur(maxDailyProfit)}</span>
          </div>
        </div>
        <div className="bg-[var(--card-bg)] p-5 rounded-2xl border border-[var(--card-border)] shadow-sm flex justify-between items-center hover:border-red-500/50 transition-colors">
          <div>
            <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase flex items-center gap-1.5"><ShieldAlert size={14} className="text-red-500"/> Max Daily Loss</span>
            <span className="text-2xl font-black text-red-500 mt-1 block">{formatCur(maxDailyLoss)}</span>
          </div>
        </div>
      </div>

      {/* HEATMAP KALENDER DINAMIS (ANTI-PURGE INLINE STYLES) */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm relative overflow-hidden transition-colors">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h3 className="font-bold text-xl md:text-2xl text-[var(--foreground)] flex items-center gap-2 tracking-tight">
            <CalendarDays className="text-[var(--primary)]" /> {monthName} Heatmap
          </h3>
          <div className="flex items-center gap-4 text-[10px] font-bold bg-[var(--background)] px-4 py-2 rounded-xl border border-[var(--card-border)] shadow-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10b981]"></div> PROFIT</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444]"></div> LOSS</div>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
          <div style={{ minWidth: '750px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '12px' }} className="mb-3 text-center">
              {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day, i) => (
                <div key={i} className="text-xs font-black text-[var(--muted-foreground)] uppercase tracking-widest">{day}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '12px' }}>
              {monthlyDays.map((d, i) => {
                const isWin = d.status === 'win';
                const isLoss = d.status === 'loss';
                const isNeutral = d.status === 'neutral';
                const isFuture = d.status === 'future';

                return (
                  <div 
                    key={i} 
                    style={{
                      ...(isWin ? { backgroundColor: '#10b981', borderColor: '#10b981', color: 'white' } : {}),
                      ...(isLoss ? { backgroundColor: '#ef4444', borderColor: '#ef4444', color: 'white' } : {})
                    }}
                    className={`
                      relative flex flex-col justify-between p-3 rounded-2xl aspect-[4/3] transition-all border
                      ${d.empty ? 'opacity-0 pointer-events-none border-transparent' : 'hover:-translate-y-1 hover:shadow-lg'}
                      ${isWin || isLoss ? 'shadow-md text-white' : ''}
                      ${isNeutral ? 'bg-[var(--background)] border-[var(--card-border)]' : ''}
                      ${isFuture ? 'bg-[var(--muted)]/20 border-[var(--card-border)] border-dashed opacity-50' : ''}
                    `}
                  >
                    {!d.empty && (
                      <>
                        <span className={`text-[11px] font-bold ${isWin || isLoss ? 'text-white' : 'text-[var(--muted-foreground)]'}`}>
                          {d.day}
                        </span>
                        
                        <div className="flex-grow flex items-center justify-center">
                          <span className={`text-xl md:text-2xl font-black tracking-tighter ${isWin || isLoss ? 'text-white' : isFuture ? 'opacity-0' : 'text-[var(--foreground)]'}`}>
                            {isNeutral && d.lot === 0 ? '0.00%' : (d.growth > 0 ? `+${d.growth.toFixed(2)}%` : `${d.growth.toFixed(2)}%`)}
                          </span>
                        </div>
                        
                        <div className={`flex flex-col text-[10px] font-bold leading-snug mt-1 ${isWin || isLoss ? 'text-white/90' : 'text-[var(--muted-foreground)]'} ${isFuture || (isNeutral && d.lot === 0) ? 'opacity-0' : ''}`}>
                          <span>${Math.abs(d.profit).toFixed(2)}</span>
                          <span>{d.lot.toFixed(2)} L</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}