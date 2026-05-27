"use client";

/**
 * Standardized empty state component
 * @param {ReactNode} icon - Icon to display
 * @param {string} title - Title text
 * @param {string} description - Description text
 */
export default function EmptyState({ icon, title, description }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-8">
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-12 text-center max-w-md">
        {icon && <div className="mx-auto mb-4">{icon}</div>}
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">{title}</h2>
        <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
      </div>
    </div>
  );
}