import { FlaskConical, AlertTriangle } from "lucide-react";

export default function LabTestingBadge({ lang = "en" }) {
  const t = {
    en: {
      label: "UNDER LAB TEST",
      desc: "Live validation in progress",
    },
    id: {
      label: "UJI LABORATORIUM",
      desc: "Validasi live sedang berlangsung",
    },
  };

  const labels = t[lang] || t.en;

  return (
    <div className="absolute top-4 right-4 z-20 group/badge">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 backdrop-blur-md shadow-[0_0_12px_rgba(245,158,11,0.2)] cursor-default">
        <FlaskConical size={12} className="text-amber-400 shrink-0" />
        <span className="text-[8px] font-black text-amber-400 tracking-widest uppercase leading-none whitespace-nowrap">
          {labels.label}
        </span>
      </div>
      {/* Tooltip on hover */}
      <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-black/90 backdrop-blur-md border border-amber-500/20 rounded-lg opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={10} className="text-amber-400 shrink-0" />
          <span className="text-[9px] text-amber-300 font-bold">
            {labels.desc}
          </span>
        </div>
      </div>
    </div>
  );
}