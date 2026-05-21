"use client";

// ============================================================================
// SECTION 1: IMPORTS & DEPENDENCIES
// ============================================================================
import { useState, useEffect, useRef } from "react";
import {
  Clock, Timer, CheckCircle2, XCircle, AlertTriangle,
  Activity, Play, Pause, RefreshCw, History, Server,
  CalendarDays, ChevronRight, Radio, Zap, Wifi, WifiOff,
  HardDrive, ShieldCheck, RotateCcw
} from "lucide-react";
import { db, auth } from "../../lib/firebase";
import { ref, onValue, query, limitToLast } from "firebase/database";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

// ============================================================================
// SECTION 2: DICTIONARY
// ============================================================================
const dict = {
  en: {
    title: "CRON JOB MONITOR",
    subtitle: "Automated Task Scheduler",
    heartbeat: "Heartbeat",
    online: "ONLINE",
    offline: "OFFLINE",
    uptime: "Uptime",
    server_time: "Server Time",
    timezone: "Timezone",
    gmt8_clock: "GMT+8",
    job_status: "Job Status",
    trigger_history: "Trigger History",
    no_triggers: "No trigger history recorded yet.",
    no_jobs: "No cron jobs configured.",
    status_idle: "Idle",
    status_running: "Running",
    status_completed: "Completed",
    status_failed: "Failed",
    run_count: "Runs",
    last_run: "Last Run",
    next_run: "Next Run",
    never: "Never",
    access_denied: "ACCESS DENIED",
    super_admin_only: "This page is restricted to Super Admin only.",
    connection_lost: "Connection Lost",
    connection_established: "Connected",
    refreshing: "Syncing...",
    job_name: "Job Name",
    action: "Action",
    time: "Time",
    status: "Status",
    details: "Details",
    description: "Description",
    result: "Result",
    error: "Error",
    accounts_snapshotted: "Accounts Snapshotted",
    accounts_checked: "Accounts Checked",
    healthy: "Healthy",
    warning: "Warning",
    off: "Off",
    licenses_checked: "Licenses Checked",
    expiring_soon: "Expiring Soon",
    total_pnl: "Total PnL",
    total_equity: "Total Equity",
    active_trades: "Active Trades",
  },
  id: {
    title: "MONITOR CRON JOB",
    subtitle: "Penjadwal Tugas Otomatis",
    heartbeat: "Detak Jantung",
    online: "ONLINE",
    offline: "OFFLINE",
    uptime: "Waktu Aktif",
    server_time: "Waktu Server",
    timezone: "Zona Waktu",
    gmt8_clock: "GMT+8",
    job_status: "Status Job",
    trigger_history: "Riwayat Trigger",
    no_triggers: "Belum ada riwayat trigger tercatat.",
    no_jobs: "Tidak ada cron job dikonfigurasi.",
    status_idle: "Siaga",
    status_running: "Berjalan",
    status_completed: "Selesai",
    status_failed: "Gagal",
    run_count: "Jumlah",
    last_run: "Terakhir",
    next_run: "Berikutnya",
    never: "Belum",
    access_denied: "AKSES DITOLAK",
    super_admin_only: "Halaman ini hanya untuk Super Admin.",
    connection_lost: "Koneksi Terputus",
    connection_established: "Terhubung",
    refreshing: "Sinkronisasi...",
    job_name: "Nama Job",
    action: "Aksi",
    time: "Waktu",
    status: "Status",
    details: "Detail",
    description: "Deskripsi",
    result: "Hasil",
    error: "Error",
    accounts_snapshotted: "Akun Disnapshot",
    accounts_checked: "Akun Diperiksa",
    healthy: "Sehat",
    warning: "Peringatan",
    off: "Mati",
    licenses_checked: "Lisensi Diperiksa",
    expiring_soon: "Segera Habis",
    total_pnl: "Total PnL",
    total_equity: "Total Ekuitas",
    active_trades: "Trade Aktif",
  },
};

// ============================================================================
// SECTION 3: HELPER FUNCTIONS
// ============================================================================
const formatGMT8 = (ts) => {
  if (!ts) return "-";
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-GB", { timeZone: "Asia/Makassar" }) +
    " " +
    d.toLocaleTimeString("en-US", {
      timeZone: "Asia/Makassar",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) +
    " GMT+8"
  );
};

const formatUptime = (seconds) => {
  if (!seconds || seconds <= 0) return "0m";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
};

