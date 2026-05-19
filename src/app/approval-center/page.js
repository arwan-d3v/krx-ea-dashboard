"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../../lib/firebase"; 
import { ref, onValue, set, remove } from "firebase/database";
import { ShieldAlert, CheckCircle, XCircle, Eye, EyeOff, Clock, Server, Copy, UserCheck } from "lucide-react";

export default function ApprovalCenter() {
  const { role, user } = useAuth();
  const [queue, setQueue] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (role === 'super_admin') {
      const queueRef = ref(db, 'approval_queue');
      const unsub = onValue(queueRef, (snapshot) => {
        if (snapshot.exists()) setQueue(snapshot.val());
        else setQueue({});
        setIsLoading(false);
      });
      return () => unsub();
    }
  }, [role]);

  // 🟢 FIX: Memastikan hanya Super Admin yang bisa melakukan Approval
  if (role !== 'super_admin') {
    return <div className="flex h-screen items-center justify-center font-bold text-red-500 text-xl bg-[#030712]">Akses Ditolak: Karantina Level 5</div>;
  }

  const togglePassword = (acc) => setVisiblePasswords(prev => ({ ...prev, [acc]: !prev[acc] }));
  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); alert("Dicopy ke clipboard!"); };

  // 🟢 FIX BUG FIREBASE: Potongan Karakter Diubah Menjadi 12 (Agar formatnya pas 4-4-4)
  const generateHash = async (account, broker, createdAt, expiredAt) => {
    const rawString = `${account}|${broker}|${createdAt}|${expiredAt}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(rawString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    return `KRX-${hashHex.substring(0, 4)}-${hashHex.substring(4, 8)}-${hashHex.substring(8, 12)}`;
  };

  const handleApprove = async (mt5Account, data) => {
    if(!confirm(`AKTIVASI: Apakah Anda sudah menyetel akun ${mt5Account} di VPS?`)) return;
    setIsProcessing(true);

    try {
      const createdAt = Date.now();
      const durationMonths = parseInt(data.duration_months) || 1;
      const durationMs = durationMonths * 30 * 24 * 60 * 60 * 1000;
      const expiredAt = createdAt + durationMs;

      const newLicenseKey = await generateHash(mt5Account, data.broker, createdAt, expiredAt);

      await set(ref(db, `licenses/${mt5Account}`), {
        license_key: newLicenseKey,
        investor_name: data.name || "Unknown",
        email: data.email || "",
        telegram: data.telegram || "",
        whatsapp: data.whatsapp || "",
        broker_server: data.server || data.broker_server,
        status: "ACTIVE",
        expiry_date: expiredAt, 
        last_heartbeat: createdAt,
        discount_applied: data.discount_applied || 0,
        approved_by: user.email,
        source: data.uid ? "PUBLIC_SSO" : "ADMIN_MANUAL"
      });

      if (data.uid) {
        await set(ref(db, `users/${data.uid}/owned_accounts/${mt5Account}`), true);
      }

      await set(ref(db, `account_data/${mt5Account}/metadata`), {
        investor_name: data.name,
        broker: data.server || data.broker_server,
        bot_type: "NON_ML",
        created_at: new Date().toISOString()
      });

      await remove(ref(db, `approval_queue/${mt5Account}`));

      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `✅ <b>APPROVAL SUCCESS</b>\n\nLisensi aktif untuk akun MT5 <code>${mt5Account}</code> (<b>${data.name}</b>).\n🔑 Key: <code>${newLicenseKey}</code>\nNode EA siap beroperasi di pasar!`
        })
      });

    } catch (error) {
      console.error(error);
      alert("Gagal melakukan aktivasi. Periksa Log Console.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (mt5Account, data) => {
    if(!confirm(`TOLAK: Hapus pengajuan akun ${mt5Account}?`)) return;
    await remove(ref(db, `approval_queue/${mt5Account}`));
    if(data.uid) {
      await set(ref(db, `users/${data.uid}/onboarding_submitted`), null);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans relative">
      <div className="bg-[#0a0a0a] rounded-3xl border border-orange-500/30 p-6 md:p-8 shadow-[0_0_30px_rgba(249,115,22,0.1)] flex items-center gap-5">
        <div className="p-4 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20"><ShieldAlert size={36}/></div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Approval Center</h1>
          <p className="text-sm text-slate-400">Verifikasi dan Generate Lisensi Kriptografi untuk akun EA baru.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-orange-500 animate-pulse font-bold">Memindai Antrean...</div>
      ) : Object.keys(queue).length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center bg-[#0a0a0a] border border-white/10 border-dashed rounded-3xl">
           <CheckCircle size={48} className="text-slate-600 mb-4" />
           <p className="text-lg font-bold text-slate-500 uppercase tracking-widest">TIDAK ADA ANTREAN</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.keys(queue).map((mt5Account) => {
            const data = queue[mt5Account];
            const isPassVisible = visiblePasswords[mt5Account];
            const isFromAdmin = !data.uid; 

            return (
              <div key={mt5Account} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-sm flex flex-col relative overflow-hidden hover:border-orange-500/50 transition-colors">
                
                <div className="absolute top-0 right-0 bg-orange-500/20 text-orange-500 text-[9px] font-black uppercase px-3 py-1.5 rounded-bl-xl border-b border-l border-orange-500/30 flex items-center gap-1">
                  <Clock size={10} className="animate-pulse"/> Pending
                </div>

                <div className="mb-6 mt-2">
                  <h3 className="font-black text-lg text-white tracking-tight">{data.name || data.investor_name}</h3>
                  <p className="text-[10px] text-slate-500 font-mono tracking-widest mt-0.5">{data.email}</p>
                  <span className={`inline-block mt-2 text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-wider ${isFromAdmin ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {isFromAdmin ? `Req by: ${data.requested_by}` : 'Source: Public Web'}
                  </span>
                </div>

                <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5 flex-grow">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Akun MT5</span>
                    <span className="text-sm font-mono font-black text-orange-400">{mt5Account}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Server</span>
                    <span className="text-xs font-bold text-slate-300">{data.server || data.broker_server}</span>
                  </div>
                  
                  {isFromAdmin && (
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-bold text-slate-500 uppercase">Durasi / Diskon</span>
                       <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 rounded">{data.duration_months} Bln | -{data.discount_applied}%</span>
                    </div>
                  )}

                  {!isFromAdmin && (
                    <div className="pt-3 mt-3 border-t border-white/10">
                      <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Master Password</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-grow bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white flex items-center justify-between">
                          {isPassVisible ? data.masterPassword : "••••••••••••"}
                          <button onClick={() => togglePassword(mt5Account)} className="text-slate-500 hover:text-white transition-colors">
                            {isPassVisible ? <EyeOff size={14}/> : <Eye size={14}/>}
                          </button>
                        </div>
                        <button onClick={() => copyToClipboard(data.masterPassword)} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400">
                          <Copy size={14}/>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button onClick={() => handleReject(mt5Account, data)} className="py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-red-500/20">
                    <XCircle size={14}/> Tolak
                  </button>
                  <button onClick={() => handleApprove(mt5Account, data)} disabled={isProcessing} className="py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.3)] flex items-center justify-center gap-1.5">
                    <UserCheck size={14}/> Aktivasi
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}