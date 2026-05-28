"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../../lib/firebase";
import { ref, onValue, set, remove, update } from "firebase/database";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Users,
  Server,
  Cpu,
  Percent,
  Send,
  Loader2,
  Shield,
  CreditCard,
  AlertTriangle,
  Plus,
  Save,
  Eye,
  Wallet,
  DollarSign,
  Calendar,
  Clock,
  Check,
  X,
  TrendingUp,
  Receipt,
  ChevronUp,
  Edit3,
  Trash2,
  ArrowRightLeft,
  FolderTree,
  Settings,
  Download,
  Share2,
  Filter,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { generateReceiptHTML, generateTelegramMessage, generateInvoiceId } from "../../lib/receipt-generator";
import ReceiptModal from "../../components/ReceiptModal";

// ============================================================================
// SUBSCRIPTION AREA — Unified Page for All Roles
//   - super_admin / admin: Tree View Hierarchy + Billing Center + CRUD Management
//   - investor: Invoice list with Telegram URL Scheme
//   - Balance & profit computed from account_data/{accNum}/realtime_stats
//     and snapshots (same source as Analytics page)
// ============================================================================

const TELEGRAM_BOT_USERNAME = "KRXAdminBot";

// ── Helper: Process snapshots timestamp keys to date-keyed map ──
function processSnapshotsToDailyData(snapshots) {
  if (!snapshots || typeof snapshots !== "object") return {};
  const dailyData = {};

  Object.keys(snapshots).forEach((tsKey) => {
    let timeMs = parseInt(tsKey);
    if (isNaN(timeMs)) return;
    if (timeMs < 10000000000) timeMs = timeMs * 1000;
    const exactDateWITA = new Date(timeMs + 28800000);
    const y = exactDateWITA.getUTCFullYear();
    const m = String(exactDateWITA.getUTCMonth() + 1).padStart(2, "0");
    const d = String(exactDateWITA.getUTCDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${d}`;
    dailyData[dateKey] = snapshots[tsKey];
  });

  return dailyData;
}

// ── Helper: Compute profit summary from account snapshots ──
function computeAccountProfitSummary(snapshots, profitSharePercent, invoices, accNum) {
  const empty = {
    totalProfit: 0, totalLots: 0, totalTradingDays: 0,
    totalFee: 0, totalPaid: 0, totalPending: 0, totalUnpaid: 0,
    monthlyBreakdown: [], balance: 0,
  };

  const dailyData = processSnapshotsToDailyData(snapshots);
  if (Object.keys(dailyData).length === 0) return empty;

  const monthlyMap = {};
  let latestBalance = 0;

  Object.entries(dailyData).forEach(([dateStr, data]) => {
    const monthKey = dateStr.substring(0, 7);
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { profit: 0, lots: 0, growthSum: 0, tradingDays: 0 };
    monthlyMap[monthKey].profit += Number(data.daily_profit || data.profit || 0);
    monthlyMap[monthKey].lots += Number(data.daily_lots || data.lot || data.lots || 0);
    monthlyMap[monthKey].growthSum += Number(data.daily_growth_percent || data.growth || data.growth_percent || 0);
    monthlyMap[monthKey].tradingDays++;
    if (data.balance) latestBalance = Number(data.balance);
  });

  const paidByMonth = {};
  const pendingByMonth = {};
  if (invoices) {
    Object.values(invoices).forEach((inv) => {
      if (inv.type !== "profit_share" || inv.accountNumber !== accNum) return;
      const invMonth = (inv.period_start || "").substring(0, 7);
      if (!invMonth) return;
      if (inv.status === "paid") paidByMonth[invMonth] = (paidByMonth[invMonth] || 0) + Number(inv.amount || 0);
      else if (inv.status === "pending") pendingByMonth[invMonth] = (pendingByMonth[invMonth] || 0) + Number(inv.amount || 0);
    });
  }

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const monthlyBreakdown = Object.entries(monthlyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, data]) => {
      const feeShare = Math.max(0, data.profit * (profitSharePercent / 100));
      const paid = paidByMonth[month] || 0;
      const pending = pendingByMonth[month] || 0;
      const unpaid = Math.max(0, feeShare - paid);
      const [y, m] = month.split("-");
      return {
        month, label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`,
        totalProfit: +data.profit.toFixed(2), totalLots: +data.lots.toFixed(2),
        avgGrowth: data.tradingDays > 0 ? +(data.growthSum / data.tradingDays).toFixed(2) : 0,
        tradingDays: data.tradingDays,
        feeShare: +feeShare.toFixed(2), paidAmount: +paid.toFixed(2),
        pendingAmount: +pending.toFixed(2), unpaidAmount: +unpaid.toFixed(2),
      };
    });

  const sum = (arr, key) => arr.reduce((s, m) => s + m[key], 0);
  return {
    totalProfit: +sum(monthlyBreakdown, "totalProfit").toFixed(2),
    totalLots: +sum(monthlyBreakdown, "totalLots").toFixed(2),
    totalTradingDays: sum(monthlyBreakdown, "tradingDays"),
    totalFee: +sum(monthlyBreakdown, "feeShare").toFixed(2),
    totalPaid: +sum(monthlyBreakdown, "paidAmount").toFixed(2),
    totalPending: +sum(monthlyBreakdown, "pendingAmount").toFixed(2),
    totalUnpaid: +sum(monthlyBreakdown, "unpaidAmount").toFixed(2),
    monthlyBreakdown, balance: latestBalance,
  };
}

// ── Helper: Get account balance from multiple sources ──
function getAccountBalance(accData) {
  if (!accData) return 0;
  const rtBalance = Number(accData?.realtime_stats?.balance || 0);
  if (rtBalance > 0) return rtBalance;
  const metaBalance = Number(accData?.metadata?.balance || 0);
  if (metaBalance > 0) return metaBalance;
  const snapshots = accData?.snapshots;
  if (snapshots && typeof snapshots === "object") {
    let latestBalance = 0, latestTs = 0;
    Object.entries(snapshots).forEach(([tsKey, data]) => {
      const ts = parseInt(tsKey);
      if (data.balance && ts > latestTs) { latestBalance = Number(data.balance); latestTs = ts; }
    });
    if (latestBalance > 0) return +latestBalance.toFixed(2);
  }
  return 0;
}

// ── Helper: Generate safe Firebase key from name ──
function toSafeKey(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

export default function SubscriptionAreaPage() {
  const { user, role } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    );
  }

  if (role === "super_admin" || role === "admin") {
    return <AdminSubscriptionView user={user} role={role} />;
  }
  return <InvestorSubscriptionView user={user} />;
}

