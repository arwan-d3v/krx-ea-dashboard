"use client";
import { useState } from 'react';
import { Send, CheckCircle, AlertTriangle } from 'lucide-react';

export default function TestBot() {
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);

  const sendTestMessage = async () => {
    setIsSending(true);
    setStatus("Memulai transmisi data...");
    
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "🤖 <b>KRX COMMAND CENTER ALERT</b>\n\n✅ Sistem saraf notifikasi Telegram telah berhasil <i>online</i>, Komandan! 🚀\n\nMenunggu instruksi selanjutnya..."
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setStatus("✅ Pesan berhasil terkirim ke target!");
      } else {
        setStatus("❌ Transmisi Gagal: " + data.error);
      }
    } catch (error) {
      setStatus("❌ Error Sistem: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#030712] text-white font-sans">
      <div className="p-8 bg-[#0a0a0a] border border-blue-500/30 rounded-3xl shadow-[0_0_40px_rgba(59,130,246,0.15)] text-center max-w-md w-full">
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
          <Send size={28} className="text-blue-500 ml-1" />
        </div>
        
        <h1 className="text-2xl font-black mb-2 tracking-tight">Bot Transmitter</h1>
        <p className="text-sm text-gray-500 mb-8">Uji coba pengiriman log notifikasi ke channel Telegram Super Admin.</p>
        
        <button
          onClick={sendTestMessage}
          disabled={isSending}
          className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2"
        >
          {isSending ? 'Transmitting...' : 'Tembak Notifikasi'}
        </button>
        
        {status && (
          <div className={`mt-6 p-4 rounded-xl text-sm font-bold flex items-start gap-2 ${status.includes('✅') ? 'bg-green-500/10 text-green-500 border border-green-500/20' : status.includes('❌') ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
            {status.includes('✅') ? <CheckCircle size={18} className="shrink-0 mt-0.5"/> : status.includes('❌') ? <AlertTriangle size={18} className="shrink-0 mt-0.5"/> : <Send size={18} className="shrink-0 mt-0.5"/>}
            <span className="text-left">{status}</span>
          </div>
        )}
      </div>
    </div>
  );
}