"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { 
    LayoutDashboard, BarChart, Key, ShieldCheck, 
    AlertCircle, UserPlus, Cpu, LogOut, Sun, Moon, Menu, X, Globe,
    Folders, Clock, CreditCard, TrendingUp, Analytics // Ikon baru untuk Group Manager, Cron Manager & Subscription
} from "lucide-react";

import { useAuth } from "../app/context/AuthContext";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";

// ============================================================================
// DICTIONARY NAVIGASI (EN & ID)
// ============================================================================
const navDict = {
  en: {
    dashboard: "Dashboard",
    analytics: "Analytics",
    license: "License",
    manager: "Manager",
    approval: "Approval",
    users: "Users",
    groups: "Groups",
    ea_control: "EA Control",
    subscription: "Subscription",
    logout: "Logout",
    logout_confirm: "Are you sure you want to exit?",
    sys_title: "MONITORING SYSTEM"
  },
  id: {
    dashboard: "Dashboard",
    analytics: "Analitik",
    license: "Lisensi",
    manager: "Pengelola",
    approval: "Persetujuan",
    users: "Pengguna",
    groups: "Kelompok",
    ea_control: "Kontrol EA",
    subscription: "Langganan",
    logout: "Keluar",
    logout_confirm: "Apakah Anda yakin ingin keluar?",
    sys_title: "SISTEM MONITORING"
  }
};

