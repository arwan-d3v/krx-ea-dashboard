"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Shield, Eye, Award, Star } from "lucide-react";
import { db } from "../lib/firebase";
import { ref, onValue } from "firebase/database";

/**
 * FeaturedInvestors Component
 * Menampilkan investor dengan Green Flag untuk branding dan trust building
 * Hanya menampilkan akun dengan account_flag = "green" (Public Investor)
 */
export default function FeaturedInvestors({ lang = "en" }) {
  const [featuredInvestors, setFeaturedInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalInvestors: 0,
    totalGain: 0,
    avgDailyGain: 0,
  });
  const [accountData, setAccountData] = useState({});
  const [usersData, setUsersData] = useState({});
  const [groupsData, setGroupsData] = useState({});

  const dict = {
    en: {
      title: "TOP PERFORMING INVESTORS",
      subtitle: "Real-time performance from our verified public investors",
      gain: "Total Gain",
      dailyGain: "Avg Daily",
      since: "Since",
      verified: "Verified",
      viewDetails: "View Details",
      totalInvestors: "Active Investors",
      avgPerformance: "Avg Performance",
      trustScore: "Trust Score",
      disclaimer: "*Data updated in real-time. Past performance does not guarantee future results.",
    },
    id: {
      title: "INVESTOR PERFORMA TERBAIK",
      subtitle: "Performa real-time dari investor publik terverifikasi kami",
      gain: "Total Keuntungan",
      dailyGain: "Rata-rata Harian",
      since: "Sejak",
      verified: "Terverifikasi",
      viewDetails: "Lihat Detail",
      totalInvestors: "Investor Aktif",
      avgPerformance: "Performa Rata-rata",
      trustScore: "Skor Kepercayaan",
      disclaimer: "*Data diperbarui secara real-time. Performa masa lalu tidak menjamin hasil di masa depan.",
    },
  };

  const t = dict[lang] || dict.en;

  useEffect(() => {
    const fetchFeaturedInvestors = () => {
      const accountDataRef = ref(db, "account_data");
      const usersRef = ref(db, "users");
      const groupsRef = ref(db, "groups");

      onValue(accountDataRef, (accountSnap) => {
        onValue(usersRef, (usersSnap) => {
          onValue(groupsRef, (groupsSnap) => {
            const accounts = accountSnap.exists() ? accountSnap.val() : {};
            const users = usersSnap.exists() ? usersSnap.val() : {};
            const groups = groupsSnap.exists() ? groupsSnap.val() : {};

            // Simpan data ke state
            setAccountData(accounts);
            setUsersData(users);
            setGroupsData(groups);

            const investors = [];

            Object.entries(accounts).forEach(([accNum, accData]) => {
              const metadata = accData.metadata || {};
              const realtimeStats = accData.realtime_stats || {};
              const snapshots = accData.snapshots || {};

              // Cek flag dari metadata
              const metadataFlag = metadata.account_flag || "green";
              
              // Cek flag dari groups
              let hasHiddenFlag = false;
              Object.values(groups).forEach((group) => {
                if (group.account_flags && group.account_flags[accNum]) {
                  if (group.account_flags[accNum] === "black") {
                    hasHiddenFlag = true;
                  }
                }
              });

              // Jika flag adalah "black" di mana saja, sembunyikan
              if (metadataFlag === "black" || hasHiddenFlag) return;

              // Cari user yang memiliki akun ini
              let ownerInfo = null;
              Object.entries(users).forEach(([uid, userData]) => {
                if (userData.subscriptions) {
                  Object.values(userData.subscriptions).forEach((vpsData) => {
                    if (vpsData.accounts && vpsData.accounts[accNum]) {
                      ownerInfo = {
                        uid,
                        fullName: userData.fullName || "Investor",
                        email: userData.email || "",
                      };
                    }
                  });
                }
              });

              // Hitung metrics dari snapshots
              let totalGain = 0;
              let dailyGains = [];
              let firstDate = null;
              let lastDate = null;

              Object.entries(snapshots).forEach(([tsKey, snapshot]) => {
                const gain = Number(snapshot.daily_growth_percent || snapshot.growth || 0);
                totalGain += gain;
                if (gain !== 0) dailyGains.push(gain);

                const date = new Date(parseInt(tsKey) * (parseInt(tsKey) < 10000000000 ? 1000 : 1));
                if (!firstDate || date < firstDate) firstDate = date;
                if (!lastDate || date > lastDate) lastDate = date;
              });

              const avgDailyGain = dailyGains.length > 0 
                ? dailyGains.reduce((a, b) => a + b, 0) / dailyGains.length 
                : 0;

              const balance = Number(realtimeStats.balance || metadata.balance || 0);
              const growth = Number(realtimeStats.absolute_growth_percent || 0);

              if (growth > 0 || totalGain > 0) {
                investors.push({
                  accountNumber: accNum,
                  investorName: ownerInfo?.fullName || metadata.investor_name || "Public Investor",
                  totalGain: growth || totalGain,
                  avgDailyGain,
                  balance,
                  botType: metadata.bot_type || "QUANTITATIVE",
                  broker: metadata.broker || "MT5",
                  startDate: metadata.bot_start_date || (firstDate ? firstDate.toISOString().split('T')[0] : null),
                  lastUpdate: lastDate ? lastDate.toISOString() : realtimeStats.last_update,
                  status: realtimeStats.status || metadata.status || "active",
                });
              }
            });

            // Sort by total gain (descending) dan ambil top 6
            const topInvestors = investors
              .sort((a, b) => b.totalGain - a.totalGain)
              .slice(0, 6);

            setFeaturedInvestors(topInvestors);

            // Hitung stats
            if (investors.length > 0) {
              const totalGainSum = investors.reduce((sum, inv) => sum + inv.totalGain, 0);
              const avgDailySum = investors.reduce((sum, inv) => sum + inv.avgDailyGain, 0);
              setStats({
                totalInvestors: investors.length,
                totalGain: totalGainSum / investors.length,
                avgDailyGain: avgDailySum / investors.length,
              });
            }

            setLoading(false);
          });
        });
      });
    };

    fetchFeaturedInvestors();
  }, []);

  const formatCur = (val) => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(val || 0);

  const formatPct = (val) => `${Number(val || 0).toFixed(2)}%`;

  // Anonymize investor name for privacy
  const anonymizeName = (name) => {
    if (!name || name === "Investor" || name === "Public Investor") return name;
    
    // Split by space or special characters
    const parts = name.split(/(['\-\s])/);
    
    return parts.map(part => {
      // Keep special characters as is
      if (part.match(/['\-\s]/)) return part;
      
      // If very short (1-2 chars), show first char only
      if (part.length <= 2) return part[0] + '*'.repeat(part.length - 1);
      
      // For longer words, show first and last char
      return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
    }).join('');
  };

  const getBotColor = (botType) => {
    switch (botType) {
      case 'GOD_MODE': return 'from-amber-500/20 to-yellow-500/20 border-amber-500/30';
      case 'BEAST_MODE': return 'from-red-500/20 to-orange-500/20 border-red-500/30';
      case 'ENIGMA_OTE': return 'from-emerald-500/20 to-green-500/20 border-emerald-500/30';
      default: return 'from-blue-500/20 to-indigo-500/20 border-blue-500/30';
    }
  };

  const getBotBadgeColor = (botType) => {
    switch (botType) {
      case 'GOD_MODE': return 'bg-amber-500/20 text-amber-400';
      case 'BEAST_MODE': return 'bg-red-500/20 text-red-400';
      case 'ENIGMA_OTE': return 'bg-emerald-500/20 text-emerald-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-pulse text-slate-400">Loading investor data...</div>
      </div>
    );
  }

  if (featuredInvestors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase">
          <Shield size={14} />
          {t.verified}
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
          {t.title}
        </h2>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto">
          {t.subtitle}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 text-center">
          <div className="text-3xl font-black text-emerald-400">{stats.totalInvestors}</div>
          <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t.totalInvestors}</div>
        </div>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 text-center">
          <div className="text-3xl font-black text-blue-400">+{formatPct(stats.totalGain)}</div>
          <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t.avgPerformance}</div>
        </div>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 text-center">
          <div className="text-3xl font-black text-purple-400">A+</div>
          <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t.trustScore}</div>
        </div>
      </div>

      {/* Investor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {featuredInvestors.map((investor, index) => (
          <div
            key={investor.accountNumber}
            className={`relative bg-gradient-to-br ${getBotColor(investor.botType)} border rounded-2xl p-6 hover:scale-105 transition-all duration-300 group overflow-hidden`}
          >
            {/* Rank Badge */}
            <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              {index === 0 ? (
                <Award size={16} className="text-amber-400" />
              ) : index === 1 ? (
                <Award size={16} className="text-slate-300" />
              ) : index === 2 ? (
                <Award size={16} className="text-amber-600" />
              ) : (
                <Star size={14} className="text-slate-400" />
              )}
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* Investor Info */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp size={20} className="text-emerald-400" />
                  </div>
                  <div>
                  <div className="font-bold text-white text-sm">{anonymizeName(investor.investorName)}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{investor.accountNumber}</div>
                  </div>
                </div>
                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${getBotBadgeColor(investor.botType)}`}>
                  {investor.botType.replace('_', ' ')}
                </span>
              </div>

              {/* Metrics */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">{t.gain}</span>
                  <span className="text-lg font-black text-emerald-400">
                    +{formatPct(investor.totalGain)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">{t.dailyGain}</span>
                  <span className="text-sm font-bold text-blue-400">
                    +{formatPct(investor.avgDailyGain)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Balance</span>
                  <span className="text-sm font-bold text-white">
                    {formatCur(investor.balance)}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                <div className="text-[10px] text-slate-500">
                  {t.since} {investor.startDate ? new Date(investor.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                  <Eye size={10} />
                  LIVE
                </div>
              </div>
            </div>

            {/* Hover Effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-center text-[10px] text-slate-500 font-bold">
        {t.disclaimer}
      </p>
    </div>
  );
}