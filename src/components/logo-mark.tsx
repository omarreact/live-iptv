import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-8 shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pinflix-mark" x1="7" y1="5" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff6b7d" />
          <stop offset="0.52" stopColor="#ff304f" />
          <stop offset="1" stopColor="#7c4dff" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="34" height="34" rx="11" fill="url(#pinflix-mark)" />
      <path d="M16.2 12.6 29 20l-12.8 7.4V12.6Z" fill="white" />
      <circle cx="30.6" cy="9.8" r="2.5" fill="white" />
    </svg>
  );
}