// ============================================================================
// ADMIN VIEW: Tree Hierarchy + Billing Center + CRUD Management
// ============================================================================
function AdminSubscriptionView({ user, role }) {
  const [tab, setTab] = useState(role === "super_admin" ? "tree" : "billing");
  const [users, setUsers] = useState({});
  const [accountData, setAccountData] = useState({});
  const [invoices, setInvoices] = useState({});
  const [groupsData, setGroupsData] = useState({});
  const [loading, setLoading] = useState(true);

  // CRUD editing state
  const [editingVps, setEditingVps] = useState(null); // {uid, vpsKey}
  const [editingAccount, setEditingAccount] = useState(null); // {uid, vpsKey, accNum}
  const [editingUser, setEditingUser] = useState(null); // uid
  const [addingVpsForUser, setAddingVpsForUser] = useState(null); // uid
  const [addingAccForVps, setAddingAccForVps] = useState(null); // {uid, vpsKey}
  const [movingAccount, setMovingAccount] = useState(null); // {uid, sourceVpsKey, accNum}

  // Edit form states
  const [vpsEditForm, setVpsEditForm] = useState({ vpsName: "", monthlyCost: "", billingCycleDate: "", expiryDate: "", status: "active" });
  const [accEditForm, setAccEditForm] = useState({ profitShare: 30, botStartDate: "", account_flag: "green" });
  const [userEditForm, setUserEditForm] = useState({ fullName: "", email: "", telegramId: "" });
  const [newVpsForm, setNewVpsForm] = useState({ vpsName: "", monthlyCost: "", billingCycleDate: "", expiryDate: "" });
  const [newAccForm, setNewAccForm] = useState({ accountNumber: "", profitShare: 30, botStartDate: new Date().toISOString().split("T")[0], account_flag: "green" });

  const [adminManagedUids, setAdminManagedUids] = useState(role === "super_admin" ? null : undefined);

  // ── Admin scope ──
  useEffect(() => {
    if (role === "super_admin") return;
    if (!user) return;
    const unsub = onValue(ref(db, `users/${user.uid}/managed_groups`), (snap) => {
      const managed = snap.exists() ? snap.val() : {};
      const allowedGroupIds = Object.keys(managed).filter(k => managed[k]);
      if (allowedGroupIds.length === 0) { setAdminManagedUids(new Set()); return; }
      const unsubG = onValue(ref(db, "groups"), (gSnap) => {
        const allG = gSnap.exists() ? gSnap.val() : {};
        const allowedUids = new Set();
        allowedGroupIds.forEach(gid => {
          const g = allG[gid];
          if (g?.members) Object.keys(g.members).forEach(uid => allowedUids.add(uid));
        });
        const unsubU = onValue(ref(db, "users"), (uSnap) => {
          const allU = uSnap.exists() ? uSnap.val() : {};
          const finalUids = new Set(allowedUids);
          Object.entries(allU).forEach(([uid, uData]) => {
            if (uData.subscriptions) {
              Object.values(uData.subscriptions).forEach(vps => {
                Object.keys(vps.accounts || {}).forEach(accNum => {
                  allowedGroupIds.forEach(gid => { if (allG[gid]?.accounts?.[accNum]) finalUids.add(uid); });
                });
              });
            }
          });
          setAdminManagedUids(finalUids);
        });
        unsubs.push(unsubU);
      });
      unsubs.push(unsubG);
    });
    const unsubs = [];
    return () => unsubs.forEach(u => u());
  }, [user, role]);

  useEffect(() => {
    const unsub = onValue(ref(db, "users"), (snap) => { setUsers(snap.exists() ? snap.val() : {}); setLoading(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, "account_data"), (snap) => { setAccountData(snap.exists() ? snap.val() : {}); });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, "invoices"), (snap) => { setInvoices(snap.exists() ? snap.val() : {}); });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, "groups"), (snap) => { setGroupsData(snap.exists() ? snap.val() : {}); });
    return () => unsub();
  }, []);

  // ── Build tree data ──
  const treeData = useMemo(() => {
    const result = [];
    Object.entries(users).forEach(([uid, userData]) => {
      if (adminManagedUids && !adminManagedUids.has(uid)) return;
      if (!userData.subscriptions) return;
      const vpsList = [];
      Object.entries(userData.subscriptions).forEach(([vpsKey, vpsData]) => {
        const accounts = [];
        Object.entries(vpsData.accounts || {}).forEach(([accNum, accInfo]) => {
          const accFullData = accountData[accNum] || {};
          const profitShare = accInfo.profit_share || accInfo.profit_share_percent || 30;
          const balance = getAccountBalance(accFullData);
          const profitSummary = computeAccountProfitSummary(accFullData.snapshots || null, profitShare, invoices, accNum);
          accounts.push({
            accNum, profitShare, balance,
            status: accFullData.metadata?.status || accFullData.status || "unknown",
            botStartDate: accInfo.bot_start_date || accFullData.metadata?.bot_start_date || null,
            vpsName: accFullData.metadata?.vps_name || vpsData.vps_name || null,
            totalProfit: profitSummary.totalProfit, totalLots: profitSummary.totalLots,
            totalTradingDays: profitSummary.totalTradingDays, totalFee: profitSummary.totalFee,
            totalPaid: profitSummary.totalPaid, totalPending: profitSummary.totalPending,
            totalUnpaid: profitSummary.totalUnpaid, monthlyBreakdown: profitSummary.monthlyBreakdown,
          });
        });
        vpsList.push({
          vpsKey, vpsName: vpsData.vps_name || vpsKey,
          billingDate: vpsData.billing_cycle_date || "N/A",
          nextBillingDate: vpsData.next_billing_date || null,
          monthlyCost: vpsData.vps_monthly_cost || 0,
          expiryDate: vpsData.expiry_date || null,
          status: vpsData.status || "active",
          accounts: accounts.sort((a, b) => a.accNum.localeCompare(b.accNum)),
        });
      });
      if (vpsList.length > 0 || userData.role === "investor") {
        result.push({
          uid, fullName: userData.fullName || uid, email: userData.email || "",
          telegramId: userData.telegramId || "", role: userData.role || "investor",
          setupStatus: userData.setup_status || "unknown",
          vpsList: vpsList.sort((a, b) => a.vpsKey.localeCompare(b.vpsKey)),
        });
      }
    });
    return result.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [users, accountData, invoices, adminManagedUids]);

  // ── CRUD HANDLERS ──
  const handleAddVps = async (uid) => {
    if (!newVpsForm.vpsName.trim()) { toast.error("VPS name required"); return; }
    if (!newVpsForm.monthlyCost) { toast.error("Monthly cost required"); return; }
    try {
      const vpsKey = `${toSafeKey(newVpsForm.vpsName)}_${Date.now().toString(36)}`;
      await set(ref(db, `users/${uid}/subscriptions/${vpsKey}`), {
        vps_name: newVpsForm.vpsName.trim(),
        vps_monthly_cost: Number(newVpsForm.monthlyCost),
        billing_cycle_date: newVpsForm.billingCycleDate || new Date().toISOString().split("T")[0],
        next_billing_date: newVpsForm.billingCycleDate || new Date().toISOString().split("T")[0],
        expiry_date: newVpsForm.expiryDate || null,
        status: "active",
        accounts: {},
      });
      toast.success(`VPS "${newVpsForm.vpsName}" added`);
      setNewVpsForm({ vpsName: "", monthlyCost: "", billingCycleDate: "", expiryDate: "" });
      setAddingVpsForUser(null);
    } catch (e) { toast.error("Failed to add VPS: " + e.message); }
  };

  const handleUpdateVps = async (uid, vpsKey) => {
    try {
      const updates = {
        vps_name: vpsEditForm.vpsName,
        vps_monthly_cost: Number(vpsEditForm.monthlyCost),
        billing_cycle_date: vpsEditForm.billingCycleDate,
        expiry_date: vpsEditForm.expiryDate || null,
        status: vpsEditForm.status,
      };
      await update(ref(db, `users/${uid}/subscriptions/${vpsKey}`), updates);
      toast.success("VPS updated");
      setEditingVps(null);
    } catch (e) { toast.error("Failed to update VPS: " + e.message); }
  };

  const handleDeleteVps = async (uid, vpsKey, vpsName) => {
    if (!confirm(`Delete VPS "${vpsName}" and all its accounts? This cannot be undone.`)) return;
    try {
      // Remove owned_accounts references
      const vpsData = users[uid]?.subscriptions?.[vpsKey];
      if (vpsData?.accounts) {
        const updates = {};
        Object.keys(vpsData.accounts).forEach(acc => { updates[`users/${uid}/owned_accounts/${acc}`] = null; });
        if (Object.keys(updates).length > 0) await update(ref(db, `users/${uid}`), updates);
      }
      await remove(ref(db, `users/${uid}/subscriptions/${vpsKey}`));
      toast.success(`VPS "${vpsName}" deleted`);
    } catch (e) { toast.error("Failed to delete VPS: " + e.message); }
  };

  const handleAddAccount = async (uid, vpsKey) => {
    if (!newAccForm.accountNumber.trim()) { toast.error("Account number required"); return; }
    try {
      const accNum = newAccForm.accountNumber.trim();
      const userData = users[uid] || {};
      const vpsData = userData.subscriptions?.[vpsKey] || {};
      
      await set(ref(db, `users/${uid}/subscriptions/${vpsKey}/accounts/${accNum}`), {
        profit_share_percent: Number(newAccForm.profitShare),
        bot_start_date: newAccForm.botStartDate,
        last_invoiced_date: null,
        account_flag: newAccForm.account_flag,
      });
      await set(ref(db, `users/${uid}/owned_accounts/${accNum}`), true);
      
      // Trigger Telegram notification
      try {
        await fetch("/api/telegram/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trigger: "new_account_added",
            payload: {
              investor_name: userData.fullName || uid,
              investor_email: userData.email || "",
              telegram_id: userData.telegramId || "",
              account_flag: newAccForm.account_flag,
              account_number: accNum,
              vps_name: vpsData.vps_name || vpsKey,
              profit_share_percent: Number(newAccForm.profitShare),
            },
          }),
        });
      } catch (notifyErr) {
        console.warn("Telegram notify failed:", notifyErr);
      }
      
      toast.success(`Account ${accNum} added`);
      setNewAccForm({ accountNumber: "", profitShare: 30, botStartDate: new Date().toISOString().split("T")[0], account_flag: "green" });
      setAddingAccForVps(null);
    } catch (e) { toast.error("Failed to add account: " + e.message); }
  };

  const handleUpdateAccount = async (uid, vpsKey, accNum) => {
    try {
      await update(ref(db, `users/${uid}/subscriptions/${vpsKey}/accounts/${accNum}`), {
        profit_share_percent: Number(accEditForm.profitShare),
        bot_start_date: accEditForm.botStartDate,
        account_flag: accEditForm.account_flag,
      });
      toast.success(`Account ${accNum} updated`);
      setEditingAccount(null);
    } catch (e) { toast.error("Failed to update account: " + e.message); }
  };

  const handleDeleteAccount = async (uid, vpsKey, accNum) => {
    if (!confirm(`Remove account ${accNum} from this VPS?`)) return;
    try {
      await remove(ref(db, `users/${uid}/subscriptions/${vpsKey}/accounts/${accNum}`));
      await remove(ref(db, `users/${uid}/owned_accounts/${accNum}`));
      toast.success(`Account ${accNum} removed`);
    } catch (e) { toast.error("Failed to delete account: " + e.message); }
  };

  const handleMoveAccount = async (uid, sourceVpsKey, accNum, targetVpsKey) => {
    if (sourceVpsKey === targetVpsKey) { toast.info("Source and target are the same"); return; }
    try {
      const accData = users[uid]?.subscriptions?.[sourceVpsKey]?.accounts?.[accNum];
      if (!accData) { toast.error("Account data not found"); return; }
      await set(ref(db, `users/${uid}/subscriptions/${targetVpsKey}/accounts/${accNum}`), accData);
      await remove(ref(db, `users/${uid}/subscriptions/${sourceVpsKey}/accounts/${accNum}`));
      toast.success(`Account ${accNum} moved`);
      setMovingAccount(null);
    } catch (e) { toast.error("Failed to move account: " + e.message); }
  };

  const startEditVps = (uid, vpsKey, vpsData) => {
    setEditingVps({ uid, vpsKey });
    setVpsEditForm({
      vpsName: vpsData.vpsName || "",
      monthlyCost: vpsData.monthlyCost || "",
      billingCycleDate: vpsData.billingDate || "",
      expiryDate: vpsData.expiryDate || "",
      status: vpsData.status || "active",
    });
  };

  const startEditAccount = (uid, vpsKey, acc) => {
    setEditingAccount({ uid, vpsKey, accNum: acc.accNum });
    const accData = users[uid]?.subscriptions?.[vpsKey]?.accounts?.[acc.accNum] || {};
    setAccEditForm({
      profitShare: acc.profitShare || 30,
      botStartDate: acc.botStartDate || "",
      account_flag: accData.account_flag || "green",
    });
  };

  const startEditUser = (uid, userData) => {
    setEditingUser(uid);
    setUserEditForm({
      fullName: userData.fullName || "",
      email: userData.email || "",
      telegramId: userData.telegramId || "",
    });
  };

  const handleUpdateUser = async (uid) => {
    try {
      const updates = {
        fullName: userEditForm.fullName.trim(),
        email: userEditForm.email.trim(),
        telegramId: userEditForm.telegramId.trim(),
      };
      await update(ref(db, `users/${uid}`), updates);
      toast.success("User info updated");
      setEditingUser(null);
    } catch (e) { toast.error("Failed to update user: " + e.message); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* HEADER */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8">
        <div className="flex items-center gap-5">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 text-purple-400 shadow-inner">
            <Shield size={36} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">Subscription Area</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Manage user subscriptions, VPS, EA accounts & profit sharing.</p>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          {role === "super_admin" && (
            <button onClick={() => setTab("tree")} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === "tree" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>
              <Eye size={16} className="inline mr-2" />Tree View
            </button>
          )}
          <button onClick={() => setTab("billing")} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === "billing" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25" : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>
            <CreditCard size={16} className="inline mr-2" />Billing Center
          </button>
        </div>
      </div>

      {tab === "tree" && role === "super_admin" ? (
        <TreeViewHierarchy
          data={treeData} invoices={invoices} role={role}
          editingVps={editingVps} setEditingVps={setEditingVps}
          editingAccount={editingAccount} setEditingAccount={setEditingAccount}
          editingUser={editingUser} setEditingUser={setEditingUser}
          addingVpsForUser={addingVpsForUser} setAddingVpsForUser={setAddingVpsForUser}
          addingAccForVps={addingAccForVps} setAddingAccForVps={setAddingAccForVps}
          movingAccount={movingAccount} setMovingAccount={setMovingAccount}
          vpsEditForm={vpsEditForm} setVpsEditForm={setVpsEditForm}
          accEditForm={accEditForm} setAccEditForm={setAccEditForm}
          userEditForm={userEditForm} setUserEditForm={setUserEditForm}
          newVpsForm={newVpsForm} setNewVpsForm={setNewVpsForm}
          newAccForm={newAccForm} setNewAccForm={setNewAccForm}
          onSaveVps={handleUpdateVps} onDeleteVps={handleDeleteVps} onAddVps={handleAddVps}
          onSaveAccount={handleUpdateAccount} onDeleteAccount={handleDeleteAccount} onAddAccount={handleAddAccount}
          onSaveUser={handleUpdateUser} onStartEditUser={startEditUser}
          onMoveAccount={handleMoveAccount} onStartEditVps={startEditVps} onStartEditAccount={startEditAccount}
        />
      ) : (
        <BillingCenterView users={users} accountData={accountData} invoices={invoices} role={role} />
      )}
    </div>
  );
}

