"use client";
import { useState } from "react";
import { ShieldCheck, KeyRound, Server, User, CalendarDays, CheckCircle2, Mail, Send, Phone, Tag, Clock } from "lucide-react";
import { db } from "../../lib/firebase";
import { ref, push, set } from "firebase/database";
import { useAuth } from "../context/AuthContext"; // <-- WAJIB IMPORT INI

export default function CreateLicense() {
  // PANGGIL DATA USER ASLI DARI FIREBASE AUTH
  const { role, user } = useAuth(); 

  const [formData, setFormData] = useState({
    investorName: "",
    email: "",
    telegram: "",
    whatsapp: "",
    accountNumber: "",
    brokerServer: "",
    durationMonths: "1",
    discountType: "NONE", 
    manualDiscountValue: "",
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); 

  // FUNGSI KRIPTOGRAFI SHA-256 (Berjalan jika di-Approve)
  const generateHash = async (account, broker, createdAt, expiredAt) => {
    const rawString = `${account}|${broker}|${createdAt}|${expiredAt}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(rawString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    return `KRX-${hashHex.substring(0, 4)}-${hashHex.substring(4, 8)}-${hashHex.substring(8, 13)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const createdAt = Date.now();
      const durationMs = parseInt(formData.durationMonths) * 30 * 24 * 60 * 60 * 1000;
      const expiredAt = createdAt + durationMs;

      // Hitung Diskon
      let finalDiscount = 0;
      if (formData.discountType === "IB_30") finalDiscount = 30;
      else if (formData.discountType === "MANUAL" && role === "super_admin") {
        finalDiscount = parseInt(formData.manualDiscountValue) || 0;
      }

      if (role === "admin") {
        // ADMIN FLOW -> Masuk ke Waiting List (Pending Registrations)
        const pendingRef = ref(db, 'pending_registrations');
        await push(pendingRef, {
          investor_name: formData.investorName,
          email: formData.email,
          telegram: formData.telegram,
          whatsapp: formData.whatsapp,
          account_number: formData.accountNumber,
          broker_server: formData.brokerServer,
          duration_months: formData.durationMonths,
          discount_applied: finalDiscount,
          created_at: createdAt.toString(),
          expired_at: expiredAt.toString(),
          status: "pending",
          requested_by: user.email // <-- CATAT SIAPA ADMIN YANG MENGAJUKAN
        });
        
        setSubmitStatus({
          type: 'pending',
          message: `Pengajuan lisensi untuk akun ${formData.accountNumber} berhasil dikirim ke Super Admin.`
        });

      } else if (role === "super_admin") {
        // SUPER ADMIN FLOW -> Auto-Approve & Generate License
        const newLicenseKey = await generateHash(formData.accountNumber, formData.brokerServer, createdAt, expiredAt);
        
        // Simpan ke daftar lisensi aktif
        const licenseRef = ref(db, `licenses/${formData.accountNumber}`);
        await set(licenseRef, {
          license_key: newLicenseKey,
          investor_name: formData.investorName,
          email: formData.email,
          telegram: formData.telegram,
          whatsapp: formData.whatsapp,
          broker_server: formData.brokerServer,
          status: "ACTIVE",
          expiry_date: expiredAt.toString(),
          last_heartbeat: createdAt.toString(),
          discount_applied: finalDiscount,
          requested_by: user.email // <-- TETAP DICATAT WALAU SUPER ADMIN
        });

        setSubmitStatus({
          type: 'approved',
          key: newLicenseKey,
          account: formData.accountNumber
        });
      }
      
    } catch (error) {
      console.error("Error:", error);
      alert("Terjadi kesalahan sistem saat menghubungi Firebase.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-5 md:p-10 space-y-6 transition-colors duration-300 max-w-5xl mx-auto">
      
      {/* HEADER */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 md:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-teal-500/10 p-4 rounded-2xl text-teal-500 shadow-inner">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[var(--foreground)] tracking-tight">Registrasi Lisensi Baru</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              {role === 'admin' 
                ? "Isi formulir ini untuk mengajukan lisensi ke Super Admin." 
                : "Generate lisensi EA secara instan."}
            </p>
          </div>
        </div>

        {/* MENAMPILKAN AKUN YANG SEDANG LOGIN */}
        <div className="bg-[var(--muted)]/50 p-3 rounded-2xl border border-[var(--card-border)] flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${role === 'super_admin' ? 'bg-amber-500' : 'bg-blue-500'}`}>
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[var(--foreground)]">{user?.email}</span>
            <span className={`text-[10px] font-black uppercase tracking-wider ${role === 'super_admin' ? 'text-amber-500' : 'text-blue-500'}`}>
              {role?.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORM SECTION */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 md:p-8 shadow-sm">
          <h3 className="font-bold text-lg text-[var(--foreground)] mb-6 flex items-center gap-2">
            <User className="text-[var(--primary)]" size={20}/> Data Klien & Trading
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* BARIS 1: Nama & Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-1">Nama Investor</label>
                <input type="text" required value={formData.investorName} onChange={(e) => setFormData({...formData, investorName: e.target.value})} placeholder="Nama Lengkap" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-sm font-bold text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-1">Email</label>
                <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="email@domain.com" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-sm font-bold text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] outline-none" />
              </div>
            </div>

            {/* BARIS 2: Telegram & WA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-1 flex items-center gap-1.5"><Send size={14}/> ID Telegram (Opsional)</label>
                <input type="text" value={formData.telegram} onChange={(e) => setFormData({...formData, telegram: e.target.value})} placeholder="@username" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-sm font-bold text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-1 flex items-center gap-1.5"><Phone size={14}/> No. WhatsApp (Opsional)</label>
                <input type="text" value={formData.whatsapp} onChange={(e) => setFormData({...formData, whatsapp: e.target.value})} placeholder="+628..." className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-sm font-bold text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] outline-none" />
              </div>
            </div>

            <div className="h-px w-full bg-[var(--card-border)] my-6"></div>

            {/* BARIS 3: MT5 & Broker */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-1 flex items-center gap-1.5"><KeyRound size={14}/> Akun Trade (MT5)</label>
                <input type="number" required value={formData.accountNumber} onChange={(e) => setFormData({...formData, accountNumber: e.target.value})} placeholder="Contoh: 12345678" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-sm font-bold text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-1 flex items-center gap-1.5"><Server size={14}/> Server Broker</label>
                <input type="text" required value={formData.brokerServer} onChange={(e) => setFormData({...formData, brokerServer: e.target.value})} placeholder="Contoh: ValetaxIntl-Live5" className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-sm font-bold text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] outline-none" />
              </div>
            </div>

            {/* BARIS 4: Durasi & Diskon */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-[var(--muted)]/50 p-5 rounded-2xl border border-[var(--card-border)] shadow-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5"><CalendarDays size={14}/> Masa Berlaku</label>
                <select value={formData.durationMonths} onChange={(e) => setFormData({...formData, durationMonths: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-sm font-bold text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer">
                  <option value="1">1 Bulan</option>
                  <option value="2">2 Bulan</option>
                  <option value="3">3 Bulan</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5"><Tag size={14}/> Program Diskon</label>
                <select value={formData.discountType} onChange={(e) => setFormData({...formData, discountType: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-sm font-bold text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer">
                  <option value="NONE">Harga Normal (Tanpa Diskon)</option>
                  <option value="IB_30">Under IB (-30%)</option>
                  <option value="MANUAL" disabled={role !== "super_admin"}>Manual Diskon (Owner Only)</option>
                </select>
              </div>

              {/* MANUAL DISCOUNT */}
              <div className={`space-y-1.5 transition-opacity ${formData.discountType === "MANUAL" ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
                <label className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Custom Diskon (%)</label>
                <div className="relative">
                  <input type="number" min="0" max="100" value={formData.manualDiscountValue} onChange={(e) => setFormData({...formData, manualDiscountValue: e.target.value})} placeholder="Cth: 50" disabled={formData.discountType !== "MANUAL" || role !== "super_admin"} className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 pr-8 text-sm font-bold text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] outline-none disabled:bg-[var(--muted)]" />
                  <span className="absolute right-4 top-3 text-[var(--muted-foreground)] font-black">%</span>
                </div>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-[var(--primary)] hover:opacity-90 text-white font-black py-4 rounded-xl shadow-lg transition-all disabled:opacity-70 flex justify-center items-center gap-2 text-base">
              {isLoading ? "Memproses Data..." : (role === "super_admin" ? "Approve & Generate License" : "Kirim Pengajuan (Pending)")}
            </button>
          </form>
        </div>

        {/* STATUS SECTION */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 md:p-8 shadow-sm flex flex-col items-center justify-center text-center">
          <h3 className="font-bold text-lg text-[var(--foreground)] mb-6 w-full border-b border-[var(--card-border)] pb-4 text-left">
            Monitor Pengajuan
          </h3>
          
          <div className="flex-grow flex flex-col justify-center w-full">
            {!submitStatus ? (
              <div className="opacity-50 space-y-4 py-10">
                <Clock size={48} className="mx-auto text-[var(--muted-foreground)]" />
                <p className="text-[var(--muted-foreground)] text-sm font-bold">Menunggu Anda menekan tombol {role === 'super_admin' ? 'Generate' : 'Kirim Pengajuan'}.</p>
              </div>
            ) : submitStatus.type === 'pending' ? (
              <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-yellow-500/10 text-yellow-500 p-5 rounded-full inline-block mb-2 shadow-inner">
                  <Clock size={48} />
                </div>
                <h4 className="text-xl font-black text-[var(--foreground)] tracking-tight">Menunggu Approval</h4>
                <p className="text-[var(--muted-foreground)] text-sm font-medium leading-relaxed">{submitStatus.message}</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-[#10b981]/10 text-[#10b981] p-5 rounded-full inline-block mb-2 shadow-inner">
                  <CheckCircle2 size={48} />
                </div>
                <h4 className="text-xl font-black text-[var(--foreground)] tracking-tight">Lisensi Aktif!</h4>
                <p className="text-[var(--muted-foreground)] text-sm font-medium">Berhasil disimpan ke Firebase.</p>
                
                <div className="w-full bg-[var(--background)] border-2 border-[var(--primary)] rounded-2xl p-5 mt-4 shadow-sm relative overflow-hidden group hover:border-[#10b981] transition-colors">
                  <div className="absolute top-0 right-0 bg-[var(--primary)] group-hover:bg-[#10b981] text-white text-[9px] font-black uppercase px-2 py-1 rounded-bl-lg transition-colors">NEW KEY</div>
                  <p className="text-[10px] text-[var(--muted-foreground)] font-black uppercase tracking-widest mb-1.5">Kode Lisensi</p>
                  <p className="text-lg md:text-xl font-mono font-black text-[var(--foreground)] tracking-tight">{submitStatus.key}</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}