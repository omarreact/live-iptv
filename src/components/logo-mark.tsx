import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-8 shrink-0 text-brand", className)}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M7 4h12.5C28.7 4 35 9.2 35 17s-6.3 13-15.5 13H14v6H7V4Zm7 7v12h5.2c5.2 0 8.8-2.2 8.8-6s-3.6-6-8.8-6H14Zm3.1 1.7 7.8 4.3-7.8 4.3v-8.6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
