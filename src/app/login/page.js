"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { ref, get } from "firebase/database";
import { useRouter } from "next/navigation";
import { ShieldAlert, Lock, Mail, Loader2, Zap, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();

  // === AUTO REDIRECT TO LANDING PAGE (5 MINUTES IDLE) ===
  useEffect(() => {
    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => router.push("/"), 300000); 
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
    };
  }, [router]);

  // LOGIN EMAIL & PASSWORD TRADISIONAL
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Cek Data User di Database
      const userRef = ref(db, `users/${uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        // 🟢 FIX JALUR VVIP: Jika Admin/Super Admin ATAU sudah pernah onboarding, lempar ke Dashboard!
        if (userData.role === 'super_admin' || userData.role === 'admin' || userData.onboarding_submitted) {
          router.push("/dashboard");
        } else {
          // Investor lama yang belum isi form onboarding
          router.push("/onboarding");
        }
      } else {
        // User tidak ditemukan di DB (Aneh, tapi arahkan ke onboarding untuk amannya)
        router.push("/onboarding");
      }
    } catch (err) {
      setError("Access Denied: Invalid credentials or unrecognized node.");
      setIsLoading(false);
    }
  };

  // 🟢 LOGIN / REGISTRASI VIA GOOGLE SSO
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError("");
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const uid = result.user.uid;

      // Cek Data User di Database
      const userRef = ref(db, `users/${uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        // 🟢 FIX JALUR VVIP untuk Google SSO
        if (userData.role === 'super_admin' || userData.role === 'admin' || userData.onboarding_submitted) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } else {
        // Jika pengguna baru gres dari Google, arahkan ke onboarding form
        router.push("/onboarding");
      }
    } catch (err) {
      console.error(err);
      setError("Google Authentication failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      <Link href="/" className="absolute top-6 left-6 z-50 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors tracking-widest uppercase">
        <ArrowLeft size={16} /> Return to Dashboard
      </Link>

      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 bottom-0 m-auto h-[300px] w-[300px] rounded-full bg-blue-600 opacity-20 blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(59,130,246,0.1)] backdrop-blur-sm">
          
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              <ShieldAlert className="text-blue-500" size={32} />
            </div>
            <h1 className="text-2xl font-black text-white tracking-widest uppercase">LOGIN AREA</h1>
            <p className="text-xs text-slate-500 font-mono mt-2 tracking-widest flex items-center gap-1">
              <Zap size={10} className="text-amber-500" /> KRX SECURITY PROTOCOL
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold p-3 rounded-lg mb-6 text-center animate-pulse uppercase tracking-wider">
              {error}
            </div>
          )}

          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isLoading}
            className="w-full bg-white text-black hover:bg-slate-200 font-bold text-xs tracking-widest uppercase rounded-xl py-3.5 mb-6 transition-all flex items-center justify-center gap-3 shadow-md disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <Loader2 size={18} className="animate-spin text-slate-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-6 opacity-30">
            <div className="h-px bg-slate-500 flex-grow"></div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">OR VIA CREDENTIALS</span>
            <div className="h-px bg-slate-500 flex-grow"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-1">Node ID (Email)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="inv-jhon@krx.com" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-1">Node Credential (Password)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={isLoading || isGoogleLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-sm tracking-widest uppercase rounded-xl py-3.5 mt-4 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50">
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> AUTHENTICATING...</>
              ) : (
                <><Lock size={16}/> ESTABLISH CONNECTION</>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}