export default function AppNavbar() {
  const pathname = usePathname();
  const { role } = useAuth();
  
  const [isDark, setIsDark] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Fitur Bilingual: Default English
  const [lang, setLang] = useState("en");
  const t = navDict[lang];

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Theme Handler
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const isDarkMode = savedTheme === "dark" || !savedTheme; 
    setIsDark(isDarkMode);
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleLogout = async () => {
    if (confirm(t.logout_confirm)) {
      try { await signOut(auth); } catch (error) { console.error("Logout error:", error); }
    }
  };

  // Dinamis menyusun daftar menu dengan Label dari Dictionary
  const getNavItems = () => {
    let items = [
      { href: "/dashboard", icon: <LayoutDashboard size={18} />, label: t.dashboard },
      { href: "/analytics", icon: <BarChart size={18} />, label: t.analytics },
    ];

    if (role === "admin" || role === "super_admin") {
      items.push(
        { type: "divider" },
        { href: "/create-license", icon: <Key size={18} />, label: t.license },
        { href: "/license-manager", icon: <ShieldCheck size={18} />, label: t.manager }
      );
    }

    if (role === "investor") {
      items.push(
        { type: "divider" },
        { href: "/subscription-area", icon: <CreditCard size={18} />, label: t.subscription, color: "purple" }
      );
    }

    if (role === "admin") {
      items.push(
        { type: "divider" },
        { href: "/group-manager", icon: <Folders size={18} />, label: t.groups, color: "purple" },
        { href: "/ea-manager", icon: <Cpu size={18} />, label: t.ea_control, color: "blue" },
        { href: "/subscription-area", icon: <CreditCard size={18} />, label: t.subscription, color: "purple" }
      );
    }

    if (role === "super_admin") {
      items.push(
        { type: "divider" },
        { href: "/group-manager", icon: <Folders size={18} />, label: t.groups, color: "purple" },
        { href: "/approval-center", icon: <AlertCircle size={18} />, label: t.approval, color: "orange" },
        { href: "/user-management", icon: <UserPlus size={18} />, label: t.users, color: "green" },
        { href: "/ea-manager", icon: <Cpu size={18} />, label: t.ea_control, color: "blue" },
        { href: "/cron-manager", icon: <Clock size={18} />, label: "Cron Manager", color: "cyan" },
        { href: "/subscription-area", icon: <CreditCard size={18} />, label: t.subscription, color: "purple" },
        { href: "/deep-analytics", icon: <BarChart size={18} />, label: "Deep Analytics", color: "cyan" }
      );
    }
    return items;
  };

  return (
    <nav className="bg-[var(--card-bg)] border-b border-[var(--card-border)] sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* LOGO AREA (KLIK UNTUK KE LANDING PAGE) */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-sm tracking-tighter">KRX</span>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-[var(--foreground)]">DASHBOARD</span>
              <p className="text-[10px] text-[var(--muted-foreground)] -mt-1 hidden sm:block">{t.sys_title}</p>
            </div>
          </Link>

          {/* DESKTOP NAVIGATION */}
          <div className="hidden lg:flex items-center gap-1">
            {getNavItems().map((item, idx) => {
              if (item.type === "divider") return <div key={`div-${idx}`} className="w-px h-6 bg-[var(--card-border)] mx-1" />;
              return <NavLink key={item.href} {...item} pathname={pathname} />;
            })}

            <div className="w-px h-6 bg-[var(--card-border)] mx-2" />

            {/* Language Toggle Desktop */}
            <div className="flex items-center bg-[var(--muted)]/50 p-1 rounded-lg border border-[var(--card-border)] mr-2">
              <button onClick={() => setLang('en')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${lang === 'en' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}>EN</button>
              <button onClick={() => setLang('id')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${lang === 'id' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}>ID</button>
            </div>

            <button onClick={toggleTheme} className="p-2.5 rounded-xl hover:bg-[var(--muted)] transition-colors">{isDark ? <Sun size={20} /> : <Moon size={20} />}</button>
            <button onClick={handleLogout} className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"><LogOut size={20} /></button>
          </div>

          {/* MOBILE NAVIGATION TOGGLE */}
          <div className="flex lg:hidden items-center gap-2">
            <button onClick={() => setLang(lang === 'en' ? 'id' : 'en')} className="p-2 rounded-xl text-xs font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20">{lang.toUpperCase()}</button>
            <button onClick={toggleTheme} className="p-2 rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)]">{isDark ? <Sun size={20} /> : <Moon size={20} />}</button>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-xl text-[var(--foreground)] bg-[var(--muted)]">{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
          </div>
        </div>
      </div>

      {/* MOBILE DROPDOWN MENU */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-[var(--card-bg)] border-t border-[var(--card-border)] absolute w-full left-0 animate-in slide-in-from-top-2 duration-200 shadow-2xl">
          <div className="px-4 py-4 space-y-2 overflow-y-auto max-h-[calc(100vh-4rem)]">
            {getNavItems().map((item, idx) => {
              if (item.type === "divider") return <div key={`mdiv-${idx}`} className="h-px w-full bg-[var(--card-border)] my-2" />;
              return <NavLink key={item.href} {...item} pathname={pathname} isMobile={true} />;
            })}
            <div className="h-px w-full bg-[var(--card-border)] my-4" />
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 bg-red-500/10"><LogOut size={18} /> {t.logout}</button>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, icon, label, pathname, color = null, isMobile = false }) {
  const isActive = pathname === href;
  const neonClasses = {
    purple: isActive ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]" : "bg-purple-600/10 text-purple-500 hover:bg-purple-600/20",
    orange: isActive ? "bg-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]" : "bg-orange-600/10 text-orange-500 hover:bg-orange-600/20",
    green: isActive ? "bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "bg-green-600/10 text-green-500 hover:bg-green-600/20",
    blue: isActive ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-blue-600/10 text-blue-500 hover:bg-blue-600/20",
    cyan: isActive ? "bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]" : "bg-cyan-600/10 text-cyan-500 hover:bg-cyan-600/20"
  };
  const dynamicClasses = color && neonClasses[color] ? neonClasses[color] : isActive ? "bg-[var(--muted)] text-[var(--primary)] shadow-sm" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]";

  return (
    <Link href={href} className={`px-4 py-2.5 text-sm font-medium rounded-xl flex items-center gap-3 transition-all ${dynamicClasses} ${isMobile ? "w-full" : ""}`}>
      {icon} <span className={isMobile ? "block" : "hidden xl:inline"}>{label}</span>
    </Link>
  );
}