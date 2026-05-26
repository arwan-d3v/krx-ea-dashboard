"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../../lib/firebase";
import { ref, onValue } from "firebase/database";
import {
  TrendingUp,
  TrendingDown,
  Server,
  Cpu,
  Activity,
  Target,
  Zap,
  Award,
  Filter,
  ChevronDown,
  Eye,
  EyeOff,
  BarChart3,
  Clock,
  DollarSign,
  Percent,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MinusCircle,
  Lock,
} from "lucide-react";

// ============================================================================
// DEEP ANALYTICS PAGE — Super Admin Only
//   - Account ranking with flags (Green, Yellow, Red, Black)
//   - Performance metrics: daily average gain, server/VPS rankings
//   - Forecast future gains based on historical consistency
//   - Filterable views based on role
// ============================================================================

const ACCOUNT_FLAGS = {
  green: {
    label: "Green Flag",
    sublabel: "Public Investor",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: CheckCircle,
    description: "Public investor account - visible to all users",
  },
  yellow: {
    label: "Yellow Flag",
    sublabel: "Admin as Investor",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: AlertTriangle,
    description: "Admin investment account - visible to admin and super admin",
  },
  red: {
    label: "Red Flag",
    sublabel: "Tester Account",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: XCircle,
    description: "Testing account - visible only to super admin",
  },
  black: {
    label: "Black Flag",
    sublabel: "Owner Account",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    icon: Lock,
    description: "Owner private account - hidden from public views",
  },
};

