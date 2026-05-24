"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db, firebaseConfig } from "../../lib/firebase";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, set, onValue, remove } from "firebase/database";
import {
  UserPlus, ShieldCheck, Trash2, Mail, Lock, Settings, X, Database, AlertCircle,
  Server, Cpu, Plus, Percent, Calendar, DollarSign, ChevronDown, ChevronRight,
  FolderTree, Upload, FileJson, CheckCircle2, AlertTriangle,
} from "lucide-react";

export default function UserManagement() {
  const { role } = useAuth();
  const [users, setUsers] = useState({});
  const [eaAccounts, setEaAccounts] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [approvalQueue, setApprovalQueue] = useState({});

  // ── Form State ──
  const [formData, setForm] = useState({
    email: "", role: "investor", password: "", fullName: "", telegramId: ""
  });
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  // ── VPS Tree Builder State ──
  const [vpsNodes, setVpsNodes] = useState([]);
  const [addingVps, setAddingVps] = useState(false);
  const [newVpsForm, setNewVpsForm] = useState({ vpsName: "", monthlyCost: "", billingCycleDate: "" });
  const [addingAccountTo, setAddingAccountTo] = useState(null);
  const [newAccountForm, setNewAccountForm] = useState({ accountNumber: "", profitSharePercent: "30", botStartDate: new Date().toISOString().split("T")[0] });

  // ── Modal Allocation ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  // ── JSON Import State ──
  const [jsonImportText, setJsonImportText] = useState("");
  const [jsonImportResult, setJsonImportResult] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showJsonImporter, setShowJsonImporter] = useState(false);

  useEffect(() => {
    if (role === "super_admin") {
      const usersRef = ref(db, "users");
      const unsubUsers = onValue(usersRef, (snapshot) => {
        if (snapshot.exists()) setUsers(snapshot.val());
        else setUsers({});
      });

      const accountsRef = ref(db, "account_data");
      const unsubAccounts = onValue(accountsRef, (snapshot) => {
        if (snapshot.exists()) setEaAccounts(Object.keys(snapshot.val()));
        else setEaAccounts([]);
      });

      const groupsRef = ref(db, "groups");
      const unsubGroups = onValue(groupsRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const gList = Object.keys(data).map(key => ({ id: key, name: data[key].name }));
          setGroupsList(gList);
        } else {
          setGroupsList([]);
        }
      });

      const queueRef = ref(db, "approval_queue");
      const unsubQueue = onValue(queueRef, (snapshot) => {
        if (snapshot.exists()) setApprovalQueue(snapshot.val());
        else setApprovalQueue({});
      });

      return () => { unsubUsers(); unsubAccounts(); unsubGroups(); unsubQueue(); };
    }
  }, [role]);

  if (role !== "super_admin") {
    return (
      <div className="flex h-screen items-center justify-center font-bold text-red-500 text-xl">
        Akses Ditolak
      </div>
    );
  }

  // ── VPS Tree Helpers ──
  const addVpsNode = () => {
    if (!newVpsForm.vpsName.trim() || !newVpsForm.monthlyCost || !newVpsForm.billingCycleDate) return;
    const node = {
      id: `vps_${Date.now()}`,
      vpsName: newVpsForm.vpsName.trim(),
      monthlyCost: Number(newVpsForm.monthlyCost),
      billingCycleDate: newVpsForm.billingCycleDate,
      expanded: true,
      accounts: [],
    };
    setVpsNodes(prev => [...prev, node]);
    setNewVpsForm({ vpsName: "", monthlyCost: "", billingCycleDate: "" });
    setAddingVps(false);
  };

  const removeVpsNode = (vpsId) => {
    setVpsNodes(prev => prev.filter(n => n.id !== vpsId));
  };

  const toggleVpsExpand = (vpsId) => {
    setVpsNodes(prev => prev.map(n => n.id === vpsId ? { ...n, expanded: !n.expanded } : n));
  };

  const addAccountToVps = (vpsId) => {
    if (!newAccountForm.accountNumber.trim()) return;
    const account = {
      id: `acc_${Date.now()}`,
      accountNumber: newAccountForm.accountNumber.trim(),
      profitSharePercent: Number(newAccountForm.profitSharePercent) || 30,
      botStartDate: newAccountForm.botStartDate || new Date().toISOString().split("T")[0],
    };
    setVpsNodes(prev => prev.map(n => {
      if (n.id !== vpsId) return n;
      return { ...n, accounts: [...n.accounts, account], expanded: true };
    }));
    setNewAccountForm({ accountNumber: "", profitSharePercent: "30", botStartDate: new Date().toISOString().split("T")[0] });
    setAddingAccountTo(null);
  };

  const removeAccount = (vpsId, accId) => {
    setVpsNodes(prev => prev.map(n => {
      if (n.id !== vpsId) return n;
      return { ...n, accounts: n.accounts.filter(a => a.id !== accId) };
    }));
  };

  // ── Register User with Tree ──
  const handleRegisterUser = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMsg({ type: "", text: "" });

    try {
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      } catch (authErr) {
        if (authErr.code === "auth/email-already-in-use") {
          setMsg({ type: "error", text: "Email sudah terdaftar. Gunakan email lain atau hapus user tersebut terlebih dahulu." });
        } else {
          setMsg({ type: "error", text: `Auth Error: ${authErr.message}` });
        }
        setIsProcessing(false);
        return;
      }
      const newUid = userCredential.user.uid;

      const userPayload = {
        email: formData.email.toLowerCase(),
        role: formData.role,
        fullName: formData.fullName.trim(),
        telegramId: formData.telegramId.trim(),
        setup_status: "completed",
        createdAt: new Date().toISOString(),
      };

      const subscriptions = {};
      if (formData.role === "investor" && vpsNodes.length > 0) {
        const ownedAccounts = {};

        vpsNodes.forEach(vps => {
          const billingDate = vps.billingCycleDate || new Date().toISOString().split("T")[0];
          const vpsKey = vps.vpsName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase() || vps.id;

          subscriptions[vpsKey] = {
            vps_name: vps.vpsName,
            vps_monthly_cost: vps.monthlyCost,
            billing_cycle_date: billingDate,
            next_billing_date: billingDate,
            status: "active",
          };

          if (vps.accounts.length > 0) {
            subscriptions[vpsKey].accounts = {};
            vps.accounts.forEach(acc => {
              subscriptions[vpsKey].accounts[acc.accountNumber] = {
                profit_share_percent: acc.profitSharePercent,
                bot_start_date: acc.botStartDate,
                last_invoiced_date: null,
              };
              ownedAccounts[acc.accountNumber] = true;
            });
          }
        });

        userPayload.owned_accounts = ownedAccounts;
      }

      await set(ref(db, `users/${newUid}`), userPayload);
      if (Object.keys(subscriptions).length > 0) {
        await set(ref(db, `users/${newUid}/subscriptions`), subscriptions);
      }

      await signOut(secondaryAuth);

      setMsg({ type: "success", text: `User berhasil didaftarkan! ${vpsNodes.length > 0 ? `+ ${vpsNodes.length} VPS, ${vpsNodes.reduce((sum, v) => sum + v.accounts.length, 0)} EA accounts.` : ""}` });
      setForm({ email: "", role: "investor", password: "", fullName: "", telegramId: "" });
      setVpsNodes([]);
    } catch (error) {
      console.error(error);
      setMsg({ type: "error", text: "Gagal menambahkan user: " + (error.message || "Unknown error") });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMsg({ type: "", text: "" }), 7000);
    }
  };

  const handleDeleteUser = async (uid) => {
    if (confirm("PERINGATAN: Hapus user ini dari Database? Ini akan menghapus seluruh subscription tree juga.")) {
      await remove(ref(db, `users/${uid}`));
    }
  };

  const openAccessModal = (uid, userObj) => {
    setSelectedUser({ uid, email: userObj.email, role: userObj.role });
    const initialChecked = {};
    if (userObj.role === "admin") {
      if (userObj.managed_groups) Object.keys(userObj.managed_groups).forEach(gId => initialChecked[gId] = userObj.managed_groups[gId]);
    } else {
      if (userObj.owned_accounts) Object.keys(userObj.owned_accounts).forEach(accId => initialChecked[accId] = userObj.owned_accounts[accId]);
    }
    setCheckedItems(initialChecked);
    setIsModalOpen(true);
  };

  const handleCheckboxToggle = (itemId) => {
    setCheckedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const saveAccessMapping = async () => {
    setIsSavingAccess(true);
    try {
      const finalMapping = {};
      Object.keys(checkedItems).forEach(id => {
        if (checkedItems[id] === true) finalMapping[id] = true;
      });
      const targetNode = selectedUser.role === "admin" ? "managed_groups" : "owned_accounts";
      await set(ref(db, `users/${selectedUser.uid}/${targetNode}`), finalMapping);
      setIsModalOpen(false);
    } catch (error) {
      alert("Terjadi kesalahan saat menyimpan hak akses.");
    } finally {
      setIsSavingAccess(false);
    }
  };

  // ── JSON Bulk Import ──
  const handleJsonImport = async () => {
    setIsImporting(true);
    setJsonImportResult(null);

    const results = { success: [], errors: [], total: 0 };

    try {
      const data = JSON.parse(jsonImportText);
      if (!Array.isArray(data)) {
        setJsonImportResult({ success: [], errors: [`Invalid format: expected a JSON array, got ${typeof data}`], total: 1 });
        setJsonImportText("");
        setIsImporting(false);
        return;
      }

      results.total = data.length;

      for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        const label = entry.email || entry.fullName || `Entry #${i + 1}`;

        if (!entry.email || !entry.subscriptions) {
          results.errors.push(`${label}: Missing 'email' or 'subscriptions' field`);
          continue;
        }

        // Find user by email
        const uid = Object.keys(users).find(k => users[k]?.email?.toLowerCase() === entry.email.toLowerCase());
        if (!uid) {
          results.errors.push(`${label}: User with email '${entry.email}' not found in database`);
          continue;
        }

        try {
          // Validate & format subscriptions
          const subs = {};
          if (entry.subscriptions && Array.isArray(entry.subscriptions)) {
            for (const vps of entry.subscriptions) {
              if (!vps.vps_name) {
                results.errors.push(`${label}: VPS entry missing 'vps_name'`);
                continue;
              }
              const vpsKey = vps.vps_name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
              subs[vpsKey] = {
                vps_name: vps.vps_name,
                vps_monthly_cost: vps.vps_monthly_cost || 0,
                billing_cycle_date: vps.billing_cycle_date || new Date().toISOString().split("T")[0],
                next_billing_date: vps.next_billing_date || vps.billing_cycle_date || new Date().toISOString().split("T")[0],
                status: vps.status || "active",
              };

              if (vps.accounts && Array.isArray(vps.accounts) && vps.accounts.length > 0) {
                subs[vpsKey].accounts = {};
                for (const acc of vps.accounts) {
                  if (!acc.account_number) {
                    results.errors.push(`${label}/${vpsKey}: Account missing 'account_number'`);
                    continue;
                  }
                  subs[vpsKey].accounts[acc.account_number] = {
                    profit_share_percent: acc.profit_share_percent ?? 30,
                    bot_start_date: acc.bot_start_date || new Date().toISOString().split("T")[0],
                    last_invoiced_date: acc.last_invoiced_date || null,
                  };
                }
              }
            }
          }

          await set(ref(db, `users/${uid}/subscriptions`), subs);

          // Also update owned_accounts
          const ownedAccounts = {};
          Object.values(subs).forEach(vpsSub => {
            if (vpsSub.accounts) {
              Object.keys(vpsSub.accounts).forEach(accNum => { ownedAccounts[accNum] = true; });
            }
          });
          if (Object.keys(ownedAccounts).length > 0) {
            await set(ref(db, `users/${uid}/owned_accounts`), ownedAccounts);
          }

          results.success.push(`${label}: ${Object.keys(subs).length} VPS, ${Object.values(subs).reduce((s, v) => s + Object.keys(v.accounts || {}).length, 0)} EA accounts imported`);
        } catch (err) {
          results.errors.push(`${label}: Firebase write error — ${err.message}`);
        }
      }
    } catch (parseErr) {
      results.errors.push(`JSON Parse Error: ${parseErr.message}`);
    }

    setJsonImportResult(results);
    setJsonImportText("");
    setIsImporting(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans relative">
      {/* HEADER */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm flex items-center gap-5">
        <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-500 shadow-inner"><ShieldCheck size={36} /></div>
        <div>
          <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">System Access Manager</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Kelola user, VPS subscriptions, EA account allocations & billing cycles.</p>
        </div>
      </div>

      {/* ── JSON BULK IMPORT SECTION ── */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 shadow-sm">
        <button
          onClick={() => setShowJsonImporter(!showJsonImporter)}
          className="flex items-center gap-2 text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
        >
          <Upload size={18} />
          {showJsonImporter ? "Sembunyikan JSON Importer" : "Bulk Import Subscription (JSON)"}
        </button>

        {showJsonImporter && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase block mb-2">
                Paste JSON Array of Subscriptions
              </label>
              <textarea
                className="w-full h-40 bg-[var(--background)] border border-amber-500/30 text-[var(--foreground)] text-xs rounded-xl p-4 font-mono outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                placeholder={`[
  {
    "email": "investor@example.com",
    "fullName": "John Doe",
    "subscriptions": [
      {
        "vps_name": "KRX-VPS-01",
        "vps_monthly_cost": 25,
        "billing_cycle_date": "2026-06-01",
        "accounts": [
          {
            "account_number": "12345678",
            "profit_share_percent": 30,
            "bot_start_date": "2026-05-01"
          }
        ]
      }
    ]
  }
]`}
                value={jsonImportText}
                onChange={(e) => setJsonImportText(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleJsonImport}
                disabled={isImporting || !jsonImportText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition-all"
              >
                <FileJson size={16} />
                {isImporting ? "Importing..." : "Process Import"}
              </button>
              <button
                onClick={() => { setJsonImportText(""); setJsonImportResult(null); }}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Import Results */}
            {jsonImportResult && (
              <div className="space-y-3 mt-4">
                {jsonImportResult.errors.length > 0 && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-red-400 flex items-center gap-2">
                      <AlertTriangle size={14} /> {jsonImportResult.errors.length} Error{jsonImportResult.errors.length > 1 ? "s" : ""}
                    </p>
                    <ul className="text-[11px] text-red-300 space-y-1 list-disc list-inside">
                      {jsonImportResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}
                {jsonImportResult.success.length > 0 && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 size={14} /> {jsonImportResult.success.length} / {jsonImportResult.total} Imported Successfully
                    </p>
                    <ul className="text-[11px] text-emerald-300 space-y-1 list-disc list-inside">
                      {jsonImportResult.success.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── REGISTER FORM + TREE BUILDER ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT: Register Form */}
        <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm h-fit">
          <h2 className="text-lg font-black text-[var(--foreground)] mb-6 flex items-center gap-2">
            <UserPlus className="text-purple-500" size={20} /> Daftarkan User Baru
          </h2>

          {msg.text && (
            <div className={`mb-4 p-3 rounded-xl text-sm font-bold ${msg.type === "success" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleRegisterUser} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase">Nama Lengkap</label>
              <div className="relative">
                <UserPlus className="absolute left-4 top-3.5 text-[var(--muted-foreground)] opacity-70" size={16} />
                <input type="text" required value={formData.fullName} onChange={(e) => setForm({ ...formData, fullName: e.target.value })} className="w-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-purple-500" placeholder="Nama lengkap" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-[var(--muted-foreground)] opacity-70" size={16} />
                <input type="email" required value={formData.email} onChange={(e) => setForm({ ...formData, email: e.target.value })} className="w-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-purple-500" placeholder="investor@mail.com" />
              </div>
            </div>

            {/* Telegram ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase">ID Telegram</label>
              <div className="relative">
                <svg className="absolute left-4 top-3.5 text-[var(--muted-foreground)] opacity-70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.2 2.9L1.8 10.3c-1 .4-1 1.9-.1 2.4l4.5 2.2 1.8 5.8c.2.7 1.1.9 1.6.3l2.7-3.2 4.2 3.1c.6.4 1.4.1 1.6-.6l3.4-16c.2-1.1-.8-2-1.9-1.6z" /><path d="M9.3 14.2l7.3-5.2-4.6 6.8-1.4 4.6" /></svg>
                <input type="text" required value={formData.telegramId} onChange={(e) => setForm({ ...formData, telegramId: e.target.value })} className="w-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-purple-500" placeholder="@username atau ID" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-[var(--muted-foreground)] opacity-70" size={16} />
                <input type="text" required minLength="6" value={formData.password} onChange={(e) => setForm({ ...formData, password: e.target.value })} className="w-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-purple-500" placeholder="Minimal 6 karakter" />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase">Hak Akses (Role)</label>
              <select value={formData.role} onChange={(e) => setForm({ ...formData, role: e.target.value })} className="w-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl px-4 py-3 outline-none cursor-pointer">
                <option value="investor">Investor</option>
                <option value="admin">Admin (Manajer Cluster)</option>
              </select>
            </div>

            {/* ── VPS TREE BUILDER (only for investor) ── */}
            {formData.role === "investor" && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[var(--muted-foreground)] uppercase flex items-center gap-2">
                    <FolderTree size={14} className="text-emerald-400" />
                    Subscription Tree (VPS + EA Accounts)
                  </label>
                  <button
                    type="button"
                    onClick={() => setAddingVps(true)}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <Plus size={12} /> Add VPS
                  </button>
                </div>

                {/* Add VPS Form */}
                {addingVps && (
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/30 rounded-xl space-y-3 animate-in">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">New VPS Node</p>
                    <input
                      type="text"
                      placeholder="VPS Name (e.g. KRX-VPS-01)"
                      value={newVpsForm.vpsName}
                      onChange={(e) => setNewVpsForm(p => ({ ...p, vpsName: e.target.value }))}
                      className="w-full bg-[var(--background)] border border-emerald-500/30 text-[var(--foreground)] text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Monthly Cost ($)</label>
                        <div className="relative">
                          <DollarSign size={12} className="absolute left-2.5 top-2 text-[var(--muted-foreground)]" />
                          <input
                            type="number"
                            placeholder="0"
                            value={newVpsForm.monthlyCost}
                            onChange={(e) => setNewVpsForm(p => ({ ...p, monthlyCost: e.target.value }))}
                            className="w-full bg-[var(--background)] border border-emerald-500/30 text-[var(--foreground)] text-xs rounded-lg pl-7 pr-2 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-[var(--muted-foreground)] uppercase block mb-1">Billing Date</label>
                        <div className="relative">
                          <Calendar size={12} className="absolute left-2.5 top-2 text-[var(--muted-foreground)]" />
                          <input
                            type="date"
                            value={newVpsForm.billingCycleDate}
                            onChange={(e) => setNewVpsForm(p => ({ ...p, billingCycleDate: e.target.value }))}
                            className="w-full bg-[var(--background)] border border-emerald-500/30 text-[var(--foreground)] text-xs rounded-lg pl-7 pr-2 py-2 outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => { setAddingVps(false); setNewVpsForm({ vpsName: "", monthlyCost: "", billingCycleDate: "" }); }} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg">Cancel</button>
                      <button type="button" onClick={addVpsNode} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg">Save VPS</button>
                    </div>
                  </div>
                )}

                {/* VPS Tree Display */}
                {vpsNodes.length > 0 && (
                  <div className="space-y-2">
                    {vpsNodes.map((vps) => (
                      <div key={vps.id} className="bg-[var(--background)] border border-[var(--card-border)] rounded-xl overflow-hidden">
                        {/* VPS Row */}
                        <div className="flex items-center gap-2 p-3 hover:bg-[var(--muted)]/20 transition-colors cursor-pointer" onClick={() => toggleVpsExpand(vps.id)}>
                          <div className="text-emerald-400">
                            {vps.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </div>
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <Server size={14} className="text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-[var(--foreground)] truncate">{vps.vpsName}</div>
                            <div className="text-[10px] text-[var(--muted-foreground)]">
                              ${vps.monthlyCost}/mo &bull; Billing: {vps.billingCycleDate} &bull; {vps.accounts.length} EA
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setAddingAccountTo(vps.id); }}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded-md flex items-center gap-1 transition-all"
                            title="Add EA Account"
                          >
                            <Plus size={10} /> EA
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeVpsNode(vps.id); }}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remove VPS"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Add Account Form (inline) */}
                        {addingAccountTo === vps.id && (
                          <div className="px-8 py-3 bg-blue-500/5 border-t border-blue-500/20 space-y-2">
                            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">Add EA Account to {vps.vpsName}</p>
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder="Account #"
                                value={newAccountForm.accountNumber}
                                onChange={(e) => setNewAccountForm(p => ({ ...p, accountNumber: e.target.value }))}
                                className="col-span-1 bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                              <div className="relative">
                                <Percent size={10} className="absolute left-2 top-2.5 text-blue-400" />
                                <input
                                  type="number"
                                  min="0" max="100"
                                  placeholder="30"
                                  value={newAccountForm.profitSharePercent}
                                  onChange={(e) => setNewAccountForm(p => ({ ...p, profitSharePercent: e.target.value }))}
                                  className="w-full bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg pl-6 pr-2 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <input
                                type="date"
                                value={newAccountForm.botStartDate}
                                onChange={(e) => setNewAccountForm(p => ({ ...p, botStartDate: e.target.value }))}
                                className="bg-[var(--background)] border border-blue-500/30 text-[var(--foreground)] text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => { setAddingAccountTo(null); setNewAccountForm({ accountNumber: "", profitSharePercent: "30", botStartDate: new Date().toISOString().split("T")[0] }); }} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancel</button>
                              <button type="button" onClick={() => addAccountToVps(vps.id)} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg">Add Account</button>
                            </div>
                          </div>
                        )}

                        {/* Expanded: EA Account List */}
                        {vps.expanded && vps.accounts.length > 0 && (
                          <div className="border-t border-[var(--card-border)] bg-[var(--muted)]/10">
                            {vps.accounts.map((acc) => (
                              <div key={acc.id} className="flex items-center gap-2 px-6 py-2.5 hover:bg-[var(--muted)]/20 transition-colors">
                                <Cpu size={12} className="text-blue-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="font-mono font-bold text-[var(--foreground)] text-xs">{acc.accountNumber}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)] flex-shrink-0">
                                  <span className="flex items-center gap-1"><Percent size={10} className="text-purple-400" /> {acc.profitSharePercent}%</span>
                                  <span className="flex items-center gap-1"><Calendar size={10} className="text-slate-500" /> {acc.botStartDate}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removeAccount(vps.id, acc.id); }}
                                  className="p-1 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {vps.expanded && vps.accounts.length === 0 && addingAccountTo !== vps.id && (
                          <div className="px-8 py-3 text-[10px] text-slate-500 italic border-t border-[var(--card-border)]/50 bg-[var(--muted)]/10">
                            No EA accounts yet. Click &ldquo;EA&rdquo; to add.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {vpsNodes.length === 0 && !addingVps && (
                  <p className="text-[10px] text-slate-500 text-center py-2 italic">
                    No VPS added yet. Click &ldquo;Add VPS&rdquo; to build the subscription tree.
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={isProcessing} className="w-full bg-purple-500 hover:opacity-90 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-md transition-all mt-4 flex justify-center items-center gap-2">
              {isProcessing ? "Mendaftarkan..." : "Tambahkan Akses"}
            </button>
          </form>
        </div>

        {/* RIGHT: User Table */}
        <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="p-6 md:p-8 border-b border-[var(--card-border)] flex justify-between items-center">
            <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2">
              <Database className="text-blue-500" size={20} /> Daftar Akun Terdaftar
            </h2>
          </div>

          <div className="overflow-x-auto w-full custom-scrollbar flex-grow p-6">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  <th className="pb-3 text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-2">Informasi Akun</th>
                  <th className="pb-3 text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider text-center">Akses & Cakupan</th>
                  <th className="pb-3 text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider text-center">Role</th>
                  <th className="pb-3 text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider text-right pr-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {Object.keys(users).map((uid) => {
                  const userObj = users[uid];
                  const isPendingInQueue = Object.values(approvalQueue).some(req => req.uid === uid);
                  const ownedCount = userObj.owned_accounts ? Object.keys(userObj.owned_accounts).length : 0;
                  const groupCount = userObj.managed_groups ? Object.keys(userObj.managed_groups).length : 0;
                  const subs = userObj.subscriptions || {};
                  const vpsSubCount = Object.keys(subs).length;

                  return (
                    <tr key={uid} className="hover:bg-[var(--muted)]/30 transition-colors">
                      <td className="py-4 pl-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${userObj.role === "super_admin" ? "bg-amber-500" : userObj.role === "admin" ? "bg-purple-500" : "bg-emerald-500"}`}>
                            {(userObj.email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[var(--foreground)]">{userObj.fullName || userObj.email || "Unknown"}</div>
                            <div className="text-[10px] text-[var(--muted-foreground)] uppercase mt-0.5 tracking-wider">{userObj.email}</div>
                            {vpsSubCount > 0 && (
                              <div className="text-[9px] text-emerald-400 mt-0.5 flex items-center gap-1">
                                <Server size={9} /> {vpsSubCount} VPS subscription{vpsSubCount > 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 text-center">
                        {userObj.role === "admin" ? (
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${groupCount > 0 ? "bg-purple-500/10 text-purple-500" : "bg-slate-500/10 text-slate-500"}`}>
                            {groupCount} Kategori/Grup
                          </span>
                        ) : userObj.role === "investor" ? (
                          isPendingInQueue ? (
                            <span className="text-[10px] font-black px-2 py-1 rounded-md bg-orange-500/10 text-orange-500 border border-orange-500/20 flex items-center justify-center gap-1 w-max mx-auto uppercase">
                              <AlertCircle size={12} /> Pending Approval
                            </span>
                          ) : (
                            <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${ownedCount > 0 ? "bg-blue-500/10 text-blue-500" : "bg-slate-500/10 text-slate-500"}`}>
                              {ownedCount} Akun EA
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] font-bold text-[var(--muted-foreground)]">ALL ACCESS</span>
                        )}
                      </td>

                      <td className="py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          userObj.role === "super_admin" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                          userObj.role === "admin" ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                          "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        }`}>
                          {(userObj.role || "unknown").replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-4 text-right pr-2">
                        <div className="flex items-center justify-end gap-2">
                          {userObj.role !== "super_admin" && (
                            <button onClick={() => openAccessModal(uid, userObj)} className={`p-2 rounded-lg transition-colors ${userObj.role === "admin" ? "bg-purple-500/10 text-purple-500 hover:bg-purple-500 hover:text-white" : "bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white"}`}>
                              <Settings size={16} />
                            </button>
                          )}
                          {userObj.role !== "super_admin" && (
                            <button onClick={() => handleDeleteUser(uid)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── MODAL ALLOCATION (EXISTING) ── */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`bg-[#0a0a0a] border border-white/10 w-full max-w-md rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.3)] overflow-hidden ${selectedUser.role === "admin" ? "shadow-purple-500/20" : "shadow-blue-500/20"}`}>
            <div className={`p-6 border-b border-white/10 flex justify-between items-center ${selectedUser.role === "admin" ? "bg-purple-500/5" : "bg-blue-500/5"}`}>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">{selectedUser.role === "admin" ? "Delegasi Cluster & Grup" : "Alokasi Akun EA"}</h3>
                <p className={`text-[10px] font-mono tracking-widest mt-1 ${selectedUser.role === "admin" ? "text-purple-400" : "text-blue-400"}`}>{selectedUser.email}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 max-h-[50vh] overflow-y-auto space-y-3 custom-scrollbar">
              {selectedUser.role === "admin" && (
                groupsList.length === 0 ? <p className="text-center text-xs text-slate-500 py-4">Belum ada kategori grup di server.</p> : (
                  groupsList.map(group => (
                    <label key={group.id} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${checkedItems[group.id] ? "bg-purple-500/10 border-purple-500/40" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
                      <div className="relative flex items-center">
                        <input type="checkbox" className="peer sr-only" checked={checkedItems[group.id] || false} onChange={() => handleCheckboxToggle(group.id)} />
                        <div className="w-5 h-5 border-2 border-slate-500 rounded flex items-center justify-center peer-checked:bg-purple-500 peer-checked:border-purple-500"><ShieldCheck size={14} className="text-white" /></div>
                      </div>
                      <div>
                        <p className={`font-black tracking-tight text-sm ${checkedItems[group.id] ? "text-purple-400" : "text-slate-300"}`}>{group.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Cluster Access</p>
                      </div>
                    </label>
                  ))
                )
              )}
              {selectedUser.role === "investor" && (
                eaAccounts.length === 0 ? <p className="text-center text-xs text-slate-500 py-4">Belum ada node akun EA yang menyala.</p> : (
                  eaAccounts.map(accId => (
                    <label key={accId} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${checkedItems[accId] ? "bg-blue-500/10 border-blue-500/40" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
                      <div className="relative flex items-center">
                        <input type="checkbox" className="peer sr-only" checked={checkedItems[accId] || false} onChange={() => handleCheckboxToggle(accId)} />
                        <div className="w-5 h-5 border-2 border-slate-500 rounded flex items-center justify-center peer-checked:bg-blue-500 peer-checked:border-blue-500"><ShieldCheck size={14} className="text-white" /></div>
                      </div>
                      <div>
                        <p className={`font-black tracking-widest font-mono text-sm ${checkedItems[accId] ? "text-blue-400" : "text-slate-300"}`}>{accId}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">KRX Quantitative Node</p>
                      </div>
                    </label>
                  ))
                )
              )}
            </div>
            <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-black/50">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5">Batal</button>
              <button onClick={saveAccessMapping} disabled={isSavingAccess} className={`px-5 py-2.5 rounded-xl text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 ${selectedUser.role === "admin" ? "bg-purple-600 hover:bg-purple-500" : "bg-blue-600 hover:bg-blue-500"}`}>
                {isSavingAccess ? "Menyimpan..." : "Simpan Hak Akses"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}