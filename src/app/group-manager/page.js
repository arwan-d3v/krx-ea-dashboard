"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../../lib/firebase"; 
import { ref, set, push, onValue, remove } from "firebase/database";
import { Folders, Plus, Trash2, Settings, ShieldCheck, Database, X, Users } from "lucide-react";

export default function GroupManager() {
  const { role } = useAuth();
  
  const [groups, setGroups] = useState({});
  const [eaAccounts, setEaAccounts] = useState([]);
  
  // State Form Pembuatan Grup
  const [newGroupName, setNewGroupName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // State Modal Mapping Akun
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [checkedAccounts, setCheckedAccounts] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // ========================================================================
  // 1. DATA FETCHING: AMBIL DATA GRUP DAN AKUN EA
  // ========================================================================
  useEffect(() => {
    if (role === 'super_admin') {
      // Tarik Daftar Grup
      const groupsRef = ref(db, 'groups');
      const unsubGroups = onValue(groupsRef, (snapshot) => {
        if (snapshot.exists()) {
          setGroups(snapshot.val());
        } else {
          setGroups({});
        }
      });

      // Tarik Daftar Akun EA (Untuk Checklist)
      const accountsRef = ref(db, 'account_data');
      const unsubAccounts = onValue(accountsRef, (snapshot) => {
        if (snapshot.exists()) {
          setEaAccounts(Object.keys(snapshot.val())); 
        } else {
          setEaAccounts([]);
        }
      });

      return () => {
        unsubGroups();
        unsubAccounts();
      };
    }
  }, [role]);

  // Proteksi Halaman
  if (role !== 'super_admin') {
    return <div className="flex h-[80vh] items-center justify-center font-bold text-red-500 text-xl">Akses Ditolak: Hanya Super Admin</div>;
  }

  // ========================================================================
  // 2. LOGIKA PEMBUATAN & PENGHAPUSAN GRUP
  // ========================================================================
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setIsProcessing(true);

    try {
      const groupRef = push(ref(db, 'groups'));
      await set(groupRef, {
        name: newGroupName,
        createdAt: new Date().toISOString()
      });
      setNewGroupName("");
    } catch (error) {
      console.error("Gagal membuat grup", error);
      alert("Gagal membuat grup.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if(confirm(`PERINGATAN: Hapus grup "${groupName}" beserta data alokasi akun di dalamnya?`)) {
      await remove(ref(db, `groups/${groupId}`));
    }
  };

  // ========================================================================
  // 3. LOGIKA MAPPING AKUN KE GRUP (MODAL)
  // ========================================================================
  const openMappingModal = (groupId, groupData) => {
    setSelectedGroup({ id: groupId, name: groupData.name });
    
    // Siapkan checklist akun yang sudah ada di grup ini
    const initialChecked = {};
    if (groupData.accounts) {
      Object.keys(groupData.accounts).forEach(accId => {
        initialChecked[accId] = groupData.accounts[accId];
      });
    }
    setCheckedAccounts(initialChecked);
    setIsModalOpen(true);
  };

  const handleCheckboxToggle = (accId) => {
    setCheckedAccounts(prev => ({
      ...prev,
      [accId]: !prev[accId]
    }));
  };

  const saveGroupAccounts = async () => {
    setIsSaving(true);
    try {
      // Saring hanya akun yang bernilai true
      const finalMapping = {};
      Object.keys(checkedAccounts).forEach(accId => {
        if (checkedAccounts[accId] === true) {
          finalMapping[accId] = true;
        }
      });

      // Simpan ke node groups/groupId/accounts
      await set(ref(db, `groups/${selectedGroup.id}/accounts`), finalMapping);
      
      setIsModalOpen(false);
    } catch (error) {
      console.error("Gagal menyimpan mapping", error);
      alert("Terjadi kesalahan saat menyimpan alokasi akun.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans relative">
      
      {/* HEADER SECTION */}
      <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm flex items-center gap-5">
        <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-500 shadow-inner"><Folders size={36}/></div>
        <div>
          <h1 className="text-2xl font-black text-[var(--foreground)] tracking-tight">Group & Cluster Manager</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Buat kategori/batch dan kelompokkan akun MT5 ke dalamnya.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ================= FORM BUAT GRUP BARU ================= */}
        <div className="lg:col-span-1 bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] p-6 md:p-8 shadow-sm h-fit">
          <h2 className="text-lg font-black text-[var(--foreground)] mb-6 flex items-center gap-2">
            <Plus className="text-purple-500" size={20}/> Buat Cluster Baru
          </h2>

          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase">Nama Kategori / Batch</label>
              <div className="relative">
                <Users className="absolute left-4 top-3.5 text-[var(--muted-foreground)] opacity-70" size={16} />
                <input 
                  type="text" 
                  required 
                  value={newGroupName} 
                  onChange={(e) => setNewGroupName(e.target.value)} 
                  className="w-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-purple-500" 
                  placeholder="Misal: Investor Batch 1"
                />
              </div>
            </div>

            <button type="submit" disabled={isProcessing} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-all mt-4 flex justify-center items-center gap-2">
              {isProcessing ? 'Membuat...' : 'Create Cluster'}
            </button>
          </form>
        </div>

        {/* ================= DAFTAR GRUP (KOTAK) ================= */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.keys(groups).length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center p-12 bg-[var(--card-bg)] rounded-3xl border border-[var(--card-border)] border-dashed">
              <Folders size={48} className="text-[var(--muted-foreground)] opacity-30 mb-3"/>
              <p className="text-sm font-bold text-[var(--muted-foreground)]">Belum ada cluster/grup yang dibuat.</p>
            </div>
          ) : (
            Object.keys(groups).map((groupId) => {
              const groupData = groups[groupId];
              const accCount = groupData.accounts ? Object.keys(groupData.accounts).length : 0;

              return (
                <div key={groupId} className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-5 flex flex-col justify-between shadow-sm hover:border-purple-500/50 transition-colors group">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-lg text-[var(--foreground)] tracking-tight">{groupData.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${accCount > 0 ? 'bg-purple-500/10 text-purple-500' : 'bg-slate-500/10 text-slate-500'}`}>
                        {accCount} Akun
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--muted-foreground)] font-mono">ID: {groupId.substring(1, 9)}...</p>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[var(--card-border)]">
                    <button 
                      onClick={() => openMappingModal(groupId, groupData)}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Settings size={14}/> Kelola Akun
                    </button>
                    <button 
                      onClick={() => handleDeleteGroup(groupId, groupData.name)}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= MODAL: ALOKASI AKUN KE GRUP ================= */}
      {isModalOpen && selectedGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-md rounded-3xl shadow-[0_0_40px_rgba(147,51,234,0.15)] overflow-hidden">
            
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-purple-500/5">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">Alokasi Akun ke Cluster</h3>
                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mt-1">Group: {selectedGroup.name}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={24}/>
              </button>
            </div>

            <div className="p-6 max-h-[50vh] overflow-y-auto space-y-3 custom-scrollbar">
              {eaAccounts.length === 0 ? (
                <p className="text-center text-xs text-slate-500 italic py-4">Belum ada node akun EA di server.</p>
              ) : (
                eaAccounts.map(accId => (
                  <label 
                    key={accId} 
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                      checkedAccounts[accId] 
                        ? 'bg-purple-500/10 border-purple-500/40 shadow-[0_0_15px_rgba(147,51,234,0.1)]' 
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
                      <div className="w-5 h-5 border-2 border-slate-500 rounded flex items-center justify-center peer-checked:bg-purple-500 peer-checked:border-purple-500 transition-colors">
                        {checkedAccounts[accId] && <ShieldCheck size={14} className="text-white" />}
                      </div>
                    </div>
                    <div>
                      <p className={`font-black tracking-widest font-mono text-sm ${checkedAccounts[accId] ? 'text-purple-400' : 'text-slate-300'}`}>
                        {accId}
                      </p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">MT5 Trading Node</p>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-black/50">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                Batal
              </button>
              <button onClick={saveGroupAccounts} disabled={isSaving} className="px-5 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white uppercase tracking-widest transition-colors flex items-center gap-2">
                {isSaving ? 'Menyimpan...' : 'Simpan Alokasi'}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}