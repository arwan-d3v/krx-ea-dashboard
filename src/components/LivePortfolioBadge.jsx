import { Radio } from "lucide-react";

export default function LivePortfolioBadge({ lang = "en", compact = false }) {
  const label = lang === "id" ? "PORTFOLIO AKTIF" : "LIVE PORTFOLIO";

  // Versi compact untuk integrasi di navbar
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 backdrop-blur-sm" style={{ animation: "dim-blink 4s ease-in-out infinite" }}>
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        <Radio size={10} className="text-red-500/60 shrink-0" />
        <span className="text-[9px] font-black text-red-500/60 tracking-widest uppercase leading-none whitespace-nowrap hidden sm:inline">
          {label}
        </span>
      </div>
    );
  }

  // Versi full untuk standalone usage
  return (
    <div className="fixed top-4 left-4 z-50 pointer-events-none select-none" style={{ animation: "dim-blink 4s ease-in-out infinite" }}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 backdrop-blur-md shadow-[0_0_14px_rgba(239,68,68,0.12)]">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 opacity-70"></span>
        </span>
        <Radio size={10} className="text-red-500/60 shrink-0" />
        <span className="text-[9px] font-black text-red-500/60 tracking-widest uppercase leading-none whitespace-nowrap">
          {label}
        </span>
      </div>
    </div>
  );
}