const getStatusStyle = (status) => {
  switch (status) {
    case "running":
      return {
        bg: "bg-blue-500/10",
        text: "text-blue-500",
        border: "border-blue-500/40",
        icon: Play,
        pulse: true,
      };
    case "completed":
      return {
        bg: "bg-green-500/10",
        text: "text-green-500",
        border: "border-green-500/40",
        icon: CheckCircle2,
        pulse: false,
      };
    case "failed":
      return {
        bg: "bg-red-500/10",
        text: "text-red-500",
        border: "border-red-500/40",
        icon: XCircle,
        pulse: false,
      };
    case "idle":
    default:
      return {
        bg: "bg-gray-500/10",
        text: "text-gray-500",
        border: "border-gray-500/40",
        icon: Timer,
        pulse: false,
      };
  }
};

// ============================================================================
// SECTION 4: MAIN CRON MANAGER COMPONENT
// ============================================================================
export default function CronManager() {
  const router = useRouter();
  const { user, role, loading: isAuthLoading } = useAuth();
  const [lang, setLang] = useState("en");
  const t = dict[lang];

  // State
  const [heartbeat, setHeartbeat] = useState(null);
  const [cronJobs, setCronJobs] = useState({});
  const [triggers, setTriggers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gmt8Time, setGmt8Time] = useState("");

  // GMT+8 Live Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setGmt8Time(
        now.toLocaleTimeString("en-US", {
          timeZone: "Asia/Makassar",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Guard Route
  useEffect(() => {
    if (!isAuthLoading && !user) router.push("/login");
    if (!isAuthLoading && role && role !== "super_admin") {
      // Non-super_admin redirect ke dashboard
    }
  }, [user, isAuthLoading, role, router]);

  // Firebase Listeners
  useEffect(() => {
    if (isAuthLoading || !user) return;
    const unsubs = [];

    // 1. Heartbeat
    const hbRef = ref(db, "cron_heartbeat");
    unsubs.push(
      onValue(hbRef, (snap) => {
        setHeartbeat(snap.val() || null);
      })
    );

    // 2. Cron Jobs
    const cjRef = ref(db, "cron_jobs");
    unsubs.push(
      onValue(cjRef, (snap) => {
        setCronJobs(snap.val() || {});
        setIsLoading(false);
      })
    );

    // 3. Triggers (last 50)
    const tRef = query(ref(db, "cron_triggers"), limitToLast(50));
    unsubs.push(
      onValue(tRef, (snap) => {
        const data = snap.val() || {};
        const arr = Object.keys(data)
          .map((k) => ({ id: k, ...data[k] }))
          .sort((a, b) => (b.triggered_at || 0) - (a.triggered_at || 0));
        setTriggers(arr);
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [user, isAuthLoading]);

  // ========================================================================
  // LOADING & ACCESS DENIED STATES
  // ========================================================================
  if (isAuthLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#030712] font-mono text-blue-500 animate-pulse text-sm">
        Verifying Security Clearance...
      </div>
    );

  if (role !== "super_admin")
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center">
        <ShieldCheck size={64} className="text-red-500 opacity-50 mb-2" />
        <h2 className="text-xl font-black text-red-500 uppercase">
          {t.access_denied}
        </h2>
        <p className="text-sm font-bold text-gray-500">{t.super_admin_only}</p>
      </div>
    );

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center font-bold text-[var(--primary)] animate-pulse text-xl bg-[#030712]">
        Connecting to Server...
      </div>
    );

  // ========================================================================
  // HEARTBEAT STATUS CHECK
  // ========================================================================
  const isOnline =
    heartbeat &&
    heartbeat.status === "online" &&
    Date.now() - (heartbeat.last_ping || 0) < 180000; // 3 min timeout

  const jobEntries = Object.entries(cronJobs);
  const statusLabelMap = {
    idle: t.status_idle,
    running: t.status_running,
    completed: t.status_completed,
    failed: t.status_failed,
  };

  // ========================================================================
  // RENDER RESULT DETAILS HELPER
  // ========================================================================
  const renderResultDetails = (result) => {
    if (!result || Object.keys(result).length === 0) return null;
    const r = result;

    return (
      <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
        {r.accounts_snapshotted !== undefined && (
          <span className="text-green-400">
            ✓ {r.accounts_snapshotted} {t.accounts_snapshotted}
          </span>
        )}
        {r.total_ml_accounts !== undefined && (
          <>
            <span className="text-green-400">
              ✓ {r.healthy} {t.healthy}
            </span>
            <span className="text-yellow-500">
              ⚠ {r.warning} {t.warning}
            </span>
            <span className="text-red-400">✗ {r.offline} {t.off}</span>
          </>
        )}
        {r.total_licenses !== undefined && (
          <span className="text-red-400">
            ⏰ {r.expiring_soon_count} {t.expiring_soon}
          </span>
        )}
        {r.total_pnl_usd !== undefined && (
          <span className="text-blue-400">
            ${r.total_pnl_usd?.toLocaleString()} {t.total_pnl}
          </span>
        )}
        {r.total_active_trades !== undefined && (
          <span className="text-purple-400">
            📊 {r.total_active_trades} {t.active_trades}
          </span>
        )}
      </div>
    );
  };

  // ========================================================================
  // MAIN UI
  // ========================================================================
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans transition-colors duration-300">
      {/* HEADER */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 md:p-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-sm relative overflow-hidden">
        <div className="z-10 w-full lg:w-auto">
          <h2 className="text-sm font-black text-[var(--muted-foreground)] uppercase tracking-widest flex items-center gap-2 mb-2">
            <Activity className="text-[var(--primary)]" size={16} /> {t.title}
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">{t.subtitle}</p>
        </div>

        <div className="z-10 w-full lg:w-auto flex flex-wrap items-center gap-4 bg-[var(--muted)]/50 p-4 rounded-2xl border border-[var(--card-border)]">
          {/* GMT+8 Clock */}
          <div className="flex items-center gap-2 bg-[var(--background)] px-4 py-2 rounded-xl border border-[var(--card-border)]">
            <Clock size={16} className="text-[var(--primary)]" />
            <span className="text-lg font-black text-[var(--foreground)] font-mono">
              {gmt8Time}
            </span>
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">
              {t.gmt8_clock}
            </span>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 bg-[var(--background)] px-4 py-2 rounded-xl border border-[var(--card-border)]">
            {isOnline ? (
              <Wifi size={16} className="text-green-500" />
            ) : (
              <WifiOff size={16} className="text-red-500" />
            )}
            <span
              className={`text-xs font-bold uppercase ${
                isOnline ? "text-green-500" : "text-red-500"
              }`}
            >
              {isOnline ? t.online : t.offline}
            </span>
          </div>

          {/* Language Toggle */}
          <div className="flex items-center bg-[var(--background)] p-1 rounded-lg border border-[var(--card-border)] shadow-sm">
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                lang === "en"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("id")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                lang === "id"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              ID
            </button>
          </div>
        </div>
      </div>

      {/* HEARTBEAT & UPTIME CARD */}
      {heartbeat && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-4 flex flex-col gap-1 shadow-sm">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest flex items-center gap-1.5">
              <Radio size={12} className="text-blue-500" /> {t.heartbeat}
            </p>
            <span
              className={`text-lg font-black ${
                isOnline ? "text-green-500" : "text-red-500"
              }`}
            >
              {isOnline ? t.online : t.offline}
            </span>
            <p className="text-[9px] text-[var(--muted-foreground)]">
              {formatGMT8(heartbeat.last_ping)}
            </p>
          </div>
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-4 flex flex-col gap-1 shadow-sm">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest flex items-center gap-1.5">
              <RotateCcw size={12} className="text-purple-500" /> {t.uptime}
            </p>
            <span className="text-lg font-black text-[var(--foreground)]">
              {formatUptime(heartbeat.uptime_seconds)}
            </span>
            <p className="text-[9px] text-[var(--muted-foreground)]">
              {t.server_time}
            </p>
          </div>
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-4 flex flex-col gap-1 shadow-sm">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest flex items-center gap-1.5">
              <Server size={12} className="text-green-500" /> {t.timezone}
            </p>
            <span className="text-lg font-black text-[var(--foreground)]">
              {heartbeat.timezone || "Asia/Makassar"}
            </span>
            <p className="text-[9px] text-[var(--muted-foreground)]">
              {t.gmt8_clock}
            </p>
          </div>
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-4 flex flex-col gap-1 shadow-sm">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest flex items-center gap-1.5">
              <Zap size={12} className="text-yellow-500" /> {t.refreshing}
            </p>
            <span className="text-lg font-black text-[var(--foreground)]">
              {jobEntries.length}
            </span>
            <p className="text-[9px] text-[var(--muted-foreground)]">
              {triggers.length > 0
                ? `${triggers.length} triggers`
                : t.no_triggers}
            </p>
          </div>
        </div>
      )}

      {/* JOB STATUS GRID */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 shadow-sm">
        <h3 className="font-bold text-sm text-[var(--foreground)] mb-6 flex items-center gap-2">
          <HardDrive size={16} className="text-[var(--primary)]" />{" "}
          {t.job_status}
        </h3>

        {jobEntries.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center border border-[var(--card-border)] border-dashed rounded-xl">
            <AlertTriangle
              size={40}
              className="text-[var(--muted-foreground)] opacity-50 mb-3"
            />
            <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
              {t.no_jobs}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobEntries.map(([jobId, job]) => {
              const statusStyle = getStatusStyle(job.status);
              const StatusIcon = statusStyle.icon;
              return (
                <div
                  key={jobId}
                  className={`bg-[var(--background)] rounded-2xl border ${
                    statusStyle.border
                  } p-5 flex flex-col gap-3 transition-all shadow-sm hover:shadow-md ${
                    statusStyle.pulse ? "animate-pulse" : ""
                  }`}
                >
                  {/* Job Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-sm text-[var(--foreground)] capitalize">
                        {job.name?.replace(/_/g, " ") || jobId}
                      </h4>
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                        {job.description || ""}
                      </p>
                    </div>
                    <span
                      className={`${statusStyle.bg} ${statusStyle.text} px-2 py-0.5 rounded-md text-[9px] font-black uppercase flex items-center gap-1`}
                    >
                      <StatusIcon size={10} />
                      {statusLabelMap[job.status] || job.status}
                    </span>
                  </div>

                  {/* Job Stats */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-[var(--muted-foreground)]">
                        {t.run_count}
                      </span>
                      <p className="font-bold text-[var(--foreground)]">
                        {job.run_count || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)]">
                        {t.last_run}
                      </span>
                      <p className="font-bold text-[var(--foreground)]">
                        {job.last_run ? formatGMT8(job.last_run) : t.never}
                      </p>
                    </div>
                  </div>

                  {/* Action badge */}
                  <div className="flex items-center gap-1.5 mt-auto">
                    <span className="px-2 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded text-[9px] font-mono font-bold uppercase">
                      {job.action || "-"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TRIGGER HISTORY TABLE */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[var(--card-border)] flex justify-between items-center bg-[var(--muted)]/20">
          <h3 className="font-bold text-sm text-[var(--foreground)] flex items-center gap-2">
            <History size={16} className="text-blue-500" /> {t.trigger_history}{" "}
            ({triggers.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--background)] text-[10px] uppercase text-[var(--muted-foreground)] border-b border-[var(--card-border)]">
                <th className="p-4 font-black">{t.job_name}</th>
                <th className="p-4 font-black">{t.action}</th>
                <th className="p-4 font-black text-center">{t.time}</th>
                <th className="p-4 font-black text-center">{t.status}</th>
                <th className="p-4 font-black">{t.details}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {triggers.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="p-10 text-center text-xs text-[var(--muted-foreground)] font-bold italic tracking-widest uppercase"
                  >
                    {t.no_triggers}
                  </td>
                </tr>
              ) : (
                triggers.map((trigger) => {
                  const statusStyle = getStatusStyle(trigger.status);
                  const StatusIcon = statusStyle.icon;
                  return (
                    <tr
                      key={trigger.id}
                      className="border-b border-[var(--card-border)] hover:bg-[var(--muted)]/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-bold text-[var(--foreground)] capitalize">
                          {trigger.job_name?.replace(/_/g, " ")}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded text-[9px] font-mono font-bold uppercase">
                          {trigger.action}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-xs font-mono text-[var(--foreground)]">
                          {trigger.gmt8_time || formatGMT8(trigger.triggered_at)}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`${statusStyle.bg} ${statusStyle.text} px-2 py-0.5 rounded-md text-[9px] font-black uppercase inline-flex items-center gap-1`}
                        >
                          <StatusIcon size={10} />
                          {statusLabelMap[trigger.status] || trigger.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {trigger.error ? (
                          <span className="text-[10px] text-red-500 font-mono">
                            {trigger.error}
                          </span>
                        ) : (
                          renderResultDetails(trigger.result)
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}