// ============================================================================
// TREE VIEW HIERARCHY
// ============================================================================
function TreeViewHierarchy({ data, invoices, role, ...props }) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 space-y-3">
      <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2">
        <Users size={20} className="text-purple-400" />User &rarr; VPS &rarr; EA Account Hierarchy
      </h2>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">Click to expand. Edit VPS/Account details inline. Shows balance, profit sharing & monthly billing.</p>

      {data.length === 0 && (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500" />
          <p className="text-sm">No investor subscriptions found.</p>
        </div>
      )}

      <div className="space-y-2">
        {data.map((userNode) => (
          <TreeNode key={userNode.uid} node={userNode} depth={0} invoices={invoices} role={role} {...props} />
        ))}
      </div>
    </div>
  );
}

// ── User Node ──
function TreeNode({ node, depth, invoices, role, ...props }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.vpsList && node.vpsList.length > 0;

  const userTotals = useMemo(() => {
    let totalProfit = 0, totalFee = 0, totalUnpaid = 0, totalPaid = 0, accountCount = 0;
    (node.vpsList || []).forEach((vps) => {
      (vps.accounts || []).forEach((acc) => {
        totalProfit += acc.totalProfit || 0; totalFee += acc.totalFee || 0;
        totalUnpaid += acc.totalUnpaid || 0; totalPaid += acc.totalPaid || 0; accountCount++;
      });
    });
    return { totalProfit, totalFee, totalUnpaid, totalPaid, accountCount };
  }, [node.vpsList]);

  if (depth !== 0) return null;

  return (
    <div className="border border-[var(--card-border)] rounded-2xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 hover:bg-[var(--muted)]/30 transition-colors text-left">
        {hasChildren ? (expanded ? <ChevronDown size={18} className="text-blue-400" /> : <ChevronRight size={18} className="text-blue-400" />) : <div className="w-[18px]" />}
        <Users size={18} className="text-blue-400" />
        <div className="flex-1 min-w-0">
          <span className="font-bold text-[var(--foreground)] text-sm">{node.fullName}</span>
          <span className="ml-2 text-[10px] text-[var(--muted-foreground)]">({node.email})</span>
        </div>
        <div className="hidden md:flex items-center gap-2 mr-2">
          {userTotals.totalUnpaid > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold flex items-center gap-1">
              <Receipt size={10} />Unpaid: ${userTotals.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          )}
          {userTotals.totalProfit > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
              Profit: ${userTotals.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${node.setupStatus === "completed" ? "bg-emerald-500/10 text-emerald-400" : node.setupStatus === "pending_setup" ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"}`}>{node.setupStatus || "unknown"}</span>
        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold">{node.role}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); props.onStartEditUser(node.uid, node); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); props.onStartEditUser(node.uid, node); } }}
          className="p-1.5 text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
          title="Edit User Info"
        >
          <Edit3 size={13} />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--card-border)] bg-[var(--background)]/30 p-3 space-y-2">
          {/* User Edit Form */}
          {props.editingUser === node.uid && (
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">Edit User Info: {node.fullName}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Full Name</label>
                  <input type="text" value={props.userEditForm.fullName} onChange={(e) => props.setUserEditForm(p => ({ ...p, fullName: e.target.value }))} className="w-full bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Email</label>
                  <input type="email" value={props.userEditForm.email} onChange={(e) => props.setUserEditForm(p => ({ ...p, email: e.target.value }))} className="w-full bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Telegram ID</label>
                  <input type="text" value={props.userEditForm.telegramId} onChange={(e) => props.setUserEditForm(p => ({ ...p, telegramId: e.target.value }))} className="w-full bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500" placeholder="Telegram Chat ID" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => props.setEditingUser(null)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg">Cancel</button>
                <button onClick={() => props.onSaveUser(node.uid)} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg flex items-center gap-1"><Save size={12} /> Save</button>
              </div>
            </div>
          )}

          {node.vpsList.map((vps) => (
            <VpsTreeNode key={vps.vpsKey} vps={vps} uid={node.uid} depth={1} invoices={invoices} role={role} allVpsList={node.vpsList} {...props} />
          ))}

          {/* Add VPS Button */}
          {props.addingVpsForUser === node.uid ? (
            <div className="ml-6 p-4 bg-emerald-500/5 border border-emerald-500/30 rounded-xl space-y-3">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1"><Server size={12} /> New VPS</p>
              <input type="text" placeholder="VPS Name (e.g. KRX-VPS-01)" value={props.newVpsForm.vpsName} onChange={(e) => props.setNewVpsForm(p => ({ ...p, vpsName: e.target.value }))} className="w-full bg-[var(--background)] border border-emerald-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500" autoFocus />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Monthly Cost ($)</label>
                  <div className="relative"><DollarSign size={12} className="absolute left-2.5 top-2 text-[var(--muted-foreground)]" /><input type="number" placeholder="0" value={props.newVpsForm.monthlyCost} onChange={(e) => props.setNewVpsForm(p => ({ ...p, monthlyCost: e.target.value }))} className="w-full bg-[var(--background)] border border-emerald-500/30 text-[var(--foreground)] text-xs rounded-lg pl-7 pr-2 py-2 outline-none focus:ring-1 focus:ring-emerald-500" /></div>
                </div>
                <div>
                  <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Billing Date</label>
                  <div className="relative"><Calendar size={12} className="absolute left-2.5 top-2 text-[var(--muted-foreground)]" /><input type="date" value={props.newVpsForm.billingCycleDate} onChange={(e) => props.setNewVpsForm(p => ({ ...p, billingCycleDate: e.target.value }))} className="w-full bg-[var(--background)] border border-emerald-500/30 text-[var(--foreground)] text-xs rounded-lg pl-7 pr-2 py-2 outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]" /></div>
                </div>
                <div>
                  <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Expiry Date</label>
                  <div className="relative"><Clock size={12} className="absolute left-2.5 top-2 text-[var(--muted-foreground)]" /><input type="date" value={props.newVpsForm.expiryDate} onChange={(e) => props.setNewVpsForm(p => ({ ...p, expiryDate: e.target.value }))} className="w-full bg-[var(--background)] border border-emerald-500/30 text-[var(--foreground)] text-xs rounded-lg pl-7 pr-2 py-2 outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]" /></div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { props.setAddingVpsForUser(null); props.setNewVpsForm({ vpsName: "", monthlyCost: "", billingCycleDate: "", expiryDate: "" }); }} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg">Cancel</button>
                <button type="button" onClick={() => props.onAddVps(node.uid)} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg flex items-center gap-1"><Save size={12} /> Add VPS</button>
              </div>
            </div>
          ) : (
            <button onClick={() => props.setAddingVpsForUser(node.uid)} className="ml-6 flex items-center gap-2 px-4 py-2 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-xl transition-all">
              <Plus size={14} /> Add VPS
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── VPS Node ──
function VpsTreeNode({ vps, uid, depth, invoices, role, allVpsList, ...props }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = vps.accounts && vps.accounts.length > 0;
  const isEditing = props.editingVps?.uid === uid && props.editingVps?.vpsKey === vps.vpsKey;

  // Check expiry
  const isExpired = vps.expiryDate && new Date(vps.expiryDate) < new Date();
  const daysUntilExpiry = vps.expiryDate ? Math.ceil((new Date(vps.expiryDate) - new Date()) / 86400000) : null;

  return (
    <div className="ml-6 border border-[var(--card-border)] rounded-xl overflow-hidden">
      {/* VPS Header */}
      <div className="flex items-center gap-2 p-3 hover:bg-[var(--muted)]/20 transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="flex-shrink-0">
          {expanded ? <ChevronDown size={16} className="text-cyan-400" /> : <ChevronRight size={16} className="text-cyan-400" />}
        </button>
        <Server size={16} className="text-cyan-400 flex-shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="font-bold text-sm text-[var(--foreground)]">{vps.vpsName}</span>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-bold">${vps.monthlyCost}/mo</span>
            <span className="text-[var(--muted-foreground)]">Billing: {vps.billingDate}</span>
            {vps.expiryDate && (
              <span className={`px-2 py-0.5 rounded-full font-bold ${isExpired ? "bg-red-500/10 text-red-400" : daysUntilExpiry <= 7 ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"}`}>
                {isExpired ? "EXPIRED" : `Exp: ${vps.expiryDate}`}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full font-bold ${vps.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>{vps.status}</span>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold">{vps.accounts.length} acc</span>
        {/* VPS Action Buttons */}
        <div className="flex items-center gap-1">
          <button onClick={() => props.onStartEditVps(uid, vps.vpsKey, vps)} className="p-1.5 text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit VPS"><Edit3 size={13} /></button>
          <button onClick={() => props.onDeleteVps(uid, vps.vpsKey, vps.vpsName)} className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete VPS"><Trash2 size={13} /></button>
        </div>
      </div>

      {/* VPS Edit Form */}
      {isEditing && (
        <div className="px-4 py-3 bg-blue-500/5 border-t border-blue-500/20 space-y-3">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1"><Settings size={12} /> Edit VPS: {vps.vpsName}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">VPS Name</label>
              <input type="text" value={props.vpsEditForm.vpsName} onChange={(e) => props.setVpsEditForm(p => ({ ...p, vpsName: e.target.value }))} className="w-full bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Monthly Cost ($)</label>
              <input type="number" value={props.vpsEditForm.monthlyCost} onChange={(e) => props.setVpsEditForm(p => ({ ...p, monthlyCost: e.target.value }))} className="w-full bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Billing Date</label>
              <input type="date" value={props.vpsEditForm.billingCycleDate} onChange={(e) => props.setVpsEditForm(p => ({ ...p, billingCycleDate: e.target.value }))} className="w-full bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Expiry Date</label>
              <input type="date" value={props.vpsEditForm.expiryDate} onChange={(e) => props.setVpsEditForm(p => ({ ...p, expiryDate: e.target.value }))} className="w-full bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[9px] text-[var(--muted-foreground)] uppercase">Status:</label>
            <select value={props.vpsEditForm.status} onChange={(e) => props.setVpsEditForm(p => ({ ...p, status: e.target.value }))} className="bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-1.5 outline-none">
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => props.setEditingVps(null)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg">Cancel</button>
            <button onClick={() => props.onSaveVps(uid, vps.vpsKey)} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg flex items-center gap-1"><Save size={12} /> Save Changes</button>
          </div>
        </div>
      )}

      {/* Expanded: Account List */}
      {expanded && (
        <div className="border-t border-[var(--card-border)] bg-[var(--background)]/20 p-2 space-y-2">
          {vps.accounts.map((acc) => (
            <AccountNode key={acc.accNum} acc={acc} uid={uid} vpsKey={vps.vpsKey} allVpsList={allVpsList} invoices={invoices} {...props} />
          ))}
          {vps.accounts.length === 0 && (
            <p className="ml-8 text-[10px] text-[var(--muted-foreground)] py-2">No EA accounts assigned to this VPS.</p>
          )}

          {/* Add Account */}
          {props.addingAccForVps?.uid === uid && props.addingAccForVps?.vpsKey === vps.vpsKey ? (
            <div className="ml-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">Add EA Account to {vps.vpsName}</p>
              <div className="grid grid-cols-4 gap-2">
                <input type="text" placeholder="Account #" value={props.newAccForm.accountNumber} onChange={(e) => props.setNewAccForm(p => ({ ...p, accountNumber: e.target.value }))} className="bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-blue-500" autoFocus />
                <div className="relative"><Percent size={10} className="absolute left-2 top-2.5 text-blue-400" /><input type="number" min="0" max="100" placeholder="30" value={props.newAccForm.profitShare} onChange={(e) => props.setNewAccForm(p => ({ ...p, profitShare: e.target.value }))} className="w-full bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg pl-6 pr-2 py-2 outline-none focus:ring-1 focus:ring-blue-500" /></div>
                <input type="date" value={props.newAccForm.botStartDate} onChange={(e) => props.setNewAccForm(p => ({ ...p, botStartDate: e.target.value }))} className="bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]" />
                <select value={props.newAccForm.account_flag} onChange={(e) => props.setNewAccForm(p => ({ ...p, account_flag: e.target.value }))} className="bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="green">🟢 Investor</option>
                  <option value="yellow">🟡 Admin</option>
                  <option value="red">🔴 Tester</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { props.setAddingAccForVps(null); props.setNewAccForm({ accountNumber: "", profitShare: 30, botStartDate: new Date().toISOString().split("T")[0], account_flag: "green" }); }} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancel</button>
                <button onClick={() => props.onAddAccount(uid, vps.vpsKey)} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg flex items-center gap-1"><Save size={10} /> Add</button>
              </div>
            </div>
          ) : (
            <button onClick={() => props.setAddingAccForVps({ uid, vpsKey: vps.vpsKey })} className="ml-4 flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 rounded-lg transition-all">
              <Plus size={12} /> Add EA Account
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Account Node ──
function AccountNode({ acc, uid, vpsKey, allVpsList, invoices, ...props }) {
  const [showMonthly, setShowMonthly] = useState(false);
  const hasMonthlyData = acc.monthlyBreakdown && acc.monthlyBreakdown.length > 0;
  const isEditing = props.editingAccount?.uid === uid && props.editingAccount?.vpsKey === vpsKey && props.editingAccount?.accNum === acc.accNum;
  const isMoving = props.movingAccount?.uid === uid && props.movingAccount?.sourceVpsKey === vpsKey && props.movingAccount?.accNum === acc.accNum;
  const [targetVps, setTargetVps] = useState("");

  const otherVpsList = (allVpsList || []).filter(v => v.vpsKey !== vpsKey);

  return (
    <div className="ml-4 border border-[var(--card-border)]/50 rounded-xl overflow-hidden bg-[var(--card-bg)]/30">
      {/* Account Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Cpu size={14} className="text-emerald-400 flex-shrink-0" />
          <span className="font-mono font-bold text-sm text-[var(--foreground)]">{acc.accNum}</span>
          {acc.vpsName && <span className="text-[9px] text-[var(--muted-foreground)] px-1.5 py-0.5 bg-[var(--muted)]/50 rounded">{acc.vpsName}</span>}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${acc.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>{acc.status}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold"><Wallet size={10} />Bal: ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold"><Percent size={10} />{acc.profitShare}%</span>
          {acc.totalProfit > 0 && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold"><TrendingUp size={10} />Profit: ${acc.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
          {acc.totalUnpaid > 0 && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold"><Receipt size={10} />Unpaid: ${acc.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
          {acc.totalFee > 0 && acc.totalUnpaid === 0 && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold"><Check size={10} />All Paid</span>}
          {/* Action buttons */}
          <button onClick={() => props.onStartEditAccount(uid, vpsKey, acc)} className="p-1 text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors" title="Edit Account"><Edit3 size={12} /></button>
          {otherVpsList.length > 0 && (
            <button onClick={() => setMovingAccount ? props.setMovingAccount({ uid, sourceVpsKey: vpsKey, accNum: acc.accNum }) : null} className="p-1 text-cyan-400/60 hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors" title="Move to another VPS"><ArrowRightLeft size={12} /></button>
          )}
          <button onClick={() => props.onDeleteAccount(uid, vpsKey, acc.accNum)} className="p-1 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Remove Account"><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Account Edit Form */}
      {isEditing && (
        <div className="px-3 py-3 bg-purple-500/5 border-t border-purple-500/20 space-y-2">
          <p className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">Edit Account: {acc.accNum}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Profit Share %</label>
              <div className="relative"><Percent size={10} className="absolute left-2 top-2 text-purple-400" /><input type="number" min="0" max="100" value={props.accEditForm.profitShare} onChange={(e) => props.setAccEditForm(p => ({ ...p, profitShare: Number(e.target.value) }))} className="w-full bg-[var(--background)] border border-purple-500/30 text-[var(--foreground)] text-xs rounded-lg pl-6 pr-2 py-2 outline-none focus:ring-1 focus:ring-purple-500" /></div>
            </div>
            <div>
              <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Bot Start Date</label>
              <input type="date" value={props.accEditForm.botStartDate} onChange={(e) => props.setAccEditForm(p => ({ ...p, botStartDate: e.target.value }))} className="w-full bg-[var(--background)] border border-purple-500/30 text-[var(--foreground)] text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-purple-500 [color-scheme:dark]" />
            </div>
          </div>
          <div>
            <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Account Flag</label>
            <select value={props.accEditForm.account_flag} onChange={(e) => props.setAccEditForm(p => ({ ...p, account_flag: e.target.value }))} className="w-full bg-[var(--background)] border border-purple-500/30 text-[var(--foreground)] text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-purple-500">
              <option value="green">🟢 Green Flag (Public Investor)</option>
              <option value="yellow">🟡 Yellow Flag (Admin as Investor)</option>
              <option value="red">🔴 Red Flag (Tester Account)</option>
              <option value="black">⚫ Black Flag (Owner Account - Hidden)</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => props.setEditingAccount(null)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancel</button>
            <button onClick={() => props.onSaveAccount(uid, vpsKey, acc.accNum)} className="text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-lg flex items-center gap-1"><Save size={10} /> Save</button>
          </div>
        </div>
      )}

      {/* Move Account Form */}
      {isMoving && (
        <div className="px-3 py-3 bg-cyan-500/5 border-t border-cyan-500/20 space-y-2">
          <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1"><ArrowRightLeft size={10} /> Move {acc.accNum} to another VPS</p>
          <div className="flex items-center gap-2">
            <select value={targetVps} onChange={(e) => setTargetVps(e.target.value)} className="flex-1 bg-[var(--background)] border border-cyan-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none">
              <option value="">Select target VPS...</option>
              {otherVpsList.map(v => <option key={v.vpsKey} value={v.vpsKey}>{v.vpsName}</option>)}
            </select>
            <button onClick={() => { if (targetVps) props.onMoveAccount(uid, vpsKey, acc.accNum, targetVps); else toast.error("Select target VPS"); }} disabled={!targetVps} className="text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-lg disabled:opacity-40">Move</button>
            <button onClick={() => { props.setMovingAccount(null); setTargetVps(""); }} className="text-xs text-slate-400 hover:text-white px-2 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Monthly Billing Dropdown */}
      {hasMonthlyData && (
        <>
          <button onClick={() => setShowMonthly(!showMonthly)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 transition-colors border-t border-[var(--card-border)]/30">
            {showMonthly ? <ChevronUp size={12} /> : <ChevronDown size={12} />}<Calendar size={10} />
            Monthly Billing Summary ({acc.monthlyBreakdown.length} months)
            <span className="ml-auto">Fee Owed: <span className="text-purple-400">${acc.totalFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>{acc.totalPaid > 0 && <span className="ml-2 text-emerald-400">Paid: ${acc.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}</span>
          </button>

          {showMonthly && (
            <div className="px-3 pb-3">
              <div className="overflow-x-auto rounded-lg border border-[var(--card-border)]/50">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[var(--muted)]/30 text-[var(--muted-foreground)] uppercase tracking-wider">
                      <th className="text-left py-2 px-2 font-bold">Month</th>
                      <th className="text-right py-2 px-2 font-bold">Days</th>
                      <th className="text-right py-2 px-2 font-bold">Lots</th>
                      <th className="text-right py-2 px-2 font-bold">Profit</th>
                      <th className="text-right py-2 px-2 font-bold">Fee ({acc.profitShare}%)</th>
                      <th className="text-right py-2 px-2 font-bold">Paid</th>
                      <th className="text-center py-2 px-2 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acc.monthlyBreakdown.map((month) => {
                      let statusColor = "bg-slate-500/10 text-slate-400", statusLabel = "No Fee";
                      if (month.feeShare > 0) {
                        if (month.unpaidAmount <= 0) { statusColor = "bg-emerald-500/10 text-emerald-400"; statusLabel = "Paid"; }
                        else if (month.pendingAmount > 0) { statusColor = "bg-amber-500/10 text-amber-400"; statusLabel = "Pending"; }
                        else { statusColor = "bg-red-500/10 text-red-400"; statusLabel = "Unpaid"; }
                      }
                      return (
                        <tr key={month.month} className="border-t border-[var(--card-border)]/30 hover:bg-[var(--muted)]/10 transition-colors">
                          <td className="py-1.5 px-2 font-bold text-[var(--foreground)]">{month.label}</td>
                          <td className="py-1.5 px-2 text-right text-[var(--muted-foreground)]">{month.tradingDays}</td>
                          <td className="py-1.5 px-2 text-right text-blue-400 font-bold">{month.totalLots.toFixed(1)}L</td>
                          <td className={`py-1.5 px-2 text-right font-bold ${month.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{month.totalProfit >= 0 ? "+" : ""}${month.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-1.5 px-2 text-right text-purple-400 font-bold">${month.feeShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-1.5 px-2 text-right text-emerald-400 font-bold">${month.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-1.5 px-2 text-center"><span className={`px-2 py-0.5 rounded-full font-bold ${statusColor}`}>{statusLabel}</span></td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-[var(--card-border)] bg-[var(--muted)]/20 font-black">
                      <td className="py-2 px-2 text-[var(--foreground)]">TOTAL</td>
                      <td className="py-2 px-2 text-right text-[var(--muted-foreground)]">{acc.totalTradingDays}</td>
                      <td className="py-2 px-2 text-right text-blue-400">{acc.totalLots.toFixed(1)}L</td>
                      <td className={`py-2 px-2 text-right ${acc.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{acc.totalProfit >= 0 ? "+" : ""}${acc.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-2 text-right text-purple-400">${acc.totalFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-2 text-right text-emerald-400">${acc.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-2 text-center">{acc.totalUnpaid > 0 ? <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold">${acc.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} due</span> : acc.totalFee > 0 ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">Cleared</span> : <span className="text-slate-400">&mdash;</span>}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!hasMonthlyData && !isEditing && !isMoving && (
        <div className="px-3 pb-2 text-[9px] text-[var(--muted-foreground)] italic">No trading history available yet.</div>
      )}
    </div>
  );
}

// ============================================================================
// BILLING CENTER (unchanged from original)
// ============================================================================
function BillingCenterView({ users, accountData, invoices, role }) {
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [profitShare, setProfitShare] = useState(50);
  const [showManualInvoice, setShowManualInvoice] = useState(false);
  const [invoiceType, setInvoiceType] = useState("vps");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Enhanced invoice generation states
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editInvoiceAmount, setEditInvoiceAmount] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(null);
  const [receiptHtml, setReceiptHtml] = useState("");

  const userList = useMemo(() => {
    return Object.entries(users).filter(([, d]) => d.role === "investor" || d.subscriptions).map(([uid, d]) => ({ uid, fullName: d.fullName || uid, email: d.email || "" })).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [users]);

  const userAccounts = useMemo(() => {
    if (!selectedUser || !users[selectedUser]?.subscriptions) return [];
    const accs = [];
    Object.entries(users[selectedUser].subscriptions).forEach(([, vpsData]) => {
      Object.entries(vpsData.accounts || {}).forEach(([accNum, accInfo]) => {
        const accFullData = accountData[accNum] || {};
        const share = accInfo.profit_share || accInfo.profit_share_percent || 30;
        const balance = getAccountBalance(accFullData);
        const summary = computeAccountProfitSummary(accFullData.snapshots || null, share, invoices, accNum);
        accs.push({ accNum, profitShare: share, balance, totalProfit: summary.totalProfit, totalFee: summary.totalFee, totalPaid: summary.totalPaid, totalUnpaid: summary.totalUnpaid, monthlyBreakdown: summary.monthlyBreakdown });
      });
    });
    return accs.sort((a, b) => a.accNum.localeCompare(b.accNum));
  }, [selectedUser, users, accountData, invoices]);

  const filteredInvoices = useMemo(() => {
    const invList = [];
    Object.entries(invoices).forEach(([invId, inv]) => {
      if (!selectedUser || inv.uid === selectedUser || inv.user_id === selectedUser) invList.push({ id: invId, ...inv });
    });
    return invList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [invoices, selectedUser]);

  const selectedAccDetail = useMemo(() => {
    if (!selectedAccount) return null;
    return userAccounts.find((a) => a.accNum === selectedAccount) || null;
  }, [selectedAccount, userAccounts]);

  const handleSaveProfitShare = async () => {
    if (!selectedUser || !selectedAccount) { toast.error("Select user and account first"); return; }
    setSaving(true);
    try {
      const userData = users[selectedUser];
      if (userData?.subscriptions) {
        const updates = {};
        Object.entries(userData.subscriptions).forEach(([vpsKey, vpsData]) => {
          if (vpsData.accounts?.[selectedAccount]) {
            updates[`users/${selectedUser}/subscriptions/${vpsKey}/accounts/${selectedAccount}/profit_share`] = profitShare;
            updates[`users/${selectedUser}/subscriptions/${vpsKey}/accounts/${selectedAccount}/profit_share_percent`] = profitShare;
          }
        });
        await Promise.all(Object.entries(updates).map(([path, value]) => set(ref(db, path), value)));
      }
      toast.success(`Profit share updated to ${profitShare}%`);
    } catch (e) { toast.error("Failed to update profit share"); } finally { setSaving(false); }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedUser || !invoiceAmount) { toast.error("Fill all fields"); return; }
    setSaving(true);
    try {
      const invId = `INV-${Date.now().toString(36).toUpperCase()}`;
      const userData = users[selectedUser];
      await set(ref(db, `invoices/${invId}`), {
        id: invId, uid: selectedUser, user_id: selectedUser,
        user_name: userData?.fullName || selectedUser, telegram_id: userData?.telegramId || "",
        type: invoiceType,
        account_number: invoiceType === "profit_share" ? selectedAccount : null,
        accountNumber: invoiceType === "profit_share" ? selectedAccount : null,
        amount: parseFloat(invoiceAmount), status: "pending",
        created_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 86400000).toISOString(), paid_at: null,
      });
      toast.success(`Invoice ${invId} generated`);
      setShowManualInvoice(false); setInvoiceAmount("");
    } catch (e) { toast.error("Failed to generate invoice"); } finally { setSaving(false); }
  };

  const handleMarkPaid = async (invId) => {
    try {
      await set(ref(db, `invoices/${invId}/status`), "paid");
      await set(ref(db, `invoices/${invId}/paid_at`), new Date().toISOString());
      toast.success("Invoice marked as paid");
    } catch (e) { toast.error("Failed to update invoice"); }
  };

  // Enhanced CRUD functions for invoices
  const handleGenerateInvoiceWithPeriod = async () => {
    if (!selectedUser || !invoiceAmount) { toast.error("Fill all fields"); return; }
    if (invoiceType === "profit_share" && (!periodStartDate || !periodEndDate)) { toast.error("Select period start and end dates"); return; }
    
    setSaving(true);
    try {
      const invId = generateInvoiceId(invoiceType);
      const userData = users[selectedUser];
      
      const invoiceData = {
        id: invId,
        uid: selectedUser,
        user_id: selectedUser,
        user_name: userData?.fullName || selectedUser,
        telegram_id: userData?.telegramId || "",
        type: invoiceType,
        account_number: invoiceType === "profit_share" ? selectedAccount : null,
        accountNumber: invoiceType === "profit_share" ? selectedAccount : null,
        amount: parseFloat(invoiceAmount),
        status: "pending",
        created_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        paid_at: null,
      };

      // Add period dates for profit share invoices
      if (invoiceType === "profit_share" && periodStartDate && periodEndDate) {
        invoiceData.period_start = periodStartDate;
        invoiceData.period_end = periodEndDate;
        invoiceData.description = `Profit Share ${periodStartDate} to ${periodEndDate}`;
      }

      await set(ref(db, `invoices/${invId}`), invoiceData);
      toast.success(`Invoice ${invId} generated`);
      setShowManualInvoice(false);
      setInvoiceAmount("");
      setPeriodStartDate("");
      setPeriodEndDate("");
    } catch (e) { 
      toast.error("Failed to generate invoice"); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleEditInvoice = async (invId) => {
    if (!editInvoiceAmount || isNaN(editInvoiceAmount)) { 
      toast.error("Enter a valid amount"); 
      return; 
    }
    
    setSaving(true);
    try {
      await update(ref(db, `invoices/${invId}`), {
        amount: parseFloat(editInvoiceAmount),
        updated_at: new Date().toISOString(),
      });
      toast.success("Invoice updated");
      setEditingInvoice(null);
      setEditInvoiceAmount("");
    } catch (e) { 
      toast.error("Failed to update invoice"); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleDeleteInvoice = async (invId, invStatus) => {
    if (invStatus === "paid") {
      toast.error("Cannot delete paid invoices");
      return;
    }
    
    if (!confirm(`Are you sure you want to delete invoice ${invId}? This cannot be undone.`)) return;
    
    try {
      await remove(ref(db, `invoices/${invId}`));
      toast.success(`Invoice ${invId} deleted`);
    } catch (e) { 
      toast.error("Failed to delete invoice"); 
    }
  };

  const handleGenerateReceipt = (invoice) => {
    const userData = users[selectedUser];
    const receiptData = {
      invoice,
      user: {
        fullName: userData?.fullName || invoice.user_name,
        email: userData?.email || "",
        telegramId: userData?.telegramId || invoice.telegram_id,
      },
      account: invoice.account_number || invoice.accountNumber,
      accountData: accountData[invoice.account_number || invoice.accountNumber] || {},
    };

    const html = generateReceiptHTML(receiptData);
    setReceiptHtml(html);
    setShowReceiptModal(invoice);
  };

  const handleForwardToTelegram = (invoice) => {
    const userData = users[selectedUser];
    const telegramMessage = generateTelegramMessage({
      invoice,
      user: {
        fullName: userData?.fullName || invoice.user_name,
        telegramId: userData?.telegramId || invoice.telegram_id,
      },
      account: invoice.account_number || invoice.accountNumber,
    });

    // Open Telegram with pre-filled message
    const telegramUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?text=${encodeURIComponent(telegramMessage)}`;
    window.open(telegramUrl, "_blank");
    toast.success("Opening Telegram...");
  };

  const handleDownloadReceipt = (invoice) => {
    const userData = users[selectedUser];
    const receiptData = {
      invoice,
      user: {
        fullName: userData?.fullName || invoice.user_name,
        email: userData?.email || "",
        telegramId: userData?.telegramId || invoice.telegram_id,
      },
      account: invoice.account_number || invoice.accountNumber,
      accountData: accountData[invoice.account_number || invoice.accountNumber] || {},
    };

    const html = generateReceiptHTML(receiptData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt_${invoice.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  };

  const startEditInvoice = (invoice) => {
    setEditingInvoice(invoice.id);
    setEditInvoiceAmount(invoice.amount.toString());
  };

  return (
    <div className="space-y-6">
      {selectedUser && userAccounts.length > 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6">
          <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2 mb-4"><TrendingUp size={20} className="text-emerald-400" /> Profit & Fee Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {(() => {
              const tp = userAccounts.reduce((s, a) => s + a.totalProfit, 0);
              const tf = userAccounts.reduce((s, a) => s + a.totalFee, 0);
              const tpaid = userAccounts.reduce((s, a) => s + a.totalPaid, 0);
              const tu = userAccounts.reduce((s, a) => s + a.totalUnpaid, 0);
              return (<>
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4"><div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">Total Profit</div><div className="text-lg font-black text-emerald-400 mt-1">${tp.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4"><div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">Total Fee Owed</div><div className="text-lg font-black text-purple-400 mt-1">${tf.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4"><div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">Total Paid</div><div className="text-lg font-black text-blue-400 mt-1">${tpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4"><div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">Total Unpaid</div><div className="text-lg font-black text-amber-400 mt-1">${tu.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
              </>);
            })()}
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">View Monthly Detail</label>
            <select value={selectedAccount} onChange={(e) => { setSelectedAccount(e.target.value); const acc = userAccounts.find((a) => a.accNum === e.target.value); if (acc) setProfitShare(acc.profitShare); }} className="w-full md:w-80 bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]">
              <option value="">Select Account</option>
              {userAccounts.map((acc) => (<option key={acc.accNum} value={acc.accNum}>{acc.accNum} &mdash; Bal: ${acc.balance.toLocaleString()} | Profit: ${acc.totalProfit.toLocaleString()} | Fee: ${acc.totalFee.toLocaleString()}</option>))}
            </select>
          </div>
          {selectedAccDetail && selectedAccDetail.monthlyBreakdown.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-[var(--card-border)]">
              <table className="w-full text-xs">
                <thead><tr className="bg-[var(--muted)]/30 text-[var(--muted-foreground)] text-[10px] uppercase tracking-wider"><th className="text-left py-2.5 px-3 font-bold">Month</th><th className="text-right py-2.5 px-3 font-bold">Days</th><th className="text-right py-2.5 px-3 font-bold">Lots</th><th className="text-right py-2.5 px-3 font-bold">Profit</th><th className="text-right py-2.5 px-3 font-bold">Fee ({selectedAccDetail.profitShare}%)</th><th className="text-right py-2.5 px-3 font-bold">Paid</th><th className="text-center py-2.5 px-3 font-bold">Status</th><th className="text-center py-2.5 px-3 font-bold">Action</th></tr></thead>
                <tbody>
                  {selectedAccDetail.monthlyBreakdown.map((month) => {
                    let sc = "bg-slate-500/10 text-slate-400", sl = "No Fee";
                    if (month.feeShare > 0) { if (month.unpaidAmount <= 0) { sc = "bg-emerald-500/10 text-emerald-400"; sl = "Paid"; } else if (month.pendingAmount > 0) { sc = "bg-amber-500/10 text-amber-400"; sl = "Pending"; } else { sc = "bg-red-500/10 text-red-400"; sl = "Unpaid"; } }
                    return (<tr key={month.month} className="border-t border-[var(--card-border)]/50 hover:bg-[var(--muted)]/10"><td className="py-2 px-3 font-bold">{month.label}</td><td className="py-2 px-3 text-right text-[var(--muted-foreground)]">{month.tradingDays}</td><td className="py-2 px-3 text-right text-blue-400 font-bold">{month.totalLots.toFixed(1)}L</td><td className={`py-2 px-3 text-right font-bold ${month.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>${month.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="py-2 px-3 text-right text-purple-400 font-bold">${month.feeShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="py-2 px-3 text-right text-emerald-400 font-bold">${month.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="py-2 px-3 text-center"><span className={`px-2 py-0.5 rounded-full font-bold ${sc}`}>{sl}</span></td><td className="py-2 px-3 text-center">{month.unpaidAmount > 0 && (<button onClick={async () => { const invId = `ps_${selectedAccDetail.accNum}_${month.month.replace("-", "")}_manual`; const userData = users[selectedUser]; try { await set(ref(db, `invoices/${invId}`), { type: "profit_share", accountNumber: selectedAccDetail.accNum, account_number: selectedAccDetail.accNum, uid: selectedUser, user_id: selectedUser, user_name: userData?.fullName || selectedUser, amount: month.unpaidAmount, status: "pending", description: `Profit Share ${month.label}`, period_start: `${month.month}-01`, due_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0], total_profit: month.totalProfit, share_percentage: selectedAccDetail.profitShare, created_at: new Date().toISOString() }); toast.success(`Invoice generated for ${month.label}`); } catch (e) { toast.error("Failed to generate invoice"); } }} className="px-2 py-0.5 bg-purple-600 text-white text-[9px] font-bold rounded-lg hover:bg-purple-500 transition-all">Invoice</button>)}</td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          )}
          {selectedAccDetail && selectedAccDetail.monthlyBreakdown.length === 0 && <div className="text-center py-6 text-[var(--muted-foreground)] text-sm">No trading history available for this account yet.</div>}
        </div>
      )}

      {/* Invoice Management */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2"><FileText size={20} className="text-purple-400" /> Invoices</h2>
          {role === "super_admin" && <button onClick={() => setShowManualInvoice(!showManualInvoice)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-500 transition-all"><Plus size={16} /> Manual Invoice</button>}
        </div>
        {showManualInvoice && (
          <div className="mb-6 p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-purple-400">Generate Manual Invoice</h3>
            <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]">
              <option value="vps">VPS Invoice</option>
              <option value="profit_share">Profit Share Invoice</option>
            </select>
            {invoiceType === "profit_share" && (
              <>
                <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]">
                  <option value="">Select Account</option>
                  {userAccounts.map((acc) => (<option key={acc.accNum} value={acc.accNum}>{acc.accNum} ({acc.profitShare}%)</option>))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase block mb-1">Period Start</label>
                    <input type="date" value={periodStartDate} onChange={(e) => setPeriodStartDate(e.target.value)} className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase block mb-1">Period End</label>
                    <input type="date" value={periodEndDate} onChange={(e) => setPeriodEndDate(e.target.value)} className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]" />
                  </div>
                </div>
              </>
            )}
            <input type="number" placeholder="Amount (USD)" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]" />
            <button onClick={handleGenerateInvoiceWithPeriod} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-500 transition-all disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Generate Invoice
            </button>
          </div>
        )}
        <div className="mb-4">
          <select value={selectedUser} onChange={(e) => { setSelectedUser(e.target.value); setSelectedAccount(""); }} className="w-full md:w-80 bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"><option value="">All Users</option>{userList.map((u) => (<option key={u.uid} value={u.uid}>{u.fullName} ({u.email})</option>))}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--card-border)] text-[var(--muted-foreground)] text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-2">Invoice #</th><th className="text-left py-3 px-2">User</th><th className="text-left py-3 px-2">Type</th><th className="text-left py-3 px-2">Account</th><th className="text-right py-3 px-2">Amount</th><th className="text-center py-3 px-2">Status</th><th className="text-right py-3 px-2">Date</th><th className="text-center py-3 px-2">Actions</th></tr></thead>
            <tbody>
              {filteredInvoices.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-[var(--muted-foreground)] text-sm">No invoices found.</td></tr>}
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-[var(--card-border)]/50 hover:bg-[var(--muted)]/20 transition-colors">
                  <td className="py-3 px-2 font-mono font-bold text-xs">{inv.id}</td>
                  <td className="py-3 px-2 text-xs">{inv.user_name || "\u2014"}</td>
                  <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inv.type === "vps" || inv.type === "vps_rental" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>{inv.type === "vps" || inv.type === "vps_rental" ? "VPS" : "Profit"}</span></td>
                  <td className="py-3 px-2 font-mono text-xs">{inv.account_number || inv.accountNumber || "\u2014"}</td>
                  <td className="py-3 px-2 text-right font-bold text-xs">
                    {editingInvoice === inv.id ? (
                      <input type="number" value={editInvoiceAmount} onChange={(e) => setEditInvoiceAmount(e.target.value)} className="w-20 bg-[var(--background)] border border-purple-500/30 rounded px-2 py-1 text-right" />
                    ) : (
                      `$${Number(inv.amount).toLocaleString()}`
                    )}
                  </td>
                  <td className="py-3 px-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inv.status === "paid" ? "bg-emerald-500/10 text-emerald-400" : inv.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>{inv.status}</span></td>
                  <td className="py-3 px-2 text-right text-[10px] text-[var(--muted-foreground)]">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "\u2014"}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center justify-center gap-1">
                      {inv.status === "pending" && (
                        <>
                          {editingInvoice === inv.id ? (
                            <>
                              <button onClick={() => handleEditInvoice(inv.id)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded" title="Save"><Save size={12} /></button>
                              <button onClick={() => { setEditingInvoice(null); setEditInvoiceAmount(""); }} className="p-1 text-slate-400 hover:bg-slate-500/10 rounded" title="Cancel"><X size={12} /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleMarkPaid(inv.id)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded" title="Mark Paid"><Check size={12} /></button>
                              <button onClick={() => startEditInvoice(inv)} className="p-1 text-blue-400 hover:bg-blue-500/10 rounded" title="Edit Amount"><Edit3 size={12} /></button>
                              <button onClick={() => handleDeleteInvoice(inv.id, inv.status)} className="p-1 text-red-400 hover:bg-red-500/10 rounded" title="Delete"><Trash2 size={12} /></button>
                            </>
                          )}
                        </>
                      )}
                      {/* Receipt Actions - Available for all statuses */}
                      <button onClick={() => handleGenerateReceipt(inv)} className="p-1 text-purple-400 hover:bg-purple-500/10 rounded" title="Preview Receipt"><Receipt size={12} /></button>
                      <button onClick={() => handleDownloadReceipt(inv)} className="p-1 text-cyan-400 hover:bg-cyan-500/10 rounded" title="Download Receipt"><Download size={12} /></button>
                      <button onClick={() => handleForwardToTelegram(inv)} className="p-1 text-[#2AABEE] hover:bg-[#2AABEE]/10 rounded" title="Forward to Telegram"><Send size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Receipt Modal */}
        <ReceiptModal 
          isOpen={showReceiptModal !== null}
          onClose={() => setShowReceiptModal(null)}
          invoice={showReceiptModal}
          userData={selectedUser ? users[selectedUser] : null}
          accountData={showReceiptModal ? accountData[showReceiptModal.account_number || showReceiptModal.accountNumber] || {} : {}}
        />
      </div>

      {/* Profit Share Management */}
      {selectedUser && userAccounts.length > 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6">
          <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2 mb-4"><Percent size={20} className="text-purple-400" /> Profit Share Settings</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">Account</label>
              <select value={selectedAccount} onChange={(e) => { setSelectedAccount(e.target.value); const acc = userAccounts.find((a) => a.accNum === e.target.value); if (acc) setProfitShare(acc.profitShare); }} className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"><option value="">Select Account</option>{userAccounts.map((acc) => (<option key={acc.accNum} value={acc.accNum}>{acc.accNum} (Current: {acc.profitShare}%)</option>))}</select>
            </div>
            <div className="w-32">
              <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">Profit Share %</label>
              <input type="number" min="0" max="100" value={profitShare} onChange={(e) => setProfitShare(Number(e.target.value))} className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] text-center" />
            </div>
            <button onClick={handleSaveProfitShare} disabled={saving || !selectedAccount} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INVESTOR VIEW (unchanged from original)
// ============================================================================
function InvestorSubscriptionView({ user }) {
  const [invoices, setInvoices] = useState({});
  const [userData, setUserData] = useState(null);
  const [accountData, setAccountData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => { setUserData(snap.exists() ? snap.val() : null); }); return () => unsub(); }, [user]);
  useEffect(() => { const unsub = onValue(ref(db, "invoices"), (snap) => { setInvoices(snap.exists() ? snap.val() : {}); setLoading(false); }); return () => unsub(); }, []);
  useEffect(() => { const unsub = onValue(ref(db, "account_data"), (snap) => { setAccountData(snap.exists() ? snap.val() : {}); }); return () => unsub(); }, []);

  const investorAccounts = useMemo(() => {
    if (!userData?.subscriptions) return [];
    const accs = [];
    Object.entries(userData.subscriptions).forEach(([, vpsData]) => {
      Object.entries(vpsData.accounts || {}).forEach(([accNum, accInfo]) => {
        const accFullData = accountData[accNum] || {};
        const share = accInfo.profit_share || accInfo.profit_share_percent || 30;
        const balance = getAccountBalance(accFullData);
        const summary = computeAccountProfitSummary(accFullData.snapshots || null, share, invoices, accNum);
        accs.push({ accNum, profitShare: share, balance, totalProfit: summary.totalProfit, totalFee: summary.totalFee, totalPaid: summary.totalPaid, totalUnpaid: summary.totalUnpaid, monthlyBreakdown: summary.monthlyBreakdown, vpsName: accFullData.metadata?.vps_name || vpsData.vps_name || null, botStartDate: accInfo.bot_start_date || accFullData.metadata?.bot_start_date || null });
      });
    });
    return accs.sort((a, b) => a.accNum.localeCompare(b.accNum));
  }, [userData, accountData, invoices]);

  const myInvoices = useMemo(() => {
    const invList = [];
    Object.entries(invoices).forEach(([invId, inv]) => { if (inv.uid === user.uid || inv.user_id === user.uid) invList.push({ id: invId, ...inv }); });
    return invList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [invoices, user.uid]);

  const investorTotals = useMemo(() => {
    return { totalProfit: investorAccounts.reduce((s, a) => s + a.totalProfit, 0), totalFee: investorAccounts.reduce((s, a) => s + a.totalFee, 0), totalPaid: investorAccounts.reduce((s, a) => s + a.totalPaid, 0), totalUnpaid: investorAccounts.reduce((s, a) => s + a.totalUnpaid, 0) };
  }, [investorAccounts]);

  const buildTelegramUrl = (invoice) => {
    const message = encodeURIComponent(`[INVOICE PAYMENT]\n\nInvoice: ${invoice.id}\nName: ${invoice.user_name || userData?.fullName || "N/A"}\nAccount: ${invoice.account_number || invoice.accountNumber || "N/A"}\nType: ${invoice.type === "vps" || invoice.type === "vps_rental" ? "VPS Billing" : "Profit Share"}\nAmount: $${Number(invoice.amount).toLocaleString()}\nDue: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A"}\n\nPlease confirm payment. Thank you.`);
    return `tg://msg?text=${message}`;
  };

  const handleInvoiceClick = (invoice) => {
    const url = buildTelegramUrl(invoice);
    const webUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?text=${encodeURIComponent(`[INVOICE PAYMENT]\nInvoice: ${invoice.id}\nAccount: ${invoice.account_number || invoice.accountNumber || "N/A"}\nType: ${invoice.type}\nAmount: $${Number(invoice.amount).toLocaleString()}`)}`;
    try { window.open(url, "_blank"); } catch { window.open(webUrl, "_blank"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[var(--background)]"><Loader2 size={24} className="animate-spin text-blue-400" /></div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto font-sans">
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8">
        <div className="flex items-center gap-5">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 text-purple-400 shadow-inner"><CreditCard size={36} /></div>
          <div><h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">Subscription & Billing</h1><p className="text-sm text-[var(--muted-foreground)]">View your accounts, profit sharing & invoices.</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5"><div className="flex items-center gap-3 mb-2"><TrendingUp size={18} className="text-emerald-400" /></div><div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">Total Profit</div><div className="text-2xl font-black text-emerald-400">${investorTotals.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5"><div className="flex items-center gap-3 mb-2"><Percent size={18} className="text-purple-400" /></div><div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">Fee Owed</div><div className="text-2xl font-black text-purple-400">${investorTotals.totalFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5"><div className="flex items-center gap-3 mb-2"><DollarSign size={18} className="text-amber-400" /></div><div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">Unpaid Fee</div><div className="text-2xl font-black text-amber-400">${investorTotals.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5"><div className="flex items-center gap-3 mb-2"><Check size={18} className="text-blue-400" /></div><div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">Paid Invoices</div><div className="text-2xl font-black text-blue-400">{myInvoices.filter((i) => i.status === "paid").length}</div></div>
      </div>

      {investorAccounts.length > 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6">
          <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2 mb-4"><Cpu size={20} className="text-emerald-400" /> My Accounts</h2>
          <div className="space-y-3">
            {investorAccounts.map((acc) => (
              <div key={acc.accNum} className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--background)]/30">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1"><Cpu size={16} className="text-emerald-400" /><span className="font-mono font-bold text-[var(--foreground)]">{acc.accNum}</span>{acc.vpsName && <span className="text-[10px] text-[var(--muted-foreground)] px-2 py-0.5 bg-[var(--muted)]/50 rounded">{acc.vpsName}</span>}{acc.botStartDate && <span className="text-[10px] text-purple-400 px-2 py-0.5 bg-purple-500/10 rounded">Since: {new Date(acc.botStartDate).toLocaleDateString()}</span>}</div>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">Bal: ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">Profit: ${acc.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">Fee ({acc.profitShare}%): ${acc.totalFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {acc.totalUnpaid > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">Unpaid: ${acc.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                    {acc.totalFee > 0 && acc.totalUnpaid === 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">All Paid</span>}
                  </div>
                </div>
                {acc.monthlyBreakdown.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead><tr className="text-[var(--muted-foreground)] uppercase tracking-wider border-b border-[var(--card-border)]/30"><th className="text-left py-1.5 px-2 font-bold">Month</th><th className="text-right py-1.5 px-2 font-bold">Profit</th><th className="text-right py-1.5 px-2 font-bold">Fee</th><th className="text-center py-1.5 px-2 font-bold">Status</th></tr></thead>
                      <tbody>
                        {acc.monthlyBreakdown.map((m) => {
                          let sc = "text-slate-400", sl = "No Fee";
                          if (m.feeShare > 0) { if (m.unpaidAmount <= 0) { sc = "text-emerald-400"; sl = "Paid"; } else if (m.pendingAmount > 0) { sc = "text-amber-400"; sl = "Pending"; } else { sc = "text-red-400"; sl = "Unpaid"; } }
                          return (<tr key={m.month} className="border-b border-[var(--card-border)]/20"><td className="py-1.5 px-2 font-bold">{m.label}</td><td className={`py-1.5 px-2 text-right font-bold ${m.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>${m.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="py-1.5 px-2 text-right text-purple-400 font-bold">${m.feeShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className={`py-1.5 px-2 text-center font-bold ${sc}`}>{sl}</td></tr>);
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6">
        <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2 mb-4"><FileText size={20} className="text-purple-400" /> My Invoices</h2>
        {myInvoices.length === 0 && <div className="text-center py-12 text-[var(--muted-foreground)]"><AlertTriangle size={32} className="mx-auto mb-2 text-slate-600" /><p className="text-sm">No invoices found. You are all clear!</p></div>}
        <div className="space-y-3">
          {myInvoices.map((inv) => (
            <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-[var(--background)]/50 border border-[var(--card-border)] rounded-2xl hover:border-purple-500/30 transition-all group cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-[var(--foreground)]">{inv.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inv.type === "vps" || inv.type === "vps_rental" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>{inv.type === "vps" || inv.type === "vps_rental" ? "VPS" : "Profit Share"}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inv.status === "paid" ? "bg-emerald-500/10 text-emerald-400" : inv.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>{inv.status}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-[10px] text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1"><Calendar size={10} />{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "\u2014"}</span>
                  <span className="flex items-center gap-1"><Clock size={10} />Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "\u2014"}</span>
                  {(inv.account_number || inv.accountNumber) && <span className="font-mono">Acc: {inv.account_number || inv.accountNumber}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-black text-[var(--foreground)]">${Number(inv.amount).toLocaleString()}</span>
                {inv.status === "pending" && <button onClick={() => handleInvoiceClick(inv)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-600/25 whitespace-nowrap"><Send size={14} /> Pay via Telegram</button>}
              </div>
            </div>
          ))}
        </div>
        {myInvoices.filter((i) => i.status === "pending").length > 0 && (
          <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-400 flex items-start gap-2"><span>Tip:</span><span>{"Click \"Pay via Telegram\" to open a pre-filled message to our admin bot. The bot will guide you through payment confirmation."}</span></div>
        )}
      </div>
    </div>
  );
}