"use client";
import { useState } from "react";
import { ShieldCheck, KeyRound, Server, User, CalendarDays, CheckCircle2, Send, Phone, Tag, Clock } from "lucide-react";
import { db } from "../../lib/firebase";
import { ref, set } from "firebase/database";
import { useAuth } from "../context/AuthContext";

export default function CreateLicense() {
  const { role, user } = useAuth(); 
  const [formData, setFormData] = useState({
    investorName: "", email: "", telegram: "", whatsapp: "",
    accountNumber: "", brokerServer: "", durationMonths: "1",
    discountType: "NONE", manualDiscountValue: "",
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
        // 🟢 FIX: Arahkan ke pintu utama approval_queue
        await set(ref(db, `approval_queue/${formData.accountNumber}`), {
          name: formData.investorName,
          email: formData.email,
          telegram: formData.telegram,
          whatsapp: formData.whatsapp,
          broker: formData.brokerServer,  // Diseragamkan
          server: formData.brokerServer,
          duration_months: formData.durationMonths,
          discount_applied: finalDiscount,
          created_at: createdAt.toString(),
          status: "pending",
          requested_by: user.email,
          uid: "" // Kosong menandakan ini dari manual admin
        });
        
        setSubmitStatus({
          type: 'pending',
          message: `Pengajuan lisensi untuk akun ${formData.accountNumber} masuk ke Approval Center.`
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
          expiry_date: expiredAt.toString(),
          last_heartbeat: createdAt.toString(),
          discount_applied: finalDiscount,
          requested_by: user.email,
          source: "ADMIN_DIRECT"
        });

        // Buat profil dasar di node EA
        await set(ref(db, `account_data/${formData.accountNumber}/metadata`), {
          investor_name: formData.investorName,
          broker: formData.brokerServer,
          bot_type: "NON_ML",
          created_at: new Date().toISOString()
        });

        setSubmitStatus({ type: 'approved', key: newLicenseKey, account: formData.accountNumber });
      }
      
    } catch (error) {
      console.error("Error:", error);
      alert("Terjadi kesalahan sistem saat menghubungi Firebase.");
    } finally {
      setIsLoading(false);
    }
  };

  // ... (Sisa UI CreateLicense tetap sama persis seperti file lama Anda)
  // Anda cukup mengganti logika handler di atas, UI render-nya biarkan utuh.
  // ...