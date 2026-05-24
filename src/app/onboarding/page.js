"use client";

import { useState, useEffect } from "react";
import {
  User,
  Mail,
  MessageCircle,
  ArrowRight,
  Shield,
  AlertCircle,
  Check,
  Loader2,
  Terminal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { ref, get, set, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "sonner";

// ============================================================================
// ONBOARDING PAGE - User wajib input Nama, Email, & ID Telegram
// Redirect dari halaman login bila user status "pending_setup"
// ============================================================================

const MIN_TELEGRAM_ID_LENGTH = 6;

export default function OnboardingPage() {
  const router = useRouter();

  // User data dari Firebase Auth
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    telegramId: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState("form"); // 'form' | 'success'

  // ── Check Auth State ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setAuthUser(user);

      // Pre-fill email from auth
      setFormData((prev) => ({
        ...prev,
        email: user.email || "",
      }));

      // Check existing user data in Firebase
      try {
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        if (snap.exists()) {
          const userData = snap.val();
          // If already set up, redirect to dashboard
          if (userData.setup_status === "completed" && userData.fullName) {
            router.push("/dashboard");
            return;
          }
          // Pre-fill existing data
          setFormData((prev) => ({
            ...prev,
            fullName: userData.fullName || "",
            email: userData.email || user.email || "",
            telegramId: userData.telegramId || "",
          }));
        }
      } catch (err) {
        console.error("Error checking user data:", err);
      }

      setAuthLoading(false);
    });

    return () => unsub();
  }, [router]);

  // ── Validation ──
  const validate = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = "Name must be at least 2 characters";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.telegramId.trim()) {
      newErrors.telegramId = "Telegram ID is required";
    } else if (formData.telegramId.trim().length < MIN_TELEGRAM_ID_LENGTH) {
      newErrors.telegramId = `Telegram ID seems too short (min ${MIN_TELEGRAM_ID_LENGTH} chars)`;
    } else {
      const tid = formData.telegramId.trim();
      const isUsername = tid.startsWith("@");
      const isNumeric = /^\d+$/.test(tid);
      // Accept @username format or numeric ID
      if (!isUsername && !isNumeric) {
        newErrors.telegramId = "Use @username format or numeric Telegram ID only";
      } else if (isUsername && tid.length < 4) {
        newErrors.telegramId = "Username too short (min 3 chars after @)";
      } else if (isNumeric && (tid.length < 6 || tid.length > 15)) {
        newErrors.telegramId = "Numeric Telegram ID should be 6-15 digits";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Handle Input Tab (auto-focus next field) ──
  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear error for this field on change
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (!authUser) {
      toast.error("Session expired. Please login again.");
      router.push("/login");
      return;
    }

    setSubmitting(true);
    try {
      const userRef = ref(db, `users/${authUser.uid}`);
      const snap = await get(userRef);
      const existingData = snap.exists() ? snap.val() : {};

      const onboardingData = {
        uid: authUser.uid,
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        telegramId: formData.telegramId.trim(),
        setup_status: "pending_setup", // Setelah isi form, status menunggu approval admin
        role: existingData.role || "investor",
        onboarded_at: serverTimestamp(),
      };

      await set(userRef, {
        ...existingData,
        ...onboardingData,
      });

      setStep("success");
      toast.success("Setup submitted! Waiting for admin approval.", {
        duration: 5000,
      });
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("Failed to save your data. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading State ──
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center animate-pulse">
            <Loader2 size={24} className="text-blue-400 animate-spin" />
          </div>
          <p className="text-[var(--muted-foreground)] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      {/* Grid Lines Decoration */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-600/25 mb-4 ring-1 ring-blue-400/30">
            <Terminal size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
            KRX EA DASHBOARD
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Complete your account setup to continue
          </p>
        </div>

        {step === "form" ? (
          <>
            {/* Status Banner */}
            <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
              <Shield size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 font-semibold text-sm">
                  Account Setup Required
                </p>
                <p className="text-amber-400/80 text-xs mt-0.5">
                  Your account needs admin approval after setup. Fill in all
                  fields below.
                </p>
              </div>
            </div>

            {/* Onboarding Form */}
            <form
              onSubmit={handleSubmit}
              className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 space-y-5 shadow-2xl"
            >
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={16} className="text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={handleChange("fullName")}
                    placeholder="e.g. John Doe"
                    autoFocus
                    className={`w-full pl-10 pr-3 py-2.5 bg-[var(--muted)]/50 border rounded-xl text-sm text-[var(--foreground)] placeholder:text-slate-600 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 ${
                      errors.fullName
                        ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
                        : "border-[var(--card-border)]"
                    }`}
                  />
                </div>
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.fullName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={16} className="text-slate-500" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={handleChange("email")}
                    placeholder="you@example.com"
                    className={`w-full pl-10 pr-3 py-2.5 bg-[var(--muted)]/50 border rounded-xl text-sm text-[var(--foreground)] placeholder:text-slate-600 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 ${
                      errors.email
                        ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
                        : "border-[var(--card-border)]"
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.email}
                  </p>
                )}
              </div>

              {/* Telegram ID */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                  Telegram ID / Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MessageCircle size={16} className="text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={formData.telegramId}
                    onChange={handleChange("telegramId")}
                    placeholder="e.g. @johndoe or 123456789"
                    className={`w-full pl-10 pr-3 py-2.5 bg-[var(--muted)]/50 border rounded-xl text-sm text-[var(--foreground)] placeholder:text-slate-600 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 ${
                      errors.telegramId
                        ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
                        : "border-[var(--card-border)]"
                    }`}
                  />
                </div>
                {errors.telegramId && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.telegramId}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-slate-600">
                  Used for all billing notifications & urgent alerts
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-[10px] text-slate-600 mt-4">
              Managed by KRX Quantitative • All data is encrypted and secure
            </p>
          </>
        ) : (
          /* ── Success State ── */
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-8 shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 border border-green-500/30 rounded-full mb-4">
              <Check size={36} className="text-green-400" />
            </div>
            <h2 className="text-xl font-black text-[var(--foreground)] mb-2">
              Setup Submitted!
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              Your profile has been saved. An admin will review your account
              shortly. You'll be notified once your account is activated.
            </p>
            <div className="mt-6 p-4 bg-blue-600/5 border border-blue-600/20 rounded-xl text-left">
              <p className="text-xs text-blue-400 font-semibold mb-2">
                YOUR INFO:
              </p>
              <div className="space-y-1.5 text-xs text-[var(--muted-foreground)]">
                <p>
                  <span className="text-slate-600">Name:</span>{" "}
                  <span className="text-[var(--foreground)]">
                    {formData.fullName}
                  </span>
                </p>
                <p>
                  <span className="text-slate-600">Email:</span>{" "}
                  <span className="text-[var(--foreground)]">
                    {formData.email}
                  </span>
                </p>
                <p>
                  <span className="text-slate-600">Telegram:</span>{" "}
                  <span className="text-[var(--foreground)]">
                    {formData.telegramId}
                  </span>
                </p>
                <p>
                  <span className="text-slate-600">Status:</span>{" "}
                  <span className="text-amber-400">Pending Admin Approval</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 w-full py-3 bg-[var(--muted)] hover:bg-[var(--muted)]/70 text-sm font-semibold text-[var(--foreground)] rounded-xl transition-all"
            >
              Go to Dashboard (Limited Access)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}