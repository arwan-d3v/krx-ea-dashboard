"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { ref, set } from "firebase/database";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { 
  User, Phone, Send, Lock, Server, ShieldCheck, 
  Eye, EyeOff, Loader2, ArrowRight, ArrowLeft 
} from "lucide-react";

export default function OnboardingPage() {
  const { user, role, loading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields State
  const [form, setForm] = useState({
    fullName: "",
    whatsapp: "",
    telegram: "",
    mt5Account: "",
    broker: "Exness",
    server: "",
    masterPassword: "",
    agreement: false
  });

  // Guard: Jika tidak login, tendang ke login area
  useEffect(() => {
    if (!isAuthLoading && !user) router.push("/login");
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || !user) {
    return <div className="flex h-screen items-center justify-center bg-[#030712] font-mono text-blue-500 animate-pulse text-xs tracking-widest uppercase">Securing Session Matrix...</div>;
  }

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  // LOGIKA SUBMIT DATA & BOT TRIGGER
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.agreement) return alert("Anda wajib menyetujui Terms & Conditions!");
    setIsSubmitting(true);

    try {
      // 1. Simpan profil investor dan paksa role menjadi 'investor'
      await set(ref(db, `users/${user.uid}`), {
        email: user.email,
        role: "investor",
        name: form.fullName,
        whatsapp: form.whatsapp,
        telegram: form.telegram || "-",
        onboarding_submitted: true,
        createdAt: new Date().toISOString()
      });

      // 2. Kirim data akun ke antrean persetujuan (approval queue) untuk tim KRX
      await set(ref(db, `approval_queue/${form.mt5Account}`), {
        uid: user.uid,
        email: user.email,
        name: form.fullName,
        broker: form.broker,
        server: form.server,
        masterPassword: form.masterPassword,
        submittedAt: new Date().toISOString()
      });

      // 3. 🚀 TEMBAK NOTIFIKASI TELEGRAM VIA NEXT.JS API CENTRAL
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `🚨 <b>NEW INVESTOR ONBOARDING DONE</b>\n\n👤 <b>Klien:</b> ${form.fullName}\n📧 <b>Email:</b> ${user.email}\n📞 <b>WhatsApp:</b> ${form.whatsapp}\n✈️ <b>Telegram:</b> @${form.telegram || '-'}\n━━━━━━━━━━━━━━━━━━\n💳 <b>Akun MT5:</b> <code>${form.mt5Account}</code>\n🏦 <b>Broker:</b> ${form.broker}\n🖥️ <b>Server:</b> <code>${form.server}</code>\n\n⚠️ Klien sedang berada di ruang tunggu. Segera cek <b>Approval Center</b> untuk aktivasi VPS dan Node EA! ⚡`
        })
      });

      // 4. Sukses, bawa ke dashboard (klien akan otomatis melihat status pending)
      router.push("/dashboard");

    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan sistem saat mendaftar. Hubungi admin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 font-sans relative text-white">
      
      {/* Background Matrix Effect */}
      <div className="absolute inset-0 z-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_0_60px_rgba(147,51,234,0.08)]">
        
        {/* Progress Tracker */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5 font-mono text-[10px] tracking-widest text-slate-500 uppercase font-bold">
          <span className={step === 1 ? "text-purple-500" : "text-green-500"}>01. CONTACTS</span>
          <div className={`h-px flex-grow mx-4 ${step > 1 ? 'bg-green-500/30' : 'bg-white/10'}`}></div>
          <span className={step === 2 ? "text-purple-500" : step > 2 ? "text-green-500" : ""}>02. METATRADER 5</span>
          <div className={`h-px flex-grow mx-4 ${step > 2 ? 'bg-green-500/30' : 'bg-white/10'}`}></div>
          <span className={step === 3 ? "text-purple-500" : ""}>03. VERIFY</span>
        </div>

        {/* STEP 1: CONTACT INFO */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Informasi Kontak Anda</h2>
              <p className="text-xs text-slate-500 mt-1">Guna pengiriman bot notifikasi harian langsung ke saku Anda.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 text-slate-500" size={16} />
                <input type="text" required value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-purple-500 transition-all" placeholder="Sesuai nama rekening/identitas"/>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nomor WhatsApp (Aktif)</label>
              <div className="relative">
                <Phone className="absolute left-4 top-3.5 text-slate-500" size={16} />
                <input type="tel" required value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-purple-500 transition-all" placeholder="Contoh: +62812345678"/>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Username Telegram (Opsional)</label>
              <div className="relative">
                <Send className="absolute left-4 top-3.5 text-slate-500" size={16} />
                <input type="text" value={form.telegram} onChange={e => setForm({...form, telegram: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-purple-500 transition-all" placeholder="Tanpa simbol @ (Contoh: kiroix)"/>
              </div>
            </div>

            <button type="button" onClick={nextStep} disabled={!form.fullName || !form.whatsapp} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-xs tracking-widest uppercase rounded-xl py-3.5 mt-6 flex items-center justify-center gap-2 transition-all">
              LANJUT DETAIL AKUN <ArrowRight size={14}/>
            </button>
          </div>
        )}

        {/* STEP 2: METATRADER 5 KREDENSIAL */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Kredensial Terminal MT5</h2>
              <p className="text-xs text-slate-500 mt-1">Masukkan data akun trading Anda agar tim KRX dapat menyetel VPS.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pilih Broker</label>
                <select value={form.broker} onChange={e => setForm({...form, broker: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm outline-none cursor-pointer focus:border-purple-500">
                  <option value="Exness">Exness</option>
                  <option value="XM">XM Global</option>
                  <option value="OctaFX">OctaFX</option>
                  <option value="FBS">FBS Server</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nomor Akun MT5</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 text-slate-500" size={16} />
                  <input type="number" required value={form.mt5Account} onChange={e => setForm({...form, mt5Account: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-purple-500 transition-all" placeholder="Login ID"/>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Server Broker (Sangat Wajib Presisi)</label>
              <div className="relative">
                <Server className="absolute left-4 top-3.5 text-slate-500" size={16} />
                <input type="text" required value={form.server} onChange={e => setForm({...form, server: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-purple-500 transition-all" placeholder="Contoh: Exness-MT5Real37"/>
              </div>
            </div>

            <div className="space-y-1.5 relative">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Master Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-slate-500" size={16} />
                <input type={showPassword ? "text" : "password"} required value={form.masterPassword} onChange={e => setForm({...form, masterPassword: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl pl-11 pr-12 py-3 text-sm outline-none focus:border-purple-500 transition-all" placeholder="Password Utama Akun Trading"/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-500 hover:text-white transition-colors">
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              
              {/* BOX DISCLAIMER SECURITY */}
              <div className="mt-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-[10px] text-amber-400 leading-relaxed font-medium">
                🛡️ <b>SECURITY NOTICE:</b> Master Password dikirim dan dienkripsi murni agar server VPS kuantitatif tim KRX dapat mengeksekusi order perdagangan. Tim KRX <b>TIDAK MEMILIKI AKSES</b> untuk menarik dana (Withdrawal) Anda, karena penarikan dana mutlak hanya bisa diproses lewat dashboard website broker pribadi Anda.
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button type="button" onClick={prevStep} className="px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all flex items-center justify-center"><ArrowLeft size={16}/></button>
              <button type="button" onClick={nextStep} disabled={!form.mt5Account || !form.server || !form.masterPassword} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-xs tracking-widest uppercase rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all">
                TINJAU LEGALITAS <ArrowRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: FINAL VERIFICATION & LEGAL T&C */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Pernyataan & Persetujuan</h2>
              <p className="text-xs text-slate-500 mt-1">Langkah akhir perlindungan hukum dan aktivasi sistem.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 text-xs text-slate-400 max-h-48 overflow-y-auto custom-scrollbar font-medium leading-relaxed">
              <p className="font-bold text-white uppercase tracking-wider text-[10px] text-purple-400">KRX RISK DISCLAIMER & COMPLIANCE</p>
              <p>1. Perdagangan aset finansial instrumen komoditas (XAUUSD) memiliki risiko tinggi dan berpotensi menghilangkan sebagian atau seluruh modal investasi Anda.</p>
              <p>2. Penggunaan algoritma kuantitatif KRX adalah bentuk kesepakatan hosting terpusat di mana pengelolaan kualitas eksekusi bot diatur sepenuhnya oleh tim KRX.</p>
              <p>3. Hasil kinerja perdagangan masa lalu (historical profit) yang dikirimkan oleh sistem saraf notifikasi harian tidak menjamin hasil profit di masa depan.</p>
            </div>

            <label className="flex items-start gap-3 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl cursor-pointer select-none group">
              <input 
                type="checkbox" 
                className="peer sr-only"
                checked={form.agreement}
                onChange={e => setForm({...form, agreement: e.target.checked})}
              />
              <div className="w-5 h-5 border-2 border-slate-500 rounded flex items-center justify-center peer-checked:bg-purple-500 peer-checked:border-purple-500 transition-colors shrink-0 mt-0.5">
                {form.agreement && <ShieldCheck size={14} className="text-white" />}
              </div>
              <p className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors leading-tight">
                Saya memahami risiko pasar, setuju dengan isi disclaimer, serta bersedia menerima log laporan trading harian via Email, WhatsApp, dan Telegram.
              </p>
            </label>

            <div className="flex gap-4">
              <button type="button" onClick={prevStep} className="px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all flex items-center justify-center"><ArrowLeft size={16}/></button>
              <button 
                type="submit" 
                disabled={isSubmitting || !form.agreement}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-xs tracking-widest uppercase rounded-xl py-3.5 shadow-[0_0_25px_rgba(147,51,234,0.3)] transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 size={16} className="animate-spin" /> SUBMITTING PROTOCOL...</>
                ) : (
                  <><ShieldCheck size={16}/> KIRIM DATA & AJUKAN AKTIVASI</>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}