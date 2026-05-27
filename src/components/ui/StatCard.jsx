"use client";

/**
 * Reusable stat card component with accent colors and modern design
 * @param {ReactNode} icon - Icon component
 * @param {string} label - Card label
 * @param {string|number} value - Main value to display
 * @param {string} sub - Subtitle text
 * @param {string} accent - Color accent: 'emerald' | 'blue' | 'purple' | 'amber'
 * @param {boolean} animated - Whether to animate on mount
 */
export default function StatCard({ icon, label, value, sub, accent = "blue", animated = true }) {
  const accentStyles = {
    emerald: {
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      glow: "shadow-[0_0_20px_rgba(0,245,102,0.1)]",
    },
    blue: {
      border: "border-blue-500/20",
      bg: "bg-blue-500/5",
      glow: "shadow-[0_0_20px_rgba(59,130,246,0.1)]",
    },
    purple: {
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
      glow: "shadow-[0_0_20px_rgba(139,92,246,0.1)]",
    },
    amber: {
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
      glow: "shadow-[0_0_20px_rgba(245,158,11,0.1)]",
    },
  };

  const styles = accentStyles[accent] || accentStyles.blue;

  return (
    <div
      className={`
        bg-[var(--card-bg)] border rounded-2xl p-5
        ${styles.border} ${styles.bg} ${styles.glow}
        ${animated ? "animate-fadeInUp" : ""}
        hover:scale-[1.02] transition-all duration-300
      `}
    >
      <div className="flex items-center gap-3 mb-3">{icon}</div>
      <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-lg font-black text-[var(--foreground)] tracking-tight truncate">
        {value}
      </div>
      <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{sub}</div>
    </div>
  );
}