"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  BarChart,
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldAlert,
  BadgeDollarSign,
  PieChart,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Loader2,
  Lock,
  Folders,
  Clock,
} from "lucide-react";
import { db } from "../../lib/firebase";
import { ref, onValue } from "firebase/database";
import { generateMonthlyReport } from "../../lib/pdf-generator";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

// ============================================================================
// DICTIONARY
// ============================================================================
const dict = {
  en: {
    title: "Performance Analytics",
    subtitle: "In-depth analysis per account and monthly history.",
    select_account: "Select Analysis Account",
    select_group: "Select Cluster",
    restricted_access: "RESTRICTED ACCESS: No quantitative nodes assigned.",
    no_group_access: "CLUSTER RESTRICTED: No groups assigned to this Admin.",
    no_account: "No EA accounts found in this cluster.",
    contact_admin: "Please contact Administrator.",
    export_pdf: "Export PDF",
    generating: "Generating...",
  },
  id: {
    title: "Analitik Performa",
    subtitle: "Analisis mendalam per akun dan histori bulanan.",
    select_account: "Pilih Akun Analisis",
    select_group: "Pilih Klaster",
    restricted_access: "AKSES TERBATAS: Belum ada node EA yang dialokasikan.",
    no_group_access: "AKSES CLUSTER DIBATASI: Belum ada Grup yang ditugaskan.",
    no_account: "Tidak ada akun EA di dalam Cluster ini.",
    contact_admin: "Hubungi Super Admin.",
    export_pdf: "Ekspor PDF",
    generating: "Membuat...",
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function AnalyticsPage() {
  const router = useRouter();
  const { user, role, loading: isAuthLoading } = useAuth();
  const [lang, setLang] = useState("en");
  const t = dict[lang];

  // DATA STATE
  const [allAccountsData, setAllAccountsData] = useState({});
  const [groupsList, setGroupsList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // VIEW STATE
  const [viewDate, setViewDate] = useState(new Date());
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // GUARD ROUTE
  useEffect(() => {
    if (!isAuthLoading && !user) router.push("/login");
  }, [user, isAuthLoading, router]);

  // ============================================================================
  // 1. DATA FETCHING (MASTER & CLUSTER ISOLATION - SAME AS DASHBOARD)
  // ============================================================================
  useEffect(() => {
    if (isAuthLoading || !user || !role) return;
    let unsubs = [];

    // 🟢 SUPER ADMIN: Tarik SEMUA Grup & SEMUA Akun
    if (role === "super_admin") {
      const gRef = ref(db, "groups");
      unsubs.push(
        onValue(gRef, (s) => {
          const d = s.val() || {};
          setGroupsList([
            { id: "ALL", name: "ALL GROUPS (GLOBAL)" },
            ...Object.keys(d).map((k) => ({ id: k, ...d[k] })),
          ]);
        })
      );
      const aRef = ref(db, "account_data");
      unsubs.push(
        onValue(aRef, (s) => {
          setAllAccountsData(s.val() || {});
          setIsLoading(false);
        })
      );
    }
    // 🟢 ADMIN: Tarik HANYA Grup yang Didelegasikan
    else if (role === "admin") {
      const mRef = ref(db, `users/${user.uid}/managed_groups`);
      unsubs.push(
        onValue(mRef, (mSnap) => {
          const managed = mSnap.val() || {};
          const allowedGroups = Object.keys(managed).filter((k) => managed[k]);

          if (allowedGroups.length === 0) {
            setGroupsList([]);
            setIsLoading(false);
            return;
          }

          const gRef = ref(db, "groups");
          unsubs.push(
            onValue(gRef, (gSnap) => {
              const allG = gSnap.val() || {};
              const myG = allowedGroups
                .map((id) => ({ id, ...allG[id] }))
                .filter((g) => g.name);
              setGroupsList(myG);

              let allowedAccs = [];
              myG.forEach((g) => {
                if (g.accounts)
                  allowedAccs.push(...Object.keys(g.accounts));
              });
              const uniqueAccs = [...new Set(allowedAccs)];

              uniqueAccs.forEach((acc) => {
                const accRef = ref(db, `account_data/${acc}`);
                unsubs.push(
                  onValue(accRef, (aSnap) => {
                    setAllAccountsData((prev) => ({
                      ...prev,
                      [acc]: aSnap.val() || {},
                    }));
                  })
                );
              });
              setIsLoading(false);
            })
          );
        })
      );
    }
    // 🟢 INVESTOR: Hanya tarik Akun spesifik miliknya
    else if (role === "investor") {
      const uRef = ref(db, `users/${user.uid}/owned_accounts`);
      unsubs.push(
        onValue(uRef, (snap) => {
          const owned = snap.val() || {};
          const allowedIds = Object.keys(owned).filter((k) => owned[k]);
          setGroupsList([]);

          if (allowedIds.length === 0) {
            setAccountsList([]);
            setIsLoading(false);
            return;
          }
          allowedIds.forEach((acc) => {
            const accRef = ref(db, `account_data/${acc}`);
            unsubs.push(
              onValue(accRef, (aSnap) => {
                setAllAccountsData((prev) => ({
                  ...prev,
                  [acc]: aSnap.val() || {},
                }));
              })
            );
          });
          setIsLoading(false);
        })
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [user, role, isAuthLoading]);

  // ============================================================================
  // 2. CASCADING DROPDOWN LOGIC
  // ============================================================================

  // Atur default selected Group (Admin/Super Admin)
  useEffect(() => {
    if ((role === "super_admin" || role === "admin") && groupsList.length > 0) {
      if (
        !selectedGroupId ||
        !groupsList.find((g) => g.id === selectedGroupId)
      ) {
        setSelectedGroupId(groupsList[0].id);
      }
    }
  }, [groupsList, role, selectedGroupId]);

  // Atur daftar Accounts berdasarkan Group yang dipilih
  useEffect(() => {
    let newAccList = [];
    if (role === "investor") {
      newAccList = Object.keys(allAccountsData);
    } else if (role === "super_admin" || role === "admin") {
      if (selectedGroupId === "ALL") {
        newAccList = Object.keys(allAccountsData);
      } else {
        const groupObj = groupsList.find((g) => g.id === selectedGroupId);
        if (groupObj && groupObj.accounts) {
          newAccList = Object.keys(groupObj.accounts);
        }
      }
    }

    setAccountsList(newAccList);
    if (
      newAccList.length > 0 &&
      !newAccList.includes(selectedAccountId)
    ) {
      setSelectedAccountId(newAccList[0]);
    } else if (newAccList.length === 0) {
      setSelectedAccountId("");
    }
  }, [
    selectedGroupId,
    allAccountsData,
    role,
    groupsList,
    selectedAccountId,
  ]);

  // ============================================================================
  // VIEW NAVIGATION
  // ============================================================================
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const monthName = viewDate.toLocaleString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const goToPrevMonth = () =>
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const goToNextMonth = () =>
    setViewDate(new Date(currentYear, currentMonth + 1, 1));

  // ============================================================================
  // SNAPSHOT PROCESSING
  // ============================================================================
  const snapshots =
    allAccountsData[selectedAccountId]?.snapshots || {};
  const processedSnapshots = {};

  Object.keys(snapshots).forEach((tsKey) => {
    let timeMs = parseInt(tsKey);
    if (timeMs < 10000000000) {
      timeMs = timeMs * 1000;
    }
    const exactDateWITA = new Date(timeMs + 28800000);
    const y = exactDateWITA.getUTCFullYear();
    const m = exactDateWITA.getUTCMonth();
    const d = exactDateWITA.getUTCDate();
    processedSnapshots[`${y}-${m}-${d}`] = snapshots[tsKey];
  });

  // ============================================================================
  // MONTHLY DATA GENERATOR
  // ============================================================================
  const generateMonthlyData = () => {
    const days = [];
    const firstDayOfMonth = new Date(
      currentYear,
      currentMonth,
      1
    ).getDay();
    const daysInMonth = new Date(
      currentYear,
      currentMonth + 1,
      0
    ).getDate();

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ empty: true });
    }

    const today = new Date();
    const currentMonthToday = today.getMonth();
    const currentYearToday = today.getFullYear();

    for (let i = 1; i <= daysInMonth; i++) {
      const isFuture =
        (currentYear === currentYearToday &&
          currentMonth === currentMonthToday &&
          i > today.getDate()) ||
        currentYear > currentYearToday ||
        (currentYear === currentYearToday &&
          currentMonth > currentMonthToday);

      const lookupKey = `${currentYear}-${currentMonth}-${i}`;
      const dayData = processedSnapshots[lookupKey];

      let profit = 0;
      let growth = 0;
      let lot = 0;
      let status = "neutral";

      if (isFuture) {
        status = "future";
      } else if (dayData) {
        profit = dayData.daily_profit || dayData.profit || 0;
        growth =
          dayData.daily_growth_percent ||
          dayData.growth ||
          dayData.growth_percent ||
          0;
        lot =
          dayData.daily_lots || dayData.lot || dayData.lots || 0;

        if (profit > 0) status = "win";
        else if (profit < 0) status = "loss";
      }

      days.push({
        day: i,
        empty: false,
        status,
        profit,
        growth,
        lot,
      });
    }

    while (days.length % 7 !== 0) days.push({ empty: true });
    return days;
  };

  const monthlyDays = generateMonthlyData();

  // ============================================================================
  // FUND MANAGER METRICS
  // ============================================================================
  let grossProfit = 0;
  let grossLoss = 0;
  let maxDailyProfit = 0;
  let maxDailyLoss = 0;
  let winDays = 0;
  let totalTradingDays = 0;

  monthlyDays.forEach((d) => {
    if (
      !d.empty &&
      d.status !== "future" &&
      (d.profit !== 0 || d.lot > 0)
    ) {
      totalTradingDays++;
      if (d.profit > 0) {
        grossProfit += d.profit;
        winDays++;
        if (d.profit > maxDailyProfit) maxDailyProfit = d.profit;
      } else if (d.profit < 0) {
        const absLoss = Math.abs(d.profit);
        grossLoss += absLoss;
        if (absLoss > maxDailyLoss) maxDailyLoss = absLoss;
      }
    }
  });

  const netProfit = grossProfit - grossLoss;
  const profitFactor =
    grossLoss > 0
      ? (grossProfit / grossLoss).toFixed(2)
      : grossProfit > 0
        ? "∞"
        : "0.00";
  const winRate =
    totalTradingDays > 0
      ? ((winDays / totalTradingDays) * 100).toFixed(1)
      : 0;

  const formatCur = (val) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val || 0);

  // ============================================================================
  // PDF EXPORT
  // ============================================================================
  const handleExportPdf = async () => {
    if (!selectedAccountId || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const dayNames = [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
      ];
      const monthStr = viewDate.toLocaleString("en-US", {
        month: "long",
      });

      const weeklyData = weeks
        .filter((weekDays) => weekDays.some((d) => !d.empty))
        .map((weekDays) => {
          const days = weekDays
            .filter((d) => !d.empty)
            .map((d) => {
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
              return {
                dayName: dayNames[
                  new Date(
                    currentYear,
                    currentMonth,
                    d.day
                  ).getDay()
                ],
                date: d.day,
                dateStr,
                growth: d.growth,
                profit: d.profit,
                lot: d.lot,
                status: d.status,
              };
            });

          const firstDay = days[0];
          const lastDay = days[days.length - 1];

          return {
            startDate: `${monthStr} ${firstDay.date}`,
            endDate: `${monthStr} ${lastDay.date}`,
            days,
            analysis: "",
          };
        });

      const monthDaysWithData = monthlyDays
        .filter((d) => !d.empty && d.status !== "future")
        .map((d) => ({
          dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
          data: {
            daily_profit: d.profit,
            percentage_growth: d.growth,
            daily_lots: d.lot,
          },
        }));

      const summary = {
        totalProfit: netProfit,
        grossProfit,
        grossLoss,
        profitFactor,
        winRate,
        tradingDays: totalTradingDays,
        maxDailyProfit,
        maxDailyLoss,
      };

      const accountName = `Account ${selectedAccountId}`;

      await generateMonthlyReport({
        account: accountName,
        month: monthStr,
        year: currentYear,
        summary,
        initialDeposit: 10000,
        weeklyData,
        monthDaysWithData,
      });
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ============================================================================
  // EXPAND/COLLAPSE
  // ============================================================================
  const toggleWeek = (weekIndex) => {
    setExpandedWeeks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(weekIndex)) {
        newSet.delete(weekIndex);
      } else {
        newSet.add(weekIndex);
      }
      return newSet;
    });
  };

  // ============================================================================
  // WEEKS
  // ============================================================================
  const weeks = [];
  for (let i = 0; i < monthlyDays.length; i += 7) {
    weeks.push(monthlyDays.slice(i, i + 7));
  }

  const weekSummaries = weeks.map((weekDays, weekIndex) => {
    let weekProfit = 0;
    let weekWins = 0;
    let weekTradingDays = 0;

    weekDays.forEach((d) => {
      if (
        !d.empty &&
        d.status !== "future" &&
        (d.profit !== 0 || d.lot > 0)
      ) {
        weekTradingDays++;
        weekProfit += d.profit;
        if (d.profit > 0) weekWins++;
      }
    });

    const weekWinRate =
      weekTradingDays > 0
        ? ((weekWins / weekTradingDays) * 100).toFixed(1)
        : 0;
    const startDay = weekDays[0]?.day || "";
    const endDay = weekDays[6]?.day || "";

    return {
      weekIndex,
      startDay,
      endDay,
      weekProfit,
      weekWinRate,
      weekTradingDays,
    };
  });

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (isAuthLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#030712] font-mono text-blue-500 animate-pulse text-sm">
        Verifying Security Clearance...
      </div>
    );

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center font-bold text-[var(--primary)] animate-pulse text-xl bg-[#030712]">
        Connecting to Server...
      </div>
    );

  // ============================================================================
  // EMPTY STATES
  // ============================================================================
  if (role === "investor" && accountsList.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center">
        <Lock
          size={64}
          className="text-red-500 opacity-50 mb-2"
        />
        <h2 className="text-xl font-black text-red-500 uppercase">
          {t.restricted_access}
        </h2>
        <p className="text-sm font-bold text-gray-500">
          {t.contact_admin}
        </p>
      </div>
    );

  if (role === "admin" && groupsList.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center">
        <Folders
          size={64}
          className="text-purple-500 opacity-50 mb-2"
        />
        <h2 className="text-xl font-black text-purple-500 uppercase">
          {t.no_group_access}
        </h2>
        <p className="text-sm font-bold text-gray-500">
          {t.contact_admin}
        </p>
      </div>
    );

  // ============================================================================
  // MAIN UI
  // ============================================================================
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans transition-colors duration-300">
      {/* HEADER & ACCOUNT SELECTOR */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5 w-full md:w-auto">
          <div className="p-4 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] shadow-inner">
            <BarChart size={36} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">
              {t.title}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          {/* GROUP SELECTOR (Admin/Super Admin) */}
          {role !== "investor" && groupsList.length > 0 && (
            <div className="w-full sm:w-auto bg-[var(--muted)]/50 p-3.5 rounded-2xl border border-[var(--card-border)] flex flex-col gap-1.5 shadow-sm">
              <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-1">
                {t.select_group}
              </span>
              <div className="relative">
                <select
                  value={selectedGroupId}
                  onChange={(e) =>
                    setSelectedGroupId(e.target.value)
                  }
                  className="appearance-none w-full sm:w-64 bg-[var(--background)] border border-purple-500/30 text-purple-500 font-bold text-sm rounded-xl pl-4 pr-10 py-3 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm transition-all hover:border-purple-500/50"
                >
                  {groupsList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-4 top-3.5 text-purple-500 pointer-events-none"
                />
              </div>
            </div>
          )}

          {/* ACCOUNT SELECTOR */}
          <div className="w-full sm:w-auto bg-[var(--muted)]/50 p-3.5 rounded-2xl border border-[var(--card-border)] flex flex-col gap-1.5 shadow-sm">
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-1">
              {t.select_account}
            </span>
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) =>
                  setSelectedAccountId(e.target.value)
                }
                className="appearance-none w-full sm:w-64 bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] font-bold text-sm rounded-xl pl-4 pr-10 py-3 outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer shadow-sm transition-all hover:border-[var(--primary)]/50"
                disabled={accountsList.length === 0}
              >
                {accountsList.length === 0 && (
                  <option value="">{t.no_account}</option>
                )}
                {accountsList.map((acc) => {
                  const investorName = allAccountsData[acc]?.metadata?.investor_name || "";
                  return (
                    <option key={acc} value={acc}>
                      {investorName ? `${acc} - ${investorName}` : `Acc: ${acc}`}
                    </option>
                  );
                })}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-4 top-3.5 text-[var(--muted-foreground)] pointer-events-none"
              />
            </div>
          </div>

          {/* PDF EXPORT */}
          <div className="flex items-end">
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || !selectedAccountId}
              className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary)]/90 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl shadow-sm transition-all"
            >
              {isExportingPdf ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Download size={18} />
              )}
              <span className="text-sm">
                {isExportingPdf ? t.generating : t.export_pdf}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* NAVIGATOR BULAN */}
      <div className="flex justify-between items-center bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--card-border)] shadow-sm">
        <button
          onClick={goToPrevMonth}
          className="p-2 hover:bg-[var(--muted)] rounded-xl transition-colors text-[var(--foreground)] border border-[var(--card-border)] shadow-sm"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <CalendarDays
            size={20}
            className="text-[var(--primary)]"
          />
          <h2 className="text-lg font-black text-[var(--foreground)] uppercase tracking-widest">
            {monthName}
          </h2>
        </div>
        <button
          onClick={goToNextMonth}
          disabled={
            currentYear === new Date().getFullYear() &&
            currentMonth === new Date().getMonth()
          }
          className="p-2 hover:bg-[var(--muted)] disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-colors text-[var(--foreground)] border border-[var(--card-border)] shadow-sm"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* FUND MANAGER SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          {
            label: "Net Profit",
            val: formatCur(netProfit),
            icon: BadgeDollarSign,
            c: "text-blue-500",
          },
          {
            label: "Gross Profit",
            val: formatCur(grossProfit),
            icon: TrendingUp,
            c: "text-green-500",
          },
          {
            label: "Gross Loss",
            val: `-${formatCur(grossLoss)}`,
            icon: TrendingDown,
            c: "text-red-500",
          },
          {
            label: "Profit Factor",
            val: profitFactor,
            icon: Activity,
            c: "text-purple-500",
          },
          {
            label: "Win Rate",
            val: `${winRate}%`,
            icon: PieChart,
            c: "text-orange-500",
          },
          {
            label: "Trades",
            val: `${totalTradingDays} Days`,
            icon: Target,
            c: "text-[var(--foreground)]",
          },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--card-border)] shadow-sm hover:border-[var(--primary)] transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <item.icon size={14} className={item.c} />
              <span className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                {item.label}
              </span>
            </div>
            <div
              className={`text-lg font-black tracking-tight ${
                item.label === "Gross Loss"
                  ? "text-red-500"
                  : "text-[var(--foreground)]"
              }`}
            >
              {item.val}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--card-bg)] p-5 rounded-2xl border border-[var(--card-border)] shadow-sm flex justify-between items-center hover:border-green-500/50 transition-colors">
          <div>
            <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase flex items-center gap-1.5">
              <TrendingUp
                size={14}
                className="text-green-500"
              />{" "}
              Max Daily Profit
            </span>
            <span className="text-2xl font-black text-green-500 mt-1 block">
              {formatCur(maxDailyProfit)}
            </span>
          </div>
        </div>
        <div className="bg-[var(--card-bg)] p-5 rounded-2xl border border-[var(--card-border)] shadow-sm flex justify-between items-center hover:border-red-500/50 transition-colors">
          <div>
            <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase flex items-center gap-1.5">
              <ShieldAlert
                size={14}
                className="text-red-500"
              />{" "}
              Max Daily Loss
            </span>
            <span className="text-2xl font-black text-red-500 mt-1 block">
              {formatCur(maxDailyLoss)}
            </span>
          </div>
        </div>
      </div>

      {/* HEATMAP KALENDER */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm relative overflow-hidden transition-colors">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h3 className="font-bold text-xl md:text-2xl text-[var(--foreground)] flex items-center gap-2 tracking-tight">
            <CalendarDays className="text-[var(--primary)]" />{" "}
            {monthName} Heatmap
          </h3>
          <div className="flex items-center gap-4 text-[10px] font-bold bg-[var(--background)] px-4 py-2 rounded-xl border border-[var(--card-border)] shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>{" "}
              PROFIT
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>{" "}
              LOSS
            </div>
          </div>
        </div>

        {/* DESKTOP VIEW */}
        <div className="hidden md:block">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "12px",
            }}
            className="mb-3 text-center"
          >
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(
              (day, i) => (
                <div
                  key={i}
                  className="text-xs font-black text-[var(--muted-foreground)] uppercase tracking-widest"
                >
                  {day}
                </div>
              )
            )}
          </div>

          {weeks.map((weekDays, weekIndex) => {
            const hasNonEmptyDays = weekDays.some(
              (d) => !d.empty
            );
            if (!hasNonEmptyDays) return null;

            return (
              <div
                key={weekIndex}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: "12px",
                }}
                className="mb-3"
              >
                {weekDays.map((d, i) => {
                  const isWin = d.status === "win";
                  const isLoss = d.status === "loss";
                  const isNeutral = d.status === "neutral";
                  const isFuture = d.status === "future";

                  return (
                    <div
                      key={i}
                      style={{
                        ...(isWin
                          ? {
                              backgroundColor: "#10b981",
                              borderColor: "#10b981",
                              color: "white",
                            }
                          : {}),
                        ...(isLoss
                          ? {
                              backgroundColor: "#ef4444",
                              borderColor: "#ef4444",
                              color: "white",
                            }
                          : {}),
                      }}
                      className={`
                        relative flex flex-col justify-between p-3 rounded-2xl aspect-[4/3] transition-all border
                        ${d.empty ? "opacity-0 pointer-events-none border-transparent" : "hover:-translate-y-1 hover:shadow-lg"}
                        ${isWin || isLoss ? "shadow-md text-white" : ""}
                        ${isNeutral ? "bg-[var(--background)] border-[var(--card-border)]" : ""}
                        ${isFuture ? "bg-[var(--muted)]/20 border-[var(--card-border)] border-dashed opacity-50" : ""}
                      `}
                    >
                      {!d.empty && (
                        <>
                          <span
                            className={`text-[11px] font-bold ${
                              isWin || isLoss
                                ? "text-white"
                                : "text-[var(--muted-foreground)]"
                            }`}
                          >
                            {d.day}
                          </span>

                          <div className="flex-grow flex items-center justify-center">
                            <span
                              className={`text-xl font-black tracking-tighter ${
                                isWin || isLoss
                                  ? "text-white"
                                  : isFuture
                                    ? "opacity-0"
                                    : "text-[var(--foreground)]"
                              }`}
                            >
                              {isNeutral && d.lot === 0
                                ? "0.00%"
                                : d.growth > 0
                                  ? `+${d.growth.toFixed(2)}%`
                                  : `${d.growth.toFixed(2)}%`}
                            </span>
                          </div>

                          <div
                            className={`flex flex-col text-[10px] font-bold leading-snug mt-1 ${
                              isWin || isLoss
                                ? "text-white/90"
                                : "text-[var(--muted-foreground)]"
                            } ${
                              isFuture || (isNeutral && d.lot === 0)
                                ? "opacity-0"
                                : ""
                            }`}
                          >
                            <span>
                              ${Math.abs(d.profit).toFixed(2)}
                            </span>
                            <span>{d.lot.toFixed(2)} L</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* MOBILE VIEW */}
        <div className="block md:hidden">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "4px",
            }}
            className="mb-2 text-center"
          >
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(
              (day, i) => (
                <div
                  key={i}
                  className="text-[8px] font-black text-[var(--muted-foreground)] uppercase tracking-widest"
                >
                  {day}
                </div>
              )
            )}
          </div>

          <div className="space-y-3">
            {weeks.map((weekDays, weekIndex) => {
              const summary = weekSummaries[weekIndex];
              const isExpanded = expandedWeeks.has(weekIndex);
              const hasNonEmptyDays = weekDays.some(
                (d) => !d.empty
              );
              if (!hasNonEmptyDays) return null;

              return (
                <div key={weekIndex}>
                  <div
                    className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all ${
                      isExpanded
                        ? "bg-[var(--primary)]/10 border border-[var(--primary)]/30"
                        : "bg-[var(--muted)]/30 hover:bg-[var(--muted)]/50 border border-transparent"
                    }`}
                    onClick={() => toggleWeek(weekIndex)}
                  >
                    <div className="flex items-center justify-center w-5 h-5 shrink-0">
                      {isExpanded ? (
                        <ChevronDown
                          size={16}
                          className="text-[var(--primary)]"
                        />
                      ) : (
                        <ChevronRight
                          size={16}
                          className="text-[var(--muted-foreground)]"
                        />
                      )}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(7, minmax(0, 1fr))",
                        gap: "3px",
                      }}
                      className="flex-1"
                    >
                      {weekDays.map((d, i) => {
                        const isWin = d.status === "win";
                        const isLoss = d.status === "loss";
                        const isNeutral =
                          d.status === "neutral";
                        const isFuture =
                          d.status === "future";

                        return (
                          <div
                            key={i}
                            style={{
                              ...(isWin
                                ? {
                                    backgroundColor: "#10b981",
                                    borderColor: "#10b981",
                                    color: "white",
                                  }
                                : {}),
                              ...(isLoss
                                ? {
                                    backgroundColor: "#ef4444",
                                    borderColor: "#ef4444",
                                    color: "white",
                                  }
                                : {}),
                            }}
                            className={`
                              relative flex flex-col items-center justify-between p-1 rounded-lg aspect-square transition-all border
                              ${d.empty ? "opacity-0 pointer-events-none border-transparent" : ""}
                              ${isWin || isLoss ? "shadow-md text-white" : ""}
                              ${isNeutral ? "bg-[var(--background)] border-[var(--card-border)]" : ""}
                              ${isFuture ? "bg-[var(--muted)]/20 border-[var(--card-border)] border-dashed opacity-50" : ""}
                            `}
                          >
                            {!d.empty && (
                              <>
                                <span
                                  className={`text-[7px] font-bold leading-none ${
                                    isWin || isLoss
                                      ? "text-white"
                                      : "text-[var(--muted-foreground)]"
                                  }`}
                                >
                                  {d.day}
                                </span>

                                <span
                                  className={`text-[8px] font-black tracking-tighter leading-none ${
                                    isWin || isLoss
                                      ? "text-white"
                                      : isFuture
                                        ? "opacity-0"
                                        : "text-[var(--foreground)]"
                                  }`}
                                >
                                  {isNeutral && d.lot === 0
                                    ? "0.00%"
                                    : d.growth > 0
                                      ? `+${d.growth.toFixed(2)}%`
                                      : `${d.growth.toFixed(2)}%`}
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 bg-[var(--background)] rounded-xl border border-[var(--card-border)] p-3 space-y-2">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                          Minggu {weekIndex + 1} (
                          {summary.startDay} -{" "}
                          {summary.endDay})
                        </span>
                        <span
                          className={`text-[10px] font-bold ${summary.weekProfit >= 0 ? "text-green-500" : "text-red-500"}`}
                        >
                          {formatCur(summary.weekProfit)} |
                          WR: {summary.weekWinRate}%
                        </span>
                      </div>
                      {weekDays.map((d, i) => {
                        if (d.empty) return null;

                        const isWin = d.status === "win";
                        const isLoss = d.status === "loss";
                        const isNeutral =
                          d.status === "neutral";
                        const isFuture =
                          d.status === "future";

                        return (
                          <div
                            key={i}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                              isWin
                                ? "bg-[#10b981]/10 border border-[#10b981]/30"
                                : isLoss
                                  ? "bg-[#ef4444]/10 border border-[#ef4444]/30"
                                  : isFuture
                                    ? "opacity-40"
                                    : "bg-[var(--muted)]/30 border border-[var(--card-border)]"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--foreground)]">
                                {d.day}
                              </span>
                              <span
                                className={`font-black ${
                                  isWin
                                    ? "text-[#10b981]"
                                    : isLoss
                                      ? "text-[#ef4444]"
                                      : "text-[var(--foreground)]"
                                }`}
                              >
                                {isFuture
                                  ? "-"
                                  : isNeutral && d.lot === 0
                                    ? "0.00%"
                                    : d.growth > 0
                                      ? `+${d.growth.toFixed(2)}%`
                                      : `${d.growth.toFixed(2)}%`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 font-bold text-[var(--muted-foreground)]">
                              <span>
                                {isFuture
                                  ? "-"
                                  : `$${Math.abs(d.profit).toFixed(2)}`}
                              </span>
                              <span>
                                {isFuture
                                  ? "-"
                                  : `${d.lot.toFixed(2)} L`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}