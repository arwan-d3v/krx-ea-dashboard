"use client";
import { useState } from "react";
import { ShieldCheck, KeyRound, Server, User, CalendarDays, CheckCircle2, Mail, Send, Phone, Tag, Clock } from "lucide-react";
import { db } from "../../lib/firebase";
import { ref, push, set } from "firebase/database";
import { useAuth } from "../context/AuthContext";

export default function CreateLicense() {
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

  const generateHash = async (account, broker, createdAt, expiredAt) => {
    const rawString = `${account}|${broker}|${createdAt}|${expiredAt}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(rawString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    return `KRX-${hashHex.substring(0, 4)}-${hashHex.substring(4, 8)}-${hashHex.substring(8, 12)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const createdAt = Date.now();
      const durationMs = parseInt(formData.durationMonths) * 30 * 24 * 60 * 60 * 1000;
      const expiredAt = createdAt + durationMs;

      let finalDiscount = 0;
      if (formData.discountType === "IB_30") finalDiscount = 30;
      else if (formData.discountType === "MANUAL" && role === "super_admin") {
        finalDiscount = parseInt(formData.manualDiscountValue) || 0;
      }

      if (role === "admin") {
        await set(ref(db, `approval_queue/${formData.accountNumber}`), {
          name: formData.investorName,
          email: formData.email,
          telegram: formData.telegram,
          whatsapp: formData.whatsapp,
          broker: formData.brokerServer,
          server: formData.brokerServer,
          duration_months: formData.durationMonths,
          discount_applied: finalDiscount,
          created_at: createdAt.toString(),
          status: "pending",
          requested_by: user.email,
          uid: "" 
        });
        
        setSubmitStatus({
          type: 'pending',
          message: `Pengajuan lisensi untuk akun ${formData.accountNumber} berhasil dikirim ke Super Admin.`
        });

      } else if (role === "super_admin") {
        const newLicenseKey = await generateHash(formData.accountNumber, formData.brokerServer, createdAt, expiredAt);
        
        await set(ref(db, `licenses/${formData.accountNumber}`), {
          license_key: newLicenseKey,
          investor_name: formData.investorName,
          email: formData.email,
          telegram: formData.telegram,
          whatsapp: formData.whatsapp,
          broker_server: formData.brokerServer,
          status: "ACTIVE",
          expiry_date: expiredAt,
          last_heartbeat: createdAt,
          discount_applied: finalDiscount,
          requested_by: user.email,
          source: "ADMIN_DIRECT"
        });

        await set(ref(db, `account_data/${formData.accountNumber}/metadata`), {
          investor_name: formData.investorName,
          broker: formData.brokerServer,
          bot_type: "NON_ML",
          created_at: new Date().toISOString()
        });

        setSubmitStatus({
          type: 'approved',
          key: newLicenseKey,
          account: formData.accountNumber
        });
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Terjadi kesalahan sistem.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-5 md:p-10 space-y-6 transition-colors duration-300 max-w-5xl mx-auto">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white">
        <div className="flex items-center gap-4">
          <div className="bg-teal-500/10 p-4 rounded-2xl text-teal-500">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Registrasi Lisensi</h2>
            <p className="text-sm text-slate-400 mt-1">Generate atau ajukan lisensi EA.</p>
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-8 text-white">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <input type="text" required value={formData.investorName} onChange={(e) => setFormData({...formData, investorName: e.target.value})} placeholder="Nama Lengkap" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm focus:border-purple-500 outline-none" />
            <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Email" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm focus:border-purple-500 outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <input type="number" required value={formData.accountNumber} onChange={(e) => setFormData({...formData, accountNumber: e.target.value})} placeholder="Akun MT5" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm focus:border-purple-500 outline-none" />
            <input type="text" required value={formData.brokerServer} onChange={(e) => setFormData({...formData, brokerServer: e.target.value})} placeholder="Server Broker" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm focus:border-purple-500 outline-none" />
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-purple-600 py-4 rounded-xl font-black text-xs uppercase tracking-widest">
            {isLoading ? "Memproses..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}