"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../../lib/firebase";
import { ref, onValue, set, serverTimestamp } from "firebase/database";
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
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// SUBSCRIPTION AREA — Unified Page for All Roles
//   - super_admin / admin: Tree View Hierarchy + Billing Center
//   - investor: Invoice list with Telegram URL Scheme
// ============================================================================

// ── Telegram Bot Username (from config) ──
const TELEGRAM_BOT_USERNAME = "KRXAdminBot"; // Disesuaikan dengan bot admin

export default function SubscriptionAreaPage() {
  const { user, role } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    );
  }

  // Admin / Super Admin view
  if (role === "super_admin" || role === "admin") {
    return <AdminSubscriptionView user={user} role={role} />;
  }

  // Investor view
  return <InvestorSubscriptionView user={user} />;
}

// ============================================================================
// ADMIN VIEW: Tree Hierarchy + Billing Center
// ============================================================================
function AdminSubscriptionView({ user, role }) {
  const [tab, setTab] = useState("tree"); // 'tree' | 'billing'
  const [users, setUsers] = useState({});
  const [accountData, setAccountData] = useState({});
  const [invoices, setInvoices] = useState({});
  const [groupsData, setGroupsData] = useState({});
  const [loading, setLoading] = useState(true);

  // Admin: load managed groups for scope
  const [adminManagedUids, setAdminManagedUids] = useState(null); // null = all (super_admin), Set = scoped (admin)

  useEffect(() => {
    if (role === "super_admin") {
      setAdminManagedUids(null); // no filter
      return;
    }
    if (!user) return;
    const unsub = onValue(ref(db, `users/${user.uid}/managed_groups`), (snap) => {
      const managed = snap.exists() ? snap.val() : {};
      const allowedGroupIds = Object.keys(managed).filter(k => managed[k]);
      if (allowedGroupIds.length === 0) {
        setAdminManagedUids(new Set()); // empty = no users visible
        return;
      }
      const unsubG = onValue(ref(db, "groups"), (gSnap) => {
        const allG = gSnap.exists() ? gSnap.val() : {};
        const allowedUids = new Set();
        allowedGroupIds.forEach(gid => {
          const g = allG[gid];
          if (g?.members) Object.keys(g.members).forEach(uid => allowedUids.add(uid));
        });
        // Also load users to cross-check
        const unsubU = onValue(ref(db, "users"), (uSnap) => {
          const allU = uSnap.exists() ? uSnap.val() : {};
          // Include users who are in managed groups OR have subscriptions with accounts in those groups
          const finalUids = new Set(allowedUids);
          Object.entries(allU).forEach(([uid, uData]) => {
            if (uData.subscriptions) {
              Object.values(uData.subscriptions).forEach(vps => {
                Object.keys(vps.accounts || {}).forEach(accNum => {
                  // Check if this account belongs to any managed group
                  allowedGroupIds.forEach(gid => {
                    if (allG[gid]?.accounts?.[accNum]) finalUids.add(uid);
                  });
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

  // Load all users
  useEffect(() => {
    const unsub = onValue(ref(db, "users"), (snap) => {
      setUsers(snap.exists() ? snap.val() : {});
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load account_data
  useEffect(() => {
    const unsub = onValue(ref(db, "account_data"), (snap) => {
      setAccountData(snap.exists() ? snap.val() : {});
    });
    return () => unsub();
  }, []);

  // Load invoices
  useEffect(() => {
    const unsub = onValue(ref(db, "invoices"), (snap) => {
      setInvoices(snap.exists() ? snap.val() : {});
    });
    return () => unsub();
  }, []);

  // Load groups (for admin scope)
  useEffect(() => {
    const unsub = onValue(ref(db, "groups"), (snap) => {
      setGroupsData(snap.exists() ? snap.val() : {});
    });
    return () => unsub();
  }, []);

  // Build tree data from user subscriptions (scoped for admin)
  const treeData = useMemo(() => {
    const result = [];
    Object.entries(users).forEach(([uid, userData]) => {
      // Admin scope check
      if (adminManagedUids !== null && !adminManagedUids.has(uid)) return;
      
      if (!userData.subscriptions) return;
      const vpsList = [];
      Object.entries(userData.subscriptions).forEach(([vpsKey, vpsData]) => {
        const accounts = [];
        Object.entries(vpsData.accounts || {}).forEach(([accNum, accInfo]) => {
          accounts.push({
            accNum,
            profitShare: accInfo.profit_share || 0,
            balance: accountData[accNum]?.balance || 0,
            status: accountData[accNum]?.status || "unknown",
          });
        });
        vpsList.push({
          vpsKey,
          vpsName: vpsData.vps_name || vpsKey,
          billingDate: vpsData.billing_cycle_date || "N/A",
          accounts: accounts.sort((a, b) => a.accNum.localeCompare(b.accNum)),
        });
      });
      if (vpsList.length > 0 || userData.role === "investor") {
        result.push({
          uid,
          fullName: userData.fullName || uid,
          email: userData.email || "",
          telegramId: userData.telegramId || "",
          role: userData.role || "investor",
          setupStatus: userData.setup_status || "unknown",
          vpsList: vpsList.sort((a, b) => a.vpsKey.localeCompare(b.vpsKey)),
        });
      }
    });
    return result.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [users, accountData, adminManagedUids]);

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
            <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">
              Subscription Area
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Manage user subscriptions, invoices & profit sharing.
            </p>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setTab("tree")}
            className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${
              tab === "tree"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Eye size={16} className="inline mr-2" />
            Tree View
          </button>
          <button
            onClick={() => setTab("billing")}
            className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${
              tab === "billing"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <CreditCard size={16} className="inline mr-2" />
            Billing Center
          </button>
        </div>
      </div>

      {/* CONTENT */}
      {tab === "tree" ? (
        <TreeViewHierarchy data={treeData} />
      ) : (
        <BillingCenterView
          users={users}
          accountData={accountData}
          invoices={invoices}
          role={role}
        />
      )}
    </div>
  );
}

// ── Tree View Hierarchy Component ──
function TreeViewHierarchy({ data }) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 space-y-3">
      <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2">
        <Users size={20} className="text-purple-400" />
        User → VPS → EA Account Hierarchy
      </h2>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">
        Click to expand each node. Shows profit share % per account.
      </p>

      {data.length === 0 && (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500" />
          <p className="text-sm">No investor subscriptions found.</p>
        </div>
      )}

      <div className="space-y-2">
        {data.map((userNode) => (
          <TreeNode key={userNode.uid} node={userNode} depth={0} />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ node, depth }) {
  const [expanded, setExpanded] = useState(depth < 1); // auto-expand root
  const hasChildren = node.vpsList && node.vpsList.length > 0;

  if (depth === 0) {
    // USER level
    return (
      <div className="border border-[var(--card-border)] rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-4 hover:bg-[var(--muted)]/30 transition-colors text-left"
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={18} className="text-blue-400" /> : <ChevronRight size={18} className="text-blue-400" />
          ) : (
            <div className="w-[18px]" />
          )}
          <Users size={18} className="text-blue-400" />
          <div className="flex-1">
            <span className="font-bold text-[var(--foreground)] text-sm">
              {node.fullName}
            </span>
            <span className="ml-2 text-[10px] text-[var(--muted-foreground)]">
              ({node.email})
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            node.setupStatus === "completed" ? "bg-emerald-500/10 text-emerald-400" :
            node.setupStatus === "pending_setup" ? "bg-amber-500/10 text-amber-400" :
            "bg-slate-500/10 text-slate-400"
          }`}>
            {node.setupStatus || "unknown"}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold">
            {node.role}
          </span>
        </button>

        {expanded && hasChildren && (
          <div className="border-t border-[var(--card-border)] bg-[var(--background)]/30 p-3 space-y-2">
            {node.vpsList.map((vps) => (
              <VpsTreeNode key={vps.vpsKey} vps={vps} depth={1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

function VpsTreeNode({ vps, depth }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = vps.accounts && vps.accounts.length > 0;

  return (
    <div className="ml-6 border border-[var(--card-border)] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-[var(--muted)]/20 transition-colors text-left"
      >
        {expanded ? <ChevronDown size={16} className="text-cyan-400" /> : <ChevronRight size={16} className="text-cyan-400" />}
        <Server size={16} className="text-cyan-400" />
        <span className="font-bold text-sm text-[var(--foreground)]">{vps.vpsName}</span>
        <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">
          Billing: {vps.billingDate}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold">
          {vps.accounts.length} accounts
        </span>
      </button>

      {expanded && hasChildren && (
        <div className="border-t border-[var(--card-border)] bg-[var(--background)]/20 p-2 space-y-1">
          {vps.accounts.map((acc) => (
            <div
              key={acc.accNum}
              className="ml-8 flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--card-bg)]/50 border border-[var(--card-border)]/50"
            >
              <Cpu size={14} className="text-emerald-400" />
              <span className="font-mono font-bold text-sm text-[var(--foreground)]">
                {acc.accNum}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                Bal: ${Number(acc.balance).toLocaleString()}
              </span>
              <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold">
                <Percent size={10} />
                {acc.profitShare}%
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                acc.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
              }`}>
                {acc.status}
              </span>
            </div>
          ))}
          {vps.accounts.length === 0 && (
            <p className="ml-8 text-[10px] text-[var(--muted-foreground)] py-2">
              No EA accounts assigned to this VPS.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Billing Center (Admin) ──
function BillingCenterView({ users, accountData, invoices, role }) {
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [profitShare, setProfitShare] = useState(50);
  const [showManualInvoice, setShowManualInvoice] = useState(false);
  const [invoiceType, setInvoiceType] = useState("vps"); // 'vps' | 'profit_share'
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // User list for dropdown
  const userList = useMemo(() => {
    return Object.entries(users)
      .filter(([, d]) => d.role === "investor" || d.subscriptions)
      .map(([uid, d]) => ({ uid, fullName: d.fullName || uid, email: d.email || "" }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [users]);

  // Accounts for selected user
  const userAccounts = useMemo(() => {
    if (!selectedUser || !users[selectedUser]?.subscriptions) return [];
    const accs = [];
    Object.entries(users[selectedUser].subscriptions).forEach(([, vpsData]) => {
      Object.entries(vpsData.accounts || {}).forEach(([accNum, accInfo]) => {
        accs.push({ accNum, profitShare: accInfo.profit_share || 0 });
      });
    });
    return accs.sort((a, b) => a.accNum.localeCompare(b.accNum));
  }, [selectedUser, users]);

  // Invoice list
  const filteredInvoices = useMemo(() => {
    const invList = [];
    Object.entries(invoices).forEach(([invId, inv]) => {
      if (!selectedUser || inv.uid === selectedUser) {
        invList.push({ id: invId, ...inv });
      }
    });
    return invList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [invoices, selectedUser]);

  const handleSaveProfitShare = async () => {
    if (!selectedUser || !selectedAccount) {
      toast.error("Select user and account first");
      return;
    }
    setSaving(true);
    try {
      // Update in user subscriptions
      const userData = users[selectedUser];
      if (userData?.subscriptions) {
        const updates = {};
        Object.entries(userData.subscriptions).forEach(([vpsKey, vpsData]) => {
          if (vpsData.accounts?.[selectedAccount]) {
            updates[`users/${selectedUser}/subscriptions/${vpsKey}/accounts/${selectedAccount}/profit_share`] = profitShare;
          }
        });
        // Batch update
        const promises = Object.entries(updates).map(([path, value]) =>
          set(ref(db, path), value)
        );
        await Promise.all(promises);
      }
      toast.success(`Profit share updated to ${profitShare}%`);
    } catch (e) {
      toast.error("Failed to update profit share");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedUser || !invoiceAmount) {
      toast.error("Fill all fields");
      return;
    }
    setSaving(true);
    try {
      const invId = `INV-${Date.now().toString(36).toUpperCase()}`;
      const userData = users[selectedUser];
      const invoiceData = {
        id: invId,
        uid: selectedUser,
        user_name: userData?.fullName || selectedUser,
        telegram_id: userData?.telegramId || "",
        type: invoiceType,
        account_number: invoiceType === "profit_share" ? selectedAccount : null,
        amount: parseFloat(invoiceAmount),
        status: "pending",
        created_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        paid_at: null,
      };
      await set(ref(db, `invoices/${invId}`), invoiceData);
      toast.success(`Invoice ${invId} generated`);
      setShowManualInvoice(false);
      setInvoiceAmount("");
    } catch (e) {
      toast.error("Failed to generate invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Invoice Management */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2">
            <FileText size={20} className="text-purple-400" />
            Invoices
          </h2>
          {role === "super_admin" && (
            <button
              onClick={() => setShowManualInvoice(!showManualInvoice)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-500 transition-all"
            >
              <Plus size={16} />
              Manual Invoice
            </button>
          )}
        </div>

        {/* Manual Invoice Form */}
        {showManualInvoice && (
          <div className="mb-6 p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-purple-400">Generate Manual Invoice</h3>
            <select
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value)}
              className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
            >
              <option value="vps">VPS Invoice</option>
              <option value="profit_share">Profit Share Invoice</option>
            </select>
            {invoiceType === "profit_share" && (
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <option value="">Select Account</option>
                {userAccounts.map((acc) => (
                  <option key={acc.accNum} value={acc.accNum}>{acc.accNum} ({acc.profitShare}%)</option>
                ))}
              </select>
            )}
            <input
              type="number"
              placeholder="Amount (USD)"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
              className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
            />
            <button
              onClick={handleGenerateInvoice}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-500 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Generate
            </button>
          </div>
        )}

        {/* User filter */}
        <div className="mb-4">
          <select
            value={selectedUser}
            onChange={(e) => {
              setSelectedUser(e.target.value);
              setSelectedAccount("");
            }}
            className="w-full md:w-80 bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
          >
            <option value="">All Users</option>
            {userList.map((u) => (
              <option key={u.uid} value={u.uid}>{u.fullName} ({u.email})</option>
            ))}
          </select>
        </div>

        {/* Invoice Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] text-[var(--muted-foreground)] text-[10px] uppercase tracking-wider">
                <th className="text-left py-3 px-2">Invoice #</th>
                <th className="text-left py-3 px-2">User</th>
                <th className="text-left py-3 px-2">Type</th>
                <th className="text-left py-3 px-2">Account</th>
                <th className="text-right py-3 px-2">Amount</th>
                <th className="text-center py-3 px-2">Status</th>
                <th className="text-right py-3 px-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[var(--muted-foreground)] text-sm">
                    No invoices found.
                  </td>
                </tr>
              )}
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-[var(--card-border)]/50 hover:bg-[var(--muted)]/20 transition-colors">
                  <td className="py-3 px-2 font-mono font-bold text-xs">{inv.id}</td>
                  <td className="py-3 px-2 text-xs">{inv.user_name}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      inv.type === "vps" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                    }`}>
                      {inv.type === "vps" ? "VPS" : "Profit"}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-mono text-xs">{inv.account_number || "—"}</td>
                  <td className="py-3 px-2 text-right font-bold text-xs">
                    ${Number(inv.amount).toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      inv.status === "paid" ? "bg-emerald-500/10 text-emerald-400" :
                      inv.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right text-[10px] text-[var(--muted-foreground)]">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profit Share Management */}
      {selectedUser && userAccounts.length > 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6">
          <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2 mb-4">
            <Percent size={20} className="text-purple-400" />
            Profit Share Settings
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">
                Account
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => {
                  setSelectedAccount(e.target.value);
                  const acc = userAccounts.find((a) => a.accNum === e.target.value);
                  if (acc) setProfitShare(acc.profitShare);
                }}
                className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <option value="">Select Account</option>
                {userAccounts.map((acc) => (
                  <option key={acc.accNum} value={acc.accNum}>
                    {acc.accNum} (Current: {acc.profitShare}%)
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">
                Profit Share %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={profitShare}
                onChange={(e) => setProfitShare(Number(e.target.value))}
                className="w-full bg-[var(--muted)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] text-center"
              />
            </div>
            <button
              onClick={handleSaveProfitShare}
              disabled={saving || !selectedAccount}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INVESTOR VIEW: Invoice List + Telegram URL Scheme
// ============================================================================
function InvestorSubscriptionView({ user }) {
  const [invoices, setInvoices] = useState({});
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => {
      setUserData(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const unsub = onValue(ref(db, "invoices"), (snap) => {
      setInvoices(snap.exists() ? snap.val() : {});
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const myInvoices = useMemo(() => {
    const invList = [];
    Object.entries(invoices).forEach(([invId, inv]) => {
      if (inv.uid === user.uid) {
        invList.push({ id: invId, ...inv });
      }
    });
    return invList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [invoices, user.uid]);

  const totalPending = useMemo(() => {
    return myInvoices
      .filter((inv) => inv.status === "pending")
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
  }, [myInvoices]);

  // ── Build Telegram URL Scheme ──
  const buildTelegramUrl = (invoice) => {
    const botUsername = TELEGRAM_BOT_USERNAME;
    const message = encodeURIComponent(
      `[INVOICE PAYMENT]\n\n` +
      `📋 Invoice: ${invoice.id}\n` +
      `👤 Name: ${invoice.user_name || userData?.fullName || "N/A"}\n` +
      `🔢 Account: ${invoice.account_number || "N/A"}\n` +
      `📌 Type: ${invoice.type === "vps" ? "VPS Billing" : "Profit Share"}\n` +
      `💰 Amount: $${Number(invoice.amount).toLocaleString()}\n` +
      `📅 Due: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A"}\n\n` +
      `Please confirm payment. Thank you.`
    );
    return `tg://msg?text=${message}`;
  };

  // Fallback: open Telegram Web if URL scheme not available
  const handleInvoiceClick = (invoice) => {
    const url = buildTelegramUrl(invoice);
    // Try URL scheme first, fallback to web
    const webUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?text=${encodeURIComponent(
      `[INVOICE PAYMENT]\nInvoice: ${invoice.id}\nAccount: ${invoice.account_number || "N/A"}\nType: ${invoice.type}\nAmount: $${Number(invoice.amount).toLocaleString()}`
    )}`;

    try {
      window.open(url, "_blank");
    } catch {
      window.open(webUrl, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto font-sans">
      {/* HEADER */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8">
        <div className="flex items-center gap-5">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 text-purple-400 shadow-inner">
            <CreditCard size={36} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">
              Subscription & Billing
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              View your invoices. Tap to forward payment confirmation to admin.
            </p>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <FileText size={18} className="text-blue-400" />
          </div>
          <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">
            Total Invoices
          </div>
          <div className="text-2xl font-black text-[var(--foreground)]">
            {myInvoices.length}
          </div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign size={18} className="text-amber-400" />
          </div>
          <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">
            Pending Total
          </div>
          <div className="text-2xl font-black text-amber-400">
            ${totalPending.toLocaleString()}
          </div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Check size={18} className="text-emerald-400" />
          </div>
          <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase mb-1">
            Paid
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {myInvoices.filter((i) => i.status === "paid").length}
          </div>
        </div>
      </div>

      {/* INVOICE LIST */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6">
        <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2 mb-4">
          <FileText size={20} className="text-purple-400" />
          My Invoices
        </h2>

        {myInvoices.length === 0 && (
          <div className="text-center py-12 text-[var(--muted-foreground)]">
            <AlertTriangle size={32} className="mx-auto mb-2 text-slate-600" />
            <p className="text-sm">No invoices found. You're all clear!</p>
          </div>
        )}

        <div className="space-y-3">
          {myInvoices.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-[var(--background)]/50 border border-[var(--card-border)] rounded-2xl hover:border-purple-500/30 transition-all group cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-[var(--foreground)]">
                    {inv.id}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    inv.type === "vps"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-purple-500/10 text-purple-400"
                  }`}>
                    {inv.type === "vps" ? "VPS" : "Profit Share"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    inv.status === "paid"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : inv.status === "pending"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-red-500/10 text-red-400"
                  }`}>
                    {inv.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-[10px] text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <Calendar size={10} />
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                  </span>
                  {inv.account_number && (
                    <span className="font-mono">Acc: {inv.account_number}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-black text-[var(--foreground)]">
                  ${Number(inv.amount).toLocaleString()}
                </span>
                {inv.status === "pending" && (
                  <button
                    onClick={() => handleInvoiceClick(inv)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-600/25 whitespace-nowrap"
                  >
                    <Send size={14} />
                    Pay via Telegram
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* TIP */}
        {myInvoices.filter((i) => i.status === "pending").length > 0 && (
          <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-400 flex items-start gap-2">
            <span>💡</span>
            <span>
              Click <strong>"Pay via Telegram"</strong> to open a pre-filled message to our admin bot.
              The bot will guide you through payment confirmation.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}