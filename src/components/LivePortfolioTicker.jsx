"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../lib/firebase";
import { ref, onValue } from "firebase/database";
import { TrendingUp, TrendingDown, Wallet, Activity, Trophy, Zap } from "lucide-react";

const formatCurrency = (val) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val || 0);

const formatPercent = (val) => {
  const num = Number(val) || 0;
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
};

// ============================================================================
// BILINGUAL DICTIONARY
// ============================================================================
const dict = {
  en: {
    live_badge: "LIVE PORTFOLIO",
    capital: "Capital Managed",
    daily: "Daily Gain",
    alltime: "All Time Gain",
    winrate: "Win Rate",
    accounts: "Active Nodes",
  },
  id: {
    live_badge: "PORTFOLIO AKTIF",
    capital: "Modal Dikelola",
    daily: "Profit Hari Ini",
    alltime: "Profit Keseluruhan",
    winrate: "Tingkat Menang",
    accounts: "Node Aktif",
  },
};

export default function LivePortfolioTicker({ lang = "en" }) {
  const [stats, setStats] = useState({
    capitalManaged: 0,
    dailyGain: 0,
    dailyGainPct: 0,
    allTimeGain: 0,
    allTimeGainPct: 0,
    totalTrades: 0,
    winRate: 0,
    activeAccounts: 0,
  });
  const [mounted, setMounted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    const accountsRef = ref(db, "account_data");

    const unsubscribe = onValue(accountsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      let totalBalance = 0;
      let totalDailyProfit = 0;
      let totalInitialBalance = 0;
      let totalProfit = 0;
      let activeAccounts = 0;

      const now = new Date();
      const todayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );
      const todayWITA = new Date(todayUTC.getTime() + 8 * 3600000);
      const todayYear = todayWITA.getUTCFullYear();
      const todayMonth = todayWITA.getUTCMonth();
      const todayDate = todayWITA.getUTCDate();

      Object.values(data).forEach((acc) => {
        const meta = acc.metadata || {};
        const botType = meta.bot_type || "NON_ML";
        if (botType !== "NON_ML") return;

        const rt = acc.realtime_stats || {};

        const balance = Number(rt.balance) || Number(rt.current_balance) || 0;
        totalBalance += balance;

        const initialDeposit =
          Number(rt.initial_deposit) || Number(meta.initial_deposit) || 10000;
        const accProfit =
          Number(rt.pure_profit) ||
          Number(rt.total_profit) ||
          Number(rt.absolute_growth) ||
          0;
        totalInitialBalance += initialDeposit;
        totalProfit += accProfit;

        activeAccounts++;

        const snapshots = acc.snapshots || {};
        Object.keys(snapshots).forEach((tsKey) => {
          let timeMs = parseInt(tsKey);
          if (timeMs < 10000000000) {
            timeMs = timeMs * 1000;
          }
          const snapDate = new Date(timeMs + 28800000);
          const sy = snapDate.getUTCFullYear();
          const sm = snapDate.getUTCMonth();
          const sd = snapDate.getUTCDate();

          if (sy === todayYear && sm === todayMonth && sd === todayDate) {
            const dailyProfit =
              Number(snapshots[tsKey]?.daily_profit) ||
              Number(snapshots[tsKey]?.profit) ||
              0;
            totalDailyProfit += dailyProfit;
          }
        });
      });

      let winDays = 0;
      let totalDays = 0;
      Object.values(data).forEach((acc) => {
        const meta = acc.metadata || {};
        const botType = meta.bot_type || "NON_ML";
        if (botType !== "NON_ML") return;

        const snapshots = acc.snapshots || {};
        const dayMap = {};

        Object.keys(snapshots).forEach((tsKey) => {
          let timeMs = parseInt(tsKey);
          if (timeMs < 10000000000) timeMs = timeMs * 1000;
          const snapDate = new Date(timeMs + 28800000);
          const key = `${snapDate.getUTCFullYear()}-${snapDate.getUTCMonth()}-${snapDate.getUTCDate()}`;

          const dayProfit =
            Number(snapshots[tsKey]?.daily_profit) ||
            Number(snapshots[tsKey]?.profit) ||
            0;
          if (!dayMap[key]) {
            dayMap[key] = { profit: dayProfit };
          } else {
            dayMap[key].profit += dayProfit;
          }
        });

        Object.values(dayMap).forEach((day) => {
          totalDays++;
          if (day.profit > 0) winDays++;
        });
      });

      const allTimeGainPct =
        totalInitialBalance > 0
          ? (totalProfit / totalInitialBalance) * 100
          : 0;

      setStats({
        capitalManaged: totalBalance,
        dailyGain: totalDailyProfit,
        dailyGainPct:
          totalBalance > 0 ? (totalDailyProfit / totalBalance) * 100 : 0,
        allTimeGain: totalProfit,
        allTimeGainPct,
        totalTrades: totalDays,
        winRate: totalDays > 0 ? (winDays / totalDays) * 100 : 0,
        activeAccounts,
      });
    });

    return () => unsubscribe();
  }, []);

  // ─── Pause handlers ───
  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);
  const handleTouchStart = useCallback((e) => {
    touchStartRef.current = e.touches[0].clientX;
    setIsPaused(true);
  }, []);
  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    setIsPaused(false);
  }, []);

  if (!mounted) return null;

  const isDailyPositive = stats.dailyGain >= 0;
  const isAllTimePositive = stats.allTimeGain >= 0;
  const t = dict[lang] || dict.en;

  // ─── Stat item data (used in both mobile + desktop) ───
  const statsData = [
    {
      key: "capital",
      icon: <Wallet size={16} className="text-blue-400" />,
      label: t.capital,
      value: formatCurrency(stats.capitalManaged),
      valueClass: "text-white",
    },
    {
      key: "daily",
      icon: isDailyPositive ? (
        <TrendingUp size={16} className="text-green-400" />
      ) : (
        <TrendingDown size={16} className="text-red-400" />
      ),
      label: t.daily,
      value: `${isDailyPositive ? "+" : ""}${formatCurrency(stats.dailyGain)} (${formatPercent(stats.dailyGainPct)})`,
      valueClass: isDailyPositive ? "text-green-400" : "text-red-400",
    },
    {
      key: "alltime",
      icon: <Trophy size={16} className="text-amber-400" />,
      label: t.alltime,
      value: `${isAllTimePositive ? "+" : ""}${formatCurrency(stats.allTimeGain)} (${formatPercent(stats.allTimeGainPct)})`,
      valueClass: isAllTimePositive ? "text-green-400" : "text-red-400",
    },
    {
      key: "winrate",
      icon: <Activity size={16} className="text-purple-400" />,
      label: t.winrate,
      value: `${stats.winRate.toFixed(1)}%`,
      valueClass: "text-purple-400",
    },
    {
      key: "nodes",
      icon: <Zap size={16} className="text-cyan-400" />,
      label: t.accounts,
      value: String(stats.activeAccounts),
      valueClass: "text-cyan-400",
    },
  ];

  // ─── Reusable stat item JSX ───
  const renderStatItem = (s, idx, withDivider = true) => (
    <div key={s.key} className="flex items-center gap-2.5 shrink-0">
      {s.icon}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none hidden sm:inline">
          {s.label}
        </span>
        <span className={`text-sm font-black font-mono leading-none ${s.valueClass}`}>
          {s.value}
        </span>
      </div>
      {withDivider && <div className="w-px h-6 bg-white/10 shrink-0 ml-2.5" />}
    </div>
  );

  // ─── Desktop marquee content (duplicate for seamless loop) ───
  const marqueeContent = (
    <>
      {statsData.map((s, i) => renderStatItem(s, i, i < statsData.length - 1))}
    </>
  );

  return (
    <div className="w-full border-y border-white/5 bg-[#050810]/80 backdrop-blur-md relative">
      {/* Subtle gradient glow line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent pointer-events-none" />

      {/* ─── MOBILE LAYOUT: Vertical stack, badge centered + stats full-width ─── */}
      <div className="md:hidden flex flex-col py-3 px-4 gap-3">
        {/* Badge centered di atas */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30">
            <div className="relative w-2.5 h-2.5">
              <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-25" />
              <div className="relative w-full h-full rounded-full bg-green-400 dim-blink" />
            </div>
            <span className="text-xs font-black text-green-400 tracking-widest uppercase">
              {t.live_badge}
            </span>
          </div>
        </div>

        {/* Stats full-width, auto-marquee + touch pause */}
        <div
          className="overflow-hidden no-scrollbar"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={`marquee-container animate-marquee ${isPaused ? "paused" : ""}`}
            style={{ "--marquee-state": isPaused ? "paused" : "running" }}
          >
            <div className="flex items-center gap-4 pr-4">
              {statsData.map((s) => (
                <div key={s.key} className="flex items-center gap-2 shrink-0">
                  {s.icon}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none">
                      {s.label}
                    </span>
                    <span className={`text-sm font-black font-mono leading-none ${s.valueClass}`}>
                      {s.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 pr-4">
              {statsData.map((s) => (
                <div key={s.key} className="flex items-center gap-2 shrink-0">
                  {s.icon}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none">
                      {s.label}
                    </span>
                    <span className={`text-sm font-black font-mono leading-none ${s.valueClass}`}>
                      {s.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── DESKTOP LAYOUT: Horizontal inline ─── */}
      <div className="hidden md:flex max-w-7xl mx-auto items-center py-4 px-6">

        {/* Badge: Static di kiri */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 shrink-0 mr-6">
          <div className="relative w-2.5 h-2.5">
            <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-25" />
            <div className="relative w-full h-full rounded-full bg-green-400 dim-blink" />
          </div>
          <span className="text-xs font-black text-green-400 tracking-widest uppercase">
            {t.live_badge}
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-white/10 shrink-0 mr-6" />

        {/* Desktop: continuous marquee with pause on hover */}
        <div
          className="flex-1 overflow-hidden no-scrollbar"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className={`marquee-container animate-marquee ${isPaused ? "paused" : ""}`}
            style={{ "--marquee-state": isPaused ? "paused" : "running" }}
          >
            <div className="flex items-center gap-6 pr-6">
              {marqueeContent}
            </div>
            <div className="flex items-center gap-6 pr-6">
              {marqueeContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}