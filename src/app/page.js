"use client";

import { useState, useEffect } from "react";
import { ChevronRight, Cpu, Crown, Radar, Activity, Zap, Globe, Calculator, Receipt, ArrowRight, User, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { db } from "../lib/firebase";
import { ref, onValue } from "firebase/database";
import FeaturedInvestors from "../components/FeaturedInvestors";

// Custom SVG Shanks Claw untuk Beast Mode
const ShanksClawMarks = ({ size = 24, className, ...props }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M7 3 L5 21" />
    <path d="M12 4 L10 20" />
    <path d="M17 3 L15 21" />
  </svg>
);

// Custom SVG Telegram Icon
const TelegramIcon = ({ size = 24, className, ...props }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
);

// ============================================================================
// DICTIONARY BILINGUAL (EN & ID)
// ============================================================================
const dict = {
  en: {
    live_node: "Live Cloud Node Active",
    title_1: "QUANTITATIVE",
    title_2: "SUPREMACY.",
    description: "A decentralized algorithmic trading system driven by Ai Machine Learning and real-time Firebase Cloud synchronization. Emotionless, pure computational precision.",
    btn_enter: "ENTER COMMAND CENTER",
    arsenal_title: "THE PILOT MARKET",
    arsenal_sub: "Choose your artificial intelligence architecture",
    banner_title: "Curious about your potential gain?",
    banner_sub: "Test our AI projection matrix.",
    banner_input: "Enter Capital (USD)",
    banner_btn: "SIMULATE NOW",
    sim_title: "PROJECTION MATRIX",
    sim_sub: "Simulate your asset growth potential based on REAL-TIME AI historical performance.",
    sim_label_bot: "Select Algorithm",
    sim_label_depo: "Initial Deposit (USD)",
    sim_label_dur: "Projection Duration",
    sim_btn: "RUN SIMULATION",
    sim_calculating: "CALCULATING...",
    sim_awaiting: "AWAITING INPUT DATA...",
    sim_processing: "PROCESSING MATRIX...",
    sim_receipt_title: "KRX YIELD RECEIPT",
    sim_lbl_node: "NODE ID",
    sim_lbl_capital: "CAPITAL",
    sim_lbl_duration: "DURATION",
    sim_lbl_rate: "LIVE RATE",
    sim_lbl_profit: "PROFIT",
    sim_lbl_gain: "GAIN",
    sim_lbl_final: "FINAL",
    sim_disclaimer_1: "*PROJECTION BASED ON REAL-TIME ACCOUNT DATA.",
    sim_disclaimer_2: "DOES NOT GUARANTEE FUTURE RESULTS.",
    months_text: "Months",
    member_login: "Member Login",
    // === NEW: CTA TELEGRAM (ENGLISH) ===
    tg_tooltip: "Establish Secure Connection",
    banner_bot_title: "Ready to automate your wealth?",
    banner_bot_desc: "Talk directly to the Creator and gain access to the Quantitative Nodes.",
    banner_bot_btn: "CONNECT TO CREATOR",
    tg_prefill: "Initiating secure connection... 🤖%0A%0AHi Arwan, I was exploring the KRX Command Center. I'm highly interested in the Quantitative Trading System and the AI Architectures. Can we discuss the potential yields and how I can gain access to the nodes?",
    opts: { klasik: "Stable", god: "Precision", enigma: "Recon", beast: "Aggressive", live: "Live Rate" },
    bots: {
      god: "Absolute precision AI specialist. Trained on millions of rows of historical data to execute positions only when the win ratio exceeds critical thresholds.",
      beast: "Aggressive predator seeking momentum. Sniffs out liquidity pools and rides breakout volumes when the market is at peak volatility.",
      enigma: "Limit Order trap specialist. Analyzes market microstructure to detect BPR anomalies and sets nets at the Optimal Trade Entry (OTE) zone.",
      klasik: "Classic algorithmic foundation without AI. Runs on a pure mathematical framework to dampen XAUUSD volatility through layered dynamic grids."
    }
  },
  id: {
    live_node: "Node Cloud Aktif",
    title_1: "QUANTITATIVE",
    title_2: "SUPREMACY.",
    description: "Sistem trading algoritmik terdesentralisasi yang digerakkan oleh Machine Learning XGBoost dan sinkronisasi Cloud Firebase secara real-time. Bebas emosi, murni komputasi presisi.",
    btn_enter: "MASUK RUANG KENDALI",
    arsenal_title: "THE PILOT MARKET",
    arsenal_sub: "Pilih arsitektur kecerdasan buatan Anda",
    banner_title: "Penasaran dengan potensi profit Anda?",
    banner_sub: "Uji matriks proyeksi AI kami.",
    banner_input: "Modal (USD)",
    banner_btn: "SIMULASIKAN",
    sim_title: "PROJECTION MATRIX",
    sim_sub: "Simulasikan potensi pertumbuhan aset Anda berdasarkan performa AKTUAL AI kami.",
    sim_label_bot: "Pilih Algoritma",
    sim_label_depo: "Modal Awal (USD)",
    sim_label_dur: "Durasi Proyeksi",
    sim_btn: "JALANKAN SIMULASI",
    sim_calculating: "MENGHITUNG...",
    sim_awaiting: "MENUNGGU DATA INPUT...",
    sim_processing: "MEMPROSES MATRIKS...",
    sim_receipt_title: "RESI PROFIT KRX",
    sim_lbl_node: "ID NODE",
    sim_lbl_capital: "MODAL",
    sim_lbl_duration: "DURASI",
    sim_lbl_rate: "RATE AKTUAL",
    sim_lbl_profit: "KEUNTUNGAN",
    sim_lbl_gain: "PERTUMBUHAN",
    sim_lbl_final: "TOTAL",
    sim_disclaimer_1: "*PROYEKSI BERDASARKAN DATA AKUN REAL-TIME.",
    sim_disclaimer_2: "TIDAK MENJAMIN HASIL DI MASA DEPAN.",
    months_text: "Bulan",
    member_login: "Login Member",
    // === NEW: CTA TELEGRAM (INDONESIA) ===
    tg_tooltip: "Bangun Koneksi Aman",
    banner_bot_title: "Siap mengotomatisasi aset Anda?",
    banner_bot_desc: "Berbicara langsung dengan sang Kreator dan dapatkan akses ke Node Kuantitatif.",
    banner_bot_btn: "HUBUNGI KREATOR",
    tg_prefill: "Memulai koneksi aman... 🤖%0A%0AHalo Mas Arwan, saya baru saja melihat KRX Command Center. Saya sangat tertarik dengan Sistem Trading Kuantitatif dan Arsitektur AI-nya. Boleh kita diskusi lebih lanjut mengenai potensi profitnya dan bagaimana cara saya bisa mendapatkan akses?",
    opts: { klasik: "Stabil", god: "Presisi", enigma: "Pengintai", beast: "Agresif", live: "Rate Aktual" },
    bots: {
      god: "AI spesialis presisi absolut. Dilatih dengan jutaan baris data historis untuk mengeksekusi posisi hanya saat rasio kemenangan berada di atas ambang batas kritis.",
      beast: "Predator agresif pencari momentum. Mengendus penumpukan likuiditas dan menunggangi volume breakout saat pasar berada di titik puncak volatilitas.",
      enigma: "Spesialis perangkap Limit Order. Menganalisis mikrostuktur pasar untuk mendeteksi anomali BPR dan menempatkan jaring pada zona Optimal Trade Entry (OTE).",
      klasik: "Fondasi algoritma klasik tanpa AI. Berjalan pada kerangka matematis murni untuk meredam volatilitas XAUUSD melalui grid dinamis berlapis."
    }
  }
};

export default function LandingPage() {
  const [lang, setLang] = useState("en");
  const t = dict[lang];

  // Mobile Click State
  const [activeCard, setActiveCard] = useState(null);

  // Real-Time Rates from Firebase
  const [realRates, setRealRates] = useState({ klasik: 8, god: 18, enigma: 24, beast: 35 });

  // Simulator States
  const [simBot, setSimBot] = useState("god");
  const [simDepo, setSimDepo] = useState(1000);
  const [simDur, setSimDur] = useState(3);
  const [simResult, setSimResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const accountsRef = ref(db, 'account_data');
    const unsubscribe = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let updatedRates = { klasik: 8, god: 18, enigma: 24, beast: 35 }; 
        let counts = { klasik: 0, god: 0, enigma: 0, beast: 0 };
        
        Object.values(data).forEach(acc => {
          const type = acc.metadata?.bot_type;
          const growth = acc.realtime_stats?.absolute_growth_percent;
          
          if (type && growth !== undefined && !isNaN(growth)) {
             let key = "";
             if (type === "NON_ML") key = "klasik";
             if (type === "GOD_MODE") key = "god";
             if (type === "ENIGMA_OTE") key = "enigma";
             if (type === "BEAST_MODE") key = "beast";
             
             if (key) {
                updatedRates[key] = ((updatedRates[key] * counts[key]) + Number(growth)) / (counts[key] + 1);
                counts[key]++;
             }
          }
        });

        setRealRates({
           klasik: counts.klasik > 0 ? updatedRates.klasik : 8,
           god: counts.god > 0 ? updatedRates.god : 18,
           enigma: counts.enigma > 0 ? updatedRates.enigma : 24,
           beast: counts.beast > 0 ? updatedRates.beast : 35
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const botThemeConfig = {
    "klasik": { name: "CLASSIC GRID EA", color: "text-blue-500", shadow: "shadow-blue-500/50" },     
    "god": { name: "GOD HEALER", color: "text-amber-500", shadow: "shadow-amber-500/50" },     
    "enigma": { name: "ENIGMA OTE", color: "text-emerald-500", shadow: "shadow-emerald-500/50" }, 
    "beast": { name: "BEAST WATCHER", color: "text-red-500", shadow: "shadow-red-500/50" }      
  };

  const handleSimulate = (e) => {
    if (e) e.preventDefault();
    setIsSimulating(true);
    setSimResult(null);

    setTimeout(() => {
      const decimalRate = (realRates[simBot] || 0) / 100;
      const principal = parseFloat(simDepo) || 0; 
      const months = parseInt(simDur);
      
      const finalAmount = principal * Math.pow((1 + decimalRate), months);
      const profit = finalAmount - principal;
      const gainPct = principal > 0 ? (profit / principal) * 100 : 0;

      setSimResult({
        botName: botThemeConfig[simBot].name,
        color: botThemeConfig[simBot].color,
        shadow: botThemeConfig[simBot].shadow,
        ratePct: realRates[simBot] || 0,
        principal: principal,
        months: months,
        profit: profit,
        gainPct: gainPct,
        finalAmount: finalAmount
      });
      setIsSimulating(false);
    }, 1200); 
  };

  const formatCur = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const scrollToMatrix = () => {
    const el = document.getElementById('simulation-matrix');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const botArsenal = [
    { id: "klasik", name: "CLASSIC EA", type: "QUANTITATIVE ALGO", vibe: "Logic Martingale & Hedging Grid", desc: t.bots.klasik, image: "/images/common_bot_mode.webp", accent: "text-blue-500", borderGlow: "group-hover:border-blue-500/50 group-hover:shadow-[0_0_40px_rgba(59,130,246,0.3)]", icon: Cpu },
    { id: "god", name: "GOD HEALER", type: "MACHINE LEARNING", vibe: "High Precision | Killzone Ratio", desc: t.bots.god, image: "/images/god_mode.jpg", accent: "text-amber-500", borderGlow: "group-hover:border-amber-500/50 group-hover:shadow-[0_0_40px_rgba(245,158,11,0.3)]", icon: Crown },
    { id: "beast", name: "BEAST WATCHER", type: "MACHINE LEARNING", vibe: "Liquidity Hunter | Maximum Volume", desc: t.bots.beast, image: "/images/beast_mode.webp", accent: "text-red-500", borderGlow: "group-hover:border-red-500/50 group-hover:shadow-[0_0_40px_rgba(239,68,68,0.3)]", icon: ShanksClawMarks },
    { id: "enigma", name: "ENIGMA OTE", type: "MACHINE LEARNING", vibe: "Spatial Recon | Cipher BPR Anomalies", desc: t.bots.enigma, image: "/images/enigma_mode.webp", accent: "text-emerald-400", borderGlow: "group-hover:border-emerald-500/50 group-hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]", icon: Radar },
  ];

  return (
    <div className="relative min-h-screen text-slate-200 font-sans selection:bg-blue-500/30 overflow-x-hidden bg-[#030712]">
      
      {/* FLOATING TELEGRAM BUTTON */}
      <a 
        href={`https://t.me/kiroix?text=${t.tg_prefill}`} 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-[100] group flex items-center justify-center w-14 h-14 bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-full shadow-[0_0_20px_rgba(42,171,238,0.5)] hover:shadow-[0_0_30px_rgba(42,171,238,0.8)] hover:scale-110 transition-all duration-300"
      >
        <TelegramIcon size={24} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
        {/* Tooltip */}
        <span className="absolute right-16 px-3 py-1.5 bg-black/80 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {t.tg_tooltip}
        </span>
      </a>

      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-blue-500 opacity-20 blur-[100px]"></div>
      </div>

      {/* Floating Control Header */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
        <div className="flex items-center bg-black/40 backdrop-blur-md border border-white/10 p-1 rounded-lg shadow-lg">
          <Globe size={14} className="text-slate-400 ml-2 mr-1" />
          <button onClick={() => setLang('en')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${lang === 'en' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>EN</button>
          <button onClick={() => setLang('id')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${lang === 'id' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>ID</button>
        </div>
        <Link href="/login" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-lg text-xs font-bold text-white backdrop-blur-md transition-all">
          <User size={14} /> {t.member_login}
        </Link>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-12">
        
        {/* === HERO SECTION === */}
        <div className="text-center max-w-3xl mx-auto space-y-8 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold tracking-widest uppercase mb-4 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
             <Activity size={12} className="animate-pulse" /> {t.live_node}
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white">
            {t.title_1} <br className="hidden md:block"/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              {t.title_2}
            </span>
          </h1>
          
          <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
            {t.description}
          </p>

          <div className="pt-4">
            <Link href="/login" className="group relative inline-flex items-center justify-center px-8 py-4 bg-white text-black font-black uppercase tracking-widest text-sm rounded-xl overflow-hidden hover:scale-105 transition-transform duration-300 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"></div>
              <span className="relative z-10 flex items-center gap-2 group-hover:text-white transition-colors duration-300">
                {t.btn_enter} <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </div>
        </div>

        {/* === ADS BANNER INTERAKTIF === */}
        <div className="max-w-4xl mx-auto mb-24 transition-transform duration-300">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-[2px] rounded-3xl shadow-[0_0_30px_rgba(79,70,229,0.2)]">
            <div className="bg-[#0a0a0a] rounded-[22px] p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-500/5 pointer-events-none"></div>
              
              <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
                <div className="w-14 h-14 bg-blue-500/20 rounded-full items-center justify-center animate-pulse shrink-0 hidden md:flex">
                  <Calculator className="text-blue-400" size={24} />
                </div>
                <div className="text-left flex-grow">
                  <h4 className="text-white font-black uppercase tracking-widest text-sm md:text-base">
                    {t.banner_title}
                  </h4>
                  <p className="text-slate-400 text-xs md:text-sm mt-1">
                    {t.banner_sub}
                  </p>
                </div>
              </div>

              {/* INPUT LANGSUNG DI DALAM BANNER */}
              <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 relative z-10">
                <div className="relative w-full sm:w-48">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input 
                    type="number" 
                    min="100"
                    step="100"
                    value={simDepo}
                    onChange={(e) => setSimDepo(e.target.value)}
                    className="w-full bg-black border border-white/20 text-white font-mono rounded-xl pl-8 pr-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                    placeholder={t.banner_input}
                  />
                </div>
                <button 
                  onClick={() => {
                    scrollToMatrix();
                    handleSimulate(); 
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] whitespace-nowrap"
                >
                  {t.banner_btn} <ArrowRight size={16} />
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* === ARSENAL GRID SECTION === */}
        <div className="space-y-4 mb-12 text-center md:text-left flex flex-col md:flex-row justify-between items-end">
           <div>
             <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3 justify-center md:justify-start">
               <Zap className="text-blue-500" /> {t.arsenal_title}
             </h2>
             <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">{t.arsenal_sub}</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-32">
          {botArsenal.map((bot) => {
            const isActive = activeCard === bot.id;
            
            return (
              <div 
                key={bot.id} 
                onClick={() => setActiveCard(isActive ? null : bot.id)}
                className={`group relative h-[420px] rounded-3xl overflow-hidden border border-white/10 bg-[#0a0a0a] transition-all duration-500 cursor-pointer ${isActive ? bot.borderGlow.replace(/group-hover:/g, '') : bot.borderGlow}`}
              >
                <div className="absolute inset-0 z-0">
                  <Image 
                    src={bot.image} 
                    alt={bot.name}
                    fill
                    style={{ objectFit: "cover" }}
                    className={`transition-all duration-700 ${isActive ? 'opacity-60 scale-110' : 'opacity-40 group-hover:opacity-60 group-hover:scale-110'}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent"></div>
                </div>
                <div className="relative z-10 h-full flex flex-col justify-end p-6">
                  <div className={`transform transition-transform duration-500 ${isActive ? 'translate-y-0' : 'translate-y-4 group-hover:translate-y-0'}`}>
                    <div className={`w-10 h-10 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center mb-4 ${bot.accent}`}>
                      <bot.icon size={20} />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mb-1">{bot.type}</p>
                    <h3 className={`text-xl font-black uppercase tracking-tight mb-1 ${bot.accent}`}>{bot.name}</h3>
                    <p className="text-[10px] font-mono text-slate-300 mb-4">{bot.vibe}</p>
                    
                    <div className={`overflow-hidden transition-all duration-500 delay-100 ${isActive ? 'opacity-100 max-h-48' : 'opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-48'}`}>
                      <p className="text-xs text-slate-400 leading-relaxed border-t border-white/10 pt-4 mt-2">
                        {bot.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* === FEATURED INVESTORS SECTION === */}
        <div className="mb-32">
          <FeaturedInvestors lang={lang} />
        </div>

        {/* === PROJECTION MATRIX (REAL-TIME SIMULATOR) === */}
        <div id="simulation-matrix" className="max-w-5xl mx-auto bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-12 shadow-2xl relative overflow-hidden">
          
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #3b82f6 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          <div className="text-center mb-10 relative z-10">
            <h2 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-3">
              <Calculator className="text-blue-500" size={28} /> {t.sim_title}
            </h2>
            <p className="text-slate-400 text-sm mt-3 font-bold bg-blue-500/10 inline-block px-4 py-1.5 rounded-lg border border-blue-500/20">{t.sim_sub}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.sim_label_bot}</label>
                <select 
                  value={simBot}
                  onChange={(e) => setSimBot(e.target.value)}
                  className="w-full bg-black border border-white/20 text-white rounded-xl p-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none font-bold"
                >
                  <option value="klasik">KLASIK EA ({t.opts.klasik} - {t.opts.live}: {realRates.klasik?.toFixed(1)}%)</option>
                  <option value="god">GOD HEALER ({t.opts.god} - {t.opts.live}: {realRates.god?.toFixed(1)}%)</option>
                  <option value="enigma">ENIGMA OTE ({t.opts.enigma} - {t.opts.live}: {realRates.enigma?.toFixed(1)}%)</option>
                  <option value="beast">BEAST WATCHER ({t.opts.beast} - {t.opts.live}: {realRates.beast?.toFixed(1)}%)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.sim_label_depo}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input 
                    type="number" 
                    min="100"
                    step="100"
                    value={simDepo}
                    onChange={(e) => setSimDepo(e.target.value)}
                    className="w-full bg-black border border-white/20 text-white font-mono rounded-xl pl-8 pr-4 py-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.sim_label_dur} ({simDur} {t.months_text})</label>
                <input 
                  type="range" 
                  min="1" 
                  max="12" 
                  value={simDur}
                  onChange={(e) => setSimDur(e.target.value)}
                  className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  <span>1 {t.months_text}</span>
                  <span>6 {t.months_text}</span>
                  <span>12 {t.months_text}</span>
                </div>
              </div>

              <button 
                onClick={handleSimulate}
                disabled={isSimulating}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-sm tracking-widest uppercase rounded-xl py-4 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(37,99,235,0.2)]"
              >
                {isSimulating ? t.sim_calculating : t.sim_btn} <ArrowRight size={16} />
              </button>
            </div>

            <div className="h-full flex items-center justify-center relative">
              <div className={`w-full max-w-sm bg-[#020617] border ${simResult ? `border-${simResult.color.split('-')[1]}-500/50 ${simResult.shadow}` : 'border-white/10'} rounded-lg p-6 font-mono relative overflow-hidden transition-all duration-500 shadow-2xl min-h-[350px] flex flex-col justify-center`}>
                
                <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(transparent_50%,rgba(0,0,0,1)_50%)] bg-[length:100%_4px]"></div>

                {!simResult && !isSimulating && (
                  <div className="text-center text-slate-600 space-y-4">
                    <Receipt size={48} className="mx-auto opacity-20" />
                    <p className="text-xs tracking-widest">{t.sim_awaiting}</p>
                  </div>
                )}

                {isSimulating && (
                  <div className="text-center text-blue-500 space-y-4 animate-pulse">
                    <Activity size={48} className="mx-auto" />
                    <p className="text-xs tracking-widest">{t.sim_processing}</p>
                  </div>
                )}

                {simResult && !isSimulating && (
                  <div className="relative z-10 text-xs sm:text-sm animate-in fade-in zoom-in duration-500">
                    <div className="text-center mb-4">
                      <p className="text-slate-500">================================</p>
                      <p className="font-bold text-white tracking-widest py-1">{t.sim_receipt_title}</p>
                      <p className="text-slate-500">================================</p>
                    </div>

                    <div className="space-y-2 mb-4 text-slate-300 uppercase tracking-wider">
                      <div className="flex justify-between">
                        <span>{t.sim_lbl_node}</span>
                        <span className={`font-bold ${simResult.color}`}>{simResult.botName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t.sim_lbl_capital}</span>
                        <span className="text-white font-mono">{formatCur(simResult.principal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t.sim_lbl_duration}</span>
                        <span className="text-white">{simResult.months} {t.months_text}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t.sim_lbl_rate}</span>
                        <span className="text-white font-mono">{simResult.ratePct?.toFixed(1)}% / MO</span>
                      </div>
                    </div>

                    <div className="text-center mb-4">
                      <p className="text-slate-500">--------------------------------</p>
                    </div>

                    <div className="space-y-2 mb-4 uppercase tracking-wider">
                      <div className="flex justify-between">
                        <span className="text-slate-300">{t.sim_lbl_profit}</span>
                        <span className="text-green-400 font-bold font-mono">+{formatCur(simResult.profit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">{t.sim_lbl_gain}</span>
                        <span className="text-green-400 font-bold font-mono">+{simResult.gainPct.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="text-center mb-4">
                      <p className="text-slate-500">================================</p>
                    </div>

                    <div className="flex justify-between items-center text-lg sm:text-xl">
                      <span className="font-bold text-white tracking-widest uppercase">{t.sim_lbl_final}</span>
                      <span className={`font-black font-mono ${simResult.color} drop-shadow-[0_0_8px_currentColor]`}>
                        {formatCur(simResult.finalAmount)}
                      </span>
                    </div>

                    <div className="mt-6 text-center text-[9px] text-slate-600 font-sans font-bold">
                      <p>{t.sim_disclaimer_1}</p>
                      <p>{t.sim_disclaimer_2}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* === BOTTOM CTA ELITE BANNER === */}
        <div className="max-w-4xl mx-auto mt-24 mb-10 text-center">
          <div className="bg-[#0a0a0a] border border-blue-500/20 p-8 md:p-12 rounded-3xl shadow-[0_0_40px_rgba(37,99,235,0.1)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-blue-600/10 to-transparent pointer-events-none"></div>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4 relative z-10">{t.banner_bot_title}</h2>
            <p className="text-slate-400 text-sm md:text-base mb-8 relative z-10">{t.banner_bot_desc}</p>
            <a 
              href={`https://t.me/kiroix?text=${t.tg_prefill}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm tracking-widest uppercase rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:scale-105 relative z-10"
            >
              <TelegramIcon size={18} />
              {t.banner_bot_btn}
            </a>
          </div>
        </div>

      </main>
    </div>
  );
}