"use client";
import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Search, 
  User, 
  Server, 
  Calendar, 
  Trash2, 
  PauseCircle, 
  PlayCircle, 
  AlertCircle,
  ExternalLink,
  Mail,
  KeyRound
} from "lucide-react";
import { db } from "../../lib/firebase";
import { ref, onValue, update, remove } from "firebase/database";

export default function LicenseManager() {
  const [licenses, setLicenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch Data Lisensi Aktif
  useEffect(() => {
    const licensesRef = ref(db, 'licenses');
    const unsubscribe = onValue(licensesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({
          accountNumber: key,
          ...data[key]
        }));
        setLicenses(list);
      } else {
        setLicenses([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fungsi Toggle Status (Active/Suspended)
  const toggleStatus = async (item) => {
    const newStatus = item.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (!confirm(`Ubah status lisensi akun ${item.accountNumber} menjadi ${newStatus}?`)) return;

    try {
      const licenseRef = ref(db, `licenses/${item.accountNumber}`);
      await update(licenseRef, { status: newStatus });
    } catch (error) {
      alert("Gagal mengubah status.");
    }
  };

  // 3. Fungsi Hapus Lisensi
  const deleteLicense = async (accountNumber) => {
    if (!confirm(`HAPUS PERMANEN lisensi akun ${accountNumber}? Investor tidak akan bisa menggunakan EA lagi.`)) return;

    try {
      const licenseRef = ref(db, `licenses/${accountNumber}`);
      await remove(licenseRef);
    } catch (error) {
      alert("Gagal menghapus lisensi.");
    }
  };

  // 4. Filter Pencarian
  const filteredLicenses = licenses.filter(item => 
    item.investor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.accountNumber.includes(searchTerm)
  );

  // Helper format tanggal
  const formatDate = (ts) => {
    if (!ts) return "-";
    return new Date(parseInt(ts)).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className="p-5 md:p-10 space-y-8 max-w-7xl mx-auto">
      
  {/* HEADER */}
      <div className="style-card flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="bg-[var(--primary)]/10 p-4 rounded-full text-[var(--primary)] shrink-0">
            <KeyRound size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--foreground)]">License Manager</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Kelola akses, masa aktif, dan kontrol keamanan investor.</p>
          </div>
        </div>

    {/* SEARCH BAR */}
        <div className="w-full md:w-80 shrink-0">
          <input 
            type="text"
            placeholder="Search investor (Nama / Nomor Akun)..."
            className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
      </div>

      {/* STATS MINI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="style-table-container p-4 flex flex-col items-center justify-center">
          <span className="text-[var(--muted-foreground)] text-xs font-bold uppercase">Total Klien</span>
          <span className="text-2xl font-bold text-[var(--foreground)]">{licenses.length}</span>
        </div>
        <div className="style-table-container p-4 flex flex-col items-center justify-center border-l-4 border-green-500">
          <span className="text-xs font-bold uppercase text-green-600">Aktif</span>
          <span className="text-2xl font-bold">{licenses.filter(l => l.status === "ACTIVE").length}</span>
        </div>
        <div className="style-table-container p-4 flex flex-col items-center justify-center border-l-4 border-red-500">
          <span className="text-xs font-bold uppercase text-red-600">Suspended</span>
          <span className="text-2xl font-bold">{licenses.filter(l => l.status === "SUSPENDED").length}</span>
        </div>
        <div className="style-table-container p-4 flex flex-col items-center justify-center">
          <span className="text-[var(--muted-foreground)] text-xs font-bold uppercase">Selesai Approval</span>
          <span className="text-2xl font-bold text-[var(--primary)]">{licenses.length}</span>
        </div>
      </div>

      {/* MAIN TABLE */}
      <div className="style-table-container">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--card-border)] bg-[var(--muted)]/50">
                <th className="p-4 text-xs font-bold uppercase text-[var(--muted-foreground)]">Investor & Kontak</th>
                <th className="p-4 text-xs font-bold uppercase text-[var(--muted-foreground)]">Detail Akun</th>
                <th className="p-4 text-xs font-bold uppercase text-[var(--muted-foreground)]">License Key</th>
                <th className="p-4 text-xs font-bold uppercase text-[var(--muted-foreground)]">Status & Expired</th>
                <th className="p-4 text-xs font-bold uppercase text-[var(--muted-foreground)] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="5" className="p-10 text-center">Memuat data...</td></tr>
              ) : filteredLicenses.length === 0 ? (
                <tr><td colSpan="5" className="p-20 text-center text-[var(--muted-foreground)]">Tidak ada lisensi ditemukan.</td></tr>
              ) : (
                filteredLicenses.map((item) => (
                  <tr key={item.accountNumber} className="border-b border-[var(--card-border)] hover:bg-[var(--muted)]/20 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-bold">
                          {item.investor_name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-[var(--foreground)]">{item.investor_name}</div>
                          <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                            <Mail size={10}/> {item.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-mono font-bold text-[var(--foreground)]">{item.accountNumber}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1">
                        <Server size={10}/> {item.broker_server}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="bg-[var(--background)] px-3 py-1.5 rounded border border-[var(--card-border)] text-[11px] font-mono font-bold text-[var(--primary)]">
                        {item.license_key}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1 ${
                        item.status === "ACTIVE" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      }`}>
                        {item.status}
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1">
                        <Calendar size={10}/> {formatDate(item.expiry_date)}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => toggleStatus(item)}
                          className={`p-2 rounded-lg transition-colors ${
                            item.status === "ACTIVE" 
                            ? "text-orange-500 hover:bg-orange-500/10" 
                            : "text-green-500 hover:bg-green-100"
                          }`}
                          title={item.status === "ACTIVE" ? "Suspend License" : "Re-Activate"}
                        >
                          {item.status === "ACTIVE" ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
                        </button>
                        <button 
                          onClick={() => deleteLicense(item.accountNumber)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Permanently"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}