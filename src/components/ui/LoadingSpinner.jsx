"use client";

/**
 * Standardized loading spinner component
 * @param {string} message - Loading message to display
 * @param {string} size - Size: 'sm' | 'md' | 'lg'
 */
export default function LoadingSpinner({ message = "Loading...", size = "md" }) {
  const sizeMap = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const iconSize = size === "sm" ? 16 : size === "md" ? 24 : 32;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div
          className={`${sizeMap[size]} rounded-full bg-blue-600/20 flex items-center justify-center animate-pulse`}
        >
          <svg
            className="animate-spin text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            width={iconSize}
            height={iconSize}
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        {/* Message */}
        <p className="text-sm text-[var(--muted-foreground)] font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}