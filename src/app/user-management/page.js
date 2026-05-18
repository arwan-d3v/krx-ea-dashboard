"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db, firebaseConfig } from "../../lib/firebase"; 
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, set, onValue, remove } from "firebase/database";
import { UserPlus, ShieldCheck, Trash2, Mail, Lock, Settings, X, Database } from "lucide-react";

export default function UserManagement() {
  const { role } = useAuth();
  const [users, setUsers] = useState({});
  const [eaAccounts, setEaAccounts] = useState([]); // Menyimpan daftar akun MT5 yang tersedia

  // Form & Status Registrasi
  const [formData, setForm] = useState({ email: "", role: "investor", password: "" });
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  // === STATE UNTUK MODAL MAPPING AKUN ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [checkedAccounts, setCheckedAccounts] = useState({});
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  // ========================================================================
  // 1. DATA FETCHING: AMBIL DATA USERS DAN DAFTAR AKUN EA
  // ========================================================================
  useEffect(() => {
    if (role === 'super_admin') {
      // Tarik Data User
      const usersRef = ref(db, 'users');
      const unsubUsers = onValue(usersRef, (snapshot) => {
        if (snapshot.exists()) {
          setUsers(snapshot.val());
        } else {
          setUsers({});
        }
      });

      // Tarik Daftar Akun EA (Untuk Checklist)
      const accountsRef = ref(db, 'account_data');
      const unsubAccounts = onValue(accountsRef, (snapshot) => {
        if (snapshot.exists()) {
          // Ambil hanya kunci-kuncinya (ID Akun MT5)
          setEaAccounts(Object.keys(snapshot.val())); 
        } else {
          setEaAccounts([]);
        }
      });

      // Bersihkan listener saat komponen dilepas
      return () => {
        unsubUsers();
        unsubAccounts();
      };
    }
  }, [role]);

  // Proteksi Halaman
  if (role !== 'super_admin') {
    return <div className="flex h-[80vh] items-center justify-center font-bold text-red-500 text-xl">Akses Ditolak</div>;
  }

  // ========================================================================
  // 2. LOGIKA REGISTRASI USER BARU (MENGGUNAKAN SHADOW APP)
  // ========================================================================
  const handleRegisterUser = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMsg({ type: "", text: "" });

    try {
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        formData.email, 
        formData.password
      );
      
      const newUid = userCredential.user.uid; 

      await set(ref(db, `users/${newUid}`), {
        email: formData.email.toLowerCase(),
        role: formData.role,
        createdAt: new Date().toISOString()
      });

      await signOut(secondaryAuth);

      setMsg({ type: "success", text: "User berhasil didaftarkan dan siap untuk Login!" });
      setForm({ email: "", role: "investor", password: "" });
      
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        setMsg({ type: "error", text: "Gagal: Email sudah terdaftar di sistem!" });
      } else if (error.code === 'auth/weak-password') {
        setMsg({ type: "error", text: "Gagal: Password minimal 6 karakter!" });
      } else {
        setMsg({ type: "error", text: "Gagal menambahkan user. Periksa koneksi." });
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMsg({ type: "", text: "" }), 5000);
    }
  };

  const handleDeleteUser = async (uid) => {
    if(confirm("PERINGATAN: Hapus user ini dari Database?")) {
      await remove(ref(db, `users/${uid}`));
    }
  };

  // ========================================================================
  // 3. LOGIKA MAPPING AKUN (MODAL CHECKLIST)
  // ========================================================================
  const openAccessModal = (uid, userObj) => {
    setSelectedUser({ uid, email: userObj.email });
    
    // Siapkan checklist berdasarkan data 'owned_accounts' yang ada di Firebase
    const initialChecked = {};
    if (userObj.owned_accounts) {
      Object.keys(userObj.owned_accounts).forEach(accId => {
        initialChecked[accId] = userObj.owned_accounts[accId];
      });
    }
    setCheckedAccounts(initialChecked);
    setIsModalOpen(true);
  };

  const handleCheckboxToggle = (accId) => {
    setCheckedAccounts(prev => ({
      ...prev,
      [accId]: !prev[accId] // Balikkan nilai true/false
    }));
  };

  const saveAccessMapping = async () => {
    setIsSavingAccess(true);
    try {
      // Saring hanya akun yang bernilai 'true'
      const finalMapping = {};
      Object.keys(checkedAccounts).forEach(accId => {
        if (checkedAccounts[accId] === true) {
          finalMapping[accId] = true;
        }
      });

      // Timpa node owned_accounts milik user tersebut
      await set(ref(db, `users/${selectedUser.uid}/owned_accounts`), finalMapping);
      
      setIsModalOpen(false);
      alert(`Hak akses untuk ${selectedUser.email} berhasil diperbarui!`);
    } catch (error) {
      console.error("Gagal menyimpan mapping", error);
      alert("Terjadi kesalahan saat menyimpan hak akses.");
    } finally {
      setIsSavingAccess(false);
    }
  };


  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans relative">
      
      {/* HEADER SECTION */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm flex items-center gap-5">
        <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-500 shadow-inner"><ShieldCheck size={36}/></div>
        <div>
          <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">System Access Manager</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Kelola role dan alokasi akun EA untuk Admin & Investor.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ================= FORM TAMBAH USER ================= */}
        <div className="lg:col-span-1 bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm h-fit">
          <h2 className="text-lg font-black text-[var(--foreground)] mb-6 flex items-center gap-2">
            <UserPlus className="text-purple-500" size={20}/> Daftarkan User Baru
          </h2>

          {msg.text && (
            <div className={`mb-4 p-3 rounded-xl text-sm font-bold ${msg.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleRegisterUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-[var(--muted-foreground)] opacity-70" size={16} />
                <input type="email" required value={formData.email} onChange={(e) => setForm({...formData, email: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-purple-500" placeholder="investor@mail.com"/>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase">Password (Min. 6 Karakter)</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-[var(--muted-foreground)] opacity-70" size={16} />
                <input type="text" required minLength="6" value={formData.password} onChange={(e) => setForm({...formData, password: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-purple-500" placeholder="Minimal 6 karakter"/>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase">Hak Akses (Role)</label>
              <select value={formData.role} onChange={(e) => setForm({...formData, role: e.target.value})} className="w-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl px-4 py-3 outline-none cursor-pointer">
                <option value="investor">Investor (Dashboard Terbatas)</option>
                <option value="admin">Admin (Kelola Lisensi & Dashboard Terbatas)</option>
              </select>
            </div>

            <button type="submit" disabled={isProcessing} className="w-full bg-purple-500 hover:opacity-90 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-md transition-all mt-4 flex justify-center items-center gap-2">
              {isProcessing ? 'Mendaftarkan...' : 'Tambahkan Akses'}
            </button>
          </form>
        </div>

        {/* ================= TABEL DAFTAR USER ================= */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 md:p-8 border-b border-[var(--card-border)] flex justify-between items-center">
             <h2 className="text-lg font-black text-[var(--foreground)] flex items-center gap-2">
               <Database className="text-blue-500" size={20}/> Daftar Akun Terdaftar
             </h2>
          </div>
          
          <div className="overflow-x-auto w-full custom-scrollbar flex-grow p-6">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  <th className="pb-3 text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider pl-2">Informasi Akun</th>
                  <th className="pb-3 text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider text-center">Akses EA</th>
                  <th className="pb-3 text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider text-center">Role</th>
                  <th className="pb-3 text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider text-right pr-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {Object.keys(users).map((uid) => {
                  const userObj = users[uid];
                  // Hitung jumlah akun EA yang dimiliki user ini
                  const ownedCount = userObj.owned_accounts ? Object.keys(userObj.owned_accounts).length : 0;

                  return (
                    <tr key={uid} className="hover:bg-[var(--muted)]/30 transition-colors">
                      <td className="py-4 pl-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${userObj.role === 'super_admin' ? 'bg-amber-500' : userObj.role === 'admin' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                            {userObj.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[var(--foreground)]">{userObj.email}</div>
                            <div className="text-[10px] text-[var(--muted-foreground)] uppercase mt-0.5 tracking-wider">UID: {uid.substring(0,8)}...</div>
                          </div>
                        </div>
                      </td>

                      {/* 🟢 FIX: Kolom Indikator Jumlah Akun (Berlaku untuk Admin & Investor) */}
                      <td className="py-4 text-center">
                        {userObj.role !== 'super_admin' ? (
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${ownedCount > 0 ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-500/10 text-slate-500'}`}>
                            {ownedCount} Akun EA
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-[var(--muted-foreground)]">ALL ACCESS</span>
                        )}
                      </td>

                      <td className="py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          userObj.role === 'super_admin' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                          userObj.role === 'admin' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                          'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }`}>
                          {userObj.role.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-4 text-right pr-2">
                         <div className="flex items-center justify-end gap-2">
                           {/* 🟢 FIX: Tombol Kelola Akses EA muncul untuk Admin & Investor */}
                           {userObj.role !== 'super_admin' && (
                             <button 
                               onClick={() => openAccessModal(uid, userObj)} 
                               className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-lg transition-colors title='Kelola Akses EA'"
                             >
                               <Settings size={16}/>
                             </button>
                           )}

                           {/* Tombol Hapus (Dilarang menghapus super admin) */}
                           {userObj.role !== 'super_admin' && (
                             <button 
                               onClick={() => handleDeleteUser(uid)} 
                               className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors title='Hapus User'"
                             >
                               <Trash2 size={16}/>
                             </button>
                           )}
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================= MODAL: ALOKASI AKUN EA ================= */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-md rounded-3xl shadow-[0_0_40px_rgba(59,130,246,0.15)] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-blue-500/5">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">Alokasi Akun EA</h3>
                <p className="text-[10px] text-blue-400 font-mono tracking-widest mt-1">{selectedUser.email}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={24}/>
              </button>
            </div>

            {/* Modal Body: Daftar Akun (Checklist) */}
            <div className="p-6 max-h-[50vh] overflow-y-auto space-y-3 custom-scrollbar">
              {eaAccounts.length === 0 ? (
                <p className="text-center text-xs text-slate-500 italic py-4">Belum ada node akun EA yang menyala di server.</p>
              ) : (
                eaAccounts.map(accId => (
                  <label 
                    key={accId} 
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                      checkedAccounts[accId] 
                        ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        className="peer sr-only"
                        checked={checkedAccounts[accId] || false}
                        onChange={() => handleCheckboxToggle(accId)}
                      />
                      {/* Custom Checkbox UI */}
                      <div className="w-5 h-5 border-2 border-slate-500 rounded flex items-center justify-center peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-colors">
                        {checkedAccounts[accId] && <ShieldCheck size={14} className="text-white" />}
                      </div>
                    </div>
                    <div>
                      <p className={`font-black tracking-widest font-mono text-sm ${checkedAccounts[accId] ? 'text-blue-400' : 'text-slate-300'}`}>
                        {accId}
                      </p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">KRX Quantitative Node</p>
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-black/50">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={saveAccessMapping}
                disabled={isSavingAccess}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                {isSavingAccess ? 'Menyimpan...' : 'Simpan Hak Akses'}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}