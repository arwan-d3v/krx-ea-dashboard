"use client";

// ============================================================================
// SECTION 1: IMPORTS & DEPENDENCIES
// ============================================================================
import { useState, useEffect, useRef } from "react";
import { 
  TrendingUp, TrendingDown, DollarSign, Activity, 
  Wallet, ArrowDownToLine, ArrowUpFromLine, 
  CalendarDays, BarChart3, Clock, AlertTriangle, 
  Server, User, ChevronDown, Cpu, Terminal, 
  Crown, PawPrint, Radar, Binary, Zap, LogOut, Loader2, Lock
} from "lucide-react";
import { 
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import { db, auth } from "../../lib/firebase";
import { ref, onValue } from "firebase/database";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';

// Import AuthContext Global untuk mengambil User & Role
import { useAuth } from "../context/AuthContext";

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// ============================================================================
// SECTION 2: CONFIGURATION & DICTIONARIES
// ============================================================================
const animUrl = {
  SCANNING: "", 
  AI_ANALYZING: "https://lottie.host/28f9c14c-1120-4318-80f2-b8832a81fcd9/4fWqC29l7L.json",   
  ENTRY_EXECUTION: "https://lottie.host/d4615a97-9e73-4ea2-80ea-7debc24a187f/VbWkUaM98y.json", 
  SHIELD_ACTIVE: "https://lottie.host/81b22295-d2fc-4b71-91a7-5ba7b2c0f6ec/0F5S5BfC0t.json",   
  PROFIT_SECURED: "https://lottie.host/17e6e584-6997-40ea-9e32-23c21c7d2c34/Lh3C7bZfQo.json",  
  SYSTEM_ERROR: "https://lottie.host/a60e0eb8-7ec3-440a-9d22-1d5756c66cf1/vj9XhS45N4.json"  
};

// --- BILINGUAL DICTIONARY ---
const dict = {
  en: {
    port_title: "LIVE PORTFOLIO",
    floating: "Floating",
    in_market: "In Market",
    standby: "Standby",
    update: "Update:",
    cloud_sync: "Cloud Sync",
    link_online: "LINK ONLINE",
    link_offline: "LINK OFFLINE",
    growth: "Growth",
    abs_gain: "Absolute Gain",
    pure_profit: "Pure Profit",
    trading_result: "Trading Result",
    balance: "Balance",
    margin: "Margin",
    max_dd: "Max Drawdown",
    peak_trough: "Peak to Trough",
    init_depo: "Initial Deposit",
    top_up: "Top Up (Add)",
    withdrawals: "Withdrawals",
    net_capital: "Net Capital",
    growth_traj: "Growth Trajectory",
    daily_perf: "Daily Performance (5 Days)",
    no_history: "No daily track record yet.",
    live_exp: "LIVE MARKET EXPOSURE",
    th_sym: "Symbol",
    th_type: "Type",
    th_vol: "Volume",
    th_pnl: "Profit (PnL)",
    searching_liq: "Searching for institutional liquidity gap...",
    no_account: "No EA accounts connected.",
    restricted_access: "RESTRICTED ACCESS: No quantitative nodes assigned.",
    contact_admin: "Please contact your Administrator or Creator to allocate your EA node."
  },
  id: {
    port_title: "PORTFOLIO AKTIF",
    floating: "Mengambang",
    in_market: "Di Pasar",
    standby: "Siaga",
    update: "Pembaruan:",
    cloud_sync: "Sinkronisasi Cloud",
    link_online: "LINK ONLINE",
    link_offline: "LINK OFFLINE",
    growth: "Pertumbuhan",
    abs_gain: "Keuntungan Absolut",
    pure_profit: "Profit Murni",
    trading_result: "Hasil Trading",
    balance: "Saldo",
    margin: "Margin",
    max_dd: "Maks Drawdown",
    peak_trough: "Puncak ke Lembah",
    init_depo: "Deposit Awal",
    top_up: "Isi Ulang (Tambah)",
    withdrawals: "Penarikan",
    net_capital: "Modal Bersih",
    growth_traj: "Lintasan Pertumbuhan",
    daily_perf: "Performa Harian (5 Hari)",
    no_history: "Belum ada rekam jejak harian.",
    live_exp: "EKSPOSUR PASAR AKTIF",
    th_sym: "Simbol",
    th_type: "Tipe",
    th_vol: "Volume",
    th_pnl: "Profit (PnL)",
    searching_liq: "Mencari celah likuiditas institusional...",
    no_account: "Tidak ada akun EA yang terhubung.",
    restricted_access: "AKSES TERBATAS: Belum ada node kuantitatif yang dialokasikan.",
    contact_admin: "Silakan hubungi Administrator atau Kreator untuk mengalokasikan node EA Anda."
  }
};

// ============================================================================
// SECTION 3: MAIN DASHBOARD COMPONENT
// ============================================================================
export default function Dashboard() {
  const router = useRouter();
  
  // Menggunakan Context Global untuk User, Role, & Status Loading
  const { user, role, loading: isAuthLoading } = useAuth();

  // Default Language: English
  const [lang, setLang] = useState("en"); 
  const t = dict[lang];

  const [allAccountsData, setAllAccountsData] = useState({});
  const [accountsList, setAccountsList] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [wsConnected, setWsConnected] = useState(false);
  const [ping, setPing] = useState(0);
  const [robotState, setRobotState] = useState('SCANNING');
  const [terminalLogs, setTerminalLogs] = useState([]);

  // === FIREBASE AUTHENTICATION GUARD ===
  useEffect(() => {
    // Jika tidak sedang loading auth dan user tidak ada, tendang ke login
    if (!isAuthLoading && !user) {
      router.push("/login");
    }
  }, [user, isAuthLoading, router]);

  // === AUTO LOGOUT / IDLE TRACKER (5 MINUTES) ===
  useEffect(() => {
    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 300,000 ms = 5 Menit. Tendang ke halaman login jika diam.
      timeoutId = setTimeout(() => {
        signOut(auth).then(() => {
          router.push("/login");
        });
      }, 300000);
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
    };
  }, [router]);


  // ============================================================================
  // SECTION 6: FIREBASE DATA FETCHING (MASTER & INVESTOR DATA ISOLATION)
  // ============================================================================
  useEffect(() => {
    if (isAuthLoading || !user || !role) return;

    let unsubAll = null;
    let unsubUser = null;
    let accountUnsubs = [];

    const clearAccountUnsubs = () => {
      accountUnsubs.forEach(unsub => unsub());
      accountUnsubs = [];
    };

    // LOGIKA ADMIN: Tarik SEMUA data akun
    if (role === 'super_admin' || role === 'admin') {
      const accountsRef = ref(db, 'account_data');
      unsubAll = onValue(accountsRef, (snapshot) => {
        const data = snapshot.val() || {};
        setAllAccountsData(data);
        const accounts = Object.keys(data);
        setAccountsList(accounts);
        setIsLoading(false);
      });
    } 
    // LOGIKA INVESTOR: Tarik HANYA data akun yang dialokasikan
    else if (role === 'investor') {
      const userRef = ref(db, `users/${user.uid}/owned_accounts`);
      unsubUser = onValue(userRef, (snapshot) => {
        const owned = snapshot.val() || {};
        // Filter ID yang nilainya "true"
        const allowedIds = Object.keys(owned).filter(k => owned[k] === true);
        setAccountsList(allowedIds);
        
        clearAccountUnsubs(); // Bersihkan listener lama jika hak akses berubah

        if (allowedIds.length === 0) {
          setAllAccountsData({});
          setIsLoading(false);
          return;
        }

        // Buka listener khusus untuk setiap nomor akun yang diizinkan
        allowedIds.forEach(accId => {
          const accRef = ref(db, `account_data/${accId}`);
          const unsubAcc = onValue(accRef, (accSnap) => {
            setAllAccountsData(prev => ({
              ...prev,
              [accId]: accSnap.val() || {} // Update partial tanpa menimpa akun lain
            }));
            setIsLoading(false);
          });
          accountUnsubs.push(unsubAcc);
        });
      });
    }

    return () => {
      if (unsubAll) unsubAll();
      if (unsubUser) unsubUser();
      clearAccountUnsubs();
    };
  }, [user, role, isAuthLoading]);

  // Menyesuaikan Dropdown Pilihan Akun
  useEffect(() => {
    if (accountsList.length > 0 && !accountsList.includes(selectedAccountId)) {
      setSelectedAccountId(accountsList[0]);
    }
  }, [accountsList, selectedAccountId]);


  // ==========================================
  // METADATA & DATA FORMATTING
  // ==========================================
  const currentAccountData = allAccountsData[selectedAccountId] || {};
  const metaData = currentAccountData.metadata || {};
  const botType = metaData.bot_type || "NON_ML";
  const brokerName = metaData.broker || "MT5_SERVER"; 
  const accountName = metaData.investor_name || "KRX_INVESTOR";

  const getGMT8Time = () => new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Singapore' });

  const getBotTheme = (type) => {
    switch(type) {
      case 'GOD_MODE':
        return { name: "KRX - GOD HEALER", icon: Crown, exe: "GOD_CORE_V3.exe", vibe: "High Precision | Golden Ratio Exec", accent: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/40", brackets: "border-amber-500", glow: "shadow-[0_0_25px_rgba(245,158,11,0.25)]", termBg: "bg-slate-900 dark:bg-[#030712]", termText: "text-amber-400", sysText: "text-blue-400" };
      case 'BEAST_MODE':
        return { name: "KRX - BEAST WATCHER", icon: PawPrint, exe: "BEAST_CORE_V4.exe", vibe: "Liquidity Hunter | Maximum Volume", accent: "text-red-600 dark:text-red-500", bg: "bg-red-500/10", border: "border-red-500/50", brackets: "border-red-600 dark:border-red-500", glow: "shadow-[0_0_35px_rgba(239,68,68,0.4)]", termBg: "bg-red-950/20 dark:bg-[#0a0000]", termText: "text-red-500", sysText: "text-orange-500" };
      case 'ENIGMA_OTE':
        return { name: "KRX - ENIGMA IMBALANCE", icon: Radar, exe: "ENIGMA_TRAP_V5.exe", vibe: "Spatial Recon | Cipher BPR Anomalies", accent: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/40", brackets: "border-emerald-500", glow: "shadow-[0_0_25px_rgba(16,185,129,0.25)]", termBg: "bg-slate-900 dark:bg-[#000500]", termText: "text-emerald-400", sysText: "text-purple-500" };
      default: 
        return { name: "CLASSIC GRID EA", icon: Cpu, accent: "text-blue-500", termText: "text-blue-400", sysText: "text-blue-300" };
    }
  };
  const theme = getBotTheme(botType);
  const BotIcon = theme.icon;

  // ==========================================
  // SECTION 5: FIREBASE CLOUD NODE CONNECTION (TERMINAL)
  // ==========================================
  const terminalData = currentAccountData?.ai_terminal;
  const lastLogTimeRef = useRef(0);

  useEffect(() => {
    if (botType === "NON_ML") {
      setWsConnected(false);
      setTerminalLogs([]);
    } else {
      setTerminalLogs([{ time: getGMT8Time(), text: `SYSTEM BOOT: Securing connection to KRX Cloud Node...`, type: "SYSTEM" }]);
      setRobotState('SCANNING');
      lastLogTimeRef.current = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, botType]);

  useEffect(() => {
    if (botType === "NON_ML") return;

    if (terminalData) {
      const now = Date.now();
      const nodeTime = terminalData.timestamp || 0;

      if (now - nodeTime < 25000) {
        if (!wsConnected) setWsConnected(true);
      } else {
        if (wsConnected) setWsConnected(false);
        setRobotState('SYSTEM_ERROR');
      }

      if (terminalData.status) setRobotState(terminalData.status);

      if (terminalData.info && terminalData.timestamp !== lastLogTimeRef.current) {
        lastLogTimeRef.current = terminalData.timestamp;
        setTerminalLogs(prev => [...prev, { time: getGMT8Time(), text: terminalData.info, type: terminalData.status }].slice(-40));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalData, botType]);

  useEffect(() => {
    if (botType === "NON_ML") return;
    const watchdog = setInterval(() => {
      const now = Date.now();
      if (lastLogTimeRef.current > 0 && (now - lastLogTimeRef.current > 25000)) {
        setWsConnected(false);
        setRobotState('SYSTEM_ERROR');
      }
    }, 5000);
    return () => clearInterval(watchdog);
  }, [botType]);

  useEffect(() => {
    if (!wsConnected) { setPing(0); return; }
    const pingInterval = setInterval(() => setPing(Math.floor(Math.random() * 26) + 12), 3500);
    return () => clearInterval(pingInterval);
  }, [wsConnected]);

  useEffect(() => {
    if (!wsConnected || robotState !== 'SCANNING') return;
    const idleLogInterval = setInterval(() => {
      const prob = (Math.random() * 30 + 45).toFixed(1); 
      let messages = [];

      if (botType === 'GOD_MODE') messages = [`Patience protocol active. Waiting for perfect alignment...`, `Scanning Golden Ratios... Precision at ${prob}%.`, `No flawless entry found. Continuing observation.`];
      else if (botType === 'BEAST_MODE') messages = [`Sniffing liquidity pools... Aggression level high!`, `Hunting breakout momentum. Kill probability ${prob}%...`, `Target acquired, waiting for trigger volume...`];
      else if (botType === 'ENIGMA_OTE') messages = [`Analyzing spatial BPR anomalies. Stealth mode active.`, `Calculating OTE limits. Match probability ${prob}%...`, `Radar sweep complete. Awaiting market manipulation...`];

      if(messages.length > 0) {
          const randomMsg = messages[Math.floor(Math.random() * messages.length)];
          setTerminalLogs(prev => [...prev, { time: getGMT8Time(), text: randomMsg, type: "SCANNING_IDLE" }].slice(-40));
      }
    }, 45000); 
    return () => clearInterval(idleLogInterval);
  }, [wsConnected, robotState, botType]);

  // ==========================================
  // METRICS FORMATTING
  // ==========================================
  const liveData = currentAccountData.realtime_stats || {};
  const openTrades = currentAccountData.open_trades || [];
  const isEATrading = openTrades.length > 0;

  const formatCur = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val || 0);
  const formatPct = (val) => `${Number(val || 0).toFixed(2)}%`;
  const formatTimeGMT8 = (ts) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleTimeString('en-US', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + " GMT+8";
  };

  const initDepo = liveData.initial_deposit || 10000;
  const curBal = liveData.balance || 10000;
  const curEq = liveData.equity || 10000;
  
  const mockChartData = [
    { date: 'Start', balance: initDepo, equity: initDepo },
    { date: 'Wk 1', balance: initDepo + (curBal-initDepo)*0.15, equity: initDepo + (curEq-initDepo)*0.10 },
    { date: 'Wk 2', balance: initDepo + (curBal-initDepo)*0.35, equity: initDepo + (curEq-initDepo)*0.45 },
    { date: 'Wk 3', balance: initDepo + (curBal-initDepo)*0.65, equity: initDepo + (curEq-initDepo)*0.55 },
    { date: 'Wk 4', balance: initDepo + (curBal-initDepo)*0.85, equity: initDepo + (curEq-initDepo)*0.95 },
    { date: 'Now', balance: curBal, equity: curEq },
  ];

  const snapshots = currentAccountData.snapshots || {};
  const realDailyHistory = Object.keys(snapshots)
    .sort((a, b) => b - a) 
    .slice(0, 5) 
    .map(ts => {
      let timeMs = parseInt(ts);
      if (timeMs < 10000000000) timeMs = timeMs * 1000; 
      const dateObj = new Date(timeMs);
      const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const dayData = snapshots[ts];
      return {
        id: ts, date: dayNames[dateObj.getDay()], profit: dayData.daily_profit || 0,
        growth: dayData.daily_growth_percent || 0, lot: dayData.daily_lots || 0
      };
    });

  const getTerminalLogColor = (type) => {
    const safeType = type || '';
    if (safeType === 'SYSTEM') return theme.sysText;
    if (safeType === 'SCANNING_IDLE') return 'text-slate-500 dark:text-gray-500';
    if (safeType === 'SYSTEM_ERROR') return 'text-red-500 font-black';
    if (safeType === 'PROFIT_SECURED') return 'text-green-500 font-bold';
    if (safeType === 'ENTRY_EXECUTION') return 'text-orange-500 font-bold';
    return theme.termText;
  };

  // ==========================================
  // TAMPILAN LOADING DAN RESTRIKSI AKSES
  // ==========================================
  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#030712] font-mono text-blue-500 animate-pulse text-sm tracking-widest uppercase">
        Verifying Security Clearance...
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center items-center h-screen font-bold text-[var(--primary)] animate-pulse text-xl bg-[#030712]">Connecting to Server...</div>;
  
  // TAMPILAN JIKA INVESTOR BELUM DIBERI AKSES AKUN APAPUN
  if (accountsList.length === 0) return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-4 px-6 text-center">
      {role === 'investor' ? (
        <>
          <Lock size={64} className="text-red-500 opacity-50 mb-2" />
          <h2 className="text-xl md:text-2xl font-black text-red-500 uppercase tracking-widest">{t.restricted_access}</h2>
          <p className="text-sm font-bold text-[var(--muted-foreground)]">{t.contact_admin}</p>
        </>
      ) : (
        <>
          <AlertTriangle size={64} className="text-orange-500 opacity-50 mb-2" />
          <h2 className="text-2xl font-bold text-[var(--foreground)]">{t.no_account}</h2>
        </>
      )}
    </div>
  );

  // ==========================================
  // SECTION 8: UI RENDERING (TAMPILAN UTAMA)
  // ==========================================
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans transition-colors duration-300">
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes lightning-flash {
          0%, 100% { opacity: 0.2; filter: brightness(1) drop-shadow(0 0 5px rgba(220,38,38,0.5)); box-shadow: 0 0 0 0 rgba(220,38,38,0); }
          5% { opacity: 1; filter: brightness(2) drop-shadow(0 0 20px rgba(220,38,38,1)); box-shadow: 0 0 20px 5px rgba(220,38,38,0.8); }
          10% { opacity: 0.1; filter: brightness(0.8); box-shadow: 0 0 0 0 rgba(220,38,38,0); }
          12% { opacity: 1; filter: brightness(2.5) drop-shadow(0 0 30px rgba(220,38,38,1)); box-shadow: 0 0 30px 10px rgba(220,38,38,1); }
          15% { opacity: 0.2; filter: brightness(1); box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
        .anim-lightning {
          animation: lightning-flash 1.5s infinite;
          border-radius: 50%;
          border: 2px solid rgba(220,38,38,0.5);
          width: 100%; height: 100%; position: absolute;
        }

        @keyframes god-shine {
          0% { transform: translateY(-100%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        .anim-shine {
          background: linear-gradient(to bottom, transparent 0%, rgba(245, 158, 11, 0.6) 50%, transparent 100%);
          animation: god-shine 2.5s ease-in-out infinite;
          border-radius: 50%;
          width: 100%; height: 100%; position: absolute;
        }

        @keyframes scan-radar {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .anim-radar {
          background: conic-gradient(from 0deg, transparent 60%, rgba(16, 185, 129, 0.5) 90%, rgba(16, 185, 129, 1) 100%);
          animation: scan-radar 2s linear infinite;
          border-radius: 50%;
          width: 100%; height: 100%; position: absolute;
        }
      `}} />

      {/* HEADER PORTFOLIO & KONTROL AKUN */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 md:p-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-sm relative overflow-hidden">
        <div className="z-10 w-full lg:w-auto">
          <h2 className="text-sm font-black text-[var(--muted-foreground)] uppercase tracking-widest flex items-center gap-2 mb-4">
             <Activity className="text-[var(--primary)]" size={16}/> {t.port_title}
          </h2>
          <div className="flex flex-wrap items-center gap-4">
             <span className="text-4xl md:text-5xl font-black text-[var(--foreground)] tracking-tight">
                {formatCur(liveData.equity || 0)}
             </span>
             {Number(liveData.total_floating || 0) < 0 ? (
                <span className="text-sm font-bold bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg flex items-center border border-red-500/20 shadow-sm">
                  <TrendingDown size={16} className="mr-1.5"/> {t.floating} {formatCur(liveData.total_floating)}
                </span>
             ) : (
                <span className="text-sm font-bold bg-green-500/10 text-green-500 px-3 py-1.5 rounded-lg flex items-center border border-green-500/20 shadow-sm">
                  <TrendingUp size={16} className="mr-1.5"/> {t.floating} +{formatCur(liveData.total_floating)}
                </span>
             )}
          </div>
        </div>

        <div className="z-10 w-full lg:w-auto flex flex-col items-start lg:items-end gap-4 bg-[var(--muted)]/50 p-4 rounded-2xl border border-[var(--card-border)]">
          <div className="flex flex-wrap items-center gap-3 w-full justify-between lg:justify-end">
            <div className="flex items-center gap-1.5 bg-[var(--background)] px-3 py-1.5 rounded-lg border border-[var(--card-border)] shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isEATrading ? 'bg-green-400' : 'bg-blue-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isEATrading ? 'bg-green-500' : 'bg-blue-500'}`}></span>
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isEATrading ? 'text-green-500' : 'text-blue-500'}`}>
                {isEATrading ? t.in_market : t.standby}
              </span>
            </div>

            <div className="flex items-center bg-[var(--background)] p-1 rounded-lg border border-[var(--card-border)] shadow-sm">
              <button onClick={() => setLang('en')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${lang === 'en' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>EN</button>
              <button onClick={() => setLang('id')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${lang === 'id' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>ID</button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-1"><Server size={10}/> {brokerName}</span>
                <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1 mt-0.5"><User size={12} className="text-[var(--primary)]"/> {accountName}</span>
             </div>

             <div className="relative w-full sm:w-auto mt-2 sm:mt-0">
               <select 
                 value={selectedAccountId} 
                 onChange={(e) => setSelectedAccountId(e.target.value)}
                 className="appearance-none w-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] text-xs font-bold rounded-xl pl-3 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer shadow-sm"
               >
                 {accountsList.map(acc => (
                   <option key={acc} value={acc}>Acc: {acc}</option>
                 ))}
               </select>
               <ChevronDown size={14} className="absolute right-3 top-3 text-[var(--muted-foreground)] pointer-events-none" />
             </div>
          </div>

          <p className="text-[10px] text-[var(--muted-foreground)] font-medium flex items-center gap-1 mt-1">
             <Clock size={10} className="text-[var(--primary)]"/> {t.update} {formatTimeGMT8(liveData.last_update)}
          </p>
        </div>
      </div>

      
      {/* DYNAMIC AI COMMAND CENTER */}
      {botType !== "NON_ML" && (
        <div className={`border rounded-3xl p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 relative overflow-hidden transition-all duration-700
          bg-[var(--card-bg)] ${theme.border} ${wsConnected ? theme.glow : 'shadow-none opacity-80'}`}
        >
          <div className={`absolute top-4 left-4 w-10 h-10 border-t-4 border-l-4 ${theme.brackets} ${wsConnected ? 'opacity-60' : 'opacity-30'} rounded-tl-xl pointer-events-none`}></div>
          <div className={`absolute top-4 right-4 w-10 h-10 border-t-4 border-r-4 ${theme.brackets} ${wsConnected ? 'opacity-60' : 'opacity-30'} rounded-tr-xl pointer-events-none`}></div>
          <div className={`absolute bottom-4 left-4 w-10 h-10 border-b-4 border-l-4 ${theme.brackets} ${wsConnected ? 'opacity-60' : 'opacity-30'} rounded-bl-xl pointer-events-none`}></div>
          <div className={`absolute bottom-4 right-4 w-10 h-10 border-b-4 border-r-4 ${theme.brackets} ${wsConnected ? 'opacity-60' : 'opacity-30'} rounded-br-xl pointer-events-none`}></div>

          <div className="flex flex-col items-center justify-center text-center space-y-4 relative z-10">
            
            <div className={`w-32 h-32 flex-shrink-0 rounded-full flex items-center justify-center p-2 relative ${theme.bg} border-2 ${theme.border} overflow-hidden`}>
              {robotState === 'SCANNING' && (
                <>
                  {botType === 'GOD_MODE' && <div className="anim-shine"></div>}
                  {botType === 'BEAST_MODE' && <div className="anim-lightning"></div>}
                  {botType === 'ENIGMA_OTE' && <div className="anim-radar"></div>}
                </>
              )}
              
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                {robotState !== 'SCANNING' && animUrl[robotState] ? (
                  <Lottie path={animUrl[robotState]} loop autoplay style={{width: '90%'}}/>
                ) : (
                  <BotIcon size={56} className={`${theme.accent} ${botType === 'BEAST_MODE' ? 'animate-pulse' : 'transition-colors duration-500'}`} />
                )}
              </div>
            </div>
            
            <div>
              <h3 className={`text-xl font-black uppercase tracking-tighter flex items-center justify-center gap-2 drop-shadow-sm ${theme.accent}`}>{theme.name}</h3>
              <p className="text-[10px] font-mono font-bold text-[var(--muted-foreground)] uppercase tracking-widest">{theme.vibe}</p>
            </div>

            <div className="flex gap-4 bg-[var(--background)] px-4 py-2 rounded-xl border border-[var(--card-border)] shadow-inner">
               <span className="flex items-center gap-1 text-[10px] font-bold transition-colors"><Activity size={12} className={wsConnected ? "text-blue-500 animate-pulse" : "text-gray-500"}/> {wsConnected ? `${ping}ms` : '--'}</span>
               <span className="flex items-center gap-1 text-[10px] font-bold"><Server size={12} className={theme.accent}/> {t.cloud_sync}</span>
            </div>
          </div>

          <div className={`md:col-span-2 rounded-2xl border ${theme.border} p-4 font-mono text-[11px] sm:text-xs h-60 overflow-y-auto flex flex-col gap-2 relative shadow-inner group transition-colors duration-500 ${theme.termBg}`}>
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06] text-black dark:text-white transition-opacity z-0" style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px)', backgroundSize: '100% 3px' }}></div>

            <div className={`sticky top-0 pb-2 border-b border-slate-300 dark:border-gray-800 mb-2 flex justify-between items-center z-10 backdrop-blur-md transition-colors duration-500 ${theme.termBg}/90`}>
               <span className="text-slate-500 dark:text-gray-500 font-bold flex items-center gap-2 tracking-widest text-[10px] md:text-xs uppercase">
                 <Terminal size={14} className="text-slate-400 dark:text-gray-400"/> 
                 {theme.exe}
                 {wsConnected ? (<span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-500 rounded text-[8px] animate-pulse">{t.link_online}</span>) : (<span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-500 rounded text-[8px]">{t.link_offline}</span>)}
               </span>
               <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500/70"></div><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"></div><div className="w-2.5 h-2.5 rounded-full bg-green-500/70"></div></div>
            </div>

            <div className="z-10 flex flex-col gap-2 flex-grow scroll-smooth">
              {terminalLogs.map((log, i) => (
                <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-bottom-1 transition-colors duration-300">
                  <span className="text-slate-400 dark:text-gray-600 shrink-0 font-bold">[{log.time}]</span>
                  <span className={`break-words ${getTerminalLogColor(log.type)}`}>
                    <span className="opacity-50 mr-1">{(log.type || '').includes('SCANNING') ? '>' : '>>'}</span> {log.text}
                  </span>
                </div>
              ))}
              <div className="flex gap-3"><span className="text-slate-400 dark:text-gray-600 shrink-0">[{getGMT8Time()}]</span><span className={`${theme.accent} animate-pulse`}>_</span></div>
            </div>
          </div>
        </div>
      )}

      {/* FINANCIAL METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-transform duration-500">
        {[
          { label: t.growth, val: `${Number(liveData.absolute_growth_percent || 0) > 0 ? '+' : ''}${formatPct(liveData.absolute_growth_percent)}`, sub: t.abs_gain, icon: TrendingUp, color: 'text-green-500' },
          { label: t.pure_profit, val: formatCur(liveData.pure_profit), sub: t.trading_result, icon: DollarSign, color: 'text-blue-500' },
          { label: t.balance, val: formatCur(liveData.balance), sub: `${t.margin}: ${formatPct(liveData.margin_level)}`, icon: Wallet, color: 'text-[var(--foreground)]' },
          { label: t.max_dd, val: `-${formatPct(liveData.drawdown_percent)}`, sub: t.peak_trough, icon: TrendingDown, color: 'text-red-500' }
        ].map((item, i) => (
          <div key={i} className={`bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-5 flex flex-col justify-between shadow-sm transition-colors hover:border-[var(--primary)] ${i===3 ? 'border-b-4 border-b-red-500' : ''}`}>
            <p className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest flex items-center gap-2"><item.icon size={14} className={item.color}/> {item.label}</p>
            <div className={`mt-4 text-2xl font-black tracking-tight ${i===0?'text-green-500':i===3?'text-red-500':'text-[var(--foreground)]'}`}>{item.val}</div>
            <p className="text-[9px] text-[var(--muted-foreground)] mt-1 font-bold">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* CASH FLOW LEDGER */}
      <div className="bg-[var(--muted)]/50 rounded-2xl p-5 border border-[var(--card-border)] flex flex-wrap gap-4 justify-between items-center shadow-sm">
        {[
          { label: t.init_depo, val: formatCur(liveData.initial_deposit), icon: Wallet, c: 'text-blue-500' },
          { label: t.top_up, val: formatCur(liveData.additional_deposits), icon: ArrowDownToLine, c: 'text-green-500' },
          { label: t.withdrawals, val: formatCur(liveData.total_withdrawals), icon: ArrowUpFromLine, c: 'text-red-500' }
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 w-full md:w-auto">
            <div className={`p-2.5 rounded-xl bg-[var(--background)] shadow-sm border border-[var(--card-border)] ${item.c}`}><item.icon size={16}/></div>
            <div>
              <p className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">{item.label}</p>
              <p className="font-bold text-[var(--foreground)] text-sm">{item.val}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 border-[var(--card-border)] pt-4 md:pt-0 mt-2 md:mt-0">
          <div>
            <p className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest md:text-right">{t.net_capital}</p>
            <p className="font-black text-xl tracking-tight text-[var(--primary)]">{formatCur(Number(liveData.initial_deposit||0) + Number(liveData.additional_deposits||0) - Number(liveData.total_withdrawals||0))}</p>
          </div>
        </div>
      </div>

      {/* CHART & 5-DAYS HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 shadow-sm">
          <h3 className="font-bold text-sm text-[var(--foreground)] mb-6 flex items-center gap-2"><Activity size={16} className="text-[var(--primary)]"/> {t.growth_traj}</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" opacity={0.5} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val.toLocaleString()}`} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '8px', color: 'var(--foreground)', fontSize: '12px' }} itemStyle={{ fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorEquity)" name="Equity" activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }}/>
                <Line type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }} name="Balance" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 flex flex-col shadow-sm">
          <h3 className="font-bold text-sm text-[var(--foreground)] mb-6 flex items-center gap-2"><CalendarDays size={16} className="text-[var(--primary)]"/> {t.daily_perf}</h3>
          <div className="space-y-2 flex-grow flex flex-col justify-center">
            {realDailyHistory.length > 0 ? (
              realDailyHistory.map((day, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)] hover:bg-[var(--muted)] transition-colors shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-[var(--foreground)] uppercase">{day.date}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1 mt-0.5"><BarChart3 size={10}/> {Number(day.lot).toFixed(1)} Vol</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${day.profit >= 0 ? "text-green-500" : "text-red-500"}`}>{day.profit > 0 ? "+" : ""}{formatCur(day.profit)}</p>
                    <p className={`text-[9px] font-bold ${day.growth >= 0 ? "text-green-600 bg-green-500/10" : "text-red-600 bg-red-500/10"} inline-block px-1.5 py-0.5 rounded mt-0.5`}>{day.growth > 0 ? "+" : ""}{Number(day.growth).toFixed(1)}%</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 border border-[var(--card-border)] border-dashed rounded-xl">
                <p className="text-xs font-bold text-[var(--muted-foreground)]">{t.no_history}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LIVE OPEN POSITIONS TABLE */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] shadow-sm overflow-hidden transition-all duration-500">
        <div className="p-5 border-b border-[var(--card-border)] flex justify-between items-center bg-[var(--muted)]/20">
          <h3 className="font-bold text-sm text-[var(--foreground)] flex items-center gap-2"><Clock size={16} className="text-blue-500" /> {t.live_exp} ({openTrades.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--background)] text-[10px] uppercase text-[var(--muted-foreground)] border-b border-[var(--card-border)]">
                <th className="p-4 font-black">{t.th_sym}</th><th className="p-4 font-black text-center">{t.th_type}</th><th className="p-4 font-black text-center">{t.th_vol}</th><th className="p-4 font-black text-right">{t.th_pnl}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {openTrades.length === 0 ? (
                <tr><td colSpan="4" className="p-10 text-center text-xs text-[var(--muted-foreground)] font-bold italic tracking-widest uppercase">{t.searching_liq}</td></tr>
              ) : openTrades.map((trade, idx) => (
                <tr key={idx} className="border-b border-[var(--card-border)] hover:bg-[var(--muted)]/50 transition-colors">
                  <td className="p-4"><div className="font-bold text-[var(--foreground)]">{trade.symbol}</div><div className="text-[10px] font-mono text-gray-500">#{trade.ticket}</div></td>
                  <td className="p-4 text-center"><span className={`px-3 py-1 rounded-md text-[10px] font-black ${trade.type === "BUY" ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"}`}>{trade.type}</span></td>
                  <td className="p-4 text-center font-mono font-bold text-[var(--foreground)]">{Number(trade.volume).toFixed(2)}</td>
                  <td className={`p-4 text-right font-black ${trade.profit >= 0 ? "text-green-500" : "text-red-500"}`}>{Number(trade.profit) > 0 ? "+" : ""}{formatCur(trade.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}