export default function DeepAnalyticsPage() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);

  // Data states
  const [accountData, setAccountData] = useState({});
  const [usersData, setUsersData] = useState({});
  const [groupsData, setGroupsData] = useState({});

  // Filter states
  const [selectedFlag, setSelectedFlag] = useState("all");
  const [sortBy, setSortBy] = useState("avgDailyGain");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedServer, setSelectedServer] = useState("all");
  const [selectedVps, setSelectedVps] = useState("all");

  // Load Firebase data
  useEffect(() => {
    const unsubs = [];

    const accountRef = ref(db, "account_data");
    unsubs.push(
      onValue(accountRef, (snap) => {
        setAccountData(snap.exists() ? snap.val() : {});
        setLoading(false);
      })
    );

    const usersRef = ref(db, "users");
    unsubs.push(
      onValue(usersRef, (snap) => {
        setUsersData(snap.exists() ? snap.val() : {});
      })
    );

    const groupsRef = ref(db, "groups");
    unsubs.push(
      onValue(groupsRef, (snap) => {
        setGroupsData(snap.exists() ? snap.val() : {});
      })
    );

    return () => unsubs.forEach((u) => u());
  }, []);

  // Build account rankings with performance metrics
  const accountRankings = useMemo(() => {
    if (!accountData || Object.keys(accountData).length === 0) return [];

    const rankings = [];

    Object.entries(accountData).forEach(([accNum, data]) => {
      const metadata = data.metadata || {};
      const realtimeStats = data.realtime_stats || {};
      const snapshots = data.snapshots || {};

      // Get account flag from users data
      let accountFlag = "green"; // default
      let ownerInfo = null;
      Object.entries(usersData).forEach(([uid, userData]) => {
        if (userData.subscriptions) {
          Object.values(userData.subscriptions).forEach((vpsData) => {
            if (vpsData.accounts && vpsData.accounts[accNum]) {
              accountFlag = vpsData.accounts[accNum].account_flag || "green";
              ownerInfo = {
                uid,
                fullName: userData.fullName,
                email: userData.email,
              };
            }
          });
        }
      });

      // Calculate daily metrics from snapshots (only Mon-Fri active trading hours)
      let totalDailyProfit = 0;
      let totalDailyGrowth = 0;
      let totalDailyLots = 0;
      let tradingDays = 0;
      let allDailyProfits = [];

      Object.entries(snapshots).forEach(([tsKey, snapshotData]) => {
        let timeMs = parseInt(tsKey);
        if (isNaN(timeMs)) return;
        if (timeMs < 10000000000) timeMs = timeMs * 1000;

        const date = new Date(timeMs + 28800000); // WITA/GMT+8
        const dayOfWeek = date.getUTCDay();

        // Only count Monday-Friday (1-5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const dailyProfit = snapshotData.daily_profit || snapshotData.profit || 0;
          const dailyGrowth = snapshotData.daily_growth_percent || snapshotData.growth || 0;
          const dailyLots = snapshotData.daily_lots || snapshotData.lot || 0;

          totalDailyProfit += dailyProfit;
          totalDailyGrowth += dailyGrowth;
          totalDailyLots += dailyLots;
          tradingDays++;
          allDailyProfits.push(dailyProfit);
        }
      });

      const avgDailyGain = tradingDays > 0 ? totalDailyProfit / tradingDays : 0;
      const avgDailyGrowth = tradingDays > 0 ? totalDailyGrowth / tradingDays : 0;
      const avgDailyLots = tradingDays > 0 ? totalDailyLots / tradingDays : 0;

      // Calculate consistency (profit days vs loss days)
      const profitDays = allDailyProfits.filter((p) => p > 0).length;
      const consistency = tradingDays > 0 ? (profitDays / tradingDays) * 100 : 0;

      // Calculate volatility (standard deviation of daily profits)
      const mean = avgDailyGain;
      const variance =
        allDailyProfits.length > 0
          ? allDailyProfits.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) /
            allDailyProfits.length
          : 0;
      const volatility = Math.sqrt(variance);

      // Forecast future gain (based on average daily gain * 22 trading days/month)
      const forecastMonthlyGain = avgDailyGain * 22;
      const forecastGrowthSpeed = avgDailyGrowth * 22;

      // Get current balance
      const currentBalance =
        realtimeStats.balance ||
        metadata.balance ||
        (() => {
          let maxTs = 0;
          let latestBalance = 0;
          Object.entries(snapshots).forEach(([ts, snapData]) => {
            const tsNum = parseInt(ts);
            if (tsNum > maxTs && snapData.balance) {
              maxTs = tsNum;
              latestBalance = snapData.balance;
            }
          });
          return latestBalance;
        })();

      rankings.push({
        accNum,
        flag: accountFlag,
        ownerInfo,
        server: metadata.broker || metadata.server || "Unknown",
        vps: metadata.vps_name || "Unknown",
        botType: metadata.bot_type || "NON_ML",
        currentBalance: Number(currentBalance),
        totalProfit: totalDailyProfit,
        avgDailyGain,
        avgDailyGrowth,
        avgDailyLots,
        tradingDays,
        consistency,
        volatility,
        forecastMonthlyGain,
        forecastGrowthSpeed,
        profitDays,
        lossDays: tradingDays - profitDays,
        allDailyProfits,
      });
    });

    return rankings;
  }, [accountData, usersData]);

  // Filter rankings based on role visibility
  const visibleRankings = useMemo(() => {
    let filtered = accountRankings;

    // Role-based filtering
    if (role === "admin") {
      // Admin can only see Green and Yellow flags
      filtered = filtered.filter((acc) => acc.flag === "green" || acc.flag === "yellow");
    } else if (role === "investor") {
      // Public investors can only see Green flags
      filtered = filtered.filter((acc) => acc.flag === "green");
    }
    // Super admin sees all

    // Apply user filters
    if (selectedFlag !== "all") {
      filtered = filtered.filter((acc) => acc.flag === selectedFlag);
    }
    if (selectedServer !== "all") {
      filtered = filtered.filter((acc) => acc.server === selectedServer);
    }
    if (selectedVps !== "all") {
      filtered = filtered.filter((acc) => acc.vps === selectedVps);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (sortOrder === "desc") return bVal - aVal;
      return aVal - bVal;
    });

    return filtered;
  }, [accountRankings, role, selectedFlag, selectedServer, selectedVps, sortBy, sortOrder]);

  // Get unique servers and VPS for filter dropdowns
  const uniqueServers = useMemo(() => {
    return [...new Set(accountRankings.map((acc) => acc.server))];
  }, [accountRankings]);

  const uniqueVps = useMemo(() => {
    return [...new Set(accountRankings.map((acc) => acc.vps))];
  }, [accountRankings]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const visible = visibleRankings;
    return {
      totalAccounts: visible.length,
      avgDailyGain:
        visible.length > 0
          ? visible.reduce((sum, acc) => sum + acc.avgDailyGain, 0) / visible.length
          : 0,
      avgConsistency:
        visible.length > 0
          ? visible.reduce((sum, acc) => sum + acc.consistency, 0) / visible.length
          : 0,
      topPerformer: visible.length > 0 ? visible[0] : null,
      totalForecast: visible.reduce((sum, acc) => sum + acc.forecastMonthlyGain, 0),
    };
  }, [visibleRankings]);

  // Guard - only super admin can access full features
  if (role !== "super_admin" && role !== "admin" && role !== "investor") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <Lock size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-[var(--foreground)]">Access Denied</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Insufficient permissions.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center animate-pulse">
            <Activity size={24} className="text-blue-400 animate-spin" />
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">Loading deep analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* HEADER */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 text-purple-400 shadow-inner">
              <BarChart3 size={36} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">
                Deep Analytics & Rankings
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                Account performance analysis with flag-based visibility • Mon-Fri active trading hours
              </p>
            </div>
          </div>

          {/* Role Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                role === "super_admin"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : role === "admin"
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                  : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
              }`}
            >
              {role === "super_admin" ? "SUPER ADMIN" : role === "admin" ? "ADMIN" : "INVESTOR"} VIEW
            </span>
          </div>
        </div>

        {/* FILTERS */}
        <div className="mt-6 flex flex-wrap gap-3">
          {/* Flag Filter */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[var(--muted-foreground)]" />
            <select
              value={selectedFlag}
              onChange={(e) => setSelectedFlag(e.target.value)}
              className="bg-[var(--muted)] border border-[var(--card-border)] text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none cursor-pointer"
            >
              <option value="all">All Flags</option>
              {Object.entries(ACCOUNT_FLAGS).map(([key, flag]) => (
                <option key={key} value={key}>
                  {flag.label}
                </option>
              ))}
            </select>
          </div>

          {/* Server Filter */}
          <select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="bg-[var(--muted)] border border-[var(--card-border)] text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all">All Servers</option>
            {uniqueServers.map((server) => (
              <option key={server} value={server}>
                {server}
              </option>
            ))}
          </select>

          {/* VPS Filter */}
          <select
            value={selectedVps}
            onChange={(e) => setSelectedVps(e.target.value)}
            className="bg-[var(--muted)] border border-[var(--card-border)] text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all">All VPS</option>
            {uniqueVps.map((vps) => (
              <option key={vps} value={vps}>
                {vps}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-bold">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[var(--muted)] border border-[var(--card-border)] text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none cursor-pointer"
            >
              <option value="avgDailyGain">Avg Daily Gain</option>
              <option value="avgDailyGrowth">Avg Daily Growth</option>
              <option value="consistency">Consistency</option>
              <option value="forecastMonthlyGain">Forecast</option>
              <option value="currentBalance">Balance</option>
            </select>
            <button
              onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
              className="p-2 rounded-lg bg-[var(--muted)] border border-[var(--card-border)] hover:bg-[var(--muted)]/80 transition-colors"
            >
              {sortOrder === "desc" ? (
                <TrendingDown size={14} className="text-[var(--foreground)]" />
              ) : (
                <TrendingUp size={14} className="text-[var(--foreground)]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Target size={20} className="text-blue-400" />}
          label="Total Accounts"
          value={summaryStats.totalAccounts}
          sub="Visible in current view"
          accent="blue"
        />
        <SummaryCard
          icon={<DollarSign size={20} className="text-emerald-400" />}
          label="Avg Daily Gain"
          value={`$${summaryStats.avgDailyGain.toFixed(2)}`}
          sub="Per trading day"
          accent="emerald"
        />
        <SummaryCard
          icon={<Percent size={20} className="text-purple-400" />}
          label="Avg Consistency"
          value={`${summaryStats.avgConsistency.toFixed(1)}%`}
          sub="Profit days ratio"
          accent="purple"
        />
        <SummaryCard
          icon={<Zap size={20} className="text-amber-400" />}
          label="Total Forecast"
          value={`$${summaryStats.totalForecast.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}`}
          sub="Next month projection"
          accent="amber"
        />
      </div>

      {/* RANKING TABLE */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-[var(--card-border)]">
          <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2">
            <Award size={20} className="text-amber-400" />
            Account Rankings
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Sorted by {sortBy.replace(/([A-Z])/g, " $1").toLowerCase()} • {sortOrder === "desc" ? "Highest first" : "Lowest first"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--muted)]/30 text-[var(--muted-foreground)] text-[10px] uppercase tracking-wider">
                <th className="text-left py-3 px-4 font-bold">Rank</th>
                <th className="text-left py-3 px-4 font-bold">Account</th>
                <th className="text-center py-3 px-4 font-bold">Flag</th>
                <th className="text-left py-3 px-4 font-bold">Owner</th>
                <th className="text-left py-3 px-4 font-bold">Server / VPS</th>
                <th className="text-right py-3 px-4 font-bold">Balance</th>
                <th className="text-right py-3 px-4 font-bold">Avg Daily</th>
                <th className="text-right py-3 px-4 font-bold">Growth</th>
                <th className="text-right py-3 px-4 font-bold">Consistency</th>
                <th className="text-right py-3 px-4 font-bold">Forecast</th>
                <th className="text-center py-3 px-4 font-bold">Days</th>
              </tr>
            </thead>
            <tbody>
              {visibleRankings.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-[var(--muted-foreground)]">
                    No accounts match the current filters.
                  </td>
                </tr>
              )}
              {visibleRankings.map((acc, index) => {
                const flagInfo = ACCOUNT_FLAGS[acc.flag] || ACCOUNT_FLAGS.green;
                const FlagIcon = flagInfo.icon;

                return (
                  <tr
                    key={acc.accNum}
                    className="border-b border-[var(--card-border)]/50 hover:bg-[var(--muted)]/10 transition-colors"
                  >
                    {/* Rank */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {index < 3 && (
                          <Award
                            size={16}
                            className={
                              index === 0
                                ? "text-amber-400"
                                : index === 1
                                ? "text-slate-300"
                                : "text-amber-600"
                            }
                          />
                        )}
                        <span className="font-black text-[var(--foreground)]">#{index + 1}</span>
                      </div>
                    </td>

                    {/* Account */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Cpu size={14} className="text-blue-400" />
                        <span className="font-mono font-bold text-[var(--foreground)]">{acc.accNum}</span>
                      </div>
                      <div className="text-[9px] text-[var(--muted-foreground)] mt-0.5">{acc.botType}</div>
                    </td>

                    {/* Flag */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${flagInfo.bg} ${flagInfo.color} border ${flagInfo.border}`}
                      >
                        <FlagIcon size={10} />
                        {flagInfo.label}
                      </span>
                    </td>

                    {/* Owner */}
                    <td className="py-3 px-4">
                      {acc.ownerInfo ? (
                        <div>
                          <div className="text-xs font-bold text-[var(--foreground)]">
                            {acc.ownerInfo.fullName || "—"}
                          </div>
                          <div className="text-[9px] text-[var(--muted-foreground)]">
                            {acc.ownerInfo.email || ""}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">—</span>
                      )}
                    </td>

                    {/* Server / VPS */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-xs">
                        <Server size={10} className="text-cyan-400" />
                        <span className="text-[var(--foreground)]">{acc.server}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-[var(--muted-foreground)] mt-0.5">
                        <Cpu size={8} />
                        {acc.vps}
                      </div>
                    </td>

                    {/* Balance */}
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-bold text-[var(--foreground)]">
                        ${acc.currentBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </td>

                    {/* Avg Daily Gain */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-mono font-bold ${
                          acc.avgDailyGain >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {acc.avgDailyGain >= 0 ? "+" : ""}${acc.avgDailyGain.toFixed(2)}
                      </span>
                    </td>

                    {/* Avg Daily Growth */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-mono font-bold text-xs ${
                          acc.avgDailyGrowth >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {acc.avgDailyGrowth >= 0 ? "+" : ""}{acc.avgDailyGrowth.toFixed(2)}%
                      </span>
                    </td>

                    {/* Consistency */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              acc.consistency >= 70
                                ? "bg-emerald-400"
                                : acc.consistency >= 50
                                ? "bg-amber-400"
                                : "bg-red-400"
                            }`}
                            style={{ width: `${acc.consistency}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-[var(--foreground)]">
                          {acc.consistency.toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-[8px] text-[var(--muted-foreground)] mt-0.5">
                        {acc.profitDays}W / {acc.lossDays}L
                      </div>
                    </td>

                    {/* Forecast */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-mono font-bold text-xs ${
                          acc.forecastMonthlyGain >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {acc.forecastMonthlyGain >= 0 ? "+" : ""}$
                        {acc.forecastMonthlyGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <div className="text-[8px] text-[var(--muted-foreground)] mt-0.5">
                        {acc.forecastGrowthSpeed >= 0 ? "+" : ""}
                        {acc.forecastGrowthSpeed.toFixed(1)}% / mo
                      </div>
                    </td>

                    {/* Trading Days */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono text-xs text-[var(--foreground)]">
                        {acc.tradingDays}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEGEND */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-4 text-[10px]">
          <span className="text-[var(--muted-foreground)] font-bold uppercase tracking-wider">
            Account Flags:
          </span>
          {Object.entries(ACCOUNT_FLAGS).map(([key, flag]) => {
            const Icon = flag.icon;
            // Only show flags visible to current role
            if (role === "investor" && key !== "green") return null;
            if (role === "admin" && (key === "red" || key === "black")) return null;
            return (
              <span key={key} className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${flag.bg} ${flag.color} border ${flag.border}`}>
                <Icon size={10} />
                {flag.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Summary Card Component ──
function SummaryCard({ icon, label, value, sub, accent }) {
  const accentMap = {
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    blue: "border-blue-500/20 bg-blue-500/5",
    purple: "border-purple-500/20 bg-purple-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
  };

  return (
    <div className={`bg-[var(--card-bg)] border rounded-2xl p-5 ${accentMap[accent] || "border-[var(--card-border)]"}`}>
      <div className="flex items-center gap-3 mb-3">{icon}</div>
      <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-lg font-black text-[var(--foreground)] tracking-tight truncate">{value}</div>
      <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{sub}</div>
    </div>
  );
}