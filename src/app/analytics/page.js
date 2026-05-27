"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../../lib/firebase";
import { ref, onValue } from "firebase/database";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  BarChart3,
  Scale,
  Cpu,
  AlertTriangle,
  Zap,
  Wallet,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from "lucide-react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import StatCard from "../../components/ui/StatCard";

// ============================================================================
// ANALYTICS PAGE — Multi-Role Calendar View (Enhanced Terminal Jarvis UI)
//   - Desktop: Calendar monthly heatmap with glassmorphism
//   - Mobile: Expandable list rows with detailed breakdown per day
//   - Core logic: UNCHANGED from original
// ============================================================================

export default function AnalyticsPage() {
  const { user, role } = useAuth();
  return <AnalyticsContent user={user} role={role} />;
}

// ── useMediaQuery hook ──
function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

function AnalyticsContent({ user, role }) {
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [expandedDay, setExpandedDay] = useState(null);

  const isMobile = useMediaQuery("(max-width: 640px)");

  // Firebase data (UNCHANGED logic)
  const [userData, setUserData] = useState(null);
  const [accountData, setAccountData] = useState({});
  const [groupsData, setGroupsData] = useState({});
  const [profitHistory, setProfitHistory] = useState({});

  // ── Load user profile & managed groups (UNCHANGED) ──
  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => {
      if (snap.exists()) setUserData(snap.val());
      else setUserData(null);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const unsub = onValue(ref(db, "account_data"), (snap) => {
      if (snap.exists()) setAccountData(snap.val());
      else setAccountData({});
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, "groups"), (snap) => {
      if (snap.exists()) setGroupsData(snap.val());
      else setGroupsData({});
    });
    return () => unsub();
  }, []);

  // Derived: owned account numbers PER ROLE (UNCHANGED)
  const ownedAccounts = useMemo(() => {
    if (!accountData) return [];

    if (role === "super_admin") {
      return Object.keys(accountData).sort();
    }

    if (role === "admin") {
      const managed = userData?.managed_groups || {};
      const allowed = new Set();
      Object.keys(managed)
        .filter((k) => managed[k])
        .forEach((groupId) => {
          const g = groupsData[groupId];
          if (g?.accounts) Object.keys(g.accounts).forEach((acc) => allowed.add(acc));
        });
      return [...allowed].filter((acc) => accountData[acc]).sort();
    }

    if (role === "investor") {
      const owned = userData?.owned_accounts || {};
      const fromOwned = Object.keys(owned).filter((k) => owned[k] && accountData[k]);
      if (fromOwned.length > 0) return fromOwned.sort();

      const subs = userData?.subscriptions || {};
      const fromSubs = [];
      Object.entries(subs).forEach(([vpsKey, vpsData]) => {
        Object.entries(vpsData.accounts || {}).forEach(([accNum]) => {
          if (accountData[accNum]) fromSubs.push(accNum);
        });
      });
      return fromSubs.sort();
    }

    return [];
  }, [userData, accountData, groupsData, role]);

  // Load snapshots (UNCHANGED logic)
  useEffect(() => {
    if (!selectedAccount) return;
    const unsub = onValue(
      ref(db, `account_data/${selectedAccount}/snapshots`),
      (snap) => {
        if (snap.exists()) {
          const snapshots = snap.val();
          const dailyData = {};

          Object.keys(snapshots).forEach((tsKey) => {
            let timeMs = parseInt(tsKey);
            if (isNaN(timeMs)) return;

            if (timeMs < 10000000000) {
              timeMs = timeMs * 1000;
            }

            const exactDateWITA = new Date(timeMs + 28800000);
            const y = exactDateWITA.getUTCFullYear();
            const m = String(exactDateWITA.getUTCMonth() + 1).padStart(2, "0");
            const d = String(exactDateWITA.getUTCDate()).padStart(2, "0");
            const dateKey = `${y}-${m}-${d}`;

            const data = snapshots[tsKey];
            dailyData[dateKey] = {
              daily_profit: data.daily_profit || data.profit || 0,
              lot_volume: data.daily_lots || data.lot || data.lots || 0,
              percentage_growth: data.daily_growth_percent || data.growth || data.growth_percent || 0,
              balance: data.balance || 0,
            };
          });

          setProfitHistory((prev) => ({
            ...prev,
            [selectedAccount]: dailyData,
          }));
        }
      }
    );
    return () => unsub();
  }, [selectedAccount]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!selectedAccount && ownedAccounts.length > 0) {
      const timer = setTimeout(() => {
        setSelectedAccount(ownedAccounts[0]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [ownedAccounts, selectedAccount]);

  // ── MONTH NAVIGATION (UNCHANGED) ──
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setExpandedDay(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setExpandedDay(null);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // ── BUILD CALENDAR GRID (UNCHANGED logic) ──
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    const days = [];

    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        month: currentMonth === 0 ? 11 : currentMonth - 1,
        year: currentMonth === 0 ? currentYear - 1 : currentYear,
        isCurrentMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
        dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        month: currentMonth === 11 ? 0 : currentMonth + 1,
        year: currentMonth === 11 ? currentYear + 1 : currentYear,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth, currentYear]);

  // ── Get daily data (UNCHANGED) ──
  const getDayData = (dateStr) => {
    if (!selectedAccount || !profitHistory[selectedAccount]) return null;
    return profitHistory[selectedAccount][dateStr] || null;
  };

  // ── Compute summary (UNCHANGED) ──
  const monthlySummary = useMemo(() => {
    if (!selectedAccount || !profitHistory[selectedAccount]) {
      return { totalProfit: 0, totalVolume: 0, avgGrowth: 0, tradingDays: 0 };
    }
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    let totalProfit = 0;
    let totalVolume = 0;
    let totalGrowth = 0;
    let tradingDays = 0;

    Object.entries(profitHistory[selectedAccount]).forEach(([dateStr, data]) => {
      if (dateStr.startsWith(monthPrefix)) {
        totalProfit += data.daily_profit || 0;
        totalVolume += data.lot_volume || 0;
        totalGrowth += data.percentage_growth || 0;
        tradingDays++;
      }
    });

    return {
      totalProfit,
      totalVolume: +totalVolume.toFixed(2),
      avgGrowth: tradingDays > 0 ? +(totalGrowth / tradingDays).toFixed(2) : 0,
      tradingDays,
    };
  }, [selectedAccount, profitHistory, currentMonth, currentYear]);

  // ── Get days with data for current month (for mobile list) ──
  const monthDaysWithData = useMemo(() => {
    if (!selectedAccount || !profitHistory[selectedAccount]) return [];
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const result = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthPrefix}-${String(d).padStart(2, "0")}`;
      const data = profitHistory[selectedAccount][dateStr];
      const isToday =
        d === new Date().getDate() &&
        currentMonth === new Date().getMonth() &&
        currentYear === new Date().getFullYear();

      result.push({
        day: d,
        dateStr,
        date: new Date(currentYear, currentMonth, d),
        isToday,
        data: data || null,
      });
    }

    return result;
  }, [selectedAccount, profitHistory, currentMonth, currentYear]);

  // ── Heat color (UNCHANGED) ──
  const getHeatColor = useCallback((dayData) => {
    if (!dayData) return "bg-transparent";
    const profit = dayData.daily_profit || 0;
    if (profit > 50) return "bg-emerald-600/60 border-emerald-400/40";
    if (profit > 20) return "bg-emerald-500/40 border-emerald-400/30";
    if (profit > 0) return "bg-emerald-500/20 border-emerald-400/20";
    if (profit === 0) return "bg-slate-500/10 border-slate-500/20";
    if (profit > -20) return "bg-red-500/20 border-red-400/20";
    if (profit > -50) return "bg-red-500/40 border-red-400/30";
    return "bg-red-600/60 border-red-400/40";
  }, []);

  const toggleExpand = useCallback((dateStr) => {
    setExpandedDay((prev) => (prev === dateStr ? null : dateStr));
  }, []);

  if (loading) {
    return <LoadingSpinner message="Initializing analytics matrix..." />;
  }

  if (ownedAccounts.length === 0) {
    return (
      <EmptyState
        icon={<AlertTriangle size={48} className="text-amber-500" />}
        title="No EA Accounts"
        description="You don't own any EA accounts yet. Please contact your admin for account assignment."
      />
    );
  }

  const accInfo = selectedAccount ? accountData[selectedAccount] : null;
  const botStartDate = accInfo?.metadata?.bot_start_date || null;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* HEADER - Terminal Jarvis Style                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm animate-fadeInUp">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 shadow-inner animate-glowPulse">
              <BarChart3 size={36} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight flex items-center gap-2">
                Analytics & Performance
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Activity size={10} />
                  LIVE
                </span>
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                Daily breakdown of Lot Volume, % Growth, and Nominal Profit.
              </p>
            </div>
          </div>

          {/* Account Selector */}
          <div className="flex items-center gap-3">
            <Cpu size={16} className="text-cyan-400 flex-shrink-0" />
            <select
              value={selectedAccount || ""}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="bg-[var(--muted)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl px-4 py-2.5 outline-none cursor-pointer font-mono font-bold min-w-[200px] focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
            >
              {ownedAccounts.map((accNum) => (
                <option key={accNum} value={accNum}>
                  {accNum}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Account Info Row */}
        {accInfo && (
          <div className="mt-4 flex flex-wrap gap-2 sm:gap-3 text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">
            <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
              VPS: {accInfo.metadata?.vps_name || "N/A"}
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              Balance: ${Number(accInfo.balance || 0).toLocaleString()}
            </span>
            {botStartDate && (
              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                Started: {new Date(botStartDate).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MONTHLY SUMMARY CARDS - Enhanced with glow effects                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="animate-fadeInUp stagger-1">
          <StatCard
            icon={<DollarSign size={20} className="text-emerald-400" />}
            label="Total Profit"
            value={`$${monthlySummary.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub={`${monthlySummary.tradingDays} trading days`}
            accent="emerald"
          />
        </div>
        <div className="animate-fadeInUp stagger-2">
          <StatCard
            icon={<Scale size={20} className="text-blue-400" />}
            label="Lot Volume"
            value={monthlySummary.totalVolume.toFixed(2)}
            sub="Lots traded"
            accent="blue"
          />
        </div>
        <div className="animate-fadeInUp stagger-3">
          <StatCard
            icon={<TrendingUp size={20} className="text-purple-400" />}
            label="Avg Daily Growth"
            value={`${monthlySummary.avgGrowth}%`}
            sub="Per trading day"
            accent="purple"
          />
        </div>
        <div className="animate-fadeInUp stagger-4">
          <StatCard
            icon={<Wallet size={20} className="text-amber-400" />}
            label="Account"
            value={selectedAccount || "—"}
            sub={accInfo?.metadata?.vps_name || "No VPS"}
            accent="amber"
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CALENDAR / LIST - Desktop = Grid, Mobile = Expandable List        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden animate-fadeInUp">
        {/* Month Navigator */}
        <div className="p-4 sm:p-6 border-b border-[var(--card-border)] flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-[var(--muted)] transition-colors text-[var(--foreground)] active:scale-95"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-base sm:text-lg font-black text-[var(--foreground)] flex items-center gap-2">
            <Calendar size={20} className="text-cyan-400" />
            {monthNames[currentMonth]} {currentYear}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl hover:bg-[var(--muted)] transition-colors text-[var(--foreground)] active:scale-95"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* ═══════ DESKTOP: Calendar Grid (unchanged logic) ═══════ */}
        <div className="hidden sm:block p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider py-2"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((dayObj, idx) => {
              const dayData = dayObj.dateStr ? getDayData(dayObj.dateStr) : null;
              const isToday =
                dayObj.isCurrentMonth &&
                dayObj.day === new Date().getDate() &&
                currentMonth === new Date().getMonth() &&
                currentYear === new Date().getFullYear();

              return (
                <div
                  key={idx}
                  className={`relative rounded-xl border p-2 min-h-[100px] transition-all calendar-cell-glow ${
                    dayObj.isCurrentMonth
                      ? `${getHeatColor(dayData)} cursor-default`
                      : "bg-[var(--background)]/30 border-transparent opacity-30"
                  } ${isToday ? "today-indicator ring-2 ring-cyan-500 ring-offset-1 ring-offset-[var(--card-bg)]" : ""}`}
                >
                  <span
                    className={`text-xs font-bold ${
                      isToday
                        ? "text-cyan-400"
                        : dayObj.isCurrentMonth
                        ? "text-[var(--foreground)]"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {dayObj.day}
                  </span>

                  {/* Daily Data */}
                  {dayObj.isCurrentMonth && dayData && (
                    <div className="mt-1 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <span className="text-[9px] text-emerald-400 font-bold">
                          ${Number(dayData.daily_profit || 0).toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                        <span className="text-[9px] text-blue-400 font-bold">
                          {Number(dayData.lot_volume || 0).toFixed(1)}L
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                        <span className="text-[9px] text-purple-400 font-bold">
                          {Number(dayData.percentage_growth || 0).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════ MOBILE: Expandable List View ═══════ */}
        <div className="sm:hidden">
          {monthDaysWithData.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted-foreground)] text-sm">
              No data for this month
            </div>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {monthDaysWithData.map((dayObj) => {
                const dayData = dayObj.data;
                const hasData = !!dayData;
                const isExpanded = expandedDay === dayObj.dateStr;
                const profit = dayData?.daily_profit || 0;
                const isPositive = profit > 0;
                const isNegative = profit < 0;

                return (
                  <div key={dayObj.dateStr} className="animate-fadeIn">
                    {/* Row Header */}
                    <button
                      onClick={() => hasData && toggleExpand(dayObj.dateStr)}
                      className={`w-full flex items-center justify-between p-4 transition-all active:bg-[var(--muted)] ${
                        dayObj.isToday ? "bg-cyan-500/5" : ""
                      }`}
                      disabled={!hasData}
                    >
                      <div className="flex items-center gap-3">
                        {/* Day number with heatmap dot */}
                        <div className="relative">
                          <span
                            className={`text-sm font-bold ${
                              dayObj.isToday
                                ? "text-cyan-400"
                                : "text-[var(--foreground)]"
                            }`}
                          >
                            {dayObj.day}
                          </span>
                          {dayObj.isToday && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                          )}
                        </div>

                        {/* Date label */}
                        <div className="flex flex-col items-start">
                          <span className="text-[10px] text-[var(--muted-foreground)] font-medium">
                            {dayObj.date.toLocaleDateString("en-US", {
                              weekday: "short",
                            })}
                          </span>
                          {hasData && (
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              {dayObj.dateStr}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Profit indicator */}
                        {hasData ? (
                          <>
                            <div className="flex items-center gap-1">
                              {isPositive ? (
                                <ArrowUpRight size={12} className="text-emerald-400" />
                              ) : isNegative ? (
                                <ArrowDownRight size={12} className="text-red-400" />
                              ) : null}
                              <span
                                className={`text-xs font-bold font-mono ${
                                  isPositive
                                    ? "text-emerald-400"
                                    : isNegative
                                    ? "text-red-400"
                                    : "text-[var(--muted-foreground)]"
                                }`}
                              >
                                {isPositive ? "+" : ""}${Number(profit).toFixed(2)}
                              </span>
                            </div>

                            {/* Expand chevron */}
                            <ChevronDown
                              size={16}
                              className={`text-[var(--muted-foreground)] transition-transform duration-200 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </>
                        ) : (
                          <span className="text-[10px] text-[var(--muted-foreground)] italic">
                            No data
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Expanded Detail Panel */}
                    {isExpanded && hasData && (
                      <div className="animate-slideDown bg-[var(--muted)]/50 border-t border-[var(--card-border)]">
                        <div className="p-4 space-y-3">
                          {/* Detail Grid */}
                          <div className="grid grid-cols-3 gap-2">
                            {/* Gain from Initial Deposit */}
                            <div className="bg-[var(--card-bg)] rounded-xl p-3 border border-purple-500/10">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <TrendingUp size={12} className="text-purple-400" />
                                <span className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                                  Gain %
                                </span>
                              </div>
                              <span className="text-sm font-black text-purple-400 font-mono">
                                {Number(dayData.percentage_growth || 0).toFixed(2)}%
                              </span>
                            </div>

                            {/* Nominal Gain Daily */}
                            <div className="bg-[var(--card-bg)] rounded-xl p-3 border border-emerald-500/10">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <DollarSign size={12} className="text-emerald-400" />
                                <span className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                                  Profit
                                </span>
                              </div>
                              <span
                                className={`text-sm font-black font-mono ${
                                  profit > 0
                                    ? "text-emerald-400"
                                    : profit < 0
                                    ? "text-red-400"
                                    : "text-[var(--muted-foreground)]"
                                }`}
                              >
                                {profit > 0 ? "+" : ""}${Number(profit).toFixed(2)}
                              </span>
                            </div>

                            {/* Lot Volume Daily */}
                            <div className="bg-[var(--card-bg)] rounded-xl p-3 border border-blue-500/10">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <BarChart3 size={12} className="text-blue-400" />
                                <span className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                                  Lots
                                </span>
                              </div>
                              <span className="text-sm font-black text-blue-400 font-mono">
                                {Number(dayData.lot_volume || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Balance row */}
                          {dayData.balance > 0 && (
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-bold">
                                Balance
                              </span>
                              <span className="text-xs font-bold text-[var(--foreground)] font-mono">
                                ${Number(dayData.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════ Legend ═══════ */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex flex-wrap items-center gap-3 sm:gap-4 text-[10px]">
          <span className="text-[var(--muted-foreground)] font-bold uppercase tracking-wider">
            Heatmap:
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-600/60 border border-red-400/40" />
            {`Loss >$50`}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-500/20 border border-red-400/20" />
            {`Loss <$20`}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-500/10 border border-slate-500/20" />
            Netral
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-400/20" />
            {`Profit <$20`}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-600/60 border border-emerald-400/40" />
            {`Profit >$50`}
          </span>
        </div>
      </div>
    </div>
  );
}