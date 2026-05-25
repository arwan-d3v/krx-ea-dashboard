"use client";
import { useState, useEffect, useMemo } from "react";
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
  Loader2,
  AlertTriangle,
  Zap,
  Wallet,
} from "lucide-react";

// ============================================================================
// ANALYTICS PAGE — Multi-Role Calendar View
//   - Calendar monthly heatmap showing daily metrics
//   - Lot Volume, % Growth, Nominal Profit per day
//   - Data sourced from account_data/{accNum}/daily_history since bot_start_date
//   - super_admin: all accounts | admin: group-scoped | investor: owned accounts
// ============================================================================

export default function AnalyticsPage() {
  const { user, role } = useAuth();
  return <AnalyticsContent user={user} role={role} />;
}

function AnalyticsContent({ user, role }) {
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Firebase data
  const [userData, setUserData] = useState(null);
  const [accountData, setAccountData] = useState({});
  const [groupsData, setGroupsData] = useState({});
  const [profitHistory, setProfitHistory] = useState({});

  // ── Load user profile & managed groups ──
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

  // Derived: owned account numbers PER ROLE
  const ownedAccounts = useMemo(() => {
    if (!accountData) return [];

    // ── super_admin: all accounts ──
    if (role === "super_admin") {
      return Object.keys(accountData).sort();
    }

    // ── admin: accounts from managed_groups ──
    if (role === "admin") {
      const managed = userData?.managed_groups || {};
      const allowed = new Set();
      Object.keys(managed).filter(k => managed[k]).forEach(groupId => {
        const g = groupsData[groupId];
        if (g?.accounts) Object.keys(g.accounts).forEach(acc => allowed.add(acc));
      });
      return [...allowed].filter(acc => accountData[acc]).sort();
    }

    // ── investor: owned_accounts or subscriptions ──
    if (role === "investor") {
      // Coba dari owned_accounts dulu
      const owned = userData?.owned_accounts || {};
      const fromOwned = Object.keys(owned).filter(k => owned[k] && accountData[k]);
      if (fromOwned.length > 0) return fromOwned.sort();
      
      // Fallback: dari subscriptions (struktur lama)
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

  // Load snapshots from account_data/{accNum}/snapshots (same as stable analytics)
  // Process timestamp keys to date-keyed data for calendar display
  useEffect(() => {
    if (!selectedAccount) return;
    const unsub = onValue(
      ref(db, `account_data/${selectedAccount}/snapshots`),
      (snap) => {
        if (snap.exists()) {
          const snapshots = snap.val();
          const dailyData = {};
          
          // Convert timestamp keys to date keys (same logic as stable analytics)
          Object.keys(snapshots).forEach((tsKey) => {
            let timeMs = parseInt(tsKey);
            if (isNaN(timeMs)) return;
            
            // If EA sends SECONDS format (10 digit), multiply by 1000
            if (timeMs < 10000000000) {
              timeMs = timeMs * 1000;
            }
            
            // Add 8 hours for WITA / GMT+8 conversion
            const exactDateWITA = new Date(timeMs + 28800000);
            const y = exactDateWITA.getUTCFullYear();
            const m = String(exactDateWITA.getUTCMonth() + 1).padStart(2, "0");
            const d = String(exactDateWITA.getUTCDate()).padStart(2, "0");
            const dateKey = `${y}-${m}-${d}`;
            
            // Use same property names as stable analytics
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

  // Remove unused setLoading
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // Auto-select first account (deferred to avoid cascading setState in effect)
  useEffect(() => {
    if (!selectedAccount && ownedAccounts.length > 0) {
      const timer = setTimeout(() => {
        setSelectedAccount(ownedAccounts[0]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [ownedAccounts, selectedAccount]);

  // ── MONTH NAVIGATION ──
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // ── BUILD CALENDAR GRID ──
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun
    const days = [];

    // Previous month padding
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        month: currentMonth === 0 ? 11 : currentMonth - 1,
        year: currentMonth === 0 ? currentYear - 1 : currentYear,
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
        dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    // Next month padding to fill 6 rows (42 cells)
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

  // ── Get daily profit data for selected account ──
  const getDayData = (dateStr) => {
    if (!selectedAccount || !profitHistory[selectedAccount]) return null;
    return profitHistory[selectedAccount][dateStr] || null;
  };

  // ── Compute summary for current month ──
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

  // ── Heat color based on daily profit ──
  const getHeatColor = (dayData) => {
    if (!dayData) return "bg-transparent";
    const profit = dayData.daily_profit || 0;
    if (profit > 50) return "bg-emerald-600/60 border-emerald-400/40";
    if (profit > 20) return "bg-emerald-500/40 border-emerald-400/30";
    if (profit > 0) return "bg-emerald-500/20 border-emerald-400/20";
    if (profit === 0) return "bg-slate-500/10 border-slate-500/20";
    if (profit > -20) return "bg-red-500/20 border-red-400/20";
    if (profit > -50) return "bg-red-500/40 border-red-400/30";
    return "bg-red-600/60 border-red-400/40";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center animate-pulse">
            <Loader2 size={24} className="text-blue-400 animate-spin" />
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (ownedAccounts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-8">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-12 text-center max-w-md">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">No EA Accounts</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {"You don't own any EA accounts yet. Please contact your admin for account assignment."}
          </p>
        </div>
      </div>
    );
  }

  const accInfo = selectedAccount ? accountData[selectedAccount] : null;
  const botStartDate = accInfo?.metadata?.bot_start_date || null;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* HEADER */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 text-blue-400 shadow-inner">
              <BarChart3 size={36} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">
                Analytics & Performance
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                Daily breakdown of Lot Volume, % Growth, and Nominal Profit.
              </p>
            </div>
          </div>

          {/* Account Selector */}
          <div className="flex items-center gap-3">
            <Cpu size={16} className="text-blue-400 flex-shrink-0" />
            <select
              value={selectedAccount || ""}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="bg-[var(--muted)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl px-4 py-2.5 outline-none cursor-pointer font-mono font-bold min-w-[200px]"
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
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
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

      {/* MONTHLY SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<DollarSign size={20} className="text-emerald-400" />}
          label="Total Profit"
          value={`$${monthlySummary.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${monthlySummary.tradingDays} trading days`}
          accent="emerald"
        />
        <SummaryCard
          icon={<Scale size={20} className="text-blue-400" />}
          label="Lot Volume"
          value={monthlySummary.totalVolume.toFixed(2)}
          sub="Lots traded"
          accent="blue"
        />
        <SummaryCard
          icon={<TrendingUp size={20} className="text-purple-400" />}
          label="Avg Daily Growth"
          value={`${monthlySummary.avgGrowth}%`}
          sub="Per trading day"
          accent="purple"
        />
        <SummaryCard
          icon={<Wallet size={20} className="text-amber-400" />}
          label="Account"
          value={selectedAccount || "—"}
          sub={accInfo?.metadata?.vps_name || "No VPS"}
          accent="amber"
        />
      </div>

      {/* CALENDAR */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden">
        {/* Month Navigator */}
        <div className="p-6 border-b border-[var(--card-border)] flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-[var(--muted)] transition-colors text-[var(--foreground)]"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2">
            <Calendar size={20} className="text-blue-400" />
            {monthNames[currentMonth]} {currentYear}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl hover:bg-[var(--muted)] transition-colors text-[var(--foreground)]"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
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
                  className={`relative rounded-xl border p-2 min-h-[80px] sm:min-h-[100px] transition-all ${
                    dayObj.isCurrentMonth
                      ? `${getHeatColor(dayData)} cursor-default`
                      : "bg-[var(--background)]/30 border-transparent opacity-30"
                  } ${isToday ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-[var(--card-bg)]" : ""}`}
                >
                  <span
                    className={`text-xs font-bold ${
                      dayObj.isCurrentMonth
                        ? isToday
                          ? "text-blue-400"
                          : "text-[var(--foreground)]"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {dayObj.day}
                  </span>

                  {/* Daily Data Tooltip */}
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

        {/* Legend */}
        <div className="px-6 pb-6 flex flex-wrap items-center gap-4 text-[10px]">
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

// ── Summary Card ──
function SummaryCard({ icon, label, value, sub, accent }) {
  const accentMap = {
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    blue: "border-blue-500/20 bg-blue-500/5",
    purple: "border-purple-500/20 bg-purple-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
  };

  return (
    <div
      className={`bg-[var(--card-bg)] border rounded-2xl p-5 ${accentMap[accent] || "border-[var(--card-border)]"}`}
    >
      <div className="flex items-center gap-3 mb-3">{icon}</div>
      <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-lg font-black text-[var(--foreground)] tracking-tight truncate">
        {value}
      </div>
      <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{sub}</div>
    </div>
  );
}